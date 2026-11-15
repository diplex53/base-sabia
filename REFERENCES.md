# Protocol: Ares — sources, model limits and credits

Research update: 14 November 2026. The sections marked “checked in this session” were opened during this continuation. The remaining inventory records sources already used in the project; it does not imply that every value was independently revalidated today. Exact equations and source-status comments are in `src/data/constants.js`; costs and pacing are in `src/data/balance.js`.

## Data used by the game

| Source | What it contributes | Status / interpretation |
|---|---|---|
| [NASA CCMC DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | Historical flare IDs, dates, classes and links; recent flares for the optional Real Sun mode | Real records, with an educational conversion into game storms. Flare class does not establish a particle event or impact at Mars. |
| [Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | Sol length, irradiance, synodic period | Published physical quantities; day-to-sol conversions are calculated locally. |
| [Curiosity/RAD surface measurements](https://www.nasa.gov/news-release/nasa-rover-results-include-first-age-measurement-on-mars-and-help-for-human-exploration/) | Surface radiation reference, 0.67 mSv per Earth day | Reference environment, not a prediction for all locations or dates. |
| [RAD cruise measurements](https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/) and [NASA comparison graphic](https://science.nasa.gov/resource/radiation-exposure-comparisons-with-mars-trip-calculation/) | 1.8 mSv/day cruise reference; 180-day one-way scenario | The starting 324 mSv is the product of these assumptions, not a measurement of a fictional colonist. |
| [NASA-STD-3001 human performance](https://www.nasa.gov/reference/4-0-human-performance/) | 600 mSv career limit reference | A career exposure limit, not a threshold for immediate death. In the game affected crew retire. |
| [NASA radiation protection technical brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf) | ALARA and exposure-management context | The game's physician multiplier is a gameplay abstraction, not a measured treatment effect. |
| [Opportunity 2018 dust storm](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/) | Observed opacity and solar-power disruption | NASA/JPL page reopened in this session. The 645/22 Wh pair still carries the secondary-source caveat below. |
| [InSight first-sol output](https://www.jpl.nasa.gov/news/mars-new-home-a-large-sandbox/) and [later power loss](https://science.nasa.gov/photojournal/insights-power-generation-after-landing-and-spring-2022) | Solar generation anchor and dust accumulation explanation | Scaling to base-size panels and geometric array area are model calculations. |
| [MOXIE mission results](https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/) and [instrument specifications](https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/) | Oxygen production and power reference | Using 300 W / 12 g/h as 25 kWh/kg is a simplified scaling, not an industrial plant specification. |
| [NASA BVAD, 2018 revision](https://ntrs.nasa.gov/api/citations/20180001338/downloads/20180001338.pdf) | Crew oxygen, water, dry food and crop baselines | Tables 3-33, 4-20, 4-57, 4-97; crop-electricity yield in Table 4-95 remains a verification item. |
| [ISS water recovery milestone](https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/) | 93% and 98% recovery references | Used as recycling fractions, with simplified resource accounting. |
| [Veggie fact sheet](https://www.nasa.gov/wp-content/uploads/2023/03/veggie-fact-sheet-508.pdf) and [plants for life support](https://ntrs.nasa.gov/api/citations/20200002230/downloads/20200002230.pdf) | Crop explanations and crop area for oxygen support | Fast crop growth, output by level and irrigation loss are game assumptions. |
| [KRUSTY / Kilopower](https://www.nasa.gov/news-release/demonstration-proves-nuclear-fission-system-can-provide-space-exploration-power/) | Small fission power-system reference | Module availability, costs and upgrades are gameplay. |
| [Earth–Mars communication delay](https://www.nasa.gov/missions/tech-demonstration/deep-space-atomic-clock/how-an-atomic-clock-will-get-humans-to-mars-on-time/) | 4–20 minute delay range | The game's smooth periodic curve is a simplification. |
| [Solar conjunction, NASA/JPL, 2023](https://www.jpl.nasa.gov/news/nasas-mars-fleet-will-still-conduct-science-while-lying-low/) | Pausing commands when solar interference is hazardous | Checked in this session. Two-week command pause; some telemetry continued, with two days of complete occultation. The game's one-sol blackout every 26 sols is not the literal operational timeline. |
| [2017 solar storm at Mars](https://www.jpl.nasa.gov/news/large-solar-storm-sparks-global-aurora-and-doubles-radiation-levels-on-the-martian-surface/) | Historical context for the story and surface response | The moderate game dose of 1–5 mSv is an assumption based on the reported response. |
| [NASA TP-2979](https://ntrs.nasa.gov/citations/19900009041) | Modeled severe solar-particle exposure ranges | Model estimates, not direct dose measurements for each DONKI flare. |

## Reproducible RadLab reading — checked in this session

Source: NASA OSDR RadLab, DosTel instruments aboard the ISS. The [official API example](https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument=DosTel&timestamp%3E=2022-04-01T23%3A00&timestamp%3C2022-04-02T01%3A05&absorbed_dose_rate%3E2&flux&latitude&longitude&altitude&b&l&format=html) was opened on 14 November 2026 during the research session ending at approximately 18:04 UTC (15:04 Brasília). It returned this row:

| Field | Value |
|---|---|
| spacecraft | ISS |
| instrument_id | DosTel1 |
| timestamp, as returned | 2022-04-01T23:00:00 |
| absorbed_dose_rate | 9.815504 |
| Unit, per API documentation | μGy/hour |

The panel rounds the reading to **9.82 μGy/h**. This is a single instrument reading, not a daily mean or a personal career dose. The visible timestamp metadata did not explicitly establish a timezone, so the panel does not add one. [API field definitions](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) distinguish absorbed dose rate (μGy/h) from dose-equivalent rate (μSv/h). These quantities must not be substituted for each other. No ISS measurement is used to recalibrate the Mars simulation.

## OSDR health finding — checked in this session

[OSD-343, version 2](https://osdr.nasa.gov/bio/repo/data/studies/OSD-343), DOI **10.26030/h968-2m75**, contains **mouse** metabolite-profiling data associated with Rodent Research-9. Its description links the data to a broader multi-omics analysis combining space experiments and biomedical profiles from **59 astronauts**. That broader analysis reported mitochondrial stress associated with spaceflight. The panel explicitly distinguishes the mouse dataset from the astronaut cohort; it does not claim that OSD-343 is a table of 59 human participants or that space radiation alone caused every observed change.

Original research: da Silveira et al., *Comprehensive Multi-omics Analysis Reveals Mitochondrial Stress as a Central Biological Hub for Spaceflight Impact*, **Cell** 183 (2020), DOI **10.1016/j.cell.2020.11.002**; [open author manuscript](https://pmc.ncbi.nlm.nih.gov/articles/PMC7870178/). Used for a short educational health panel, not as a medical prediction or a numerical simulation input.

## Historical DONKI catalogue

`src/data/donkiEvents.js` records 64 curated entries for 2010-01-01 through 2026-11-14. Its embedded extraction timestamp is **2026-11-14T15:41:30.949Z**. The script is `tools/fetch-donki.mjs`; endpoints are [FLR](https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR) and [SEP](https://ccmc.gsfc.nasa.gov/DONKI/WS/get/SEP). Each entry includes its DONKI source link.

The catalogue selects X2.5+ flares and M5+ flares linked to a SEP record, preserving the 2017-09-10 event. The optional recent-data mode uses its separate M5+ rule. In both modes, converting flare class into moderate/severe game storms is an explicit educational assumption. Real exposure at Mars also depends on particle spectra, propagation, magnetic connectivity, shielding and location. A successful empty recent-data response is a quiet observed window; a failed request uses the archive and must be labelled as archive.

## Additional panel references

- [Spirit panel-cleaning event](https://www.jpl.nasa.gov/news/spirit-gets-energy-boost-from-cleaner-solar-panels/): dust removal.
- [Space Station water recycling](https://ntrs.nasa.gov/api/citations/20100033089/downloads/20100033089.pdf): equipment-maintenance context.
- [InSight marsquake](https://www.nasa.gov/missions/insight/nasas-insight-records-monster-quake-on-mars/): seismic event explanation.
- [Space radiation overview, SRAG](https://srag.jsc.nasa.gov/spaceradiation/what/what.cfm) and [NASA shielding explanation](https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/): radiation panels.
- [Rendezvous with Mars](https://www.nasa.gov/podcasts/houston-we-have-a-podcast/rendezvous-with-mars/): supply windows and sustainability context.
- [Purgatory Dune](https://science.nasa.gov/resource/looking-back-at-purgatory-dune/) and [Spirit mission](https://www.jpl.nasa.gov/missions/mars-exploration-rover-spirit-mer-spirit/): stuck-rover explanation.
- [Phoenix](https://science.nasa.gov/mission/mars-phoenix/) and [Mars water-ice map](https://www.jpl.nasa.gov/news/nasas-treasure-map-for-water-ice-on-mars/): extracting ice and the fictional Arcadia Planitia base.
- [Electrodynamic dust shield](https://www.nasa.gov/image-article/nasas-dust-shield-successfully-repels-lunar-regolith-on-moon/), [CHAPEA](https://www.nasa.gov/humans-in-space/chapea/) and [pressurized rover concept](https://ntrs.nasa.gov/citations/20100040298): technology context.

## Open verification items and model assumptions

- Opportunity's **645 Wh / 22 Wh** before/during-storm pair is currently sourced to [The Planetary Society's MER report](https://www.planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep). A direct NASA source for both values is still pending. Do not label that pair “NASA-verified”.
- Pathfinder dust deposition **0.28% per sol** is attributed in the source code to Landis & Jenkins (2000); the original article remains to be opened and checked.
- Crop biomass per electricity (**10 g/kWh**, chosen from the stated range) remains a verification and modeling item.
- Array-area scaling; exponential opacity/power fit; fixed shielding factors; physician bonus; ice-extraction efficiency; irrigation loss; storm dust multipliers; costs, durations, probabilities and construction rates are simplified model choices.
- **Crafting, ores and expansion structures:** the ore list, drill yields, recipes, structure kits, colony-health rates, dome and radiation-shield multipliers, and the 72-slot map layout are team game design with no measured source. They are not claims about Martian mineral abundance or real manufacturing processes.
- **Science notes on structure cards:** notes that restate values from the table above (MOXIE, Veggie, KRUSTY, water recovery, signal delay, irradiance, ALARA, Arcadia Planitia ice, dust shield) share those sources. The following card statements were written from general knowledge and do not yet have a source link recorded here: Perseverance night temperature of −83 °C, about 2 hours of daily exercise on the Space Station, perchlorates in Mars dust, the Sabatier reaction used on the Space Station, polyethylene and hydrogenated boron nitride nanotubes for shielding, 3D-printed construction tests, and the mineral content of Martian soil. Add a link for each or soften the wording before calling them verified. The FAOP dome is the team's own concept and is labelled as such in the game.
- A 26-sol supply/conjunction cycle, rapid building/crop growth and shortened storms are deliberate time compression. A sol lasts 24 real seconds at 1×.
- **Mars Trek is not yet a source of actual terrain in this implementation.** Do not claim terrain elevation, geolocation validation or imagery from it without a recorded export and integration.
- The challenge URL was unavailable to this research tool on this continuation. Event rules and required deliverable format remain the team's supplied requirements, not newly verified claims: [challenge page](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/?tab=details).

## Software, visuals and AI disclosure

- **Three.js 0.187.0 (r187)**, vendored from the npm `three` package. MIT license and copyright notice are retained in `src/vendor/three/LICENSE`; provenance and copied files are recorded in `src/vendor/three/README.md`. [Three.js](https://threejs.org/).
- Simulation, interface, procedural voxel geometry and source-linked educational text are project code/content. Current game visuals are programmatically rendered geometry; no externally downloaded photographs are required for the scenes. If images, music, fonts or other assets are added, list every asset, author, source and license before publishing.
- AI assistance: **Claude** was used in the earlier work for planning, implementation, translations, research support and tests, as documented in the conversation. **OpenAI Codex and its agents** were used for continuation, debugging, implementation, PT/EN text, source checks, test review and these draft documents. The team supplied the game idea and major design decisions and must review the final submission. Do not claim that AI output itself establishes scientific validity.
- This is an independent educational prototype, not an official NASA product. NASA names are used for source attribution; no NASA logo or mission insignia is included in the proposed demo.
