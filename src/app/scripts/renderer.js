/**
 * Renderer principal
 * Controla navegação entre views e liga a UI aos módulos via window.cs2app.
 */

document.getElementById('btn-min').addEventListener('click', () => window.cs2app.window.minimize());
document.getElementById('btn-max').addEventListener('click', () => window.cs2app.window.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.cs2app.window.close());

function switchView(viewId) {
  document.querySelectorAll('.view').forEach((el) => el.classList.add('d-none'));
  document.querySelectorAll('.nav-link').forEach((el) => el.classList.remove('active'));

  document.getElementById(`view-${viewId}`).classList.remove('d-none');
  document.querySelector(`.nav-link[data-view="${viewId}"]`).classList.add('active');

  if (viewId === 'dashboard') loadDashboard();
  if (viewId === 'windows') loadWindowsTweaks();
  if (viewId === 'backups') loadBackups();
  if (viewId === 'profiles') loadProfiles();
  if (viewId === 'cs2') loadCs2Autoexec();
  if (viewId === 'benchmark') {
    loadBenchmarkHistory();
    checkPresentMonStatus();
  }
}

document.querySelectorAll('.nav-link').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

async function loadDashboard() {
  const info = await window.cs2app.dashboard.getSystemInfo();
  const grid = document.getElementById('dashboard-grid');
  grid.innerHTML = `
    <div class="stat-card"><h4>CPU</h4><span>${info.cpu.model}</span></div>
    <div class="stat-card"><h4>GPU</h4><span>${info.gpu.model}</span></div>
    <div class="stat-card"><h4>RAM</h4><span>${info.ram.totalGB ?? '--'} GB</span></div>
    <div class="stat-card"><h4>Armazenamento</h4><span>${info.storage.type}</span></div>
    <div class="stat-card"><h4>Windows</h4><span>${info.os.name}</span></div>
    <div class="stat-card"><h4>FPS Esperado (CS2)</h4><span>${info.estimatedFps.csgo2 ?? '--'}</span></div>
  `;
}

function formatMB(mb) {
  if (mb == null) return '--';
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function renderScannerCategories(categories) {
  const container = document.getElementById('scanner-categories');
  container.innerHTML = categories
    .map(
      (c) => `
      <div class="tweak-item" data-category="${c.key}">
        <strong>${c.label}</strong>
        <span class="text-muted">${c.description}</span>
        <span class="badge-size">${formatMB(c.totalSizeMB)} · ${c.totalFiles} arquivos</span>
        <button class="btn btn-cs2 btn-sm" data-clean="${c.key}">Limpar</button>
      </div>`
    )
    .join('');

  container.querySelectorAll('button[data-clean]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Limpando...';
      try {
        const result = await window.cs2app.scanner.cleanCategory(btn.dataset.clean);
        Swal.fire({
          icon: 'success',
          title: `${result.label} limpo`,
          text: `${formatMB(result.freedMB)} liberados · ${result.deletedFiles} arquivos removidos${result.skipped ? ` · ${result.skipped} ignorados` : ''}`,
          background: '#14171f',
          color: '#f1f2f4',
          confirmButtonColor: '#ff6a00'
        });
        await runScan();
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Falha ao limpar',
          text: err.message,
          background: '#14171f',
          color: '#f1f2f4',
          confirmButtonColor: '#ff6a00'
        });
      } finally {
        btn.disabled = false;
        btn.textContent = 'Limpar';
      }
    });
  });
}

async function runScan() {
  const btn = document.getElementById('btn-run-scan');
  btn.disabled = true;
  btn.textContent = 'Escaneando...';
  try {
    const result = await window.cs2app.scanner.runFullScan();
    document.getElementById('scanner-result').textContent = JSON.stringify(result, null, 2);

    const summary = document.getElementById('scanner-summary');
    summary.classList.remove('d-none');
    summary.innerHTML = `
      <span>CPU: <strong>${result.cpuFamily || 'Não identificado'}</strong></span>
      <span>GPU: <strong>${result.gpuFamily || 'Não identificado'}</strong></span>
      <span>Armazenamento: <strong>${result.storageType || 'Não identificado'}</strong></span>
      <span>Espaço recuperável: <strong>${formatMB(result.cleanup.totalReclaimableMB)}</strong></span>
    `;

    renderScannerCategories(result.cleanup.categories);

    Swal.fire({
      icon: 'success',
      title: 'Scan concluído',
      background: '#14171f',
      color: '#f1f2f4',
      confirmButtonColor: '#ff6a00'
    });
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Falha no scan',
      text: err.message,
      background: '#14171f',
      color: '#f1f2f4',
      confirmButtonColor: '#ff6a00'
    });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Executar Scan Completo';
  }
}

