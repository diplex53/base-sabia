// Source of each science panel. Title and body live in i18n: panel.<id>.title / panel.<id>.body
// Each entry has `sources: [{ name, url }]` (one or more). `sourceName` / `url` mirror the first source.
// `donki: true` marks panels about solar storms: the UI appends the real DONKI event line to them.
const BVAD = 'https://ntrs.nasa.gov/api/citations/20180001338/downloads/20180001338.pdf';
const CAREER = 'https://www.nasa.gov/reference/4-0-human-performance/';
const JPL_DUST = 'https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/';
const VEGGIE = 'https://www.nasa.gov/wp-content/uploads/2023/03/veggie-fact-sheet-508.pdf';
const WATER98 = 'https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/';
const PODCAST = 'https://www.nasa.gov/podcasts/houston-we-have-a-podcast/rendezvous-with-mars/';

const S = (...list) => {
  const sources = list.map(([name, url]) => ({ name, url }));
  return { sources, sourceName: sources[0].name, url: sources[0].url };
};

export const SCIENCE_PANELS = {
  // Checked against the primary sources on 2026-11-14. RadLab reports absorbed
  // dose rate in microgray/hour, not the equivalent dose in millisieverts used by the game.
  conjunction: S(['NASA/JPL, Mars solar conjunction (2023)', 'https://www.jpl.nasa.gov/news/nasas-mars-fleet-will-still-conduct-science-while-lying-low/']),
  radlab: S(['NASA OSDR RadLab, DosTel readings on the ISS (2022-04-01)', 'https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument=DosTel&timestamp%3E=2022-04-01T23%3A00&timestamp%3C2022-04-02T01%3A05&absorbed_dose_rate%3E2&flux&latitude&longitude&altitude&b&l&format=html'], ['NASA OSDR RadLab, field definitions and units', 'https://visualization.osdr.nasa.gov/radlab/gui/data-api/']),
  osdrHealth: S(['NASA OSDR, OSD-343: mitochondrial stress in spaceflight', 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-343'], ['da Silveira et al., Cell (2020), original study', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7870178/']),
  muscleLoss: S(['NASA OSDR, Open Science Data Repository', 'https://osdr.nasa.gov/bio/repo/']),
  'over.health': S(['NASA OSDR, Open Science Data Repository', 'https://osdr.nasa.gov/bio/repo/'], ['NASA, Human Performance', CAREER]),
  nightPower: S(['NASA Mars Fact Sheet', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html']),
  moxieEnergy: S(['NASA, MOXIE', 'https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/']),
  dustOnPanels: S(['NASA, InSight', 'https://science.nasa.gov/photojournal/insights-power-generation-after-landing-and-spring-2022']),
  cropsNeedLight: S(['NASA Veggie fact sheet', VEGGIE]),
  careerLimit: S(['NASA, Human Performance', CAREER]),
  shipRefused: S(['NASA, Houston We Have a Podcast', PODCAST]),
  'over.o2': S(['NASA BVAD (life support baseline)', BVAD]),
  'over.water': S(['NASA, Space Station water recovery', WATER98]),
  'over.food': S(['NASA BVAD (life support baseline)', BVAD]),
  'over.blackout': S(['NASA/JPL, Opportunity', JPL_DUST]),
  'over.dose': S(['NASA, Human Performance', CAREER]),
  'over.noCrew': S(['NASA, Human Performance', CAREER]),

  // Phase 3: events
  dustStorm: S(['JPL, Opportunity', JPL_DUST]),
  globalStorm: S(['JPL, Opportunity', JPL_DUST], ['NASA, Martian dust storms', 'https://www.nasa.gov/solar-system/the-fact-and-fiction-of-martian-dust-storms/']),
  cleaningEvent: S(['JPL, Spirit', 'https://www.jpl.nasa.gov/news/spirit-gets-energy-boost-from-cleaner-solar-panels/']),
  equipmentFailure: S(['NASA, Space Station water recycling', 'https://ntrs.nasa.gov/api/citations/20100033089/downloads/20100033089.pdf']),
  marsquake: S(['NASA, InSight', 'https://www.nasa.gov/missions/insight/nasas-insight-records-monster-quake-on-mars/']),
  speWarning: { ...S(['NASA, Space Radiation (SRAG)', 'https://srag.jsc.nasa.gov/spaceradiation/what/what.cfm'], ['NASA, Deep Space Atomic Clock', 'https://www.nasa.gov/missions/tech-demonstration/deep-space-atomic-clock/how-an-atomic-clock-will-get-humans-to-mars-on-time/']), donki: true },
  speAtmosphere: { ...S(['JPL, Curiosity', 'https://www.jpl.nasa.gov/news/large-solar-storm-sparks-global-aurora-and-doubles-radiation-levels-on-the-martian-surface/']), donki: true },
  speSevere: { ...S(['NASA, solar storm doses on Mars', 'https://ntrs.nasa.gov/citations/19900009041'], ['NASA, protecting astronauts from space radiation', 'https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/']), donki: true },
  alara: S(['NASA, radiation protection (OCHMO)', 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf']),
  launchWindow: S(['NASA, Houston We Have a Podcast', PODCAST]),
  roverStuck: S(['NASA, Looking back at Purgatory Dune', 'https://science.nasa.gov/resource/looking-back-at-purgatory-dune/'], ['JPL, Spirit', 'https://www.jpl.nasa.gov/missions/mars-exploration-rover-spirit-mer-spirit/']),
  iceOnMars: S(['NASA, Phoenix', 'https://science.nasa.gov/mission/mars-phoenix/'], ['JPL, water ice map', 'https://www.jpl.nasa.gov/news/nasas-treasure-map-for-water-ice-on-mars/']),

  // Phase 3: technologies
  'tech.eds': S(['NASA, Electrodynamic Dust Shield', 'https://www.nasa.gov/image-article/nasas-dust-shield-successfully-repels-lunar-regolith-on-moon/']),
  'tech.waterRecycling': S(['NASA, Space Station water recovery', WATER98]),
  'tech.spaceWeather': S(['NASA, DONKI', 'https://ccmc.gsfc.nasa.gov/tools/DONKI/']),
  'tech.regolithPrinting': S(['NASA, CHAPEA', 'https://www.nasa.gov/humans-in-space/chapea/']),
  'tech.plantHabitat': S(['NASA Veggie fact sheet', VEGGIE]),
  'tech.bioregen': S(['NASA, plants for life support', 'https://ntrs.nasa.gov/api/citations/20200002230/downloads/20200002230.pdf']),
  'tech.pressurizedRover': S(['NASA, pressurized rover concept', 'https://ntrs.nasa.gov/citations/20100040298']),
  'tech.fission': S(['NASA, KRUSTY', 'https://www.nasa.gov/news-release/demonstration-proves-nuclear-fission-system-can-provide-space-exploration-power/']),
};
