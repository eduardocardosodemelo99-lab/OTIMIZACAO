/**
 * Módulo Scanner
 * - Detecta hardware (Intel/Xeon/Ryzen, RTX/RX, SSD/NVMe) usando `systeminformation`.
 * - Escaneia pastas de arquivos temporários, cache do Windows e cache do CS2,
 *   calculando o espaço ocupado por categoria.
 * - Permite limpeza seletiva de cada categoria.
 */

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const si = require('systeminformation');

const SUPPORTED_CPU_FAMILIES = ['Intel', 'Xeon', 'Ryzen'];
const SUPPORTED_GPU_FAMILIES = ['RTX', 'RX'];
const SUPPORTED_STORAGE_TYPES = ['SSD', 'NVMe'];

const MAX_SCAN_DEPTH = 6;
const MAX_ENTRIES_PER_DIR = 20000;

function detectCpuFamily(cpuBrand = '') {
  const brand = cpuBrand.toUpperCase();
  if (/XEON/.test(brand)) return 'Xeon';
  if (/RYZEN/.test(brand)) return 'Ryzen';
  if (/INTEL|CORE/.test(brand)) return 'Intel';
  return null;
}

function detectGpuFamily(gpuModel = '') {
  const model = gpuModel.toUpperCase();
  if (/RTX/.test(model)) return 'RTX';
  if (/RX\s?\d/.test(model)) return 'RX';
  return null;
}

function detectStorageType(disk) {
  if (!disk) return null;
  const fsType = `${disk.type || ''} ${disk.fs || ''}`.toUpperCase();
  if (/NVME/.test(fsType)) return 'NVMe';
  if (/SSD/.test(fsType)) return 'SSD';
  return null;
}

/** Resolve os diretórios alvo de cada categoria de scan, com fallback multiplataforma. */
function getScanTargets() {
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const windowsDir = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  return {
    tempFiles: {
      label: 'Arquivos Temporários',
      description: 'Pastas TEMP do usuário e do sistema.',
      paths: [os.tmpdir(), path.join(localAppData, 'Temp')]
    },
    windowsCache: {
      label: 'Cache do Windows',
      description: 'Cache de atualizações, prefetch e miniaturas.',
      paths: [
        path.join(windowsDir, 'Prefetch'),
        path.join(windowsDir, 'SoftwareDistribution', 'Download'),
        path.join(localAppData, 'Microsoft', 'Windows', 'Explorer')
      ]
    },
    cs2Cache: {
      label: 'Cache do CS2',
      description: 'Shader cache e arquivos de download do Counter-Strike 2.',
      paths: [
        path.join(programFilesX86, 'Steam', 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'temp'),
        path.join(localAppData, 'NVIDIA', 'DXCache'),
        path.join(localAppData, 'D3DSCache')
      ]
    }
  };
}

/** Calcula recursivamente o tamanho ocupado por um diretório, com limite de profundidade
 * e de número de entradas para evitar travar em árvores gigantes. */
async function getDirStats(dirPath, depth = 0, counters = { entries: 0 }) {
  let totalBytes = 0;
  let fileCount = 0;

  if (depth > MAX_SCAN_DEPTH || counters.entries > MAX_ENTRIES_PER_DIR) {
    return { totalBytes, fileCount, exists: true, truncated: true };
  }

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    return { totalBytes: 0, fileCount: 0, exists: false, error: err.code };
  }

  for (const entry of entries) {
    counters.entries += 1;
    if (counters.entries > MAX_ENTRIES_PER_DIR) break;

    const fullPath = path.join(dirPath, entry.name);
    try {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        const sub = await getDirStats(fullPath, depth + 1, counters);
        totalBytes += sub.totalBytes;
        fileCount += sub.fileCount;
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        totalBytes += stat.size;
        fileCount += 1;
      }
    } catch (_err) {
      // Arquivo bloqueado, sem permissão ou removido durante o scan: ignora e segue.
    }
  }

  return { totalBytes, fileCount, exists: true, truncated: counters.entries > MAX_ENTRIES_PER_DIR };
}

