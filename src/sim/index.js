// Base Sabiá simulation core: public API (Apêndice A.4 + B).
//   createGame({ mode, chapter, seed, difficulty }) -> game
//   game.state, game.tick(dtSols), game.dispatch(action), game.drainEvents(), game.serialize()
//   loadGame(string) -> game
// Pure JS: no DOM, no Node APIs. All randomness goes through state.rng (rng.js).
import { TIME, GRACE, SCIENCE_PER_COLONIST_SOL } from '../data/balance.js';
import { createInitialState, migrateState } from './state.js';
import { stepEnvironment } from './environment.js';
import { stepEvents, drawEvents } from './events.js';
import { stepShelter, actSetShelter, placeColonists } from './shelter.js';
import { stepConstruction, actBuild, actUpgrade, actDemolish, actToggle, actClean } from './build.js';
import { stepRepairs, actRepair } from './repair.js';
import { stepEnergy } from './energy.js';
import { stepLife } from './life.js';
import { stepHealth } from './health.js';
import { stepDust } from './dust.js';
import { stepRadiation } from './radiation.js';
import { stepExpeditions, actStartExpedition, actRecallExpedition } from './expeditions.js';
import { actResearch } from './tech.js';
import { stepShips, actShipDecision } from './ships.js';
import { stepMilestone, closeMilestoneSol } from './milestone.js';
import { stepAlerts, showPanel } from './alerts.js';
import { actAssign } from './colonists.js';
import {
  solIndex, habitatPowered, activeCount, rawModuleRates, headcount, crewUse, genRate, isActive, isConsumerType,
  nominalUse, difficultyOf, storageCap,
} from './model.js';
import { score, getSol } from './selectors.js';
import { checkStoryAction, recordStoryEvent, recordStoryRecall, stepStory } from './story.js';
import { configureRealSun } from './realSun.js';
import { stepDrills, actCraft } from './crafting.js';

export * as selectors from './selectors.js';

const ACTIONS = {
  build: actBuild,
  upgrade: actUpgrade,
  demolish: actDemolish,
  toggle: actToggle,
  assign: actAssign,
  clean: actClean,
  repair: actRepair,
  setShelter: actSetShelter,
  research: actResearch,
  startExpedition: actStartExpedition,
  recallExpedition: actRecallExpedition,
  shipDecision: actShipDecision,
  craft: actCraft,
  // player choice: burn stored methane for power (default) or keep it for crafting
  setMethaneBurn: (state, { on }) => { state.methaneBurn = !!on; return null; },
};

/** Science (DESIGN 5.6): SCIENCE_PER_COLONIST_SOL per active colonist per sol (events and expeditions add theirs). */
function stepScience(state, dt) {
  const rate = SCIENCE_PER_COLONIST_SOL * activeCount(state);
  state.resources.science += rate * dt;
  state.rates.science = rate;
}

/** Grace timers and game over (DESIGN 11). Tolerances x DIFFICULTY.graceMult (B.1). */
function stepTimers(state, dt, emit) {
  const r = state.resources, tm = state.timers;
  const g = difficultyOf(state).graceMult;
  tm.o2Out = r.o2 > 0 ? 0 : tm.o2Out + dt;
  tm.waterOut = r.water > 0 ? 0 : tm.waterOut + dt;
  tm.foodOut = r.food > 0 ? 0 : tm.foodOut + dt;
  tm.blackout = habitatPowered(state) ? 0 : tm.blackout + dt;

  let reason = null;
  if (activeCount(state) === 0) reason = 'noCrew';
  else if (tm.o2Out >= GRACE.o2 * g - 1e-9) reason = 'o2';
  else if (tm.blackout >= GRACE.blackout * g - 1e-9) reason = 'blackout';
  else if (tm.waterOut >= GRACE.water * g - 1e-9) reason = 'water';
  else if (tm.foodOut >= GRACE.food * g - 1e-9) reason = 'food';
  else if (state.health !== undefined && state.health <= 0) reason = 'health'; // E.3: mission aborted
  if (!reason) return;
  showPanel(state, emit, `over.${reason}`);
  state.over = { reason, score: score(state) };
  emit({ type: 'game.over', reason, score: state.over.score });
}

const CAPPED = ['o2', 'water', 'food'];
/**
 * Storage caps (Apêndice E.2): whatever came in this step above the cap is lost. A stock that was already above
 * the cap (an old save, a warehouse switched off) is not cut, it just cannot grow until it is back under.
 */
function applyStorage(state, before) {
  const r = state.resources;
  for (const k of CAPPED) {
    const cap = storageCap(state, k);
    if (r[k] > cap) r[k] = Math.max(cap, Math.min(r[k], before[k]));
  }
}

