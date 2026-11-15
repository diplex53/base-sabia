// Game-balance values for Base Sabiá.
// These are GAME DESIGN values (costs, outputs, tolerances, pacing), NOT science.
// Scientific constants with sources live in constants.js. Values here may be tuned
// so the bot tests pass; every change is reported (DESIGN.md Apêndice A.2).

export const TIME = { SOL_REAL_SECONDS: 24, STEP: 1 / 96, SUNRISE: 0.25, SUNSET: 0.75, START_T: 0.3 };

// Game-time compression: about two weeks of solar conjunction per 26 months
// become one sol per 26 sols. This is not a physical orbital calendar.
export const COMM = { blackoutCenter: 13, blackoutSols: 1 };

// levels[0] = level 1. cost and buildSols per level (level 1 = build; 2 and 3 = upgrade).
// Energy use of moxie / extractor / greenhouse is derived in the core:
// moxie = o2 * MOXIE_KWH_PER_KG; extractor = water * EXTRACTOR_KWH_PER_KG; greenhouse = area * GH_KWH_PER_M2_SOL.
export const MODULES = {
  habitat: {
    levels: [
      { capacity: 4, use: 24, cost: { parts: 15, regolith: 20 }, buildSols: 3 },
      { capacity: 8, use: 40, cost: { parts: 20, regolith: 26 }, buildSols: 3 },
      // level 3 needs the regolith-printing tech (Apêndice B.6)
      { capacity: 12, use: 56, cost: { parts: 26, regolith: 34 }, buildSols: 3, requiresTech: 'regolithPrinting' },
    ],
  },
  solar: {
    levels: [
      { area: 100, cost: { parts: 8 }, buildSols: 1 },
      { area: 150, cost: { parts: 10 }, buildSols: 1 },
      { area: 200, cost: { parts: 14 }, buildSols: 1 },
    ],
  },
  battery: {
    levels: [
      { capacity: 60, cost: { parts: 6 }, buildSols: 1 },
      { capacity: 120, cost: { parts: 8 }, buildSols: 1 },
      { capacity: 200, cost: { parts: 12 }, buildSols: 1 },
    ],
  },
  moxie: {
    levels: [
      { o2: 4, cost: { parts: 12 }, buildSols: 2 },
      { o2: 7, cost: { parts: 16 }, buildSols: 2 },
      { o2: 10, cost: { parts: 22 }, buildSols: 2 },
    ],
  },
  extractor: {
    levels: [
      { water: 6, cost: { parts: 8 }, buildSols: 1.5 },
      { water: 10, cost: { parts: 10 }, buildSols: 1.5 },
      { water: 16, cost: { parts: 14 }, buildSols: 1.5 },
    ],
  },
  greenhouse: {
    levels: [
      { area: 30, cost: { parts: 10, regolith: 10 }, buildSols: 2 },
      { area: 50, cost: { parts: 13, regolith: 13 }, buildSols: 2 },
      { area: 80, cost: { parts: 17, regolith: 17 }, buildSols: 2 },
    ],
  },
  shelter: {
    levels: [
      { capacity: 4, cost: { parts: 4, regolith: 40 }, buildSols: 2 },
      { capacity: 8, cost: { parts: 5, regolith: 52 }, buildSols: 2 },
      { capacity: 12, cost: { parts: 7, regolith: 68 }, buildSols: 2, requiresTech: 'regolithPrinting' },
    ],
  },
  reactor: {
    unique: true,
    requiresTech: 'fission',
    levels: [
      { kwe: 10, cost: { parts: 40, regolith: 10 }, buildSols: 4 },
      { kwe: 20, cost: { parts: 52, regolith: 13 }, buildSols: 4 },
      { kwe: 40, cost: { parts: 68, regolith: 17 }, buildSols: 4 },
    ],
  },

  // ---------- Apêndice E.2 expansion. Every number below is an ASSUMPTION: game balance, not science. ----------
  // `use` = kWh/sol on the energy bus (a consumer that can be shed and can fail); no `use` = passive structure.
  // staffable: false = nobody can be assigned there (only mine, factory and sabatier take staff, engineer bonus).
  // ASSUMPTION: health +1.0/sol per level (ISS crews exercise ~2 h a day against muscle and bone loss).
  gym: {
    staffable: false,
    levels: [
      { health: 1.0, use: 8, cost: { parts: 12, regolith: 10 }, buildSols: 2 },
      { health: 2.0, use: 12, cost: { parts: 16, regolith: 13 }, buildSols: 2 },
      { health: 3.0, use: 16, cost: { parts: 20, regolith: 17 }, buildSols: 2 },
    ],
  },
  // ASSUMPTION: health +0.5/sol per level; recovery (all health gains) x2 while health < 50.
  hospital: {
    staffable: false,
    levels: [
      { health: 0.5, use: 10, cost: { parts: 18, regolith: 12 }, buildSols: 3 },
      { health: 1.0, use: 14, cost: { parts: 22, regolith: 15 }, buildSols: 3 },
      { health: 1.5, use: 18, cost: { parts: 28, regolith: 19 }, buildSols: 3 },
    ],
  },
  // ASSUMPTION: habitat energy use -15% per level (max -45%), passive insulation.
  thermal: {
    staffable: false,
    levels: [
      { habitatUseCut: 0.15, cost: { parts: 10, regolith: 15 }, buildSols: 1.5 },
      { habitatUseCut: 0.30, cost: { parts: 13, regolith: 19 }, buildSols: 1.5 },
      { habitatUseCut: 0.45, cost: { parts: 17, regolith: 25 }, buildSols: 1.5 },
    ],
  },
  // ASSUMPTION: +2 crew places per level (pressurized volume joined to the habitats).
  pressurizer: {
    staffable: false,
    levels: [
      { crew: 2, cost: { parts: 10, regolith: 12 }, buildSols: 2 },
      { crew: 4, cost: { parts: 13, regolith: 16 }, buildSols: 2 },
      { crew: 6, cost: { parts: 17, regolith: 20 }, buildSols: 2 },
    ],
  },
  // ASSUMPTION: extractor output +20% per level (max +60%).
  waterFilter: {
    staffable: false,
    levels: [
      { extractorBoost: 0.2, use: 4, cost: { parts: 10 }, buildSols: 1.5 },
      { extractorBoost: 0.4, use: 6, cost: { parts: 13 }, buildSols: 1.5 },
      { extractorBoost: 0.6, use: 8, cost: { parts: 17 }, buildSols: 1.5 },
    ],
  },
  // ASSUMPTION: equipment-failure chance -25% per level, dust deposition on panels -10% per level.
  decon: {
    staffable: false,
    levels: [
      { failureCut: 0.25, dustCut: 0.10, use: 5, cost: { parts: 10, regolith: 5 }, buildSols: 1.5 },
      { failureCut: 0.50, dustCut: 0.20, use: 7, cost: { parts: 13, regolith: 7 }, buildSols: 1.5 },
      { failureCut: 0.75, dustCut: 0.30, use: 9, cost: { parts: 17, regolith: 9 }, buildSols: 1.5 },
    ],
  },
  // ASSUMPTION: O2, water and food storage +100% of the base capacity (STORAGE) per level.
  warehouse: {
    staffable: false,
    levels: [
      { storage: 1, cost: { parts: 8, regolith: 20 }, buildSols: 2 },
      { storage: 2, cost: { parts: 10, regolith: 26 }, buildSols: 2 },
      { storage: 3, cost: { parts: 13, regolith: 34 }, buildSols: 2 },
    ],
  },
  // ASSUMPTION: 2 regolith -> 1 part, at most `parts` per sol (x staff bonus).
  factory: {
    requiresTech: 'robotics',
    levels: [
      { parts: 3, use: 20, cost: { parts: 20, regolith: 15 }, buildSols: 3 },
      { parts: 6, use: 30, cost: { parts: 26, regolith: 20 }, buildSols: 3 },
      { parts: 10, use: 45, cost: { parts: 34, regolith: 26 }, buildSols: 3 },
    ],
  },
  // ASSUMPTION: by day (sun up, battery >= burnBelow) uses `use` kWh/sol and `water` kg/sol and makes `methane`
  // kg/sol; at night or with the battery below burnBelow it burns stored methane for `burn` kWh/sol.
  // METHANE_KWH_PER_KG < use / methane, so the round trip loses energy: it stores daytime power, never creates it.
  sabatier: {
    requiresTech: 'sabatierProcess',
    levels: [
      { water: 1, methane: 4, use: 40, burn: 30, cost: { parts: 15 }, buildSols: 2 },
      { water: 2, methane: 8, use: 80, burn: 60, cost: { parts: 20 }, buildSols: 2 },
      { water: 3, methane: 13, use: 130, burn: 100, cost: { parts: 26 }, buildSols: 2 },
    ],
  },
  // ASSUMPTION: robot miners, +regolith and +parts per sol (x staff bonus), no dose for anyone.
  mine: {
    requiresTech: 'robotics',
    levels: [
      { regolith: 4, parts: 1, use: 25, cost: { parts: 20 }, buildSols: 3 },
      { regolith: 8, parts: 2, use: 35, cost: { parts: 26 }, buildSols: 3 },
      { regolith: 14, parts: 4, use: 50, cost: { parts: 34 }, buildSols: 3 },
    ],
  },
  // Megaproject (E.2): unique, one level. GCR shield of the habitats x0.85, milestone { id: 'dome' }, +SCORE.dome.
  dome: {
    unique: true, staffable: false, requiresTech: 'domeEngineering',
    levels: [{ gcrMult: 0.85, cost: { parts: 300, regolith: 400 }, buildSols: 20 }],
  },
  // Needs a finished dome and the hydrogenShield tech: habitat GCR shield x0.7 more. ASSUMPTION: cost and time.
  radShield: {
    unique: true, staffable: false, requiresTech: 'hydrogenShield', requiresBuilt: 'dome',
    levels: [{ gcrMult: 0.7, cost: { parts: 120, regolith: 150 }, buildSols: 8 }],
  },
  // ---------- Crafting (team list). Outputs and recipes in crafting.js. ----------
  // ASSUMPTION: energy scaled from the team's kW table (basic drill -2 kW, advanced -5, table -2, builder -3)
  // onto this bus: 2 kW ~ the cheapest consumer here (waterFilter, 4 kWh/sol). Costs are game balance.
  drillBasic: { staffable: false, levels: [{ use: 4, cost: { parts: 6 }, buildSols: 1 }] },
  drillAdvanced: { staffable: false, requiresTech: 'robotics', levels: [{ use: 10, cost: { parts: 20, regolith: 10 }, buildSols: 2 }] },
  craftTable: { staffable: false, levels: [{ use: 4, cost: { parts: 5 }, buildSols: 1 }] },
  moduleBuilder: { staffable: false, levels: [{ use: 6, cost: { parts: 12, regolith: 8 }, buildSols: 2 }] },
};

