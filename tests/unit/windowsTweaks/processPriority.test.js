jest.mock('../../../src/app/modules/windowsTweaks/components/powershellRunner');

const { runPowerShell } = require('../../../src/app/modules/windowsTweaks/components/powershellRunner');
const processPriority = require('../../../src/app/modules/windowsTweaks/components/processPriority');

describe('windowsTweaks/components/processPriority', () => {
  afterEach(() => jest.clearAllMocks());

  test('normalizeProcessName remove a extensão .exe', () => {
    expect(processPriority.normalizeProcessName('cs2.exe')).toBe('cs2');
    expect(processPriority.normalizeProcessName('cs2')).toBe('cs2');
    expect(processPriority.normalizeProcessName('CS2.EXE')).toBe('CS2');
  });

  test('isValidPriority aceita apenas os níveis conhecidos', () => {
    expect(processPriority.isValidPriority('High')).toBe(true);
    expect(processPriority.isValidPriority('Turbo')).toBe(false);
  });

  test('setProcessPriority rejeita prioridade inválida sem chamar o PowerShell', async () => {
    const result = await processPriority.setProcessPriority('cs2', 'Turbo');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Prioridade inválida/);
    expect(runPowerShell).not.toHaveBeenCalled();
  });

  test('setProcessPriority chama o PowerShell com o nome normalizado e a prioridade pedida', async () => {
    runPowerShell.mockResolvedValue({ success: true, skipped: false });
    const Logger = { info: jest.fn(), warn: jest.fn() };

    const result = await processPriority.setProcessPriority('cs2.exe', 'High', Logger);

    expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining("Get-Process -Name 'cs2'"));
    expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining("PriorityClass = 'High'"));
    expect(result).toMatchObject({ name: 'cs2', priority: 'High', success: true });
    expect(Logger.info).toHaveBeenCalled();
  });

  test('setProcessPriority loga aviso quando o processo não é encontrado', async () => {
    runPowerShell.mockResolvedValue({ success: false, skipped: false, error: 'Cannot find a process' });
    const Logger = { info: jest.fn(), warn: jest.fn() };

    const result = await processPriority.setProcessPriority('cs2', 'High', Logger);

    expect(result.success).toBe(false);
    expect(Logger.warn).toHaveBeenCalled();
  });

  test('getProcessPriority retorna null quando a consulta falha (ex.: processo não existe)', async () => {
    runPowerShell.mockResolvedValue({ success: false, skipped: false, error: 'not found' });

    const result = await processPriority.getProcessPriority('cs2');

    expect(result.priority).toBeNull();
  });
});
