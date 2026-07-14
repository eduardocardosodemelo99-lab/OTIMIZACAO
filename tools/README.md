# tools/

Ferramentas externas de terceiros usadas pelos módulos do CS2 Ultimate Optimizer.
Binários (`*.exe`) não são versionados no Git (ver `.gitignore`) — cada usuário
deve baixá-los manualmente e colocá-los nesta pasta.

## PresentMon (obrigatório para o módulo Benchmark)

O CS2 não expõe uma API própria de FPS. Para medir **Average FPS**, **1% low**,
**0.1% low** e **Frame Time** com precisão real, usamos o **PresentMon**
(Intel/Microsoft, open-source), a mesma técnica usada por ferramentas como
CapFrameX e OCAT.

**Como instalar:**

1. Baixe a última release em: https://github.com/GameTechDev/PresentMon/releases
2. Extraia o executável (ex: `PresentMon-1.9.0-x64.exe`) para esta pasta (`tools/`)
3. O módulo `benchmark.js` detecta automaticamente qualquer arquivo
   `PresentMon*.exe` dentro de `tools/`

Sem esse executável, o botão "Iniciar Benchmark" retornará um erro explicando
que o PresentMon precisa ser instalado.
