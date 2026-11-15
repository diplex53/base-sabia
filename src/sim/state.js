// Initial state (Apêndice A.3 + B). Plain JSON data only.
import { TAU_CLEAR, TRANSIT_DOSE_MSV } from '../data/constants.js';
import { TIME, SLOTS, START, SHIP, COLONIST_NAMES, MODULES, DIFFICULTY, PROFESSIONS, oldSlotToNew } from '../data/balance.js';
import { seedToUint32, random } from './rng.js';
import { CHAPTERS, STORY_FEATURES } from '../data/story.js';
import { CRAFT_START_INV, CRAFT_START_MODULES } from '../data/crafting.js';

export const STATE_VERSION = 4;

/** A fresh module record. `spent` = everything paid for it (for the 50% demolish refund). */
export function newModule(type, level, status) {
  return {
    type, level, enabled: true, powered: true, status,
    progress: 0, dust: 0, growth: 0, unpoweredSols: 0, staff: [],
    spent: { parts: 0, regolith: 0 },
  };
}

/** Pick a name not used on the base nor in `exclude` (seeded); falls back to any name once all are used. */
export function pickName(state, exclude = []) {
  const used = new Set([...state.colonists.map((c) => c.name), ...exclude]);
  const free = COLONIST_NAMES.filter((n) => !used.has(n));
  const pool = free.length ? free : COLONIST_NAMES;
  return pool[Math.floor(random(state) * pool.length)];
}

/** A new colonist; name and profession may come from a ship manifest (Apêndice B.5). */
export function newColonist(state, { name, profession = null } = {}) {
  const id = `c${state.sim.nextColonistId++}`;
  return { id, name: name || pickName(state), profession, dose: TRANSIT_DOSE_MSV, location: 'habitat', assignedTo: null, status: 'active' };
}

/** Empty events block (Apêndice B.2). `auto: false` stops the random draw (scheduled events still fire). */
export const newEventsState = () => ({ last: { regional: null, global: null, spe: null }, scheduled: [], auto: true });

/** Craft economy bootstrap: free craftTable + drillBasic in the empty slots closest to the start modules, starter items. */
function craftStart(state) {
  const used = state.slots.filter((s) => s.module);
  const dist = (s) => Math.min(...used.map((u) => Math.abs(u.gx - s.gx) + Math.abs(u.gz - s.gz)));
  const free = state.slots.filter((s) => !s.module).sort((a, b) => dist(a) - dist(b));
  CRAFT_START_MODULES.forEach((type, i) => { if (free[i]) free[i].module = newModule(type, 1, 'ok'); });
  state.inv = { ...CRAFT_START_INV };
}

export function createInitialState({ mode = 'colony', chapter = 0, seed, difficulty = 'commander', economy = 'parts' } = {}) {
  if (!['colony', 'story'].includes(mode)) throw new Error(`unknown mode '${mode}'`);
  if (mode === 'story' && !CHAPTERS[chapter]) throw new Error(`unknown chapter '${chapter}'`);
  if (!DIFFICULTY[difficulty]) throw new Error(`unknown difficulty '${difficulty}'`);
  const chapterDef = mode === 'story' ? CHAPTERS[chapter] : null;
  const start = chapterDef ? chapterDef.start : START.colony;
  const dif = DIFFICULTY[difficulty];
  const resources = { methane: 0, ...start.resources };
  // Apêndice B.1: startMult on O2, water, food and parts; regolith from the difficulty
  if (!chapterDef) {
    for (const k of ['o2', 'water', 'food', 'parts']) resources[k] = Math.round(resources[k] * dif.startMult);
    resources.regolith = dif.regolithStart;
  }
  const state = {
    version: STATE_VERSION,
    mode, chapter, seed, difficulty,
    rng: seedToUint32(seed),
    t: chapterDef ? chapterDef.startT : TIME.START_T,
    resources,
    rates: { energyGen: 0, energyUse: 0, o2Prod: 0, o2Use: 0, waterProd: 0, waterUse: 0, foodProd: 0, foodUse: 0, science: 0 },
    env: { tau: TAU_CLEAR, sun: 0, storm: null, spe: null, commDelayMin: 0 },
    unlocked: chapterDef ? JSON.parse(JSON.stringify(chapterDef.unlocked)) : { modules: [...start.unlocked], features: [...STORY_FEATURES], techs: null },
    slots: SLOTS.map((s) => ({ id: s.id, gx: s.gx, gz: s.gz, module: null })),
    colonists: [],
    expeditions: [],
    ship: { nextArrivalT: start.shipNextArrivalT || SHIP.intervalSols, manifest: start.shipManifest ? JSON.parse(JSON.stringify(start.shipManifest)) : null, awaitingDecision: false, offer: null, decideBy: null },
    tech: { unlocked: [...(start.tech || [])] },
    sheltering: false,
    events: newEventsState(),
    timers: { o2Out: 0, waterOut: 0, foodOut: 0, blackout: 0 },
    story: null,
    realSun: null,
    stats: { popPeak: 0, panelsSeen: [], selfSufficientAt: null, domeAt: null },
    health: 100, // Apêndice E.3
    inv: {}, // crafting: ores, items and kits (missing key = 0)
    over: null,
    // Core bookkeeping (not part of the UI contract): step remainder, id counters,
    // which alerts are currently raised, when each module was shed, milestone streak.
    sim: { acc: 0, nextColonistId: 1, nextExpeditionId: 1, alerts: {}, shedAt: {}, shipsArrived: 0, milestone: { streak: 0, o2: 0, water: 0, food: 0 } },
  };
  for (const m of start.modules) {
    const slot = state.slots.find((s) => s.id === m.slot);
    const mod = newModule(m.type, m.level, 'ok');
    mod.dust = m.dust || 0;
    mod.growth = m.growth || 0;
    for (let l = 0; l < m.level; l++) {
      const c = MODULES[m.type].levels[l].cost;
      mod.spent.parts += c.parts || 0;
      mod.spent.regolith += c.regolith || 0;
    }
    slot.module = mod;
  }
  // Apêndice B.4: the starting crew has one of each profession
  if (chapterDef) {
    for (const c of start.colonists) state.colonists.push({ ...newColonist(state, c), dose: c.dose });
    state.events.auto = false;
    state.events.scheduled = JSON.parse(JSON.stringify(chapterDef.scheduled));
    state.story = { chapter, stepIdx: 0, complete: false, stepStartedAt: state.t,
      steps: chapterDef.steps.map(s => ({ id: s.id, done: false })),
      facts: { cleaned: false, ended: [], expeditions: [], landed: 0, sheltered: [], recalled: [] } };
  } else for (let i = 0; i < start.colonists; i++) state.colonists.push(newColonist(state, { profession: PROFESSIONS[i % PROFESSIONS.length] }));
  state.stats.popPeak = state.colonists.length;
  state.economy = !chapterDef && economy === 'craft' ? 'craft' : 'parts'; // story mode is always 'parts'
  if (state.economy === 'craft') craftStart(state);
  return state;
}

