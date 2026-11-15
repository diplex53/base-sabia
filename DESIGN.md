# DESIGN — Base Sabiá: Junior Astronaut Mission Trainer

NASA Space Apps Belo Horizonte 2026 · desafio "Build a Junior Astronaut Mission Trainer"
Status: **rascunho v1, aguardando ok do líder da equipe**. Código em inglês, textos do jogo em PT/EN.

## 1. Conceito em uma frase

Jogo web de gestão de colônia em Marte, em voxel 3D, para estudantes de 10 a 14 anos: cada número do jogo vem de uma medição real da NASA, e toda falha termina com um painel curto que explica o porquê com o dado e a fonte.

Pilares para a banca:
- **Impacto**: roda em qualquer navegador, sem instalar, sem login, em PT e EN. Serve para sala de aula em escola pública (PC fraco ou celular).
- **Criatividade**: o "Caderno de Ciência" — o jogador coleciona explicações reais ao falhar. Errar ensina.
- **Validade**: núcleo de simulação separado, testado em Node, com constantes citadas uma a uma.
- **Relevância**: os dados da NASA são as regras do jogo (dose do RAD, tau do Opportunity, energia por kg de O2 do MOXIE), não enfeite.

### O que a página oficial do desafio pede (lida em 14/11)

Fonte: https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/

- Público do desafio: **7 a 12 anos** (com abertura para irmãos mais velhos, pais e sala de aula). Adotado como público do jogo (seção 16).
- Decisões que o desafio cita: suporte à vida, blindagem contra radiação, orçamento de energia, produção de comida e **atraso de comunicação**.
- "Nenhuma escolha pode ser grátis"; mecânica vale mais que visual; dado real da NASA vale mais que número inventado; citar as fontes **dentro do jogo**; não apresentar dado estático como se fosse ao vivo.
- Alerta do próprio desafio: 2 ou 3 recursos centrais costumam funcionar melhor que 5 ou 6 para crianças. Nosso jogo tem mais: a história libera um recurso por vez e o HUD destaca só quatro (energia, O2/água, comida, radiação).
- Destaques pedidos: ligar a decisão de blindagem ao clima espacial real; rejogabilidade; explicação curta de quais dados NASA foram usados.

### Recursos da aba Resources e como entram no jogo

Usar pelo menos um é obrigatório para concorrer globalmente. Usamos quatro, dois deles como mecânica.

| Recurso (aba Resources) | Uso no jogo | Peso |
|---|---|---|
| **DONKI** (clima espacial) — https://ccmc.gsfc.nasa.gov/tools/DONKI/ | Toda tempestade solar do jogo é um evento real do catálogo DONKI (data, classe da erupção). Conjunto curado embutido no repositório + widget "O Sol hoje" com consulta ao vivo, rotulado como ao vivo ou arquivo | **central** |
| **NASA Open APIs** — https://api.nasa.gov/ | Testado em 14/11: o endpoint de erupções (`/DONKI/FLR`) responde 404 e a chave de demonstração só dá ~10 consultas por hora. Usamos o serviço do próprio DONKI (`https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR`), sem chave e liberado para qualquer origem | só referência |
| **Mars Trek** — https://trek.nasa.gov/mars/ | Local da base escolhido no Mars Trek (coordenadas reais); relevo do terreno voxel derivado da elevação real, se der tempo | médio (parte é meta esticada) |
| **RadLab** (dosimetria da ISS) — https://visualization.osdr.nasa.gov/radlab/gui/data-api/ | Painel científico "ISS × viagem × superfície de Marte" com dose medida real | painel |
| OSDR; kit de produção de comida da CSA | Referência nos painéis de saúde e da estufa | opcional |

Os demais dados (Curiosity/RAD, Mars Fact Sheet, Opportunity, InSight, MOXIE) continuam como base do modelo e entram nas referências.

## 2. Loop do jogo

```
observar recursos e previsão  ->  decidir (construir, ligar/desligar, alocar colonos, expedição, pesquisa)
        ^                                                  |
        |                                                  v
painel científico explica  <-  evento ou falha  <-  o tempo corre (dia/noite, poeira, radiação)
```

- Ciclo curto (segundos): dia e noite. Painéis só geram de dia; a bateria segura a noite.
- Ciclo médio (minutos): construir, fazer upgrade, mandar expedição, sobreviver a um evento.
- Ciclo longo (26 sols): chega a nave de reabastecimento. Só desembarca quem a base sustenta.
- Meta: colônia autossuficiente ("Marte funcionando de verdade").

## 3. Tempo

- **1 sol = 24 s reais em 1x** (1 segundo ≈ 1 hora marciana; o sol real tem 24,66 h). Velocidades: pausa, 1x, 2x, 4x.
- Tempo interno `t` em sols (float). Sol exibido = `floor(t) + 1`. Passo fixo de simulação `H = 1/96 sol` (≈ 15 min marcianos), determinístico.
- Luz do dia: `sun(f) = max(0, sin(π·(f − 0.25)/0.5))`, com `f` = fração do sol. Nascer em `f = 0.25`, pôr em `f = 0.75`. A integral num sol é `1/π`.
- **Pausa automática** em alertas importantes (tempestade, recurso acabando, nave chegando), para a criança ter tempo de decidir. Pode ser desligada.
- **Atraso de comunicação**: o HUD mostra o atraso Terra–Marte (4 a 20 min segundo a NASA, variando ao longo do ciclo de 26 sols: `delay = 4 + 16·(1 − cos(2π·t/26))/2`). O aviso de tempestade solar vem da Terra, então o tempo de aviso útil é `aviso − atraso`. Com Marte longe, sobra menos tempo para abrigar.

### Onde o jogo comprime a realidade (declarado no jogo e no pitch)

| Realidade | Jogo | Motivo |
|---|---|---|
| Janela Terra–Marte a cada ~26 meses (~759 sols) | nave a cada **26 sols** (1 sol de jogo por mês de espera) | sessão de 15–30 min |
| Tempestade global dura meses (2018: ~100 sols) | 6 a 10 sols | idem |
| Grandes tempestades solares: poucas por ciclo solar | uma a cada ~20 sols | o jogador precisa viver o evento |
| Construir um módulo leva semanas | 1 a 4 sols | idem |

As taxas físicas **por sol** (dose, consumo humano, energia por kg de O2, geração por m²) não são comprimidas.

## 4. Recursos

| Recurso | Unidade | Estoque | Observação |
|---|---|---|---|
| Energia | kWh | carga das baterias | geração e consumo em kWh/sol |
| Oxigênio | kg | tanque | |
| Água | kg | tanque | |
| Comida | kg (massa seca) | despensa | |
| Regolito | unidades | pilha | construção e blindagem |
| Peças | unidades | depósito | vêm da Terra e de minerais |
| Ciência | pontos | — | moeda da árvore de tecnologias |
| Dose de radiação | mSv **por colono** | acumulada, nunca diminui | limite de carreira NASA: 600 mSv |

No HUD cada recurso mostra estoque, saldo por sol e **autonomia em sols** ("O2: 14 kg · dura 4,1 sols"). A autonomia é o número que a criança lê.

## 5. Modelo matemático

Notação: taxas em unidade/sol; `dt` em sols; `pop` = colonos ativos na base ou em expedição.

### 5.1 Energia

Geração de um painel solar (kWh/sol, instantânea):

```
gen_solar = area_m2 · SOLAR_YIELD_CLEAR · π · sun(f) · f_tau(tau) · (1 − dust) · staffBonus
f_tau(tau) = min(1, exp(−K_TAU · (tau − TAU_CLEAR)))
K_TAU = ln(645 / 22) / (10.8 − TAU_CLEAR) ≈ 0.328      (TAU_CLEAR = 0.5)
```

- `SOLAR_YIELD_CLEAR` ≈ 0,63 kWh/m²/sol: derivado do InSight (4.588 Wh no sol 1; dois painéis de 2,15 m de diâmetro, ≈ 7,3 m² de disco pela nossa conta; a NASA não publica a área). Âncora empírica: não precisamos supor eficiência de célula.
- `f_tau` é um ajuste exponencial de dois pontos nos dados do Opportunity em 2018 (≈ 645 Wh/sol com céu normal → ≈ 22 Wh/sol com tau 10,8). `// ASSUMPTION:` forma exponencial. O tau 10,8 é do JPL; os 645 e 22 Wh só foram achados no relatório da Planetary Society, falta a fonte NASA (pendência EQ-1).
- Reator de fissão (tecnologia): `gen = kWe · 24.66` kWh/sol, constante, imune a poeira e noite.

Poeira nos painéis: `d(dust)/dt = DUST_RATE · stormMult · edsMult`, com `DUST_RATE = 0.0028/sol` (Mars Pathfinder), `stormMult` = 1 / 5 / 10 (limpo / regional / global, `// ASSUMPTION:`), `edsMult` = 0.2 com a tecnologia EDS. `dust` satura em 0.8. Ação "limpar" zera a poeira de um painel; redemoinhos (evento) também limpam.

Barramento, a cada passo:

```
net = Σgen − Σuse(módulos ligados e alimentados)
battery = clamp(battery + net·dt, 0, capacity)
```

Se a bateria zeraria: corte automático de carga na ordem **estufa → extrator de gelo → MOXIE → habitat** até `Σuse ≤ Σgen`. Módulo cortado fica `unpowered` (produção zero) e só religa com bateria ≥ 5% da capacidade (histerese). O jogador pode desligar qualquer módulo à mão, a qualquer momento, para guardar energia (habitat não desliga).

### 5.2 Oxigênio

