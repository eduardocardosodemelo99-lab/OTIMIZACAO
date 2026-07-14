jest.mock('../../../src/app/modules/windowsTweaks/components/powershellRunner');

const { runPowerShell } = require('../../../src/app/modules/windowsTweaks/components/powershellRunner');
const gameModeManager = require('../../../src/app/modules/windowsTweaks/components/gameModeManager');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

afterEach(() => jest.clearAllMocks());

describe('gameModeManager', () => {
  describe('getGameModeState', () => {
    test('retorna enabled:true quando o valor do registro é 1', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '1\n', stderr: '' });

      const result = await gameModeManager.getGameModeState();

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('Get-ItemPropertyValue'));
      expect(result).toEqual({ enabled: true });
    });

    test('retorna enabled:false quando o valor do registro é 0', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '0\n', stderr: '' });

      const result = await gameModeManager.getGameModeState();

      expect(result).toEqual({ enabled: false });
    });

    test('retorna enabled:null quando a chave ainda não existe', async () => {
      runPowerShell.mockResolvedValue({ success: false, error: 'Property AutoGameModeEnabled does not exist', stdout: '', stderr: '' });

      const result = await gameModeManager.getGameModeState();

      expect(result.enabled).toBeNull();
    });

    test('propaga skipped quando não é Windows', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await gameModeManager.getGameModeState();

      expect(result).toMatchObject({ enabled: null, skipped: true, reason: 'not-windows' });
    });
  });

  describe('setGameModeEnabled', () => {
    test('cria/atualiza a chave de registro com valor 1 ao ativar', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await gameModeManager.setGameModeEnabled(true, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 1'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('HKCU:\\Software\\Microsoft\\GameBar'));
      expect(result).toMatchObject({ enabled: true, success: true });
      expect(Logger.info).toHaveBeenCalled();
    });

    test('grava valor 0 ao desativar e loga warn em caso de falha', async () => {
      runPowerShell.mockResolvedValue({ success: false, error: 'access denied', stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await gameModeManager.setGameModeEnabled(false, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 0'));
      expect(result.success).toBe(false);
      expect(Logger.warn).toHaveBeenCalled();
    });
  });

  describe('captureState / restoreState', () => {
    test('captureState retorna o estado atual do Game Mode', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '0\n', stderr: '' });

      const state = await gameModeManager.captureState();

      expect(state).toEqual({ enabled: false });
    });

    test('restoreState reaplica o valor capturado anteriormente', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });

      const result = await gameModeManager.restoreState({ enabled: true }, makeLogger());

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 1'));
      expect(result.success).toBe(true);
    });

    test('restoreState não faz nada quando não há estado capturado (enabled null)', async () => {
      const result = await gameModeManager.restoreState({ enabled: null }, makeLogger());
      expect(result).toMatchObject({ success: false, skipped: true, reason: 'no-captured-state' });
      expect(runPowerShell).not.toHaveBeenCalled();
    });

    test('restoreState não faz nada quando o estado é null/undefined', async () => {
      const result = await gameModeManager.restoreState(null, makeLogger());
      expect(result).toMatchObject({ success: false, skipped: true, reason: 'no-captured-state' });
      expect(runPowerShell).not.toHaveBeenCalled();
    });
  });
});
