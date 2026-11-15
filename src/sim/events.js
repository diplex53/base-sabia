// Random and scheduled events (DESIGN 10, Apêndice B.2).
//
// Draw at the start of every sol (after EVENTS.graceSols): chance = p * D * eventMult with
//   D = min(difficultyMax, 1 + sol / difficultyRampSols); dust devil and marsquake do not use D.
// Scheduled events (state.events.scheduled, used by the story) fire at atT regardless of the draw.
//
// Dust storms: env.storm = { kind, startT, endsAt, tauPeak }. tau ramps linearly TAU_CLEAR -> tauPeak over
//   rampSols, holds, and ramps back down over the last rampSols (DESIGN 5.1 f_tau then does the power drop).
//   dust.js applies DUST_STORM_MULT[kind] to deposition while the storm lasts.
// Solar particle events (DESIGN 5.5): a real DONKI record. Warning = warningSols (warningSolsTech with the
//   spaceWeather tech) - commDelayMin / (SOL_HOURS * 60), at least minWarningSols (DESIGN 3: the warning comes
//   from Earth). Active phase lasts moderateSols / severeSols; radiation.js applies
//   totalMsv / duration * SHIELD_SPE[location] * alara.
// Every event observed to its end yields observedScience (DESIGN 5.6); a marsquake yields marsquake.science.
import { TAU_CLEAR, SOL_HOURS, SPE_MODERATE_MSV, SPE_SEVERE_MSV } from '../data/constants.js';
import { EVENTS } from '../data/balance.js';
import { DONKI_EVENTS } from '../data/donkiEvents.js';
import { random } from './rng.js';
import { solIndex, difficultyOf, hasTech, isBuilt, isConsumerType, deconFailureCut } from './model.js';
import { showPanel } from './alerts.js';

const FAILURE_EXCLUDED = ['habitat', 'battery', 'shelter'];
const OLD_TYPES = ['solar', 'moxie', 'extractor', 'greenhouse', 'reactor'];
/** Can fail (B.2 + E.2): the old producers, and the expansion modules that draw power. */
const canFail = (type) => !FAILURE_EXCLUDED.includes(type) && (OLD_TYPES.includes(type) || isConsumerType(type));

/** Event difficulty D (DESIGN 10) for a displayed sol number. */
export const eventD = (sol) => Math.min(EVENTS.difficultyMax, 1 + sol / EVENTS.difficultyRampSols);

/** Useful SPE warning time in sols right now (Apêndice B.2). */
export function speWarningSols(state) {
  const sp = EVENTS.spe;
  if (state.env.comm?.blackout) return hasTech(state, 'spaceWeather') ? sp.warningSolsLocal : 0;
  const base = hasTech(state, 'spaceWeather') ? sp.warningSolsTech : sp.warningSols;
  return Math.max(sp.minWarningSols, base - state.env.commDelayMin / (SOL_HOURS * 60));
}

/** tau of a storm at time t: linear ramps up and down, plateau at tauPeak. */
export function stormTauAt(storm, t) {
  const ramp = (storm.kind === 'global' ? EVENTS.dustGlobal : EVENTS.dustRegional).rampSols;
  const up = Math.min(1, Math.max(0, (t - storm.startT) / ramp));
  const down = Math.min(1, Math.max(0, (storm.endsAt - t) / ramp));
  return TAU_CLEAR + (storm.tauPeak - TAU_CLEAR) * Math.min(up, down);
}

const uniform = (state, [lo, hi]) => lo + (hi - lo) * random(state);

/** Emit event.end and grant the observation science. */
export function endObserved(state, emit, payload) {
  const science = payload.kind === 'marsquake' ? EVENTS.marsquake.science : EVENTS.observedScience;
  state.resources.science += science;
  emit({ type: 'event.end', ...payload, science });
}

