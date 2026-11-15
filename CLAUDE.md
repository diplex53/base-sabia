# Base Sabiá — Junior Astronaut Mission Trainer (NASA Space Apps BH 2026)

Jogo web de gestão de colônia em Marte, voxel 3D, PT/EN, site estático sem build.
Publicado em https://diplex53.github.io/base-sabia/ (repositório público `diplex53/base-sabia`, Pages na `main`, raiz).

## Se você é uma sessão nova (troca de conta): leia isto primeiro

- Papel do Claude: arquiteto e orquestrador. Não escreve código do jogo direto; delega por subagentes (`model: "sonnet"` para tarefa clara de HTML/CSS/texto, `model: "opus"` para implementação difícil), com tarefa autocontida e dono de arquivo definido, e revisa o resultado.
- Falar em português do Brasil, direto, sem emoji. Avisar quando um pedido arrisca o prazo.
- Prazos de domingo 15/11: **enviar até 13h45** (banca às 14h30). Depois das 11h só entra o que estiver testado.
- Toda a equipe é menor de idade: demo sem rosto, voz ou nome. Sem logo da NASA. Uso de IA tem de ser declarado (`AI_USE.md`).
- Nunca publicar nome de participante, senha ou token. Capturas de tela estão no `.gitignore`.
- A `main` é o site no ar. Trabalho novo vai em branch e só entra na `main` depois de `node tests/run.mjs` passar e de conferir no navegador. Etiquetas de retorno: `estavel-0910` (antes da expansão) e o commit `417c0b5` (expansão, no ar).

## Estado atual (dom 15/11, 11h)

- No ar (`main`, commit `417c0b5`): núcleo da simulação (`src/sim`, 56 testes), HUD, visual 3D com reserva 2D (`?view=2d`), eventos, tecnologias, expedições, naves, níveis Cadete/Comandante, painéis científicos com fonte, catálogo real do DONKI e busca ao vivo, modo história (3 capítulos), Sol real, expansão do Apêndice E (mapa 6x6, 12 estruturas novas, saúde da colônia, domo, painel Cidade).
- Em andamento na branch **`ui-popup`** (ainda NÃO na `main`), três subagentes:
  1. Pop-up central de construção no lugar da lista no canto. Arquivos: `src/ui/slotPanel.js`, `css/buildMenu.css`, `src/i18n/pt8.js`/`en8.js`.
  2. Tela de tecnologias como árvore de bolinhas ligadas. Arquivos: seção de tecnologias de `src/ui/modals.js`, `css/techTree.css`, `pt9.js`/`en9.js`.
  3. Modo apresentação que joga sozinho (`?demo=1` e botão na tela inicial), com legendas. Arquivos: `src/demo/autoplay.js`, `css/demo.css`, `pt10.js`/`en10.js`, ganchos pequenos em `src/main.js` e na tela inicial.
  Se a sessão caiu no meio: rodar `git status` e `git diff` na `ui-popup`, abrir http://localhost:8080/, conferir cada um dos três no navegador (console sem erro, 3D e `?view=2d`, tela estreita), consertar ou descartar o que estiver quebrado, rodar os testes, e só então `git checkout main && git merge ui-popup && git push`.
- Atualização 11h15: pop-up de construção e árvore de tecnologias conferidos no navegador e commitados na `ui-popup` (commit `83e0e33`). Modo apresentação ainda em andamento na `ui-popup`. Novo pedido da equipe, três subagentes:
  4. Nome "Protocol: Ares" + descrição científica em cada cartão de construção (`pt11.js`/`en11.js`, `slotPanel.js`), na `ui-popup`.
  5. Mapa: chão cor do solo com "+", 72 espaços (os 36 antigos mantêm id e posição), mundo 50x só visual. Em worktree separada (branch própria, ver `git worktree list` e `git branch`).
  6. Brocas, minérios e crafting conforme `docs/lista-equipe.txt` (tecla M, `src/data/crafting.js`, `src/sim/crafting.js`, `src/ui/crafting.js`, `state.inv`, kits). ADITIVO: kit fabricado constrói sem custo; o custo em peças continua valendo. Em worktree separada.
  Ordem de junção: (a) `ui-popup` conferida vai para a `main`; (b) juntar a branch do mapa, testar, conferir no navegador, `main`; (c) juntar a do crafting, testar, conferir, `main`. Limite: o que não estiver conferido até 12h45 não entra.
