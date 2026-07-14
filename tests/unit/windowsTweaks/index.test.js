jest.mock('../../../src/app/modules/windowsTweaks/tweaks/disableUnnecessaryServices');
jest.mock('../../../src/app/modules/windowsTweaks/tweaks/cleanSystemCache');
jest.mock('../../../src/app/modules/windowsTweaks/tweaks/boostProcessPriority');
jest.mock('../../../src/app/modules/windowsTweaks/tweaks/setPowerPlan');
jest.mock('../../../src/app/modules/windowsTweaks/tweaks/setGameMode');
jest.mock('../../../src/app/modules/windowsTweaks/tweaks/setSsdOptimize');
jest.mock('../../../src/app/modules/windowsTweaks/tweaks/setExplorerTweaks');
jest.mock('../../../src/app/modules/windowsTweaks/tweaks/setAmdSpecific');
jest.mock('../../../src/app/modules/backup');

const backup = require('../../../src/app/modules/backup');
backup.createSnapshot = jest.fn().mockResolvedValue({ success: true, id: 'backup-test-id' });

const disableUnnecessaryServices = require('../../../src/app/modules/windowsTweaks/tweaks/disableUnnecessaryServices');
const cleanSystemCache = require('../../../src/app/modules/windowsTweaks/tweaks/cleanSystemCache');
const boostProcessPriority = require('../../../src/app/modules/windowsTweaks/tweaks/boostProcessPriority');
const setPowerPlan = require('../../../src/app/modules/windowsTweaks/tweaks/setPowerPlan');
const setGameMode = require('../../../src/app/modules/windowsTweaks/tweaks/setGameMode');
const setSsdOptimize = require('../../../src/app/modules/windowsTweaks/tweaks/setSsdOptimize');
const setExplorerTweaks = require('../../../src/app/modules/windowsTweaks/tweaks/setExplorerTweaks');
const setAmdSpecific = require('../../../src/app/modules/windowsTweaks/tweaks/setAmdSpecific');

// jest.mock em módulos com apenas funções nomeadas (sem export default) não
// preserva id/name/description automaticamente — repõe os campos estáticos
// usados pelo index.js para montar AVAILABLE_TWEAKS.
disableUnnecessaryServices.id = 'disable-unnecessary-services';
disableUnnecessaryServices.name = 'Desabilitar Serviços Desnecessários';
disableUnnecessaryServices.description = 'desc';
cleanSystemCache.id = 'clean-system-cache';
cleanSystemCache.name = 'Limpar Cache do Sistema';
cleanSystemCache.description = 'desc';
boostProcessPriority.id = 'boost-process-priority';
boostProcessPriority.name = 'Aumentar Prioridade de Processo';
boostProcessPriority.description = 'desc';
setPowerPlan.id = 'power-plan';
setPowerPlan.name = 'Power Plan';
setPowerPlan.description = 'desc';
setGameMode.id = 'game-mode';
setGameMode.name = 'Game Mode';
setGameMode.description = 'desc';
setSsdOptimize.id = 'ssd-optimize';
setSsdOptimize.name = 'Otimização de SSD';
setSsdOptimize.description = 'desc';
setExplorerTweaks.id = 'explorer-tweaks';
setExplorerTweaks.name = 'Explorer';
setExplorerTweaks.description = 'desc';
setAmdSpecific.id = 'amd-specific';
setAmdSpecific.name = 'AMD Specific';
setAmdSpecific.description = 'desc';

const windowsTweaks = require('../../../src/app/modules/windowsTweaks');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

afterEach(() => jest.clearAllMocks());

