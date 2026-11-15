// Colony milestone "self-sufficient" (DESIGN 11, Apêndice B.8):
// population >= SELF_SUFFICIENT.pop and the O2, water and food balance of each whole sol >= 0
// (integral of production - consumption over the sol) for SELF_SUFFICIENT.sols sols in a row.
// Then: event milestone { id: 'selfSufficient' }, stats.selfSufficientAt = t (once); score adds SCORE.selfSufficient.
import { SELF_SUFFICIENT } from '../data/balance.js';
import { activeCount } from './model.js';

/** Every step, after life support: integrate the balances of the current sol. */
export function stepMilestone(state, dt) {
  const m = state.sim.milestone, r = state.rates;
  m.o2 += (r.o2Prod - r.o2Use) * dt;
  m.water += (r.waterProd - r.waterUse) * dt;
  m.food += (r.foodProd - r.foodUse) * dt;
}

/** At each sol change: close the sol, update the streak, maybe reach the milestone. */
export function closeMilestoneSol(state, emit) {
  const m = state.sim.milestone;
  const good = activeCount(state) >= SELF_SUFFICIENT.pop && m.o2 >= -1e-9 && m.water >= -1e-9 && m.food >= -1e-9;
  m.streak = good ? m.streak + 1 : 0;
  m.o2 = 0; m.water = 0; m.food = 0;
  if (m.streak >= SELF_SUFFICIENT.sols && state.stats.selfSufficientAt === null) {
    state.stats.selfSufficientAt = state.t;
    emit({ type: 'milestone', id: 'selfSufficient' });
  }
}
