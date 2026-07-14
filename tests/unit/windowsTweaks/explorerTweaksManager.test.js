jest.mock('../../../src/app/modules/windowsTweaks/components/powershellRunner');

const { runPowerShell } = require('../../../src/app/modules/windowsTweaks/components/powershellRunner');
const explorerTweaksManager = require('../../../src/app/modules/windowsTweaks/components/explorerTweaksManager');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

afterEach(() => jest.clearAllMocks());

describe('explorerTweaksManager', () => {
  describe('getFileExtensionsState', () => {
    test('retorna extensionsVisible:true quando HideFileExt = 0', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '0\n', stderr: '' });

      const result = await explorerTweaksManager.getFileExtensionsState();

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('Get-ItemPropertyValue'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('HideFileExt'));
      expect(result).toEqual({ extensionsVisible: true });
    });

    test('retorna extensionsVisible:false quando HideFileExt = 1', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '1\n', stderr: '' });

      const result = await explorerTweaksManager.getFileExtensionsState();

      expect(result).toEqual({ extensionsVisible: false });
    });

    test('propaga skipped quando não é Windows', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await explorerTweaksManager.getFileExtensionsState();

      expect(result).toMatchObject({ extensionsVisible: null, skipped: true, reason: 'not-windows' });
    });

    test('retorna extensionsVisible:null quando a chave ainda não existe', async () => {
      runPowerShell.mockResolvedValue({ success: false, error: 'Property HideFileExt does not exist', stdout: '', stderr: '' });

      const result = await explorerTweaksManager.getFileExtensionsState();

      expect(result.extensionsVisible).toBeNull();
    });
  });

  describe('setFileExtensionsVisible', () => {
    test('cria/atualiza a chave de registro com valor 0 ao exibir extensões', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await explorerTweaksManager.setFileExtensionsVisible(true, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 0'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('CurrentVersion\\Explorer\\Advanced'));
      expect(result).toMatchObject({ extensionsVisible: true, success: true });
      expect(Logger.info).toHaveBeenCalled();
    });

    test('grava valor 1 ao ocultar e loga warn em caso de falha', async () => {
      runPowerShell.mockResolvedValue({ success: false, error: 'access denied', stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await explorerTweaksManager.setFileExtensionsVisible(false, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 1'));
      expect(result.success).toBe(false);
      expect(Logger.warn).toHaveBeenCalled();
    });
  });

  describe('getWindowAnimationsState', () => {
    test('retorna animationsEnabled:true quando MinAnimate = 1', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '1\n', stderr: '' });

      const result = await explorerTweaksManager.getWindowAnimationsState();

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('MinAnimate'));
      expect(result).toEqual({ animationsEnabled: true });
    });

    test('retorna animationsEnabled:false quando MinAnimate = 0', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '0\n', stderr: '' });

      const result = await explorerTweaksManager.getWindowAnimationsState();

      expect(result).toEqual({ animationsEnabled: false });
    });

    test('propaga skipped quando não é Windows', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await explorerTweaksManager.getWindowAnimationsState();

      expect(result).toMatchObject({ animationsEnabled: null, skipped: true, reason: 'not-windows' });
    });
  });

  describe('setWindowAnimationsEnabled', () => {
    test('define MinAnimate=1 ao habilitar animações', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await explorerTweaksManager.setWindowAnimationsEnabled(true, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining("Value '1'"));
      expect(result).toMatchObject({ animationsEnabled: true, success: true });
      expect(Logger.info).toHaveBeenCalled();
    });

    test('define MinAnimate=0 ao desabilitar e loga warn em falha', async () => {
      runPowerShell.mockResolvedValue({ success: false, error: 'access denied', stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await explorerTweaksManager.setWindowAnimationsEnabled(false, Logger);

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining("Value '0'"));
      expect(result.success).toBe(false);
      expect(Logger.warn).toHaveBeenCalled();
    });
  });

  describe('optimizeExplorer', () => {
    test('exibe extensões e desabilita animações, retornando sucesso quando ambos funcionam', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });
      const Logger = makeLogger();

      const result = await explorerTweaksManager.optimizeExplorer(Logger);

      expect(result.success).toBe(true);
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 0'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining("Value '0'"));
    });

    test('retorna sucesso:false quando alguma das duas operações falha', async () => {
      runPowerShell
        .mockResolvedValueOnce({ success: true, stdout: '', stderr: '' })
        .mockResolvedValueOnce({ success: false, error: 'falhou', stdout: '', stderr: '' });

      const result = await explorerTweaksManager.optimizeExplorer(makeLogger());

      expect(result.success).toBe(false);
    });
  });

  describe('captureState / restoreState', () => {
    test('captureState retorna o estado atual de extensões e animações', async () => {
      runPowerShell
        .mockResolvedValueOnce({ success: true, stdout: '1\n', stderr: '' })
        .mockResolvedValueOnce({ success: true, stdout: '1\n', stderr: '' });

      const state = await explorerTweaksManager.captureState();

      expect(state).toEqual({ fileExtensions: { extensionsVisible: false }, windowAnimations: { animationsEnabled: true } });
    });

    test('restoreState reaplica extensões e animações a partir do estado capturado', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });

      const result = await explorerTweaksManager.restoreState(
        { fileExtensions: { extensionsVisible: false }, windowAnimations: { animationsEnabled: true } },
        makeLogger()
      );

      expect(result.success).toBe(true);
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 1'));
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining("Value '1'"));
    });

    test('restoreState não faz nada quando o estado é null/undefined', async () => {
      const result = await explorerTweaksManager.restoreState(null, makeLogger());
      expect(result).toMatchObject({ success: false, skipped: true, reason: 'no-captured-state' });
      expect(runPowerShell).not.toHaveBeenCalled();
    });

    test('restoreState não faz nada quando o estado capturado não tem extensões nem animações definidas', async () => {
      const result = await explorerTweaksManager.restoreState({}, makeLogger());
      expect(result).toMatchObject({ success: false, skipped: true, reason: 'no-captured-state' });
      expect(runPowerShell).not.toHaveBeenCalled();
    });

    test('restoreState restaura apenas as extensões quando as animações não foram capturadas (null)', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });

      const result = await explorerTweaksManager.restoreState(
        { fileExtensions: { extensionsVisible: true }, windowAnimations: { animationsEnabled: null } },
        makeLogger()
      );

      expect(result.success).toBe(true);
      expect(runPowerShell).toHaveBeenCalledTimes(1);
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('-Value 0'));
    });
  });
});
