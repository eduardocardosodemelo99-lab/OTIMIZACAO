/**
 * Módulo Windows Tweaks
 * Game Mode, Power Plan, SSD, Explorer, Rede, ajustes específicos AMD.
 * Cada tweak deve ser reversível e registrado em backup antes de aplicar.
 */

const AVAILABLE_TWEAKS = [
  { id: 'game-mode', name: 'Game Mode', description: 'Ativa/otimiza o Game Mode do Windows' },
  { id: 'power-plan', name: 'Power Plan', description: 'Aplica plano de energia de alto desempenho' },
  { id: 'ssd-optimize', name: 'Otimização de SSD', description: 'Ajustes de TRIM e indexação' },
  { id: 'explorer-tweaks', name: 'Explorer', description: 'Reduz overhead visual do Explorer' },
  { id: 'network-tweaks', name: 'Rede', description: 'Ajustes de latência de rede (TCP/IP)' },
  { id: 'amd-specific', name: 'AMD Specific', description: 'Ajustes específicos para CPUs/GPUs AMD' }
];

async function applyTweak(tweakId) {
  const tweak = AVAILABLE_TWEAKS.find((t) => t.id === tweakId);
  if (!tweak) {
    return { success: false, error: `Tweak desconhecido: ${tweakId}` };
  }
  // TODO: implementar aplicação real via PowerShell/registry na próxima etapa
  return { success: true, tweakId, appliedAt: new Date().toISOString() };
}

async function revertTweak(tweakId) {
  const tweak = AVAILABLE_TWEAKS.find((t) => t.id === tweakId);
  if (!tweak) {
    return { success: false, error: `Tweak desconhecido: ${tweakId}` };
  }
  // TODO: implementar reversão real a partir do backup
  return { success: true, tweakId, revertedAt: new Date().toISOString() };
}

async function listStatus() {
  return AVAILABLE_TWEAKS.map((t) => ({ ...t, applied: false }));
}

function registerWindowsHandlers(ipcMain, Logger) {
  ipcMain.handle('windows:applyTweak', async (_evt, tweakId) => {
    Logger.info('windowsTweaks', `Aplicando tweak: ${tweakId}`);
    return applyTweak(tweakId);
  });

  ipcMain.handle('windows:revertTweak', async (_evt, tweakId) => {
    Logger.info('windowsTweaks', `Revertendo tweak: ${tweakId}`);
    return revertTweak(tweakId);
  });

  ipcMain.handle('windows:listStatus', async () => listStatus());
}

module.exports = { registerWindowsHandlers, AVAILABLE_TWEAKS, applyTweak, revertTweak, listStatus };
