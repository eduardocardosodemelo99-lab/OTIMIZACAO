# CS2 Ultimate Optimizer

Software profissional de otimização de sistema e Counter-Strike 2 — Desktop App (Electron).

**Versão atual:** 0.1.0 (scaffold inicial)

## Stack

| Tecnologia | Uso |
|---|---|
| Electron | Aplicação Desktop |
| Node.js | Backend |
| HTML5 / CSS3 | Interface |
| JavaScript | Lógica |
| Bootstrap | Componentes de UI |
| Chart.js | Gráficos (benchmark) |
| SweetAlert2 | Popups/confirmações |
| electron-builder | Empacotamento em `.exe` |

## Estrutura do projeto

```
src/
  app/
    modules/
      dashboard.js, scanner.js, profiles.js, cs2Config.js, benchmark.js, backup.js, logger.js
      windowsTweaks/          -> módulo Windows Tweaks (estrutura modular)
        index.js              -> orquestração + registro dos handlers IPC
        components/           -> peças reutilizáveis e testáveis isoladamente
          powershellRunner.js -> execução segura de comandos PowerShell
          serviceManager.js   -> desabilitar/reabilitar serviços do Windows
          cacheCleaner.js     -> limpeza de temp/cache/prefetch
          processPriority.js  -> ajuste de prioridade de processos (ex.: cs2.exe)
        tweaks/               -> tweaks concretos, compostos a partir dos components
          disableUnnecessaryServices.js
          cleanSystemCache.js
          boostProcessPriority.js
    views/        -> HTML das telas
    assets/       -> ícones e imagens
    styles/       -> CSS (glassmorphism / dark mode)
    scripts/      -> JS do renderer
    main.js       -> processo principal do Electron
    preload.js    -> ponte segura renderer <-> main
  configs/        -> configurações padrão e autoexec.cfg do CS2
  backup/         -> snapshots para restore
  logs/           -> logs da aplicação
  tools/          -> scripts auxiliares
tests/
  unit/windowsTweaks/ -> testes unitários (Jest) dos components, tweaks e do index
docs/             -> documentação técnica
```

Rode os testes unitários com `npm test` (Jest).

## Módulos

- **Dashboard** — CPU, GPU, RAM, SSD, Monitor, Windows, Driver, FPS esperado
- **Scanner** — Detecção de Intel/Xeon/Ryzen, RTX/RX, SSD/NVMe, config. do Windows
- **Windows** — Game Mode, Power Plan, SSD, Explorer, Rede, ajustes AMD, Backup/Restore, além das otimizações reais: desabilitar serviços desnecessários, limpar cache do sistema e aumentar prioridade de processos (ver `src/app/modules/windowsTweaks/`)
- **Perfis** — FPS, Qualidade, Competitivo, Streaming
- **CS2** — Autoexec, Radar, Crosshair, Viewmodel, Audio, Practice
- **Benchmark** — Average FPS, 1% low, 0.1% low, Frame Time
- **Logs** — Histórico completo de eventos

## Como rodar (desenvolvimento)

```bash
npm install
npm start
```

## Como gerar o instalador Windows

### Opção 1 — GitHub Actions (automático, recomendado)
A cada push na branch `main`, o workflow `.github/workflows/build-windows.yml` builda
automaticamente o `.exe` em um runner `windows-latest` e disponibiliza como artifact
na aba **Actions** do repositório ("cs2-ultimate-optimizer-windows"). Também pode ser
disparado manualmente pela aba Actions (`workflow_dispatch`).

### Opção 2 — Local, em uma máquina Windows
```bash
npm install
npm run build:win
```
O instalador é gerado em `build/`.

## Status do desenvolvimento

Este é o **scaffold inicial** do projeto: estrutura de pastas, processo Electron,
IPC entre main/renderer e interface base (glassmorphism dark mode) já funcionando
com dados de exemplo. Os próximos commits vão implementar, módulo por módulo, a
lógica real de detecção de hardware, aplicação de tweaks no Windows e integração
com o CS2.

Veja `docs/ROADMAP.md` para o plano de implementação.
