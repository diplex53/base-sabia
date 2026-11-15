// "Sol real" (Apêndice D.1): live DONKI flares of the last 30 days become the solar storms of sols 5-35.
// Flare class is a game trigger, not a prediction of radiation dose at Mars.
//   M5.0 or stronger -> scheduled SPE (severe from X5.0), at t = graceSols + whole days since the window start.
//   Window: the optional ISO windowStart, else 30 days before the latest valid peakTime in the list.
//   Bad records (no time, unparsable class) are skipped silently. Deterministic: no clock is read.
import { EVENTS } from '../data/balance.js';

const DAY_MS = 86400000;
const WINDOW_DAYS = 30;
const CLASS_MULT = { A: 1e-4, B: 1e-3, C: 0.01, M: 0.1, X: 1 }; // in X units

/** 'M5.2' -> 0.52, 'X1.0' -> 1, 'C3' -> 0.03; null when unparsable. */
export function flareMagnitudeX(classType) {
  const m = /^\s*([ABCMX])\s*(\d+(?:\.\d+)?)\s*$/i.exec(String(classType ?? ''));
  return m ? Number(m[2]) * CLASS_MULT[m[1].toUpperCase()] : null;
}

export function configureRealSun(state, liveFlares, liveWindowStart) {
  state.realSun = null;
  if (state.mode !== 'colony' || !Array.isArray(liveFlares)) return;
  const valid = [];
  for (const flare of liveFlares) {
    if (!flare || typeof flare !== 'object') continue;
    const time = new Date(flare.peakTime).getTime();
    const mag = flareMagnitudeX(flare.classType);
    if (!Number.isFinite(time) || mag === null) continue;
    valid.push({ flare, time, mag });
  }
  let start = liveWindowStart !== undefined && liveWindowStart !== null ? new Date(liveWindowStart).getTime() : NaN;
  if (!Number.isFinite(start)) start = valid.length ? Math.max(...valid.map((v) => v.time)) - WINDOW_DAYS * DAY_MS : null;
  const storms = [], seen = new Set();
  for (const { flare, time, mag } of valid) {
    if (start === null || time < start || time > start + WINDOW_DAYS * DAY_MS) continue;
    const id = String(flare.id || `${flare.peakTime}-${flare.classType}`);
    if (mag < 0.5 - 1e-12 || seen.has(id)) continue;
    seen.add(id);
    storms.push({ atT: EVENTS.graceSols + Math.floor((time - start) / DAY_MS), kind: 'spe', params: {
      live: true, severity: mag >= 5 - 1e-12 ? 'severe' : 'moderate',
      record: { id, peakTime: flare.peakTime, classType: flare.classType, link: flare.link || null },
    } });
  }
  storms.sort((a, b) => a.atT - b.atT || a.params.record.id.localeCompare(b.params.record.id));
  state.realSun = { fetchedCount: liveFlares.length, storms, windowStart: start === null ? null : new Date(start).toISOString() };
  state.events.scheduled.push(...JSON.parse(JSON.stringify(storms)));
}
