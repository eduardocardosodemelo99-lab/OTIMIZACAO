jest.mock('../../../src/app/modules/windowsTweaks/components/powershellRunner');

const { runPowerShell } = require('../../../src/app/modules/windowsTweaks/components/powershellRunner');
const powerPlanManager = require('../../../src/app/modules/windowsTweaks/components/powerPlanManager');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

const LIST_OUTPUT = `Existing Power Schemes (* Active)
-----------------------------------
Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced) *
Power Scheme GUID: 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c  (High performance)
Power Scheme GUID: a1841308-3541-4fab-bc81-f71556f20b4a  (Power saver)
`;

const LIST_OUTPUT_ULTIMATE_ACTIVE = `Existing Power Schemes (* Active)
-----------------------------------
Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced)
Power Scheme GUID: e9a42b02-d5df-448d-aa00-03f14749eb61  (Ultimate Performance) *
`;

afterEach(() => jest.clearAllMocks());

describe('powerPlanManager', () => {
  describe('listPowerPlans', () => {
    test('faz parse dos planos e do plano ativo a partir da saída do powercfg /list', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: LIST_OUTPUT, stderr: '' });

      const result = await powerPlanManager.listPowerPlans();

      expect(runPowerShell).toHaveBeenCalledWith('powercfg /list');
      expect(result.success).toBe(true);
      expect(result.plans).toHaveLength(3);
      expect(result.plans[0]).toMatchObject({ name: 'Balanced', active: true });
      expect(result.plans[1]).toMatchObject({ name: 'High performance', active: false });
    });

    test('retorna success:false e skipped quando não é Windows', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await powerPlanManager.listPowerPlans();

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.plans).toEqual([]);
    });
  });

  describe('getActivePowerPlan', () => {
    test('retorna o plano marcado como ativo', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: LIST_OUTPUT, stderr: '' });

      const result = await powerPlanManager.getActivePowerPlan();

      expect(result).toMatchObject({ name: 'Balanced', guid: '381b4222-f694-41f0-9685-ff5bb260df2e' });
    });

    test('retorna guid/name nulos quando a listagem falha', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await powerPlanManager.getActivePowerPlan();

      expect(result).toMatchObject({ guid: null, name: null, skipped: true });
    });
  });

  describe('setBestPerformancePlan', () => {
    test('duplica e ativa o Ultimate Performance quando ele ainda não existe na lista', async () => {
      runPowerShell
        .mockResolvedValueOnce({ success: true, stdout: LIST_OUTPUT, stderr: '' }) // powercfg /list
        .mockResolvedValueOnce({
          success: true,
          stdout: 'Power Scheme GUID: e9a42b02-d5df-448d-aa00-03f14749eb61  (Ultimate Performance)',
          stderr: ''
        }) // powercfg -duplicatescheme
        .mockResolvedValueOnce({ success: true, stdout: '', stderr: '' }); // powercfg /setactive

      const Logger = makeLogger();
      const result = await powerPlanManager.setBestPerformancePlan(Logger);

      expect(runPowerShell).toHaveBeenNthCalledWith(2, expect.stringContaining('-duplicatescheme'));
      expect(runPowerShell).toHaveBeenNthCalledWith(3, expect.stringContaining('/setactive e9a42b02-d5df-448d-aa00-03f14749eb61'));
      expect(result.success).toBe(true);
      expect(result.name).toBe('Ultimate Performance');
      expect(Logger.info).toHaveBeenCalled();
    });

    test('usa o Ultimate Performance diretamente quando já está na lista', async () => {
      runPowerShell
        .mockResolvedValueOnce({ success: true, stdout: LIST_OUTPUT_ULTIMATE_ACTIVE, stderr: '' })
        .mockResolvedValueOnce({ success: true, stdout: '', stderr: '' });

      const result = await powerPlanManager.setBestPerformancePlan(makeLogger());

      expect(runPowerShell).toHaveBeenCalledTimes(2);
      expect(result.guid).toBe('e9a42b02-d5df-448d-aa00-03f14749eb61');
      expect(result.success).toBe(true);
    });

    test('cai para High Performance quando a duplicação do Ultimate falha', async () => {
      runPowerShell
        .mockResolvedValueOnce({ success: true, stdout: LIST_OUTPUT, stderr: '' })
        .mockResolvedValueOnce({ success: false, error: 'access denied', stdout: '', stderr: '' })
        .mockResolvedValueOnce({ success: true, stdout: '', stderr: '' });

      const result = await powerPlanManager.setBestPerformancePlan(makeLogger());

      expect(result.name).toBe('High performance');
      expect(result.guid).toBe('8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c');
    });

    test('retorna erro quando nenhum plano de alto desempenho está disponível', async () => {
      runPowerShell
        .mockResolvedValueOnce({
          success: true,
          stdout: 'Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced) *',
          stderr: ''
        })
        .mockResolvedValueOnce({ success: false, error: 'not supported', stdout: '', stderr: '' });

      const Logger = makeLogger();
      const result = await powerPlanManager.setBestPerformancePlan(Logger);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Nenhum plano/);
      expect(Logger.warn).toHaveBeenCalled();
    });

    test('propaga skipped quando não é Windows', async () => {
      runPowerShell.mockResolvedValue({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });

      const result = await powerPlanManager.setBestPerformancePlan(makeLogger());

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
    });
  });

  describe('setActivePlan / captureState / restoreState', () => {
    test('setActivePlan ativa o GUID informado', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });

      const result = await powerPlanManager.setActivePlan('381b4222-f694-41f0-9685-ff5bb260df2e', makeLogger());

      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('/setactive 381b4222-f694-41f0-9685-ff5bb260df2e'));
      expect(result.success).toBe(true);
    });

    test('setActivePlan retorna skipped quando guid não é informado', async () => {
      const result = await powerPlanManager.setActivePlan(null, makeLogger());
      expect(result).toMatchObject({ success: false, skipped: true, reason: 'no-guid' });
      expect(runPowerShell).not.toHaveBeenCalled();
    });

    test('captureState retorna o plano atualmente ativo', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: LIST_OUTPUT, stderr: '' });

      const state = await powerPlanManager.captureState();

      expect(state).toMatchObject({ name: 'Balanced', guid: '381b4222-f694-41f0-9685-ff5bb260df2e' });
    });

    test('restoreState reativa o plano a partir de um estado capturado', async () => {
      runPowerShell.mockResolvedValue({ success: true, stdout: '', stderr: '' });

      const result = await powerPlanManager.restoreState(
        { guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced' },
        makeLogger()
      );

      expect(result.success).toBe(true);
      expect(runPowerShell).toHaveBeenCalledWith(expect.stringContaining('/setactive 381b4222-f694-41f0-9685-ff5bb260df2e'));
    });

    test('restoreState não faz nada quando não há estado capturado', async () => {
      const result = await powerPlanManager.restoreState(null, makeLogger());
      expect(result).toMatchObject({ success: false, skipped: true, reason: 'no-captured-state' });
      expect(runPowerShell).not.toHaveBeenCalled();
    });
  });
});