```
d(o2)/dt = Σ moxie.rate · staffBonus  (+ bônus da estufa com a tecnologia bioregenerativa)  −  pop · O2_PER_CREW_SOL
moxie.use_energy = moxie.rate · MOXIE_KWH_PER_KG
```

- `O2_PER_CREW_SOL = 0.816 kg/dia · 1.0275 ≈ 0.84 kg/sol` (NASA BVAD, Tabela 3-33; dia terrestre → sol).
- `MOXIE_KWH_PER_KG = 300 W / 12 g/h = 25`: medido no MOXIE (pico de 12 g/h, 300 W). Gasta muita energia; isso é real e é a lição.
- Tecnologia bioregenerativa: 20–25 m² de cultivo suprem o O2 de uma pessoa (Wheeler, NASA KSC), então `o2_estufa = area / 22.5 · O2_PER_CREW_SOL`.

### 5.3 Água

```
d(water)/dt = Σ extractor.rate − pop · WATER_GROSS · (1 − recycle) − Σ greenhouse.area · GH_WATER_PER_M2
```

- `WATER_GROSS = 4.48 kg/dia · 1.0275` por pessoa (BVAD, Tabela 4-20, "base planetária inicial": 2,5 kg para beber e preparar comida, o resto é higiene).
- `recycle` = 0.93 (ISS antes de 2023) → 0.98 com a tecnologia (ISS com o Brine Processor, 2023).
- `GH_WATER_PER_M2` = 0,1 kg/m²/sol (`// ASSUMPTION:` perda líquida de irrigação).
- Energia do extrator: 1 kWh/kg. `// ASSUMPTION:` o mínimo físico para derreter gelo a −60 °C é ≈ 0,13 kWh/kg; o resto é escavação e perdas.

### 5.4 Comida

```
d(food)/dt = Σ greenhouse.area · CROP_YIELD · growth · staffBonus · techBonus − pop · FOOD_PER_CREW_SOL
```

- `CROP_YIELD` = 21,06 g seco/m²/dia (batata, BVAD Tabela 4-97); `FOOD_PER_CREW_SOL` = 0,617 kg seco/dia · 1.0275 (BVAD Tabela 4-57). Consequência: ~30 m² de batata por pessoa; a NASA fala em 40–50 m² para uma dieta completa.
- Energia da estufa: `CROP_YIELD / 10 g/kWh ≈ 2,1 kWh/m²/dia` (melhor caso da faixa de 1,6–10 g de biomassa por kWh do BVAD). Alimentar uma pessoa custa ~65 kWh/sol, o triplo do O2 dela (~21 kWh/sol). `// ASSUMPTION:` usamos o melhor caso; uma câmara só com lâmpadas chega a 2,6 kW/m² (BVAD Tabela 4-95), o que vira painel científico.
- `growth` vai de 0 a 1 em 3 sols depois de construir (`// ASSUMPTION:` ciclo comprimido). Estufa sem energia por mais de 1 sol: a colheita morre e `growth` volta a 0.
- No começo a base vive da comida trazida da Terra; a estufa é o caminho para a autossuficiência.

### 5.5 Radiação (por colono)

```
d(dose)/dt = GCR_SURFACE · shieldGCR(local) · alara  +  speRate(t) · shieldSPE(local) · alara
```

- `GCR_SURFACE = 0.67 mSv/dia · 1.0275 ≈ 0.69 mSv/sol` (Curiosity/RAD, média ago/2012–jun/2013, comunicado NASA).
- Dose inicial de todo colono: **≈ 324 mSv**, a dose da viagem (1,8 mSv/dia medido pelo RAD em cruzeiro × 180 dias da missão de referência). A barra já começa acima da metade: a viagem custa mais que a estadia. Confere com a NASA: ~1 Sv na missão completa (ida 180 d + 500 d na superfície + volta 180 d).
- Fatores de blindagem (`// ASSUMPTION:` valores de jogo, a calibrar com a pesquisa):

| Local | shieldGCR | shieldSPE |
|---|---|---|
| Expedição (rover) | 1.0 | 1.0 |
| Habitat nível 1 / 2 / 3 | 0.8 / 0.7 / 0.6 | 0.5 |
| Abrigo de regolito | 0.5 | 0.1 |

- `alara = 0.85` com um médico na base (princípio ALARA da NASA; o valor é `// ASSUMPTION:`).
- Tempestade solar: cada uma é um **evento real do DONKI** (`src/data/donkiEvents.js`: data, classe da erupção, link). A dose total sem blindagem depende da classe:
  - moderada (maioria): 1–5 mSv em 2 sols. Âncora: em set/2017 o RAD mediu mais que o dobro da radiação na superfície por mais de 2 dias.
  - severa (classes mais altas): 20–100 mSv em 1 sol. Âncora: eventos de 1956, 1960 e 1972 modelados na superfície de Marte (NASA TP-2979: 80–100, 50–70 e 20–50 mSv).
  - `// ASSUMPTION:` a regra "classe da erupção → dose em Marte" é nossa; a intensidade real depende de mais fatores. Dito no painel.
- Aviso: 0,1 sol (≈ 2,5 h; a NASA fala em dezenas de minutos a horas), menos o atraso de comunicação. Com a tecnologia de alerta: 1 sol.
- **Ao atingir 600 mSv o colono não morre**: ele é afastado (para de trabalhar, continua consumindo) e volta para a Terra na próxima nave. Isso é o que o limite significa de verdade: risco de câncer na carreira, não dose letal.

### 5.6 Ciência e pontuação

```
d(science)/dt = 0.5 · pop      (+5 por expedição concluída, +3 por evento observado)
score = 10·sols + 100·popMáxima + 150·tecnologias + 20·painéisCientíficosVistos
```

## 6. Módulos (slots fixos, 16 no mapa)

Valores de jogo (ficam em `src/data/balance.js`, separados das constantes científicas). Serão ajustados na Fase 4 com os testes.

| Módulo | Nível 1 / 2 / 3 | Consumo (kWh/sol) | Custo N1 (peças / regolito) | Obra (sols) |
|---|---|---|---|---|
| Habitat | 4 / 8 / 12 vagas | 24 / 40 / 56 | 15 / 20 | 3 |
| Painel solar | 100 / 150 / 200 m² (63 / 95 / 126 kWh/sol limpo) | — | 8 / 0 | 1 |
| Bateria | 60 / 120 / 200 kWh | — | 6 / 0 | 1 |
| MOXIE | 4 / 7 / 10 kg O2/sol | 100 / 175 / 250 | 12 / 0 | 2 |
| Extrator de gelo | 6 / 10 / 16 kg água/sol | 6 / 10 / 16 | 8 / 0 | 1.5 |
| Estufa | 30 / 50 / 80 m² | 65 / 108 / 173 | 10 / 10 | 2 |
| Abrigo de radiação | 4 / 8 / 12 vagas | — | 4 / 40 | 2 |
| Reator de fissão (tecnologia, único) | 10 / 20 / 40 kWe | — | 40 / 10 | 4 |

Upgrade: custo ≈ 1,3× o nível anterior, mesma duração. Estados visuais de cada módulo: `building`, `ok`, `off`, `unpowered`, `broken`, `cleaning`, mais nível de poeira (painéis) e alerta.

Fixos no mapa (não ocupam slot): plataforma de pouso (naves) e garagem do rover (expedições).

## 7. Colonos

- Objeto individual: nome, profissão, dose, local, alocação.
- Fase 1: sem profissão. Módulo com um colono alocado rende +10%.
- Fase 3: profissões.

| Profissão | Onde rende | Efeito |
|---|---|---|
| Engenheiro(a) | painel, bateria, MOXIE, reator | +25% de produção; limpa e conserta 2× mais rápido |
| Botânico(a) | estufa | +25% de comida |
| Médico(a) | habitat | −15% de dose para todos (ALARA) |
| Geólogo(a) | expedições | +50% de recompensa e de ciência |

- "Abrigar todos" (botão): colonos vão para o abrigo (até a capacidade; o resto fica no habitat). Enquanto abrigados: sem bônus de alocação, obras, limpezas e consertos param. Esse é o custo da proteção.

### Naves de reabastecimento

A cada 26 sols. Aviso 5 sols antes, com o manifesto: carga (25 peças + 40 kg de comida, crescendo) e 2 a 4 candidatos. Um candidato só desembarca se, contando com ele:
1. há vaga em habitat;
2. O2: produção nominal ≥ consumo, ou estoque para 26 sols;
3. água: idem, já com a reciclagem;
4. comida: estoque + carga + 26 sols de produção ≥ 26 sols de consumo.

Quem não cabe volta para a Terra, e um painel explica qual recurso faltou. Colonos afastados por dose embarcam de volta.

## 8. Expedições (Fase 3)

Um rover no início (uma expedição por vez). O jogador escolhe destino e colono.

| Destino | Duração | Energia | Recompensa |
|---|---|---|---|
| Campo de regolito | 1 sol | 6 kWh | +30 regolito |
| Depósito de gelo | 2 sols | 10 kWh | +25 kg de água, +5 ciência |
| Afloramento mineral | 3 sols | 15 kWh | +8 peças, +8 ciência |

Risco vem da própria simulação, não de dado escondido: fora da base a dose é cheia; tempestade solar pega o colono sem blindagem; tempestade de poeira atrasa a volta. Chance de 10% de atolar (+1 sol; como o Spirit em 2009). Ação "chamar de volta": retorna em metade do tempo já percorrido, com recompensa proporcional.

Plano de corte: vira um botão "enviar rover" com resultado sorteado.

## 9. Árvore de tecnologias (8 itens, custo em ciência)