async function scanCategory(categoryKey) {
  const targets = getScanTargets();
  const target = targets[categoryKey];
  if (!target) throw new Error(`Categoria de scan desconhecida: ${categoryKey}`);

  const pathResults = [];
  let totalBytes = 0;
  let totalFiles = 0;

  for (const dirPath of target.paths) {
    const stats = await getDirStats(dirPath);
    pathResults.push({ path: dirPath, ...stats, sizeMB: Math.round((stats.totalBytes / (1024 * 1024)) * 10) / 10 });
    totalBytes += stats.totalBytes;
    totalFiles += stats.fileCount;
  }

  return {
    key: categoryKey,
    label: target.label,
    description: target.description,
    totalBytes,
    totalSizeMB: Math.round((totalBytes / (1024 * 1024)) * 10) / 10,
    totalFiles,
    paths: pathResults
  };
}

async function runFullScan() {
  const [cpuData, gfx, fsSize] = await Promise.all([
    si.cpu(),
    si.graphics(),
    si.fsSize()
  ]);

  const cpuFamily = detectCpuFamily(cpuData.brand || cpuData.manufacturer);
  const gpuModel = gfx.controllers?.[0]?.model || '';
  const gpuFamily = detectGpuFamily(gpuModel);
  const mainDisk = (fsSize || []).sort((a, b) => (b.size || 0) - (a.size || 0))[0];
  const storageType = detectStorageType(mainDisk);
  const isAmd = /AMD|RYZEN/i.test(cpuData.manufacturer || cpuData.brand || '') || /RX\s?\d/i.test(gpuModel);

  const categories = await Promise.all(
    Object.keys(getScanTargets()).map((key) => scanCategory(key))
  );

  return {
    cpuFamily,
    gpuFamily,
    storageType,
    windows: {
      gameModeEnabled: null,
      powerPlan: null,
      explorerOptimized: null,
      networkOptimized: null
    },
    amdSpecific: isAmd,
    supported: {
      cpu: SUPPORTED_CPU_FAMILIES,
      gpu: SUPPORTED_GPU_FAMILIES,
      storage: SUPPORTED_STORAGE_TYPES
    },
    cleanup: {
      categories,
      totalReclaimableMB: Math.round(categories.reduce((sum, c) => sum + c.totalSizeMB, 0) * 10) / 10
    },
    scannedAt: new Date().toISOString()
  };
}

/** Remove os arquivos de uma categoria (mantém as pastas). Retorna espaço liberado e erros. */
async function cleanCategory(categoryKey, Logger) {
  const targets = getScanTargets();
  const target = targets[categoryKey];
  if (!target) throw new Error(`Categoria de scan desconhecida: ${categoryKey}`);

  let freedBytes = 0;
  let deletedFiles = 0;
  let skipped = 0;

  async function removeFilesInDir(dirPath, depth = 0) {
    if (depth > MAX_SCAN_DEPTH) return;
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (_err) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          await removeFilesInDir(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const stat = await fs.stat(fullPath);
          await fs.unlink(fullPath);
          freedBytes += stat.size;
          deletedFiles += 1;
        }
      } catch (err) {
        skipped += 1;
        if (Logger) Logger.warn('scanner', `Não foi possível remover ${fullPath}`, { message: err.message });
      }
    }
  }

  for (const dirPath of target.paths) {
    await removeFilesInDir(dirPath);
  }

  return {
    key: categoryKey,
    label: target.label,
    freedMB: Math.round((freedBytes / (1024 * 1024)) * 10) / 10,
    deletedFiles,
    skipped
  };
}

function registerScannerHandlers(ipcMain, Logger) {
  ipcMain.handle('scanner:runFullScan', async () => {
    Logger.info('scanner', 'Executando scan completo do sistema');
    return runFullScan();
  });

  ipcMain.handle('scanner:cleanCategory', async (_evt, categoryKey) => {
    Logger.info('scanner', `Limpando categoria: ${categoryKey}`);
    const result = await cleanCategory(categoryKey, Logger);
    Logger.info('scanner', `Categoria ${categoryKey} limpa`, result);
    return result;
  });
}

module.exports = { registerScannerHandlers, runFullScan, scanCategory, cleanCategory, getScanTargets };
