# Protocol: Ares — Junior Astronaut Mission Trainer

Submission draft. Replace the demo link placeholder after the recording is uploaded, and confirm every event requirement before submitting. Do not publish placeholder links.

## Summary

How do you keep a Mars base alive when sunlight fades and a solar storm is approaching? Protocol: Ares lets young learners make those decisions in a browser. They build a voxel colony, balance energy, oxygen, water and food, and protect their crew from accumulated radiation. Short science cards connect each challenge to a real mission, measurement or research source.

**Project link:** https://diplex53.github.io/base-sabia/

**Demo link:** pending recording and public upload.

## The problem and who benefits

Space exploration involves connected systems: more oxygen production costs electricity, food needs light and water, and going outside trades resources against exposure. Facts are easier to understand when learners can experiment with these trade-offs and see the result.

The game is intended for children ages 7–12 with adult or classroom guidance where needed. Portuguese and English text, a guided story, adjustable speed and pause controls support different learning paces. Accessibility and learning outcomes still need testing with children and teachers; we do not claim measured educational impact yet.

## How it works

Players construct and upgrade modules on a 72-slot base map through a central build menu, where every structure card carries a short science note. They assign crew specialists, send expeditions and decide which incoming colonists the base can support. Solar generation varies with day/night, airborne dust and panel dust. Life-support systems consume electricity while producing resources. Radiation accumulates, and sheltering protects people while pausing outside work. A colony-health score reacts to shortages, a technology tree unlocks advanced structures, and the long-term goal is a protective dome.

A crafting layer designed by the team adds drills that mine ores, a production table that turns them into parts such as iron bars, wire and glass, and structure kits that build faster. Inventory opens with V and crafting with P.

The story follows the fictional Sabiá crew through base construction, dust storms and solar-particle events. Colony mode offers continued growth and seeded random events. The Science Notebook collects short explanations and links to the underlying evidence. A presentation mode (`?demo=1` or the button on the title screen) plays the game by itself with captions.

The optional Real Sun mode uses recent NASA DONKI flare records to schedule educational storms. The interface labels live data and archive fallback. A communication-conjunction mechanic challenges players to prepare for limited Earth support. Flare-to-storm conversion and blackout timing are simplified teaching rules, not forecasts for Mars.

## NASA data and scientific validity

- **DONKI:** historical and recent flare IDs, dates and classes give the solar events traceable source records.
- **Curiosity/RAD and NASA human-performance standards:** inform radiation reference rates and the 600 mSv career-limit mechanic. Reaching the limit retires a colonist; it does not represent sudden death.
- **Mars Fact Sheet, Opportunity, InSight, MOXIE and BVAD:** inform the sol duration and energy/life-support relationships.
- **RadLab:** a measured ISS DosTel1 absorbed-dose-rate reading illustrates real environmental monitoring, with units explicitly distinguished from equivalent dose.
- **OSDR:** a health card explains mitochondrial-stress research and clearly distinguishes the mouse OSD-343 dataset from the broader study's astronaut profiles.

Source links appear inside the game and in `REFERENCES.md`. Measured inputs, calculations and gameplay assumptions are identified separately. Ore types, drill rates, crafting recipes, colony-health rates and dome effects are gameplay design, not measurements. The prototype is educational and is not mission-planning or medical software.

## Tools and architecture

HTML, CSS, native JavaScript ES modules and a locally bundled Three.js library. The pure JavaScript simulation is independent of the renderer and is covered by 62 automated Node tests. A 2D fallback uses the same simulation if 3D cannot run. The static site needs no account or backend; a live DONKI request is optional, and the historical catalogue is bundled locally.

## What makes the approach different

The game turns setbacks into questions: why did the solar array stop supplying enough energy, and what did a real rover experience in a similar situation? The answer is shown at the moment of the decision, alongside its source. Players can pause, adjust the base and try again.

## Current limits and next steps

Complete classroom playtests, validate reading level and keyboard/mobile access, and refine the balance from observed player behavior. Remaining research includes the original Pathfinder dust-deposition paper, a direct NASA source for the Opportunity 645/22 Wh pair and the crop-electricity-yield assumption. Actual Mars terrain data and photographs are future work; the current voxel terrain is illustrative.

## AI and credits

The team supplied the idea and major design decisions. Claude and OpenAI Codex agents assisted with planning, code, tests, translation, source research and drafting. The team is responsible for reviewing the finished project and its scientific claims. Three.js is used under the MIT license. See `REFERENCES.md` for the full source inventory, model limitations and AI disclosure. This project is not affiliated with or endorsed by NASA.
