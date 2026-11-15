import { SELF_SUFFICIENT } from '../data/balance.js';
import { netPerSol, population } from '../sim/selectors.js';

/** Progress toward the self-sufficient colony goal. Pure read of the state. */
export function colonyProgress(state) {
  const net = netPerSol(state);
  const m = (state.sim && state.sim.milestone) || null;
  const streak = m ? m.streak : 0;
  const techs = ((state.tech && state.tech.unlocked) || []).length;
  const pop = population(state);
  const rows = [
    { id: 'pop', ok: pop >= SELF_SUFFICIENT.pop, v: Math.min(1, pop / SELF_SUFFICIENT.pop), n: pop, max: SELF_SUFFICIENT.pop },
    { id: 'o2', ok: net.o2 >= 0, v: net.o2 >= 0 ? 1 : 0 },
    { id: 'water', ok: net.water >= 0, v: net.water >= 0 ? 1 : 0 },
    { id: 'food', ok: net.food >= 0, v: net.food >= 0 ? 1 : 0 },
  ];
  if (m) rows.push({ id: 'streak', ok: streak >= SELF_SUFFICIENT.sols, v: Math.min(1, streak / SELF_SUFFICIENT.sols), n: streak, max: SELF_SUFFICIENT.sols });
  rows.push({ id: 'tech', ok: techs >= 8, v: Math.min(1, techs / 8), n: techs, max: 8 });
  const pct = Math.round((rows.reduce((a, r) => a + r.v, 0) / rows.length) * 100);
  return { pct, rows, done: state.stats && state.stats.selfSufficientAt != null };
}
