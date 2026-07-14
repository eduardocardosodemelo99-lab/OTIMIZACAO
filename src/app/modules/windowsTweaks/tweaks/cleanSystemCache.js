/**
 * Tweak: Limpar Cache do Sistema
 * Usa o componente cacheCleaner para remover arquivos temporários, prefetch
 * e cache de atualização do Windows. Não é reversível (é uma limpeza).
 */

const cacheCleaner = require('../components/cacheCleaner');

const id = 'clean-system-cache';
const name = 'Limpar Cache do Sistema';
const description = 'Remove arquivos temporários, prefetch e cache de atualização do Windows para liberar espaço.';

async function apply(Logger, options = {}) {
  const outcome = await cacheCleaner.cleanCache(options.targetKeys, Logger);
  return { success: true, ...outcome };
}

async function revert() {
  return { success: false, error: 'Limpeza de cache não é reversível: os arquivos removidos não podem ser restaurados.' };
}

module.exports = { id, name, description, apply, revert };
