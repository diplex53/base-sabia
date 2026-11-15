import { autonomy } from '../sim/selectors.js';

const LOW_SOLS = 10; // finite autonomy above this still counts as "all good"
const DUST_HINT = 0.15;

/**
 * "What should I do now?" rule. Returns an i18n hint key. First match wins:
 * solar storm and not sheltering, broken module, dusty panels, ship offer waiting,
 * then the lowest finite autonomy among the four main resources.
 */
export function advise(state) {
  const spe = state.env && state.env.spe;
  if (spe && !state.sheltering) return 'hint.shelter';
  const mods = state.slots.map((s) => s.module).filter(Boolean);
  if (mods.some((m) => m.status === 'broken')) return 'hint.repair';
  if (mods.some((m) => m.type === 'solar' && (m.dust || 0) > DUST_HINT && m.status !== 'cleaning')) return 'hint.clean';
  if (state.env && state.env.comm && state.env.comm.blackout) return 'hint.blackout';
  if (state.ship && state.ship.awaitingDecision) return 'hint.decide';
  const a = autonomy(state);
  let worst = null;
  let worstVal = Infinity;
  for (const k of ['energy', 'o2', 'water', 'food']) {
    const v = a[k];
    if (Number.isFinite(v) && v < LOW_SOLS && v < worstVal) { worstVal = v; worst = k; }
  }
  return worst ? 'hint.' + worst : 'hint.allGood';
}
