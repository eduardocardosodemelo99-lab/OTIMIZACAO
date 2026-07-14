/**
 * Módulo CS2
 * Autoexec, Radar, Crosshair, Viewmodel, Audio, Practice config.
 */

const path = require('path');
const fs = require('fs');
const paths = require('./paths');

function getConfigDir() {
  return paths.getConfigDir();
}
function getAutoexecPath() {
  return path.join(getConfigDir(), 'autoexec.cfg');
}

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
  if (!fs.existsSync(getConfigDir())) {
    fs.mkdirSync(getConfigDir(), { recursive: true });
  }
}

async function getAutoexec() {
  ensureConfigDir();
  if (!fs.existsSync(getAutoexecPath())) return '';
  return fs.readFileSync(getAutoexecPath(), 'utf8');
}

async function saveAutoexec(content) {
  ensureConfigDir();
  fs.writeFileSync(getAutoexecPath(), content, 'utf8');
  return { success: true, savedAt: new Date().toISOString() };
}

async function applyPreset(presetId) {
  const lines = PRESETS[presetId];
  if (!lines) {
    return { success: false, error: `Preset desconhecido: ${presetId}` };
  }
  ensureConfigDir();
  fs.writeFileSync(getAutoexecPath(), lines.join('\n') + '\n', 'utf8');
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
