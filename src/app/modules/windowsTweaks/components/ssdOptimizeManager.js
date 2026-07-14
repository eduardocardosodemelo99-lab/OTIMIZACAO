/**
 * Componente reutilizável: SSD Optimize Manager
 * Ajusta duas configurações reais relacionadas a desempenho de SSD:
 *   1. TRIM automático (DisableDeleteNotify) — garante que o Windows envie
 *      notificações TRIM ao SSD (habilitado = melhor desempenho/vida útil).
 *   2. Indexação de busca do Windows Search no volume do sistema (C:) — ao
 *      desabilitar, reduz I/O de fundo desnecessário em SSDs.
 * Ambas as alterações são capturadas antes de aplicar, permitindo reversão
 * exata do estado anterior.
 */

const { runPowerShell } = require('./powershellRunner');

const SYSTEM_VOLUME = 'C:';

/** Consulta o estado atual do TRIM automático via `fsutil behavior query DisableDeleteNotify`.
 * Retorna trimEnabled:true quando DisableDeleteNotify = 0 (TRIM habilitado). */
async function getTrimState() {
  const result = await runPowerShell('fsutil behavior query DisableDeleteNotify');
  if (!result.success) {
    return { trimEnabled: null, skipped: result.skipped, reason: result.reason || result.error };
  }
  const match = /DisableDeleteNotify\s*=\s*(\d)/i.exec(result.stdout);
  if (!match) {
    return { trimEnabled: null, skipped: false, reason: 'unexpected-output' };
  }
  return { trimEnabled: match[1] === '0' };
}

/** Habilita ou desabilita o TRIM automático via `fsutil behavior set DisableDeleteNotify`. */
async function setTrimEnabled(enabled, Logger) {
  const flagValue = enabled ? 0 : 1;
  const result = await runPowerShell(`fsutil behavior set DisableDeleteNotify ${flagValue}`);
  if (Logger) {
    if (result.success) Logger.info('ssdOptimizeManager', `TRIM automático ${enabled ? 'habilitado' : 'desabilitado'}`);
    else Logger.warn('ssdOptimizeManager', 'Falha ao alterar TRIM automático', { detail: result.error || result.reason });
  }
  return { trimEnabled: enabled, ...result };
}

/** Consulta o estado atual da indexação de busca no volume do sistema via `Get-WmiObject Win32_Volume`. */
async function getIndexingState(drive = SYSTEM_VOLUME) {
  const result = await runPowerShell(
    `(Get-WmiObject Win32_Volume -Filter "DriveLetter='${drive}'").IndexingEnabled`
  );
  if (!result.success) {
    return { indexingEnabled: null, skipped: result.skipped, reason: result.reason || result.error };
  }
  const raw = result.stdout.trim();
  if (raw === '') {
    return { indexingEnabled: null, skipped: false, reason: 'volume-not-found' };
  }
  return { indexingEnabled: /true/i.test(raw) };
}

/** Habilita ou desabilita a indexação de busca no volume informado via WMI. */
async function setIndexingEnabled(enabled, Logger, drive = SYSTEM_VOLUME) {
  const boolLiteral = enabled ? '$true' : '$false';
  const command =
    `$vol = Get-WmiObject Win32_Volume -Filter "DriveLetter='${drive}'"; ` +
    `$vol.IndexingEnabled = ${boolLiteral}; ` +
    '$vol.Put() | Out-Null';

  const result = await runPowerShell(command);
  if (Logger) {
    if (result.success) Logger.info('ssdOptimizeManager', `Indexação de busca ${enabled ? 'habilitada' : 'desabilitada'} em ${drive}`);
    else Logger.warn('ssdOptimizeManager', 'Falha ao alterar indexação de busca', { detail: result.error || result.reason });
  }
  return { indexingEnabled: enabled, ...result };
}

/** Aplica a otimização completa: garante TRIM habilitado e desabilita a
 * indexação de busca no volume do sistema, para reduzir I/O de fundo. */
async function optimizeForSsd(Logger, drive = SYSTEM_VOLUME) {
  const trimResult = await setTrimEnabled(true, Logger);
  const indexingResult = await setIndexingEnabled(false, Logger, drive);

  const success = Boolean(trimResult.success) && Boolean(indexingResult.success);
  const skipped = Boolean(trimResult.skipped) && Boolean(indexingResult.skipped);

  return { success, skipped, trim: trimResult, indexing: indexingResult };
}

/** Captura o estado atual (TRIM + indexação) para permitir reversão exata. */
async function captureState(drive = SYSTEM_VOLUME) {
  const [trim, indexing] = await Promise.all([getTrimState(), getIndexingState(drive)]);
  return { trim, indexing, drive };
}

/** Restaura TRIM e indexação a partir de um estado capturado anteriormente. */
async function restoreState(state, Logger) {
  if (!state) {
    return { success: false, skipped: true, reason: 'no-captured-state' };
  }

  const drive = state.drive || SYSTEM_VOLUME;
  const results = {};
  let anyAttempted = false;
  let anyFailed = false;

  if (state.trim && state.trim.trimEnabled !== null && state.trim.trimEnabled !== undefined) {
    anyAttempted = true;
    results.trim = await setTrimEnabled(state.trim.trimEnabled, Logger);
    if (!results.trim.success) anyFailed = true;
  }

  if (state.indexing && state.indexing.indexingEnabled !== null && state.indexing.indexingEnabled !== undefined) {
    anyAttempted = true;
    results.indexing = await setIndexingEnabled(state.indexing.indexingEnabled, Logger, drive);
    if (!results.indexing.success) anyFailed = true;
  }

  if (!anyAttempted) {
    return { success: false, skipped: true, reason: 'no-captured-state' };
  }

  return { success: !anyFailed, ...results };
}

module.exports = {
  SYSTEM_VOLUME,
  getTrimState,
  setTrimEnabled,
  getIndexingState,
  setIndexingEnabled,
  optimizeForSsd,
  captureState,
  restoreState
};
