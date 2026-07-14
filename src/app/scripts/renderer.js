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

async function loadWindowsTweaks() {
  const tweaks = await window.cs2app.windowsTweaks.listStatus();
  const container = document.getElementById('windows-tweaks-list');
  container.innerHTML = tweaks
    .map(
      (t) => `
      <div class="tweak-item">
        <strong>${t.name}</strong>
        <span class="text-muted">${t.description}</span>
        <button class="btn btn-cs2 btn-sm" data-tweak="${t.id}">Aplicar</button>
      </div>`
    )
    .join('');

  container.querySelectorAll('button[data-tweak]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = 'Aplicando...';
      try {
        const result = await window.cs2app.windowsTweaks.apply(btn.dataset.tweak);
        if (result && result.success === false) {
          Swal.fire({
            icon: 'warning',
            title: 'Tweak não aplicado',
            text: result.error || 'Verifique os logs para mais detalhes.',
            background: '#14171f',
            color: '#f1f2f4',
            confirmButtonColor: '#ff6a00'
          });
          return;
        }
        Swal.fire({
          icon: 'success',
          title: 'Tweak aplicado',
          background: '#14171f',
          color: '#f1f2f4',
          confirmButtonColor: '#ff6a00'
        });
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Falha ao aplicar tweak',
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

// Carrega o Dashboard ao iniciar
loadDashboard();
checkPresentMonStatus();