describe('windowsTweaks/index', () => {
  test('AVAILABLE_TWEAKS inclui os tweaks legados e os implementados, sem ids duplicados', () => {
    const ids = windowsTweaks.AVAILABLE_TWEAKS.map((t) => t.id);
    expect(ids).toEqual(Array.from(new Set(ids)));
    expect(ids).toEqual(
      expect.arrayContaining([
        'network-tweaks',
        'amd-specific',
        'disable-unnecessary-services',
        'clean-system-cache',
        'boost-process-priority',
        'power-plan',
        'game-mode',
        'ssd-optimize',
        'explorer-tweaks'
      ])
    );
  });

  test('amd-specific agora é um tweak implementado, não mais legado', async () => {
    const status = await windowsTweaks.listStatus();
    const amdSpecific = status.find((s) => s.id === 'amd-specific');
    expect(amdSpecific.implemented).toBe(true);
  });

  test('applyTweak retorna erro para um tweak desconhecido', async () => {
    const result = await windowsTweaks.applyTweak('tweak-que-nao-existe', makeLogger());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/desconhecido/);
  });

  test('applyTweak delega para o tweak implementado correspondente', async () => {
    disableUnnecessaryServices.apply.mockResolvedValue({ success: true, disabledCount: 6 });
    const Logger = makeLogger();

    const result = await windowsTweaks.applyTweak('disable-unnecessary-services', Logger, { serviceNames: ['SysMain'] });

    expect(disableUnnecessaryServices.apply).toHaveBeenCalledWith(Logger, { serviceNames: ['SysMain'] });
    expect(result).toMatchObject({ tweakId: 'disable-unnecessary-services', success: true, disabledCount: 6, backupId: 'backup-test-id' });
    expect(result.appliedAt).toBeDefined();
    expect(backup.createSnapshot).toHaveBeenCalled();
  });

  test('applyTweak não cria snapshot de backup para clean-system-cache (não reversível)', async () => {
    cleanSystemCache.apply.mockResolvedValue({ success: true, totalFreedMB: 12 });
    const Logger = makeLogger();

    const result = await windowsTweaks.applyTweak('clean-system-cache', Logger, {});

    expect(backup.createSnapshot).not.toHaveBeenCalled();
    expect(result.backupId).toBeNull();
  });

  test('applyTweak em tweak legado (sem implementação real) retorna o comportamento TODO padrão', async () => {
    const result = await windowsTweaks.applyTweak('network-tweaks', makeLogger());
    expect(result).toMatchObject({ success: true, tweakId: 'network-tweaks' });
  });

  test('revertTweak delega para o tweak implementado correspondente', async () => {
    cleanSystemCache.revert.mockResolvedValue({ success: false, error: 'não é reversível' });
    const Logger = makeLogger();

    const result = await windowsTweaks.revertTweak('clean-system-cache', Logger);

    expect(cleanSystemCache.revert).toHaveBeenCalledWith(Logger, {});
    expect(result.success).toBe(false);
  });

  test('listStatus retorna todos os tweaks com applied:false', async () => {
    const status = await windowsTweaks.listStatus();
    expect(status.length).toBe(windowsTweaks.AVAILABLE_TWEAKS.length);
    status.forEach((s) => expect(s.applied).toBe(false));
  });

  test('listStatus marca implemented:true e reversible corretamente para os tweaks reais', async () => {
    const status = await windowsTweaks.listStatus();

    const services = status.find((s) => s.id === 'disable-unnecessary-services');
    expect(services.implemented).toBe(true);
    expect(services.reversible).toBe(true);

    const cache = status.find((s) => s.id === 'clean-system-cache');
    expect(cache.implemented).toBe(true);
    expect(cache.reversible).toBe(false);

    const priority = status.find((s) => s.id === 'boost-process-priority');
    expect(priority.implemented).toBe(true);
    expect(priority.reversible).toBe(true);

    const powerPlan = status.find((s) => s.id === 'power-plan');
    expect(powerPlan.implemented).toBe(true);
    expect(powerPlan.reversible).toBe(true);

    const legacy = status.find((s) => s.id === 'network-tweaks');
    expect(legacy.implemented).toBe(false);
    expect(legacy.reversible).toBe(false);

    const gameMode = status.find((s) => s.id === 'game-mode');
    expect(gameMode.implemented).toBe(true);
    expect(gameMode.reversible).toBe(true);

    const ssdOptimize = status.find((s) => s.id === 'ssd-optimize');
    expect(ssdOptimize.implemented).toBe(true);
    expect(ssdOptimize.reversible).toBe(true);

    const explorerTweaks = status.find((s) => s.id === 'explorer-tweaks');
    expect(explorerTweaks.implemented).toBe(true);
    expect(explorerTweaks.reversible).toBe(true);

    const amdSpecific = status.find((s) => s.id === 'amd-specific');
    expect(amdSpecific.implemented).toBe(true);
    expect(amdSpecific.reversible).toBe(true);
  });

  test('registerWindowsHandlers registra todos os canais IPC esperados', () => {
    const handlers = {};
    const ipcMain = { handle: jest.fn((channel, fn) => { handlers[channel] = fn; }) };
    const Logger = makeLogger();

    windowsTweaks.registerWindowsHandlers(ipcMain, Logger);

    expect(Object.keys(handlers)).toEqual(
      expect.arrayContaining([
        'windows:applyTweak',
        'windows:revertTweak',
        'windows:listStatus',
        'windows:getUnnecessaryServices',
        'windows:getCacheTargets',
        'windows:getPriorityLevels'
      ])
    );
  });

  test('handler windows:applyTweak loga warn quando o resultado não é bem-sucedido', async () => {
    boostProcessPriority.apply.mockResolvedValue({ success: false, error: 'processo não encontrado' });
    const handlers = {};
    const ipcMain = { handle: jest.fn((channel, fn) => { handlers[channel] = fn; }) };
    const Logger = makeLogger();
    windowsTweaks.registerWindowsHandlers(ipcMain, Logger);

    await handlers['windows:applyTweak']({}, 'boost-process-priority');

    expect(Logger.warn).toHaveBeenCalled();
  });
});
