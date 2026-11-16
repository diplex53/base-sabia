# `Hunters`

### Integrantes: João Pedro, Arthur Vieira, Gabriel Brant, Gabriel Janke, Lucas Dias e Nicolas Silva

# `Protocol: Ares` — Junior Astronaut Mission Trainer

A browser game about keeping a Mars base alive, built for the NASA Space Apps Challenge 2026 (Belo Horizonte), challenge "Junior Astronaut Mission Trainer".

**Play:** https://diplex53.github.io/base-sabia/
**Guided presentation (plays by itself, with captions):** https://diplex53.github.io/base-sabia/?demo=1

This README has two parts: first what the project is and how it works, then the full disclosure of how AI was used to build it.

---

## Part 1 — The project

### What it is

Protocol: Ares is a colony-management game for learners aged 7 to 12. The player runs a small base on Mars, builds structures on a map, and has to balance energy, oxygen, water and food while protecting the crew from radiation. When something goes wrong (a dust storm cuts solar power, a solar flare forces everyone into the shelter), a short science card explains why, with the real mission or measurement behind it and a link to the source.

The game runs entirely in the browser. It is a static site: no account, no server, no build step. Text is available in Portuguese and English.

### How you play

- **Build.** Click an empty spot on the 72-slot map and choose a structure from the build menu. Each card has a short science note. There are 24 structures: habitat, solar panels, battery, fission reactor, MOXIE oxygen plant, ice extractor, greenhouse, radiation shelter, Sabatier reactor, water filter, pressurizer, thermal control, decontamination airlock, warehouse, factory, mine, gym, hospital, drills, production table, module builder, radiation shield and the dome.
- **Balance.** Solar power changes with day and night, dust in the air and dust on the panels. Life-support structures use electricity to make oxygen, water and food. Radiation dose accumulates for each colonist.
- **Craft.** In colony mode the economy is the crafting system designed by the team. Drills mine ores; regolith can be sifted for iron, silicon and aluminum; a production table turns ores into parts (iron bars, wire, glass and others); structures are built from crafted kits and items. Inventory opens with V, crafting with P.
- **Decide.** Assign crew specialists, research technologies in a tree, send rover expeditions, decide which arriving colonists the base can support, choose whether stored methane is burned for power, and shelter the crew when a solar storm arrives.
- **Win.** The long-term goal is a protective dome over the whole base. Finishing it plays a victory scene; the game can continue afterwards.

### Game modes

- **Colony mode:** free play with seeded random events, two difficulty levels (Cadet and Commander).
- **Story mode:** three guided chapters that teach the systems step by step.
- **Real Sun (optional):** uses recent solar-flare records from NASA DONKI to schedule the solar storms. If the live request fails, the bundled archive is used and labelled as archive.
- **Presentation mode:** `?demo=1` (or the button on the title screen) plays the game by itself, stops at each new structure or event with a caption, waits about 10 seconds and goes on. Space skips ahead. `?demo=1&t=20` sets the seconds per stop; `?demo=manual` waits for the key.

### NASA data and scientific validity

- **DONKI** (space-weather database): historical and recent flare records drive the solar events.
- **Curiosity/RAD and NASA human-performance standards:** radiation reference rates and the 600 mSv career limit. Reaching the limit retires a colonist; nobody dies on screen.
- **Mars Fact Sheet, Opportunity, InSight, MOXIE, BVAD:** sol length, sunlight, dust-storm power loss, oxygen production and crew consumption.
- **RadLab and OSDR:** a measured radiation reading from the Space Station and a health study, each shown with its limits.

Every scientific constant is stored with its source in `src/data/constants.js`. Game-balance numbers (costs, build times, ore types, recipes, drill rates) are kept separately in `src/data/balance.js` and `src/data/crafting.js`, and values without a source are marked `ASSUMPTION`. The full source list, model limits and open verification items are in [REFERENCES.md](REFERENCES.md). This is an educational prototype, not mission-planning or medical software, and it is not affiliated with or endorsed by NASA.

### How it is built

