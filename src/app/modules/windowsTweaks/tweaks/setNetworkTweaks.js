/**
 * Tweak: Network Tweaks
 * Usa o componente networkTweaksManager para desabilitar o limite de banda
 * do MMCSS (NetworkThrottlingIndex) e reduzir o SystemResponsiveness a 0,
 * priorizando tráfego de rede e jogos em primeiro plano.
 */

const networkTweaksManager = require('../components/networkTweaksManager');

const id = 'network-tweaks';
const name = 'Rede';
const description = 'Desabilita o limite de banda do MMCSS e reduz o SystemResponsiveness para priorizar rede/jogos (menor latência)';

async function apply(Logger) {
  const result = await networkTweaksManager.optimizeNetwork(Logger);
  return { success: Boolean(result.success), skipped: Boolean(result.skipped), ...result };
}

async function revert(Logger, options = {}) {
  const result = await networkTweaksManager.restoreState(options.previousState, Logger);
  return { success: Boolean(result.success), skipped: Boolean(result.skipped), ...result };
}

module.exports = { id, name, description, apply, revert };