/** One fixed step of TIME.STEP sols. Order matters. */
function step(state, emit) {
  const dt = TIME.STEP;
  const before = { o2: state.resources.o2, water: state.resources.water, food: state.resources.food };
  stepEnvironment(state, dt, emit); // sun, comm delay, conjunction
  stepEvents(state, dt, emit);      // schedule, storm tau ramp, SPE phases (B.2)
  stepShelter(state);               // who is in the shelter (B.3)
  stepConstruction(state, dt, emit);
  stepRepairs(state, dt, emit);     // B.2
  stepEnergy(state, dt, emit);
  stepLife(state, dt, emit);
  stepDrills(state, dt, emit);      // crafting: drill output
  stepHealth(state, dt, emit);      // E.3
  stepMilestone(state, dt);         // B.8
  stepDust(state, dt, emit);
  stepRadiation(state, dt, emit);   // GCR + SPE (5.5)
  stepExpeditions(state, dt, emit); // B.7
  stepScience(state, dt);

  const solBefore = solIndex(state.t);
  state.t += dt;
  if (solIndex(state.t) > solBefore) {
    emit({ type: 'sol.start', sol: getSol(state) });
    closeMilestoneSol(state, emit);
    drawEvents(state, emit);        // the draw at the start of each sol (DESIGN 10)
  }
  stepShips(state, emit);
  applyStorage(state, before);

  stepTimers(state, dt, emit);
  stepStory(state, emit);
  if (!state.over) stepAlerts(state, emit);
}

/** Fill state.rates from the current state without advancing time (used at creation/load). */
function refreshRates(state) {
  const crew = crewUse(state, headcount(state));
  const rt = state.rates;
  let gen = 0, use = 0, o2 = 0, water = 0, gh = 0, food = 0;
  for (const sl of state.slots) {
    const m = sl.module;
    if (!m) continue;
    gen += genRate(state, m, Math.PI * state.env.sun);
    if (isConsumerType(m.type) && isActive(state, m)) use += nominalUse(m, state);
    const r = rawModuleRates(state, m);
    o2 += r.o2; food += r.food;
    if (r.water >= 0) water += r.water; else gh -= r.water;
  }
  Object.assign(rt, {
    energyGen: gen, energyUse: use, o2Prod: o2, o2Use: crew.o2, waterProd: water, waterUse: crew.water + gh,
    foodProd: food, foodUse: crew.food, science: SCIENCE_PER_COLONIST_SOL * activeCount(state),
  });
}

function makeGame(state, initialEvents = []) {
  let events = initialEvents;
  const emit = (e) => { recordStoryEvent(state, e); events.push({ ...e, t: state.t }); };
  const game = {
    state,
    tick(dtSols) {
      if (state.over || state.story?.complete || !(dtSols > 0) || !Number.isFinite(dtSols)) return;
      state.sim.acc += dtSols;
      while (state.sim.acc >= TIME.STEP - 1e-12) {
        state.sim.acc -= TIME.STEP;
        step(state, emit);
        if (state.over || state.story?.complete) { state.sim.acc = 0; break; }
      }
      if (state.sim.acc < 0) state.sim.acc = 0;
    },
    dispatch(action) {
      if (state.over || state.story?.complete) return { ok: false, reason: 'err.gameOver' };
      const fn = action && Object.prototype.hasOwnProperty.call(ACTIONS, action.type) && ACTIONS[action.type];
      if (!fn) return { ok: false, reason: 'err.unknownAction' };
      const locked = checkStoryAction(state, action);
      if (locked) return { ok: false, reason: locked };
      const recalled = action.type === 'recallExpedition' ? state.expeditions.find(e => e.id === action.id) : null;
      const reason = fn(state, action, emit);
      if (reason) return { ok: false, reason };
      if (recalled) recordStoryRecall(state, recalled);
      placeColonists(state);
      refreshRatesKeepEnergy(state);
      stepStory(state, emit);
      return { ok: true };
    },
    drainEvents() {
      const out = events;
      events = [];
      return out;
    },
    serialize() {
      return JSON.stringify(state);
    },
  };
  return game;
}

/** After an action, update life rates for the HUD; energy rates are left to the next bus step. */
function refreshRatesKeepEnergy(state) {
  const { energyGen, energyUse } = state.rates;
  refreshRates(state);
  state.rates.energyGen = energyGen;
  state.rates.energyUse = energyUse;
}

export function createGame({ mode = 'colony', chapter = 0, seed = Date.now(), difficulty = 'commander', economy = 'parts', liveFlares, windowStart, liveWindowStart } = {}) {
  const state = createInitialState({ mode, chapter, seed, difficulty, economy });
  configureRealSun(state, liveFlares, windowStart ?? liveWindowStart); // Apêndice D.1
  stepEnvironment(state, 0);
  refreshRates(state);
  const initial = [{ type: 'sol.start', sol: getSol(state), t: state.t }];
  if (state.story) initial.push({ type: 'story.step', id: state.story.steps[0].id, t: state.t });
  return makeGame(state, initial);
}

export function loadGame(str) {
  const state = typeof str === 'string' ? JSON.parse(str) : JSON.parse(JSON.stringify(str));
  return makeGame(migrateState(state));
}
