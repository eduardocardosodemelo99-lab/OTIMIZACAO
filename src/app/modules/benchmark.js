/**
 * Módulo Benchmark
 * Lança o CS2, captura frame times reais via PresentMon (ferramenta padrão
 * da indústria para medição de FPS por processo no Windows, já que o CS2
 * não expõe uma API própria de FPS) e calcula Average FPS, 1% low, 0.1% low
 * e Frame Time médio. Cada execução é salva com timestamp em um histórico
 * persistente em disco.
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const paths = require('./paths');

const CS2_PROCESS_NAME = 'cs2.exe';
const CS2_APP_ID = '730';
const DEFAULT_DURATION_SECONDS = 60;

function getHistoryDir() {
  return path.join(paths.getLogDir(), 'benchmark');
}
function getHistoryFile() {
  return path.join(getHistoryDir(), 'history.json');
}
function getToolsDir() {
  return paths.getToolsDir();
}

// ---------------------------------------------------------------------------
// Descoberta do CS2 instalado (Steam library folders)
// ---------------------------------------------------------------------------

/** Faz o parse simplificado de um steamapps/libraryfolders.vdf e retorna
 * a lista de caminhos de biblioteca do Steam. Função pura, testável sem OS. */
function parseLibraryFoldersVdf(vdfContent) {
  if (!vdfContent) return [];
  const paths = [];
  const pathRegex = /"path"\s*"([^"]+)"/g;
  let match;
  while ((match = pathRegex.exec(vdfContent)) !== null) {
    paths.push(match[1].replace(/\\\\/g, '\\'));
  }
  return paths;
}

function getDefaultSteamPaths() {
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  return [path.join(programFilesX86, 'Steam'), path.join(programFiles, 'Steam')];
}

/** Monta o caminho esperado do executável do CS2 dentro de uma biblioteca Steam. */
function buildCs2PathForLibrary(libraryPath) {
  return path.join(
    libraryPath,
    'steamapps',
    'common',
    'Counter-Strike Global Offensive',
    'game',
    'bin',
    'win64',
    CS2_PROCESS_NAME
  );
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve o caminho do executável do CS2 procurando em todas as bibliotecas
 * Steam conhecidas (padrão + as declaradas em libraryfolders.vdf). */
async function findCs2Executable() {
  const steamRoots = getDefaultSteamPaths();
  const libraries = new Set(steamRoots);

  for (const root of steamRoots) {
    const vdfPath = path.join(root, 'steamapps', 'libraryfolders.vdf');
    try {
      const content = await fsp.readFile(vdfPath, 'utf8');
      parseLibraryFoldersVdf(content).forEach((p) => libraries.add(p));
    } catch {
      // libraryfolders.vdf não encontrado nesta raiz: ignora e segue.
    }
  }

  for (const libraryPath of libraries) {
    const candidate = buildCs2PathForLibrary(libraryPath);
    if (await fileExists(candidate)) return candidate;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Processo do CS2
// ---------------------------------------------------------------------------

function isProcessRunning(processName) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(`tasklist /FI "IMAGENAME eq ${processName}"`, (err, stdout) => {
        if (err) return resolve(false);
        resolve(stdout.toLowerCase().includes(processName.toLowerCase()));
      });
    } else {
      exec(`pgrep -f ${processName}`, (err, stdout) => {
        resolve(!err && stdout.trim().length > 0);
      });
    }
  });
}

/** Lança o CS2 via protocolo steam:// (preferido, respeita parâmetros de
 * inicialização do usuário) com fallback para execução direta do binário. */
function launchCs2(execPath) {
  if (process.platform === 'win32') {
    exec(`start steam://run/${CS2_APP_ID}`, (err) => {
      if (err && execPath) {
        spawn(execPath, [], { detached: true, stdio: 'ignore' }).unref();
      }
    });
  } else if (execPath) {
    spawn(execPath, [], { detached: true, stdio: 'ignore' }).unref();
  }
}

async function waitForProcess(processName, timeoutMs, Logger) {
  const pollIntervalMs = 2000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isProcessRunning(processName)) return true;
    if (Logger) Logger.info('benchmark', `Aguardando ${processName} iniciar...`);
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Captura de frame time via PresentMon
// ---------------------------------------------------------------------------

/** Procura um executável do PresentMon dentro da pasta tools/ do projeto.
 * O usuário precisa baixar o PresentMon (Intel/Microsoft, open-source) e
 * colocá-lo em tools/, pois o CS2 não expõe uma API nativa de FPS. */