| Tecnologia | Base real | Efeito | Custo | Requer |
|---|---|---|---|---|
| Escudo eletrodinâmico de poeira | EDS (NASA Kennedy) | poeira nos painéis −80% | 20 | — |
| Reciclagem de água 98% | ECLSS da ISS (2023) | reciclagem 93% → 98% | 25 | — |
| Alerta de clima espacial | monitoramento solar NASA / MAVEN | aviso de tempestade solar 0,25 → 1 sol | 25 | — |
| Impressão 3D com regolito | habitat Mars Dune Alpha (CHAPEA) | custo em peças −30%; libera nível 3 de habitat e abrigo | 35 | — |
| Habitat avançado de plantas | Veggie → Advanced Plant Habitat (ISS) | comida +50% | 40 | — |
| Suporte de vida bioregenerativo | pesquisas NASA Kennedy | estufa também produz O2 | 50 | Habitat avançado de plantas |
| Rover pressurizado | Space Exploration Vehicle | 2ª expedição simultânea; dose em expedição ×0,5 | 50 | Alerta de clima espacial |
| Energia de fissão | Kilopower / KRUSTY (2018) | libera o reator | 70 | Escudo de poeira |

Plano de corte: ficam Escudo de poeira, Reciclagem de água e Energia de fissão.

## 10. Eventos

Modo colônia: sorteio no início de cada sol com RNG semeado. Sem eventos nos 5 primeiros sols. Dificuldade `D = min(3, 1 + sol/150)` multiplica as probabilidades. Modo história: mesmos eventos, com hora marcada.

| Evento | Prob./sol | Duração | Efeito | Referência real |
|---|---|---|---|---|
| Tempestade de poeira regional | 5%·D (intervalo mín. 6 sols) | 2–4 sols | tau 1,5–3,5 → solar a ~40–75%; poeira ×5 | tempestades regionais sazonais |
| Tempestade de poeira global | 1,2%·D depois do sol 20 (mín. 40 sols) | 6–10 sols | tau 6–10,8 → solar a ~3–17%; poeira ×10 | Opportunity, 2018 |
| Tempestade solar | 4%·D (mín. 5 sols) | aviso 0,1 sol + 1–2 sols | dose extra conforme o local (5.5); evento real do DONKI | DONKI; RAD set/2017; ago/1972 |
| Redemoinho limpa painel | 3% | instantâneo | poeira de um painel cai 50% (`// ASSUMPTION:`) | Spirit, fev/2009: 210 → 240 Wh após limpeza pelo vento |
| Falha de equipamento | 3%·D | até consertar | módulo parado; conserto: 3 peças + 0,5 sol | processador de urina da ISS, falha em dez/2008 |
| Martemoto | 2% | instantâneo | +5 ciência | InSight, 4/mai/2022, magnitude estimada 5 |

Todo evento e toda falha geram um **painel científico**: título, 2–3 frases, o número real, fonte com link. Ficam guardados no Caderno de Ciência (contador "12/24 descobertos").

## 11. Vitória e derrota

Derrota = **missão abortada** (a tripulação evacua; ninguém morre na tela):

| Condição | Tolerância (`// ASSUMPTION:` de jogo) |
|---|---|
| O2 zerado | 0,25 sol |
| Habitat sem energia | 0,5 sol |
| Água zerada | 2 sols |
| Comida zerada | 5 sols |
| Nenhum colono ativo | imediato |

Durante a tolerância: alarme, contagem regressiva e módulo piscando. A tela final mostra a causa, o painel científico correspondente e a pontuação.

- Modo história: cada capítulo tem objetivos; cumprir todos = vitória do capítulo; falhar = recomeçar o capítulo.
- Modo colônia: sem fim. Marco "Colônia autossuficiente": população ≥ 12 e saldo positivo de O2, água e comida por 26 sols seguidos. Pontuação pela fórmula de 5.6.

## 12. Modo história — "Missão Sabiá"

Local: Arcadia Planitia (região real candidata a pouso humano por ter gelo raso). Protagonista: comandante **Lia Moreira**, engenheira de Belo Horizonte. Tripulação: Kenji Tanaka (médico), Amara Okafor (botânica), Tomás Reyes (geólogo). **ARA**, o computador da base, é a voz dos painéis científicos. As mensagens da Terra chegam com atraso (4 a 20 min, fato real). Cenas = texto + imagem (fotos reais da NASA em domínio público, com crédito, sem logos).

**Capítulo 1 — Primeiro Sol** (sols 1–8, tutorial). Pouso. Só o módulo de pouso e o habitat; O2 para 6 sols.
Objetivos em sequência: construir painel solar → construir bateria → sobreviver à primeira noite → MOXIE com saldo de O2 positivo → extrator de gelo → estufa.
Painéis: o sol marciano e a noite, MOXIE, gelo em Marte (Phoenix), plantas no espaço (Veggie).

**Capítulo 2 — Céu de Poeira** (sols 40–54). Base pronta. Sol 41: chega a primeira nave (engenheiro e botânica extras; ensina naves e alocação). Painéis sujos: aprender a limpar. Sol 44: tempestade regional. Sols 46–53: tempestade global, tau 10,8.
Objetivo: chegar ao sol 54 sem abortar. Ensina a desligar módulos, priorizar e usar bateria. Final: pesquisar Energia de fissão.
Painéis: Opportunity 2018, tau, poeira nos painéis (InSight), Kilopower.

**Capítulo 3 — Fúria do Sol** (sols 90–102). Objetivos: expedição para buscar regolito → construir o abrigo → pesquisar Alerta de clima espacial. Sol 95: tempestade solar moderada (a atmosfera ajuda, como em set/2017). Sol 98: alerta de tempestade severa com a expedição de minerais fora: chamar de volta e abrigar todos. Sol 101: a nave chega e a base sustenta os novos colonos.
Objetivo: ninguém passa de 600 mSv e a nave desembarca 2 colonos. Epílogo: "Marte funciona". Convite para o modo colônia.
Painéis: RAD, limite de 600 mSv, ago/1972 entre Apollo 16 e 17, blindagem com regolito.

O modo colônia fica liberado desde o início (a banca não pode depender de terminar a história).

## 13. Constantes científicas (vão para `src/data/constants.js`)

Status: **C** = confirmado na fonte; **V** = em verificação (subagentes de pesquisa rodando); **A** = `// ASSUMPTION:` (pendência da equipe de pesquisa).

