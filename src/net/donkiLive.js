// "The Sun today": live solar flares from NASA DONKI (last 30 days), with an honest archive fallback.
// The endpoint allows any origin, needs no key, and rejects ranges over 60 days. [] or an empty body = quiet Sun.
// Called once per page load; it never blocks the game. Archive data is NEVER presented as live.
import { DONKI_EVENTS, DONKI_META } from '../data/donkiEvents.js';

const DAYS = 30;
const TIMEOUT_MS = 8000;
const URL_BASE = 'https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR';

const iso = (d) => d.toISOString().slice(0, 10);
const RANK = { A: 0, B: 1, C: 2, M: 3, X: 4 };
function classValue(c) {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)/i.exec(String(c || ''));
  return m ? RANK[m[1].toUpperCase()] * 1000 + Number(m[2]) : -1;
}

let state = { status: 'idle' }; // idle | loading | live | archive
let promise = null;
const subs = new Set();

function set(next) {
  state = next;
  subs.forEach((cb) => { try { cb(state); } catch (e) { /* ignore */ } });
}

export function archiveSun() {
  const last = DONKI_EVENTS.reduce((a, b) => (a && a.peakTime > b.peakTime ? a : b), null);
  return {
    status: 'archive',
    classType: last ? last.classType : null,
    date: last ? String(last.peakTime).slice(0, 10) : null,
    archiveDate: String(DONKI_META.extractedAt || '').slice(0, 10),
  };
}

async function load() {
  set({ status: 'loading' });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const end = new Date();
    const start = new Date(end.getTime() - DAYS * 86400000);
    const res = await fetch(`${URL_BASE}?startDate=${iso(start)}&endDate=${iso(end)}`, { signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = (await res.text()).trim();
    const list = text ? JSON.parse(text) : [];
    if (!Array.isArray(list)) throw new Error('unexpected body');
    let best = null;
    for (const f of list) if (!best || classValue(f.classType) > classValue(best.classType)) best = f;
    set({
      status: 'live',
      count: list.length,
      startDate: iso(start) + 'T00:00:00.000Z',
      flares: list.map((f) => ({ id: f.flrID || f.id, peakTime: f.peakTime || f.beginTime, classType: f.classType, link: f.link })),
      classType: best ? best.classType : null,
      date: best ? String(best.peakTime || best.beginTime || '').slice(0, 10) : null,
      fetchedAt: Date.now(),
    });
  } catch (e) {
    set(archiveSun());
  } finally {
    clearTimeout(timer);
  }
}

/** Starts the one request of this page load (idempotent). Never throws, never blocks. */
export function loadSunToday() {
  if (!promise) promise = load().catch(() => set(archiveSun()));
  return promise.then(() => state);
}
export const getSunState = () => state;
export function onSunUpdate(cb) { subs.add(cb); return () => subs.delete(cb); }
