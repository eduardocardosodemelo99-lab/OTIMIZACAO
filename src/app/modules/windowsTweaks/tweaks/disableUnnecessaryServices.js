/**
 * Tweak: Desabilitar Serviços Desnecessários
 * Usa o componente serviceManager para desligar serviços do Windows que
 * consomem recursos sem trazer benefício para jogos.
 */

const serviceManager = require('../components/serviceManager');

const id = 'disable-unnecessary-services';
const name = 'Desabilitar Serviços Desnecessários';
const description = 'Desabilita serviços do Windows que consomem recursos sem benefício para jogos (telemetria, indexação, geolocalização, etc.)';

async function apply(Logger, options = {}) {
  const outcome = await serviceManager.disableServices(options.serviceNames, Logger);
  const skipped = outcome.results.length > 0 && outcome.results.every((r) => r.skipped);
  return {
    success: skipped ? false : outcome.disabledCount === outcome.total,
    skipped,
    ...outcome
  };
}

async function revert(Logger, options = {}) {
  const outcome = await serviceManager.enableServices(options.serviceNames, Logger);
  const skipped = outcome.results.length > 0 && outcome.results.every((r) => r.skipped);
  return {
    success: skipped ? false : outcome.enabledCount === outcome.total,
    skipped,
    ...outcome
  };
}

module.exports = { id, name, description, apply, revert };
