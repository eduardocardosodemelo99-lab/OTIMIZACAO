/**
 * Tweak: Otimização de SSD
 * Usa o componente ssdOptimizeManager para garantir TRIM automático
 * habilitado e desabilitar a indexação de busca do Windows no volume do
 * sistema (C:), reduzindo I/O de fundo desnecessário em SSDs.
 */

const ssdOptimizeManager = require('../components/ssdOptimizeManager');

const id = 'ssd-optimize';
const name = 'Otimização de SSD';
const description = 'Garante TRIM automático habilitado e desabilita a indexação de busca no volume do sistema';

async function apply(Logger) {
  const result = await ssdOptimizeManager.optimizeForSsd(Logger);
  return { success: Boolean(result.success), skipped: Boolean(result.skipped), ...result };
}

async function revert(Logger, options = {}) {
  const result = await ssdOptimizeManager.restoreState(options.previousState, Logger);
  return { success: Boolean(result.success), skipped: Boolean(result.skipped), ...result };
}

module.exports = { id, name, description, apply, revert };
