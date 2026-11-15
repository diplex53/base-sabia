// Energy bus (DESIGN 5.1). Battery = resources.energy, clamped to total battery capacity.
//   net = sum(gen) - sum(use of operating, powered consumers)
//   battery = clamp(battery + net * dt, 0, capacity)
// If the battery would go below zero, loads are shed in SHED_ORDER (first entry first; within a
// type, later slots first) until it would not. A shed module (powered:false) is restored in reverse
// order (habitat first) only when generation alone covers it, or when the battery holds at least
// RESTORE_BATTERY_FRACTION of capacity and the module has been off for SHED_MIN_OFF_SOLS.
import { SHED_ORDER, RESTORE_BATTERY_FRACTION, SHED_MIN_OFF_SOLS } from '../data/balance.js';
import { isOperating, isConsumerType, nominalUse, genRate, batteryCapacity } from './model.js';
import { showPanel } from './alerts.js';

const shedRank = (type) => SHED_ORDER.indexOf(type);

export function stepEnergy(state, dt, emit) {
  const sunFactor = Math.PI * state.env.sun;
  let gen = 0;
  const consumers = [];
  state.slots.forEach((sl, idx) => {
    const m = sl.module;
    if (!m) return;
    gen += genRate(state, m, sunFactor);
    if (isConsumerType(m.type) && isOperating(state, m)) consumers.push({ sl, m, idx, use: nominalUse(m) });
  });

  const cap = batteryCapacity(state);
  const B = state.resources.energy;
  let load = consumers.reduce((s, c) => s + (c.m.powered ? c.use : 0), 0);
  const fits = (l) => B + (gen - l) * dt >= -1e-12;

  if (!fits(load)) {
    // shed: first type in SHED_ORDER first, later slots first
    const order = consumers.filter((c) => c.m.powered)
      .sort((a, b) => shedRank(a.m.type) - shedRank(b.m.type) || b.idx - a.idx);
    for (const c of order) {
      if (fits(load)) break;
      c.m.powered = false;
      state.sim.shedAt[c.sl.id] = state.t;
      load -= c.use;
      emit({ type: 'module.unpowered', slotId: c.sl.id });
      showPanel(state, emit, 'nightPower');
    }
  } else {
    // restore: habitat first, earlier slots first; stop at the first one that cannot come back
    const order = consumers.filter((c) => !c.m.powered)
      .sort((a, b) => shedRank(b.m.type) - shedRank(a.m.type) || a.idx - b.idx);
    for (const c of order) {
      const next = load + c.use;
      const byGen = gen >= next;
      const offFor = state.t - (state.sim.shedAt[c.sl.id] ?? -Infinity);
      const byBattery = B >= RESTORE_BATTERY_FRACTION * cap && cap > 0 && offFor >= SHED_MIN_OFF_SOLS - 1e-9 && fits(next);
      if (!(byGen || byBattery)) break;
      c.m.powered = true;
      delete state.sim.shedAt[c.sl.id];
      load = next;
      emit({ type: 'module.restored', slotId: c.sl.id });
    }
  }

  state.resources.energy = Math.min(cap, Math.max(0, B + (gen - load) * dt));
  state.rates.energyGen = gen;
  state.rates.energyUse = load;
}
