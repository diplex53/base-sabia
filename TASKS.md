# TASKS — Base Sabiá

Horários em Brasília. Responsáveis: **ARQ** (arquiteto/orquestrador), **S** (subagente sonnet), **O** (subagente opus), **GAB** (líder da equipe), **EQ-1..5** (equipe não-programadora, ver seção final).
Regra: cada subagente é dono de arquivos diferentes. Dois agentes nunca editam o mesmo arquivo ao mesmo tempo.

## Checkpoints

| Quando | O que precisa estar verdadeiro |
|---|---|
| Sáb 16h | Fase 1: jogável do começo ao fim com números na tela; testes Node passando; link do Pages no ar |
| Sáb 20h | Fase 2: 3D reagindo ao estado. **Decisão do plano B**: se o 3D não estiver jogável, o `view2d` vira o visual oficial |
| Sáb 23h | Fase 3: eventos, painéis científicos, história (3 capítulos), colônia com pontuação, PT/EN |
| Dom 10h | Fase 4: balanceado, sem bug bloqueante, contraste e leitura ok |
| Dom 11h30 | Fase 5: Pages verificado em aba anônima; página do projeto, referências e declaração de IA em rascunho |
| Dom 13h45 | **Submit feito** (meta interna: 13h15) |
| Dom 14h30 | Banca local |

## Fase 0 — Preparação (sáb até 12h45)

| ID | Tarefa | Resp. | Depende | Alvo |
|---|---|---|---|---|
| 0.1 | `DESIGN.md` + ok do líder da equipe | ARQ, GAB | — | 12h45 |
| 0.2 | Validar constantes e a aba Resources do desafio | S ×3 (rodando) | — | 12h45 |
| 0.3 | Fechar a tabela de constantes com o resultado de 0.2 | ARQ | 0.2 | 13h00 |
| 0.4 | Git + repositório no GitHub (`diplex53`) + Pages ligado | ARQ, GAB (decide público/privado) | 0.1 | 13h00 |

## Fase 1 — Núcleo jogável (sáb 12h45–16h)

| ID | Tarefa | Resp. | Depende | Alvo |
|---|---|---|---|---|
| 1.1 | Esqueleto: `index.html`, `package.json`, pastas, import map, Three.js copiado para `src/vendor/`, servidor local | S | 0.1 | 13h10 |
| 1.2 | `src/data/constants.js` (com fonte e URL em cada valor) e `src/data/balance.js` | S | 0.3 | 13h20 |
| 1.3 | Núcleo `src/sim/`: estado, `tick`, barramento de energia, O2/água/comida, radiação de fundo, construção, upgrades, colonos sem profissão, tolerâncias e fim de jogo | O | 0.1, 1.2 | 14h30 |
| 1.4 | `tests/run.mjs`: invariantes, calibração, bot parado e bot competente | S | interface de 0.1 (paralelo a 1.3) | 14h45 |
| 1.5 | HUD mínimo em DOM + `render2d/view2d.js` (grade de slots clicável) + `i18n` com PT | S | interface de 0.1 (paralelo a 1.3) | 15h00 |
| 1.6 | Integração `main.js`, loop, pausa e 1x/2x/4x | O | 1.3, 1.5 | 15h30 |
| 1.9 | `src/data/donkiEvents.js`: baixar eventos reais do DONKI (erupções e partículas solares, 2010–2026), curar ~30, registrar data de extração e URL; testar se a API responde do navegador (CORS) | S | 0.1 (paralelo) | 14h30 |
| 1.7 | Revisão contra a especificação: jogar uma partida inteira, rodar testes | ARQ | 1.6 | 15h45 |
| 1.8 | Primeiro deploy no Pages, conferido em aba anônima | ARQ | 0.4, 1.7 | 16h00 |

## Fase 2 — Renderer voxel 3D (começa 13h, em paralelo; checkpoint 20h)

| ID | Tarefa | Resp. | Depende | Alvo |
|---|---|---|---|---|
| 2.1 | `render3d/`: terreno, câmera isométrica, slots clicáveis, os 8 módulos em voxel por nível, contra um estado de exemplo | O | 0.1, 1.1 | 16h00 |
| 2.2 | Reações ao estado: aceso/apagado, poeira, alerta piscando, obra, dia/noite, céu por `tau` | O | 2.1 | 17h30 |
| 2.3 | Ligar o 3D ao jogo real (`main.js` escolhe 3D ou 2D; fallback automático sem WebGL) | O | 1.6, 2.2 | 18h30 |
| 2.4 | Efeitos: tempestade de poeira, rover, nave pousando, colonos | O | 2.3 | 19h30 |
| 2.5 | Revisão e **decisão do plano B** | ARQ, GAB | 2.3 | 20h00 |

