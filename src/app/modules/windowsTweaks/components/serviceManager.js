/**
 * Componente reutilizável: Service Manager
 * Desabilita/reabilita serviços do Windows que normalmente não trazem
 * benefício para jogos (telemetria, indexação, geolocalização, etc.).
 */

const { runPowerShell } = require('./powershellRunner');

const UNNECESSARY_SERVICES = [
  { name: 'DiagTrack', label: 'Diagnostics Tracking Service', description: 'Telemetria da Microsoft' },
  { name: 'dmwappushservice', label: 'WAP Push Message Routing', description: 'Roteamento de mensagens WAP, raramente necessário' },
  { name: 'MapsBroker', label: 'Downloaded Maps Manager', description: 'Gerenciador de mapas offline' },
  { name: 'lfsvc', label: 'Geolocation Service', description: 'Serviço de geolocalização' },
  { name: 'SysMain', label: 'Superfetch/SysMain', description: 'Pré-carregamento de apps; pode prejudicar SSDs e jogos' },
  { name: 'WSearch', label: 'Windows Search', description: 'Indexação de arquivos para busca' }
];

function defaultServiceNames() {
  return UNNECESSARY_SERVICES.map((s) => s.name);
}

async function getServiceStatus(serviceName) {
  const result = await runPowerShell(`Get-Service -Name '${serviceName}' | Select-Object -ExpandProperty Status`);
  if (!result.success) {
    return { name: serviceName, status: 'unknown', ...result };
  }
  return { name: serviceName, status: result.stdout.trim() || 'unknown' };
}

async function disableService(serviceName, Logger) {
  const result = await runPowerShell(
    `Set-Service -Name '${serviceName}' -StartupType Disabled; Stop-Service -Name '${serviceName}' -Force -ErrorAction SilentlyContinue`
  );
  if (Logger) {
    if (result.success) Logger.info('serviceManager', `Serviço desabilitado: ${serviceName}`);
    else Logger.warn('serviceManager', `Falha ao desabilitar serviço ${serviceName}`, { detail: result.error || result.reason });
  }
  return { name: serviceName, ...result };
}

async function enableService(serviceName, startupType = 'Manual', Logger) {
  const result = await runPowerShell(
    `Set-Service -Name '${serviceName}' -StartupType ${startupType}; Start-Service -Name '${serviceName}' -ErrorAction SilentlyContinue`
  );
  if (Logger) {
    if (result.success) Logger.info('serviceManager', `Serviço reabilitado: ${serviceName}`);
    else Logger.warn('serviceManager', `Falha ao reabilitar serviço ${serviceName}`, { detail: result.error || result.reason });
  }
  return { name: serviceName, ...result };
}

async function disableServices(serviceNames, Logger) {
  const targets = serviceNames && serviceNames.length ? serviceNames : defaultServiceNames();
  const results = [];
  for (const name of targets) {
    // Sequencial de propósito: evita disparar dezenas de processos powershell
    // simultâneos e mantém o log em ordem previsível.
    // eslint-disable-next-line no-await-in-loop
    results.push(await disableService(name, Logger));
  }
  return { results, disabledCount: results.filter((r) => r.success).length, total: targets.length };
}

async function enableServices(serviceNames, Logger) {
  const targets = serviceNames && serviceNames.length ? serviceNames : defaultServiceNames();
  const results = [];
  for (const name of targets) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await enableService(name, 'Manual', Logger));
  }
  return { results, enabledCount: results.filter((r) => r.success).length, total: targets.length };
}

module.exports = {
  UNNECESSARY_SERVICES,
  defaultServiceNames,
  getServiceStatus,
  disableService,
  enableService,
  disableServices,
  enableServices
};
