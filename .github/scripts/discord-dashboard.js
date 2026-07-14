/**
 * Discord Build Dashboard
 *
 * Mantém UMA mensagem fixa no Discord (criada uma única vez e editada a cada
 * execução) com o status dos últimos builds do GitHub Actions, e dispara um
 * alerta separado sempre que um build falha, com link direto para os logs.
 *
 * O ID da mensagem do dashboard é persistido em
 * .github/discord-dashboard-message-id.txt no próprio repositório, para que
 * o workflow saiba se deve criar uma mensagem nova ou editar a existente.
 *
 * Variáveis de ambiente esperadas:
 *  - DISCORD_WEBHOOK_URL (obrigatória)
 *  - GITHUB_TOKEN        (fornecido automaticamente pelo Actions)
 *  - GITHUB_REPOSITORY   (owner/repo, fornecido automaticamente)
 *  - GITHUB_SERVER_URL   (fornecido automaticamente)
 *  - GITHUB_RUN_ID       (fornecido automaticamente)
 *  - GITHUB_SHA
 *  - GITHUB_REF_NAME
 *  - GITHUB_ACTOR
 *  - JOB_STATUS          ("success" | "failure" | "cancelled")
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const MESSAGE_ID_FILE = path.join(__dirname, '..', 'discord-dashboard-message-id.txt');
const MAX_RUNS_SHOWN = 8;

function httpRequest(urlStr, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const payload = body ? Buffer.from(body) : null;
    const reqHeaders = { ...headers };
    if (payload) reqHeaders['Content-Length'] = payload.length;

    const req = https.request(
      url,
      { method, headers: reqHeaders },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function githubApi(pathname) {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const res = await httpRequest(`https://api.github.com/repos/${repo}${pathname}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'discord-build-dashboard',
      Accept: 'application/vnd.github+json',
    },
  });
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`GitHub API ${pathname} respondeu ${res.statusCode}: ${res.body}`);
  }
  return JSON.parse(res.body);
}

function statusEmoji(run) {
  if (run.status !== 'completed') return '🟡';
  if (run.conclusion === 'success') return '✅';
  if (run.conclusion === 'failure') return '❌';
  if (run.conclusion === 'cancelled') return '⚪';
  return '⚠️';
}

async function buildDashboardEmbed() {
  const serverUrl = process.env.GITHUB_SERVER_URL;
  const repo = process.env.GITHUB_REPOSITORY;
  const workflowFile = 'build-windows.yml';

  const runsData = await githubApi(
    `/actions/workflows/${workflowFile}/runs?per_page=${MAX_RUNS_SHOWN}`
  );
  const runs = runsData.workflow_runs || [];

  const lines = runs.map((run) => {
    const shortSha = run.head_sha.slice(0, 7);
    const runUrl = `${serverUrl}/${repo}/actions/runs/${run.id}`;
    const when = new Date(run.created_at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    return `${statusEmoji(run)} [\`${shortSha}\`](${runUrl}) — ${run.display_title || run.name} — ${when}`;
  });

  const latest = runs[0];
  const totalRuns = runs.length;
  const failedCount = runs.filter((r) => r.conclusion === 'failure').length;
  const successCount = runs.filter((r) => r.conclusion === 'success').length;

  const overallColor =
    latest && latest.conclusion === 'failure'
      ? 15158332
      : latest && latest.conclusion === 'success'
      ? 3066993
      : 15844367;

  return {
    title: '📊 Dashboard de Builds — CS2 Ultimate Optimizer',
    description:
      (lines.length ? lines.join('\n') : 'Nenhum build encontrado ainda.') +
      `\n\n**Resumo (últimos ${totalRuns}):** ✅ ${successCount}  ❌ ${failedCount}`,
    color: overallColor,
    footer: { text: `Atualizado automaticamente • ${repo}` },
    timestamp: new Date().toISOString(),
  };
}

async function upsertDashboardMessage(webhookUrl, embed) {
  const webhookMatch = webhookUrl.match(/\/webhooks\/(\d+)\/([^/?]+)/);
  if (!webhookMatch) {
    throw new Error('DISCORD_WEBHOOK_URL em formato inesperado — não foi possível extrair id/token.');
  }
  const [, webhookId, webhookToken] = webhookMatch;

  let existingId = null;
  if (fs.existsSync(MESSAGE_ID_FILE)) {
    existingId = fs.readFileSync(MESSAGE_ID_FILE, 'utf8').trim() || null;
  }

  const payload = JSON.stringify({ embeds: [embed] });

  if (existingId) {
    const editUrl = `https://discord.com/api/webhooks/${webhookId}/${webhookToken}/messages/${existingId}`;
    const editRes = await httpRequest(editUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    if (editRes.statusCode >= 200 && editRes.statusCode < 300) {
      console.log('Dashboard existente atualizado com sucesso (id:', existingId, ')');
      return;
    }
    console.log(
      `Falha ao editar mensagem existente (status ${editRes.statusCode}) — provavelmente foi apagada. Criando uma nova.`
    );
  }

  const createUrl = `https://discord.com/api/webhooks/${webhookId}/${webhookToken}?wait=true`;
  const createRes = await httpRequest(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  if (createRes.statusCode < 200 || createRes.statusCode >= 300) {
    throw new Error(`Falha ao criar mensagem do dashboard: ${createRes.statusCode} ${createRes.body}`);
  }
  const created = JSON.parse(createRes.body);
  fs.writeFileSync(MESSAGE_ID_FILE, created.id);
  console.log('Novo dashboard criado (id:', created.id, ') e salvo em', MESSAGE_ID_FILE);
}

async function sendFailureAlert(webhookUrl) {
  const serverUrl = process.env.GITHUB_SERVER_URL;
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  const sha = process.env.GITHUB_SHA || '';
  const refName = process.env.GITHUB_REF_NAME || '';
  const actor = process.env.GITHUB_ACTOR || '';
  const shortSha = sha.slice(0, 7);
  const runUrl = `${serverUrl}/${repo}/actions/runs/${runId}`;
  const commitUrl = `${serverUrl}/${repo}/commit/${sha}`;

  const payload = JSON.stringify({
    content: '@here',
    embeds: [
      {
        title: '❌ Build falhou',
        description:
          `Repositório: ${repo}\n` +
          `Commit: [\`${shortSha}\`](${commitUrl})\n` +
          `Branch: ${refName}\n` +
          `Autor: ${actor}\n` +
          `👉 [Abrir logs completos do run](${runUrl})`,
        color: 15158332,
        timestamp: new Date().toISOString(),
      },
    ],
  });

  const res = await httpRequest(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  console.log('Alerta de falha enviado, status:', res.statusCode);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    console.error('Corpo da resposta:', res.body);
  }
}

async function main() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('DISCORD_WEBHOOK_URL não configurado — pulando dashboard/alerta do Discord.');
    return;
  }

  const jobStatus = process.env.JOB_STATUS || 'success';

  try {
    const embed = await buildDashboardEmbed();
    await upsertDashboardMessage(webhookUrl, embed);
  } catch (err) {
    console.error('Falha ao atualizar o dashboard do Discord:', err.message);
    // Não derruba o build por causa do dashboard.
  }

  if (jobStatus === 'failure') {
    try {
      await sendFailureAlert(webhookUrl);
    } catch (err) {
      console.error('Falha ao enviar alerta de build no Discord:', err.message);
    }
  }
}

main().catch((err) => {
  console.error('Erro inesperado no discord-dashboard.js:', err);
  process.exit(0); // nunca falha o job por causa da notificação
});