async function findPresentMonExecutable() {
  try {
    const entries = await fsp.readdir(getToolsDir());
    const match = entries.find((f) => /presentmon.*\.exe$/i.test(f));
    return match ? path.join(getToolsDir(), match) : null;
  } catch {
    return null;
  }
}

const PRESENTMON_DOWNLOAD_URL = 'https://github.com/GameTechDev/PresentMon/releases/latest';

/** Verifica se o PresentMon está instalado na pasta tools/ do projeto.
 * Usado na inicialização da app (e sob demanda) para avisar o usuário e
 * oferecer o link de download direto caso não esteja presente. Função
 * segura em qualquer plataforma/SO — nunca lança, apenas reporta status. */
async function checkPresentMonStatus(Logger) {
  try {
    await fsp.mkdir(getToolsDir(), { recursive: true });
  } catch (err) {
    if (Logger) Logger.warn('benchmark', `Não foi possível garantir a pasta tools/: ${err.message}`);
  }

  const presentMonPath = await findPresentMonExecutable();
  const installed = Boolean(presentMonPath);

  const status = {
    installed,
    path: presentMonPath,
    toolsDir: getToolsDir(),
    downloadUrl: PRESENTMON_DOWNLOAD_URL
  };

  if (Logger) {
    if (installed) {
      Logger.info('benchmark', `PresentMon encontrado em ${presentMonPath}`);
    } else {
      Logger.warn('benchmark', `PresentMon não encontrado em ${getToolsDir()}. Download: ${PRESENTMON_DOWNLOAD_URL}`);
    }
  }

  return status;
}

/** Executa o PresentMon filtrando pelo processo do CS2 e gravando um CSV
 * com uma linha por frame apresentado. Resolve quando a captura termina. */
function runPresentMonCapture({ presentMonPath, processName, durationSeconds, outputCsvPath }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-process_name', processName,
      '-output_file', outputCsvPath,
      '-timed', String(durationSeconds),
      '-terminate_after_timed',
      '-stop_existing_session'
    ];

    const child = spawn(presentMonPath, args, { windowsHide: true });
    let stderrBuf = '';

    child.stderr?.on('data', (chunk) => {
      stderrBuf += chunk.toString();
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`PresentMon encerrou com código ${code}: ${stderrBuf.slice(0, 300)}`));
    });
  });
}

/** Faz o parse do CSV gerado pelo PresentMon e extrai os tempos de frame
 * (em milissegundos) da coluna MsBetweenPresents. Função pura, testável
 * com um CSV de exemplo sem depender do PresentMon real. */
function parsePresentMonCsv(csvContent) {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim());
  const colIndex = header.findIndex((h) => /^MsBetweenPresents$/i.test(h));
  if (colIndex === -1) return [];

  const frameTimesMs = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',');
    const value = parseFloat(cols[colIndex]);
    if (Number.isFinite(value) && value > 0) frameTimesMs.push(value);
  }
  return frameTimesMs;
}

// ---------------------------------------------------------------------------
// Cálculo de estatísticas
// ---------------------------------------------------------------------------

/** Calcula Average FPS, 1% low, 0.1% low e frame time médio a partir dos
 * tempos de frame (ms). 1% low / 0.1% low = FPS médio do grupo de frames
 * mais lentos (piores 1% / 0.1%), método padrão usado por ferramentas como
 * CapFrameX e o próprio PresentMon. */
function computeStats(frameTimesMs) {
  if (!frameTimesMs || frameTimesMs.length === 0) {
    return { averageFps: null, low1Percent: null, low01Percent: null, avgFrameTimeMs: null, frameCount: 0 };
  }

  const avgFrameTimeMs = frameTimesMs.reduce((sum, v) => sum + v, 0) / frameTimesMs.length;
  const averageFps = 1000 / avgFrameTimeMs;

  // Ordena do frame mais lento (maior tempo) para o mais rápido.
  const sortedDesc = [...frameTimesMs].sort((a, b) => b - a);

  function slowestGroupFps(percent) {
    const count = Math.max(1, Math.round(sortedDesc.length * percent));
    const group = sortedDesc.slice(0, count);
    const groupAvgFrameTime = group.reduce((sum, v) => sum + v, 0) / group.length;
    return 1000 / groupAvgFrameTime;
  }

  return {
    averageFps: Number(averageFps.toFixed(1)),
    low1Percent: Number(slowestGroupFps(0.01).toFixed(1)),
    low01Percent: Number(slowestGroupFps(0.001).toFixed(1)),
    avgFrameTimeMs: Number(avgFrameTimeMs.toFixed(2)),
    frameCount: frameTimesMs.length
  };
}

