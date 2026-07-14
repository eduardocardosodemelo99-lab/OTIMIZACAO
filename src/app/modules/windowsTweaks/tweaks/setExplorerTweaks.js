/**
 * Tweak: Explorer
 * Usa o componente explorerTweaksManager para exibir as extensões de
 * arquivo e desabilitar as animações de minimizar/maximizar janelas,
 * reduzindo overhead visual do Explorer.
 */

const explorerTweaksManager = require('../components/explorerTweaksManager');

const id = 'explorer-tweaks';
const name = 'Explorer';
const description = 'Exibe extensões de arquivo e desabilita animações de janelas para reduzir overhead visual do Explorer';

async function apply(Logger) {
  const result = await explorerTweaksManager.optimizeExplorer(Logger);
  return { success: Boolean(result.success), skipped: Boolean(result.skipped), ...result };
}

async function revert(Logger, options = {}) {
  const result = await explorerTweaksManager.restoreState(options.previousState, Logger);
  return { success: Boolean(result.success), skipped: Boolean(result.skipped), ...result };
}

module.exports = { id, name, description, apply, revert };
