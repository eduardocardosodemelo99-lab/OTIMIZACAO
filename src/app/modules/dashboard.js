/**
 * Módulo Dashboard
 * Coleta informações de CPU, GPU, RAM, SSD, Monitor, Windows, Drivers e estima FPS.
 *
 * Nesta fase (scaffold) os handlers retornam dados estruturados de exemplo.
 * Na próxima etapa vamos integrar a lib `systeminformation` para leitura real.
 */

async function getSystemInfo() {
  return {
    cpu: { model: 'Desconhecido', cores: null, threads: null, baseClockGHz: null },
    gpu: { model: 'Desconhecido', vramGB: null, driverVersion: null },
    ram: { totalGB: null, speedMHz: null, usedGB: null },
    storage: { type: 'Desconhecido', totalGB: null, freeGB: null },
    monitor: { resolution: null, refreshRateHz: null },
    os: { name: 'Windows', version: null, build: null },
    estimatedFps: { csgo2: null, confidence: 'baixa' }
  };
}

async function getLiveStats() {
  return {
    timestamp: Date.now(),
    cpuLoadPercent: null,
    gpuLoadPercent: null,
    ramUsedPercent: null,
    diskUsedPercent: null,
    temperaturesC: { cpu: null, gpu: null }
  };
}

function registerDashboardHandlers(ipcMain, Logger) {
  ipcMain.handle('dashboard:getSystemInfo', async () => {
    Logger.info('dashboard', 'Consultando informações do sistema');
    return getSystemInfo();
  });

  ipcMain.handle('dashboard:getLiveStats', async () => {
    return getLiveStats();
  });
}

module.exports = { registerDashboardHandlers, getSystemInfo, getLiveStats };
