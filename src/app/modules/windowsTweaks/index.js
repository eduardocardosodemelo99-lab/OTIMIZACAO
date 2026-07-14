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

const disableUnnecessaryServices = require('./tweaks/disableUnnecessaryServices');
const cleanSystemCache = require('./tweaks/cleanSystemCache');
const boostProcessPriority = require('./tweaks/boostProcessPriority');

// Tweaks legados (definidos antes desta etapa), ainda sem implementação real
// via PowerShell/registry — mantidos por compatibilidade com o módulo de
// Perfis e a UI existente. Serão implementados em etapas futuras.
const LEGACY_TWEAKS = [
  { id: 'game-mode', name: 'Game Mode', description: 'Ativa/otimiza o Game Mode do Windows' },
  { id: 'power-plan', name: 'Power Plan', description: 'Aplica plano de energia de alto desempenho' },
  { id: 'ssd-optimize', name: 'Otimização de SSD', description: 'Ajustes de TRIM e indexação' },
  { id: 'explorer-tweaks', name: 'Explorer', description: 'Reduz overhead visual do Explorer' },
  { id: 'network-tweaks', name: 'Rede', description: 'Ajustes de latência de rede (TCP/IP)' },
  { id: 'amd-specific', name: 'AMD Specific', description: 'Ajustes específicos para CPUs/GPUs AMD' }
];

// Tweaks com implementação real, construídos a partir dos componentes reutilizáveis.
const IMPLEMENTED_TWEAKS = [disableUnnecessaryServices, cleanSystemCache, boostProcessPriority];

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

async function applyTweak(tweakId, Logger, options) {
  const tweak = findTweakDefinition(tweakId);
  if (!tweak) {
    return { success: false, error: `Tweak desconhecido: ${tweakId}` };
  }

  const implemented = findImplementedTweak(tweakId);
  if (implemented) {
    const result = await implemented.apply(Logger, options || {});
    return { tweakId, appliedAt: new Date().toISOString(), ...result };
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
  return AVAILABLE_TWEAKS.map((t) => ({ ...t, applied: false }));
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
}

module.exports = {
  registerWindowsHandlers,
  AVAILABLE_TWEAKS,
  applyTweak,
  revertTweak,
  listStatus,
  components: { serviceManager, cacheCleaner, processPriority }
};
