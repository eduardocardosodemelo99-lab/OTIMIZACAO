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

<!-- LATEST_BUILD_START -->
> 📦 **Último build:** [`ed3ca72`](https://github.com/eduardocardosodemelo99-lab/OTIMIZACAO/commit/ed3ca72ab930aec9be571349b71339aaaaa1257d) — gerado em 2026-07-14 17:16:28 UTC
>
> 👉 [Abrir o run e baixar o instalador em "Artifacts"](https://github.com/eduardocardosodemelo99-lab/OTIMIZACAO/actions/runs/29352969872)
<!-- LATEST_BUILD_END -->

## ⚠️ Como baixar e instalar o programa (leia antes de instalar)

> ### ❌ NÃO clique no botão verde "Code" → "Download ZIP"
> Esse botão baixa apenas o **código-fonte** do projeto (arquivos `.js`, `.ts`, etc.),
> usado para desenvolvimento. Ele **não** contém o programa pronto para instalar —
> por isso, se você abrir esse ZIP, só vai encontrar arquivos `.js` soltos e nenhum
> `.exe`. Isso **não é um bug**: é o comportamento normal do GitHub para o código-fonte.

### ✅ Onde baixar o instalador (.exe) correto

1. Acesse a aba **[Actions](../../actions)** deste repositório.
2. Clique no **run mais recente da branch `main`** com o ✅ verde (build concluído com sucesso).
3. Role a página até a seção **Artifacts**, no final.
4. Baixe o artifact **`cs2-ultimate-optimizer-windows`** (vem como `.zip`).
5. Extraia o `.zip` baixado — dentro dele está o arquivo
   **`CS2 Ultimate Optimizer Setup 0.1.0.exe`**.
6. Execute esse `.exe` — ele é o instalador real: instala o programa com o
   executável `CS2 Ultimate Optimizer.exe` e todo o código selado dentro de
   `resources/app.asar` (não aparecem `.js` soltos após a instalação).

Se depois de seguir esses passos ainda aparecerem arquivos `.js` soltos em vez do
`.exe`, é sinal de que o ZIP baixado foi o do código-fonte (passo errado acima) —
volte à aba Actions e baixe o artifact correto.

## Como gerar o instalador Windows (para desenvolvedores)

### Opção 1 — GitHub Actions (automático, recomendado)
A cada push na branch `main`, o workflow `.github/workflows/build-windows.yml` builda
automaticamente o `.exe` em um runner `windows-latest` e disponibiliza como artifact
na aba **Actions** do repositório ("cs2-ultimate-optimizer-windows"). Também pode ser
disparado manualmente pela aba Actions (`workflow_dispatch`).
Veja a seção **"Como baixar e instalar o programa"** acima para o passo a passo de
download do instalador já pronto.

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
