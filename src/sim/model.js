// Shared pure helpers: module specs, operating rules and per-module rates.
// Used by the step systems, the selectors and the ship sustain check.
import {
  SOLAR_YIELD_CLEAR_KWH_M2_SOL, K_TAU, TAU_CLEAR, SOL_HOURS, MOXIE_KWH_PER_KG, EXTRACTOR_KWH_PER_KG,
  GH_KWH_PER_M2_SOL, GH_WATER_KG_M2_SOL, CROP_YIELD_KG_M2_SOL, O2_PER_CREW_SOL, WATER_GROSS_PER_CREW_SOL,
  FOOD_PER_CREW_SOL, WATER_RECYCLE_BASE, WATER_RECYCLE_TECH, SHIELD_GCR, CROP_M2_PER_PERSON_O2,
} from '../data/constants.js';
import {
  MODULES, STAFF_BONUS, PROFESSION_BONUS, PROFESSION_MODULES, DIFFICULTY, STORAGE, METHANE_KWH_PER_KG, SABATIER_BURN_BELOW, HEALTH,
} from '../data/balance.js';
import { TECH_EFFECTS } from '../data/tech.js';

const EPS = 1e-9;

/** Sol index (0-based) of a time, robust to float accumulation. */
export const solIndex = (t) => Math.floor(t + EPS);

/** Difficulty settings of a game (Apêndice B.1); old saves without the field play as 'commander'. */
export const difficultyOf = (state) => DIFFICULTY[state.difficulty] || DIFFICULTY.commander;

/** True once the tech is researched (Apêndice B.6). */
export const hasTech = (state, id) => state.tech.unlocked.includes(id);

/** Spec of the module's CURRENT level (an upgrading module still works at its current level). */
export const levelSpec = (mod) => MODULES[mod.type].levels[mod.level - 1];

/** Built = finished at least level 1 (upgrading, cleaning, broken and repairing count as built). */
export const isBuilt = (mod) => !!mod && mod.status !== 'building';

/** Broken or being repaired: the module does nothing (Apêndice B.2). */
export const isDown = (mod) => mod.status === 'broken' || mod.status === 'repairing';

const OLD_CONSUMERS = ['habitat', 'moxie', 'extractor', 'greenhouse'];
/** Consumers sit on the energy bus (can be shed). Expansion modules are consumers when their spec has `use` (E.2). */
export const isConsumerType = (type) => OLD_CONSUMERS.includes(type) || (MODULES[type] && MODULES[type].levels[0].use !== undefined);

/** Sum of a level field over the active modules of a type (E.2 passive and support modules). */
export function levelSum(state, type, field) {
  let s = 0;
  for (const sl of state.slots) {
    const m = sl.module;
    if (m && m.type === type && isActive(state, m)) s += levelSpec(m)[field] || 0;
  }
  return s;
}
/** E.2 effect sizes, capped at the level-3 value of one module. */
export const thermalCut = (state) => Math.min(0.45, levelSum(state, 'thermal', 'habitatUseCut'));
export const filterBoost = (state) => Math.min(0.6, levelSum(state, 'waterFilter', 'extractorBoost'));
export const deconFailureCut = (state) => Math.min(0.75, levelSum(state, 'decon', 'failureCut'));
export const deconDustCut = (state) => Math.min(0.3, levelSum(state, 'decon', 'dustCut'));

/** Storage cap of a resource (E.2): base x (1 + warehouse levels); methane has its own tank. Infinity for the rest. */
export function storageCap(state, res) {
  if (res === 'methane') return STORAGE.methane;
  if (!(res in STORAGE)) return Infinity;
  return STORAGE[res] * (1 + levelSum(state, 'warehouse', 'storage'));
}

/** Colony health below HEALTH.lowAt (E.3). Old saves without health are healthy. */
export const healthLow = (state) => (state.health ?? 100) < HEALTH.lowAt;

/**
 * Sabatier mode (E.2): 'burn' at night or with the battery below SABATIER_BURN_BELOW (burns stored methane),
 * 'make' otherwise (uses power and water, makes methane), 'off' when not operating.
 */
export function sabatierMode(state, mod) {
  if (!isBuilt(mod) || !mod.enabled || isDown(mod)) return 'off';
  const cap = batteryCapacity(state);
  return state.env.sun <= 0 || state.resources.energy < SABATIER_BURN_BELOW * cap ? 'burn' : 'make';
}

/**
 * Operating = would work if it has power: built, enabled, not broken / repairing.
 * A greenhouse with no water in the tank is not operating (DESIGN 5.4).
 */
export function isOperating(state, mod) {
  if (!isBuilt(mod) || !mod.enabled || isDown(mod)) return false;
  if ((mod.type === 'greenhouse' || mod.type === 'sabatier') && !(state.resources.water > 0)) return false;
  if (mod.type === 'factory' && !(state.resources.regolith > 0)) return false;
  return true;
}

