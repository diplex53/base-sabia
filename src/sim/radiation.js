// Radiation per colonist (DESIGN 5.5, Apêndice B.2/B.4/B.6):
//   d(dose)/dt = GCR_SURFACE_MSV_PER_SOL * shieldGCR(location) * alara
//              + speRate * shieldSPE(location) * alara
//   speRate = totalMsv / (endsAt - startsAt) during the active phase of a solar particle event,
//            integrated exactly over the part of the step that overlaps [startsAt, endsAt].
//   alara = ALARA_FACTOR with a physician on base, for everyone on base (not on expedition).
//   On expedition both shields are 1.0, x TECH_EFFECTS.roverShield with the pressurizedRover tech.
// Dose never decreases. At CAREER_DOSE_LIMIT_MSV the colonist retires (leaves on the next ship).
import { GCR_SURFACE_MSV_PER_SOL, SHIELD_GCR, SHIELD_SPE, CAREER_DOSE_LIMIT_MSV, ALARA_FACTOR } from '../data/constants.js';
import { TECH_EFFECTS } from '../data/tech.js';
import { habitatShieldGCR, hasTech, medicOnBase } from './model.js';
import { retire } from './colonists.js';
import { showPanel } from './alerts.js';

const roverMult = (state) => (hasTech(state, 'pressurizedRover') ? TECH_EFFECTS.roverShield : 1);

export function shieldGCRFor(state, c) {
  if (c.location === 'expedition') return SHIELD_GCR.expedition * roverMult(state);
  if (c.location === 'shelter') return SHIELD_GCR.shelter;
  return habitatShieldGCR(state); // 'habitat' and 'module' (modules sit inside the base)
}

export function shieldSPEFor(state, c) {
  if (c.location === 'expedition') return SHIELD_SPE.expedition * roverMult(state);
  if (c.location === 'shelter') return SHIELD_SPE.shelter;
  return SHIELD_SPE.habitat;
}

/** ALARA factor for one colonist right now. */
export const alaraFor = (state, c, medic = medicOnBase(state)) => (medic && c.location !== 'expedition' ? ALARA_FACTOR : 1);

/** Sols of the SPE active phase inside [t, t + dt]. */
function speOverlap(spe, t, dt) {
  if (!spe) return 0;
  return Math.max(0, Math.min(t + dt, spe.endsAt) - Math.max(t, spe.startsAt));
}

export function stepRadiation(state, dt, emit) {
  const spe = state.env.spe;
  const overlap = speOverlap(spe, state.t, dt);
  const speRate = overlap > 0 ? spe.totalMsv / (spe.endsAt - spe.startsAt) : 0;
  const medic = medicOnBase(state);
  for (const c of state.colonists) {
    const alara = alaraFor(state, c, medic);
    c.dose += GCR_SURFACE_MSV_PER_SOL * shieldGCRFor(state, c) * alara * dt;
    if (overlap > 0) {
      const d = speRate * shieldSPEFor(state, c) * alara * overlap;
      c.dose += d;
      spe.doseBy[c.id] = (spe.doseBy[c.id] || 0) + d;
    }
    if (c.status === 'active' && c.dose >= CAREER_DOSE_LIMIT_MSV) {
      retire(state, c, emit);
      showPanel(state, emit, 'careerLimit');
    }
  }
}
