# Uso de IA no projeto Protocol: Ares / AI use in Protocol: Ares

## Summary (English)

We used a generative AI assistant (Claude, by Anthropic, through the Claude Code desktop app) as a software architect and programmer under the direction of the team. The team decided what the game is, which features it has, who it is for and what was cut; the AI proposed the technical design, looked up and cross-checked the public NASA numbers, wrote the code through sub-agents, wrote automated tests and reviewed the result. Every scientific constant in the game is stored with its source and link in `src/data/constants.js`, and values we could not source are marked `ASSUMPTION`. No AI-generated images, video, voice or music are used: the visuals are drawn by code (voxels in Three.js). All in-game text was drafted with AI and read by the team.

## Ferramenta

- Assistente: Claude (Anthropic), no aplicativo Claude Code, com subagentes de dois tamanhos de modelo: um para tarefas difíceis (simulação, visual 3D, integração) e um mais leve para tarefas de especificação clara (telas, estilo, traduções).
- Não usamos IA para gerar imagem, vídeo, voz ou música. Não há marca-d'água a aplicar porque não há mídia gerada por IA.

## Como dividimos o trabalho

| Quem | O que fez |
|---|---|
| Equipe | Ideia do jogo, público, lista de recursos, lista de estruturas, o que entra e o que fica para depois, testes jogando, pedidos de mudança, apresentação |
| IA como arquiteta | Documento de projeto (`DESIGN.md`), modelo matemático da simulação, escolha e conferência dos dados da NASA, divisão do código em módulos, revisão do que os subagentes entregaram |
| IA como programadora (subagentes) | Código do núcleo da simulação, interface, visual 3D e 2D, textos em português e inglês, testes automáticos, publicação no GitHub Pages |

## Registro dos pedidos

Cada linha: o que pedimos, por que pedimos, o que a IA fez.