| Constante | Valor | Fonte | Status |
|---|---|---|---|
| `SOL_HOURS` | 24,6597 h | [NASA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | C |
| `SOLAR_IRRADIANCE_MARS` | 586,2 W/m² | NASA Mars Fact Sheet | C |
| `SYNODIC_PERIOD_DAYS` | 779,94 dias (~26 meses) | NASA Mars Fact Sheet | C |
| `CAREER_DOSE_LIMIT_MSV` | < 600 mSv (≈ 3% de risco de morte por câncer) | [NASA-STD-3001, requisito V1 4030](https://www.nasa.gov/reference/4-0-human-performance/) | C |
| `GCR_SURFACE_MSV_PER_DAY` | 0,67 | [NASA, Curiosity/RAD](https://www.nasa.gov/news-release/nasa-rover-results-include-first-age-measurement-on-mars-and-help-for-human-exploration/) | C |
| `CRUISE_MSV_PER_DAY` | 1,8 | [JPL, RAD em cruzeiro](https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/) | C |
| `TRANSIT_DAYS` | 180 (missão de referência; a MSL levou 253) | [NASA, comparação de doses](https://science.nasa.gov/resource/radiation-exposure-comparisons-with-mars-trip-calculation/) | C |
| `SPE_2017_FACTOR`, duração | > 2× por > 2 dias | [JPL, set/2017](https://www.jpl.nasa.gov/news/large-solar-storm-sparks-global-aurora-and-doubles-radiation-levels-on-the-martian-surface/) | C |
| `SPE_SEVERE_SURFACE_MSV` | 20–50 (1972), 50–70 (1960), 80–100 (1956) | [NASA TP-2979](https://ntrs.nasa.gov/citations/19900009041) | C |
| `SPE_WARNING` | dezenas de minutos a horas | [NASA SRAG](https://srag.jsc.nasa.gov/spaceradiation/what/what.cfm) | C |
| `OPPY_TAU_PEAK` | 10,8 (10/jun/2018, sol 5111) | [JPL](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/) | C |
| `OPPY_WH_BEFORE / OPPY_WH_STORM` | ≈ 645 / ≈ 22 Wh por sol | [Planetary Society](https://www.planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep); falta fonte NASA | V |
| `TAU_CLEAR` | ~0,5 | JPL (mesma página) | C |
| `GLOBAL_STORM_FREQUENCY` | 1 a cada 3 anos marcianos, em média | [NASA](https://www.nasa.gov/solar-system/the-fact-and-fiction-of-martian-dust-storms/) | C |
| `INSIGHT_SOL1_WH` | 4.588 Wh | [JPL](https://www.jpl.nasa.gov/news/mars-new-home-a-large-sandbox/) | C |
| `INSIGHT_ARRAY_M2` | 2 × disco de 2,15 m ≈ 7,3 m² (conta nossa) | kit de imprensa do InSight (só o diâmetro) | A |
| `DUST_RATE_PER_SOL` | 0,28% | Landis & Jenkins 2000, Mars Pathfinder; falta abrir o original | V |
| `CLEANING_EVENT_EXAMPLE` | Spirit: 210 → 240 Wh | [JPL](https://www.jpl.nasa.gov/news/spirit-gets-energy-boost-from-cleaner-solar-panels/) | C |
| Catálogo de tempestades solares | 64 erupções reais de 2010 a 14/11/2026 (classe X2.5 ou mais, ou M5+ com partículas energéticas associadas); 12 severas (X5+) | [DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/), `src/data/donkiEvents.js`, regenerável com `node tools/fetch-donki.mjs` | C |
| `MOXIE_G_PER_HOUR`, `MOXIE_WATTS` | 12 g/h (pico), 300 W; 122 g em 16 rodadas | [NASA MOXIE](https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/), [instrumentos](https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/) | C |
| `O2_KG_PER_CREW_DAY` | 0,816 | [NASA BVAD Rev1](https://ntrs.nasa.gov/api/citations/20180001338/downloads/20180001338.pdf), Tab. 3-33 | C |
| `WATER_GROSS_KG_PER_CREW_DAY` | 4,48 (beber + comida: 2,5) | BVAD, Tab. 4-20 | C |
| `FOOD_DRY_KG_PER_CREW_DAY` | 0,617 | BVAD, Tab. 4-57 | C |
| `CROP_YIELD_G_M2_DAY` | batata 21,06; trigo 20,0; alface 6,57 | BVAD, Tab. 4-97 | C |
| `CROP_AREA_PER_PERSON` | 20–25 m² (O2); 40–50 m² (comida) | [Wheeler, NASA KSC](https://ntrs.nasa.gov/api/citations/20200002230/downloads/20200002230.pdf) | C |
| `CROP_G_PER_KWH` | 1,6–10 (usamos 10) | BVAD, Tab. 4-95 | V |
| `WATER_RECYCLE_ISS` | 0,93 → 0,98 | [NASA, 2023](https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/) | C |
| `COMM_DELAY_MIN` | 4–20 min (só ida) | [NASA](https://www.nasa.gov/missions/tech-demonstration/deep-space-atomic-clock/how-an-atomic-clock-will-get-humans-to-mars-on-time/) | C |
| `VEGGIE_FIRST_HARVEST` | 10/ago/2015, alface, 33 dias | [NASA Veggie](https://www.nasa.gov/wp-content/uploads/2023/03/veggie-fact-sheet-508.pdf) | C |
| Gelo raso em Arcadia Planitia | a partir de 2,5 cm de profundidade | [JPL](https://www.jpl.nasa.gov/news/where-should-future-astronauts-land-on-mars-follow-the-water/) | C |
| `CHAPEA` | 4 tripulantes, 378 dias, habitat impresso em 3D | [NASA](https://www.nasa.gov/humans-in-space/chapea/) | C |
| `KILOPOWER_KWE` | até 10 kWe; Fission Surface Power: pelo menos 40 kWe | [NASA KRUSTY](https://www.nasa.gov/news-release/demonstration-proves-nuclear-fission-system-can-provide-space-exploration-power/), [NASA FSP](https://www.nasa.gov/exploration-systems-development-mission-directorate/fission-surface-power/) | C |
| `EDS` | escudo eletrodinâmico, demonstrado na Lua em 2025 | [NASA](https://www.nasa.gov/image-article/nasas-dust-shield-successfully-repels-lunar-regolith-on-moon/) | C |
| `ICE_LATENT_HEAT`, `ICE_SPECIFIC_HEAT` | 334 kJ/kg; 2,1 kJ/kg·K | referência física padrão | V |
| Forma exponencial de `f_tau` | — | ajuste nosso em 2 pontos medidos | A |
| Fatores de blindagem (5.5) | tabela | a calibrar com literatura | A |
| `alara` do médico | 0,85 | valor de jogo | A |
| Energia do extrator | 1 kWh/kg | mínimo físico × perdas | A |
| Água da estufa por m² | 0,1 kg/m²/sol | valor de jogo | A |
| `stormMult` da poeira | 5 / 10 | valor de jogo | A |

## 14. Arquitetura

Sem build: ES modules nativos, Three.js copiado para `src/vendor/`, import map no `index.html`. `package.json` só com `"type": "module"` (para o Node rodar os testes), sem dependências.

```
index.html
css/style.css
package.json                 # {"type":"module"}; script "test"
src/
  main.js                    # bootstrap e game loop (requestAnimationFrame)
  data/constants.js          # constantes científicas, cada uma com fonte e URL
  data/balance.js            # valores de jogo: módulos, custos, eventos, tolerâncias
  data/tech.js               # árvore de tecnologias
  data/story.js              # capítulos: cenas, roteiro de eventos, objetivos
  data/sciencePanels.js      # painéis: id, gatilho, chaves de texto, fonte, URL
  data/donkiEvents.js        # catálogo curado de eventos solares reais (DONKI), com data de extração
  data/terrain.js            # grade de alturas do local da base (Mars Trek), se der tempo
  net/donkiLive.js           # consulta ao vivo ao DONKI para o widget "O Sol hoje" (fora do núcleo; falha em silêncio)
  i18n/i18n.js  pt.js  en.js # t(key, params); nada de texto fixo no código
  sim/                       # JS puro. Proibido importar three, window ou document
    index.js                 # createGame, tick, dispatch, drainEvents, serialize
    state.js  energy.js  life.js  radiation.js  build.js  colonists.js
    events.js  expeditions.js  ships.js  tech.js  story.js  rng.js  selectors.js
  ui/                        # HUD em DOM por cima do canvas (funciona sem 3D)
    hud.js  slotPanel.js  colonists.js  modals.js  notebook.js
  render3d/                  # Three.js: só lê o estado
    view3d.js  voxels.js  modulesMesh.js  terrain.js  effects.js
  render2d/view2d.js         # plano B: mapa de slots em grade CSS, mesma interface
  vendor/three.module.js (+ addons)
tests/run.mjs                # node tests/run.mjs
```

Decisão central: **toda a interação fica no HUD em DOM**. O 3D só desenha a base e devolve cliques em slots. Assim o plano B é trocar um arquivo (`view3d` → `view2d`), e o 2D também serve de fallback automático se o WebGL falhar (PC de escola, celular fraco).

### Interface do núcleo

```js
const game = createGame({ mode: 'colony' | 'story', chapter: 1, seed: 12345 });
game.state                    // objeto simples, serializável em JSON
game.tick(dtSols)             // avança em passos fixos H
game.dispatch(action)         // -> { ok: true } | { ok: false, reason: 'err.notEnoughParts' }
game.drainEvents()            // -> [{ type, t, ...dados }] desde a última chamada
game.serialize() / loadGame(json)
```

Ações: `build{slotId,moduleType}` `upgrade{slotId}` `demolish{slotId}` `toggle{slotId,enabled}` `assign{colonistId,slotId|null}` `clean{slotId}` `repair{slotId}` `setShelter{on}` `startExpedition{site,colonistId}` `recallExpedition{id}` `research{techId}` `shipDecision{acceptIds}`.

Eventos emitidos: `sol.start` `build.done` `event.start` `event.end` `alert` `science.panel{id}` `ship.incoming` `ship.arrived` `colonist.retired` `objective.done` `story.scene` `game.over`. O núcleo só emite chaves e números, nunca texto.

Forma do estado (resumo):

```js
{ mode, chapter, seed, t,
  resources: { energy, o2, water, food, regolith, parts, science },
  rates:     { energyGen, energyUse, o2, water, food, science },   // por sol, para o HUD
  env:       { tau, sun, storm: null | {kind, endsAt}, spe: null | {phase, endsAt, totalMsv} },
  slots:     [{ id, x, z, module: null | { type, level, enabled, status, progress, dust, growth, staff: [] } }],
  colonists: [{ id, name, profession, dose, location, assignedTo, status }],
  expeditions: [{ id, site, colonistId, startT, endT, recalled }],
  ship:      { nextArrivalT, manifest, awaitingDecision },
  tech:      { unlocked: [] },
  timers:    { o2Out, waterOut, foodOut, blackout },
  sheltering, story: { objectives, flags }, stats: { popPeak, panelsSeen: [] },
  over: null | { reason, score } }
```

### Interface da visualização (3D e 2D)

```js
createView(container, { onSlotClick(slotId), onSiteClick(siteId) })
  -> { update(state, events, dtReal), resize(), dispose() }
```

Voxel sem engine: cada módulo é uma lista de caixas `[x,y,z,w,h,d,cor]` em dados, desenhada com `InstancedMesh`; terreno em grade de cubos; câmera ortográfica isométrica com zoom e rotação limitada. Reações ao estado: janelas acesas ou apagadas, poeira cobrindo os painéis, luz de alerta piscando, céu e neblina seguindo `tau` e a hora do sol, partículas na tempestade, rover indo e voltando, nave pousando.

### Testes (`node tests/run.mjs`)

1. Invariantes em 300 sols com ações aleatórias: sem NaN, sem recurso negativo, bateria ≤ capacidade, dose nunca diminui, mesma semente → mesmo estado.
2. Calibração: geração integrada num sol limpo = área × 0,63; com tau 10,8 = 22/645 do limpo; consumo de O2 = pop × 0,84 × 1,0275.
3. Bots: o "parado" perde entre os sols 4 e 15; o "competente" sobrevive 150 sols em ≥ 80% de 20 sementes; um bot roteirizado conclui cada capítulo.
4. Relatório de balanceamento: tabela de recursos a cada 10 sols.

## 15. Riscos

| Risco | Mitigação |
|---|---|
| Renderer 3D atrasar | começa em paralelo à Fase 1, contra um estado de exemplo; plano B às 20h já existe (`view2d` nasce na Fase 1) |
| Escopo da Fase 3 | sistemas orientados a dados; ordem de corte definida no briefing |
| Dado científico errado diante da banca | cada constante com URL; status C/V/A; equipe de pesquisa fecha as `ASSUMPTION` |
| GitHub Pages falhar no dia | deploy já no fim da Fase 1, verificado em aba anônima a cada fase |
| Demo com menor de idade | gravação de tela + legendas; sem rosto, voz ou nome do líder da equipe |
| Jogo complexo demais para a faixa do desafio (7–12) | história libera um recurso por vez; HUD com autonomia em sols; pausa automática; teste com crianças (EQ-4) |
| API do DONKI fora do ar ou bloqueada no dia | catálogo embutido é a fonte do jogo; o "ao vivo" é só um widget, com rótulo honesto |

## 16. Pendências para o líder da equipe

Respondidas em 14/11, ~13h:

1. **Faixa etária: 7 a 12 anos**, como o desafio (decisão do líder da equipe, substitui 10–14). Consequências:
   - Textos: frases de até ~12 palavras, uma ideia por frase, toda sigla explicada na hora (sol, mSv, kWh). Painel científico: 2 frases + o número real.
   - Dois níveis: **Cadete** (padrão; mais estoque inicial, tolerâncias maiores, sem falha de equipamento, pausa automática ligada) e **Comandante** (valores normais). Só mudam valores de jogo; as taxas físicas reais são as mesmas.
   - **Ajuda da ARA**: botão "O que faço agora?" que lê o estado e aponta a ação mais urgente (regra simples sobre a autonomia de cada recurso).
   - A história (um recurso novo por vez) é a porta de entrada recomendada na tela inicial.
2. **Repositório público: ainda não autorizado.** Tudo fica local; o deploy no Pages espera a decisão.
3. **Todos da equipe são menores**: demo sem rosto, sem voz e sem nome de ninguém. Gravação de tela com legendas em inglês, ou slides.

## Apêndice A — Contrato da Fase 1 (vinculante para quem implementa)

Os nomes abaixo são exatos. Se algo aqui contradisser as seções anteriores, vale o apêndice. Quem precisar mudar um nome avisa no relatório; não muda em silêncio.

### A.1 `src/data/constants.js` (exports nomeados; cada um com comentário de fonte + URL da seção 13)

```js
// medidos / publicados
SOL_HOURS = 24.6597;  SOLAR_IRRADIANCE_MARS_W_M2 = 586.2;  SYNODIC_PERIOD_DAYS = 779.94;
CAREER_DOSE_LIMIT_MSV = 600;  GCR_SURFACE_MSV_PER_DAY = 0.67;  CRUISE_MSV_PER_DAY = 1.8;  TRANSIT_DAYS = 180;
OPPY_TAU_PEAK = 10.8;  OPPY_WH_CLEAR = 645;  OPPY_WH_STORM = 22;  TAU_CLEAR = 0.5;
INSIGHT_SOL1_WH = 4588;  INSIGHT_ARRAY_DIAMETER_M = 2.15;  INSIGHT_ARRAY_COUNT = 2;
DUST_RATE_PER_SOL = 0.0028;  MOXIE_G_PER_HOUR = 12;  MOXIE_WATTS = 300;
O2_KG_PER_CREW_DAY = 0.816;  WATER_GROSS_KG_PER_CREW_DAY = 4.48;  FOOD_DRY_KG_PER_CREW_DAY = 0.617;
CROP_YIELD_G_M2_DAY = 21.06;  CROP_G_PER_KWH = 10;  CROP_M2_PER_PERSON_O2 = 22.5;
WATER_RECYCLE_BASE = 0.93;  WATER_RECYCLE_TECH = 0.98;  KILOPOWER_KWE = 10;
COMM_DELAY_MIN_MINUTES = 4;  COMM_DELAY_MAX_MINUTES = 20;
SPE_MODERATE_MSV = [1, 5];  SPE_SEVERE_MSV = [20, 100];
// derivados (calculados no arquivo, com a conta no comentário)
DAY_TO_SOL = SOL_HOURS / 24;                                   // 1.0275
SOLAR_YIELD_CLEAR_KWH_M2_SOL = (INSIGHT_SOL1_WH / 1000) / (INSIGHT_ARRAY_COUNT * Math.PI * (INSIGHT_ARRAY_DIAMETER_M / 2) ** 2);  // ≈ 0.632
K_TAU = Math.log(OPPY_WH_CLEAR / OPPY_WH_STORM) / (OPPY_TAU_PEAK - TAU_CLEAR);   // ≈ 0.328
MOXIE_KWH_PER_KG = MOXIE_WATTS / MOXIE_G_PER_HOUR;             // 25
O2_PER_CREW_SOL, WATER_GROSS_PER_CREW_SOL, FOOD_PER_CREW_SOL   // valor por dia × DAY_TO_SOL
CROP_YIELD_KG_M2_SOL = CROP_YIELD_G_M2_DAY / 1000 * DAY_TO_SOL;
GH_KWH_PER_M2_SOL = CROP_YIELD_G_M2_DAY / CROP_G_PER_KWH * DAY_TO_SOL;   // ≈ 2.16
GCR_SURFACE_MSV_PER_SOL = GCR_SURFACE_MSV_PER_DAY * DAY_TO_SOL;
TRANSIT_DOSE_MSV = CRUISE_MSV_PER_DAY * TRANSIT_DAYS;          // 324
// ASSUMPTION (cada um com justificativa no comentário)
SHIELD_GCR = { expedition: 1.0, habitat: [0.8, 0.7, 0.6], shelter: 0.5 };
SHIELD_SPE = { expedition: 1.0, habitat: 0.5, shelter: 0.1 };
ALARA_FACTOR = 0.85;  EXTRACTOR_KWH_PER_KG = 1;  GH_WATER_KG_M2_SOL = 0.1;
DUST_STORM_MULT = { none: 1, regional: 5, global: 10 };  DUST_MAX = 0.8;
```

### A.2 `src/data/balance.js` (valores de jogo)

```js
TIME = { SOL_REAL_SECONDS: 24, STEP: 1 / 96, SUNRISE: 0.25, SUNSET: 0.75, START_T: 0.3 };
MODULES = {            // levels[0] = nível 1. cost e buildSols de cada nível (nível 1 = construir; 2 e 3 = upgrade)
  habitat:    { levels: [ { capacity: 4,  use: 24, cost: { parts: 15, regolith: 20 }, buildSols: 3 },
                          { capacity: 8,  use: 40, cost: { parts: 20, regolith: 26 }, buildSols: 3 },
                          { capacity: 12, use: 56, cost: { parts: 26, regolith: 34 }, buildSols: 3 } ] },
  solar:      { levels: [ { area: 100, cost: { parts: 8 },  buildSols: 1 }, { area: 150, cost: { parts: 10 }, buildSols: 1 }, { area: 200, cost: { parts: 14 }, buildSols: 1 } ] },
  battery:    { levels: [ { capacity: 60, cost: { parts: 6 }, buildSols: 1 }, { capacity: 120, cost: { parts: 8 }, buildSols: 1 }, { capacity: 200, cost: { parts: 12 }, buildSols: 1 } ] },
  moxie:      { levels: [ { o2: 4, cost: { parts: 12 }, buildSols: 2 }, { o2: 7, cost: { parts: 16 }, buildSols: 2 }, { o2: 10, cost: { parts: 22 }, buildSols: 2 } ] },
  extractor:  { levels: [ { water: 6, cost: { parts: 8 }, buildSols: 1.5 }, { water: 10, cost: { parts: 10 }, buildSols: 1.5 }, { water: 16, cost: { parts: 14 }, buildSols: 1.5 } ] },
  greenhouse: { levels: [ { area: 30, cost: { parts: 10, regolith: 10 }, buildSols: 2 }, { area: 50, cost: { parts: 13, regolith: 13 }, buildSols: 2 }, { area: 80, cost: { parts: 17, regolith: 17 }, buildSols: 2 } ] },
  shelter:    { levels: [ { capacity: 4, cost: { parts: 4, regolith: 40 }, buildSols: 2 }, { capacity: 8, cost: { parts: 5, regolith: 52 }, buildSols: 2 }, { capacity: 12, cost: { parts: 7, regolith: 68 }, buildSols: 2 } ] },
  reactor:    { unique: true, requiresTech: 'fission',
                levels: [ { kwe: 10, cost: { parts: 40, regolith: 10 }, buildSols: 4 }, { kwe: 20, cost: { parts: 52, regolith: 13 }, buildSols: 4 }, { kwe: 40, cost: { parts: 68, regolith: 17 }, buildSols: 4 } ] },
};
// consumo derivado no núcleo: moxie = o2 · MOXIE_KWH_PER_KG; extractor = water · EXTRACTOR_KWH_PER_KG; greenhouse = area · GH_KWH_PER_M2_SOL
SHED_ORDER = ['greenhouse', 'extractor', 'moxie', 'habitat'];   RESTORE_BATTERY_FRACTION = 0.05;
STAFF_BONUS = 0.10;   SCIENCE_PER_COLONIST_SOL = 0.5;
GRACE = { o2: 0.25, blackout: 0.5, water: 2, food: 5 };       // sols
GREENHOUSE = { growSols: 3, dieAfterUnpoweredSols: 1 };       CLEAN_SOLS = 0.2;
SHIP = { intervalSols: 26, cargo: { parts: 25, food: 40, regolith: 20 }, candidates: 2 };   // regolito na carga só até as expedições existirem
SCORE = { perSol: 10, perPopPeak: 100, perTech: 150, perPanel: 20 };
SLOTS = 16 slots, ids 's1'..'s16', em grade 4×4: { id, gx: 0..3, gz: 0..3 } (s1 = gx 0, gz 0; s2 = gx 1, gz 0; ...; s16 = gx 3, gz 3)
SITES = [ { id: 'ice', gx: -2, gz: -1 }, { id: 'regolith', gx: 5, gz: 1 }, { id: 'minerals', gx: 5, gz: 4 } ];   // fora da grade; usados na Fase 3
START = { colony: { resources: { energy: 30, o2: 30, water: 60, food: 80, regolith: 0, parts: 45, science: 0 },
                    modules: [ { slot: 's6', type: 'habitat', level: 1 }, { slot: 's7', type: 'solar', level: 1 }, { slot: 's10', type: 'battery', level: 1 } ],
                    colonists: 4, unlocked: ['habitat', 'solar', 'battery', 'moxie', 'extractor', 'greenhouse', 'shelter'] } };
COLONIST_NAMES = lista de 16 nomes fictícios e diversos
```

O núcleo pode ajustar valores de `balance.js` para os testes de bot passarem (nunca os de `constants.js`), e relata o que mudou.

### A.3 Estado (`game.state`)

```js
{ version: 1, mode: 'colony', chapter: 0, seed, rng,            // rng = estado interno do gerador
  t,                                                             // sols, float; começa em TIME.START_T
  resources: { energy, o2, water, food, regolith, parts, science },
  rates: { energyGen, energyUse, o2Prod, o2Use, waterProd, waterUse, foodProd, foodUse, science },   // por sol, instantâneo
  env: { tau, sun, storm: null, spe: null, commDelayMin },
  unlocked: { modules: [types] },
  slots: [ { id, gx, gz, module: null | {
      type, level,                       // 1..3
      enabled,                           // escolha do jogador
      powered,                           // false se cortado por falta de energia
      status,                            // 'building' | 'upgrading' | 'ok' | 'cleaning' | 'broken'
      progress,                          // 0..1 enquanto building / upgrading / cleaning
      dust,                              // 0..DUST_MAX (só solar; 0 nos outros)
      growth,                            // 0..1 (só estufa)
      unpoweredSols, staff: [colonistId] // no máximo 1
  } } ],
  colonists: [ { id, name, profession: null, dose, location: 'habitat' | 'module' | 'shelter' | 'expedition', assignedTo: slotId | null, status: 'active' | 'retired' } ],
  expeditions: [], ship: { nextArrivalT, manifest: null, awaitingDecision: false },
  tech: { unlocked: [] }, sheltering: false,
  timers: { o2Out, waterOut, foodOut, blackout },                // sols acumulados na condição; 0 quando ok
  story: null, stats: { popPeak, panelsSeen: [] },
  over: null | { reason: 'o2' | 'water' | 'food' | 'blackout' | 'noCrew', score } }
```

Regras: módulo em `building` não funciona; em `upgrading` continua no nível atual; `enabled: false` ou `powered: false` ou `broken` não produz nem consome. Painel solar e bateria não consomem. Depois de `over`, `tick` não avança e `dispatch` devolve `err.gameOver`.

### A.4 API do núcleo (`src/sim/index.js`)

```js
createGame({ mode = 'colony', chapter = 0, seed = Date.now() } = {}) -> game
game.state;  game.tick(dtSols);  game.dispatch(action) -> { ok: true } | { ok: false, reason };
game.drainEvents() -> Event[];  game.serialize() -> string;  loadGame(string) -> game
```

Ações da Fase 1: `{type:'build', slotId, moduleType}` `{type:'upgrade', slotId}` `{type:'demolish', slotId}` (devolve 50% do custo) `{type:'toggle', slotId, enabled}` `{type:'assign', colonistId, slotId}` (`slotId: null` desaloca) `{type:'clean', slotId}`.

`reason` (chaves de i18n): `err.gameOver` `err.unknownAction` `err.noSuchSlot` `err.slotOccupied` `err.slotEmpty` `err.unknownModule` `err.locked` `err.unique` `err.notEnoughParts` `err.notEnoughRegolith` `err.maxLevel` `err.busy` `err.cannotDisable` `err.noSuchColonist` `err.notSolar`.

Eventos da Fase 1 (todos com `t`): `{type:'sol.start', sol}` `{type:'build.done', slotId, moduleType, level}` `{type:'module.unpowered', slotId}` `{type:'module.restored', slotId}` `{type:'alert', key, level: 'warn' | 'danger'}` (chaves: `alert.o2Low` `alert.waterLow` `alert.foodLow` `alert.energyLow` com autonomia < 2 sols; `alert.o2Out` `alert.waterOut` `alert.foodOut` `alert.blackout` ao zerar; `alert.cropsDied`; emitido na transição, sem repetir a cada passo) `{type:'ship.arrived', cargo, landed: [colonistId], refused: [{reason: 'habitat' | 'o2' | 'water' | 'food'}]}` `{type:'science.panel', id}` (ids da Fase 1: `nightPower`, `moxieEnergy`, `dustOnPanels`, `cropsNeedLight`, e `over.<reason>`; cada id uma vez por partida) `{type:'game.over', reason, score}`.

Seletores puros em `src/sim/selectors.js`:

```js
getSol(state) -> int;  getHour(state) -> 0..SOL_HOURS;  population(state) -> int   // colonos 'active'
capacity(state) -> { energy, crew, shelter }
autonomy(state) -> { energy, o2, water, food }          // sols até zerar no ritmo médio do sol atual; Infinity se o saldo é ≥ 0
netPerSol(state) -> { energy, o2, water, food }         // saldo médio por sol (energia: média de um sol inteiro com o tau atual)
moduleRates(state, slotId) -> { gen, use, o2, water, food, active }   // por sol, agora
buildOptions(state, slotId) -> [ { type, cost, buildSols, ok, reason } ]
upgradeInfo(state, slotId) -> null | { nextLevel, cost, buildSols, ok, reason }
score(state) -> number
```

### A.5 Visualização e loop

```js
// src/render2d/view2d.js e src/render3d/view3d.js exportam a mesma função:
createView(container, { onSlotClick(slotId), onSiteClick(siteId) }) -> { update(state, events, dtReal), setSelected(slotId | null), resize(), dispose() }
```

`src/main.js`: `requestAnimationFrame`; `dtReal` limitado a 0,1 s; `game.tick(dtReal · speed / TIME.SOL_REAL_SECONDS)` com `speed ∈ {0, 1, 2, 4}`; depois `events = game.drainEvents()`, e passa `state` e `events` para o HUD e para a view. Escolha da view: tenta `import('./render3d/view3d.js')`; se falhar (arquivo ausente, sem WebGL, erro) ou com `?view=2d` na URL, usa a 2D.

Import map obrigatório em toda página que usa Three.js: `{"imports":{"three":"./src/vendor/three/three.module.js","three/addons/":"./src/vendor/three/addons/"}}` (caminho relativo à página).

### A.6 i18n

`src/i18n/i18n.js`: `t(key, params)`, `setLang('pt' | 'en')`, `getLang()`, `onLangChange(cb)`; idioma salvo em `localStorage`; interpolação `{nome}`. Chaves planas com prefixo: `ui.*` `res.<recurso>` `mod.<type>.name` `mod.<type>.desc` `status.*` `err.*` `alert.*` `over.<reason>` `panel.<id>.title` `panel.<id>.body` `panel.<id>.source`. Nenhum texto visível fora dos arquivos de idioma.

### A.8 Como a Fase 1 foi entregue (14/11, 12h50)

- Campos extras no estado, que as views ignoram: `state.sim` (contabilidade interna), `module.spent` (para o reembolso), `state.difficulty`.
- `SHIP.cargoGrowth = 0.2` (carga cresce 20% por nave) e `SHED_MIN_OFF_SOLS = 0.125` (módulo cortado fica ao menos 3 h marcianas desligado).
- Bateria não pode ser desligada (`err.cannotDisable`). `upgradeInfo` devolve `null` em slot vazio e no nível máximo.
- Testes: 17/17. Bot parado perde no sol 10 (O2); bot competente sobrevive 150 sols em 20 de 20 sementes.

## Apêndice B — Contrato da Fase 3 (vinculante)

Tudo da Fase 1 continua valendo. Nomes exatos.

### B.1 Dificuldade

`createGame({ ..., difficulty: 'cadet' | 'commander' })` → `state.difficulty`. Em `balance.js`:

```js
DIFFICULTY = { cadet:     { startMult: 1.5, regolithStart: 20, graceMult: 2, eventMult: 0.6, failures: false },
               commander: { startMult: 1.0, regolithStart: 0,  graceMult: 1, eventMult: 1.0, failures: true } };
```

`startMult` multiplica O2, água, comida e peças iniciais. Taxas físicas não mudam.

### B.2 Eventos (`src/sim/events.js`)

```js
EVENTS = { graceSols: 5, difficultyRampSols: 150, difficultyMax: 3,
  dustRegional: { p: 0.05,  minGap: 6,  sols: [2, 4],  tau: [1.5, 3.5], rampSols: 0.5 },
  dustGlobal:   { p: 0.012, minGap: 40, sols: [6, 10], tau: [6, 10.8],  rampSols: 1, afterSol: 20 },
  spe:          { p: 0.04,  minGap: 5,  warningSols: 0.1, warningSolsTech: 1, minWarningSols: 0.02, moderateSols: 2, severeSols: 1 },
  dustDevil:    { p: 0.03, removes: 0.5 },
  failure:      { p: 0.03, repairParts: 3, repairSols: 0.5 },
  marsquake:    { p: 0.02, science: 5 },
  observedScience: 3 };
```

- Sorteio no início de cada sol: `p · D · DIFFICULTY.eventMult`, com `D = min(difficultyMax, 1 + sol/difficultyRampSols)`. Redemoinho e martemoto não usam `D`.
- Estado: `env.storm = null | { kind: 'regional' | 'global', startT, endsAt, tauPeak }`; `env.tau` sobe em rampa até `tauPeak`, fica, e desce em rampa até `TAU_CLEAR`. `env.spe = null | { phase: 'warning' | 'active', donkiId, classType, peakTime, link, severity, startsAt, endsAt, totalMsv }`. `state.events = { last: { regional, global, spe }, scheduled: [ { atT, kind, params } ] }` (`scheduled` é usado pela história; eventos agendados ignoram o sorteio).
- Tempestade solar: sorteia um registro de `DONKI_EVENTS`; `severity` define `totalMsv` (faixa `SPE_MODERATE_MSV` ou `SPE_SEVERE_MSV`) e a duração. Aviso = `warningSols` (ou `warningSolsTech`) − `commDelayMin / (SOL_HOURS · 60)`, no mínimo `minWarningSols`. Dose na fase ativa: `totalMsv / duração · SHIELD_SPE[local] · alara`.
- Falha: módulo `ok` que não seja habitat nem bateria vira `status: 'broken'`. Ação `{type:'repair', slotId}`: paga `repairParts`, status `'repairing'` com `progress`, depois `'ok'`. Erros: `err.notBroken`, `err.notEnoughParts`.
- Eventos emitidos: `{type:'event.start', kind: 'dustRegional' | 'dustGlobal' | 'spe' | 'dustDevil' | 'failure' | 'marsquake', ...}` (para `spe`: `phase`, `donkiId`, `classType`, `peakTime`, `link`, `severity`, `startsAt`; para tempestade: `tauPeak`, `endsAt`; para redemoinho e falha: `slotId`) e `{type:'event.end', kind, ...}` (para `spe`: `maxDoseMsv` = maior dose que um colono levou). Cada evento observado até o fim rende `observedScience`.
- Painéis: `dustStorm`, `globalStorm`, `speWarning`, `speAtmosphere` (fim de moderada), `speSevere` (fim de severa), `cleaningEvent`, `equipmentFailure`, `marsquake`.

### B.3 Abrigo

Ação `{type:'setShelter', on}` → `state.sheltering`. Com abrigo ligado: colonos na base vão para `location: 'shelter'` até a soma das vagas dos abrigos `ok`; o resto fica em `'habitat'`. `assignedTo` é preservado e volta a valer ao desligar. Enquanto ligado: sem bônus de alocação; obra, upgrade, limpeza e conserto não avançam; expedição não pode sair. Painel `alara` no primeiro uso.

### B.4 Profissões

`profession ∈ 'engineer' | 'botanist' | 'medic' | 'geologist'`. Tripulação inicial: um de cada. `PROFESSION_BONUS = 0.25` no lugar de `STAFF_BONUS` quando combina: engenheiro em `solar`, `moxie`, `extractor`, `reactor`; botânico em `greenhouse`. Engenheiro ativo na base (não abrigado, não em expedição): limpeza e conserto 2× mais rápidos. Médico ativo na base: `ALARA_FACTOR` na dose de todos que estão na base. Geólogo em expedição: recompensa e ciência × 1,5.

### B.5 Naves com escolha

- `SHIP.announceSols = 5`, `SHIP.waitSols = 1`, candidatos = `min(4, 2 + floor(navesChegadas / 2))`, profissões sorteadas.
- Em `nextArrivalT − announceSols`: `ship.manifest = { cargo, candidates: [ { name, profession } ] }` e evento `ship.incoming { manifest, arrivesAt }` (painel `launchWindow` na primeira vez).
- Na chegada: carga entra, afastados embarcam, `ship.awaitingDecision = true`, `ship.offer = [ { idx, name, profession, ok, reason } ]` (teste de sustento de cada um sozinho) e evento `ship.arrived { cargo, departed, offer }`.
- Ação `{type:'shipDecision', acceptIdx: [idx]}`: valida um a um, na ordem, contando os já aceitos. Evento `ship.landed { landed: [colonistId], refused: [ { idx, reason } ] }`; painel `shipRefused` na primeira recusa. Sem decisão em `waitSols`: aceita automaticamente todos os que passam.

### B.6 Tecnologias (`src/data/tech.js`, `src/sim/tech.js`)

```js
TECHS = { eds: { cost: 20, requires: [] }, waterRecycling: { cost: 25, requires: [] }, spaceWeather: { cost: 25, requires: [] },
  regolithPrinting: { cost: 35, requires: [] }, plantHabitat: { cost: 40, requires: [] }, bioregen: { cost: 50, requires: ['plantHabitat'] },
  pressurizedRover: { cost: 50, requires: ['spaceWeather'] }, fission: { cost: 70, requires: ['eds'] } };
```

Ação `{type:'research', techId}`: compra imediata com ciência. Erros: `err.unknownTech`, `err.alreadyResearched`, `err.missingPrereq`, `err.notEnoughScience`. Evento `tech.unlocked { techId }` + painel `tech.<id>`. Efeitos: `eds` poeira × 0,2; `waterRecycling` reciclagem 0,98; `spaceWeather` aviso de 1 sol; `regolithPrinting` custo em peças × 0,7 (arredonda para cima) e é exigido para o nível 3 de habitat e abrigo; `plantHabitat` comida × 1,5; `bioregen` estufa ativa produz `area / CROP_M2_PER_PERSON_O2 · O2_PER_CREW_SOL · growth` de O2; `pressurizedRover` 2 expedições simultâneas e blindagem 0,5 em expedição; `fission` libera `reactor`. Seletor `techOptions(state) -> [ { id, cost, requires, unlocked, ok, reason } ]`.

### B.7 Expedições (`src/sim/expeditions.js`)

```js
EXPEDITIONS = { regolith: { sols: 1, energy: 6,  reward: { regolith: 30 }, science: 2 },
                ice:      { sols: 2, energy: 10, reward: { water: 25 },    science: 5 },
                minerals: { sols: 3, energy: 15, reward: { parts: 8 },     science: 8 },
                stuckChance: 0.1, stuckSols: 1 };
```

- Ação `{type:'startExpedition', site, colonistId}`: exige colono ativo na base, rover livre (1; 2 com a tecnologia), energia (debitada na saída), sem tempestade global, sem abrigo ligado. O colono sai do módulo e fica `location: 'expedition'`. Erros: `err.unknownSite`, `err.noSuchColonist`, `err.colonistBusy`, `err.noRover`, `err.notEnoughEnergy`, `err.storm`, `err.sheltering`.
- Estado: `expeditions: [ { id, site, colonistId, startT, endT, recalled, stuck } ]`. Atolar: sorteado na saída, revelado na metade do caminho (`expedition.stuck { id }`, `endT += stuckSols`, painel `roverStuck`). Durante tempestade global a expedição não avança.
- Fim: recompensa e ciência entram, colono volta para o habitat, evento `expedition.done { id, site, colonistId, reward, science }`; painel `iceOnMars` na primeira de gelo.
- Ação `{type:'recallExpedition', id}`: volta em `0,5 · tempo decorrido`; recompensa proporcional ao tempo decorrido, arredondada para baixo.
- Seletores: `expeditionOptions(state) -> [ { site, sols, energy, reward, science, ok, reason } ]`, `roversFree(state)`.
- Com expedições, `SHIP.cargo.regolith` cai para 10 e `START.colony.resources.parts` sobe para 60.

### B.8 Modo colônia

Marco: população ≥ 12 e saldo de O2, água e comida ≥ 0 por 26 sols seguidos → evento `milestone { id: 'selfSufficient' }`, `stats.selfSufficientAt = t` (uma vez). `score` soma `SCORE.selfSufficient = 1000`.

### B.9 Donos de arquivo na Fase 3

| Agente | Arquivos |
|---|---|
| Núcleo | `src/sim/**`, `src/data/balance.js`, `src/data/tech.js`, `tests/**` |
| Interface | `index.html`, `css/**`, `src/main.js`, `src/ui/**`, `src/render2d/**`, `src/i18n/**`, `src/data/sciencePanels.js`, `src/net/**` |
| Renderer 3D | `src/render3d/**`, `src/dev/**`, `dev/view3d.html` |

## Apêndice C — Contrato do modo história (vinculante)

### C.1 Núcleo (`src/data/story.js`, `src/sim/story.js`)

`createGame({ mode: 'story', chapter: 1 | 2 | 3, difficulty })`. Sem eventos aleatórios: só os de `state.events.scheduled`. O estado inicial de cada capítulo vem de `CHAPTERS[n].start`.

```js
CHAPTERS = { 1: { startT, start: { resources, modules: [ { slot, type, level, dust?, growth? } ], colonists: [ { name, profession, dose } ],
                                   tech: [], shipNextArrivalT, shipManifest? },
                  unlocked: { modules: [], features: [], techs: [] },      // estado inicial das travas
                  scheduled: [ { atT, kind, params } ],
                  steps: [ { id, check: { kind, ... }, unlock?: { modules?, features?, techs? }, panel?: id } ],   // em ordem
                  intro: [sceneId], outro: [sceneId] }, 2: {...}, 3: {...} };
```

- `state.unlocked = { modules: [], features: [], techs: [] | null }`. `features` ⊂ `['toggle', 'assign', 'clean', 'ships', 'tech', 'expeditions', 'shelter']`. No modo colônia tudo liberado e `techs: null`. Ação de recurso travado devolve `err.locked`.
- `state.story = { chapter, stepIdx, steps: [ { id, done } ], complete: false }`. A cada passo: verifica o `check` do passo atual; ao cumprir, aplica `unlock`, emite `objective.done { id }` e `story.step { id }` do próximo (e o painel científico do passo, se houver). Ao cumprir o último: `story.complete { chapter, score }`, `state.story.complete = true` e o jogo congela como em `over` (mas `state.over` fica `null`).
- `check.kind`: `built { module, count, level? }` · `tReached { t }` · `netNonNegative { res }` · `stockAtLeast { res, amount }` · `assigned { profession?, module }` · `cleaned` (alguma limpeza concluída) · `researched { tech }` · `expeditionDone { site }` · `eventEnded { kind }` · `shelteredWhen { kind: 'spe' }` (todos na base abrigados em algum momento da fase ativa) · `recalled` · `landed { count }` · `maxDoseBelow { msv }`.
- Derrota = `game.over` normal; a interface oferece recomeçar o capítulo.

### C.2 Capítulos (valores iniciais; o implementador ajusta com um bot roteirizado e relata)

Tripulação fixa: Lia Moreira (`engineer`), Kenji Tanaka (`medic`), Amara Okafor (`botanist`), Tomás Reyes (`geologist`).

**Capítulo 1 — Primeiro Sol.** `startT 0.3`. Base: habitat N1 em `s6`, bateria N1 em `s10` (cheia). Estoques: O2 20, água 40, comida 60, peças 70, regolito 20. Liberado no início: só `solar`. Passos:
1. `c1.solar`: `built solar 1` → libera `battery`. Painel `nightPower`.
2. `c1.battery`: `built battery 2` → libera `toggle`.
3. `c1.night`: `tReached 1.3` (sobreviver à primeira noite) → libera `moxie`.
4. `c1.moxie`: `built moxie 1` e depois `netNonNegative o2` (dois passos: `c1.moxie`, `c1.o2`) → libera `extractor`. Painel `moxieEnergy`.
5. `c1.water`: `built extractor 1` → libera `greenhouse`. Painel `iceOnMars`.
6. `c1.food`: `built greenhouse 1`. Painel `cropsNeedLight`.
7. `c1.end`: `tReached` (momento do passo 6 + 1 sol; no máximo sol 12).

**Capítulo 2 — Céu de Poeira.** `startT 40.3`. Base: habitat N2, 3 painéis N1 (poeira 0,12), 2 baterias N1, MOXIE N1, extrator N1, estufa N1 (`growth 1`). Estoques: O2 40, água 80, comida 60, peças 40, regolito 10, ciência 70. Tudo liberado menos `expeditions` e `shelter`; `techs: ['fission', 'eds']` com `eds` já pesquisada. Nave em `t 41` com manifesto fixo (engenheiro e botânica). Agendado: tempestade regional em `t 44` (tau 3, 2 sols); global em `t 46.5` (tau 10,8, 7 sols). Passos: `c2.land` (`landed 2`) → `c2.assign` (`assigned engineer solar`) → `c2.clean` (`cleaned`, painel `dustOnPanels`) → `c2.regional` (`eventEnded dustRegional`) → `c2.global` (`eventEnded dustGlobal`, painel `globalStorm`) → `c2.fission` (`researched fission`).

**Capítulo 3 — Fúria do Sol.** `startT 90.3`. Base do capítulo 2 mais reator N1, habitat N2, segunda estufa; sem abrigo. Doses: Lia 500 mSv, os outros 400. Estoques folgados; regolito 15, peças 30, ciência 30. Tudo liberado menos `ships` até o fim; `techs: ['spaceWeather']`. Agendado: tempestade solar moderada em `t 95` (evento DONKI de 2017-09-10 como moderada, para ensinar que a atmosfera ajuda); severa em `t 98.5`; nave em `t 101`. Passos: `c3.regolith` (`expeditionDone regolith`) → `c3.shelter` (`built shelter 1`, painel `alara`) → `c3.alert` (`researched spaceWeather`) → `c3.first` (`eventEnded spe`, painel `speAtmosphere`) → `c3.minerals` (expedição de minerais em curso quando o aviso severo chegar: passo cumprido por `recalled`) → `c3.severe` (`shelteredWhen spe` e depois `eventEnded spe`, painel `speSevere`) → `c3.dose` (`maxDoseBelow 600`) → `c3.ship` (`landed 2`).

### C.3 Interface da história

- Tela inicial: "Modo História" abre a lista de capítulos (1 liberado; 2 e 3 liberam ao concluir o anterior; progresso em `localStorage`, chave `baseSabia.story.v1`). Botão discreto "liberar todos" para a banca.
- Cenas: cartões de texto antes (`intro`) e depois (`outro`) do capítulo. Chaves `scene.<id>.title`, `scene.<id>.body`; imagem opcional em `assets/scenes/<id>.jpg` com crédito em `scene.<id>.credit` (se o arquivo não existir, cartão sem imagem).
- Durante o capítulo: cartão de objetivo fixo com o passo atual (`step.<id>.title`, `step.<id>.hint`), lista dos passos concluídos, e destaque visual no botão ou slot relevante quando der. Recursos e botões de recursos travados ficam ocultos.
- Fim: `story.complete` → cenas de `outro`, pontuação, "próximo capítulo". `game.over` → "tentar de novo".
- Dono dos textos: agente da interface (`src/i18n/**`); a equipe (EQ-2) revisa depois.

## Apêndice D — Aderência ao desafio (aprovado pelo líder da equipe em 14/11, ~15h; vinculante)

Motivo: a página do desafio pede decisões sobre atraso de comunicação e destaca ligar a blindagem ao clima espacial real.

### D.1 Modo "Sol real"

- `createGame({ ..., liveFlares: [ { id, peakTime, classType, link } ] })`, só no modo colônia. A interface busca as erupções dos últimos 30 dias no DONKI ao vivo e passa a lista; sem rede, não passa nada e o jogo usa o catálogo.
- Núcleo: `state.realSun = null | { fetchedCount, storms }`. Cada erupção de classe M5.0 ou mais vira uma tempestade solar agendada (severa se X5.0 ou mais), na ordem real: `t = EVENTS.graceSols + dias desde o início da janela de 30 dias` (1 dia real = 1 sol). Erupções menores não viram tempestade. Do sol 5 ao 35 não há sorteio de tempestade solar: vale só o Sol real. Depois, o sorteio normal com o catálogo.
- `event.start` de tempestade solar ganha `live: true` quando vem do Sol real.
- Se nenhuma erupção passar do limite, o Sol real está calmo e os primeiros 30 sols não têm tempestade solar. Isso é o dado, e a interface diz isso.

### D.2 Comunicação com a Terra

- Atraso: como já está (4 a 20 min, encurta o aviso).
- **Conjunção solar**: a cada ciclo de 26 sols, quando o atraso é máximo (`t mod 26 ≈ 13`), o Sol fica entre a Terra e Marte e não há contato. `COMM = { blackoutCenter: 13, blackoutSols: 1 }` em `balance.js` (na vida real dura cerca de duas semanas a cada 26 meses; comprimido). Nos 5 primeiros sols não acontece.
- Estado: `env.comm = { delayMin, blackout: bool, blackoutEndsAt }` (`env.commDelayMin` continua existindo). Eventos `comm.blackout.start { endsAt }` e `comm.blackout.end`; painel `conjunction` na primeira vez.
- Efeito: durante a conjunção o aviso de tempestade solar não chega (a tempestade começa direto na fase ativa). Com a tecnologia `spaceWeather` a base tem sensores próprios e ainda recebe `EVENTS.spe.warningSolsLocal = 0.25`. O seletor `speWarningSols(state)` devolve o aviso útil do momento (0 na conjunção sem a tecnologia).
- Decisão para o jogador: mandar expedição ou manter gente trabalhando fora do abrigo durante a conjunção é apostar que o Sol fica quieto.
- No modo história a conjunção fica desligada.

### D.3 Tela "Dados da NASA" (interface)

Lista cada conjunto de dados usado, o que ele decide no jogo e o link: DONKI (tempestades solares; ao vivo no Sol real), Curiosity/RAD (dose na superfície e na viagem), NASA-STD-3001 (limite de 600 mSv), Opportunity 2018 e InSight (energia solar e poeira), MOXIE (energia por kg de O2), NASA BVAD (consumo humano e cultivo), ISS ECLSS (reciclagem de água), Mars Fact Sheet (duração do sol), RadLab e OSDR (painéis de comparação, quando a pesquisa voltar). Uma linha final separa o que é medido do que é suposição de jogo.

### D.4 Painéis RadLab e OSDR

Dois painéis novos com um dado real de cada recurso da aba Resources (dose medida na ISS; um achado de saúde de astronautas). Os fatos vêm de um subagente de pesquisa; só entram com fonte aberta e conferida.

### A.7 Donos de arquivo na Fase 1

| Agente | Arquivos |
|---|---|
| Esqueleto | `package.json`, `tools/serve.mjs`, `.claude/launch.json`, `.gitignore`, `src/vendor/**`, `dev/vendor-check.html` |
| Núcleo | `src/data/constants.js`, `src/data/balance.js`, `src/sim/**`, `tests/**` |
| Interface | `index.html`, `css/**`, `src/main.js`, `src/ui/**`, `src/render2d/**`, `src/i18n/**` |
| Renderer 3D | `src/render3d/**`, `src/dev/**`, `dev/view3d.html` |
| DONKI | `src/data/donkiEvents.js`, `tools/fetch-donki.mjs` |
