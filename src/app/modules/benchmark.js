/**
 * Módulo Benchmark
 * Mede Average FPS, 1% low, 0.1% low e Frame Time.
 */

let history = [];

function computeStats(samples) {
  if (!samples || samples.length === 0) {
    return { averageFps: null, low1Percent: null, low01Percent: null, avgFrameTimeMs: null };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  const low1Index = Math.max(0, Math.floor(sorted.length * 0.01));
  const low01Index = Math.max(0, Math.floor(sorted.length * 0.001));
  return {
    averageFps: Number(avg.toFixed(1)),
    low1Percent: Number(sorted[low1Index].toFixed(1)),
    low01Percent: Number(sorted[low01Index].toFixed(1)),
    avgFrameTimeMs: Number((1000 / avg).toFixed(2))
  };
}

async function start(options) {
  const durationSeconds = (options && options.durationSeconds) || 60;
  const run = {
    id: `bench-${Date.now()}`,
    startedAt: new Date().toISOString(),
    durationSeconds,
    samples: [],
    stats: null
  };
  // TODO: coletar amostras reais de FPS via hook/overlay na próxima etapa
  run.stats = computeStats(run.samples);
  history.push(run);
  return run;
}

async function getHistory() {
  return history;
}

function registerBenchmarkHandlers(ipcMain, Logger) {
  ipcMain.handle('benchmark:start', async (_evt, options) => {
    Logger.info('benchmark', 'Iniciando benchmark', { options });
    return start(options);
  });
  ipcMain.handle('benchmark:getHistory', async () => getHistory());
}

module.exports = { registerBenchmarkHandlers, computeStats, start, getHistory };