document.getElementById('btn-run-scan').addEventListener('click', runScan);

// Estado client-side de "aplicado" por tweak (a sessão do processo Windows
// não é persistida entre execuções do app, então isso reflete só a sessão atual).
const windowsTweaksState = {};

const swalTheme = {
  background: '#14171f',
  color: '#f1f2f4',
  confirmButtonColor: '#ff6a00',
  cancelButtonColor: '#3a3f4b'
};

function swalSuccess(title, html) {
  return Swal.fire({ icon: 'success', title, html, ...swalTheme });
}

function swalError(title, text) {
  return Swal.fire({ icon: 'error', title, text, ...swalTheme });
}

function swalWarning(title, text) {
  return Swal.fire({ icon: 'warning', title, text, ...swalTheme });
}

function swalInfo(title, html) {
  return Swal.fire({ icon: 'info', title, html, ...swalTheme });
}

function swalConfirm({ title, html, confirmButtonText, icon = 'warning' }) {
  return Swal.fire({
    icon,
    title,
    html,
    showCancelButton: true,
    confirmButtonText: confirmButtonText || 'Aplicar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    focusCancel: true,
    ...swalTheme
  });
}

// Detalhes específicos exibidos na confirmação de cada tweak real.
async function buildConfirmDetails(tweakId) {
  if (tweakId === 'disable-unnecessary-services') {
    const services = await window.cs2app.windowsTweaks.getUnnecessaryServices();
    const items = services
      .map((s) => `<li><strong>${s.label}</strong> <span class="text-muted">(${s.name})</span> — ${s.description}</li>`)
      .join('');
    return {
      html: `
        <p class="text-muted" style="text-align:left">Os serviços abaixo serão <strong>desabilitados e parados</strong>. Isso pode ser revertido depois pelo botão "Reverter".</p>
        <ul style="text-align:left; max-height:220px; overflow-y:auto; padding-left:18px;">${items}</ul>
      `,
      confirmButtonText: 'Desabilitar serviços'
    };
  }

  if (tweakId === 'clean-system-cache') {
    const targets = await window.cs2app.windowsTweaks.getCacheTargets();
    const items = targets.map((t) => `<li><strong>${t.label}</strong> <span class="text-muted">${t.path}</span></li>`).join('');
    return {
      html: `
        <p style="text-align:left"><strong style="color:#ff9a9a">Atenção: esta ação não é reversível.</strong></p>
        <p class="text-muted" style="text-align:left">Os arquivos dentro das pastas abaixo serão apagados permanentemente:</p>
        <ul style="text-align:left; max-height:220px; overflow-y:auto; padding-left:18px;">${items}</ul>
      `,
      confirmButtonText: 'Limpar cache'
    };
  }

  if (tweakId === 'boost-process-priority') {
    const levels = await window.cs2app.windowsTweaks.getPriorityLevels();
    const options = levels.map((l) => `<option value="${l}" ${l === 'High' ? 'selected' : ''}>${l}</option>`).join('');
    return {
      html: `
        <p class="text-muted" style="text-align:left">Define a prioridade de CPU do processo informado. Use "RealTime" com cuidado — pode travar o sistema.</p>
        <div style="text-align:left; margin-top:10px;">
          <label class="text-muted" for="swal-process-name">Nome do processo</label>
          <input id="swal-process-name" class="swal2-input" value="cs2" style="margin:6px 0 12px;" />
          <label class="text-muted" for="swal-process-priority">Prioridade</label>
          <select id="swal-process-priority" class="swal2-input" style="margin-top:6px;">${options}</select>
        </div>
      `,
      confirmButtonText: 'Definir prioridade',
      preConfirm: () => {
        const processName = document.getElementById('swal-process-name').value.trim() || 'cs2';
        const priority = document.getElementById('swal-process-priority').value;
        return { processName, priority };
      }
    };
  }

  return { html: '<p class="text-muted">Confirma a aplicação deste ajuste?</p>', confirmButtonText: 'Aplicar' };
}

