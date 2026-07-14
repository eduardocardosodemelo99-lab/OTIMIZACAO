/**
 * Tweak: Game Mode
 * Usa o componente gameModeManager para ativar o Game Mode do Windows via
 * registro (HKCU\Software\Microsoft\GameBar\AutoGameModeEnabled).
 */

const gameModeManager = require('../components/gameModeManager');

const id = 'game-mode';
const name = 'Game Mode';
const description = 'Ativa o Game Mode do Windows via registro (HKCU\\Software\\Microsoft\\GameBar)';

async function apply(Logger) {
  const result = await gameModeManager.setGameModeEnabled(true, Logger);
  return { success: Boolean(result.success), skipped: Boolean(result.skipped), ...result };
}

async function revert(Logger, options = {}) {
  const result = await gameModeManager.restoreState(options.previousState, Logger);
  return { success: Boolean(result.success), skipped: Boolean(result.skipped), ...result };
}

module.exports = { id, name, description, apply, revert };