| Quando | Pedido da equipe | Por quê | O que a IA fez |
|---|---|---|---|
| Sáb 14/11, início | Planejar o jogo a partir do nosso resumo: base em Marte, tempo real, recursos (energia, oxigênio e água, comida, radiação), colonos, naves, expedições, tecnologias, modo história, painel de ciência depois de cada evento | Só uma pessoa da equipe programa; precisávamos de um plano que coubesse no fim de semana | Escreveu `DESIGN.md` e `TASKS.md`, com ordem de corte caso faltasse tempo |
| Sáb | Usar números reais | Critério de validade científica e uso central de dados da NASA | Levantou e conferiu as constantes (energia solar medida pela InSight, queda na tempestade da Opportunity, MOXIE, consumo de oxigênio, água e comida por tripulante, dose de radiação do RAD/Curiosity, limite de 600 mSv) e guardou cada uma com fonte e link |
| Sáb | Fazer o núcleo da simulação separado da tela | Poder testar as contas sem abrir o jogo e ter um visual 2D de reserva | Subagentes escreveram `src/sim` em JS puro e os testes em `tests/` |
| Sáb | Interface e visual 3D em voxel | É o que a criança vê; precisava ser claro e bonito | Subagentes fizeram o HUD, os painéis e o visual em Three.js, com reserva 2D |
| Sáb | Mostrar o jogo assim que desse para jogar | A equipe queria testar e opinar cedo | Subiu o jogo local e depois publicou no GitHub Pages |
| Sáb | Conferir se o projeto segue a página do desafio | Não fugir do enunciado | Comparou com o desafio e propôs quatro ajustes, aceitos pela equipe: usar o DONKI (clima espacial) como dado central, modo "Sol real", tela "Dados da NASA", painéis ligados a RadLab e OSDR |
| Sáb | Eventos, níveis de dificuldade, abrigo, profissões, naves, tecnologias, expedições | Dar decisões de verdade ao jogador | Especificou (Apêndice B) e delegou a implementação; testes com jogadores simulados para acertar o equilíbrio |
| Sáb/Dom | Modo história em três capítulos | Ensinar passo a passo antes do modo livre | Especificou (Apêndice C) e delegou |
| Dom 15/11, manhã | Lista grande de mudanças da equipe: mapa maior, pressurizador, controle térmico, mina, domo, academia, escudo antirradiação, descontaminação, fábrica, armazém, filtro de água, hospital, Sabatier, menu do Esc, painel da cidade, botão "i" com DONKI e OSDR, tecla V, descrições no clique direito | Ideias dos colegas que não programam | Implementou o que cabia no prazo (Apêndice E): mapa de 36 espaços, 12 estruturas, saúde da colônia, domo como objetivo, painel Cidade. Avisou o que não cabia (crafting com minérios, mapa 2500 vezes maior, barras com taxas sem fonte) e isso ficou como "futuro" |
| Dom, 10h50 | Relatório de uso de IA, atualizado conforme o uso | Regra do evento: declarar o uso de IA | Este arquivo |
| Dom, 10h50 | Construção em pop-up no meio da tela, com botão X | A lista no canto era pequena e exigia rolagem | Delegado a subagente |
| Dom, 10h50 | Tecnologias como árvore de bolinhas ligadas | Ficar mais claro o que libera o quê | Delegado a subagente |
| Dom, 10h55 | Modo apresentação que joga sozinho, com legendas | A equipe não pode jogar ao vivo na frente da banca; a banca abre o link e a equipe comenta | Delegado a subagente |
| Dom, 11h | Manter um arquivo de estado no computador para continuar em outra conta | O limite de uso da conta pode acabar | `CLAUDE.md` atualizado a cada etapa |
| Dom, 11h10 | Descrição científica que a equipe escreveu em cada cartão de construção | Mostrar a ciência no momento em que o jogador escolhe o que construir | Subagente usou os textos da equipe (`docs/lista-equipe.txt`), corrigindo ortografia e os pontos cientificamente imprecisos |
| Dom, 11h10 | Trocar o nome para "Protocol: Ares" | Decisão da equipe | Subagente trocou o título; a base dentro da história segue como Base Sabiá |
| Dom, 11h10 | Chão de construção da cor do solo com um "+", área de construção 2 vezes maior, mundo cerca de 50 vezes maior | O concreto cinza destoava e o mapa parecia pequeno | Subagente em cópia separada do código; o mundo maior é só visual (terreno distante simples e névoa) para não derrubar a fluidez |
| Dom, 11h10 | Brocas, minérios e sistema de crafting com as receitas da equipe | Ideia central dos colegas que não programam | Subagente em cópia separada. Decisão da IA, por causa do prazo: o crafting entra como caminho adicional (kit fabricado constrói sem custo e mais rápido) em vez de substituir o sistema de peças, para não quebrar o modo história nem os testes |
| Dom, 11h25 | Inventário na tecla V, receitas na tecla P, e substituir o sistema de peças pelos itens e minérios da lista | A equipe quer que o jogo final use o sistema de recursos que ela desenhou | Repassado ao subagente do crafting. A IA apontou que as receitas eram circulares (a broca avançada precisa de minérios que só ela extrai) e propôs a correção: começar com mesa de produção e broca básica, e as naves trazem minérios avançados. A troca fica atrás de uma chave para poder voltar ao sistema antigo se não der tempo de testar |
| Dom, 11h40 | Tirar o painel "Módulo" da direita | Ficou sem função depois que a construção virou pop-up | Subagente esconde o painel quando não há estrutura selecionada; ele só aparece para melhorar, ligar ou consertar uma estrutura |
| Dom, 11h40 | Publicar o mapa de 72 espaços e o crafting | Pedidos da equipe prontos e testados | A IA juntou, rodou os 62 testes e conferiu no navegador antes de publicar. Entrou a parte aditiva do crafting (brocas, mesa de produção, kits, inventário e fabricação). A troca completa do sistema de peças pelos itens não ficou pronta a tempo de ser testada e não foi publicada |

## O que a IA não decidiu

- O tema, o público, os recursos e as estruturas do jogo vieram da equipe.
- A equipe aprovou ou recusou cada proposta de mudança de escopo.
- A equipe jogou, apontou o que estava ruim (por exemplo, o menu de construção no canto) e pediu as correções.

## Limites e cuidados

- Números de jogo que não têm fonte (custos, tempos de obra, pontuação) ficam em `src/data/balance.js`, separados das constantes científicas, e os sem fonte levam a marca `ASSUMPTION`.
- A IA pode errar: por isso há 62 testes automáticos do núcleo e conferência no navegador antes de publicar.
- Nenhum dado pessoal dos participantes foi colocado no jogo ou na demo.
