jest.mock('../../../src/app/modules/windowsTweaks/components/powershellRunner');

const { runPowerShell } = require('../../../src/app/modules/windowsTweaks/components/powershellRunner');
const ssdOptimizeManager = require('../../../src/app/modules/windowsTweaks/components/ssdOptimizeManager');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

afterEach(() => jest.clearAllMocks());

describe('ssdOptimizeManager', () => {
  describe('getTrimState', () => {
    test('retorna trimEnabled:true quando DisableDeleteNotify = 0', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: 'DisableDeleteNotify = 0\n', stderr: '' });

      const result = await ssdOptimizeManager.getTrimState();

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('fsutil behavior query DisableDeleteNotify'));
      expect(result).toEqual({ trimEnabled: true });
    });

    test('retorna trimEnabled:false quando DisableDeleteNotify = 1', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: 'DisableDeleteNotify = 1\n', stderr: '' });

      const result = await ssdOptimizeManager.getTrimState();

      expect(result).toEqual({ trimEnabled: false });
    });

    test('propaga skipped quando não é Windows', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await ssdOptimizeManager.getTrimState();

      expect(result).toMatchObject({ trimEnabled: null, skipped: true, reason: 'not-windows' });
    });

    test('retorna trimEnabled:null quando a saída não corresponde ao esperado', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: 'saída inesperada', stderr: '' });

      const result = await ssdOptimizeManager.getTrimState();

      expect(result).toMatchObject({ trimEnabled: null, reason: 'unexpected-output' });
    });
  });

  describe('setTrimEnabled', () => {
    test('habilita TRIM definindo DisableDeleteNotify=0', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await ssdOptimizeManager.setTrimEnabled(true, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('fsutil behavior set DisableDeleteNotify 0'));
      expect(result).toMatchObject({ trimEnabled: true, success: true });
      expect(Logger.info).toHaveBeenCalled();
    });

    test('desabilita TRIM definindo DisableDeleteNotify=1 e loga warn em falha', async () => {
      runPowerShell.mockResolvedValue({ success: false, error: 'access denied', stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await ssdOptimizeManager.setTrimEnabled(false, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('fsutil behavior set DisableDeleteNotify 1'));
      expect(result.success).toBe(false);
      expect(Logger.warn).toHaveBeenCalled();
    });
  });

  describe('getIndexingState', () => {
    test('retorna indexingEnabled:true quando WMI retorna True', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: 'True\n', stderr: '' });

      const result = await ssdOptimizeManager.getIndexingState();

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining("DriveLetter='C:'"));
      expect(result).toEqual({ indexingEnabled: true });
    });

    test('retorna indexingEnabled:false quando WMI retorna False', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: 'False\n', stderr: '' });

      const result = await ssdOptimizeManager.getIndexingState();

      expect(result).toEqual({ indexingEnabled: false });
    });

    test('retorna indexingEnabled:null quando o volume não é encontrado', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });

      const result = await ssdOptimizeManager.getIndexingState();

      expect(result).toMatchObject({ indexingEnabled: null, reason: 'volume-not-found' });
    });

    test('propaga skipped quando não é Windows', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await ssdOptimizeManager.getIndexingState();

      expect(result).toMatchObject({ indexingEnabled: null, skipped: true, reason: 'not-windows' });
    });
  });

  describe('setIndexingEnabled', () => {
    test('desabilita a indexação com $false via WMI', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await ssdOptimizeManager.setIndexingEnabled(false, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('$false'));
      expect(result).toMatchObject({ indexingEnabled: false, success: true });
      expect(Logger.info).toHaveBeenCalled();
    });

    test('habilita a indexação com $true via WMI e loga warn em falha', async () => {
      runPowerShell.mockResolvedValue({ success: false, error: 'volume not found', stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await ssdOptimizeManager.setIndexingEnabled(true, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('$true'));
      expect(result.success).toBe(false);
      expect(Logger.warn).toHaveBeenCalled();
    });
  });

  describe('optimizeForSsd', () => {
    test('habilita TRIM e desabilita indexação, retornando sucesso quando ambos funcionam', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await ssdOptimizeManager.optimizeForSsd(Logger);

      expect(result.success).toBe(true);
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('DisableDeleteNotify 0'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('$false'));
    });

    test('retorna sucesso:false quando alguma das duas operações falha', async () => {
      runPowerShell
        .mockResolvedValueOnce({ success: true, stdout: '', stderr: '' })
        .mockResolvedValueOnce({ success: false, error: 'falhou', stdout: '', stderr: '' });

      const result = await ssdOptimizeManager.optimizeForSsd(makeLogger());

      expect(result.success).toBe(false);
    });
  });

  describe('captureState / restoreState', () => {
    test('captureState retorna o estado atual de TRIM e indexação', async () => {
      runPowerShell
        .mockResolvedValueOnce({ success: true, stdout: 'DisableDeleteNotify = 0\n', stderr: '' })
        .mockResolvedValueOnce({ success: true, stdout: 'True\n', stderr: '' });

      const state = await ssdOptimizeManager.captureState();

      expect(state).toEqual({ trim: { trimEnabled: true }, indexing: { indexingEnabled: true }, drive: 'C:' });
    });

    test('restoreState reaplica TRIM e indexação a partir do estado capturado', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });

      const result = await ssdOptimizeManager.restoreState(
        { trim: { trimEnabled: false }, indexing: { indexingEnabled: true }, drive: 'C:' },
        makeLogger()
      );

      expect(result.success).toBe(true);
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('DisableDeleteNotify 1'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('$true'));
    });

    test('restoreState não faz nada quando o estado é null/undefined', async () => {
      const result = await ssdOptimizeManager.restoreState(null, makeLogger());
      expect(result).toMatchObject({ success: false, skipped: true, reason: 'no-captured-state' });
      expect(runPowerShell).not.toHaveBeenCalled();
    });

    test('restoreState não faz nada quando o estado capturado não tem trim nem indexing definidos', async () => {
      const result = await ssdOptimizeManager.restoreState({ drive: 'C:' }, makeLogger());
      expect(result).toMatchObject({ success: false, skipped: true, reason: 'no-captured-state' });
      expect(runPowerShell).not.toHaveBeenCalled();
    });

    test('restoreState restaura apenas o TRIM quando a indexação não foi capturada (null)', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });

      const result = await ssdOptimizeManager.restoreState(
        { trim: { trimEnabled: true }, indexing: { indexingEnabled: null }, drive: 'C:' },
        makeLogger()
      );

      expect(result.success).toBe(true);
      expect(runPowerShell).toHaveBeenCalledTimes(1);
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('DisableDeleteNotify 0'));
    });
  });
});