/** Module types added by Apêndice E (never unlocked in story mode). */
export const EXPANSION_MODULES = ['gym', 'hospital', 'thermal', 'pressurizer', 'waterFilter', 'decon', 'warehouse', 'factory', 'sabatier', 'mine', 'dome', 'radShield', 'drillBasic', 'drillAdvanced', 'craftTable', 'moduleBuilder'];
// Crafting economy switch (part 2). One-line fallback: 'parts'.
export const DEFAULT_ECONOMY = 'craft';

// Storage (E.2). Base capacity in kg; each warehouse level adds 100% of the base. Above the cap the surplus is lost.
// methane: ASSUMPTION tank size (not raised by the warehouse).
export const STORAGE = { o2: 200, water: 400, food: 300, methane: 150 };
// ASSUMPTION: electricity per kg of methane burned (~15 kWh/kg heat at ~35% conversion).
export const METHANE_KWH_PER_KG = 5;
// Sabatier burns methane when the battery holds less than this fraction (E.2).
export const SABATIER_BURN_BELOW = 0.2;

// Load shedding: first entry is cut first. Restore in reverse order.
export const SHED_ORDER = ['greenhouse', 'extractor', 'moxie', 'habitat'];
export const RESTORE_BATTERY_FRACTION = 0.05;
// Core addition (not in Apêndice A.2): a shed module stays off at least this long before it can be
// restored from battery, so loads do not flicker on and off every few steps at dawn/dusk.
export const SHED_MIN_OFF_SOLS = 0.125;

