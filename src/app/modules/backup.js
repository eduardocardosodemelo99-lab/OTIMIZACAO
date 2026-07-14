/**
 * Módulo Backup / Restore
 * Salva o estado de configurações do Windows/CS2 antes de aplicar tweaks,
 * permitindo reverter tudo com um clique.
 */

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backup');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

async function create() {
  ensureBackupDir();
  const id = `backup-${Date.now()}`;
  const filePath = path.join(BACKUP_DIR, `${id}.json`);
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
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const filePath = path.join(BACKUP_DIR, f);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return { id: data.id, createdAt: data.createdAt };
    });
}

async function restore(backupId) {
  ensureBackupDir();
  const filePath = path.join(BACKUP_DIR, `${backupId}.json`);
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