function formatTweakResult(tweakId, result) {
  if (result.skipped) {
    return '<p class="text-muted">Comando ignorado: este recurso só funciona no Windows. Nada foi alterado neste ambiente.</p>';
  }
  if (tweakId === 'disable-unnecessary-services') {
    const rows = (result.results || [])
      .map((r) => `<li><svg class="inline-icon ${r.success ? 'icon-ok' : 'icon-fail'}"><use href="#${r.success ? 'icon-check' : 'icon-cross'}"/></svg> ${r.name}${r.error ? ` — <span class="text-muted">${r.error}</span>` : ''}</li>`)
      .join('');
    return `<p>${result.disabledCount}/${result.total} serviços desabilitados</p><ul style="text-align:left; padding-left:18px;">${rows}</ul>`;
  }
  if (tweakId === 'clean-system-cache') {
    return `<p><strong>${formatMB(result.totalFreedMB)}</strong> liberados · ${result.totalDeletedFiles} arquivos removidos</p>`;
  }
  if (tweakId === 'boost-process-priority') {
    return `<p>Prioridade de <strong>${result.name}</strong> definida como <strong>${result.priority}</strong></p>`;
  }
  return '';
}

function renderTweakItem(t) {
  const state = windowsTweaksState[t.id] || {};
  const notImplementedNote = !t.implemented
    ? '<span class="tweak-badge tweak-badge-soon">Em breve</span>'
    : '<span class="tweak-badge tweak-badge-real">Ativo</span>';
  const applyLabel = state.applied ? 'Reaplicar' : 'Aplicar';
  const showRevert = t.implemented && t.reversible && state.applied;

  return `
    <div class="tweak-item" data-tweak-item="${t.id}">
      <div class="tweak-item-header">
        <strong>${t.name}</strong>
        ${notImplementedNote}
      </div>
      <span class="text-muted">${t.description}</span>
      ${state.lastMessageHtml ? `<div class="tweak-result">${state.lastMessageHtml}</div>` : ''}
      <div class="tweak-actions">
        <button class="btn btn-cs2 btn-sm" data-tweak="${t.id}" ${t.implemented ? '' : 'disabled title="Ainda não implementado"'}>${applyLabel}</button>
        ${showRevert ? `<button class="btn btn-outline-cs2 btn-sm" data-tweak-revert="${t.id}">Reverter</button>` : ''}
      </div>
    </div>`;
}

async function loadWindowsTweaks() {
  const container = document.getElementById('windows-tweaks-list');
  const [tweaks, isWindows] = await Promise.all([
    window.cs2app.windowsTweaks.listStatus(),
    window.cs2app.windowsTweaks.isWindowsPlatform()
  ]);

  const banner = isWindows
    ? ''
    : `<div class="presentmon-banner"><span class="presentmon-banner-text"><svg class="inline-icon"><use href="#icon-warning"/></svg> Este ambiente não é Windows — os ajustes reais (serviços, cache, prioridade) serão simulados e nada será alterado de verdade.</span></div>`;

  container.innerHTML = banner + tweaks.map(renderTweakItem).join('');
  attachWindowsTweaksHandlers(container);
}

function attachWindowsTweaksHandlers(container) {
  container.querySelectorAll('button[data-tweak]').forEach((btn) => {
    btn.addEventListener('click', () => handleApplyTweak(btn.dataset.tweak));
  });
  container.querySelectorAll('button[data-tweak-revert]').forEach((btn) => {
    btn.addEventListener('click', () => handleRevertTweak(btn.dataset.tweakRevert));
  });
}

