# Base Sabiá — Junior Astronaut Mission Trainer (NASA Space Apps BH 2026)

Jogo web de gestão de colônia em Marte, voxel 3D, PT/EN, site estático sem build.

## Estado atual (dom 15/11, 9h)

- Pronto: núcleo da simulação (`src/sim`, 44 testes), HUD, visual 3D (`src/render3d`) com reserva 2D, eventos, tecnologias, expedições, naves, níveis Cadete/Comandante, painéis científicos com fonte, catálogo real do DONKI, salvamento, menu do Esc, botão "i".
- Em andamento: modo história (3 capítulos) e ajustes do Apêndice D (Sol real, conjunção solar).
- Falta: página do projeto em inglês, `REFERENCES.md`, declaração de uso de IA, demo.
- Submit: domingo até 13h45. Congelar código às 11h.

## Decisões

- `DESIGN.md` é a especificação; os Apêndices A a D são os contratos entre módulos.
- Núcleo é JS puro (sem DOM nem Three.js). Constantes científicas em `src/data/constants.js`, cada uma com fonte; valores de jogo em `src/data/balance.js`.
- Público declarado: 7 a 12 anos. Derrota é missão abortada, sem morte na tela.
- Toda a equipe é menor de idade: demo sem rosto, voz ou nome.
- Repositório público porque o GitHub Pages gratuito exige.

## Como rodar

- Jogo: `node tools/serve.mjs 8080` e abrir http://localhost:8080/ (`?view=2d` força o visual 2D).
- Testes: `node tests/run.mjs` (`--report` mostra o balanceamento).
- Regenerar o catálogo DONKI: `node tools/fetch-donki.mjs`.

## Próximos passos

1. Fechar a história e conferir no navegador.
2. Deploy no Pages e teste em aba anônima.
3. Página do projeto, referências, declaração de IA, demo, submit.