// ---------- dust storms ----------
function startStorm(state, emit, kind, params = {}) {
  const def = kind === 'global' ? EVENTS.dustGlobal : EVENTS.dustRegional;
  if (state.env.storm) endStorm(state, emit);
  const sols = params.sols ?? uniform(state, def.sols);
  const tauPeak = params.tauPeak ?? uniform(state, def.tau);
  state.env.storm = { kind, startT: state.t, endsAt: state.t + sols, tauPeak };
  state.events.last[kind] = state.t;
  const ek = kind === 'global' ? 'dustGlobal' : 'dustRegional';
  emit({ type: 'event.start', kind: ek, tauPeak, endsAt: state.env.storm.endsAt });
  showPanel(state, emit, kind === 'global' ? 'globalStorm' : 'dustStorm');
}

function endStorm(state, emit) {
  const st = state.env.storm;
  state.env.storm = null;
  state.env.tau = TAU_CLEAR;
  endObserved(state, emit, { kind: st.kind === 'global' ? 'dustGlobal' : 'dustRegional', tauPeak: st.tauPeak });
}

// ---------- solar particle events ----------
function startSpe(state, emit, params = {}) {
  if (state.env.spe) endSpe(state, emit);
  const rec = params.record || (params.donkiId && DONKI_EVENTS.find((e) => e.id === params.donkiId))
    || DONKI_EVENTS[Math.floor(random(state) * DONKI_EVENTS.length)];
  const severity = params.severity || rec.severity;
  const [lo, hi] = severity === 'severe' ? SPE_SEVERE_MSV : SPE_MODERATE_MSV;
  const totalMsv = params.totalMsv ?? lo + (hi - lo) * random(state) ** EVENTS.spe.doseSkew;
  const duration = severity === 'severe' ? EVENTS.spe.severeSols : EVENTS.spe.moderateSols;
  const startsAt = state.t + (params.warningSols ?? speWarningSols(state));
  state.env.spe = {
    phase: startsAt > state.t ? 'warning' : 'active', live: !!params.live, donkiId: rec.id, classType: rec.classType, peakTime: rec.peakTime, link: rec.link,
    severity, startsAt, endsAt: startsAt + duration, totalMsv, doseBy: {},
  };
  state.events.last.spe = state.t;
  emit(speStartPayload(state.env.spe));
  if (state.env.spe.phase === 'warning') showPanel(state, emit, 'speWarning');
}

const speStartPayload = (spe) => ({
  type: 'event.start', kind: 'spe', phase: spe.phase, donkiId: spe.donkiId, classType: spe.classType,
  peakTime: spe.peakTime, link: spe.link, severity: spe.severity, startsAt: spe.startsAt, endsAt: spe.endsAt, totalMsv: spe.totalMsv,
  live: !!spe.live,
});

function endSpe(state, emit) {
  const spe = state.env.spe;
  state.env.spe = null;
  const maxDoseMsv = Math.max(0, ...Object.values(spe.doseBy));
  endObserved(state, emit, { kind: 'spe', donkiId: spe.donkiId, severity: spe.severity, maxDoseMsv });
  showPanel(state, emit, spe.severity === 'severe' ? 'speSevere' : 'speAtmosphere');
}

// ---------- instantaneous events ----------
function dustDevil(state, emit, params = {}) {
  const panels = state.slots.filter((sl) => sl.module && sl.module.type === 'solar' && isBuilt(sl.module));
  const sl = (params.slotId && panels.find((p) => p.id === params.slotId)) || (panels.length ? panels[Math.floor(random(state) * panels.length)] : null);
  if (!sl) return;
  sl.module.dust *= 1 - EVENTS.dustDevil.removes;
  emit({ type: 'event.start', kind: 'dustDevil', slotId: sl.id });
  showPanel(state, emit, 'cleaningEvent');
  endObserved(state, emit, { kind: 'dustDevil', slotId: sl.id });
}

