/**
 * Módulo Backup / Restore
 * Salva o estado de configurações do Windows/CS2 antes de aplicar tweaks,
 * permitindo reverter tudo com um clique.
 */

const fs = require('fs');
const path = require('path');
const paths = require('./paths');

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

async function create() {
  ensureBackupDir();
  const id = `backup-${Date.now()}`;
  const filePath = path.join(getBackupDir(), `${id}.json`);
  const snapshot = {
    id,
    createdAt: new Date().toISOString(),
    windowsTweaks: {},
    cs2Config: {}
  };
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  return { success: true, id, filePath };
}

async function list() {
  ensureBackupDir();
  const dir = getBackupDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const filePath = path.join(dir, f);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return { id: data.id, createdAt: data.createdAt };
    });
}

async function restore(backupId) {
  ensureBackupDir();
  const filePath = path.join(getBackupDir(), `${backupId}.json`);
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `Backup não encontrado: ${backupId}` };
  }
  // TODO: reaplicar snapshot real (windowsTweaks + cs2Config) na próxima etapa
  return { success: true, restoredFrom: backupId, restoredAt: new Date().toISOString() };
}

function registerBackupHandlers(ipcMain, Logger) {
  ipcMain.handle('backup:create', async () => {
    Logger.info('backup', 'Criando backup de configurações');
    return create();
  });
  ipcMain.handle('backup:list', async () => list());
  ipcMain.handle('backup:restore', async (_evt, backupId) => {
    Logger.info('backup', `Restaurando backup: ${backupId}`);
    return restore(backupId);
  });
}

module.exports = { registerBackupHandlers, create, list, restore };
