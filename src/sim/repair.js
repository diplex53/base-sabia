// Repair of broken equipment (DESIGN 10, Apêndice B.2).
// Action {type:'repair', slotId}: pays EVENTS.failure.repairParts, status 'repairing' with progress,
// then 'ok' after repairSols (x2 faster with an engineer on base, paused while sheltering).
// Finishing the repair ends the failure event: event.end { kind: 'failure', slotId, science }.
import { EVENTS } from '../data/balance.js';
import { findSlot } from './build.js';
import { crewWorkSpeed } from './dust.js';
import { endObserved } from './events.js';

export function actRepair(state, { slotId }) {
  const sl = findSlot(state, slotId);
  if (!sl) return 'err.noSuchSlot';
  const m = sl.module;
  if (!m) return 'err.slotEmpty';
  if (m.status !== 'broken') return 'err.notBroken';
  if (state.resources.parts < EVENTS.failure.repairParts) return 'err.notEnoughParts';
  state.resources.parts -= EVENTS.failure.repairParts;
  m.status = 'repairing';
  m.progress = 0;
  return null;
}

export function stepRepairs(state, dt, emit) {
  const speed = crewWorkSpeed(state);
  if (speed === 0) return;
  for (const sl of state.slots) {
    const m = sl.module;
    if (!m || m.status !== 'repairing') continue;
    m.progress += dt * speed / EVENTS.failure.repairSols;
    if (m.progress < 1 - 1e-9) continue;
    m.status = 'ok';
    m.progress = 0;
    endObserved(state, emit, { kind: 'failure', slotId: sl.id });
  }
}
