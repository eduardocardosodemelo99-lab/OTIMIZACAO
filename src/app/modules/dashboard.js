/**
 * Módulo Dashboard
 * Coleta informações reais de CPU, GPU, RAM, SSD, Monitor e Sistema Operacional
 * usando a lib `systeminformation`, além de estimar o FPS esperado para CS2.
 */

const si = require('systeminformation');

const GB = 1024 * 1024 * 1024;

function toGB(bytes) {
  if (!bytes || Number.isNaN(bytes)) return null;
  return Math.round((bytes / GB) * 10) / 10;
}

/** systeminformation pode retornar valores absurdos em filesystems overlay/virtuais.
 * Filtra tamanhos fora de uma faixa plausível (1 GB a 128 TB). */
function isPlausibleBytes(bytes) {
  return typeof bytes === 'number' && Number.isFinite(bytes) && bytes > 1 * GB && bytes < 128 * 1024 * GB;
}

function estimateFps({ cpu, gpuModel, ramGB }) {
  let score = 0;
  let confidence = 'baixa';

  const cores = cpu?.cores || 0;
  const speed = cpu?.speed || 0;
  score += Math.min(cores, 16) * 8;
  score += Math.min(speed, 5.5) * 20;

  const gpu = (gpuModel || '').toUpperCase();
  if (/RTX 40/.test(gpu)) score += 220;
  else if (/RTX 30/.test(gpu)) score += 180;
  else if (/RTX 20|GTX 16/.test(gpu)) score += 130;
  else if (/RX 7|RX 6/.test(gpu)) score += 170;
  else if (/RX 5/.test(gpu)) score += 120;
  else if (/GTX/.test(gpu)) score += 90;
  else score += 40;

  if (ramGB && ramGB >= 16) score += 30;
  else if (ramGB && ramGB >= 8) score += 10;

  if (cores && speed && gpuModel) confidence = 'alta';
  else if (cores || gpuModel) confidence = 'média';

  const estimatedFps = Math.max(60, Math.round(score));
  return { csgo2: estimatedFps, confidence };
}

async function getSystemInfo() {
  const [cpuData, cpuFlags, gfx, mem, fsSize, osInfo, graphicsDisplays] = await Promise.all([
    si.cpu(),
    si.cpuFlags().catch(() => ''),
    si.graphics(),
    si.mem(),
    si.fsSize(),
    si.osInfo(),
    si.graphics().then((g) => g.displays).catch(() => [])
  ]);

  const primaryGpu = gfx.controllers?.[0] || {};
  const gpuModel = primaryGpu.model || 'Desconhecido';

  const validDisks = (fsSize || []).filter((d) => isPlausibleBytes(d.size));
  const mainDisk = validDisks.sort((a, b) => b.size - a.size)[0];

  const primaryDisplay = graphicsDisplays?.[0] || {};

  const ramTotalGB = toGB(mem.total);

  return {
    cpu: {
      model: cpuData.brand || cpuData.manufacturer || 'Desconhecido',
      cores: cpuData.physicalCores || cpuData.cores || null,
      threads: cpuData.cores || null,
      baseClockGHz: cpuData.speed || null
    },
    gpu: {
      model: gpuModel,
      vramGB: primaryGpu.vram ? Math.round(primaryGpu.vram / 1024) : null,
      driverVersion: primaryGpu.driverVersion || null
    },
    ram: {
      totalGB: ramTotalGB,
      speedMHz: null,
      usedGB: toGB(mem.active)
    },
    storage: {
      type: mainDisk?.type || mainDisk?.fs || 'Desconhecido',
      totalGB: mainDisk ? toGB(mainDisk.size) : null,
      freeGB: mainDisk ? toGB(mainDisk.available) : null
    },
    monitor: {
      resolution: primaryDisplay.resolutionX ? `${primaryDisplay.resolutionX}x${primaryDisplay.resolutionY}` : null,
      refreshRateHz: primaryDisplay.currentRefreshRate || null
    },
    os: {
      name: osInfo.distro || 'Windows',
      version: osInfo.release || null,
      build: osInfo.build || null
    },
    estimatedFps: estimateFps({ cpu: cpuData, gpuModel, ramGB: ramTotalGB })
  };
}

async function getLiveStats() {
  const [load, mem, fsSize, temp, gfx] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.cpuTemperature().catch(() => ({ main: null })),
    si.graphics().catch(() => ({ controllers: [] }))
  ]);

  const validDisks = (fsSize || []).filter((d) => isPlausibleBytes(d.size));
  const mainDisk = validDisks.sort((a, b) => b.size - a.size)[0];
  const diskUsedPercent = mainDisk ? Math.round((1 - mainDisk.available / mainDisk.size) * 1000) / 10 : null;

  const gpuLoad = gfx.controllers?.[0]?.utilizationGpu ?? null;
  const gpuTemp = gfx.controllers?.[0]?.temperatureGpu ?? null;

  return {
    timestamp: Date.now(),
    cpuLoadPercent: load?.currentLoad != null ? Math.round(load.currentLoad * 10) / 10 : null,
    gpuLoadPercent: gpuLoad != null ? Math.round(gpuLoad * 10) / 10 : null,
    ramUsedPercent: mem.total ? Math.round((mem.active / mem.total) * 1000) / 10 : null,
    diskUsedPercent,
    temperaturesC: {
      cpu: temp?.main ?? null,
      gpu: gpuTemp
    }
  };
}

function registerDashboardHandlers(ipcMain, Logger) {
  ipcMain.handle('dashboard:getSystemInfo', async () => {
    try {
      return await getSystemInfo();
    } catch (err) {
      Logger.error('dashboard', 'Falha ao coletar informações do sistema', { message: err.message });
      throw err;
    }
  });

  ipcMain.handle('dashboard:getLiveStats', async () => {
    try {
      return await getLiveStats();
    } catch (err) {
      Logger.error('dashboard', 'Falha ao coletar estatísticas ao vivo', { message: err.message });
      throw err;
    }
  });
}

module.exports = { registerDashboardHandlers, getSystemInfo, getLiveStats };
