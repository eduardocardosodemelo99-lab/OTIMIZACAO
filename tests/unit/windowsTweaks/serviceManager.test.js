jest.mock('../../../src/app/modules/windowsTweaks/components/powershellRunner');

const { runPowerShell } = require('../../../src/app/modules/windowsTweaks/components/powershellRunner');
const serviceManager = require('../../../src/app/modules/windowsTweaks/components/serviceManager');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

describe('windowsTweaks/components/serviceManager', () => {
  afterEach(() => jest.clearAllMocks());

  test('UNNECESSARY_SERVICES contém os serviços conhecidos, sem duplicados', () => {
    const names = serviceManager.UNNECESSARY_SERVICES.map((s) => s.name);
    expect(names).toEqual(Array.from(new Set(names)));
    expect(names).toEqual(expect.arrayContaining(['DiagTrack', 'SysMain', 'WSearch']));
  });

  test('disableService chama runPowerShell com Set-Service/Stop-Service e loga sucesso', async () => {
    runPowerShell.mockResolvedValue({ success: true, skipped: false, stdout: '', stderr: '' });
    const Logger = makeLogger();

    const result = await serviceManager.disableService('DiagTrack', Logger);

    expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining("Set-Service -Name 'DiagTrack' -StartupType Disabled"));
    expect(result).toMatchObject({ name: 'DiagTrack', success: true });
    expect(Logger.info).toHaveBeenCalled();
    expect(Logger.warn).not.toHaveBeenCalled();
  });

  test('disableService loga aviso quando a execução falha', async () => {
    runPowerShell.mockResolvedValue({ success: false, skipped: false, error: 'Access denied' });
    const Logger = makeLogger();

    const result = await serviceManager.disableService('DiagTrack', Logger);

    expect(result.success).toBe(false);
    expect(Logger.warn).toHaveBeenCalled();
  });

  test('disableServices sem lista usa os serviços padrão e agrega os resultados', async () => {
    runPowerShell.mockResolvedValue({ success: true, skipped: false });

    const outcome = await serviceManager.disableServices();

    expect(outcome.total).toBe(serviceManager.UNNECESSARY_SERVICES.length);
    expect(outcome.disabledCount).toBe(serviceManager.UNNECESSARY_SERVICES.length);
    expect(runPowerShell).toHaveBeenCalledTimes(serviceManager.UNNECESSARY_SERVICES.length);
  });

  test('disableServices com lista customizada só afeta os serviços informados', async () => {
    runPowerShell.mockResolvedValue({ success: true, skipped: false });

    const outcome = await serviceManager.disableServices(['SysMain']);

    expect(outcome.total).toBe(1);
    expect(runPowerShell).toHaveBeenCalledTimes(1);
    expect(outcome.results[0].name).toBe('SysMain');
  });

  test('enableServices reabilita com StartupType Manual', async () => {
    runPowerShell.mockResolvedValue({ success: true, skipped: false });

    await serviceManager.enableServices(['WSearch']);

    expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining("Set-Service -Name 'WSearch' -StartupType Manual"));
  });
});
