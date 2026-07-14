/**
 * Módulo Backup / Restore
 * Salva o estado real de configurações do Windows/CS2 (serviços, prioridade
 * de processo, autoexec do CS2) antes de aplicar tweaks, permitindo reverter
 * tudo com um clique — inclusive os snapshots automáticos criados pelo
 * módulo Windows Tweaks antes de cada alteração real no sistema.
 */

const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const serviceManager = require('./windowsTweaks/components/serviceManager');
const processPriority = require('./windowsTweaks/components/processPriority');
const powerPlanManager = require('./windowsTweaks/components/powerPlanManager');
const gameModeManager = require('./windowsTweaks/components/gameModeManager');
const ssdOptimizeManager = require('./windowsTweaks/components/ssdOptimizeManager');
const explorerTweaksManager = require('./windowsTweaks/components/explorerTweaksManager');
const amdSpecificManager = require('./windowsTweaks/components/amdSpecificManager');
const networkTweaksManager = require('./windowsTweaks/components/networkTweaksManager');
const cs2Config = require('./cs2Config');

function getBackupDir() {
  return paths.getBackupDir();
}

function ensureBackupDir() {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function writeSnapshot(snapshot) {
  ensureBackupDir();
  const filePath = path.join(getBackupDir(), `${snapshot.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  return filePath;
}

function readSnapshot(id) {
  const filePath = path.join(getBackupDir(), `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

/**
 * Cria um snapshot automático capturando o estado real de um aspecto
 * específico do sistema (ex.: serviços antes de desabilitá-los, prioridade
 * de processo antes de elevá-la). Chamado pelo módulo Windows Tweaks logo
 * antes de aplicar um tweak real, para permitir reversão exata via restore().
 */
async function createSnapshot({ label, tweakId, state }) {
  const id = `backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const snapshot = {
    id,
    createdAt: new Date().toISOString(),
    type: 'auto',
    tweakId: tweakId || null,
    label: label || tweakId || 'Snapshot automático',
    state: {
      services: (state && state.services) || null,
      processPriority: (state && state.processPriority) || null,
      powerPlan: (state && state.powerPlan) || null,
      gameMode: (state && state.gameMode) || null,
      ssdOptimize: (state && state.ssdOptimize) || null,
      explorerTweaks: (state && state.explorerTweaks) || null,
      amdSpecific: (state && state.amdSpecific) || null,
      networkTweaks: (state && state.networkTweaks) || null,
      cs2Autoexec: (state && state.cs2Autoexec) || null
    }
  };
  writeSnapshot(snapshot);
  return { success: true, id, filePath: path.join(getBackupDir(), `${id}.json`) };
}

/**
 * Cria um backup manual completo: captura o estado atual de todos os
 * serviços conhecidos, a prioridade do processo padrão do CS2 e o conteúdo
 * atual do autoexec.cfg — tudo em um único snapshot restaurável.
 */
async function create() {
  const [services, procPriority, powerPlan, gameMode, ssdOptimize, explorerTweaks, amdSpecific, networkTweaks, cs2Autoexec] = await Promise.all([
    serviceManager.captureServicesState(),
    processPriority.captureState(processPriority.normalizeProcessName('cs2')),
    powerPlanManager.captureState(),
    gameModeManager.captureState(),
    ssdOptimizeManager.captureState(),
    explorerTweaksManager.captureState(),
    amdSpecificManager.captureState(),
    networkTweaksManager.captureState(),
    cs2Config.getAutoexec().catch(() => '')
  ]);

  const id = `backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const snapshot = {
    id,
    createdAt: new Date().toISOString(),
    type: 'manual',
    tweakId: null,
    label: 'Backup manual completo',
    state: { services, processPriority: procPriority, powerPlan, gameMode, ssdOptimize, explorerTweaks, amdSpecific, networkTweaks, cs2Autoexec }
  };
  writeSnapshot(snapshot);
  return { success: true, id, filePath: path.join(getBackupDir(), `${id}.json`) };
}

async function list() {
  ensureBackupDir();
  const dir = getBackupDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const filePath = path.join(dir, f);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
          id: data.id,
          createdAt: data.createdAt,
          type: data.type || 'manual',
          tweakId: data.tweakId || null,
          label: data.label || 'Backup',
          hasServices: Boolean(data.state && data.state.services),
          hasProcessPriority: Boolean(data.state && data.state.processPriority),
          hasPowerPlan: Boolean(data.state && data.state.powerPlan && data.state.powerPlan.guid),
          hasGameMode: Boolean(data.state && data.state.gameMode && data.state.gameMode.enabled !== null && data.state.gameMode.enabled !== undefined),
          hasSsdOptimize: Boolean(data.state && data.state.ssdOptimize && (data.state.ssdOptimize.trim || data.state.ssdOptimize.indexing)),
          hasExplorerTweaks: Boolean(data.state && data.state.explorerTweaks && (data.state.explorerTweaks.fileExtensions || data.state.explorerTweaks.windowAnimations)),
          hasAmdSpecific: Boolean(data.state && data.state.amdSpecific && (data.state.amdSpecific.powerThrottling || data.state.amdSpecific.hwScheduling)),
          hasNetworkTweaks: Boolean(data.state && data.state.networkTweaks && (data.state.networkTweaks.networkThrottling || data.state.networkTweaks.systemResponsiveness)),
          hasCs2Autoexec: data.state && typeof data.state.cs2Autoexec === 'string'
        };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Restaura um snapshot: reaplica de verdade cada aspecto capturado
 * (serviços via Set-Service/Start-Service, prioridade de processo via
 * Get-Process, autoexec.cfg via escrita direta do conteúdo anterior).
 * Aspectos não presentes no snapshot (null) são ignorados.
 */
async function restore(backupId, Logger) {
  const snapshot = readSnapshot(backupId);
  if (!snapshot) {
    return { success: false, error: `Backup não encontrado: ${backupId}` };
  }

  const { state } = snapshot;
  const results = {};
  let anyAttempted = false;
  let anyFailed = false;

  if (state && state.services && state.services.length) {
    anyAttempted = true;
    results.services = await serviceManager.restoreServicesState(state.services, Logger);
    if (results.services.restoredCount < results.services.total) anyFailed = true;
    if (Logger) Logger.info('backup', `Serviços restaurados a partir do backup ${backupId}`, results.services);
  }

  if (state && state.processPriority) {
    anyAttempted = true;
    results.processPriority = await processPriority.restoreState(state.processPriority, Logger);
    if (!results.processPriority.success) anyFailed = true;
    if (Logger) Logger.info('backup', `Prioridade de processo restaurada a partir do backup ${backupId}`, results.processPriority);
  }

  if (state && state.powerPlan && state.powerPlan.guid) {
    anyAttempted = true;
    results.powerPlan = await powerPlanManager.restoreState(state.powerPlan, Logger);
    if (!results.powerPlan.success) anyFailed = true;
    if (Logger) Logger.info('backup', `Plano de energia restaurado a partir do backup ${backupId}`, results.powerPlan);
  }

  if (state && state.gameMode && state.gameMode.enabled !== null && state.gameMode.enabled !== undefined) {
    anyAttempted = true;
    results.gameMode = await gameModeManager.restoreState(state.gameMode, Logger);
    if (!results.gameMode.success) anyFailed = true;
    if (Logger) Logger.info('backup', `Game Mode restaurado a partir do backup ${backupId}`, results.gameMode);
  }

  if (state && state.ssdOptimize) {
    anyAttempted = true;
    results.ssdOptimize = await ssdOptimizeManager.restoreState(state.ssdOptimize, Logger);
    if (!results.ssdOptimize.success) anyFailed = true;
    if (Logger) Logger.info('backup', `Otimização de SSD restaurada a partir do backup ${backupId}`, results.ssdOptimize);
  }

  if (state && state.explorerTweaks) {
    anyAttempted = true;
    results.explorerTweaks = await explorerTweaksManager.restoreState(state.explorerTweaks, Logger);
    if (!results.explorerTweaks.success) anyFailed = true;
    if (Logger) Logger.info('backup', `Ajustes do Explorer restaurados a partir do backup ${backupId}`, results.explorerTweaks);
  }

  if (state && state.amdSpecific) {
    anyAttempted = true;
    results.amdSpecific = await amdSpecificManager.restoreState(state.amdSpecific, Logger);
    if (!results.amdSpecific.success) anyFailed = true;
    if (Logger) Logger.info('backup', `Ajustes AMD Specific restaurados a partir do backup ${backupId}`, results.amdSpecific);
  }

  if (state && state.networkTweaks) {
    anyAttempted = true;
    results.networkTweaks = await networkTweaksManager.restoreState(state.networkTweaks, Logger);
    if (!results.networkTweaks.success) anyFailed = true;
    if (Logger) Logger.info('backup', `Ajustes de rede restaurados a partir do backup ${backupId}`, results.networkTweaks);
  }

  if (state && typeof state.cs2Autoexec === 'string') {
    anyAttempted = true;
    try {
      results.cs2Autoexec = await cs2Config.saveAutoexec(state.cs2Autoexec);
    } catch (err) {
      anyFailed = true;
      results.cs2Autoexec = { success: false, error: err.message };
    }
    if (Logger) Logger.info('backup', `autoexec.cfg restaurado a partir do backup ${backupId}`);
  }

  if (!anyAttempted) {
    return { success: false, error: 'Backup não contém dados restauráveis.', restoredFrom: backupId };
  }

  return {
    success: !anyFailed,
    restoredFrom: backupId,
    restoredAt: new Date().toISOString(),
    results
  };
}

function registerBackupHandlers(ipcMain, Logger) {
  ipcMain.handle('backup:create', async () => {
    Logger.info('backup', 'Criando backup manual completo de configurações');
    return create();
  });
  ipcMain.handle('backup:list', async () => list());
  ipcMain.handle('backup:restore', async (_evt, backupId) => {
    Logger.info('backup', `Restaurando backup: ${backupId}`);
    return restore(backupId, Logger);
  });
}

module.exports = { registerBackupHandlers, create, createSnapshot, list, restore };