export const STAFF_BONUS = 0.10;
export const SCIENCE_PER_COLONIST_SOL = 0.5;

export const GRACE = { o2: 0.25, blackout: 0.5, water: 2, food: 5 }; // sols
export const GREENHOUSE = { growSols: 3, dieAfterUnpoweredSols: 1 };
export const CLEAN_SOLS = 0.2;

// cargoGrowth (core addition): ship n (0-based) carries floor(cargo * (1 + cargoGrowth * n)); DESIGN 7 "crescendo".
// Tuned 0 -> 0.2 so a well-run base can grow to 8 colonists by sol ~130 (ships: 25/30/35/40/45 parts).
// Phase 3 (Apêndice B.5/B.7): regolith 20 -> 10 now that expeditions exist; announcement, decision window,
// candidates = min(maxCandidates, candidates + floor(shipsArrived / 2)).
export const SHIP = {
  intervalSols: 26, cargo: { parts: 25, food: 40, regolith: 10 }, candidates: 2, maxCandidates: 4, cargoGrowth: 0.2,
  announceSols: 5, waitSols: 1,
};

// selfSufficient: bonus once the colony milestone is reached (Apêndice B.8).
// dome: bonus once the dome megaproject is finished (Apêndice E.2).
export const SCORE = { perSol: 10, perPopPeak: 100, perTech: 150, perPanel: 20, selfSufficient: 1000, dome: 2000 };