// ---------------------------------------------------------------------------
// Histórico (persistência em disco)
// ---------------------------------------------------------------------------

async function loadHistory() {
  try {
    const content = await fsp.readFile(getHistoryFile(), 'utf8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveHistory(history) {
  await fsp.mkdir(getHistoryDir(), { recursive: true });
  await fsp.writeFile(getHistoryFile(), JSON.stringify(history, null, 2), 'utf8');
}

async function appendToHistory(run) {
  const history = await loadHistory();
  history.unshift(run);
  await saveHistory(history);
  return history;
}

async function getHistory() {
  return loadHistory();
}

// ---------------------------------------------------------------------------
// Orquestração do benchmark real
// ---------------------------------------------------------------------------

async function start(options, Logger, onProgress) {
  const durationSeconds = (options && options.durationSeconds) || DEFAULT_DURATION_SECONDS;
  const startedAt = new Date().toISOString();
  const runId = `bench-${Date.now()}`;

  const emitProgress = (stage, extra) => {
    if (onProgress) onProgress({ id: runId, stage, timestamp: Date.now(), ...extra });
    if (Logger) Logger.info('benchmark', `[${runId}] ${stage}`, extra || {});
  };

  if (process.platform !== 'win32') {
    const err = new Error(
      'Benchmark real requer Windows (CS2 + PresentMon). Este ambiente não é Windows, então a captura não pode ser executada aqui.'
    );
    emitProgress('erro', { message: err.message });
    throw err;
  }

  const presentMonPath = await findPresentMonExecutable();
  if (!presentMonPath) {
    const err = new Error(
      `PresentMon não encontrado em ${getToolsDir()}. Baixe o PresentMon (Intel/Microsoft, open-source) e coloque o executável nessa pasta antes de rodar o benchmark.`
    );
    emitProgress('erro', { message: err.message });
    throw err;
  }

  emitProgress('procurando_cs2');
  const cs2ExecPath = await findCs2Executable();

  const alreadyRunning = await isProcessRunning(CS2_PROCESS_NAME);
  if (!alreadyRunning) {
    if (!cs2ExecPath) {
      const err = new Error('CS2 não encontrado nas bibliotecas Steam e o processo não está em execução.');
      emitProgress('erro', { message: err.message });
      throw err;
    }
    emitProgress('lancando_cs2', { execPath: cs2ExecPath });
    launchCs2(cs2ExecPath);

    const started = await waitForProcess(CS2_PROCESS_NAME, 60000, Logger);
    if (!started) {
      const err = new Error('Tempo esgotado esperando o CS2 iniciar (60s).');
      emitProgress('erro', { message: err.message });
      throw err;
    }
  }

  emitProgress('capturando_frametimes', { durationSeconds });
  await fsp.mkdir(getHistoryDir(), { recursive: true });
  const csvPath = path.join(getHistoryDir(), `${runId}.csv`);

  await runPresentMonCapture({
    presentMonPath,
    processName: CS2_PROCESS_NAME,
    durationSeconds,
    outputCsvPath: csvPath
  });

  emitProgress('processando_resultados');
  const csvContent = await fsp.readFile(csvPath, 'utf8');
  const frameTimesMs = parsePresentMonCsv(csvContent);
  const stats = computeStats(frameTimesMs);

  const run = {
    id: runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationSeconds,
    csvPath,
    stats
  };

  await appendToHistory(run);
  emitProgress('concluido', { stats });

  return run;
}

function registerBenchmarkHandlers(ipcMain, Logger) {
  ipcMain.handle('benchmark:start', async (evt, options) => {
    Logger.info('benchmark', 'Iniciando benchmark', { options });
    return start(options, Logger, (progress) => {
      evt.sender.send('benchmark:sample', progress);
    });
  });

  ipcMain.handle('benchmark:getHistory', async () => getHistory());

  ipcMain.handle('benchmark:checkPresentMon', async () => checkPresentMonStatus(Logger));
}

module.exports = {
  registerBenchmarkHandlers,
  computeStats,
  parsePresentMonCsv,
  parseLibraryFoldersVdf,
  buildCs2PathForLibrary,
  findCs2Executable,
  findPresentMonExecutable,
  checkPresentMonStatus,
  PRESENTMON_DOWNLOAD_URL,
  start,
  getHistory
};
