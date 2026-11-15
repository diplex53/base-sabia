// Colony health (Apêndice E.3). state.health 0..100, starts at HEALTH.start.
//   d(health)/dt = -(decay + starving if food or water is at zero) * (cadet ? cadetMult : 1)
//                  + (sum of active gym and hospital `health` levels) * (2 with a hospital while health < 50)
// Below HEALTH.lowAt: no staff bonus (model.staffMult), construction x slowBuild (build.js), alert.healthLow.
// At 0 the mission is aborted: game over 'health' (index.stepTimers). Panel muscleLoss the first time below 70.
import { HEALTH } from '../data/balance.js';
import { levelSum } from './model.js';
import { setAlert, showPanel } from './alerts.js';

/** Health change per sol right now. */
export function healthRate(state) {
  const r = state.resources;
  let loss = HEALTH.decay + (r.food > 0 && r.water > 0 ? 0 : HEALTH.starving);
  if (state.difficulty === 'cadet') loss *= HEALTH.cadetMult;
  const hospital = levelSum(state, 'hospital', 'health');
  let gain = levelSum(state, 'gym', 'health') + hospital;
  if (hospital > 0 && (state.health ?? 100) < HEALTH.hospitalBoostBelow) gain *= 2;
  return gain - loss;
}

export function stepHealth(state, dt, emit) {
  if (state.health === undefined) state.health = HEALTH.start;
  const rate = healthRate(state);
  state.health = Math.min(100, Math.max(0, state.health + rate * dt));
  state.rates.health = rate;
  const was = !!state.sim.alerts['alert.healthLow'];
  setAlert(state, emit, 'alert.healthLow', was ? state.health < HEALTH.lowOff : state.health < HEALTH.lowAt, 'warn');
  if (state.health < HEALTH.panelAt) showPanel(state, emit, 'muscleLoss');
}