async function handleApplyTweak(tweakId) {
  const details = await buildConfirmDetails(tweakId);
  const confirmResult = await swalConfirm({
    title: 'Confirmar alteração no sistema',
    html: details.html,
    confirmButtonText: details.confirmButtonText
  });
  if (!confirmResult.isConfirmed) return;

  const options = typeof details.preConfirm === 'function' ? details.preConfirm() : undefined;
  const btn = document.querySelector(`button[data-tweak="${tweakId}"]`);
  const originalLabel = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Aplicando...';
  }

  try {
    const result = await window.cs2app.windowsTweaks.apply(tweakId, options);
    if (!result || result.success === false) {
      swalWarning('Tweak não aplicado', (result && result.error) || 'Verifique os logs para mais detalhes.');
      windowsTweaksState[tweakId] = { applied: false, lastMessageHtml: formatTweakResult(tweakId, result || {}) };
    } else {
      windowsTweaksState[tweakId] = { applied: true, lastMessageHtml: formatTweakResult(tweakId, result), backupId: result.backupId || null };
      const backupNote = result.backupId
        ? '<p class="text-muted" style="margin-top:8px;">Um snapshot foi salvo em <strong>Backups</strong> antes desta alteração — você pode restaurá-lo a qualquer momento.</p>'
        : '';
      swalSuccess('Tweak aplicado com sucesso', formatTweakResult(tweakId, result) + backupNote);
    }
  } catch (err) {
    swalError('Falha ao aplicar tweak', err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
    loadWindowsTweaks();
  }
}

async function handleRevertTweak(tweakId) {
  const confirmResult = await swalConfirm({
    title: 'Reverter alteração?',
    html: '<p class="text-muted">Isso desfaz o ajuste aplicado anteriormente.</p>',
    confirmButtonText: 'Reverter',
    icon: 'question'
  });
  if (!confirmResult.isConfirmed) return;

  const btn = document.querySelector(`button[data-tweak-revert="${tweakId}"]`);
  const originalLabel = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Revertendo...';
  }

  try {
    const result = await window.cs2app.windowsTweaks.revert(tweakId);
    if (!result || result.success === false) {
      swalWarning('Não foi possível reverter', (result && result.error) || 'Verifique os logs para mais detalhes.');
    } else {
      windowsTweaksState[tweakId] = { applied: false, lastMessageHtml: '' };
      swalSuccess('Alteração revertida', '');
    }
  } catch (err) {
    swalError('Falha ao reverter tweak', err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
    loadWindowsTweaks();
  }
}

async function loadProfiles() {
  const profiles = await window.cs2app.profiles.list();
  const container = document.getElementById('profiles-list');
  container.innerHTML = profiles
    .map(
      (p) => `
      <div class="profile-item">
        <strong>${p.name}</strong>
        <span class="text-muted">${p.description}</span>
        <button class="btn btn-cs2 btn-sm" data-profile="${p.id}">Aplicar Perfil</button>
      </div>`
    )
    .join('');

  container.querySelectorAll('button[data-profile]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = 'Aplicando...';
      try {
        const result = await window.cs2app.profiles.apply(btn.dataset.profile);
        if (result && result.success === false) {
          Swal.fire({
            icon: 'warning',
            title: 'Perfil não aplicado',
            text: result.error || 'Verifique os logs para mais detalhes.',
            background: '#14171f',
            color: '#f1f2f4',
            confirmButtonColor: '#ff6a00'
          });
          return;
        }
        Swal.fire({
          icon: 'success',
          title: 'Perfil aplicado',
          background: '#14171f',
          color: '#f1f2f4',
          confirmButtonColor: '#ff6a00'
        });
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Falha ao aplicar perfil',
          text: err.message,
          background: '#14171f',
          color: '#f1f2f4',
          confirmButtonColor: '#ff6a00'
        });
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
  });
}

async function loadCs2Autoexec() {
  const content = await window.cs2app.cs2.getAutoexec();
  document.getElementById('cs2-autoexec').value = content;
}

document.getElementById('btn-save-autoexec').addEventListener('click', async () => {
  const content = document.getElementById('cs2-autoexec').value;
  await window.cs2app.cs2.saveAutoexec(content);
  Swal.fire({
    icon: 'success',
    title: 'Autoexec salvo',
    background: '#14171f',
    color: '#f1f2f4',
    confirmButtonColor: '#ff6a00'
  });
});

// ---------------------------------------------------------------------------
// Verificação do PresentMon (necessário para o Benchmark)
// ---------------------------------------------------------------------------

let presentMonDownloadUrl = 'https://github.com/GameTechDev/PresentMon/releases/latest';

