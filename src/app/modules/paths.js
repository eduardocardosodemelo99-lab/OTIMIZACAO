/**
 * Módulo de Paths
 * Centraliza a resolução de diretórios graváveis da aplicação.
 *
 * Em desenvolvimento (npm start), grava dentro do próprio projeto.
 * Empacotado (app.asar), grava em userData (ex: %APPDATA%/OTIMIZACAO no Windows),
 * pois o conteúdo do .asar é somente-leitura e não pode receber logs/backups/configs.
 */

const path = require('path');

let electronApp = null;
try {
  // Pode falhar se rodado fora do processo principal do Electron (ex: testes)
  const electron = require('electron');
  electronApp = electron.app || (electron.remote && electron.remote.app) || null;
} catch (_) {
  electronApp = null;
}

function getBaseDir() {
  if (electronApp && electronApp.isPackaged) {
    return electronApp.getPath('userData');
  }
  if (electronApp && typeof electronApp.getPath === 'function') {
    try {
      return electronApp.getPath('userData');
    } catch (_) {
      // fallback abaixo
    }
  }
  // Fora do Electron / dev: usa a raiz do projeto (dois níveis acima de src/app/modules)
  return path.join(__dirname, '..', '..', '..');
}

function getLogDir() {
  return path.join(getBaseDir(), 'logs');
}

function getBackupDir() {
  return path.join(getBaseDir(), 'backup');
}

function getConfigDir() {
  return path.join(getBaseDir(), 'configs');
}

function getToolsDir() {
  return path.join(getBaseDir(), 'tools');
}

module.exports = {
  getBaseDir,
  getLogDir,
  getBackupDir,
  getConfigDir,
  getToolsDir
};
