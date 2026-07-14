# Arquitetura

## Processos Electron

- **Main process** (`src/app/main.js`): cria a janela, registra todos os handlers IPC de cada módulo, controla ciclo de vida da app.
- **Preload** (`src/app/preload.js`): expõe uma API segura (`window.cs2app`) via `contextBridge`, sem habilitar `nodeIntegration` no renderer.
- **Renderer** (`src/app/views/index.html` + `src/app/scripts/renderer.js`): interface do usuário, SPA simples com troca de views por módulo.

## Módulos de backend (`src/app/modules/`)

Cada módulo exporta uma função `registerXHandlers(ipcMain, Logger)` que registra seus próprios canais IPC, mantendo o `main.js` como orquestrador fino.

| Módulo | Arquivo | Responsabilidade |
|---|---|---|
| Dashboard | `dashboard.js` | Leitura de hardware/software para visão geral |
| Scanner | `scanner.js` | Detecção detalhada de CPU/GPU/Storage/Windows |
| Windows Tweaks | `windowsTweaks.js` | Aplicação/reversão de otimizações do sistema |
| Perfis | `profiles.js` | Combinação de tweaks + presets CS2 em um clique |
| CS2 Config | `cs2Config.js` | Leitura/escrita de autoexec.cfg e presets de jogo |
| Benchmark | `benchmark.js` | Cálculo de Average FPS, 1% low, 0.1% low, frame time |
| Backup | `backup.js` | Snapshot e restauração de configurações |
| Logger | `logger.js` | Log estruturado em `src/logs/app.log` |

## Convenções

- Toda ação que modifica o sistema (tweaks, presets) deve, futuramente, criar um backup automático antes de aplicar (`backupBeforeApply` em `src/configs/default.json`).
- Toda operação relevante é logada via `Logger.info/warn/error`.
- Os módulos de backend não devem depender diretamente do DOM; toda comunicação com a UI passa por IPC.
- Estilo visual: dark mode + glassmorphism, definido em `src/app/styles/main.css` via variáveis CSS (`--bg-panel`, `--border-glass`, `--accent`).

## Por que este projeto é construído incrementalmente

Este é um software de grande porte (10.000–20.000 linhas estimadas). Por isso o desenvolvimento segue por módulo, cada um com seu próprio commit, permitindo revisão, testes e histórico de versionamento claro no Git.
