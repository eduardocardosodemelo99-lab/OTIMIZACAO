/**
 * Componente reutilizável: Network Tweaks Manager
 * Ajusta duas configurações reais e amplamente documentadas que reduzem a
 * latência de rede priorizando tráfego de jogos/aplicações em primeiro
 * plano sobre tarefas multimídia em segundo plano:
 *   1. NetworkThrottlingIndex — o agendador multimídia do Windows (MMCSS)
 *      limita por padrão a banda disponível para tráfego não-multimídia a
 *      ~10 pacotes/ms enquanto processos multimídia estão ativos. Definir
 *      como 0xffffffff (4294967295) desabilita esse limite.
 *   2. SystemResponsiveness — percentual de recursos de CPU/rede reservado
 *      para tarefas multimídia em detrimento de outros processos. Reduzir
 *      para 0 prioriza a responsividade de jogos/rede sobre reprodução
 *      multimídia em segundo plano.
 * Ambas as chaves ficam em
 * HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile
 * e são capturadas antes de aplicar, permitindo reversão exata do estado
 * anterior.
 */

const { runPowerShell } = require('./powershellRunner');

const SYSTEM_PROFILE_REGISTRY_PATH =
  'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile';
const NETWORK_THROTTLING_VALUE = 'NetworkThrottlingIndex';
const NETWORK_THROTTLING_DISABLED_VALUE = 0xffffffff;
const NETWORK_THROTTLING_DEFAULT_VALUE = 10;

const SYSTEM_RESPONSIVENESS_VALUE = 'SystemResponsiveness';
const SYSTEM_RESPONSIVENESS_OPTIMIZED_VALUE = 0;
const SYSTEM_RESPONSIVENESS_DEFAULT_VALUE = 20;

/** Consulta se o Network Throttling está desabilitado (NetworkThrottlingIndex = 0xffffffff). */
async function getNetworkThrottlingState() {
  const result = await runPowerShell(
    `Get-ItemPropertyValue -Path '${SYSTEM_PROFILE_REGISTRY_PATH}' -Name ${NETWORK_THROTTLING_VALUE} -ErrorAction Stop`
  );
  if (!result.success) {
    return { throttlingDisabled: null, skipped: result.skipped, reason: result.reason || result.error };
  }
  const raw = parseInt(result.stdout.trim(), 10);
  return { throttlingDisabled: raw === NETWORK_THROTTLING_DISABLED_VALUE };
}

/** Habilita ou desabilita o limite de banda do MMCSS para tráfego não-multimídia. */
async function setNetworkThrottlingDisabled(disabled, Logger) {
  const value = disabled ? NETWORK_THROTTLING_DISABLED_VALUE : NETWORK_THROTTLING_DEFAULT_VALUE;
  const command =
    `New-Item -Path '${SYSTEM_PROFILE_REGISTRY_PATH}' -Force | Out-Null; ` +
    `New-ItemProperty -Path '${SYSTEM_PROFILE_REGISTRY_PATH}' -Name ${NETWORK_THROTTLING_VALUE} -Value ${value} -PropertyType DWord -Force | Out-Null`;

  const result = await runPowerShell(command);
  if (Logger) {
    if (result.success) Logger.info('networkTweaksManager', `Network Throttling ${disabled ? 'desabilitado' : 'habilitado'}`);
    else Logger.warn('networkTweaksManager', 'Falha ao alterar Network Throttling', { detail: result.error || result.reason });
  }
  return { throttlingDisabled: disabled, ...result };
}

/** Consulta o valor atual de SystemResponsiveness (0 = totalmente otimizado para rede/jogos). */
async function getSystemResponsivenessState() {
  const result = await runPowerShell(
    `Get-ItemPropertyValue -Path '${SYSTEM_PROFILE_REGISTRY_PATH}' -Name ${SYSTEM_RESPONSIVENESS_VALUE} -ErrorAction Stop`
  );
  if (!result.success) {
    return { responsivenessValue: null, skipped: result.skipped, reason: result.reason || result.error };
  }
  const raw = parseInt(result.stdout.trim(), 10);
  return { responsivenessValue: Number.isNaN(raw) ? null : raw };
}