- HTML, CSS and native JavaScript ES modules; Three.js (MIT license, bundled locally) for the 3D voxel view.
- `src/sim/` is the simulation core in pure JavaScript, with no DOM and no Three.js, so it can be tested with Node.
- `src/render3d/` is the 3D view; `src/render2d/` is a 2D fallback that uses the same simulation (`?view=2d`).
- `src/ui/` is the interface, `src/i18n/` the Portuguese and English text, `src/demo/` the presentation mode, `src/data/` the constants, balance and the bundled DONKI catalogue.
- `DESIGN.md` is the specification.

### Run it locally

```bash
node tools/serve.mjs 8080
```

Then open http://localhost:8080/.

```bash
node tests/run.mjs
```

Runs the 63 automated tests of the simulation core (a few minutes).

### Known limits

- Balance of the crafting economy was checked by scripts and a short manual start, not by long play sessions.
- No classroom playtests yet; reading level and learning outcomes are not measured.
- The terrain is illustrative, not real Mars elevation data.
- Some science-card statements have sources located by search but not read in full; see `REFERENCES.md`.

---

## Part 2 — Use of AI

Space Apps requires teams to declare their use of AI. This is the declaration. The original log, kept in Portuguese while we worked, is [AI_USE.md](AI_USE.md); this section is its English version.

### Summary

We used a generative AI assistant (Claude, by Anthropic, through the Claude Code desktop app) as a software architect and programmer under the direction of the team. The team decided what the game is, which features it has, who it is for and what was cut. The AI proposed the technical design, looked up and cross-checked the public NASA numbers, wrote the code through sub-agents, wrote automated tests and reviewed the result.

`REFERENCES.md` and `PROJECT_PAGE.md` also record that OpenAI Codex agents were used in one continuation session for debugging, source checks, PT/EN text and drafting those two documents.

No AI-generated images, video, voice or music are used: the visuals are drawn by code (voxels in Three.js), so there is no AI media to watermark. All in-game text was drafted with AI and read by the team.

### Who did what

| Who | What |
|---|---|
| Team | Game idea, audience, list of resources, list of structures, ore and recipe list, what goes in and what waits, playtesting, change requests, presentation |
| AI as architect | Design document (`DESIGN.md`), mathematical model of the simulation, choice and checking of the NASA data, split of the code into modules, review of what the sub-agents delivered |
| AI as programmer (sub-agents) | Simulation core, interface, 3D and 2D views, Portuguese and English text, automated tests, publishing to GitHub Pages |

### Request log

Each row: what the team asked, why, and what the AI did.