/** Active = operating and (for consumers) powered by the bus. */
export function isActive(state, mod) {
  if (!isOperating(state, mod)) return false;
  return isConsumerType(mod.type) ? mod.powered : true;
}

/** Parts cost after the regolith-printing tech: x0.7 rounded up (Apêndice B.6). Returns a new object. */
export function effectiveCost(state, cost) {
  const out = { ...cost };
  if (out.parts && hasTech(state, 'regolithPrinting')) out.parts = Math.ceil(out.parts * TECH_EFFECTS.printingPartsMult - 1e-9);
  return out;
}

/** A colonist working on base: active, not on an expedition, not in the shelter (Apêndice B.4). */
export const workingOnBase = (c) => c.status === 'active' && (c.location === 'habitat' || c.location === 'module');

/** Some active colonist of this profession is on base and not sheltered. */
export const professionOnBase = (state, prof) => state.colonists.some((c) => c.profession === prof && workingOnBase(c));

/** A physician on base (sheltered counts, expedition does not): ALARA for everyone on base (Apêndice B.4). */
export const medicOnBase = (state) => state.colonists.some((c) => c.profession === 'medic' && c.status === 'active' && c.location !== 'expedition');

/**
 * Staff multiplier (DESIGN 7, Apêndice B.4): 1 + PROFESSION_BONUS when the assigned colonist's profession
 * matches the module, 1 + STAFF_BONUS otherwise; no bonus while everyone is sheltering (B.3).
 */
export function staffMult(state, mod) {
  if (!mod.staff || mod.staff.length === 0 || state.sheltering || healthLow(state)) return 1; // E.3: no bonus below 50 health
  const c = state.colonists.find((x) => x.id === mod.staff[0]);
  const match = c && c.profession && (PROFESSION_MODULES[c.profession] || []).includes(mod.type);
  return 1 + (match ? PROFESSION_BONUS : STAFF_BONUS);
}

/** Dust-opacity factor (DESIGN 5.1): f_tau = min(1, exp(-K_TAU (tau - TAU_CLEAR))). */
export const fTau = (tau) => Math.min(1, Math.exp(-K_TAU * (tau - TAU_CLEAR)));

/**
 * Rated energy use of a consumer at its level (kWh/sol), Apêndice A.2 + E.2. With `state`: habitats get the
 * thermal-insulation cut, and a sabatier only draws power in 'make' mode.
 */
export function nominalUse(mod, state) {
  const s = levelSpec(mod);
  switch (mod.type) {
    case 'habitat': return state ? s.use * (1 - thermalCut(state)) : s.use;
    case 'moxie': return s.o2 * MOXIE_KWH_PER_KG;
    case 'extractor': return s.water * EXTRACTOR_KWH_PER_KG;
    case 'greenhouse': return s.area * GH_KWH_PER_M2_SOL;
    case 'sabatier': return state && sabatierMode(state, mod) !== 'make' ? 0 : s.use;
    default: return s.use || 0;
  }
}

/**
 * Generation rate (kWh/sol) of an operating generator, with "sunFactor" = pi * sun(f)
 * (instantaneous) or 1 (sol average, since the integral of pi*sun over a sol is 1). DESIGN 5.1.
 */
export function genRate(state, mod, sunFactor) {
  if (!isOperating(state, mod)) return 0;
  const s = levelSpec(mod);
  if (mod.type === 'solar') {
    return s.area * SOLAR_YIELD_CLEAR_KWH_M2_SOL * sunFactor * fTau(state.env.tau) * (1 - mod.dust) * staffMult(state, mod);
  }
  if (mod.type === 'reactor') return s.kwe * SOL_HOURS * staffMult(state, mod); // kWe * 24.66 h, immune to dust and night
  // E.2: a burning sabatier turns stored methane into power (instantaneous; selectors.netPerSol leaves it out)
  if (mod.type === 'sabatier') return sabatierMode(state, mod) === 'burn' && state.resources.methane > 0 ? s.burn : 0;
  return 0;
}

/** Water recycling fraction (DESIGN 5.3): 0.93, or 0.98 with the waterRecycling tech. */
export const waterRecycle = (state) => (hasTech(state, 'waterRecycling') ? WATER_RECYCLE_TECH : WATER_RECYCLE_BASE);

/** Food multiplier of the plantHabitat tech (DESIGN 9). */
export const foodTechMult = (state) => (hasTech(state, 'plantHabitat') ? TECH_EFFECTS.plantFoodMult : 1);

/** Bioregenerative O2 of a greenhouse (DESIGN 5.2): area / CROP_M2_PER_PERSON_O2 * O2_PER_CREW_SOL * growth. */
export const bioregenO2 = (state, area, growth) => (hasTech(state, 'bioregen') ? area / CROP_M2_PER_PERSON_O2 * O2_PER_CREW_SOL * growth : 0);

/** Everyone present on the base: active and retired colonists (expedition members are still fed). */
export const headcount = (state) => state.colonists.length;
export const activeCount = (state) => state.colonists.filter((c) => c.status === 'active').length;