/** Define o valor de SystemResponsiveness (percentual reservado para tarefas multimídia). */
async function setSystemResponsivenessValue(value, Logger) {
  const numericValue = Number.isInteger(value) ? value : SYSTEM_RESPONSIVENESS_OPTIMIZED_VALUE;
  const command =
    `New-Item -Path '${SYSTEM_PROFILE_REGISTRY_PATH}' -Force | Out-Null; ` +
    `New-ItemProperty -Path '${SYSTEM_PROFILE_REGISTRY_PATH}' -Name ${SYSTEM_RESPONSIVENESS_VALUE} -Value ${numericValue} -PropertyType DWord -Force | Out-Null`;

  const result = await runPowerShell(command);
  if (Logger) {
    if (result.success) Logger.info('networkTweaksManager', `SystemResponsiveness definido para ${numericValue}`);
    else Logger.warn('networkTweaksManager', 'Falha ao alterar SystemResponsiveness', { detail: result.error || result.reason });
  }
  return { responsivenessValue: numericValue, ...result };
}

/** Aplica o conjunto de ajustes de rede: desabilita o limite de banda do MMCSS
 * e reduz o SystemResponsiveness a 0, priorizando rede/jogos em primeiro plano. */
async function optimizeNetwork(Logger) {
  const throttlingResult = await setNetworkThrottlingDisabled(true, Logger);
  const responsivenessResult = await setSystemResponsivenessValue(SYSTEM_RESPONSIVENESS_OPTIMIZED_VALUE, Logger);

  const success = Boolean(throttlingResult.success) && Boolean(responsivenessResult.success);
  const skipped = Boolean(throttlingResult.skipped) && Boolean(responsivenessResult.skipped);

  return { success, skipped, networkThrottling: throttlingResult, systemResponsiveness: responsivenessResult };
}

/** Captura o estado atual (throttling + responsiveness) para permitir reversão exata. */
async function captureState() {
  const [networkThrottling, systemResponsiveness] = await Promise.all([
    getNetworkThrottlingState(),
    getSystemResponsivenessState()
  ]);
  return { networkThrottling, systemResponsiveness };
}

/** Restaura throttling e responsiveness a partir de um estado capturado anteriormente. */
async function restoreState(state, Logger) {
  if (!state) {
    return { success: false, skipped: true, reason: 'no-captured-state' };
  }

  const results = {};
  let anyAttempted = false;
  let anyFailed = false;

  if (state.networkThrottling && state.networkThrottling.throttlingDisabled !== null && state.networkThrottling.throttlingDisabled !== undefined) {
    anyAttempted = true;
    results.networkThrottling = await setNetworkThrottlingDisabled(state.networkThrottling.throttlingDisabled, Logger);
    if (!results.networkThrottling.success) anyFailed = true;
  }

  if (state.systemResponsiveness && state.systemResponsiveness.responsivenessValue !== null && state.systemResponsiveness.responsivenessValue !== undefined) {
    anyAttempted = true;
    results.systemResponsiveness = await setSystemResponsivenessValue(state.systemResponsiveness.responsivenessValue, Logger);
    if (!results.systemResponsiveness.success) anyFailed = true;
  }

  if (!anyAttempted) {
    return { success: false, skipped: true, reason: 'no-captured-state' };
  }

  return { success: !anyFailed, ...results };
}

module.exports = {
  SYSTEM_PROFILE_REGISTRY_PATH,
  NETWORK_THROTTLING_VALUE,
  NETWORK_THROTTLING_DISABLED_VALUE,
  NETWORK_THROTTLING_DEFAULT_VALUE,
  SYSTEM_RESPONSIVENESS_VALUE,
  SYSTEM_RESPONSIVENESS_OPTIMIZED_VALUE,
  SYSTEM_RESPONSIVENESS_DEFAULT_VALUE,
  getNetworkThrottlingState,
  setNetworkThrottlingDisabled,
  getSystemResponsivenessState,
  setSystemResponsivenessValue,
  optimizeNetwork,
  captureState,
  restoreState
};
