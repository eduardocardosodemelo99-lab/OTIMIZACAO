jest.mock('../../../src/app/modules/windowsTweaks/components/powerPlanManager');

const powerPlanManager = require('../../../src/app/modules/windowsTweaks/components/powerPlanManager');
const setPowerPlan = require('../../../src/app/modules/windowsTweaks/tweaks/setPowerPlan');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

afterEach(() => jest.clearAllMocks());

describe('setPowerPlan tweak', () => {
  test('expõe metadados id/name/description', () => {
    expect(setPowerPlan.id).toBe('power-plan');
    expect(setPowerPlan.name).toBe('Power Plan');
    expect(typeof setPowerPlan.description).toBe('string');
  });

  describe('apply', () => {
    test('delega para powerPlanManager.setBestPerformancePlan e retorna success:true', async () => {
      powerPlanManager.setBestPerformancePlan.mockResolvedValue({
        success: true,
        name: 'Ultimate Performance',
        guid: 'e9a42b02-d5df-448d-aa00-03f14749eb61'
      });
      const Logger = makeLogger();

      const result = await setPowerPlan.apply(Logger);

      expect(powerPlanManager.setBestPerformancePlan).toHaveBeenCalledWith(Logger);
      expect(result).toMatchObject({ success: true, name: 'Ultimate Performance' });
    });

    test('propaga skipped quando não é Windows', async () => {
      powerPlanManager.setBestPerformancePlan.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows' });

      const result = await setPowerPlan.apply(makeLogger());

      expect(result).toMatchObject({ success: false, skipped: true });
    });

    test('retorna success:false quando nenhum plano de alto desempenho está disponível', async () => {
      powerPlanManager.setBestPerformancePlan.mockResolvedValue({ success: false, error: 'Nenhum plano de alto desempenho disponível' });

      const result = await setPowerPlan.apply(makeLogger());

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Nenhum plano/);
    });
  });

  describe('revert', () => {
    test('delega para powerPlanManager.restoreState com o estado anterior informado em options', async () => {
      powerPlanManager.restoreState.mockResolvedValue({ success: true, guid: '381b4222-f694-41f0-9685-ff5bb260df2e' });
      const Logger = makeLogger();
      const previousState = { guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced' };

      const result = await setPowerPlan.revert(Logger, { previousState });

      expect(powerPlanManager.restoreState).toHaveBeenCalledWith(previousState, Logger);
      expect(result.success).toBe(true);
    });

    test('retorna skipped quando nenhum estado anterior foi informado', async () => {
      powerPlanManager.restoreState.mockResolvedValue({ success: false, skipped: true, reason: 'no-captured-state' });

      const result = await setPowerPlan.revert(makeLogger(), {});

      expect(powerPlanManager.restoreState).toHaveBeenCalledWith(undefined, expect.anything());
      expect(result).toMatchObject({ success: false, skipped: true });
    });
  });
});
