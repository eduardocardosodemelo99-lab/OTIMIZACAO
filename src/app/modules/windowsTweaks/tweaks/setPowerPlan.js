/**
 * Tweak: Power Plan (Alto Desempenho)
 * Usa o componente powerPlanManager para detectar o plano de energia atual
 * via `powercfg /list` e ativar "Ultimate Performance" (ou "High
 * Performance" como fallback) via `powercfg /setactive`.
 */

const powerPlanManager = require('../components/powerPlanManager');

const id = 'power-plan';
const name = 'Power Plan';
const description = 'Ativa o plano de energia "Ultimate Performance" (ou "High Performance") para desempenho máximo';

async function apply(Logger) {
  const result = await powerPlanManager.setBestPerformancePlan(Logger);
  return { success: Boolean(result.success), skipped: Boolean(result.skipped), ...result };
}

async function revert(Logger, options = {}) {
  const result = await powerPlanManager.restoreState(options.previousState, Logger);
  return { success: Boolean(result.success), skipped: Boolean(result.skipped), ...result };
}

module.exports = { id, name, description, apply, revert };