function failure(state, emit, params = {}) {
  const ok = state.slots.filter((sl) => sl.module && sl.module.status === 'ok' && canFail(sl.module.type));
  const sl = (params.slotId && ok.find((p) => p.id === params.slotId)) || (ok.length ? ok[Math.floor(random(state) * ok.length)] : null);
  if (!sl) return;
  sl.module.status = 'broken';
  sl.module.progress = 0;
  emit({ type: 'event.start', kind: 'failure', slotId: sl.id });
  showPanel(state, emit, 'equipmentFailure');
}

function marsquake(state, emit) {
  emit({ type: 'event.start', kind: 'marsquake' });
  showPanel(state, emit, 'marsquake');
  endObserved(state, emit, { kind: 'marsquake' });
}

/** Fire one event by its contract kind. Shared by the draw and the schedule. */
export function fireEvent(state, emit, kind, params = {}) {
  switch (kind) {
    case 'dustRegional': return startStorm(state, emit, 'regional', params);
    case 'dustGlobal': return startStorm(state, emit, 'global', params);
    case 'spe': return startSpe(state, emit, params);
    case 'dustDevil': return dustDevil(state, emit, params);
    case 'failure': return failure(state, emit, params);
    case 'marsquake': return marsquake(state, emit, params);
    default: return undefined;
  }
}

/** Continuous part, every step before the other systems: schedule, tau ramp, SPE phases, endings. */
export function stepEvents(state, dt, emit) {
  const ev = state.events;
  if (ev.scheduled.length) {
    const due = ev.scheduled.filter((e) => e.atT <= state.t + 1e-9);
    if (due.length) {
      ev.scheduled = ev.scheduled.filter((e) => e.atT > state.t + 1e-9);
      due.sort((a, b) => a.atT - b.atT);
      for (const e of due) fireEvent(state, emit, e.kind, e.params || {});
    }
  }
  const env = state.env;
  if (env.storm) {
    if (state.t >= env.storm.endsAt - 1e-9) endStorm(state, emit);
    else env.tau = stormTauAt(env.storm, state.t + dt / 2);
  }
  if (env.spe) {
    if (env.spe.phase === 'warning' && state.t >= env.spe.startsAt - 1e-9) {
      env.spe.phase = 'active';
      emit(speStartPayload(env.spe));
    }
    if (state.t >= env.spe.endsAt - 1e-9) endSpe(state, emit);
  }
}

const gapOk = (last, t, gap) => last === null || last === undefined || t - last >= gap - 1e-9;

/** The draw at the start of each sol (call right after the sol changes). */
export function drawEvents(state, emit) {
  if (!state.events.auto) return;
  const sol = solIndex(state.t) + 1;
  if (sol <= EVENTS.graceSols) return;
  const dif = difficultyOf(state);
  const D = eventD(sol);
  const k = dif.eventMult;
  const last = state.events.last;
  // always six draws per sol, so the sequence does not depend on which events were eligible
  const r = [random(state), random(state), random(state), random(state), random(state), random(state)];
  const t = state.t;
  const E = EVENTS;
  if (!state.env.storm && sol > E.dustGlobal.afterSol && gapOk(last.global, t, E.dustGlobal.minGap) && r[1] < E.dustGlobal.p * D * k) {
    fireEvent(state, emit, 'dustGlobal');
  } else if (!state.env.storm && gapOk(last.regional, t, E.dustRegional.minGap) && r[0] < E.dustRegional.p * D * k) {
    fireEvent(state, emit, 'dustRegional');
  }
  const liveWindow = state.realSun && t >= E.graceSols && t < E.graceSols + 30;
  if (!liveWindow && !state.env.spe && gapOk(last.spe, t, E.spe.minGap) && r[2] < E.spe.p * D * k) fireEvent(state, emit, 'spe');
  if (r[3] < E.dustDevil.p * k) fireEvent(state, emit, 'dustDevil');
  if (dif.failures && r[4] < E.failure.p * D * k * (1 - deconFailureCut(state))) fireEvent(state, emit, 'failure'); // E.2 decon
  if (r[5] < E.marsquake.p * k) fireEvent(state, emit, 'marsquake');
}