| When | Team request | Why | What the AI did |
|---|---|---|---|
| Sat 14 Nov, start | Plan the game from our summary: Mars base, real time, resources, colonists, ships, expeditions, technologies, story mode, a science panel after each event | Only one team member programs; we needed a plan that fit in a weekend | Wrote `DESIGN.md` and `TASKS.md`, with a cut order in case time ran out |
| Sat | Use real numbers | Scientific validity and central use of NASA data | Collected and checked the constants (InSight solar output, Opportunity dust-storm drop, MOXIE, crew oxygen/water/food use, RAD/Curiosity dose, 600 mSv limit) and stored each with source and link |
| Sat | Keep the simulation core separate from the screen | To test the maths without opening the game and to have a 2D fallback | Sub-agents wrote `src/sim` in pure JS and the tests in `tests/` |
| Sat | Interface and 3D voxel view | It is what the child sees; it had to be clear and good-looking | Sub-agents built the HUD, the panels and the Three.js view, with the 2D fallback |
| Sat | Show the game as soon as it was playable | The team wanted to test and comment early | Ran it locally, then published to GitHub Pages |
| Sat | Check the project against the challenge page | To stay on the brief | Compared and proposed four adjustments, accepted by the team: DONKI as central data, "Real Sun" mode, a "NASA Data" screen, panels linked to RadLab and OSDR |
| Sat | Events, difficulty levels, shelter, professions, ships, technologies, expeditions | To give the player real decisions | Specified them and delegated the implementation; simulated players were used to tune the balance |
| Sat/Sun | Story mode in three chapters | Teach step by step before free play | Specified and delegated |
| Sun 15 Nov, morning | Large list of changes from the team: bigger map and twelve new structures, pause menu, city panel, info button, descriptions | Ideas from the teammates who do not program | Implemented what fit: 36-slot map, 12 structures, colony health, the dome as goal, City panel. Said what did not fit, which was set aside as "future" |
| Sun, 10:50 | AI-use report, kept up to date | Event rule | `AI_USE.md` |
| Sun, 10:50 | Build menu as a central pop-up; technologies as a tree of linked nodes | The corner list was small; the tree makes unlocks clearer | Delegated to sub-agents |
| Sun, 10:55 | Presentation mode that plays by itself with captions | The team presents to judges and comments while the game runs | Delegated to a sub-agent |
| Sun, 11:00 | Keep a state file to continue from another account | The usage limit of one account could run out | `CLAUDE.md`, updated at each step |
| Sun, 11:10 | The science description the team wrote on each build card | Show the science when the player chooses what to build | A sub-agent used the team's texts, fixing spelling and scientifically imprecise points |
| Sun, 11:10 | Rename to "Protocol: Ares" | Team decision | Title changed |
| Sun, 11:10 | Soil-coloured build ground with a "+", build area twice as large, much larger world | Grey concrete looked wrong and the map felt small | Sub-agent in a separate copy of the code; the larger world is visual only, to keep the frame rate |
| Sun, 11:10 | Drills, ores and a crafting system with the team's recipes | Central idea of the teammates who do not program | Sub-agent in a separate copy. AI decision because of the deadline: crafting first entered as an additional path instead of replacing the parts system |
| Sun, 11:25 | Inventory on V, recipes on P, and replace the parts system with the team's items and ores | The team wants the final game to use the resource system it designed | The AI pointed out that the recipes were circular (the advanced drill needs ores only it can mine) and proposed the fix: start with a production table and a basic drill, and ships bring advanced ores. The change sits behind a one-line switch |
| Sun, 11:40 | Remove the "Module" panel on the right | It had no purpose once building became a pop-up | The panel now shows only for a selected structure |
| Sun, 11:40 | Publish the 72-slot map and crafting | Requests ready and tested | The AI merged, ran the tests and checked in the browser before publishing |
| Sun, 12:05 | Bigger, complete dome with a hide button; presentation that pauses at each new thing; build-menu formatting; really use crafting (sift regolith to get iron and other materials) | The team explains the game live and wants its own resource system in the game | Three sub-agents in parallel. The AI reviewed in the browser, found and fixed a bug that froze "New game" (a missing import), ran the tests and published. The AI raised the starting items of the crafting economy because, with the original numbers, there was not enough power for the first solar panel; the team's recipes were not changed |
| Sun, 12:40 | Smaller HUD in the presentation; presentation that waits and goes on by itself; choose whether methane is burned for power; victory scene when the dome is finished; better title screen | Prepare the demonstration | Implemented and checked in the browser, except the methane button, which passed the automated tests but was not clicked in the browser |
| Sun, 12:55 | Allow more than one fission reactor; review every structure; English README with the project explanation and this declaration | Team decision; submission | Removed the one-reactor limit. A script built each of the 24 structures in the simulation and checked texts in both languages, icon, 3D model, build-menu section and crafting path: no problems found. Wrote this README |

### What the AI did not decide

- The theme, the audience, the resources and the structures of the game came from the team.
- The team approved or refused each proposed change of scope.
- The team played, pointed out what was bad (for example, the build menu in the corner) and asked for the fixes.

### Limits and care

- Game numbers without a source (costs, build times, score, recipes) are kept apart from the scientific constants, and unsourced values are marked `ASSUMPTION`.
- AI can be wrong: that is why there are 63 automated tests of the core and a browser check before each publish. AI output does not by itself establish scientific validity; the team is responsible for the final submission.
- No personal data of the participants was put in the game or in the demo.
