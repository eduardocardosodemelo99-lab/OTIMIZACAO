/**
 * Módulo CS2
 * Autoexec, Radar, Crosshair, Viewmodel, Audio, Practice config.
 */

const path = require('path');
const fs = require('fs');

const CONFIG_DIR = path.join(__dirname, '..', '..', 'configs');
const AUTOEXEC_PATH = path.join(CONFIG_DIR, 'autoexec.cfg');

const PRESETS = {
  competitive: [
    '// Preset: Competitivo',
    'cl_crosshairstyle 4',
    'viewmodel_fov 68',
    'snd_headphone_eq "PRO"',
    'cl_radar_always_centered 0',
    'cl_radar_scale 0.4'
  ],
  quality: [
    '// Preset: Qualidade',
    'cl_crosshairstyle 2',
    'viewmodel_fov 60'
  ],
  streaming: [
    '// Preset: Streaming',
    'cl_crosshairstyle 4',
    'viewmodel_fov 68',
    'fps_max 240'
  ]
};

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

async function getAutoexec() {
  ensureConfigDir();
  if (!fs.existsSync(AUTOEXEC_PATH)) return '';
  return fs.readFileSync(AUTOEXEC_PATH, 'utf8');
}

async function saveAutoexec(content) {
  ensureConfigDir();
  fs.writeFileSync(AUTOEXEC_PATH, content, 'utf8');
  return { success: true, savedAt: new Date().toISOString() };
}

async function applyPreset(presetId) {
  const lines = PRESETS[presetId];
  if (!lines) {
    return { success: false, error: `Preset desconhecido: ${presetId}` };
  }
  ensureConfigDir();
  fs.writeFileSync(AUTOEXEC_PATH, lines.join('\n') + '\n', 'utf8');
  return { success: true, presetId, appliedAt: new Date().toISOString() };
}

function registerCs2Handlers(ipcMain, Logger) {
  ipcMain.handle('cs2:getAutoexec', async () => getAutoexec());
  ipcMain.handle('cs2:saveAutoexec', async (_evt, content) => {
    Logger.info('cs2Config', 'Salvando autoexec.cfg manualmente');
    return saveAutoexec(content);
  });
  ipcMain.handle('cs2:applyPreset', async (_evt, presetId) => {
    Logger.info('cs2Config', `Aplicando preset CS2: ${presetId}`);
    return applyPreset(presetId);
  });
}

module.exports = { registerCs2Handlers, PRESETS, getAutoexec, saveAutoexec, applyPreset };
