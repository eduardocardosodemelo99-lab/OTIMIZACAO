jest.mock('../../../src/app/modules/windowsTweaks/components/explorerTweaksManager');

const explorerTweaksManager = require('../../../src/app/modules/windowsTweaks/components/explorerTweaksManager');
const setExplorerTweaks = require('../../../src/app/modules/windowsTweaks/tweaks/setExplorerTweaks');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

afterEach(() => jest.clearAllMocks());

describe('setExplorerTweaks tweak', () => {
  test('expõe metadados id/name/description', () => {
    expect(setExplorerTweaks.id).toBe('explorer-tweaks');
    expect(setExplorerTweaks.name).toBe('Explorer');
    expect(typeof setExplorerTweaks.description).toBe('string');
  });

  describe('apply', () => {
    test('delega para explorerTweaksManager.optimizeExplorer e retorna success:true', async () => {
      explorerTweaksManager.optimizeExplorer.mockResolvedValue({
        success: true,
        fileExtensions: { extensionsVisible: true, success: true },
        windowAnimations: { animationsEnabled: false, success: true }
      });
      const Logger = makeLogger();

      const result = await setExplorerTweaks.apply(Logger);

      expect(explorerTweaksManager.optimizeExplorer).toHaveBeenCalledWith(Logger);
      expect(result).toMatchObject({ success: true });
    });

    test('propaga skipped quando não é Windows', async () => {
      explorerTweaksManager.optimizeExplorer.mockResolvedValue({ success: false, skipped: true });

      const result = await setExplorerTweaks.apply(makeLogger());

      expect(result).toMatchObject({ success: false, skipped: true });
    });
  });

  describe('revert', () => {
    test('delega para explorerTweaksManager.restoreState com o estado anterior informado em options', async () => {
      explorerTweaksManager.restoreState.mockResolvedValue({ success: true });
      const Logger = makeLogger();
      const previousState = { fileExtensions: { extensionsVisible: false }, windowAnimations: { animationsEnabled: true } };

      const result = await setExplorerTweaks.revert(Logger, { previousState });

      expect(explorerTweaksManager.restoreState).toHaveBeenCalledWith(previousState, Logger);
      expect(result.success).toBe(true);
    });

    test('retorna skipped quando nenhum estado anterior foi informado', async () => {
      explorerTweaksManager.restoreState.mockResolvedValue({ success: false, skipped: true, reason: 'no-captured-state' });

      const result = await setExplorerTweaks.revert(makeLogger(), {});

      expect(explorerTweaksManager.restoreState).toHaveBeenCalledWith(undefined, expect.anything());
      expect(result).toMatchObject({ success: false, skipped: true });
    });
  });
});
