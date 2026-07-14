/**
 * Módulo Windows Tweaks
 * Game Mode, Power Plan, SSD, Explorer, Rede, ajustes AMD (legados) +
 * otimizações reais construídas sobre componentes reutilizáveis:
 *   - serviceManager   -> desabilitar serviços desnecessários
 *   - cacheCleaner     -> limpar cache/temp do sistema
 *   - processPriority  -> aumentar prioridade de processos (ex.: cs2.exe)
 *
 * Cada tweak deve ser reversível sempre que possível e registrado em log
 * antes/depois de aplicar.
 */

const serviceManager = require('./components/serviceManager');
const cacheCleaner = require('./components/cacheCleaner');
const processPriority = require('./components/processPriority');
const powerPlanManager = require('./components/powerPlanManager');
const gameModeManager = require('./components/gameModeManager');
const ssdOptimizeManager = require('./components/ssdOptimizeManager');
const explorerTweaksManager = require('./components/explorerTweaksManager');
const amdSpecificManager = require('./components/amdSpecificManager');
const networkTweaksManager = require('./components/networkTweaksManager');
const backup = require('../backup');

const disableUnnecessaryServices = require('./tweaks/disableUnnecessaryServices');
const cleanSystemCache = require('./tweaks/cleanSystemCache');
const boostProcessPriority = require('./tweaks/boostProcessPriority');
const setPowerPlan = require('./tweaks/setPowerPlan');
const setGameMode = require('./tweaks/setGameMode');
const setSsdOptimize = require('./tweaks/setSsdOptimize');
const setExplorerTweaks = require('./tweaks/setExplorerTweaks');
const setAmdSpecific = require('./tweaks/setAmdSpecific');
const setNetworkTweaks = require('./tweaks/setNetworkTweaks');

// Tweaks legados (definidos antes desta etapa), ainda sem implementação real
// via PowerShell/registry — mantidos por compatibilidade com o módulo de
// Perfis e a UI existente. Todos já possuem implementação real; lista
// mantida vazia para compatibilidade futura caso novos tweaks legados sejam
// adicionados antes de ter implementação.
const LEGACY_TWEAKS = [];

// Tweaks com implementação real, construídos a partir dos componentes reutilizáveis.
const IMPLEMENTED_TWEAKS = [
  disableUnnecessaryServices,
  cleanSystemCache,
  boostProcessPriority,
  setPowerPlan,
  setGameMode,
  setSsdOptimize,
  setExplorerTweaks,
  setAmdSpecific,
  setNetworkTweaks
];

const AVAILABLE_TWEAKS = [
  ...LEGACY_TWEAKS,
  ...IMPLEMENTED_TWEAKS.map((t) => ({ id: t.id, name: t.name, description: t.description }))
];

function findImplementedTweak(tweakId) {
  return IMPLEMENTED_TWEAKS.find((t) => t.id === tweakId);
}

function findTweakDefinition(tweakId) {
  return AVAILABLE_TWEAKS.find((t) => t.id === tweakId);
}

/** Captura o estado atual do sistema para o aspecto afetado por um tweak,
 * para que um snapshot de backup possa ser criado ANTES da alteração real —
 * permitindo reversão exata depois, mesmo fora do fluxo padrão de revert(). */
async function captureTweakPreState(tweakId, options) {
  if (tweakId === 'disable-unnecessary-services') {
    return { services: await serviceManager.captureServicesState(options.serviceNames) };
  }
  if (tweakId === 'boost-process-priority') {
    const processName = processPriority.normalizeProcessName(options.processName || 'cs2');
    return { processPriority: await processPriority.captureState(processName) };
  }
  if (tweakId === 'power-plan') {
    return { powerPlan: await powerPlanManager.captureState() };
  }
  if (tweakId === 'game-mode') {
    return { gameMode: await gameModeManager.captureState() };
  }
  if (tweakId === 'ssd-optimize') {
    return { ssdOptimize: await ssdOptimizeManager.captureState() };
  }
  if (tweakId === 'explorer-tweaks') {
    return { explorerTweaks: await explorerTweaksManager.captureState() };
  }
  if (tweakId === 'amd-specific') {
    return { amdSpecific: await amdSpecificManager.captureState() };
  }
  if (tweakId === 'network-tweaks') {
    return { networkTweaks: await networkTweaksManager.captureState() };
  }
  // clean-system-cache é destrutivo e não reversível: nenhum estado a capturar.
  return null;
}

