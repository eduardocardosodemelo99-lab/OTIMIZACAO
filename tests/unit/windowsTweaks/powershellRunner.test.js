const originalPlatform = process.platform;

function setPlatform(platform) {
  Object.defineProperty(process, 'platform', { value: platform });
}

describe('windowsTweaks/components/powershellRunner', () => {
  afterEach(() => {
    setPlatform(originalPlatform);
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('não executa nada e retorna skipped em plataformas não-Windows', async () => {
    setPlatform('linux');
    const { runPowerShell } = require('../../../src/app/modules/windowsTweaks/components/powershellRunner');

    const result = await runPowerShell('Get-Service');

    expect(result).toEqual({ success: false, skipped: true, reason: 'not-windows', stdout: '', stderr: '' });
  });

  test('resolve com success:true quando o comando é executado sem erro no Windows', async () => {
    setPlatform('win32');
    jest.doMock('child_process', () => ({
      exec: (_cmd, _opts, cb) => cb(null, 'OK\n', '')
    }));
    const { runPowerShell } = require('../../../src/app/modules/windowsTweaks/components/powershellRunner');

    const result = await runPowerShell('Write-Output OK');

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.stdout).toBe('OK\n');
  });

  test('resolve com success:false e a mensagem de erro quando o comando falha', async () => {
    setPlatform('win32');
    jest.doMock('child_process', () => ({
      exec: (_cmd, _opts, cb) => cb(new Error('Access denied'), '', 'Access denied')
    }));
    const { runPowerShell } = require('../../../src/app/modules/windowsTweaks/components/powershellRunner');

    const result = await runPowerShell('Set-Service -Name X -StartupType Disabled');

    expect(result.success).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  test('isWindows reflete process.platform corretamente', () => {
    setPlatform('win32');
    jest.resetModules();
    const { isWindows } = require('../../../src/app/modules/windowsTweaks/components/powershellRunner');
    expect(isWindows()).toBe(true);

    setPlatform('darwin');
    jest.resetModules();
    const { isWindows: isWindows2 } = require('../../../src/app/modules/windowsTweaks/components/powershellRunner');
    expect(isWindows2()).toBe(false);
  });
});
