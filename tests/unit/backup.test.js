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

jest.mock('../../src/app/modules/cs2Config', () => ({
  getAutoexec: jest.fn(),
  saveAutoexec: jest.fn()
}));

const serviceManager = require('../../src/app/modules/windowsTweaks/components/serviceManager');
const processPriority = require('../../src/app/modules/windowsTweaks/components/processPriority');
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

  test('create() gera um backup manual completo capturando serviços, prioridade e autoexec', async () => {
    serviceManager.captureServicesState.mockResolvedValue([{ name: 'SysMain', startType: 'Automatic', status: 'Running' }]);
    processPriority.captureState.mockResolvedValue({ name: 'cs2', priority: 'Normal' });
    cs2Config.getAutoexec.mockResolvedValue('cl_crosshairstyle 4');

    const backup = loadBackup();
    const result = await backup.create();

    expect(result.success).toBe(true);
    const files = fs.readdirSync(tmpDir);
    const saved = JSON.parse(fs.readFileSync(path.join(tmpDir, files[0]), 'utf8'));
    expect(saved.type).toBe('manual');
    expect(saved.state.services).toHaveLength(1);
    expect(saved.state.processPriority).toMatchObject({ name: 'cs2', priority: 'Normal' });
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

  test('restore() reaplica serviços, prioridade e autoexec a partir do snapshot', async () => {
    serviceManager.restoreServicesState.mockResolvedValue({ results: [{ name: 'SysMain', success: true }], restoredCount: 1, total: 1 });
    processPriority.restoreState.mockResolvedValue({ success: true, name: 'cs2', priority: 'Normal' });
    cs2Config.saveAutoexec.mockResolvedValue({ success: true });

    const backup = loadBackup();
    const created = await backup.createSnapshot({
      tweakId: 'manual',
      label: 'Manual',
      state: {
        services: [{ name: 'SysMain', startType: 'Automatic', status: 'Running' }],
        processPriority: { name: 'cs2', priority: 'Normal' },
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
