// Alerts and science panels (Apêndice A.4). Both are emitted on transition only.
// Alerts use hysteresis so they do not repeat every step; each science panel id fires once per game.
import { autonomy } from './selectors.js';

const LOW_ON = 2;    // autonomy below this raises *Low (sols)
const LOW_OFF = 3;   // ...and it clears above this
const OUT_OFF = 0.25; // an *Out alert clears when the stock is back and lasts at least this long

/** Emit a science panel the first time only (tracked in stats.panelsSeen). */
export function showPanel(state, emit, id) {
  if (state.stats.panelsSeen.includes(id)) return;
  state.stats.panelsSeen.push(id);
  emit({ type: 'science.panel', id });
}

/** Raise or clear an alert key; emits {type:'alert'} only when it turns on. */
export function setAlert(state, emit, key, on, level) {
  const was = !!state.sim.alerts[key];
  if (on && !was) {
    state.sim.alerts[key] = true;
    emit({ type: 'alert', key, level });
  } else if (!on && was) {
    delete state.sim.alerts[key];
  }
}

function lowAndOut(state, emit, res, aut, outOn, outClear) {
  const lowKey = `alert.${res}Low`;
  const lowWas = !!state.sim.alerts[lowKey];
  setAlert(state, emit, lowKey, lowWas ? aut < LOW_OFF : aut < LOW_ON, 'warn');
  const outKey = res === 'energy' ? 'alert.blackout' : `alert.${res}Out`;
  const outWas = !!state.sim.alerts[outKey];
  setAlert(state, emit, outKey, outWas ? !outClear : outOn, 'danger');
}

export function stepAlerts(state, emit) {
  const a = autonomy(state);
  const r = state.resources;
  for (const res of ['o2', 'water', 'food']) {
    lowAndOut(state, emit, res, a[res], !(r[res] > 0), r[res] > 0 && a[res] >= OUT_OFF);
  }
  // energy "out" = the habitat lost power (blackout timer running)
  const bo = state.timers.blackout > 0;
  lowAndOut(state, emit, 'energy', a.energy, bo, !bo);
}
