/**
 * Módulo de Logs
 * Grava todos os eventos importantes da aplicação em src/logs/app.log
 */

const fs = require('fs');
const path = require('path');
const paths = require('./paths');

function getLogDir() {
  return paths.getLogDir();
}

function getLogFile() {
  return path.join(getLogDir(), 'app.log');
}

function init() {
  const dir = getLogDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function write(level, scope, message, meta) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    meta: meta || {}
  };
  const line = JSON.stringify(entry) + '\n';
  try {
    init();
    fs.appendFileSync(getLogFile(), line, 'utf8');
  } catch (err) {
    // Evita crash da app caso o disco de logs não esteja disponível
    console.error('[Logger] Falha ao gravar log:', err.message);
  }
  const consoleFn = level === 'error' ? console.error : console.log;
  consoleFn(`[${entry.timestamp}] [${level.toUpperCase()}] [${scope}] ${message}`);
}

module.exports = {
  init,
  info: (scope, message, meta) => write('info', scope, message, meta),
  warn: (scope, message, meta) => write('warn', scope, message, meta),
  error: (scope, message, meta) => write('error', scope, message, meta),
  get LOG_FILE() {
    return getLogFile();
  }
};
