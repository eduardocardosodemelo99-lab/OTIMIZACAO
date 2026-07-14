const fs = require('fs');
const os = require('os');
const path = require('path');

let tmpDir;

jest.mock('../../src/app/modules/paths', () => ({
  getBackupDir: () => global.__BACKUP_TEST_DIR__
}));

jest.mock('../../src/app/modules/windowsTweaks/components/serviceManager', () => ({
  captureServicesState: jest.fn(),
  restoreServicesState: jest.fn()
}));

jest.mock('../../src/app/modules/windowsTweaks/components/processPriority', () => ({
  captureState: jest.fn(),
  restoreState: jest.fn(),
  normalizeProcessName: (n) => String(n || '').replace(/\.exe$/i, '')
}));

jest.mock('../../src/app/modules/windowsTweaks/components/powerPlanManager', () => ({
  captureState: jest.fn(),
  restoreState: jest.fn()
}));

jest.mock('../../src/app/modules/windowsTweaks/components/gameModeManager', () => ({
  captureState: jest.fn(),
  restoreState: jest.fn()
}));

jest.mock('../../src/app/modules/windowsTweaks/components/ssdOptimizeManager', () => ({
  captureState: jest.fn(),
  restoreState: jest.fn()
}));

jest.mock('../../src/app/modules/windowsTweaks/components/explorerTweaksManager', () => ({
  captureState: jest.fn(),
  restoreState: jest.fn()
}));

jest.mock('../../src/app/modules/cs2Config', () => ({
  getAutoexec: jest.fn(),
  saveAutoexec: jest.fn()
}));

const serviceManager = require('../../src/app/modules/windowsTweaks/components/serviceManager');
const processPriority = require('../../src/app/modules/windowsTweaks/components/processPriority');
const powerPlanManager = require('../../src/app/modules/windowsTweaks/components/powerPlanManager');
const gameModeManager = require('../../src/app/modules/windowsTweaks/components/gameModeManager');
const ssdOptimizeManager = require('../../src/app/modules/windowsTweaks/components/ssdOptimizeManager');
const explorerTweaksManager = require('../../src/app/modules/windowsTweaks/components/explorerTweaksManager');
const cs2Config = require('../../src/app/modules/cs2Config');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
  global.__BACKUP_TEST_DIR__ = tmpDir;
  jest.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function loadBackup() {
  // eslint-disable-next-line global-require
  return require('../../src/app/modules/backup');
}

