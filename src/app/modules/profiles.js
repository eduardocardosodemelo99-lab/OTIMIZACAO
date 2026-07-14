/**
 * Módulo Perfis
 * Perfis de otimização: FPS, Qualidade, Competitivo, Streaming.
 * Cada perfil combina um conjunto de tweaks do Windows + configurações CS2.
 */

const PROFILES = [
  {
    id: 'fps',
    name: 'FPS Máximo',
    description: 'Prioriza taxa de quadros acima de tudo',
    windowsTweaks: ['game-mode', 'power-plan', 'ssd-optimize'],
    cs2Preset: 'competitive'
  },
  {
    id: 'quality',
    name: 'Qualidade Visual',
    description: 'Equilíbrio entre performance e fidelidade visual',
    windowsTweaks: ['power-plan'],
    cs2Preset: 'quality'
  },
  {
    id: 'competitive',
    name: 'Competitivo',
    description: 'Configuração usada por jogadores competitivos',
    windowsTweaks: ['game-mode', 'power-plan', 'network-tweaks'],
    cs2Preset: 'competitive'
  },
  {
    id: 'streaming',
    name: 'Streaming',
    description: 'Reserva recursos para encoder/OBS mantendo boa taxa de FPS',
    windowsTweaks: ['power-plan'],
    cs2Preset: 'streaming'
  }
];

async function listProfiles() {
  return PROFILES;
}

async function applyProfile(profileId) {
  const profile = PROFILES.find((p) => p.id === profileId);
  if (!profile) {
    return { success: false, error: `Perfil desconhecido: ${profileId}` };
  }
  // TODO: orquestrar chamadas reais a windowsTweaks.applyTweak e cs2Config.applyPreset
  return { success: true, profileId, appliedAt: new Date().toISOString() };
}

function registerProfilesHandlers(ipcMain, Logger) {
  ipcMain.handle('profiles:list', async () => listProfiles());
  ipcMain.handle('profiles:apply', async (_evt, profileId) => {
    Logger.info('profiles', `Aplicando perfil: ${profileId}`);
    return applyProfile(profileId);
  });
}

module.exports = { registerProfilesHandlers, PROFILES, listProfiles, applyProfile };
