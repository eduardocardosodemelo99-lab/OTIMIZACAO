/**
 * Componente reutilizável: PowerShell Runner
 * Encapsula a execução de comandos PowerShell de forma segura e testável.
 * Nunca lança exceção — sempre resolve com um objeto de resultado, para que
 * os componentes que o utilizam (serviceManager, processPriority, etc.)
 * possam tratar falhas de forma previsível e sem derrubar a aplicação.
 */

const { exec } = require('child_process');

const DEFAULT_TIMEOUT_MS = 15000;

function isWindows() {
  return process.platform === 'win32';
}

/**
 * Executa um comando PowerShell.
 * Em qualquer SO diferente de Windows, o comando é ignorado (skipped: true)
 * em vez de tentar executar — evita erros ruidosos em ambientes de
 * desenvolvimento/CI que não são Windows.
 */
function runPowerShell(command, options = {}) {
  return new Promise((resolve) => {
    if (!isWindows()) {
      resolve({
        success: false,
        skipped: true,
        reason: 'not-windows',
        stdout: '',
        stderr: ''
      });
      return;
    }

    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const escaped = String(command).replace(/"/g, '\\"');
    const fullCommand = `powershell -NoProfile -NonInteractive -Command "${escaped}"`;

    exec(fullCommand, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          success: false,
          skipped: false,
          error: err.message,
          stdout: stdout ? stdout.toString() : '',
          stderr: stderr ? stderr.toString() : ''
        });
        return;
      }
      resolve({
        success: true,
        skipped: false,
        stdout: stdout ? stdout.toString() : '',
        stderr: stderr ? stderr.toString() : ''
      });
    });
  });
}

module.exports = { runPowerShell, isWindows, DEFAULT_TIMEOUT_MS };
