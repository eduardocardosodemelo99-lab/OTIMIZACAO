/**
 * CS2 Ultimate Optimizer
 * Electron Main Process
 *
 * Responsável por:
 * - Criar a janela principal (BrowserWindow)
 * - Gerenciar o ciclo de vida da aplicação
 * - Registrar os handlers de IPC de cada módulo
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
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

// Evita múltiplas instâncias do app rodando ao mesmo tempo (segunda instância
// fecha imediatamente e foca a janela já aberta, em vez de ficar "presa" em
// segundo plano sem nunca abrir a janela).
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

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

  mainWindow.loadFile(path.join(__dirname, 'views', 'index.html')).catch((err) => {
    Logger.error('main', `Falha ao carregar a UI: ${err.message}`);
    dialog.showErrorBox(
      'Erro ao iniciar o CS2 Ultimate Optimizer',
      `Não foi possível carregar a interface: ${err.message}`
    );
    app.quit();
  });

  // Watchdog: se por algum motivo a janela nunca disparar "ready-to-show"
  // (ex.: renderer travou), força a exibição depois de alguns segundos em vez
  // de deixar o app "rodando" em segundo plano sem nunca aparecer.
  const showFallbackTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      Logger.warn('main', 'ready-to-show não disparou a tempo — forçando exibição da janela.');
      mainWindow.show();
    }
  }, 8000);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showFallbackTimer);
    mainWindow.show();
    mainWindow.focus();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.webContents.on('render-process-gone', (_evt, details) => {
    Logger.error('main', 'Renderer process gone', details);
    dialog.showErrorBox(
      'CS2 Ultimate Optimizer travou',
      `O processo de interface encerrou inesperadamente (${details.reason}). O aplicativo será fechado.`
    );
    app.quit();
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

if (gotSingleInstanceLock) {
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
}

app.on('window-all-closed', () => {
  Logger.info('main', 'Aplicação encerrada');
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (err) => {
  Logger.error('main', 'Uncaught exception', { message: err.message, stack: err.stack });
  dialog.showErrorBox(
    'Erro inesperado no CS2 Ultimate Optimizer',
    `${err.message}\n\nO aplicativo pode não funcionar corretamente. Verifique os logs.`
  );
});

process.on('unhandledRejection', (reason) => {
  Logger.error('main', 'Unhandled promise rejection', { reason: String(reason) });
});
