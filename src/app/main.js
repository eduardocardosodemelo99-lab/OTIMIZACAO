/**
 * CS2 Ultimate Optimizer
 * Electron Main Process
 *
 * Responsável por:
 * - Criar a janela principal (BrowserWindow)
 * - Gerenciar o ciclo de vida da aplicação
 * - Registrar os handlers de IPC de cada módulo
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const Logger = require('./modules/logger');
const { registerDashboardHandlers } = require('./modules/dashboard');
const { registerScannerHandlers } = require('./modules/scanner');
const { registerWindowsHandlers } = require('./modules/windowsTweaks');
const { registerProfilesHandlers } = require('./modules/profiles');
const { registerCs2Handlers } = require('./modules/cs2Config');
const { registerBenchmarkHandlers, checkPresentMonStatus } = require('./modules/benchmark');
const { registerBackupHandlers } = require('./modules/backup');

const isDev = process.argv.includes('--dev');

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b0d12',
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'views', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function registerWindowControlHandlers() {
  ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow && mainWindow.close());
  ipcMain.handle('app:openExternal', (_evt, url) => shell.openExternal(url));
  ipcMain.handle('app:getVersion', () => app.getVersion());
}

app.whenReady().then(() => {
  Logger.init();
  Logger.info('main', 'Aplicação iniciada', { version: app.getVersion() });

  registerWindowControlHandlers();
  registerDashboardHandlers(ipcMain, Logger);
  registerScannerHandlers(ipcMain, Logger);
  registerWindowsHandlers(ipcMain, Logger);
  registerProfilesHandlers(ipcMain, Logger);
  registerCs2Handlers(ipcMain, Logger);
  registerBenchmarkHandlers(ipcMain, Logger);
  registerBackupHandlers(ipcMain, Logger);

  createMainWindow();

  // Verifica na inicialização se o PresentMon está instalado (necessário
  // para o módulo Benchmark) e avisa a UI assim que a janela carregar.
  mainWindow.webContents.once('did-finish-load', async () => {
    try {
      const status = await checkPresentMonStatus(Logger);
      mainWindow.webContents.send('benchmark:presentMonStatus', status);
    } catch (err) {
      Logger.warn('main', `Falha ao checar PresentMon na inicialização: ${err.message}`);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  Logger.info('main', 'Aplicação encerrada');
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (err) => {
  Logger.error('main', 'Uncaught exception', { message: err.message, stack: err.stack });
});