/**
 * Apêndice E.1: a save with the old 4x4 map (16 slots) gets the 36-slot map; each module keeps its old
 * cell shifted by (+1, +1). Slot ids stored elsewhere (assignments, shed times, scheduled events) follow.
 */
function migrateSlots(state) {
  if (!Array.isArray(state.slots) || state.slots.length >= SLOTS.length) return;
  // 36-slot save (6x6 map): ids and cells stay, the 36 new empty slots are appended (s37..s72)
  if (state.slots.length > 16) {
    const have = new Set(state.slots.map((s) => s.id));
    for (const s of SLOTS) if (!have.has(s.id)) state.slots.push({ id: s.id, gx: s.gx, gz: s.gz, module: null });
    return;
  }
  const byId = new Map(state.slots.map((s) => [s.id, s]));
  const fresh = SLOTS.map((s) => ({ id: s.id, gx: s.gx, gz: s.gz, module: null }));
  for (const [oldId, old] of byId) {
    if (!old.module) continue;
    const target = fresh.find((s) => s.gx === old.gx + 1 && s.gz === old.gz + 1) || fresh.find((s) => s.id === oldSlotToNew(oldId));
    if (target) target.module = old.module;
  }
  state.slots = fresh;
  for (const c of state.colonists || []) if (c.assignedTo) c.assignedTo = oldSlotToNew(c.assignedTo);
  if (state.sim && state.sim.shedAt) {
    const shed = {};
    for (const [k, v] of Object.entries(state.sim.shedAt)) shed[oldSlotToNew(k)] = v;
    state.sim.shedAt = shed;
  }
  for (const e of state.events?.scheduled || []) if (e.params && e.params.slotId) e.params.slotId = oldSlotToNew(e.params.slotId);
}

/** Fill fields added after version 1 so older saves keep loading. Mutates and returns the state. */
export function migrateState(state) {
  migrateSlots(state);
  if (!state.difficulty) state.difficulty = 'commander';
  if (state.resources.methane === undefined) state.resources.methane = 0;
  if (state.health === undefined) state.health = 100;
  if (!state.inv || typeof state.inv !== 'object') state.inv = {};
  if (!state.economy) state.economy = 'parts';
  if (state.mode !== 'story' && state.tech && state.tech.unlocked.includes('robotics') && !state.unlocked.modules.includes('drillAdvanced')) state.unlocked.modules.push('drillAdvanced');
  if (state.stats.domeAt === undefined) state.stats.domeAt = null;
  // E.4: colony saves from before the expansion get the modules that need no tech
  if (state.mode !== 'story') for (const t of START.colony.unlocked) if (!state.unlocked.modules.includes(t)) state.unlocked.modules.push(t);
  if (state.realSun === undefined) state.realSun = null;
  if (!state.unlocked.features) state.unlocked.features = [...STORY_FEATURES];
  if (state.unlocked.techs === undefined) state.unlocked.techs = null;
  if (!state.events) state.events = newEventsState();
  if (state.events.auto === undefined) state.events.auto = true;
  const sh = state.ship;
  if (sh.offer === undefined) sh.offer = null;
  if (sh.decideBy === undefined) sh.decideBy = null;
  if (state.stats.selfSufficientAt === undefined) state.stats.selfSufficientAt = null;
  const sim = state.sim;
  if (!sim.nextExpeditionId) sim.nextExpeditionId = 1;
  if (!sim.milestone) sim.milestone = { streak: 0, o2: 0, water: 0, food: 0 };
  state.version = STATE_VERSION;
  return state;
}
