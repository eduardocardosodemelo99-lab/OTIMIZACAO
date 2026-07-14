jest.mock('../../../src/app/modules/windowsTweaks/components/networkTweaksManager');

const networkTweaksManager = require('../../../src/app/modules/windowsTweaks/components/networkTweaksManager');
const setNetworkTweaks = require('../../../src/app/modules/windowsTweaks/tweaks/setNetworkTweaks');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

afterEach(() => jest.clearAllMocks());

describe('setNetworkTweaks tweak', () => {
  test('expõe metadados id/name/description', () => {
    expect(setNetworkTweaks.id).toBe('network-tweaks');
    expect(setNetworkTweaks.name).toBe('Rede');
    expect(typeof setNetworkTweaks.description).toBe('string');
  });

  describe('apply', () => {
    test('delega para networkTweaksManager.optimizeNetwork e retorna success:true', async () => {
      networkTweaksManager.optimizeNetwork.mockResolvedValue({
        success: true,
        networkThrottling: { throttlingDisabled: true, success: true },
        systemResponsiveness: { responsivenessValue: 0, success: true }
      });
      const Logger = makeLogger();

      const result = await setNetworkTweaks.apply(Logger);

      expect(networkTweaksManager.optimizeNetwork).toHaveBeenCalledWith(Logger);
      expect(result).toMatchObject({ success: true });
    });

    test('propaga skipped quando não é Windows', async () => {
      networkTweaksManager.optimizeNetwork.mockResolvedValue({ success: false, skipped: true });

      const result = await setNetworkTweaks.apply(makeLogger());

      expect(result).toMatchObject({ success: false, skipped: true });
    });
  });

  describe('revert', () => {
    test('delega para networkTweaksManager.restoreState com o estado anterior informado em options', async () => {
      networkTweaksManager.restoreState.mockResolvedValue({ success: true });
      const Logger = makeLogger();
      const previousState = { networkThrottling: { throttlingDisabled: false }, systemResponsiveness: { responsivenessValue: 20 } };

      const result = await setNetworkTweaks.revert(Logger, { previousState });

      expect(networkTweaksManager.restoreState).toHaveBeenCalledWith(previousState, Logger);
      expect(result.success).toBe(true);
    });

    test('retorna skipped quando nenhum estado anterior foi informado', async () => {
      networkTweaksManager.restoreState.mockResolvedValue({ success: false, skipped: true, reason: 'no-captured-state' });

      const result = await setNetworkTweaks.revert(makeLogger(), {});

      expect(networkTweaksManager.restoreState).toHaveBeenCalledWith(undefined, expect.anything());
      expect(result).toMatchObject({ success: false, skipped: true });
    });
  });
});
