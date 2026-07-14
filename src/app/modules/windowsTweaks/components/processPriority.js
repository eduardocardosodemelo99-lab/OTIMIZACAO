/**
 * Componente reutilizável: Process Priority
 * Consulta/ajusta a prioridade de processos do Windows (ex.: cs2.exe) para
 * reduzir stutters, dando mais tempo de CPU ao jogo.
 */

const { runPowerShell } = require('./powershellRunner');

const PRIORITY_LEVELS = ['Idle', 'BelowNormal', 'Normal', 'AboveNormal', 'High', 'RealTime'];

function isValidPriority(priority) {
  return PRIORITY_LEVELS.includes(priority);
}

/** Normaliza o nome do processo removendo a extensão .exe, já que
 * `Get-Process -Name` do PowerShell não aceita a extensão. */
function normalizeProcessName(processName) {
  return String(processName || '').replace(/\.exe$/i, '');
}

async function getProcessPriority(processName) {
  const name = normalizeProcessName(processName);
  const result = await runPowerShell(
    `(Get-Process -Name '${name}' -ErrorAction Stop | Select-Object -First 1).PriorityClass`
  );
  if (!result.success) {
    return { name, priority: null, ...result };
  }
  return { name, priority: result.stdout.trim() || null };
}

async function setProcessPriority(processName, priority = 'High', Logger) {
  if (!isValidPriority(priority)) {
    return {
      success: false,
      error: `Prioridade inválida: ${priority}. Use uma de: ${PRIORITY_LEVELS.join(', ')}`
    };
  }

  const name = normalizeProcessName(processName);
  const result = await runPowerShell(
    `Get-Process -Name '${name}' -ErrorAction Stop | ForEach-Object { $_.PriorityClass = '${priority}' }`
  );

  if (Logger) {
    if (result.success) Logger.info('processPriority', `Prioridade de ${name} definida como ${priority}`);
    else Logger.warn('processPriority', `Falha ao definir prioridade de ${name}`, { detail: result.error || result.reason });
  }

  return { name, priority, ...result };
}

module.exports = { PRIORITY_LEVELS, isValidPriority, normalizeProcessName, getProcessPriority, setProcessPriority };