## Fase 3 — Conteúdo e sistemas (sáb 16h–23h)

| ID | Tarefa | Resp. | Depende | Alvo |
|---|---|---|---|---|
| 3.1 | Eventos (6 tipos), RNG semeado, dificuldade crescente | O | 1.6 | 17h30 |
| 3.2 | Painéis científicos: `sciencePanels.js`, modal, Caderno de Ciência | S | 3.1, textos de EQ-2 | 18h30 |
| 3.3 | Profissões + naves de colonos + regra de desembarque | O | 3.1 | 19h00 |
| 3.4 | Árvore de tecnologias (8 itens) | S | 3.1 | 19h30 |
| 3.5 | Expedições | O | 3.3 | 20h30 |
| 3.6 | Modo história: diretor de capítulos, objetivos, cenas, tutorial | O | 3.1, 3.3 | 21h30 |
| 3.7 | Modo colônia: pontuação, tela final, marco de autossuficiência, salvar no navegador | S | 3.3 | 21h30 |
| 3.8 | `en.js` completo + botão de idioma | S | textos fechados | 22h00 |
| 3.11 | Widget "O Sol hoje": consulta ao vivo ao DONKI, rótulo ao vivo/arquivo, atraso de comunicação no HUD | S | 1.9 | 19h00 |
| 3.12 | Meta esticada: `data/terrain.js` com o relevo real do local (Mars Trek). Corta sem dó se atrasar | S | 2.1 | 21h00 |
| 3.13 | Níveis Cadete/Comandante e botão "O que faço agora?" (ajuda da ARA) | S | 1.6 | 18h00 |
| 3.9 | Testes dos sistemas novos + bot roteirizado dos 3 capítulos | S | 3.6 | 22h30 |
| 3.10 | Revisão geral, deploy, verificação | ARQ | tudo | 23h00 |

Ordem de corte se atrasar: polimento visual → capítulo 3 → expedições viram botão → tecnologias reduzidas a 3 → profissões reduzidas a 2 → dificuldade crescente → velocidade 4x.

## Fase 4 — Balanceamento e acabamento (dom 8h–10h)

| ID | Tarefa | Resp. | Alvo |
|---|---|---|---|
| 4.1 | Rodar bots em 50 sementes, ajustar `balance.js` | ARQ + S | 9h00 |
| 4.2 | Corrigir bugs da lista da EQ-4 | S / O | 9h30 |
| 4.3 | Acessibilidade: contraste, tamanho de fonte, foco por teclado, não quebrar em 375 px | S | 9h45 |
| 4.4 | Revisão final das constantes: nenhuma `ASSUMPTION` sem justificativa | ARQ + EQ-1 | 10h00 |

## Fase 5 — Entrega (dom 10h–11h30)

| ID | Tarefa | Resp. | Alvo |
|---|---|---|---|
| 5.1 | Deploy final, teste em aba anônima e no celular | ARQ, GAB | 10h30 |
| 5.2 | Página do projeto em inglês (rascunho a partir do `DESIGN.md`) | S, revisão EQ-3 | 11h00 |
| 5.3 | `REFERENCES.md` (dados, bibliotecas, imagens, textos) + declaração de uso de IA | S, revisão EQ-1 | 11h15 |
| 5.4 | Congelar o código. Só correção de bug bloqueante depois disso | GAB | 11h30 |

## Dom 11h30–13h45 — Demo e submit

| ID | Tarefa | Resp. | Alvo |
|---|---|---|---|
| 6.1 | Gravar a tela (30 s) seguindo o roteiro; legendas em EN | EQ-5, GAB opera o jogo | 12h15 |
| 6.2 | Subir o vídeo ou os slides em link público sem senha; testar em aba anônima | EQ-5 | 12h45 |
| 6.3 | Preencher e enviar a página do projeto | GAB + EQ-3 | **13h15** |
| 6.4 | Ensaio do pitch (problema → solução → como funciona → futuro) | EQ-5 + todos | 14h00 |