function renderPresentMonBanner(status) {
  const banner = document.getElementById('presentmon-banner');
  const startBtn = document.getElementById('btn-start-benchmark');
  if (!banner || !status) return;

  if (status.downloadUrl) presentMonDownloadUrl = status.downloadUrl;

  if (status.installed) {
    banner.classList.add('d-none');
    if (startBtn) startBtn.disabled = false;
  } else {
    banner.classList.remove('d-none');
    if (startBtn) startBtn.disabled = true;
  }
}

async function checkPresentMonStatus() {
  try {
    const status = await window.cs2app.benchmark.checkPresentMon();
    renderPresentMonBanner(status);
    return status;
  } catch (err) {
    return null;
  }
}

document.getElementById('btn-download-presentmon')?.addEventListener('click', () => {
  window.cs2app.app.openExternal(presentMonDownloadUrl);
});

// Recebe o resultado da checagem feita automaticamente pelo processo principal
// na inicialização da app.
window.cs2app.benchmark.onPresentMonStatus((status) => {
  renderPresentMonBanner(status);
});

let benchmarkChart = null;

const BENCHMARK_STAGE_LABELS = {
  procurando_cs2: 'Procurando instalação do CS2...',
  lancando_cs2: 'Lançando o CS2...',
  capturando_frametimes: 'Capturando frame times (PresentMon)...',
  processando_resultados: 'Processando resultados...',
  concluido: 'Benchmark concluído!',
  erro: 'Erro no benchmark'
};

