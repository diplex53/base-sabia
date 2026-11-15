// Dust on solar panels (DESIGN 5.1): d(dust)/dt = DUST_RATE * stormMult * edsMult, capped at DUST_MAX.
//   stormMult = DUST_STORM_MULT[none | regional | global]; edsMult = 0.2 with the eds tech (B.6).
// Cleaning: status 'cleaning' for CLEAN_SOLS (the panel keeps generating), then dust = 0.
// Twice as fast with an engineer on base (B.4); paused while sheltering (B.3).
import { DUST_RATE_PER_SOL, DUST_STORM_MULT, DUST_MAX } from '../data/constants.js';
import { CLEAN_SOLS, ENGINEER_SPEED } from '../data/balance.js';
import { TECH_EFFECTS } from '../data/tech.js';
import { isBuilt, hasTech, professionOnBase } from './model.js';
import { showPanel } from './alerts.js';

export const DUST_PANEL_THRESHOLD = 0.10;

/** Current dust deposition rate per sol. */
export function dustRate(state) {
  const storm = DUST_STORM_MULT[state.env.storm ? state.env.storm.kind : 'none'] ?? 1;
  const eds = hasTech(state, 'eds') ? TECH_EFFECTS.edsDustMult : 1;
  return DUST_RATE_PER_SOL * storm * eds;
}

/** Speed of crew work (cleaning, repair): 0 while sheltering, x ENGINEER_SPEED with an engineer on base. */
export function crewWorkSpeed(state) {
  if (state.sheltering) return 0;
  return professionOnBase(state, 'engineer') ? ENGINEER_SPEED : 1;
}

export function stepDust(state, dt, emit) {
  const rate = dustRate(state);
  const speed = crewWorkSpeed(state);
  for (const sl of state.slots) {
    const m = sl.module;
    if (!m || m.type !== 'solar' || !isBuilt(m)) continue;
    m.dust = Math.min(DUST_MAX, m.dust + rate * dt);
    if (m.status === 'cleaning') {
      m.progress += dt * speed / CLEAN_SOLS;
      if (m.progress >= 1 - 1e-9) { m.status = 'ok'; m.progress = 0; m.dust = 0; emit({ type: 'clean.done', slotId: sl.id }); }
    }
    if (m.dust >= DUST_PANEL_THRESHOLD) showPanel(state, emit, 'dustOnPanels');
  }
}
