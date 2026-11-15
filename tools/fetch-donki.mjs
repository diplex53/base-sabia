// Downloads real solar flare (FLR) and solar energetic particle (SEP) records from
// NASA DONKI, curates them and writes src/data/donkiEvents.js.
// Run:  node tools/fetch-donki.mjs
// Anonymous access only (no key, no account). Sequential requests, small delay, retries.
// DONKI limits each request to 60 days, so the range is downloaded in 30-day windows.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'data', 'donkiEvents.js');

// Tried in order; the first one that answers is used for the whole run.
// (The legacy kauai.* host has been unreachable; api.nasa.gov/DONKI/FLR returned 404.)
const BASES = [
  'https://ccmc.gsfc.nasa.gov/DONKI/WS/get/',
  'https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/',
];

const START = '2010-01-01';
const TODAY = new Date().toISOString().slice(0, 10);
const WINDOW_DAYS = 30;
const DELAY_MS = 250;
const MIN_COUNT = 40;
const MAX_COUNT = 80;
const MUST_HAVE_DAY = '2017-09-10';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };

async function getJson(url, tries = 5) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { Accept: 'application/json' } });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
      if (!text.trim()) return [];
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      await sleep(1000 * 2 ** i);
    }
  }
  throw new Error(`Failed ${url}: ${lastErr && lastErr.message}`);
}

async function pickBase() {
  for (const base of BASES) {
    try {
      await getJson(`${base}FLR?startDate=2017-09-10&endDate=2017-09-10`, 2);
      return base;
    } catch { /* try next */ }
  }
  throw new Error('No DONKI endpoint reachable');
}

async function downloadAll(base, kind) {
  const map = new Map();
  const idKey = kind === 'FLR' ? 'flrID' : 'sepID';
  let start = START;
  let requests = 0;
  while (start <= TODAY) {
    let end = addDays(start, WINDOW_DAYS - 1);
    if (end > TODAY) end = TODAY;
    const arr = await getJson(`${base}${kind}?startDate=${start}&endDate=${end}`);
    requests++;
    if (Array.isArray(arr)) for (const r of arr) if (r && r[idKey]) map.set(r[idKey], r);
    start = addDays(end, 1);
    await sleep(DELAY_MS);
  }
  console.log(`${kind}: ${requests} requests, ${map.size} unique records`);
  return [...map.values()];
}

// "X8.2" -> 8.2e-4 W/m2 (GOES 1-8 A peak flux). Letter scale: A 1e-8, B 1e-7, C 1e-6, M 1e-5, X 1e-4.
const LETTER = { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 };
function parseClass(c) {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)/i.exec(String(c || '').trim());
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const num = parseFloat(m[2]);
  return { letter, num, magnitude: Number((num * LETTER[letter]).toPrecision(6)) };
}

function main() { /* placeholder to keep structure readable */ }
void main;

const base = await pickBase();
console.log('Using endpoint:', base);
const flares = await downloadAll(base, 'FLR');
const seps = await downloadAll(base, 'SEP');
const downloaded = flares.length + seps.length;

// SEP linkage: flare->SEP via flare.linkedEvents, SEP->flare via sep.linkedEvents.
const flaresWithSep = new Set();
for (const f of flares) {
  if ((f.linkedEvents || []).some((l) => /-SEP-/.test(l.activityID || ''))) flaresWithSep.add(f.flrID);
}
for (const s of seps) {
  for (const l of s.linkedEvents || []) {
    if (/-FLR-/.test(l.activityID || '')) flaresWithSep.add(l.activityID);
  }
}

const parsed = flares
  .map((f) => ({ f, c: parseClass(f.classType) }))
  .filter((x) => x.c && x.f.peakTime);

function select(xThreshold) {
  return parsed.filter(({ f, c }) => {
    const sep = flaresWithSep.has(f.flrID);
    if (c.letter === 'X' && c.num >= xThreshold) return true;
    // M5.0-M9.9 flares with a linked SEP (X-class flares are governed by the X threshold alone;
    // otherwise nearly every X flare with an SEP link would bypass the threshold).
    if (sep && c.letter === 'M' && c.num >= 5) return true;
    return false;
  });
}

// Move the X threshold until the count is within [MIN_COUNT, MAX_COUNT].
const steps = [];
for (let t = 1.0; t <= 6.0001; t += 0.5) steps.push(Number(t.toFixed(1)));
let xThreshold = 2.0;
let chosen = select(xThreshold);
if (chosen.length < MIN_COUNT) {
  for (const t of steps.filter((s) => s < 2.0).reverse()) {
    xThreshold = t; chosen = select(t);
    if (chosen.length >= MIN_COUNT) break;
  }
} else if (chosen.length > MAX_COUNT) {
  for (const t of steps.filter((s) => s > 2.0)) {
    xThreshold = t; chosen = select(t);
    if (chosen.length <= MAX_COUNT) break;
  }
}
const inRange = chosen.length >= MIN_COUNT && chosen.length <= MAX_COUNT;

