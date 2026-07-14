/**
 * Módulo de Logs
 * Grava todos os eventos importantes da aplicação em src/logs/app.log
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

function init() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
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
    fs.appendFileSync(LOG_FILE, line, 'utf8');
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
  LOG_FILE
};
