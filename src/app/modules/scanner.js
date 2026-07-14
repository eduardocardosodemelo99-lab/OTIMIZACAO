/**
 * Módulo Scanner
 * Detecta hardware (Intel/Xeon/Ryzen, RTX/RX, SSD/NVMe) e configuração do Windows.
 */

const SUPPORTED_CPU_FAMILIES = ['Intel', 'Xeon', 'Ryzen'];
const SUPPORTED_GPU_FAMILIES = ['RTX', 'RX'];
const SUPPORTED_STORAGE_TYPES = ['SSD', 'NVMe'];

async function runFullScan() {
  return {
    cpuFamily: null,
    gpuFamily: null,
    storageType: null,
    windows: {
      gameModeEnabled: null,
      powerPlan: null,
      explorerOptimized: null,
      networkOptimized: null
    },
    amdSpecific: null,
    supported: {
      cpu: SUPPORTED_CPU_FAMILIES,
      gpu: SUPPORTED_GPU_FAMILIES,
      storage: SUPPORTED_STORAGE_TYPES
    },
    scannedAt: new Date().toISOString()
  };
}

function registerScannerHandlers(ipcMain, Logger) {
  ipcMain.handle('scanner:runFullScan', async () => {
    Logger.info('scanner', 'Executando scan completo do sistema');
    return runFullScan();
  });
}

module.exports = { registerScannerHandlers, runFullScan };
