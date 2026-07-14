jest.mock('../../../src/app/modules/windowsTweaks/components/powershellRunner');

const { runPowerShell } = require('../../../src/app/modules/windowsTweaks/components/powershellRunner');
const networkTweaksManager = require('../../../src/app/modules/windowsTweaks/components/networkTweaksManager');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

afterEach(() => jest.clearAllMocks());

describe('networkTweaksManager', () => {
  describe('getNetworkThrottlingState', () => {
    test('retorna throttlingDisabled:true quando NetworkThrottlingIndex = 0xffffffff', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '4294967295\n', stderr: '' });

      const result = await networkTweaksManager.getNetworkThrottlingState();

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('Get-ItemPropertyValue'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('NetworkThrottlingIndex'));
      expect(result).toEqual({ throttlingDisabled: true });
    });

    test('retorna throttlingDisabled:false quando NetworkThrottlingIndex = 10 (padrão)', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '10\n', stderr: '' });

      const result = await networkTweaksManager.getNetworkThrottlingState();

      expect(result).toEqual({ throttlingDisabled: false });
    });

    test('propaga skipped quando não é Windows', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await networkTweaksManager.getNetworkThrottlingState();

      expect(result).toMatchObject({ throttlingDisabled: null, skipped: true, reason: 'not-windows' });
    });

    test('retorna throttlingDisabled:null quando a chave ainda não existe', async () => {
      runPowerShell.mockResolvedValue({ success: false, error: 'Property NetworkThrottlingIndex does not exist', stdout: '', stderr: '' });

      const result = await networkTweaksManager.getNetworkThrottlingState();

      expect(result.throttlingDisabled).toBeNull();
    });
  });

  describe('setNetworkThrottlingDisabled', () => {
    test('grava 4294967295 ao desabilitar o throttling', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await networkTweaksManager.setNetworkThrottlingDisabled(true, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 4294967295'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('Multimedia\\SystemProfile'));
      expect(result).toMatchObject({ throttlingDisabled: true, success: true });
      expect(Logger.info).toHaveBeenCalled();
    });

    test('grava valor padrão (10) ao habilitar o throttling e loga warn em falha', async () => {
      runPowerShell.mockResolvedValue({ success: false, error: 'access denied', stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await networkTweaksManager.setNetworkThrottlingDisabled(false, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 10'));
      expect(result.success).toBe(false);
      expect(Logger.warn).toHaveBeenCalled();
    });
  });

  describe('getSystemResponsivenessState', () => {
    test('retorna o valor numérico atual de SystemResponsiveness', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '20\n', stderr: '' });

      const result = await networkTweaksManager.getSystemResponsivenessState();

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('SystemResponsiveness'));
      expect(result).toEqual({ responsivenessValue: 20 });
    });

    test('retorna responsivenessValue:0 quando j\u00e1 est\u00e1 otimizado', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '0\n', stderr: '' });

      const result = await networkTweaksManager.getSystemResponsivenessState();

      expect(result).toEqual({ responsivenessValue: 0 });
    });

    test('propaga skipped quando não é Windows', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await networkTweaksManager.getSystemResponsivenessState();

      expect(result).toMatchObject({ responsivenessValue: null, skipped: true, reason: 'not-windows' });
    });
  });

  describe('setSystemResponsivenessValue', () => {
    test('grava o valor numérico informado', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await networkTweaksManager.setSystemResponsivenessValue(0, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 0'));
      expect(result).toMatchObject({ responsivenessValue: 0, success: true });
      expect(Logger.info).toHaveBeenCalled();
    });

    test('usa o valor otimizado (0) como fallback quando o valor informado não é um inteiro válido', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });

      const result = await networkTweaksManager.setSystemResponsivenessValue(null, makeLogger());

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 0'));
      expect(result.responsivenessValue).toBe(0);
    });

    test('loga warn em caso de falha', async () => {
      runPowerShell.mockResolvedValue({ success: false, error: 'access denied', stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await networkTweaksManager.setSystemResponsivenessValue(20, Logger);

      expect(result.success).toBe(false);
      expect(Logger.warn).toHaveBeenCalled();
    });
  });

  describe('optimizeNetwork', () => {
    test('desabilita throttling e zera responsiveness, retornando sucesso quando ambos funcionam', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await networkTweaksManager.optimizeNetwork(Logger);

      expect(result.success).toBe(true);
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('NetworkThrottlingIndex'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('SystemResponsiveness'));
    });

    test('retorna sucesso:false quando alguma das duas operações falha', async () => {
      runPowerShell
        .mockResolvedValueOnce({ success: true, stdout: '', stderr: '' })
        .mockResolvedValueOnce({ success: false, error: 'falhou', stdout: '', stderr: '' });

      const result = await networkTweaksManager.optimizeNetwork(makeLogger());

      expect(result.success).toBe(false);
    });

    test('retorna skipped:true quando ambas as operações são puladas (não-Windows)', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await networkTweaksManager.optimizeNetwork(makeLogger());

      expect(result.skipped).toBe(true);
    });
  });

  describe('captureState / restoreState', () => {
    test('captureState retorna o estado atual de throttling e responsiveness', async () => {
      runPowerShell
        .mockResolvedValueOnce({ success: true, stdout: '10\n', stderr: '' })
        .mockResolvedValueOnce({ success: true, stdout: '20\n', stderr: '' });

      const state = await networkTweaksManager.captureState();

      expect(state).toEqual({ networkThrottling: { throttlingDisabled: false }, systemResponsiveness: { responsivenessValue: 20 } });
    });

    test('restoreState reaplica throttling e responsiveness a partir do estado capturado', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });

      const result = await networkTweaksManager.restoreState(
        { networkThrottling: { throttlingDisabled: false }, systemResponsiveness: { responsivenessValue: 20 } },
        makeLogger()
      );

      expect(result.success).toBe(true);
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 10'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 20'));
    });

    test('restoreState não faz nada quando o estado é null/undefined', async () => {
      const result = await networkTweaksManager.restoreState(null, makeLogger());
      expect(result).toMatchObject({ success: false, skipped: true, reason: 'no-captured-state' });
      expect(runPowerShell).not.toHaveBeenCalled();
    });

    test('restoreState não faz nada quando o estado capturado não tem throttling nem responsiveness definidos', async () => {
      const result = await networkTweaksManager.restoreState({}, makeLogger());
      expect(result).toMatchObject({ success: false, skipped: true, reason: 'no-captured-state' });
      expect(runPowerShell).not.toHaveBeenCalled();
    });

    test('restoreState restaura apenas o throttling quando o responsiveness não foi capturado (null)', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });

      const result = await networkTweaksManager.restoreState(
        { networkThrottling: { throttlingDisabled: true }, systemResponsiveness: { responsivenessValue: null } },
        makeLogger()
      );

      expect(result.success).toBe(true);
      expect(runPowerShell).toHaveBeenCalledTimes(1);
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 4294967295'));
    });
  });
});
