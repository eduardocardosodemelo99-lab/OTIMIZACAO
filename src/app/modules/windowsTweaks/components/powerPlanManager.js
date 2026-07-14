/**
 * Componente reutilizável: Power Plan Manager
 * Detecta os planos de energia disponíveis via `powercfg /list`, identifica
 * o plano ativo e permite alternar para "Ultimate Performance" (se presente
 * no sistema) ou "High Performance" (fallback universal), sempre com
 * captura/restauração do estado anterior para reversão exata.
 */

const { runPowerShell } = require('./powershellRunner');

// GUIDs padrão do Windows para os planos relevantes de desempenho.
const HIGH_PERFORMANCE_GUID = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
// GUID padrão do plano oculto "Ultimate Performance" (precisa ser
// duplicado/ativado antes de existir na lista em muitas instalações).
const ULTIMATE_PERFORMANCE_GUID = 'e9a42b02-d5df-448d-aa00-03f14749eb61';

/**
 * Executa `powercfg /list` e retorna a lista de planos de energia
 * disponíveis (GUID, nome, se é o ativo).
 */
async function listPowerPlans() {
  const result = await runPowerShell('powercfg /list');
  if (!result.success) {
    return { success: false, plans: [], skipped: result.skipped, reason: result.reason || result.error };
  }

  const plans = [];
  const lineRegex = /Power Scheme GUID:\s*([0-9a-fA-F-]{36})\s*\(([^)]*)\)(\s*\*)?/g;
  let match = lineRegex.exec(result.stdout);
  while (match) {
    plans.push({ guid: match[1], name: match[2].trim(), active: Boolean(match[3]) });
    match = lineRegex.exec(result.stdout);
  }

  return { success: true, plans };
}

/** Retorna o plano de energia atualmente ativo, ou null se não detectado. */
async function getActivePowerPlan() {
  const { success, plans, skipped, reason } = await listPowerPlans();
  if (!success) {
    return { guid: null, name: null, skipped, reason };
  }
  const active = plans.find((p) => p.active);
  return active ? { guid: active.guid, name: active.name } : { guid: null, name: null };
}

/** Verifica se o plano "Ultimate Performance" já está visível na lista. */
function findUltimatePlan(plans) {
  return plans.find(
    (p) => p.guid.toLowerCase() === ULTIMATE_PERFORMANCE_GUID.toLowerCase() || /ultimate performance/i.test(p.name)
  );
}

function findHighPerformancePlan(plans) {
  return plans.find(
    (p) => p.guid.toLowerCase() === HIGH_PERFORMANCE_GUID.toLowerCase() || /high performance|alto desempenho/i.test(p.name)
  );
}

/**
 * Ativa o melhor plano de desempenho disponível: tenta "Ultimate
 * Performance" primeiro (duplicando-o a partir do plano oculto padrão caso
 * ainda não exista na lista) e cai para "High Performance" caso a
 * duplicação não seja suportada (ex.: edições Home do Windows).
 */
async function setBestPerformancePlan(Logger) {
  const listResult = await listPowerPlans();
  if (!listResult.success) {
    return { success: false, skipped: listResult.skipped, reason: listResult.reason };
  }

  let ultimate = findUltimatePlan(listResult.plans);
  if (!ultimate) {
    // Duplica o plano oculto Ultimate Performance para torná-lo selecionável.
    const dup = await runPowerShell(`powercfg -duplicatescheme ${ULTIMATE_PERFORMANCE_GUID}`);
    if (dup.success) {
      const dupMatch = /([0-9a-fA-F-]{36})/.exec(dup.stdout);
      if (dupMatch) ultimate = { guid: dupMatch[1], name: 'Ultimate Performance' };
    }
  }

  const target = ultimate || findHighPerformancePlan(listResult.plans);
  if (!target) {
    if (Logger) Logger.warn('powerPlanManager', 'Nenhum plano de alto desempenho disponível para ativar');
    return { success: false, error: 'Nenhum plano de alto desempenho disponível (Ultimate/High Performance)' };
  }

  const setResult = await runPowerShell(`powercfg /setactive ${target.guid}`);
  if (Logger) {
    if (setResult.success) Logger.info('powerPlanManager', `Plano de energia ativado: ${target.name} (${target.guid})`);
    else Logger.warn('powerPlanManager', `Falha ao ativar plano de energia ${target.name}`, { detail: setResult.error || setResult.reason });
  }

  return { name: target.name, guid: target.guid, ...setResult };
}

/** Ativa um plano de energia específico a partir do GUID (usado para
 * restaurar exatamente o plano que estava ativo antes do tweak). */
async function setActivePlan(guid, Logger) {
  if (!guid) {
    return { success: false, skipped: true, reason: 'no-guid' };
  }
  const result = await runPowerShell(`powercfg /setactive ${guid}`);
  if (Logger) {
    if (result.success) Logger.info('powerPlanManager', `Plano de energia restaurado: ${guid}`);
    else Logger.warn('powerPlanManager', `Falha ao restaurar plano de energia ${guid}`, { detail: result.error || result.reason });
  }
  return { guid, ...result };
}

/** Captura o estado atual (plano ativo) para permitir reversão exata. */
async function captureState() {
  return getActivePowerPlan();
}

/** Restaura o plano de energia a partir de um estado capturado anteriormente. */
async function restoreState(state, Logger) {
  if (!state || !state.guid) {
    return { success: false, skipped: true, reason: 'no-captured-state' };
  }
  return setActivePlan(state.guid, Logger);
}

module.exports = {
  HIGH_PERFORMANCE_GUID,
  ULTIMATE_PERFORMANCE_GUID,
  listPowerPlans,
  getActivePowerPlan,
  setBestPerformancePlan,
  setActivePlan,
  captureState,
  restoreState
};