## Equipe não-programadora

Distribuam os cinco papéis entre vocês. Entregas em um documento compartilhado; o líder da equipe repassa.

**EQ-1 — Pesquisa e validade científica**
- Sáb até 17h: para cada item marcado `ASSUMPTION` na seção 13 do `DESIGN.md`, achar uma fonte NASA ou artigo que dê o número real, ou confirmar que não existe. Entregar: constante, valor, URL, trecho.
- Sáb até 15h, prioridade: achar a página da NASA/JPL que dá os 22 Wh e os 645 Wh do Opportunity em junho de 2018 (hoje só temos a Planetary Society), e o artigo original da poeira no Mars Pathfinder (0,28% por sol, Landis & Jenkins).
- Sáb até 17h: no Mars Trek (trek.nasa.gov/mars), marcar o local da base em Arcadia Planitia e anotar latitude, longitude e elevação. No RadLab, anotar uma taxa de dose medida na ISS (instrumento, data, valor, unidade) para o painel de comparação.
- Sáb até 21h: conferir cada painel científico contra a fonte (número, data, nome da missão).
- Dom 10h–11h15: revisar o `REFERENCES.md`.

**EQ-2 — Roteiro e textos em português**
- Sáb até 17h: reescrever as cenas dos 3 capítulos (seção 12) em linguagem para 7–12 anos: frases de até 12 palavras, uma ideia por frase. Até 6 cenas, 3 frases cada.
- Sáb até 18h: texto dos painéis científicos (o ARQ entrega a lista com os dados): título + 2 ou 3 frases + "Você sabia?".
- Sáb até 20h: nomes e uma linha de biografia de 12 colonos fictícios, diversos, sem pessoas reais.

**EQ-3 — Inglês**
- Sáb 20h–22h: revisar `en.js` (tradução feita por subagente) lendo dentro do jogo.
- Dom 10h–11h: revisar a página do projeto em inglês.
- Dom até 12h15: legendas em EN do vídeo.

**EQ-4 — Testes de jogo**
- Jogar a cada checkpoint (sáb 16h, 20h, 23h; dom 9h). Anotar: o que fiz, o que esperava, o que aconteceu, navegador.
- Testar em celular e em um PC fraco.
- Se possível, colocar 1 ou 2 crianças de 10 a 14 anos para jogar 10 minutos e anotar onde travam e o que aprenderam. Isso vira evidência de impacto no pitch (sem nome nem foto da criança).

**EQ-5 — Pitch e demo**
- Sáb até 19h: escolher 6 a 8 fotos reais da NASA para as cenas (images.nasa.gov ou photojournal.jpl.nasa.gov), anotando título, ID e crédito. Nada com logo da NASA.
- Sáb até 22h: roteiro do vídeo de 30 s, segundo a segundo, e estrutura de até 7 slides.
- Dom: gravação, legendas, upload e ensaio.
- Restrição: toda a equipe é menor de idade, então a demo não tem rosto, voz nem nome de ninguém. Formato: gravação de tela do jogo com legendas em inglês (e trilha livre de direitos, com crédito), ou slides. Nos créditos da demo, só o nome da equipe.

## Pendências que dependem do líder da equipe

1. ~~Ok no `DESIGN.md`~~ dado às ~13h.
2. ~~Faixa etária~~: 7 a 12 anos, como o desafio.
3. **Repositório público no GitHub: ainda não autorizado.** Sem ele não há Pages; as tarefas 0.4, 1.8 e 5.1 estão bloqueadas. Limite para decidir sem risco: sábado 20h.
4. ~~Narração~~: todos menores; demo sem voz, sem rosto, sem nomes.

## Regras do evento conferidas no site (14/11)

- Demo: vídeo de até 30 s **ou** até 7 slides, em link público sem login. Inglês obrigatório na página e nos slides; vídeo pode ser falado em português com legendas em inglês.
- Uso de IA: declarar como foi usada; imagens e vídeos gerados por IA levam marca d'água visível; código e dados gerados por IA são reconhecidos no texto. A IA não pode ter criado a ideia da solução (a ideia e as decisões são do líder da equipe e da equipe).
- Conteúdo gerado por IA não pode conter logo, bandeira ou identificador de missão da NASA.
- Para prêmio global: usar pelo menos um dado ou recurso da NASA e listar todos na submissão.
