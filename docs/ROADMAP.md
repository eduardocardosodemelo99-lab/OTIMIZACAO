# Roadmap de Implementação

## ✅ Etapa 0 — Scaffold (concluída)
- Estrutura de pastas
- Electron main/preload/renderer funcionando
- Interface base (dark mode + glassmorphism)
- Stubs de todos os módulos de backend com IPC já ligado

## Etapa 1 — Dashboard real
- Integrar `systeminformation` para CPU, GPU, RAM, storage, monitor reais
- Estimativa de FPS baseada em tabela de referência de hardware

## Etapa 2 — Scanner
- Detecção de família de CPU (Intel/Xeon/Ryzen) e GPU (RTX/RX)
- Detecção de tipo de storage (SSD/NVMe) via `systeminformation`
- Leitura de configurações atuais do Windows (Power Plan, Game Mode)

## Etapa 3 — Windows Tweaks
- Implementação real via PowerShell/registry (Game Mode, Power Plan, SSD, Explorer, Rede)
- Ajustes específicos para AMD
- Cada tweak grava backup automático antes de aplicar

## Etapa 4 — Perfis
- Orquestração real: perfil aplica tweaks + preset CS2 em sequência
- Feedback visual de progresso na UI

## Etapa 5 — CS2 Config
- Editor avançado de autoexec (radar, crosshair, viewmodel, áudio, practice config)
- Detecção automática da pasta de instalação do CS2
- Escrita direta no `cfg` do jogo

## Etapa 6 — Benchmark
- Overlay/hook de captura de FPS real durante gameplay
- Gráficos com Chart.js (Average FPS, 1% low, 0.1% low, Frame Time)
- Histórico de benchmarks comparável

## Etapa 7 — Backup/Restore completo
- Snapshot real de registry/config antes de qualquer alteração
- Restauração completa com um clique

## Etapa 8 — Logs avançados
- Visualização filtrável de logs na UI (por módulo, nível, data)
- Exportação de logs para suporte técnico

## Etapa 9 — Polimento de UI
- Animações de transição entre views
- Refinamento visual glassmorphism
- Feedback com SweetAlert2 em todas as ações críticas

## Etapa 10 — Empacotamento
- Configuração final do `electron-builder`
- Ícones, instalador NSIS, assinatura (se aplicável)
- Testes em máquina limpa Windows
