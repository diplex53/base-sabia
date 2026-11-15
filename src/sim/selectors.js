// Pure selectors (Apêndice A.4). They never mutate state. They may RETURN Infinity.
import { SOL_HOURS } from '../data/constants.js';
import { MODULES, SCORE } from '../data/balance.js';
import {
  solIndex, rawModuleRates, genRate, isOperating, isConsumerType, nominalUse, batteryCapacity,
  peopleCapacity, crewUse, headcount as headcountOf, activeCount, storageCap, isBuilt,
} from './model.js';
import { checkBuild, checkUpgrade, findSlot, levelCost } from './build.js';

// Phase 3 selectors (Apêndice B.6 / B.7), implemented next to their systems.
export { techOptions } from './tech.js';
export { expeditionOptions, roversFree } from './expeditions.js';
export { speWarningSols } from './events.js';

/** Story progress (Apêndice C) or null in colony mode. */
export function storyInfo(state) {
  const st = state.story;
  if (!st) return null;
  const cur = st.steps[st.stepIdx];
  return {
    chapter: st.chapter, stepIdx: st.stepIdx, total: st.steps.length,
    current: cur ? { id: cur.id } : null, steps: st.steps.map((s) => ({ id: s.id, done: s.done })), complete: st.complete,
  };
}

/** Displayed sol = floor(t) + 1. */
export const getSol = (state) => solIndex(state.t) + 1;

/** Martian hour of the current sol, 0..SOL_HOURS. */
export const getHour = (state) => (state.t - solIndex(state.t)) * SOL_HOURS;

/** Active colonists (working). */
export const population = (state) => activeCount(state);

/** Everyone present on the base (active + retired). */
export const headcount = (state) => headcountOf(state);

/** Capacities (A.4 + E.5): battery kWh, crew and shelter places, O2 / water / food storage (kg). */
export function capacity(state) {
  return {
    energy: batteryCapacity(state), crew: peopleCapacity(state, 'habitat'), shelter: peopleCapacity(state, 'shelter'),
    o2: storageCap(state, 'o2'), water: storageCap(state, 'water'), food: storageCap(state, 'food'),
  };
}

/** City overview (Apêndice E.5). domeProgress: null with no dome, 0..1 while building, 1 when done. */
export function cityStats(state) {
  const r = state.resources;
  const net = netPerSol(state);
  let modules = 0, dome = null;
  for (const sl of state.slots) {
    if (!sl.module) continue;
    modules++;
    if (sl.module.type === 'dome') dome = sl.module;
  }
  const store = (k) => ({ amount: r[k], cap: storageCap(state, k) });
  return {
    population: activeCount(state), crewCapacity: peopleCapacity(state, 'habitat'), health: state.health ?? 100,
    powerGen: net.energy + energyUseAvg(state), powerUse: energyUseAvg(state),
    storage: { o2: store('o2'), water: store('water'), food: store('food') },
    modules, techs: state.tech.unlocked.length,
    domeProgress: dome ? (isBuilt(dome) ? 1 : dome.progress) : null,
  };
}

/** Sol-average load of the operating consumers (the "use" side of netPerSol). */
function energyUseAvg(state) {
  let use = 0;
  for (const sl of state.slots) {
    const m = sl.module;
    if (m && m.type !== 'sabatier' && isConsumerType(m.type) && isOperating(state, m)) use += nominalUse(m, state);
  }
  return use;
}

/** Per-sol rates of one module right now: { gen, use, o2, water, food, active }. */
export function moduleRates(state, slotId) {
  const sl = findSlot(state, slotId);
  return rawModuleRates(state, sl ? sl.module : null);
}

/**
 * Mean balance per sol. Energy: sol-average generation with the current tau and dust
 * (the integral of pi*sun over a sol is 1) minus the load of every operating consumer
 * (shed ones included: that is what the base needs). O2, water, food: current rates.
 */
export function netPerSol(state) {
  let gen = 0, use = 0, o2 = 0, water = 0, food = 0;
  for (const sl of state.slots) {
    const m = sl.module;
    if (!m) continue;
    // a sabatier only moves energy between day and night (E.2): left out of the sol average
    if (m.type !== 'sabatier') {
      gen += genRate(state, m, 1);
      if (isConsumerType(m.type) && isOperating(state, m)) use += nominalUse(m, state);
    }
    const r = rawModuleRates(state, m);
    o2 += r.o2; water += r.water; food += r.food;
  }
  const crew = crewUse(state, headcountOf(state));
  return { energy: gen - use, o2: o2 - crew.o2, water: water - crew.water, food: food - crew.food };
}

/** Sols until each stock hits zero at the current mean rate; Infinity if the balance is >= 0. */
export function autonomy(state) {
  const net = netPerSol(state);
  const r = state.resources;
  const aut = (stock, n) => (n >= 0 ? Infinity : Math.max(0, stock) / -n);
  return { energy: aut(r.energy, net.energy), o2: aut(r.o2, net.o2), water: aut(r.water, net.water), food: aut(r.food, net.food) };
}

/** Every module type with its level-1 cost and whether it can be built in this slot. */
export function buildOptions(state, slotId) {
  if (!findSlot(state, slotId)) return [];
  return Object.keys(MODULES).map((type) => {
    const l1 = MODULES[type].levels[0];
    const reason = checkBuild(state, slotId, type);
    return { type, cost: levelCost(state, type, 1), buildSols: l1.buildSols, ok: !reason, reason };
  });
}

/** Next-level upgrade info, or null when the slot is empty or already at max level. */
export function upgradeInfo(state, slotId) {
  const sl = findSlot(state, slotId);
  if (!sl || !sl.module) return null;
  const m = sl.module;
  const levels = MODULES[m.type].levels;
  if (m.level >= levels.length) return null;
  const next = levels[m.level];
  const reason = checkUpgrade(state, slotId);
  return { nextLevel: m.level + 1, cost: levelCost(state, m.type, m.level + 1), buildSols: next.buildSols, ok: !reason, reason };
}

/** score = 10 sols + 100 popPeak + 150 techs + 20 panels seen (DESIGN 5.6) + 1000 once self-sufficient (B.8) + 2000 with the dome (E.2). */
export function score(state) {
  return SCORE.perSol * solIndex(state.t)
    + SCORE.perPopPeak * state.stats.popPeak
    + SCORE.perTech * state.tech.unlocked.length
    + SCORE.perPanel * state.stats.panelsSeen.length
    + (state.stats.selfSufficientAt !== null && state.stats.selfSufficientAt !== undefined ? SCORE.selfSufficient : 0)
    + (state.stats.domeAt !== null && state.stats.domeAt !== undefined ? SCORE.dome : 0); // E.2
}
