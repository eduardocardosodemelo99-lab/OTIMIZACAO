/**
 * Tweak: Aumentar Prioridade de Processo
 * Usa o componente processPriority para elevar a prioridade do processo do
 * CS2 (ou de outro processo informado), reduzindo a chance de stutters
 * causados por outros processos competindo por CPU.
 */

const processPriority = require('../components/processPriority');

const id = 'boost-process-priority';
const name = 'Aumentar Prioridade de Processo';
const description = 'Define a prioridade do processo do CS2 (ou outro informado) como Alta para reduzir stutters.';

const DEFAULT_TARGET_PROCESS = 'cs2';

async function apply(Logger, options = {}) {
  const processName = options.processName || DEFAULT_TARGET_PROCESS;
  const priority = options.priority || 'High';
  const result = await processPriority.setProcessPriority(processName, priority, Logger);
  return { success: Boolean(result.success), ...result };
}

async function revert(Logger, options = {}) {
  const processName = options.processName || DEFAULT_TARGET_PROCESS;
  const result = await processPriority.setProcessPriority(processName, 'Normal', Logger);
  return { success: Boolean(result.success), ...result };
}

module.exports = { id, name, description, DEFAULT_TARGET_PROCESS, apply, revert };