describe('backup module', () => {
  test('createSnapshot grava um snapshot automático em disco e retorna o id', async () => {
    const backup = loadBackup();
    const result = await backup.createSnapshot({
      tweakId: 'disable-unnecessary-services',
      label: 'Desabilitar Serviços',
      state: { services: [{ name: 'SysMain', startType: 'Automatic', status: 'Running' }] }
    });

    expect(result.success).toBe(true);
    expect(result.id).toMatch(/^backup-/);

    const files = fs.readdirSync(tmpDir);
    expect(files).toHaveLength(1);
    const saved = JSON.parse(fs.readFileSync(path.join(tmpDir, files[0]), 'utf8'));
    expect(saved.type).toBe('auto');
    expect(saved.tweakId).toBe('disable-unnecessary-services');
    expect(saved.state.services).toHaveLength(1);
    expect(saved.state.processPriority).toBeNull();
  });

  test('create() gera um backup manual completo capturando serviços, prioridade, plano de energia, game mode e autoexec', async () => {
    serviceManager.captureServicesState.mockResolvedValue([{ name: 'SysMain', startType: 'Automatic', status: 'Running' }]);
    processPriority.captureState.mockResolvedValue({ name: 'cs2', priority: 'Normal' });
    powerPlanManager.captureState.mockResolvedValue({ guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced' });
    gameModeManager.captureState.mockResolvedValue({ enabled: false });
    ssdOptimizeManager.captureState.mockResolvedValue({ trim: { trimEnabled: true }, indexing: { indexingEnabled: false }, drive: 'C:' });
    explorerTweaksManager.captureState.mockResolvedValue({ fileExtensions: { extensionsVisible: false }, windowAnimations: { animationsEnabled: true } });
    cs2Config.getAutoexec.mockResolvedValue('cl_crosshairstyle 4');

    const backup = loadBackup();
    const result = await backup.create();

    expect(result.success).toBe(true);
    const files = fs.readdirSync(tmpDir);
    const saved = JSON.parse(fs.readFileSync(path.join(tmpDir, files[0]), 'utf8'));
    expect(saved.type).toBe('manual');
    expect(saved.state.services).toHaveLength(1);
    expect(saved.state.processPriority).toMatchObject({ name: 'cs2', priority: 'Normal' });
    expect(saved.state.powerPlan).toMatchObject({ guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced' });
    expect(saved.state.gameMode).toMatchObject({ enabled: false });
    expect(saved.state.ssdOptimize).toMatchObject({ trim: { trimEnabled: true }, indexing: { indexingEnabled: false } });
    expect(saved.state.explorerTweaks).toMatchObject({ fileExtensions: { extensionsVisible: false }, windowAnimations: { animationsEnabled: true } });
    expect(saved.state.cs2Autoexec).toBe('cl_crosshairstyle 4');
  });

  test('list() retorna backups ordenados do mais recente para o mais antigo', async () => {
    const backup = loadBackup();
    await backup.createSnapshot({ tweakId: 'a', label: 'A', state: {} });
    await new Promise((r) => setTimeout(r, 5));
    await backup.createSnapshot({ tweakId: 'b', label: 'B', state: {} });

    const list = await backup.list();
    expect(list).toHaveLength(2);
    expect(list[0].tweakId).toBe('b');
    expect(list[1].tweakId).toBe('a');
  });

  test('restore() retorna erro quando o backup não existe', async () => {
    const backup = loadBackup();
    const result = await backup.restore('backup-inexistente');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/não encontrado/);
  });

  test('restore() reaplica serviços, prioridade, plano de energia, game mode e autoexec a partir do snapshot', async () => {
    serviceManager.restoreServicesState.mockResolvedValue({ results: [{ name: 'SysMain', success: true }], restoredCount: 1, total: 1 });
    processPriority.restoreState.mockResolvedValue({ success: true, name: 'cs2', priority: 'Normal' });
    powerPlanManager.restoreState.mockResolvedValue({ success: true, guid: '381b4222-f694-41f0-9685-ff5bb260df2e' });
    gameModeManager.restoreState.mockResolvedValue({ success: true, enabled: false });
    ssdOptimizeManager.restoreState.mockResolvedValue({ success: true });
    explorerTweaksManager.restoreState.mockResolvedValue({ success: true });
    cs2Config.saveAutoexec.mockResolvedValue({ success: true });

    const backup = loadBackup();
    const created = await backup.createSnapshot({
      tweakId: 'manual',
      label: 'Manual',
      state: {
        services: [{ name: 'SysMain', startType: 'Automatic', status: 'Running' }],
        processPriority: { name: 'cs2', priority: 'Normal' },
        powerPlan: { guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced' },
        gameMode: { enabled: false },
        ssdOptimize: { trim: { trimEnabled: true }, indexing: { indexingEnabled: false }, drive: 'C:' },
        explorerTweaks: { fileExtensions: { extensionsVisible: true }, windowAnimations: { animationsEnabled: false } },
        cs2Autoexec: 'cl_crosshairstyle 4'
      }
    });

    const result = await backup.restore(created.id, makeLogger());

    expect(result.success).toBe(true);
    expect(serviceManager.restoreServicesState).toHaveBeenCalledWith(
      [{ name: 'SysMain', startType: 'Automatic', status: 'Running' }],
      expect.anything()
    );
    expect(processPriority.restoreState).toHaveBeenCalledWith({ name: 'cs2', priority: 'Normal' }, expect.anything());
    expect(powerPlanManager.restoreState).toHaveBeenCalledWith(
      { guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced' },
      expect.anything()
    );
    expect(gameModeManager.restoreState).toHaveBeenCalledWith({ enabled: false }, expect.anything());
    expect(ssdOptimizeManager.restoreState).toHaveBeenCalledWith(
      { trim: { trimEnabled: true }, indexing: { indexingEnabled: false }, drive: 'C:' },
      expect.anything()
    );
    expect(explorerTweaksManager.restoreState).toHaveBeenCalledWith(
      { fileExtensions: { extensionsVisible: true }, windowAnimations: { animationsEnabled: false } },
      expect.anything()
    );
    expect(cs2Config.saveAutoexec).toHaveBeenCalledWith('cl_crosshairstyle 4');
  });

  test('restore() retorna sucesso:false quando o backup não contém nenhum dado restaurável', async () => {
    const backup = loadBackup();
    const created = await backup.createSnapshot({ tweakId: 'vazio', label: 'Vazio', state: {} });
    const result = await backup.restore(created.id);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/não contém dados/);
  });
});
