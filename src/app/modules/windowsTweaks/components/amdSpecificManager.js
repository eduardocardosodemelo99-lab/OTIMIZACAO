/**
 * Componente reutilizável: AMD Specific Manager
 * Ajustes reais orientados a sistemas com CPU/GPU AMD, focados em reduzir
 * throttling e aumentar a prioridade dada à GPU durante jogos:
 *   1. Power Throttling (PowerThrottlingOff) — desabilita o controle
 *      adaptativo de energia do Windows, que em notebooks/desktops com
 *      APUs/GPUs AMD frequentemente restringe o desempenho de processos em
 *      segundo plano e pode reduzir clocks durante jogos.
 *   2. Hardware-Accelerated GPU Scheduling (HwSchMode) — delega o
 *      agendamento de memória de vídeo diretamente à GPU, reduzindo latência
 *      de entrada/quadro em GPUs AMD compatíveis (RX 5000+).
 * Ambas as alterações são capturadas antes de aplicar, permitindo reversão
 * exata do estado anterior.
 */

const { runPowerShell } = require('./powershellRunner');

const POWER_THROTTLING_REGISTRY_PATH =
  'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling';
const POWER_THROTTLING_VALUE = 'PowerThrottlingOff';

const GRAPHICS_DRIVERS_REGISTRY_PATH =
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm';
const HW_SCHEDULING_REGISTRY_PATH =
  'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers';
const HW_SCHEDULING_VALUE = 'HwSchMode';

/** Consulta se o Power Throttling está desabilitado (PowerThrottlingOff = 1). */
async function getPowerThrottlingState() {
  const result = await runPowerShell(
    `Get-ItemPropertyValue -Path '${POWER_THROTTLING_REGISTRY_PATH}' -Name ${POWER_THROTTLING_VALUE} -ErrorAction Stop`
  );
  if (!result.success) {
    return { throttlingDisabled: null, skipped: result.skipped, reason: result.reason || result.error };
  }
  const raw = result.stdout.trim();
  return { throttlingDisabled: raw === '1' };
}

/** Habilita ou desabilita o Power Throttling global do Windows. */
async function setPowerThrottlingDisabled(disabled, Logger) {
  const value = disabled ? 1 : 0;
  const command =
    `New-Item -Path '${POWER_THROTTLING_REGISTRY_PATH}' -Force | Out-Null; ` +
    `New-ItemProperty -Path '${POWER_THROTTLING_REGISTRY_PATH}' -Name ${POWER_THROTTLING_VALUE} -Value ${value} -PropertyType DWord -Force | Out-Null`;

  const result = await runPowerShell(command);
  if (Logger) {
    if (result.success) Logger.info('amdSpecificManager', `Power Throttling ${disabled ? 'desabilitado' : 'habilitado'}`);
    else Logger.warn('amdSpecificManager', 'Falha ao alterar Power Throttling', { detail: result.error || result.reason });
  }
  return { throttlingDisabled: disabled, ...result };
}

/** Consulta o modo atual de Hardware-Accelerated GPU Scheduling (2 = habilitado). */
async function getHwSchedulingState() {
  const result = await runPowerShell(
    `Get-ItemPropertyValue -Path '${HW_SCHEDULING_REGISTRY_PATH}' -Name ${HW_SCHEDULING_VALUE} -ErrorAction Stop`
  );
  if (!result.success) {
    return { hwSchedulingEnabled: null, skipped: result.skipped, reason: result.reason || result.error };
  }
  const raw = result.stdout.trim();
  return { hwSchedulingEnabled: raw === '2' };
}

/** Habilita ou desabilita o Hardware-Accelerated GPU Scheduling. Requer reinício para ter efeito. */
async function setHwSchedulingEnabled(enabled, Logger) {
  const value = enabled ? 2 : 1;
  const command =
    `New-Item -Path '${HW_SCHEDULING_REGISTRY_PATH}' -Force | Out-Null; ` +
    `New-ItemProperty -Path '${HW_SCHEDULING_REGISTRY_PATH}' -Name ${HW_SCHEDULING_VALUE} -Value ${value} -PropertyType DWord -Force | Out-Null`;

  const result = await runPowerShell(command);
  if (Logger) {
    if (result.success) Logger.info('amdSpecificManager', `Hardware-Accelerated GPU Scheduling ${enabled ? 'habilitado' : 'desabilitado'} (requer reinício)`);
    else Logger.warn('amdSpecificManager', 'Falha ao alterar Hardware-Accelerated GPU Scheduling', { detail: result.error || result.reason });
  }
  return { hwSchedulingEnabled: enabled, ...result };
}

/** Aplica o conjunto de ajustes AMD Specific: desabilita Power Throttling e
 * habilita o agendamento de GPU por hardware. */
async function optimizeAmdSpecific(Logger) {
  const throttlingResult = await setPowerThrottlingDisabled(true, Logger);
  const hwSchedulingResult = await setHwSchedulingEnabled(true, Logger);

  const success = Boolean(throttlingResult.success) && Boolean(hwSchedulingResult.success);
  const skipped = Boolean(throttlingResult.skipped) && Boolean(hwSchedulingResult.skipped);

  return { success, skipped, powerThrottling: throttlingResult, hwScheduling: hwSchedulingResult };
}

/** Captura o estado atual (throttling + hw scheduling) para permitir reversão exata. */
async function captureState() {
  const [powerThrottling, hwScheduling] = await Promise.all([getPowerThrottlingState(), getHwSchedulingState()]);
  return { powerThrottling, hwScheduling };
}

/** Restaura throttling e agendamento de GPU a partir de um estado capturado anteriormente. */
async function restoreState(state, Logger) {
  if (!state) {
    return { success: false, skipped: true, reason: 'no-captured-state' };
  }

  const results = {};
  let anyAttempted = false;
  let anyFailed = false;

  if (state.powerThrottling && state.powerThrottling.throttlingDisabled !== null && state.powerThrottling.throttlingDisabled !== undefined) {
    anyAttempted = true;
    results.powerThrottling = await setPowerThrottlingDisabled(state.powerThrottling.throttlingDisabled, Logger);
    if (!results.powerThrottling.success) anyFailed = true;
  }

  if (state.hwScheduling && state.hwScheduling.hwSchedulingEnabled !== null && state.hwScheduling.hwSchedulingEnabled !== undefined) {
    anyAttempted = true;
    results.hwScheduling = await setHwSchedulingEnabled(state.hwScheduling.hwSchedulingEnabled, Logger);
    if (!results.hwScheduling.success) anyFailed = true;
  }

  if (!anyAttempted) {
    return { success: false, skipped: true, reason: 'no-captured-state' };
  }

  return { success: !anyFailed, ...results };
}

module.exports = {
  POWER_THROTTLING_REGISTRY_PATH,
  POWER_THROTTLING_VALUE,
  GRAPHICS_DRIVERS_REGISTRY_PATH,
  HW_SCHEDULING_REGISTRY_PATH,
  HW_SCHEDULING_VALUE,
  getPowerThrottlingState,
  setPowerThrottlingDisabled,
  getHwSchedulingState,
  setHwSchedulingEnabled,
  optimizeAmdSpecific,
  captureState,
  restoreState
};
