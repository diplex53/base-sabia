// Construction (Apêndice A.3/A.4): build, upgrade, demolish, toggle, clean, and build progress.
// Cost is paid up front (parts x0.7 with regolithPrinting, B.6). Demolish refunds 50% (rounded down)
// of everything spent on the module. Construction does not advance while everyone is sheltering (B.3).
import { MODULES, HEALTH } from '../data/balance.js';
import { newModule } from './state.js';
import { isBuilt, levelSpec, peopleCapacity, headcount, batteryCapacity, effectiveCost, hasTech, healthLow } from './model.js';
import { clearStaff } from './colonists.js';
import { showPanel } from './alerts.js';

export const findSlot = (state, slotId) => state.slots.find((s) => s.id === slotId);

/** Affordability of a cost object; returns an error key or null. */
export function checkCost(state, cost) {
  if ((cost.parts || 0) > state.resources.parts) return 'err.notEnoughParts';
  if ((cost.regolith || 0) > state.resources.regolith) return 'err.notEnoughRegolith';
  return null;
}

/** Effective cost of building (level 1) or upgrading to `level` (1-based). */
export const levelCost = (state, type, level) => effectiveCost(state, MODULES[type].levels[level - 1].cost);

function pay(state, mod, cost) {
  state.resources.parts -= cost.parts || 0;
  state.resources.regolith -= cost.regolith || 0;
  mod.spent.parts += cost.parts || 0;
  mod.spent.regolith += cost.regolith || 0;
}

/** Why a module type cannot be built in a slot (error key) or null. Shared with selectors.buildOptions. */
export function checkBuild(state, slotId, type) {
  const sl = findSlot(state, slotId);
  if (!sl) return 'err.noSuchSlot';
  if (sl.module) return 'err.slotOccupied';
  const def = MODULES[type];
  if (!def) return 'err.unknownModule';
  if (!state.unlocked.modules.includes(type)) return 'err.locked';
  if (def.requiresTech && !hasTech(state, def.requiresTech)) return 'err.locked';
  if (def.requiresBuilt && !state.slots.some((s) => s.module && s.module.type === def.requiresBuilt && isBuilt(s.module))) return 'err.locked';
  if (def.unique && state.slots.some((s) => s.module && s.module.type === type)) return 'err.unique';
  return checkCost(state, levelCost(state, type, 1));
}

/** Why a slot's module cannot be upgraded (error key) or null. */
export function checkUpgrade(state, slotId) {
  const sl = findSlot(state, slotId);
  if (!sl) return 'err.noSuchSlot';
  const m = sl.module;
  if (!m) return 'err.slotEmpty';
  if (m.level >= MODULES[m.type].levels.length) return 'err.maxLevel';
  if (m.status !== 'ok') return 'err.busy';
  const next = MODULES[m.type].levels[m.level];
  if (next.requiresTech && !hasTech(state, next.requiresTech)) return 'err.locked';
  return checkCost(state, levelCost(state, m.type, m.level + 1));
}

export function actBuild(state, { slotId, moduleType }) {
  const err = checkBuild(state, slotId, moduleType);
  if (err) return err;
  const sl = findSlot(state, slotId);
  const mod = newModule(moduleType, 1, 'building');
  pay(state, mod, levelCost(state, moduleType, 1));
  sl.module = mod;
  return null;
}

export function actUpgrade(state, { slotId }) {
  const err = checkUpgrade(state, slotId);
  if (err) return err;
  const m = findSlot(state, slotId).module;
  pay(state, m, levelCost(state, m.type, m.level + 1));
  m.status = 'upgrading';
  m.progress = 0;
  return null;
}

export function actDemolish(state, { slotId }) {
  const sl = findSlot(state, slotId);
  if (!sl) return 'err.noSuchSlot';
  const m = sl.module;
  if (!m) return 'err.slotEmpty';
  if (m.type === 'habitat' && isBuilt(m)) {
    const after = peopleCapacity(state, 'habitat') - levelSpec(m).capacity;
    if (after < headcount(state)) return 'err.busy';
  }
  clearStaff(state, sl);
  state.resources.parts += Math.floor(m.spent.parts * 0.5);
  state.resources.regolith += Math.floor(m.spent.regolith * 0.5);
  sl.module = null;
  delete state.sim.shedAt[sl.id];
  state.resources.energy = Math.min(state.resources.energy, batteryCapacity(state));
  return null;
}

export function actToggle(state, { slotId, enabled }) {
  const sl = findSlot(state, slotId);
  if (!sl) return 'err.noSuchSlot';
  const m = sl.module;
  if (!m) return 'err.slotEmpty';
  const want = typeof enabled === 'boolean' ? enabled : !m.enabled;
  // The habitat cannot be switched off; a battery has nothing to switch (it only stores).
  if (!want && (m.type === 'habitat' || m.type === 'battery')) return 'err.cannotDisable';
  if (m.enabled === want) return null;
  m.enabled = want;
  if (!want) { m.powered = true; delete state.sim.shedAt[sl.id]; } // off by choice, not shed
  return null;
}

export function actClean(state, { slotId }) {
  const sl = findSlot(state, slotId);
  if (!sl) return 'err.noSuchSlot';
  const m = sl.module;
  if (!m) return 'err.slotEmpty';
  if (m.type !== 'solar') return 'err.notSolar';
  if (m.status !== 'ok') return 'err.busy';
  m.status = 'cleaning';
  m.progress = 0;
  return null;
}

/** Advance 'building' and 'upgrading' modules; emit build.done on completion. Paused while sheltering (B.3). */
export function stepConstruction(state, dt, emit) {
  if (state.sheltering) return;
  const speed = healthLow(state) ? HEALTH.slowBuild : 1; // E.3: 25% slower below 50 health
  for (const sl of state.slots) {
    const m = sl.module;
    if (!m || (m.status !== 'building' && m.status !== 'upgrading')) continue;
    const target = m.status === 'building' ? m.level : m.level + 1;
    m.progress += dt * speed / MODULES[m.type].levels[target - 1].buildSols;
    if (m.progress < 1 - 1e-9) continue;
    const wasBuilding = m.status === 'building';
    m.level = target;
    m.status = 'ok';
    m.progress = 0;
    emit({ type: 'build.done', slotId: sl.id, moduleType: m.type, level: m.level });
    if (wasBuilding && m.type === 'moxie') showPanel(state, emit, 'moxieEnergy');
    if (wasBuilding && m.type === 'dome' && !state.stats.domeAt) { // E.2 megaproject
      state.stats.domeAt = state.t;
      emit({ type: 'milestone', id: 'dome' });
    }
  }
}