// Colony health (Apêndice E.3), 0..100. Per sol: -decay (low gravity, 38% of Earth's), -starving more while food
// or water is at zero; + gym / hospital levels. Below lowAt: no staff bonus and construction x slowBuild.
// Cadet: the decline is halved. hospitalBoostBelow: the hospital doubles recovery below this.
export const HEALTH = { start: 100, decay: 0.5, starving: 2, lowAt: 50, lowOff: 55, slowBuild: 0.75, panelAt: 70, cadetMult: 0.5, hospitalBoostBelow: 50 };

// Colony milestone (DESIGN 11, Apêndice B.8): population >= pop and O2, water, food balance >= 0 for `sols` sols in a row.
export const SELF_SUFFICIENT = { pop: 12, sols: 26 };

// Difficulty (Apêndice B.1). startMult multiplies starting O2, water, food and parts. Physical rates never change.
export const DIFFICULTY = {
  cadet: { startMult: 1.5, regolithStart: 20, graceMult: 2, eventMult: 0.6, failures: false },
  commander: { startMult: 1.0, regolithStart: 0, graceMult: 1, eventMult: 1.0, failures: true },
};

// Random events (DESIGN 10, Apêndice B.2). Per-sol chance = p * D * eventMult, D = min(difficultyMax, 1 + sol / difficultyRampSols);
// dust devil and marsquake do not use D.
// spe.doseSkew (core addition): totalMsv = lo + (hi - lo) * u^doseSkew, u uniform. 0.25 skews toward the top of the
// SPE_*_MSV range (mean 80% of the span: severe ~84 mSv unshielded, ~36 in the habitat with a physician) because the
// DONKI list keeps only the strongest flares of each cycle.
export const EVENTS = {
  graceSols: 5, difficultyRampSols: 150, difficultyMax: 3,
  dustRegional: { p: 0.05, minGap: 6, sols: [2, 4], tau: [1.5, 3.5], rampSols: 0.5 },
  dustGlobal: { p: 0.012, minGap: 40, sols: [6, 10], tau: [6, 10.8], rampSols: 1, afterSol: 20 },
  spe: { p: 0.04, minGap: 5, warningSols: 0.1, warningSolsTech: 1, warningSolsLocal: 0.25, minWarningSols: 0.02, moderateSols: 2, severeSols: 1, doseSkew: 0.25 },
  dustDevil: { p: 0.03, removes: 0.5 },
  failure: { p: 0.03, repairParts: 3, repairSols: 0.5 },
  marsquake: { p: 0.02, science: 5 },
  observedScience: 3,
};

