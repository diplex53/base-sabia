// Crafting (team list): drills produce ores, the production table and the module builder turn them into
// items and structure kits. Inventory lives in state.inv (missing key = 0); regolith, water and methane
// stay in state.resources.
import { RECIPES, DRILLS, DRILL_CYCLE_SOLS, RESOURCE_ORES } from '../data/crafting.js';
import { isActive } from './model.js';

export const invGet = (state, k) => (RESOURCE_ORES[k] ? state.resources[RESOURCE_ORES[k]] || 0 : (state.inv && state.inv[k]) || 0);

export function invAdd(state, k, n) {
  if (!n) return;
  if (RESOURCE_ORES[k]) { state.resources[RESOURCE_ORES[k]] = (state.resources[RESOURCE_ORES[k]] || 0) + n; return; }
  if (!state.inv) state.inv = {};
  const v = (state.inv[k] || 0) + n;
  if (v > 1e-9) state.inv[k] = v; else delete state.inv[k];
}

export const recipeById = (id) => RECIPES.find((r) => r.id === id) || null;

const hasActive = (state, type) => state.slots.some((s) => s.module && s.module.type === type && isActive(state, s.module));

/** Can this station craft right now? Error key or null. */
export function stationError(state, station) {
  if (station === 'builder') return hasActive(state, 'moduleBuilder') ? null : 'err.noModuleBuilder';
  return hasActive(state, 'craftTable') ? null : 'err.noCraftTable';
}

/** Why `times` crafts of a recipe cannot be done now (error key) or null. */
export function checkCraft(state, recipeId, times = 1) {
  const r = recipeById(recipeId);
  if (!r) return 'err.unknownRecipe';
  if (!(times >= 1) || !Number.isInteger(times)) return 'err.unknownRecipe';
  const st = stationError(state, r.station);
  if (st) return st;
  for (const [k, n] of Object.entries(r.in)) if (invGet(state, k) < n * times - 1e-9) return 'err.missingIngredients';
  return null;
}

/** Action { type: 'craft', recipeId, times? }: instant. */
export function actCraft(state, { recipeId, times = 1 }, emit) {
  const err = checkCraft(state, recipeId, times);
  if (err) return err;
  const r = recipeById(recipeId);
  for (const [k, n] of Object.entries(r.in)) invAdd(state, k, -n * times);
  for (const [k, n] of Object.entries(r.out)) invAdd(state, k, n * times);
  return null;
}

/** Each active drill fills its progress and, every DRILL_CYCLE_SOLS, adds its outputs. */
export function stepDrills(state, dt, emit) {
  for (const sl of state.slots) {
    const m = sl.module;
    if (!m || !DRILLS[m.type] || !isActive(state, m)) continue;
    m.drill = (m.drill || 0) + dt / DRILL_CYCLE_SOLS;
    while (m.drill >= 1 - 1e-9) {
      m.drill -= 1;
      for (const [k, n] of Object.entries(DRILLS[m.type])) invAdd(state, k, n);
    }
  }
}

// ---------- craft economy helpers (state.economy === 'craft'); with 'parts' they act on resources.parts ----------
export const isCraftEconomy = (state) => state.economy === 'craft';

/** Has `n` parts to spend (craft economy: n iron bars). */
export const hasParts = (state, n) => (isCraftEconomy(state) ? invGet(state, 'ironBar') : state.resources.parts) >= (n || 0) - 1e-9;

/** Spend `n` parts (craft economy: n iron bars). The caller checks hasParts first. */
export function payParts(state, n) {
  if (!n) return;
  if (isCraftEconomy(state)) invAdd(state, 'ironBar', -n);
  else state.resources.parts -= n;
}

/** Give `n` parts (craft economy: n iron + n copper + n silicon). */
export function grantParts(state, n) {
  if (!n) return;
  if (!isCraftEconomy(state)) { state.resources.parts += n; return; }
  for (const k of ['iron', 'copper', 'silicon']) invAdd(state, k, n);
}

/** Has every item of a cost object (inv or mapped resources). */
export const hasItems = (state, items) => Object.entries(items).every(([k, n]) => invGet(state, k) >= n - 1e-9);
export function payItems(state, items) { for (const [k, n] of Object.entries(items)) invAdd(state, k, -n); }

/** Kit for a module type in the inventory. */
export const hasKit = (state, type) => ((state.inv && state.inv['kit.' + type]) || 0) >= 1;
