jest.mock('../../../src/app/modules/windowsTweaks/components/gameModeManager');

const gameModeManager = require('../../../src/app/modules/windowsTweaks/components/gameModeManager');
const setGameMode = require('../../../src/app/modules/windowsTweaks/tweaks/setGameMode');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

afterEach(() => jest.clearAllMocks());

describe('setGameMode tweak', () => {
  test('expõe metadados id/name/description', () => {
    expect(setGameMode.id).toBe('game-mode');
    expect(setGameMode.name).toBe('Game Mode');
    expect(typeof setGameMode.description).toBe('string');
  });

  describe('apply', () => {
    test('delega para gameModeManager.setGameModeEnabled(true, ...) e retorna success:true', async () => {
      gameModeManager.setGameModeEnabled.mockResolvedValue({ success: true, enabled: true });
      const Logger = makeLogger();

      const result = await setGameMode.apply(Logger);

      expect(gameModeManager.setGameModeEnabled).toHaveBeenCalledWith(true, Logger);
      expect(result).toMatchObject({ success: true, enabled: true });
    });

    test('propaga skipped quando não é Windows', async () => {
      gameModeManager.setGameModeEnabled.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows' });

      const result = await setGameMode.apply(makeLogger());

      expect(result).toMatchObject({ success: false, skipped: true });
    });
  });

  describe('revert', () => {
    test('delega para gameModeManager.restoreState com o estado anterior informado em options', async () => {
      gameModeManager.restoreState.mockResolvedValue({ success: true, enabled: false });
      const Logger = makeLogger();
      const previousState = { enabled: false };

      const result = await setGameMode.revert(Logger, { previousState });

      expect(gameModeManager.restoreState).toHaveBeenCalledWith(previousState, Logger);
      expect(result.success).toBe(true);
    });

    test('retorna skipped quando nenhum estado anterior foi informado', async () => {
      gameModeManager.restoreState.mockResolvedValue({ success: false, skipped: true, reason: 'no-captured-state' });

      const result = await setGameMode.revert(makeLogger(), {});

      expect(gameModeManager.restoreState).toHaveBeenCalledWith(undefined, expect.anything());
      expect(result).toMatchObject({ success: false, skipped: true });
    });
  });
});
