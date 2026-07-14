jest.mock('../../../src/app/modules/windowsTweaks/components/powershellRunner');

const { runPowerShell } = require('../../../src/app/modules/windowsTweaks/components/powershellRunner');
const amdSpecificManager = require('../../../src/app/modules/windowsTweaks/components/amdSpecificManager');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

afterEach(() => jest.clearAllMocks());

describe('amdSpecificManager', () => {
  describe('getPowerThrottlingState', () => {
    test('retorna throttlingDisabled:true quando PowerThrottlingOff = 1', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '1\n', stderr: '' });

      const result = await amdSpecificManager.getPowerThrottlingState();

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('Get-ItemPropertyValue'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('PowerThrottlingOff'));
      expect(result).toEqual({ throttlingDisabled: true });
    });

    test('retorna throttlingDisabled:false quando PowerThrottlingOff = 0', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '0\n', stderr: '' });

      const result = await amdSpecificManager.getPowerThrottlingState();

      expect(result).toEqual({ throttlingDisabled: false });
    });

    test('propaga skipped quando não é Windows', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await amdSpecificManager.getPowerThrottlingState();

      expect(result).toMatchObject({ throttlingDisabled: null, skipped: true, reason: 'not-windows' });
    });

    test('retorna throttlingDisabled:null quando a chave ainda não existe', async () => {
      runPowerShell.mockResolvedValue({ success: false, error: 'Property PowerThrottlingOff does not exist', stdout: '', stderr: '' });

      const result = await amdSpecificManager.getPowerThrottlingState();

      expect(result.throttlingDisabled).toBeNull();
    });
  });

  describe('setPowerThrottlingDisabled', () => {
    test('cria/atualiza a chave de registro com valor 1 ao desabilitar throttling', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await amdSpecificManager.setPowerThrottlingDisabled(true, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 1'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('Control\\Power\\PowerThrottling'));
      expect(result).toMatchObject({ throttlingDisabled: true, success: true });
      expect(Logger.info).toHaveBeenCalled();
    });

    test('grava valor 0 ao habilitar throttling e loga warn em caso de falha', async () => {
      runPowerShell.mockResolvedValue({ success: false, error: 'access denied', stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await amdSpecificManager.setPowerThrottlingDisabled(false, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 0'));
      expect(result.success).toBe(false);
      expect(Logger.warn).toHaveBeenCalled();
    });
  });

  describe('getHwSchedulingState', () => {
    test('retorna hwSchedulingEnabled:true quando HwSchMode = 2', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '2\n', stderr: '' });

      const result = await amdSpecificManager.getHwSchedulingState();

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('HwSchMode'));
      expect(result).toEqual({ hwSchedulingEnabled: true });
    });

    test('retorna hwSchedulingEnabled:false quando HwSchMode = 1', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '1\n', stderr: '' });

      const result = await amdSpecificManager.getHwSchedulingState();

      expect(result).toEqual({ hwSchedulingEnabled: false });
    });

    test('propaga skipped quando não é Windows', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await amdSpecificManager.getHwSchedulingState();

      expect(result).toMatchObject({ hwSchedulingEnabled: null, skipped: true, reason: 'not-windows' });
    });
  });

  describe('setHwSchedulingEnabled', () => {
    test('define HwSchMode=2 ao habilitar', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await amdSpecificManager.setHwSchedulingEnabled(true, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 2'));
      expect(result).toMatchObject({ hwSchedulingEnabled: true, success: true });
      expect(Logger.info).toHaveBeenCalled();
    });

    test('define HwSchMode=1 ao desabilitar e loga warn em falha', async () => {
      runPowerShell.mockResolvedValue({ success: false, error: 'access denied', stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await amdSpecificManager.setHwSchedulingEnabled(false, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 1'));
      expect(result.success).toBe(false);
      expect(Logger.warn).toHaveBeenCalled();
    });
  });

  describe('optimizeAmdSpecific', () => {
    test('desabilita throttling e habilita hw scheduling, retornando sucesso quando ambos funcionam', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await amdSpecificManager.optimizeAmdSpecific(Logger);

      expect(result.success).toBe(true);
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('PowerThrottlingOff'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('HwSchMode'));
    });

    test('retorna sucesso:false quando alguma das duas operações falha', async () => {
      runPowerShell
        .mockResolvedValueOnce({ success: true, stdout: '', stderr: '' })
        .mockResolvedValueOnce({ success: false, error: 'falhou', stdout: '', stderr: '' });

      const result = await amdSpecificManager.optimizeAmdSpecific(makeLogger());

      expect(result.success).toBe(false);
    });

    test('retorna skipped:true quando ambas as operações são puladas (não-Windows)', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await amdSpecificManager.optimizeAmdSpecific(makeLogger());

      expect(result.skipped).toBe(true);
    });
  });

  describe('captureState / restoreState', () => {
    test('captureState retorna o estado atual de throttling e hw scheduling', async () => {
      runPowerShell
        .mockResolvedValueOnce({ success: true, stdout: '0\n', stderr: '' })
        .mockResolvedValueOnce({ success: true, stdout: '1\n', stderr: '' });

      const state = await amdSpecificManager.captureState();

      expect(state).toEqual({ powerThrottling: { throttlingDisabled: false }, hwScheduling: { hwSchedulingEnabled: false } });
    });

    test('restoreState reaplica throttling e hw scheduling a partir do estado capturado', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });

      const result = await amdSpecificManager.restoreState(
        { powerThrottling: { throttlingDisabled: false }, hwScheduling: { hwSchedulingEnabled: true } },
        makeLogger()
      );

      expect(result.success).toBe(true);
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 0'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 2'));
    });

    test('restoreState não faz nada quando o estado é null/undefined', async () => {
      const result = await amdSpecificManager.restoreState(null, makeLogger());
      expect(result).toMatchObject({ success: false, skipped: true, reason: 'no-captured-state' });
      expect(runPowerShell).not.toHaveBeenCalled();
    });

    test('restoreState não faz nada quando o estado capturado não tem throttling nem hw scheduling definidos', async () => {
      const result = await amdSpecificManager.restoreState({}, makeLogger());
      expect(result).toMatchObject({ success: false, skipped: true, reason: 'no-captured-state' });
      expect(runPowerShell).not.toHaveBeenCalled();
    });

    test('restoreState restaura apenas o throttling quando o hw scheduling não foi capturado (null)', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });

      const result = await amdSpecificManager.restoreState(
        { powerThrottling: { throttlingDisabled: true }, hwScheduling: { hwSchedulingEnabled: null } },
        makeLogger()
      );

      expect(result.success).toBe(true);
      expect(runPowerShell).toHaveBeenCalledTimes(1);
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 1'));
    });
  });
});