- Atualização 11h30: item 4 (nome "Protocol: Ares" e bloco "Ciência" nos cartões) conferido no navegador, está na `ui-popup` sem commit próprio (o hook de sync commita). Novo pedido da equipe, repassado ao subagente do crafting (item 6):
  - Tecla `V` abre o INVENTÁRIO (minérios, itens, kits); tecla `P` abre a tela de RECEITAS/crafting; "voltar à base" passa para a tecla `B`.
  - A equipe quer SUBSTITUIR o sistema de peças pelos itens individuais e ter todos os minérios no lugar de só regolito. Desenho escolhido: "economia de crafting" atrás da chave `DEFAULT_ECONOMY` em `src/data/balance.js` (`'craft'` ou `'parts'`). Só jogo novo no Modo Colônia usa `'craft'`; modo história, testes, bots e apresentação automática continuam em `'parts'`. Em `'craft'`: estrutura com receita da equipe exige o kit fabricado; as sem receita têm custo em itens (`CRAFT_BUILD_COST`); melhorias e consertos cobram barra de ferro; naves e expedições entregam minérios. A receita da equipe é circular (minérios avançados só saem da broca avançada, que precisa deles), então o jogo começa com mesa de produção + broca básica e cada nave traz minérios avançados.
  - Entrega em dois commits na worktree do crafting: parte 1 (aditiva: brocas, kits opcionais, telas V e P) e parte 2 (economia de crafting). Se a parte 2 não passar nos testes ou travar o jogo no navegador, deixar `DEFAULT_ECONOMY = 'parts'` e publicar só a parte 1.
  - Se a sessão caiu: `git worktree list` mostra as cópias; `git log --oneline -3 <branch>` em cada uma mostra se o subagente commitou. Sem commit, o trabalho está só nos arquivos da worktree (`git -C <pasta> status`).
- Atualização 11h45: **primeiro lote NO AR** na `main` (pop-up de construção, árvore de tecnologias, modo apresentação `?demo=1`, nome "Protocol: Ares", bloco "Ciência"); conferido no site publicado, sem erro no console; testes verdes. Etiqueta de retorno: `estavel-1140`. Em andamento: (a) subagente na `ui-popup` escondendo o painel "Módulo" da direita quando não há estrutura selecionada (pedido da equipe); (b) worktree do mapa (`worktree-agent-acb730b0dafb79b36`); (c) worktree do crafting (`worktree-agent-abb84e67a5411360b`). As pastas ficam em `.claude/worktrees/` (ignoradas pelo Git).
- **Estado às 11h40 (relógio do PC; os horários anotados acima estavam adiantados):**
  - NO AR na `main`: tudo do primeiro lote + mapa novo (chão cor do solo com "+", 72 espaços, mundo largo com névoa) + crafting parte 1 (brocas básica/avançada, mesa de produção, construtora de módulos, kits, inventário na tecla V, fabricação na tecla P, "voltar à base" na tecla B). 62/62 testes; conferido no navegador em 3D, `?view=2d`, tela estreita e `?demo=1`, console sem erro. Etiquetas de retorno: `estavel-mapa` (mapa sem crafting) e `estavel-1140`.
  - Crafting é ADITIVO: kit fabricado constrói sem custo e na metade do tempo; o custo em peças continua valendo. A parte 2 ("economia de crafting", troca de peças por itens) NÃO foi terminada: ficou sem commit e pela metade na worktree `.claude/worktrees/agent-abb84e67a5411360b` (arquivos de `src/sim` modificados). Não publicar; dizer à equipe que a substituição total fica como "futuro".
  - Cosmético conhecido: em janela de ~800 px, no modo apresentação, o selo "APRESENTAÇÃO" cobre o botão "Cidade" da barra de baixo (a barra ganhou Inventário e Fabricar).
  - Depois: revisar `PROJECT_PAGE.md`, `REFERENCES.md`, `DEMO_SCRIPT.md` (falta citar mapa de 72 espaços e crafting), gravar demo, enviar até 13h45.
- **Estado às 12h25 (relógio do PC):** NO AR na `main`, conferido no navegador:
  - Domo maior e completo (oval que cobre os 72 espaços, casca até o chão; `dome.setBounds`) e botão "Ocultar domo / Mostrar domo" no HUD.
  - Apresentação em modo apresentador: `?demo=1` e o botão da tela inicial congelam o jogo a cada novidade e seguem com Espaço, Enter, seta direita ou o botão "Continuar"; mostra broca e fabricação; domo no sol 117. `?demo=auto` é a versão cronometrada antiga (no ensaio bateu o limite de 200 s no sol 166 sem mostrar o domo; para a banca usar `?demo=1`).
  - Economia de crafting LIGADA (`DEFAULT_ECONOMY = 'craft'` em `src/data/balance.js`): só jogo novo do Modo Colônia. Começa com mesa de produção + broca básica + itens iniciais (inclui 1 kit de painel solar); estrutura com receita da equipe exige o kit (tecla P); as outras custam itens; melhorias e consertos custam barras de ferro; receita nova "Peneirar regolito" (5 regolito -> 2 ferro, 1 silício, 1 alumínio, ASSUMPTION). História, testes, bots e apresentação continuam em `'parts'`. Para desligar: trocar para `'parts'` (uma linha). Balanceamento conferido por script e por um começo de partida no navegador, não por partida longa de uma pessoa; o kit de bateria só é alcançável depois da primeira nave.
  - Etiquetas de retorno: `estavel-domo` (domo + apresentação, sem economia de crafting), `estavel-crafting1`, `estavel-mapa`.
  - 12h30: na apresentação o HUD fica reduzido (só a barra de recursos; painéis laterais e barra de baixo escondidos por CSS em `css/demo.css`, classe `body.is-demo`) e a legenda virou uma faixa baixa.
  - Cosmético conhecido em janela estreita: a legenda da apresentação cobre parte do painel aberto atrás dela; o botão "Ocultar domo" pode ficar cortado na barra de cima.
