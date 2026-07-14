/**
 * Componente reutilizável: Game Mode Manager
 * Lê/ajusta o Game Mode do Windows via registro
 * (HKCU\Software\Microsoft\GameBar), sempre com captura/restauração do
 * estado anterior para reversão exata.
 */

const { runPowerShell } = require('./powershellRunner');

const REGISTRY_PATH = 'HKCU:\\Software\\Microsoft\\GameBar';
const VALUE_NAME = 'AutoGameModeEnabled';

/** Consulta o valor atual de AutoGameModeEnabled no registro. Retorna
 * enabled:true/false quando a chave existe; enabled:null quando ainda não
 * foi definida (Windows assume Game Mode ativado por padrão nesse caso). */
async function getGameModeState() {
  const result = await runPowerShell(
    `Get-ItemPropertyValue -Path '${REGISTRY_PATH}' -Name ${VALUE_NAME} -ErrorAction Stop`
  );
  if (!result.success) {
    return { enabled: null, skipped: result.skipped, reason: result.reason || result.error };
  }
  const raw = result.stdout.trim();
  return { enabled: raw === '1' };
}

/** Ativa ou desativa o Game Mode, criando a chave de registro se necessário. */
async function setGameModeEnabled(enabled, Logger) {
  const value = enabled ? 1 : 0;
  const command =
    `New-Item -Path '${REGISTRY_PATH}' -Force | Out-Null; ` +
    `New-ItemProperty -Path '${REGISTRY_PATH}' -Name ${VALUE_NAME} -Value ${value} -PropertyType DWord -Force | Out-Null`;

  const result = await runPowerShell(command);
  if (Logger) {
    if (result.success) Logger.info('gameModeManager', `Game Mode ${enabled ? 'ativado' : 'desativado'}`);
    else Logger.warn('gameModeManager', 'Falha ao alterar Game Mode', { detail: result.error || result.reason });
  }
  return { enabled, ...result };
}

/** Captura o estado atual do Game Mode para permitir reversão exata. */
async function captureState() {
  return getGameModeState();
}

/** Restaura o Game Mode a partir de um estado capturado anteriormente. Se
 * o estado capturado for null (chave nunca definida), não faz nada — o
 * comportamento padrão do Windows já é o desejado. */
async function restoreState(state, Logger) {
  if (!state || state.enabled === null || state.enabled === undefined) {
    return { success: false, skipped: true, reason: 'no-captured-state' };
  }
  return setGameModeEnabled(state.enabled, Logger);
}

module.exports = {
  REGISTRY_PATH,
  VALUE_NAME,
  getGameModeState,
  setGameModeEnabled,
  captureState,
  restoreState
};