// Must-have: the 2017-09-10 X-class flare.
let mustHaveForced = false;
const mustHave = parsed.filter(({ f, c }) => f.peakTime.startsWith(MUST_HAVE_DAY) && c.letter === 'X')
  .sort((a, b) => b.c.magnitude - a.c.magnitude)[0];
if (mustHave && !chosen.some((x) => x.f.flrID === mustHave.f.flrID)) { chosen.push(mustHave); mustHaveForced = true; }
if (!mustHave) console.warn(`!!! WARNING: X-class flare of ${MUST_HAVE_DAY} NOT FOUND in downloaded data !!!`);

chosen.sort((a, b) => a.f.peakTime.localeCompare(b.f.peakTime));

const events = chosen.map(({ f, c }) => ({
  id: f.flrID,
  peakTime: f.peakTime,
  classType: f.classType,
  magnitude: c.magnitude,
  sourceLocation: f.sourceLocation || null,
  activeRegion: f.activeRegionNum ?? null,
  sepLinked: flaresWithSep.has(f.flrID),
  severity: c.letter === 'X' && c.num >= 5 ? 'severe' : 'moderate',
  link: f.link || null,
}));

const xTxt = `X${xThreshold.toFixed(1)}`;
const rule = `Flares of class ${xTxt} or stronger, plus any M-class flare of M5.0 or stronger that has a linked SEP event`
  + (mustHaveForced ? `, plus the X-class flare of ${MUST_HAVE_DAY}` : '') + '.';

const endpoints = BASES.map((b) => `${b}FLR`).slice(0, 1).concat(BASES.map((b) => `${b}SEP`).slice(0, 1));

const header = `// NASA DONKI curated solar events (real data) for the Mars-base game.
// GENERATED by tools/fetch-donki.mjs - do not edit by hand; re-run \`node tools/fetch-donki.mjs\`.
// Source: NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information), CCMC,
//   https://ccmc.gsfc.nasa.gov/tools/DONKI/  (solar flare FLR and solar energetic particle SEP records).
// Curation rule: keep solar flares of class ${xTxt} or stronger, plus any M-class flare of M5.0 or stronger
//   (M5.0-M9.9) that has a linked SEP event (flare.linkedEvents contains a SEP, or a SEP record links to the flare).
//   The X threshold was moved from the default X2.0 only to keep the count within ${MIN_COUNT}-${MAX_COUNT} events.
//   The X-class flare of ${MUST_HAVE_DAY} is always included. Sorted by peak time.
// magnitude: peak soft X-ray flux in W/m2 derived from the class (X1.0 = 1e-4, M1.0 = 1e-5).
// ASSUMPTION: severity is a game simplification based only on flare class; real radiation dose at Mars depends on more factors.
//   ('severe' = class X5.0 or stronger, otherwise 'moderate').
// Fields DONKI does not provide are null.
`;

const meta = {
  source: 'NASA DONKI (CCMC)',
  url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
  endpoints,
  extractedAt: new Date().toISOString(),
  range: [START, TODAY],
  rule,
  count: events.length,
};

const body = `${header}
export const DONKI_META = ${JSON.stringify(meta, null, 2)};

export const DONKI_EVENTS = [
${events.map((e) => '  ' + JSON.stringify(e)).join(',\n')}
];
`;

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, body, 'utf8');

const by = (fn) => events.reduce((m, e) => { const k = fn(e); m[k] = (m[k] || 0) + 1; return m; }, {});
console.log('\n=== Summary ===');
console.log('Records downloaded:', downloaded, `(FLR ${flares.length}, SEP ${seps.length})`);
console.log('Flares with a linked SEP:', flaresWithSep.size);
console.log('Records kept:', events.length, inRange ? '' : '(OUT OF 40-80 RANGE!)');
console.log('Rule:', rule);
console.log('By letter:', by((e) => e.classType[0]));
console.log('By severity:', by((e) => e.severity));
console.log('With SEP:', events.filter((e) => e.sepLinked).length);
console.log(`${MUST_HAVE_DAY} X flare:`, mustHave ? mustHave.f.classType + ' ' + mustHave.f.peakTime : 'MISSING');
console.log('Wrote', OUT);