async function applyTweak(tweakId, Logger, options) {
  const tweak = findTweakDefinition(tweakId);
  if (!tweak) {
    return { success: false, error: `Tweak desconhecido: ${tweakId}` };
  }

  const implemented = findImplementedTweak(tweakId);
  if (implemented) {
    let backupId = null;
    const preState = await captureTweakPreState(tweakId, options || {});
    if (preState) {
      const snap = await backup.createSnapshot({ tweakId, label: tweak.name, state: preState });
      if (snap.success) backupId = snap.id;
    }
    const result = await implemented.apply(Logger, options || {});
    return { tweakId, appliedAt: new Date().toISOString(), backupId, ...result };
  }

  // TODO: implementar aplicação real via PowerShell/registry na próxima etapa
  return { success: true, tweakId, appliedAt: new Date().toISOString() };
}

async function revertTweak(tweakId, Logger, options) {
  const tweak = findTweakDefinition(tweakId);
  if (!tweak) {
    return { success: false, error: `Tweak desconhecido: ${tweakId}` };
  }

  const implemented = findImplementedTweak(tweakId);
  if (implemented) {
    const result = await implemented.revert(Logger, options || {});
    return { tweakId, revertedAt: new Date().toISOString(), ...result };
  }

  // TODO: implementar reversão real a partir do backup
  return { success: true, tweakId, revertedAt: new Date().toISOString() };
}

async function listStatus() {
  return AVAILABLE_TWEAKS.map((t) => {
    const implemented = findImplementedTweak(t.id);
    return {
      ...t,
      applied: false,
      implemented: Boolean(implemented),
      reversible: implemented ? implemented.id !== 'clean-system-cache' : false
    };
  });
}

function registerWindowsHandlers(ipcMain, Logger) {
  ipcMain.handle('windows:applyTweak', async (_evt, tweakId, options) => {
    Logger.info('windowsTweaks', `Aplicando tweak: ${tweakId}`);
    const result = await applyTweak(tweakId, Logger, options);
    if (!result.success) Logger.warn('windowsTweaks', `Tweak ${tweakId} não aplicado com sucesso`, result);
    return result;
  });

  ipcMain.handle('windows:revertTweak', async (_evt, tweakId, options) => {
    Logger.info('windowsTweaks', `Revertendo tweak: ${tweakId}`);
    const result = await revertTweak(tweakId, Logger, options);
    if (!result.success) Logger.warn('windowsTweaks', `Tweak ${tweakId} não revertido com sucesso`, result);
    return result;
  });

  ipcMain.handle('windows:listStatus', async () => listStatus());

  // Metadados dos componentes reutilizáveis, úteis para a UI exibir o que
  // será afetado antes do usuário confirmar a aplicação de um tweak.
  ipcMain.handle('windows:getUnnecessaryServices', async () => serviceManager.UNNECESSARY_SERVICES);
  ipcMain.handle('windows:getCacheTargets', async () => cacheCleaner.getCacheTargets());
  ipcMain.handle('windows:getPriorityLevels', async () => processPriority.PRIORITY_LEVELS);
  ipcMain.handle('windows:isWindowsPlatform', async () => process.platform === 'win32');
}

module.exports = {
  registerWindowsHandlers,
  AVAILABLE_TWEAKS,
  applyTweak,
  revertTweak,
  listStatus,
  components: { serviceManager, cacheCleaner, processPriority, powerPlanManager, gameModeManager, ssdOptimizeManager, explorerTweaksManager, amdSpecificManager, networkTweaksManager }
};