- **Estado às 12h55 (relógio do PC):** NO AR na `main`, além do bloco das 12h25:
  - Apresentação: HUD reduzido (`css/demo.css`, `body.is-demo`); cada parada fica 10 s e segue sozinha (Espaço adianta). `?demo=1&t=20` muda os segundos; `?demo=manual` só avança na tecla; `?demo=auto` é a versão cronometrada antiga.
  - Vitória do domo: cena com faixas de cinema, "MISSÃO CUMPRIDA" e confete (`src/ui/victory.js`, `css/victory.css`), no jogo (pausa e botão "Continuar jogando") e na apresentação (fica no mínimo 8 s). No jogo normal só foi conferida chamando a cena pelo console, não com um domo construído à mão.
  - Chave "Queimar metano: sim/não" no HUD (aparece quando existe Reator Sabatier): ação `setMethaneBurn`, `state.methaneBurn`; desligada, o Sabatier fica em modo `hold` à noite e guarda o metano. Testes verdes; o botão em si não foi clicado no navegador (precisa de um Sabatier construído).
  - Tela inicial: `css/launch.css` põe Continuar / Novo jogo / Modo História / Iniciar apresentação no topo, maiores; dificuldade e extras abaixo.
  - Etiqueta de retorno antes deste lote: `estavel-1230`.
- 13h: reator de fissão deixou de ser único (`unique` removido em `balance.js`); revisão por script das 24 estruturas sem problemas; `README.md` em inglês (explicação do projeto + declaração de uso de IA, versão em inglês do `AI_USE.md`).
- 13h40: endereço "trailer" para gravar o vídeo de 30 a 45 s: `?demo=1&t=0.7&x=4` (x multiplica a velocidade entre paradas, até 6). Medido: vitória do domo aos 35 s, cartão final aos 39 s. O vídeo é gravado pela equipe com a gravação de tela do Windows; não há ffmpeg neste PC.
- 13h50: enquadramento do mapa corrigido em `reportInsets` (`src/main.js`): agora desconta também o painel Cidade (direita) e a barra de botões de baixo, então a área de construção inteira fica visível entre os painéis.
- Falta, sem código: revisar `PROJECT_PAGE.md`, `REFERENCES.md` e `DEMO_SCRIPT.md` (foram escritos fora desta sessão e ainda não cobrem a expansão), gravar a demo, enviar.
- Pendências conhecidas: texto de `err.notStaffable` não existe nos arquivos de idioma; domo fácil demais no Cadete (bot termina entre os sols 109 e 170); cerca de 30 fps no 3D com o mapa maior; capítulos 2 e 3 da história testados só por bot.
- Fora do escopo (dito à equipe como "futuro"): substituir peças por itens (economia de crafting), mapa 2500x, barras de qualidade de vida com taxas inventadas, casas e prédios.
- O primeiro commit do repositório (`1fdb3e7`) contém o primeiro nome do líder da equipe. Reescrever o histórico exige autorização dele; ainda não foi dada.

## Decisões

- `DESIGN.md` é a especificação; os Apêndices A a E são os contratos entre módulos.
- Núcleo é JS puro (sem DOM nem Three.js). Constantes científicas em `src/data/constants.js`, cada uma com fonte; valores de jogo em `src/data/balance.js`.
- Público declarado: 7 a 12 anos, mas a banca é adulta: simples sem ser bobo. Derrota é missão abortada, sem morte na tela.
- Textos novos entram em arquivos `ptN.js`/`enN.js` espalhados em `pt.js`/`en.js`; CSS novo em arquivo próprio ligado no `index.html`. Assim subagentes em paralelo não se atropelam.
- `AI_USE.md` é o relatório de uso de IA: atualizar a cada pedido novo (o que foi pedido, por quê, o que a IA fez, o que a equipe decidiu).

## Como rodar

- Jogo: `node tools/serve.mjs 8080` e abrir http://localhost:8080/ (`?view=2d` força o visual 2D; `?demo=1` inicia a apresentação automática, quando ela entrar).
- Testes: `node tests/run.mjs` (cerca de 90 s; `--report` mostra o balanceamento).
- Regenerar o catálogo DONKI: `node tools/fetch-donki.mjs`.

## Próximos passos

1. Receber os três subagentes, revisar, testar no navegador, juntar na `main`.
2. Abrir o site publicado em aba anônima e no PC da banca.
3. Atualizar página do projeto, referências e roteiro da demo; gravar; enviar até 13h45.
