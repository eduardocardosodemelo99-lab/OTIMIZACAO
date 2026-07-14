jest.mock('../../../src/app/modules/windowsTweaks/components/ssdOptimizeManager');

const ssdOptimizeManager = require('../../../src/app/modules/windowsTweaks/components/ssdOptimizeManager');
const setSsdOptimize = require('../../../src/app/modules/windowsTweaks/tweaks/setSsdOptimize');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

afterEach(() => jest.clearAllMocks());

describe('setSsdOptimize tweak', () => {
  test('expõe metadados id/name/description', () => {
    expect(setSsdOptimize.id).toBe('ssd-optimize');
    expect(setSsdOptimize.name).toBe('Otimização de SSD');
    expect(typeof setSsdOptimize.description).toBe('string');
  });

  describe('apply', () => {
    test('delega para ssdOptimizeManager.optimizeForSsd e retorna success:true', async () => {
      ssdOptimizeManager.optimizeForSsd.mockResolvedValue({
        success: true,
        trim: { trimEnabled: true, success: true },
        indexing: { indexingEnabled: false, success: true }
      });
      const Logger = makeLogger();

      const result = await setSsdOptimize.apply(Logger);

      expect(ssdOptimizeManager.optimizeForSsd).toHaveBeenCalledWith(Logger);
      expect(result).toMatchObject({ success: true });
    });

    test('propaga skipped quando não é Windows', async () => {
      ssdOptimizeManager.optimizeForSsd.mockResolvedValue({ success: false, skipped: true });

      const result = await setSsdOptimize.apply(makeLogger());

      expect(result).toMatchObject({ success: false, skipped: true });
    });
  });

  describe('revert', () => {
    test('delega para ssdOptimizeManager.restoreState com o estado anterior informado em options', async () => {
      ssdOptimizeManager.restoreState.mockResolvedValue({ success: true });
      const Logger = makeLogger();
      const previousState = { trim: { trimEnabled: false }, indexing: { indexingEnabled: true }, drive: 'C:' };

      const result = await setSsdOptimize.revert(Logger, { previousState });

      expect(ssdOptimizeManager.restoreState).toHaveBeenCalledWith(previousState, Logger);
      expect(result.success).toBe(true);
    });

    test('retorna skipped quando nenhum estado anterior foi informado', async () => {
      ssdOptimizeManager.restoreState.mockResolvedValue({ success: false, skipped: true, reason: 'no-captured-state' });

      const result = await setSsdOptimize.revert(makeLogger(), {});

      expect(ssdOptimizeManager.restoreState).toHaveBeenCalledWith(undefined, expect.anything());
      expect(result).toMatchObject({ success: false, skipped: true });
    });
  });
});
