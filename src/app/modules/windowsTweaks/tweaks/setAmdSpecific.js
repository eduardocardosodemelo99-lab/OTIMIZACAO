/**
 * Tweak: AMD Specific
 * Usa o componente amdSpecificManager para desabilitar o Power Throttling
 * global e habilitar o Hardware-Accelerated GPU Scheduling, reduzindo
 * throttling e latência em sistemas com CPU/GPU AMD durante jogos.
 */

const amdSpecificManager = require('../components/amdSpecificManager');

const id = 'amd-specific';
const name = 'AMD Specific';
const description = 'Desabilita Power Throttling e habilita Hardware-Accelerated GPU Scheduling para reduzir throttling em sistemas AMD';

async function apply(Logger) {
  const result = await amdSpecificManager.optimizeAmdSpecific(Logger);
  return { success: Boolean(result.success), skipped: Boolean(result.skipped), ...result };
}

async function revert(Logger, options = {}) {
  const result = await amdSpecificManager.restoreState(options.previousState, Logger);
  return { success: Boolean(result.success), skipped: Boolean(result.skipped), ...result };
}

module.exports = { id, name, description, apply, revert };
