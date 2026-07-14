/**
 * Componente reutilizável: Explorer Tweaks Manager
 * Ajusta duas configurações reais que reduzem overhead visual do Explorer:
 *   1. Extensões de arquivo (HideFileExt) — exibe as extensões de arquivo,
 *      útil para produtividade/segurança (não afeta desempenho, mas faz
 *      parte do conjunto clássico de "tweaks do Explorer").
 *   2. Animações de janelas (MinAnimate) — desabilita a animação de
 *      minimizar/maximizar janelas, reduzindo overhead visual/de composição.
 * Ambas as alterações são capturadas antes de aplicar, permitindo reversão
 * exata do estado anterior.
 */

const { runPowerShell } = require('./powershellRunner');

const ADVANCED_REGISTRY_PATH = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced';
const HIDE_FILE_EXT_VALUE = 'HideFileExt';

const WINDOW_METRICS_REGISTRY_PATH = 'HKCU:\\Control Panel\\Desktop\\WindowMetrics';
const MIN_ANIMATE_VALUE = 'MinAnimate';

/** Consulta se as extensões de arquivo estão visíveis (HideFileExt = 0). */
async function getFileExtensionsState() {
  const result = await runPowerShell(
    `Get-ItemPropertyValue -Path '${ADVANCED_REGISTRY_PATH}' -Name ${HIDE_FILE_EXT_VALUE} -ErrorAction Stop`
  );
  if (!result.success) {
    return { extensionsVisible: null, skipped: result.skipped, reason: result.reason || result.error };
  }
  const raw = result.stdout.trim();
  return { extensionsVisible: raw === '0' };
}

/** Exibe ou oculta as extensões de arquivo, criando a chave de registro se necessário. */
async function setFileExtensionsVisible(visible, Logger) {
  const value = visible ? 0 : 1;
  const command =
    `New-Item -Path '${ADVANCED_REGISTRY_PATH}' -Force | Out-Null; ` +
    `New-ItemProperty -Path '${ADVANCED_REGISTRY_PATH}' -Name ${HIDE_FILE_EXT_VALUE} -Value ${value} -PropertyType DWord -Force | Out-Null`;

  const result = await runPowerShell(command);
  if (Logger) {
    if (result.success) Logger.info('explorerTweaksManager', `Extensões de arquivo ${visible ? 'exibidas' : 'ocultadas'}`);
    else Logger.warn('explorerTweaksManager', 'Falha ao alterar exibição de extensões de arquivo', { detail: result.error || result.reason });
  }
  return { extensionsVisible: visible, ...result };
}

/** Consulta se as animações de janelas estão habilitadas (MinAnimate = 1). */
async function getWindowAnimationsState() {
  const result = await runPowerShell(
    `Get-ItemPropertyValue -Path '${WINDOW_METRICS_REGISTRY_PATH}' -Name ${MIN_ANIMATE_VALUE} -ErrorAction Stop`
  );
  if (!result.success) {
    return { animationsEnabled: null, skipped: result.skipped, reason: result.reason || result.error };
  }
  const raw = result.stdout.trim();
  return { animationsEnabled: raw === '1' };
}

/** Habilita ou desabilita as animações de minimizar/maximizar janelas. */
async function setWindowAnimationsEnabled(enabled, Logger) {
  const value = enabled ? '1' : '0';
  const command =
    `New-Item -Path '${WINDOW_METRICS_REGISTRY_PATH}' -Force | Out-Null; ` +
    `Set-ItemProperty -Path '${WINDOW_METRICS_REGISTRY_PATH}' -Name ${MIN_ANIMATE_VALUE} -Value '${value}' -Type String -Force`;

  const result = await runPowerShell(command);
  if (Logger) {
    if (result.success) Logger.info('explorerTweaksManager', `Animações de janelas ${enabled ? 'habilitadas' : 'desabilitadas'}`);
    else Logger.warn('explorerTweaksManager', 'Falha ao alterar animações de janelas', { detail: result.error || result.reason });
  }
  return { animationsEnabled: enabled, ...result };
}

/** Aplica o conjunto de ajustes do Explorer: exibe as extensões de arquivo
 * e desabilita as animações de janelas para reduzir overhead visual. */
async function optimizeExplorer(Logger) {
  const extensionsResult = await setFileExtensionsVisible(true, Logger);
  const animationsResult = await setWindowAnimationsEnabled(false, Logger);

  const success = Boolean(extensionsResult.success) && Boolean(animationsResult.success);
  const skipped = Boolean(extensionsResult.skipped) && Boolean(animationsResult.skipped);

  return { success, skipped, fileExtensions: extensionsResult, windowAnimations: animationsResult };
}

/** Captura o estado atual (extensões + animações) para permitir reversão exata. */
async function captureState() {
  const [fileExtensions, windowAnimations] = await Promise.all([getFileExtensionsState(), getWindowAnimationsState()]);
  return { fileExtensions, windowAnimations };
}

/** Restaura extensões e animações a partir de um estado capturado anteriormente. */
async function restoreState(state, Logger) {
  if (!state) {
    return { success: false, skipped: true, reason: 'no-captured-state' };
  }

  const results = {};
  let anyAttempted = false;
  let anyFailed = false;

  if (state.fileExtensions && state.fileExtensions.extensionsVisible !== null && state.fileExtensions.extensionsVisible !== undefined) {
    anyAttempted = true;
    results.fileExtensions = await setFileExtensionsVisible(state.fileExtensions.extensionsVisible, Logger);
    if (!results.fileExtensions.success) anyFailed = true;
  }

  if (state.windowAnimations && state.windowAnimations.animationsEnabled !== null && state.windowAnimations.animationsEnabled !== undefined) {
    anyAttempted = true;
    results.windowAnimations = await setWindowAnimationsEnabled(state.windowAnimations.animationsEnabled, Logger);
    if (!results.windowAnimations.success) anyFailed = true;
  }

  if (!anyAttempted) {
    return { success: false, skipped: true, reason: 'no-captured-state' };
  }

  return { success: !anyFailed, ...results };
}

module.exports = {
  ADVANCED_REGISTRY_PATH,
  HIDE_FILE_EXT_VALUE,
  WINDOW_METRICS_REGISTRY_PATH,
  MIN_ANIMATE_VALUE,
  getFileExtensionsState,
  setFileExtensionsVisible,
  getWindowAnimationsState,
  setWindowAnimationsEnabled,
  optimizeExplorer,
  captureState,
  restoreState
};