// Professions (DESIGN 7, Apêndice B.4).
export const PROFESSIONS = ['engineer', 'botanist', 'medic', 'geologist'];
export const PROFESSION_BONUS = 0.25;                 // replaces STAFF_BONUS when the profession matches the module
export const PROFESSION_MODULES = { engineer: ['solar', 'moxie', 'extractor', 'reactor', 'mine', 'factory', 'sabatier'], botanist: ['greenhouse'] };
export const ENGINEER_SPEED = 2;                      // cleaning and repair speed with an engineer on base
export const GEOLOGIST_MULT = 1.5;                    // expedition reward and science with a geologist

// Expeditions (DESIGN 8, Apêndice B.7). One rover; two with the pressurized-rover tech.
export const EXPEDITIONS = {
  regolith: { sols: 1, energy: 6, reward: { regolith: 30 }, science: 2 },
  ice: { sols: 2, energy: 10, reward: { water: 25 }, science: 5 },
  minerals: { sols: 3, energy: 15, reward: { parts: 8 }, science: 8 },
  stuckChance: 0.1, stuckSols: 1,
};
export const EXPEDITION_SITES = ['regolith', 'ice', 'minerals'];

// 36 fixed slots in a 6x6 grid (Apêndice E.1): s1 = (0,0), s2 = (1,0), ..., s36 = (5,5), numbered by rows.
export const GRID_N = 6;
export const SLOTS = Array.from({ length: GRID_N * GRID_N }, (_, i) => ({ id: `s${i + 1}`, gx: i % GRID_N, gz: Math.floor(i / GRID_N) }));

/** Id of the slot at (gx, gz) in the 6x6 grid. */
export const slotIdAt = (gx, gz) => `s${gz * GRID_N + gx + 1}`;
/**
 * Old 4x4 slot id (saves and data from before Apêndice E) -> new id: same cell shifted by (+1, +1),
 * so the old base sits in the middle of the new map. Ids that are not old slot ids come back unchanged.
 */
export function oldSlotToNew(id) {
  const m = /^s(\d+)$/.exec(id || '');
  const i = m ? Number(m[1]) - 1 : -1;
  if (i < 0 || i >= 16) return id;
  return slotIdAt((i % 4) + 1, Math.floor(i / 4) + 1);
}

// Off-grid sites, used in Phase 3 (expeditions).
export const SITES = [
  // shifted (+0..+2, +1) with the 6x6 map (E.1) so they stay off the grid
  { id: 'ice', gx: -2, gz: 0 },
  { id: 'regolith', gx: 7, gz: 2 },
  { id: 'minerals', gx: 7, gz: 5 },
];

export const START = {
  colony: {
    // parts 45 -> 60 with expeditions (Apêndice B.7). regolith is replaced by DIFFICULTY.regolithStart.
    resources: { energy: 30, o2: 30, water: 60, food: 80, regolith: 0, parts: 60, science: 0, methane: 0 },
    modules: [
      { slot: 's15', type: 'habitat', level: 1 },
      { slot: 's16', type: 'solar', level: 1 },
      { slot: 's21', type: 'battery', level: 1 },
    ],
    colonists: 4,
    // E.4: the expansion modules without a tech are available from the start; the others unlock with research
    unlocked: ['habitat', 'solar', 'battery', 'moxie', 'extractor', 'greenhouse', 'shelter',
      'gym', 'hospital', 'thermal', 'pressurizer', 'waterFilter', 'decon', 'warehouse', 'drillBasic', 'craftTable', 'moduleBuilder'],
  },
};

// Fictional first names (no real people), diverse origins.
export const COLONIST_NAMES = [
  'Ana', 'Kwame', 'Yuki', 'Priya', 'Mateo', 'Leila', 'Ivan', 'Nia',
  'Rafael', 'Mei', 'Omar', 'Sofia', 'Aiyana', 'Jonas', 'Thandiwe', 'Arjun',
];
