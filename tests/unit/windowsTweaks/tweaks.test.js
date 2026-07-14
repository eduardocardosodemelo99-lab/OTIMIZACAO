jest.mock('../../../src/app/modules/windowsTweaks/components/serviceManager');
jest.mock('../../../src/app/modules/windowsTweaks/components/cacheCleaner');
jest.mock('../../../src/app/modules/windowsTweaks/components/processPriority');

const serviceManager = require('../../../src/app/modules/windowsTweaks/components/serviceManager');
const cacheCleaner = require('../../../src/app/modules/windowsTweaks/components/cacheCleaner');
const processPriority = require('../../../src/app/modules/windowsTweaks/components/processPriority');

const disableUnnecessaryServices = require('../../../src/app/modules/windowsTweaks/tweaks/disableUnnecessaryServices');
const cleanSystemCache = require('../../../src/app/modules/windowsTweaks/tweaks/cleanSystemCache');
const boostProcessPriority = require('../../../src/app/modules/windowsTweaks/tweaks/boostProcessPriority');

afterEach(() => jest.clearAllMocks());

describe('tweaks/disableUnnecessaryServices', () => {
  test('apply retorna success:true quando todos os serviços são desabilitados', async () => {
    serviceManager.disableServices.mockResolvedValue({
      results: [{ name: 'DiagTrack', success: true }],
      disabledCount: 1,
      total: 1
    });

    const result = await disableUnnecessaryServices.apply();

    expect(result.success).toBe(true);
    expect(serviceManager.disableServices).toHaveBeenCalledWith(undefined, undefined);
  });

  test('apply repassa a lista customizada de serviços vinda das options', async () => {
    serviceManager.disableServices.mockResolvedValue({ results: [], disabledCount: 0, total: 0 });

    await disableUnnecessaryServices.apply(undefined, { serviceNames: ['SysMain'] });

    expect(serviceManager.disableServices).toHaveBeenCalledWith(['SysMain'], undefined);
  });

  test('apply reporta skipped quando roda fora do Windows', async () => {
    serviceManager.disableServices.mockResolvedValue({
      results: [{ name: 'DiagTrack', success: false, skipped: true, reason: 'not-windows' }],
      disabledCount: 0,
      total: 1
    });

    const result = await disableUnnecessaryServices.apply();

    expect(result.skipped).toBe(true);
    expect(result.success).toBe(false);
  });

  test('revert reabilita os serviços via enableServices', async () => {
    serviceManager.enableServices.mockResolvedValue({
      results: [{ name: 'DiagTrack', success: true }],
      enabledCount: 1,
      total: 1
    });

    const result = await disableUnnecessaryServices.revert();

    expect(result.success).toBe(true);
    expect(serviceManager.enableServices).toHaveBeenCalled();
  });
});

describe('tweaks/cleanSystemCache', () => {
  test('apply delega para cacheCleaner.cleanCache e retorna success:true', async () => {
    cacheCleaner.cleanCache.mockResolvedValue({ results: [], totalFreedMB: 12.3, totalDeletedFiles: 42 });

    const result = await cleanSystemCache.apply();

    expect(result).toMatchObject({ success: true, totalFreedMB: 12.3, totalDeletedFiles: 42 });
  });

  test('revert retorna success:false pois a limpeza não é reversível', async () => {
    const result = await cleanSystemCache.revert();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/não é reversível/);
  });
});

describe('tweaks/boostProcessPriority', () => {
  test('apply usa o processo padrão (cs2) e prioridade High quando nada é informado', async () => {
    processPriority.setProcessPriority.mockResolvedValue({ success: true, name: 'cs2', priority: 'High' });

    const result = await boostProcessPriority.apply();

    expect(processPriority.setProcessPriority).toHaveBeenCalledWith('cs2', 'High', undefined);
    expect(result.success).toBe(true);
  });

  test('apply repassa processName e priority customizados', async () => {
    processPriority.setProcessPriority.mockResolvedValue({ success: true });

    await boostProcessPriority.apply(undefined, { processName: 'notepad', priority: 'AboveNormal' });

    expect(processPriority.setProcessPriority).toHaveBeenCalledWith('notepad', 'AboveNormal', undefined);
  });

  test('revert restaura a prioridade Normal', async () => {
    processPriority.setProcessPriority.mockResolvedValue({ success: true, priority: 'Normal' });

    const result = await boostProcessPriority.revert();

    expect(processPriority.setProcessPriority).toHaveBeenCalledWith('cs2', 'Normal', undefined);
    expect(result.success).toBe(true);
  });
});
