// Environment (DESIGN 3): daylight and Earth-Mars communication delay.
// tau is left untouched here: it starts at TAU_CLEAR and dust storms (events.js, later phase) change it.
import { COMM_DELAY_MIN_MINUTES, COMM_DELAY_MAX_MINUTES } from '../data/constants.js';
import { TIME, SHIP, COMM, EVENTS } from '../data/balance.js';
import { showPanel } from './alerts.js';

/** sun(f) = max(0, sin(pi (f - sunrise) / (sunset - sunrise))); integral over a sol = 1/pi. DESIGN 3. */
export function sunAt(t) {
  const f = t - Math.floor(t);
  if (f <= TIME.SUNRISE || f >= TIME.SUNSET) return 0;
  return Math.max(0, Math.sin(Math.PI * (f - TIME.SUNRISE) / (TIME.SUNSET - TIME.SUNRISE)));
}

/** delay = 4 + 16 (1 - cos(2 pi t / 26)) / 2 minutes. DESIGN 3. */
export function commDelayAt(t) {
  const span = COMM_DELAY_MAX_MINUTES - COMM_DELAY_MIN_MINUTES;
  return COMM_DELAY_MIN_MINUTES + span * (1 - Math.cos(2 * Math.PI * t / SHIP.intervalSols)) / 2;
}

/** Evaluated at the middle of the step (midpoint rule keeps the sol integral exact to <0.1%). */
export function stepEnvironment(state, dt, emit) {
  const tm = state.t + dt / 2;
  state.env.sun = sunAt(tm);
  state.env.commDelayMin = commDelayAt(state.t);
  const cycle = Math.floor(state.t / SHIP.intervalSols);
  const begin = cycle * SHIP.intervalSols + COMM.blackoutCenter - COMM.blackoutSols / 2;
  const end = begin + COMM.blackoutSols;
  const blackout = state.mode !== 'story' && state.t >= EVENTS.graceSols && state.t >= begin - 1e-9 && state.t < end - 1e-9;
  const was = !!state.env.comm?.blackout;
  state.env.comm = { delayMin: state.env.commDelayMin, blackout, blackoutEndsAt: blackout ? end : null };
  if (emit && blackout !== was) {
    emit(blackout ? { type: 'comm.blackout.start', endsAt: end } : { type: 'comm.blackout.end' });
    if (blackout) showPanel(state, emit, 'conjunction');
  }
}
