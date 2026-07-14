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

document.getElementById('btn-run-scan').addEventListener('click', async () => {
  const result = await window.cs2app.scanner.runFullScan();
  document.getElementById('scanner-result').textContent = JSON.stringify(result, null, 2);
  Swal.fire({
    icon: 'success',
    title: 'Scan concluído',
    background: '#14171f',
    color: '#f1f2f4',
    confirmButtonColor: '#ff6a00'
  });
});

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
      await window.cs2app.windowsTweaks.apply(btn.dataset.tweak);
      Swal.fire({
        icon: 'success',
        title: 'Tweak aplicado',
        background: '#14171f',
        color: '#f1f2f4',
        confirmButtonColor: '#ff6a00'
      });
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
      await window.cs2app.profiles.apply(btn.dataset.profile);
      Swal.fire({
        icon: 'success',
        title: 'Perfil aplicado',
        background: '#14171f',
        color: '#f1f2f4',
        confirmButtonColor: '#ff6a00'
      });
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

document.getElementById('btn-start-benchmark').addEventListener('click', async () => {
  const run = await window.cs2app.benchmark.start({ durationSeconds: 60 });
  Swal.fire({
    icon: 'info',
    title: 'Benchmark registrado',
    text: `ID: ${run.id}`,
    background: '#14171f',
    color: '#f1f2f4',
    confirmButtonColor: '#ff6a00'
  });
});

// Carrega o Dashboard ao iniciar
loadDashboard();