/** Crew consumption per sol for n people (DESIGN 5.2-5.4). */
export function crewUse(state, n) {
  return {
    o2: n * O2_PER_CREW_SOL,
    water: n * WATER_GROSS_PER_CREW_SOL * (1 - waterRecycle(state)),
    food: n * FOOD_PER_CREW_SOL,
  };
}

/**
 * Per-module rates right now (per sol). DESIGN 5.1-5.4.
 * water is net for the module (greenhouse irrigation is negative).
 */
export function rawModuleRates(state, mod) {
  const r = { gen: 0, use: 0, o2: 0, water: 0, food: 0, regolith: 0, parts: 0, methane: 0, active: false };
  if (!mod) return r;
  r.active = isActive(state, mod);
  if (!r.active) return r;
  const s = levelSpec(mod);
  const k = staffMult(state, mod);
  r.gen = genRate(state, mod, Math.PI * state.env.sun);
  if (isConsumerType(mod.type)) r.use = nominalUse(mod, state);
  if (mod.type === 'moxie') r.o2 = s.o2 * k;
  if (mod.type === 'extractor') r.water = s.water * k * (1 + filterBoost(state));
  if (mod.type === 'mine') { r.regolith = s.regolith * k; r.parts = s.parts * k; }
  if (mod.type === 'factory') { r.parts = s.parts * k; r.regolith = -2 * r.parts; }
  if (mod.type === 'sabatier') {
    if (sabatierMode(state, mod) === 'make') { r.water = -s.water; r.methane = s.methane * k; }
    else if (r.gen > 0) r.methane = -s.burn / METHANE_KWH_PER_KG;
  }
  if (mod.type === 'greenhouse') {
    r.water = -s.area * GH_WATER_KG_M2_SOL;
    r.food = s.area * CROP_YIELD_KG_M2_SOL * mod.growth * k * foodTechMult(state);
    r.o2 = bioregenO2(state, s.area, mod.growth);
  }
  return r;
}

/** Total battery capacity (kWh) of built batteries at their current level. */
export function batteryCapacity(state) {
  let c = 0;
  for (const sl of state.slots) if (sl.module && sl.module.type === 'battery' && isBuilt(sl.module)) c += levelSpec(sl.module).capacity;
  return c;
}

/** Capacity (people) of built modules of a type (habitat or shelter). */
export function peopleCapacity(state, type) {
  let c = 0;
  for (const sl of state.slots) if (sl.module && sl.module.type === type && isBuilt(sl.module)) c += levelSpec(sl.module).capacity;
  if (type === 'habitat') c += levelSum(state, 'pressurizer', 'crew'); // E.2: +2 places per pressurizer level
  return c;
}

/**
 * Places in usable shelters (Apêndice B.3: shelters with status 'ok'; an 'upgrading' shelter keeps its
 * current level, as every upgrading module does, so it counts too).
 */
export function shelterPlaces(state) {
  let c = 0;
  for (const sl of state.slots) {
    const m = sl.module;
    if (m && m.type === 'shelter' && (m.status === 'ok' || m.status === 'upgrading')) c += levelSpec(m).capacity;
  }
  return c;
}

/** GCR shield factor of the base habitat: factor of the highest-level built habitat (DESIGN 5.5). */
export function habitatShieldGCR(state) {
  let best = 0;
  for (const sl of state.slots) if (sl.module && sl.module.type === 'habitat' && isBuilt(sl.module)) best = Math.max(best, sl.module.level);
  if (best === 0) return SHIELD_GCR.expedition;
  // E.2: a finished dome x0.85, the hydrogen shield x0.7 more
  let k = 1;
  for (const sl of state.slots) {
    const m = sl.module;
    if (m && (m.type === 'dome' || m.type === 'radShield') && isBuilt(m)) k *= levelSpec(m).gcrMult;
  }
  return SHIELD_GCR.habitat[best - 1] * k;
}

/** True when at least one habitat is operating and powered. */
export function habitatPowered(state) {
  return state.slots.some((sl) => sl.module && sl.module.type === 'habitat' && isActive(state, sl.module));
}

/**
 * Nominal (rated) production of built, enabled, working modules at their level, ignoring power state,
 * growth and staff, with the techs. Used by the ship sustain check (DESIGN 7).
 */
export function nominalProduction(state) {
  const p = { o2: 0, water: 0, food: 0, ghWater: 0 };
  for (const sl of state.slots) {
    const m = sl.module;
    if (!isBuilt(m) || !m.enabled || isDown(m)) continue;
    const s = levelSpec(m);
    if (m.type === 'moxie') p.o2 += s.o2;
    if (m.type === 'extractor') p.water += s.water * (1 + filterBoost(state));
    if (m.type === 'greenhouse') {
      p.food += s.area * CROP_YIELD_KG_M2_SOL * foodTechMult(state);
      p.ghWater += s.area * GH_WATER_KG_M2_SOL;
      p.o2 += bioregenO2(state, s.area, 1);
    }
  }
  return p;
}
