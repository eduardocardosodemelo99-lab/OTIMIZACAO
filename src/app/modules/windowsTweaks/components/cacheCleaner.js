/**
 * Componente reutilizável: Cache Cleaner
 * Remove arquivos de pastas temporárias/cache do Windows para liberar
 * espaço e reduzir overhead de indexação. Mantém as pastas, remove só os
 * arquivos, com limite de profundidade para evitar travar em árvores gigantes.
 */

const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const MAX_DEPTH = 6;

function getCacheTargets() {
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const windowsDir = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';

  return [
    { key: 'temp-user', label: 'Temp do usuário', path: os.tmpdir() },
    { key: 'temp-local-appdata', label: 'Temp do LocalAppData', path: path.join(localAppData, 'Temp') },
    { key: 'prefetch', label: 'Prefetch', path: path.join(windowsDir, 'Prefetch') },
    { key: 'windows-update-cache', label: 'Cache do Windows Update', path: path.join(windowsDir, 'SoftwareDistribution', 'Download') }
  ];
}

/** Remove recursivamente todos os arquivos de um diretório (mantém a árvore
 * de pastas). Nunca lança — arquivos bloqueados/sem permissão são contados
 * em `skipped` e ignorados. */
async function clearDirectory(dirPath, { maxDepth = MAX_DEPTH } = {}) {
  let freedBytes = 0;
  let deletedFiles = 0;
  let skipped = 0;

  async function walk(currentPath, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      // Pasta não existe ou sem permissão de leitura: nada a limpar.
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      try {
        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          // eslint-disable-next-line no-await-in-loop
          await walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          // eslint-disable-next-line no-await-in-loop
          const stat = await fs.stat(fullPath);
          // eslint-disable-next-line no-await-in-loop
          await fs.unlink(fullPath);
          freedBytes += stat.size;
          deletedFiles += 1;
        }
      } catch {
        skipped += 1;
      }
    }
  }

  await walk(dirPath, 0);
  return { path: dirPath, freedBytes, deletedFiles, skipped };
}

async function cleanCache(targetKeys, Logger) {
  const allTargets = getCacheTargets();
  const targets = targetKeys && targetKeys.length
    ? allTargets.filter((t) => targetKeys.includes(t.key))
    : allTargets;

  const results = [];
  for (const target of targets) {
    // eslint-disable-next-line no-await-in-loop
    const result = await clearDirectory(target.path);
    const freedMB = Math.round((result.freedBytes / (1024 * 1024)) * 10) / 10;
    if (Logger) Logger.info('cacheCleaner', `Cache limpo: ${target.label}`, { ...result, freedMB });
    results.push({ key: target.key, label: target.label, ...result, freedMB });
  }

  const totalFreedMB = Math.round(results.reduce((sum, r) => sum + r.freedMB, 0) * 10) / 10;
  const totalDeletedFiles = results.reduce((sum, r) => sum + r.deletedFiles, 0);
  return { results, totalFreedMB, totalDeletedFiles };
}

module.exports = { getCacheTargets, clearDirectory, cleanCache };