function renderBenchmarkChart(stats) {
  const ctx = document.getElementById('benchmark-chart');
  if (benchmarkChart) benchmarkChart.destroy();
  benchmarkChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Average FPS', '1% Low', '0.1% Low'],
      datasets: [
        {
          label: 'FPS',
          data: [stats.averageFps, stats.low1Percent, stats.low01Percent],
          backgroundColor: ['#ff6a00', '#ffb066', '#ff3d3d']
        }
      ]
    },
    options: {
      scales: {
        y: { beginAtZero: true, ticks: { color: '#c7cad1' } },
        x: { ticks: { color: '#c7cad1' } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderBenchmarkHistoryList(history) {
  const container = document.getElementById('benchmark-history');
  if (!history || history.length === 0) {
    container.innerHTML = '<p class="text-muted">Nenhum benchmark registrado ainda.</p>';
    return;
  }
  container.innerHTML = history
    .map(
      (run) => `
      <div class="tweak-item">
        <strong>${new Date(run.startedAt).toLocaleString('pt-BR')}</strong>
        <span class="text-muted">Duração: ${run.durationSeconds}s · ${run.stats.frameCount ?? 0} frames</span>
        <span class="badge-size">Avg ${run.stats.averageFps ?? '--'} FPS · 1% low ${run.stats.low1Percent ?? '--'} · 0.1% low ${run.stats.low01Percent ?? '--'}</span>
      </div>`
    )
    .join('');
}

async function loadBenchmarkHistory() {
  const history = await window.cs2app.benchmark.getHistory();
  renderBenchmarkHistoryList(history);
}

window.cs2app.benchmark.onSample((progress) => {
  const statusEl = document.getElementById('benchmark-status');
  statusEl.classList.remove('d-none');
  statusEl.textContent = BENCHMARK_STAGE_LABELS[progress.stage] || progress.stage;
  if (progress.stage === 'erro') statusEl.classList.add('benchmark-status-error');
  else statusEl.classList.remove('benchmark-status-error');
});

document.getElementById('btn-start-benchmark').addEventListener('click', async () => {
  const btn = document.getElementById('btn-start-benchmark');
  const durationSeconds = Number(document.getElementById('benchmark-duration').value) || 60;
  btn.disabled = true;
  btn.textContent = 'Rodando...';
  try {
    const run = await window.cs2app.benchmark.start({ durationSeconds });

    const summary = document.getElementById('benchmark-summary');
    summary.classList.remove('d-none');
    summary.innerHTML = `
      <span>Average FPS: <strong>${run.stats.averageFps ?? '--'}</strong></span>
      <span>1% Low: <strong>${run.stats.low1Percent ?? '--'}</strong></span>
      <span>0.1% Low: <strong>${run.stats.low01Percent ?? '--'}</strong></span>
      <span>Frame Time médio: <strong>${run.stats.avgFrameTimeMs ?? '--'} ms</strong></span>
    `;
    renderBenchmarkChart(run.stats);
    await loadBenchmarkHistory();

    Swal.fire({
      icon: 'success',
      title: 'Benchmark concluído',
      text: `ID: ${run.id}`,
      background: '#14171f',
      color: '#f1f2f4',
      confirmButtonColor: '#ff6a00'
    });
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Falha no benchmark',
      text: err.message,
      background: '#14171f',
      color: '#f1f2f4',
      confirmButtonColor: '#ff6a00'
    });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Iniciar Benchmark';
  }
});

// ---------------------------------------------------------------------------
// Backups: histórico e recuperação (snapshots automáticos + manuais)
// ---------------------------------------------------------------------------

function backupBadge(backup) {
  return backup.type === 'auto'
    ? '<span class="tweak-badge tweak-badge-real">Automático</span>'
    : '<span class="tweak-badge tweak-badge-soon">Manual</span>';
}

function backupContentsSummary(backup) {
  const parts = [];
  if (backup.hasServices) parts.push('Serviços');
  if (backup.hasProcessPriority) parts.push('Prioridade de processo');
  if (backup.hasCs2Autoexec) parts.push('Autoexec do CS2');
  return parts.length ? parts.join(' · ') : 'Sem dados restauráveis';
}

function renderBackupItem(backup) {
  return `
    <div class="tweak-item" data-backup-item="${backup.id}">
      <div class="tweak-item-header">
        <strong>${backup.label}</strong>
        ${backupBadge(backup)}
      </div>
      <span class="text-muted">${new Date(backup.createdAt).toLocaleString('pt-BR')}</span>
      <span class="badge-size">${backupContentsSummary(backup)}</span>
      <div class="tweak-actions">
        <button class="btn btn-outline-cs2 btn-sm" data-backup-restore="${backup.id}">Restaurar</button>
      </div>
    </div>`;
}

async function loadBackups() {
  const container = document.getElementById('backups-list');
  const backups = await window.cs2app.backup.list();
  if (!backups || backups.length === 0) {
    container.innerHTML = '<p class="text-muted">Nenhum backup ainda. Snapshots são criados automaticamente antes de cada tweak real, ou você pode criar um manual acima.</p>';
    return;
  }
  container.innerHTML = backups.map(renderBackupItem).join('');
  container.querySelectorAll('button[data-backup-restore]').forEach((btn) => {
    btn.addEventListener('click', () => handleRestoreBackup(btn.dataset.backupRestore));
  });
}

async function handleRestoreBackup(backupId) {
  const confirmResult = await swalConfirm({
    title: 'Restaurar este backup?',
    html: '<p class="text-muted" style="text-align:left">Isso reaplica de verdade o estado salvo (serviços, prioridade de processo e/ou autoexec do CS2), sobrescrevendo as configurações atuais.</p>',
    confirmButtonText: 'Restaurar',
    icon: 'question'
  });
  if (!confirmResult.isConfirmed) return;

  const btn = document.querySelector(`button[data-backup-restore="${backupId}"]`);
  const originalLabel = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Restaurando...';
  }

  try {
    const result = await window.cs2app.backup.restore(backupId);
    if (!result || result.success === false) {
      swalWarning('Restauração incompleta ou falhou', (result && result.error) || 'Verifique os logs para mais detalhes.');
    } else {
      Object.keys(windowsTweaksState).forEach((key) => delete windowsTweaksState[key]);
      swalSuccess('Backup restaurado', '<p class="text-muted">O estado salvo foi reaplicado com sucesso.</p>');
    }
  } catch (err) {
    swalError('Falha ao restaurar backup', err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
    loadBackups();
  }
}

document.getElementById('btn-create-backup').addEventListener('click', async () => {
  const btn = document.getElementById('btn-create-backup');
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = 'Criando...';
  try {
    const result = await window.cs2app.backup.create();
    if (!result || result.success === false) {
      swalWarning('Falha ao criar backup', (result && result.error) || 'Verifique os logs para mais detalhes.');
    } else {
      swalSuccess('Backup criado', '<p class="text-muted">Serviços, prioridade de processo e autoexec do CS2 foram salvos.</p>');
    }
  } catch (err) {
    swalError('Falha ao criar backup', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
    loadBackups();
  }
});

// Carrega o Dashboard ao iniciar
loadDashboard();
checkPresentMonStatus();
