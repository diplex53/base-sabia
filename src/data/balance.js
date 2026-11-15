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
};

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
export const SCORE = { perSol: 10, perPopPeak: 100, perTech: 150, perPanel: 20, selfSufficient: 1000 };

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
export const PROFESSION_MODULES = { engineer: ['solar', 'moxie', 'extractor', 'reactor'], botanist: ['greenhouse'] };
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

// 16 fixed slots in a 4x4 grid: s1 = (0,0), s2 = (1,0), ..., s16 = (3,3).
export const SLOTS = Array.from({ length: 16 }, (_, i) => ({ id: `s${i + 1}`, gx: i % 4, gz: Math.floor(i / 4) }));

// Off-grid sites, used in Phase 3 (expeditions).
export const SITES = [
  { id: 'ice', gx: -2, gz: -1 },
  { id: 'regolith', gx: 5, gz: 1 },
  { id: 'minerals', gx: 5, gz: 4 },
];

export const START = {
  colony: {
    // parts 45 -> 60 with expeditions (Apêndice B.7). regolith is replaced by DIFFICULTY.regolithStart.
    resources: { energy: 30, o2: 30, water: 60, food: 80, regolith: 0, parts: 60, science: 0 },
    modules: [
      { slot: 's6', type: 'habitat', level: 1 },
      { slot: 's7', type: 'solar', level: 1 },
      { slot: 's10', type: 'battery', level: 1 },
    ],
    colonists: 4,
    unlocked: ['habitat', 'solar', 'battery', 'moxie', 'extractor', 'greenhouse', 'shelter'],
  },
};

// Fictional first names (no real people), diverse origins.
export const COLONIST_NAMES = [
  'Ana', 'Kwame', 'Yuki', 'Priya', 'Mateo', 'Leila', 'Ivan', 'Nia',
  'Rafael', 'Mei', 'Omar', 'Sofia', 'Aiyana', 'Jonas', 'Thandiwe', 'Arjun',
];
