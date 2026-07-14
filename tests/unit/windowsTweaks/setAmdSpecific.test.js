jest.mock('../../../src/app/modules/windowsTweaks/components/amdSpecificManager');

const amdSpecificManager = require('../../../src/app/modules/windowsTweaks/components/amdSpecificManager');
const setAmdSpecific = require('../../../src/app/modules/windowsTweaks/tweaks/setAmdSpecific');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

afterEach(() => jest.clearAllMocks());

describe('setAmdSpecific tweak', () => {
  test('expõe metadados id/name/description', () => {
    expect(setAmdSpecific.id).toBe('amd-specific');
    expect(setAmdSpecific.name).toBe('AMD Specific');
    expect(typeof setAmdSpecific.description).toBe('string');
  });

  describe('apply', () => {
    test('delega para amdSpecificManager.optimizeAmdSpecific e retorna success:true', async () => {
      amdSpecificManager.optimizeAmdSpecific.mockResolvedValue({
        success: true,
        powerThrottling: { throttlingDisabled: true, success: true },
        hwScheduling: { hwSchedulingEnabled: true, success: true }
      });
      const Logger = makeLogger();

      const result = await setAmdSpecific.apply(Logger);

      expect(amdSpecificManager.optimizeAmdSpecific).toHaveBeenCalledWith(Logger);
      expect(result).toMatchObject({ success: true });
    });

    test('propaga skipped quando não é Windows', async () => {
      amdSpecificManager.optimizeAmdSpecific.mockResolvedValue({ success: false, skipped: true });

      const result = await setAmdSpecific.apply(makeLogger());

      expect(result).toMatchObject({ success: false, skipped: true });
    });
  });

  describe('revert', () => {
    test('delega para amdSpecificManager.restoreState com o estado anterior informado em options', async () => {
      amdSpecificManager.restoreState.mockResolvedValue({ success: true });
      const Logger = makeLogger();
      const previousState = { powerThrottling: { throttlingDisabled: false }, hwScheduling: { hwSchedulingEnabled: false } };

      const result = await setAmdSpecific.revert(Logger, { previousState });

      expect(amdSpecificManager.restoreState).toHaveBeenCalledWith(previousState, Logger);
      expect(result.success).toBe(true);
    });

    test('retorna skipped quando nenhum estado anterior foi informado', async () => {
      amdSpecificManager.restoreState.mockResolvedValue({ success: false, skipped: true, reason: 'no-captured-state' });

      const result = await setAmdSpecific.revert(makeLogger(), {});

      expect(amdSpecificManager.restoreState).toHaveBeenCalledWith(undefined, expect.anything());
      expect(result).toMatchObject({ success: false, skipped: true });
    });
  });
});
