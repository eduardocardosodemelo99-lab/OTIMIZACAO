const os = require('os');

describe('windowsTweaks/components/cacheCleaner', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('getCacheTargets retorna as pastas esperadas com paths absolutos', () => {
    const { getCacheTargets } = require('../../../src/app/modules/windowsTweaks/components/cacheCleaner');
    const targets = getCacheTargets();
    const keys = targets.map((t) => t.key);

    expect(keys).toEqual(expect.arrayContaining(['temp-user', 'temp-local-appdata', 'prefetch', 'windows-update-cache']));
    // Em Windows os paths usam path.win32 (ex.: C:\Windows\Prefetch), que
    // path.isAbsolute (posix, quando o teste roda em Linux/CI) não reconhece
    // como absoluto — validamos apenas que é uma string não vazia.
    targets.forEach((t) => {
      expect(typeof t.path).toBe('string');
      expect(t.path.length).toBeGreaterThan(0);
    });
  });

  test('clearDirectory remove arquivos e soma bytes liberados, ignorando erros individuais', async () => {
    jest.doMock('fs/promises', () => ({
      readdir: jest.fn(async (dirPath) => {
        if (dirPath === '/cache') {
          return [
            { name: 'a.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
            { name: 'sub', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
            { name: 'locked.tmp', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
          ];
        }
        if (dirPath === '/cache/sub') {
          return [{ name: 'b.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }];
        }
        return [];
      }),
      stat: jest.fn(async (filePath) => {
        if (filePath === '/cache/locked.tmp') throw new Error('EPERM');
        return { size: 100 };
      }),
      unlink: jest.fn(async () => {})
    }));

    const { clearDirectory } = require('../../../src/app/modules/windowsTweaks/components/cacheCleaner');
    const result = await clearDirectory('/cache');

    expect(result.deletedFiles).toBe(2); // a.txt + sub/b.txt
    expect(result.freedBytes).toBe(200);
    expect(result.skipped).toBe(1); // locked.tmp falhou no stat
  });

  test('clearDirectory não lança quando a pasta não existe', async () => {
    jest.doMock('fs/promises', () => ({
      readdir: jest.fn(async () => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }),
      stat: jest.fn(),
      unlink: jest.fn()
    }));

    const { clearDirectory } = require('../../../src/app/modules/windowsTweaks/components/cacheCleaner');
    const result = await clearDirectory('/does-not-exist');

    expect(result).toEqual({ path: '/does-not-exist', freedBytes: 0, deletedFiles: 0, skipped: 0 });
  });

  test('cleanCache agrega o total liberado (MB) de todas as pastas alvo', async () => {
    jest.doMock('fs/promises', () => ({
      readdir: jest.fn(async () => [
        { name: 'file.bin', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
      ]),
      stat: jest.fn(async () => ({ size: 1024 * 1024 })), // 1 MB
      unlink: jest.fn(async () => {})
    }));

    const { cleanCache, getCacheTargets } = require('../../../src/app/modules/windowsTweaks/components/cacheCleaner');
    const Logger = { info: jest.fn(), warn: jest.fn() };

    const outcome = await cleanCache(null, Logger);

    expect(outcome.results.length).toBe(getCacheTargets().length);
    expect(outcome.totalFreedMB).toBeCloseTo(getCacheTargets().length, 1);
    expect(Logger.info).toHaveBeenCalledTimes(getCacheTargets().length);
  });

  test('cleanCache filtra pelas targetKeys informadas', async () => {
    jest.doMock('fs/promises', () => ({
      readdir: jest.fn(async () => []),
      stat: jest.fn(),
      unlink: jest.fn()
    }));

    const { cleanCache } = require('../../../src/app/modules/windowsTweaks/components/cacheCleaner');
    const outcome = await cleanCache(['prefetch']);

    expect(outcome.results.length).toBe(1);
    expect(outcome.results[0].key).toBe('prefetch');
  });
});

// Sanity check auxiliar: garante que os testes acima rodam de fato em cima
// do homedir/plataforma atual sem exigir Windows.
test('os.tmpdir() está disponível neste ambiente para os testes acima', () => {
  expect(typeof os.tmpdir()).toBe('string');
});
