// Base SabiÃ¡ core tests. Run: node tests/run.mjs [--report]
// Plain node:assert, no framework. Exit code 1 on any failure.
import assert from 'node:assert/strict';
import { createGame, loadGame, selectors } from '../src/sim/index.js';
import * as C from '../src/data/constants.js';
import { TIME, MODULES, DIFFICULTY, EVENTS, EXPEDITIONS, SHIP, START, PROFESSION_BONUS, STAFF_BONUS, SCORE, COMM } from '../src/data/balance.js';
import { TECHS } from '../src/data/tech.js';
import { DONKI_EVENTS } from '../src/data/donkiEvents.js';
import { idleBot, competentBot, carelessBot, runBot, chapter1Bot, chapter2Bot, chapter3Bot, runChapter } from './bots.mjs';
import { CHAPTERS } from '../src/data/story.js';

const REPORT = process.argv.includes('--report');
const T0 = Date.now();
const results = [];
function test(name, fn) {
  const t0 = Date.now();
  try {
    fn();
    results.push(true);
    console.log(`PASS ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    results.push(false);
    console.log(`FAIL ${name}: ${e.message}`);
    if (process.env.DEBUG) console.log(e.stack);
  }
}
const near = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= Math.abs(b) * rel, `${msg}: got ${a}, expected ${b} ±${rel * 100}%`);

// ---------- helpers ----------
function bareGame(seed = 1, difficulty) {
  // a game with an empty map (all start modules removed) and no random events, so one system can be measured alone
  const g = createGame({ seed, difficulty });
  for (const sl of g.state.slots) sl.module = null;
  g.state.events.auto = false;
  return g;
}
function place(g, slotId, type, level = 1, extra = {}) {
  const sl = g.state.slots.find((s) => s.id === slotId);
  sl.module = { type, level, enabled: true, powered: true, status: 'ok', progress: 0, dust: 0, growth: 0, unpoweredSols: 0, staff: [], spent: { parts: 0, regolith: 0 }, ...extra };
  return sl.module;
}
/** A base that cannot die: reactor, big stocks. Random events stay on unless auto = false. */
function fortress(seed, difficulty) {
  const g = createGame({ seed, difficulty });
  for (const sl of g.state.slots) sl.module = null;
  place(g, 's1', 'habitat', 3); place(g, 's2', 'reactor', 3); place(g, 's3', 'battery', 3);
  place(g, 's4', 'moxie', 3); place(g, 's5', 'extractor', 3); place(g, 's6', 'solar', 1); place(g, 's7', 'shelter', 1);
  Object.assign(g.state.resources, { energy: 200, o2: 5000, water: 5000, food: 5000, parts: 500, regolith: 500 });
  return g;
}
const colonist = (g, prof) => g.state.colonists.find((c) => c.profession === prof);
const evOf = (ev, type, kind) => ev.filter((e) => e.type === type && (kind === undefined || e.kind === kind));
function scanNumbers(obj, path = 'state') {
  if (typeof obj === 'number') { assert.ok(Number.isFinite(obj), `non-finite number at ${path}`); return; }
  if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) scanNumbers(v, `${path}.${k}`);
}
function makeRand(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TYPES = [...Object.keys(MODULES), 'banana'];
const TECH_IDS = [...Object.keys(TECHS), 'warpDrive'];
const SITES = ['regolith', 'ice', 'minerals', 'moon'];
function randomAction(rand, state) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const slotId = rand() < 0.95 ? `s${1 + Math.floor(rand() * 16)}` : 's99';
  const colonistId = state.colonists.length && rand() < 0.9 ? pick(state.colonists).id : 'c999';
  switch (Math.floor(rand() * 14)) {
    case 0: return { type: 'build', slotId, moduleType: pick(TYPES) };
    case 1: return { type: 'upgrade', slotId };
    case 2: return { type: 'demolish', slotId };
    case 3: return { type: 'toggle', slotId, enabled: rand() < 0.5 };
    case 4: return { type: 'assign', colonistId, slotId: rand() < 0.3 ? null : slotId };
    case 5: return { type: 'clean', slotId };
    case 6: return { type: 'fly' };
    case 7: return { type: 'repair', slotId };
    case 8: return { type: 'setShelter', on: rand() < 0.5 };
    case 9: return { type: 'research', techId: pick(TECH_IDS) };
    case 10: return { type: 'startExpedition', site: pick(SITES), colonistId };
    case 11: return { type: 'recallExpedition', id: state.expeditions.length && rand() < 0.8 ? pick(state.expeditions).id : 'e999' };
    case 12: return { type: 'shipDecision', acceptIdx: [0, 1, 2, 3].filter(() => rand() < 0.5) };
    default: return null;
  }
}

// ---------- invariants ----------
test('invariants: 300 sols of random actions on 6 seeds (all actions, both difficulties)', () => {
  for (const seed of [1, 2, 3, 42, 777, 2026]) {
    const g = createGame({ seed, difficulty: seed % 2 ? 'commander' : 'cadet' });
    g.state.resources.parts = 400; g.state.resources.regolith = 400; g.state.resources.science = 400; // let random actions actually happen
    const rand = makeRand(seed * 31 + 7);
    const doses = new Map();
    for (let i = 0; i < 300 * 4 && !g.state.over; i++) {
      for (let k = 0; k < 3; k++) {
        const a = randomAction(rand, g.state);
        if (a) { const res = g.dispatch(a); assert.ok(res.ok === true || typeof res.reason === 'string', 'dispatch result shape'); }
      }
      g.tick(0.25);
      const s = g.state;
      scanNumbers(s);
      for (const [k, v] of Object.entries(s.resources)) assert.ok(v >= 0, `seed ${seed}: ${k} negative (${v})`);
      assert.ok(s.resources.energy <= selectors.capacity(s).energy + 1e-9, `seed ${seed}: battery above capacity`);
      for (const c of s.colonists) {
        assert.ok(c.dose >= (doses.get(c.id) ?? 0), `seed ${seed}: dose decreased for ${c.id}`);
        doses.set(c.id, c.dose);
        const onExp = s.expeditions.some((e) => e.colonistId === c.id);
        assert.equal(c.location === 'expedition', onExp, `seed ${seed}: expedition location mismatch for ${c.id}`);
      }
      assert.ok(s.expeditions.length <= 2, 'too many expeditions');
      for (const sl of s.slots) if (sl.module) assert.ok(sl.module.staff.length <= 1, 'more than one colonist on a module');
      if (i % 40 === 0) assert.deepEqual(JSON.parse(JSON.stringify(s)), s, 'state is not plain JSON');
    }
  }
});

test('invariants: serialize/load round-trip continues identically', () => {
  const g = createGame({ seed: 99 });
  g.state.resources.parts = 200; g.state.resources.regolith = 200; g.state.resources.science = 200;
  const rand = makeRand(5);
  for (let i = 0; i < 200; i++) { const a = randomAction(rand, g.state); if (a) g.dispatch(a); g.tick(0.25); }
  const saved = g.serialize();
  const h = loadGame(saved);
  assert.equal(h.serialize(), saved);
  const r1 = makeRand(11), r2 = makeRand(11);
  for (let i = 0; i < 400; i++) {
    const a = randomAction(r1, g.state), b = randomAction(r2, h.state);
    assert.deepEqual(a, b);
    if (a) { assert.deepEqual(g.dispatch(a), h.dispatch(b)); }
    g.tick(0.25); h.tick(0.25);
  }
  assert.equal(g.serialize(), h.serialize());
});

test('invariants: a version-1 save (no Phase 3 fields) still loads and runs', () => {
  const g = createGame({ seed: 3 });
  const old = JSON.parse(g.serialize());
  delete old.difficulty; delete old.events; delete old.ship.offer; delete old.ship.decideBy; delete old.stats.selfSufficientAt;
  delete old.sim.milestone; delete old.sim.nextExpeditionId; old.version = 1;
  const h = loadGame(JSON.stringify(old));
  assert.equal(h.state.difficulty, 'commander');
  h.tick(30);
  assert.ok(h.state.t > 5);
});

// ---------- determinism ----------
test('determinism: same seed + same script -> identical state', () => {
  const run = (seed) => {
    const g = createGame({ seed });
    competentBot(g);
    const rand = makeRand(3);
    for (let i = 0; i < 400; i++) { const a = randomAction(rand, g.state); if (a) g.dispatch(a); competentBot(g); g.tick(0.25); }
    return g.serialize();
  };
  assert.equal(run(123), run(123));
  assert.notEqual(createGame({ seed: 1 }).state.rng, createGame({ seed: 2 }).state.rng);
});

test('events: deterministic per seed, different across seeds, none in the grace sols', () => {
  const seq = (seed) => {
    const g = fortress(seed);
    const out = [];
    for (let i = 0; i < 150; i++) {
      g.tick(1);
      for (const e of g.drainEvents()) if (e.type === 'event.start') out.push(`${e.kind}:${e.phase || ''}:${e.slotId || e.donkiId || ''}@${e.t.toFixed(3)}`);
    }
    return out;
  };
  const a = seq(7), b = seq(7), c = seq(8);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(a.length > 10, `only ${a.length} events in 150 sols`);
  const kinds = new Set(a.map((x) => x.split(':')[0]));
  for (const k of ['dustRegional', 'spe', 'failure']) assert.ok(kinds.has(k), `no ${k} in 150 sols`);
  for (const x of [...a, ...c]) assert.ok(Number(x.split('@')[1]) >= EVENTS.graceSols - 1e-6, `event in the grace sols: ${x}`);
});

// ---------- difficulty ----------
test('difficulty: start multipliers, regolith, grace and failures', () => {
  const def = createGame({ seed: 1 });
  assert.equal(def.state.difficulty, 'commander');
  const cad = createGame({ seed: 1, difficulty: 'cadet' });
  const R = START.colony.resources, k = DIFFICULTY.cadet.startMult;
  assert.equal(cad.state.difficulty, 'cadet');
  assert.equal(cad.state.resources.o2, Math.round(R.o2 * k));
  assert.equal(cad.state.resources.water, Math.round(R.water * k));
  assert.equal(cad.state.resources.food, Math.round(R.food * k));
  assert.equal(cad.state.resources.parts, Math.round(R.parts * k));
  assert.equal(cad.state.resources.regolith, DIFFICULTY.cadet.regolithStart);
  assert.equal(def.state.resources.parts, R.parts);
  assert.equal(def.state.resources.regolith, 0);
  // grace: O2 at zero ends a commander game after 0.25 sol, a cadet game after 0.5
  for (const [dif, lim] of [['commander', 0.25], ['cadet', 0.5]]) {
    const g = createGame({ seed: 2, difficulty: dif });
    g.state.resources.o2 = 0;
    g.tick(lim - 0.03);
    assert.equal(g.state.over, null, `${dif}: over too early`);
    g.tick(0.06);
    assert.equal(g.state.over?.reason, 'o2', `${dif}: not over after the grace`);
  }
  // cadet: no equipment failures, fewer events
  let failures = 0, cadetEvents = 0, commanderEvents = 0;
  for (const seed of [1, 2, 3]) {
    const c1 = fortress(seed, 'cadet'), c2 = fortress(seed, 'commander');
    c1.tick(150); c2.tick(150);
    const e1 = c1.drainEvents(), e2 = c2.drainEvents();
    failures += evOf(e1, 'event.start', 'failure').length;
    cadetEvents += evOf(e1, 'event.start').filter((e) => e.phase !== 'active').length;
    commanderEvents += evOf(e2, 'event.start').filter((e) => e.phase !== 'active').length;
  }
  assert.equal(failures, 0, 'failures on cadet');
  assert.ok(cadetEvents < commanderEvents, `cadet ${cadetEvents} events vs commander ${commanderEvents}`);
  assert.throws(() => createGame({ difficulty: 'godmode' }));
});

// ---------- calibration ----------
function solarSolEnergy(tau) {
  // a lone panel; a habitat on a big charged battery keeps the game alive (no blackout game over)
  const g = bareGame();
  place(g, 's1', 'solar');
  place(g, 's2', 'habitat'); place(g, 's3', 'battery', 3);
  g.state.env.tau = tau;
  g.state.resources.energy = 150;
  let e = 0;
  for (let i = 0; i < 96; i++) { g.tick(TIME.STEP); e += g.state.rates.energyGen * TIME.STEP; }
  return e;
}
test('calibration: 100 m2 clear-sky panel yields 100 x SOLAR_YIELD per sol (±1%)', () => {
  near(solarSolEnergy(C.TAU_CLEAR), 100 * C.SOLAR_YIELD_CLEAR_KWH_M2_SOL, 0.01, 'sol energy');
});
test('calibration: tau 10.8 yields 22/645 of the clear value (±1%)', () => {
  near(solarSolEnergy(10.8), 100 * C.SOLAR_YIELD_CLEAR_KWH_M2_SOL * 22 / 645, 0.01, 'storm sol energy');
});
test('calibration: O2 used by N people in one sol = N x 0.816 x SOL_HOURS/24 (±1%)', () => {
  const g = bareGame();
  place(g, 's1', 'habitat', 3); place(g, 's2', 'battery', 3);
  g.state.resources.energy = 200;
  g.state.resources.o2 = 1000;
  const N = g.state.colonists.length;
  g.tick(1);
  near(1000 - g.state.resources.o2, N * 0.816 * C.SOL_HOURS / 24, 0.01, 'O2 use');
});
test('calibration: dose in one sol in a level-1 habitat = 0.67 x 1.0275 x 0.8 x ALARA (medic on base) (±1%)', () => {
  const g = createGame({ seed: 4 });
  g.state.events.auto = false;
  const c = g.state.colonists[0];
  const d0 = c.dose;
  assert.equal(d0, C.TRANSIT_DOSE_MSV);
  g.tick(1);
  near(c.dose - d0, 0.67 * 1.0275 * 0.8 * C.ALARA_FACTOR, 0.01, 'dose');
  // the physician away on an expedition: no ALARA
  const h = createGame({ seed: 4 });
  h.state.events.auto = false;
  h.state.resources.energy = 30;
  assert.ok(h.dispatch({ type: 'startExpedition', site: 'minerals', colonistId: colonist(h, 'medic').id }).ok);
  const e = colonist(h, 'engineer'), e0 = e.dose;
  h.tick(1);
  near(e.dose - e0, 0.67 * 1.0275 * 0.8, 0.01, 'dose without ALARA');
});

// ---------- energy ----------
test('energy conservation: battery change = integral of (gen - use) without clamping', () => {
  const g = bareGame();
  place(g, 's1', 'habitat');
  place(g, 's2', 'solar', 3);
  place(g, 's3', 'battery', 3); place(g, 's4', 'battery', 3); place(g, 's5', 'battery', 3);
  g.state.resources.energy = 300;
  let integral = 0, start = g.state.resources.energy;
  for (let i = 0; i < 96 * 2; i++) {
    g.tick(TIME.STEP);
    const e = g.state.resources.energy;
    assert.ok(e > 0 && e < 600, 'test must not clamp');
    assert.equal(g.state.over, null);
    integral += (g.state.rates.energyGen - g.state.rates.energyUse) * TIME.STEP;
  }
  near(g.state.resources.energy - start, integral, 1e-6, 'energy balance');
});

test('energy: load shedding order, hysteresis and restore (no flicker)', () => {
  const g = bareGame();
  place(g, 's1', 'habitat'); place(g, 's2', 'moxie'); place(g, 's3', 'greenhouse'); place(g, 's4', 'extractor');
  place(g, 's5', 'solar', 3); place(g, 's6', 'battery');
  g.state.resources.energy = 10;
  g.state.t = 0.75; // sunset
  const ev = [];
  for (let i = 0; i < 96 * 3; i++) { g.tick(TIME.STEP); ev.push(...g.drainEvents()); }
  const un = ev.filter((e) => e.type === 'module.unpowered').map((e) => e.slotId);
  assert.deepEqual(un.slice(0, 3), ['s3', 's4', 's2'], 'shed order greenhouse -> extractor -> moxie');
  assert.ok(ev.some((e) => e.type === 'science.panel' && e.id === 'nightPower'));
  const transitions = ev.filter((e) => e.type === 'module.unpowered' || e.type === 'module.restored').length;
  assert.ok(transitions < 40, `too many power transitions in 3 sols: ${transitions}`);
  // zero battery capacity: loads run only while generation covers them
  const z = bareGame();
  place(z, 's1', 'habitat'); place(z, 's2', 'solar');
  z.state.resources.energy = 0; z.state.t = 1.0;
  z.tick(TIME.STEP);
  assert.equal(z.state.slots[0].module.powered, false, 'habitat shed at night with no battery');
  z.tick(0.5);
  assert.equal(z.state.slots[0].module.powered, true, 'habitat back at noon');
});

// ---------- actions ----------
test('actions: costs, errors and rules', () => {
  const g = createGame({ seed: 5 });
  const s = g.state;
  s.events.auto = false;
  assert.deepEqual(g.dispatch({ type: 'nope' }), { ok: false, reason: 'err.unknownAction' });
  assert.deepEqual(g.dispatch({ type: 'toString' }), { ok: false, reason: 'err.unknownAction' });
  assert.equal(g.dispatch({ type: 'build', slotId: 's99', moduleType: 'solar' }).reason, 'err.noSuchSlot');
  assert.equal(g.dispatch({ type: 'build', slotId: 's6', moduleType: 'solar' }).reason, 'err.slotOccupied');
  assert.equal(g.dispatch({ type: 'build', slotId: 's1', moduleType: 'x' }).reason, 'err.unknownModule');
  assert.equal(g.dispatch({ type: 'build', slotId: 's1', moduleType: 'reactor' }).reason, 'err.locked');
  assert.equal(g.dispatch({ type: 'build', slotId: 's1', moduleType: 'habitat' }).reason, 'err.notEnoughRegolith');
  assert.equal(g.dispatch({ type: 'toggle', slotId: 's6', enabled: false }).reason, 'err.cannotDisable');
  assert.equal(g.dispatch({ type: 'clean', slotId: 's6' }).reason, 'err.notSolar');
  assert.equal(g.dispatch({ type: 'clean', slotId: 's1' }).reason, 'err.slotEmpty');
  assert.equal(g.dispatch({ type: 'demolish', slotId: 's6' }).reason, 'err.busy');
  assert.equal(g.dispatch({ type: 'assign', colonistId: 'zz', slotId: 's7' }).reason, 'err.noSuchColonist');
  const p0 = s.resources.parts;
  assert.ok(g.dispatch({ type: 'build', slotId: 's1', moduleType: 'moxie' }).ok);
  assert.equal(s.resources.parts, p0 - 12);
  assert.equal(s.slots[0].module.status, 'building');
  assert.equal(g.dispatch({ type: 'upgrade', slotId: 's1' }).reason, 'err.busy');
  const opts = selectors.buildOptions(s, 's2');
  assert.equal(opts.find((o) => o.type === 'reactor').reason, 'err.locked');
  assert.equal(opts.find((o) => o.type === 'solar').ok, true);
  g.tick(2.01);
  const ev = g.drainEvents();
  assert.ok(ev.some((e) => e.type === 'build.done' && e.slotId === 's1' && e.level === 1));
  assert.ok(ev.some((e) => e.type === 'science.panel' && e.id === 'moxieEnergy'));
  // assign, one per module
  const [a, b] = s.colonists;
  assert.ok(g.dispatch({ type: 'assign', colonistId: a.id, slotId: 's1' }).ok);
  assert.equal(a.location, 'module');
  assert.equal(g.dispatch({ type: 'assign', colonistId: b.id, slotId: 's1' }).reason, 'err.busy');
  assert.ok(g.dispatch({ type: 'assign', colonistId: a.id, slotId: null }).ok);
  assert.equal(a.location, 'habitat');
  // upgrade and demolish refund (50% of everything spent, rounded down)
  s.resources.parts = 100;
  assert.ok(g.dispatch({ type: 'upgrade', slotId: 's1' }).ok);
  assert.equal(s.slots[0].module.status, 'upgrading');
  assert.equal(s.slots[0].module.level, 1);
  const before = s.resources.parts;
  assert.ok(g.dispatch({ type: 'demolish', slotId: 's1' }).ok);
  assert.equal(s.resources.parts, before + Math.floor((12 + 16) / 2));
  // clean (the engineer on base makes it twice as fast)
  s.slots[6].module.dust = 0.3;
  assert.ok(g.dispatch({ type: 'clean', slotId: 's7' }).ok);
  g.tick(0.21);
  assert.equal(s.slots[6].module.dust < 0.01 && s.slots[6].module.status === 'ok', true, 'panel cleaned');
  assert.equal(selectors.upgradeInfo(s, 's7').nextLevel, 2);
  assert.equal(selectors.upgradeInfo(s, 's1'), null);
});

test('greenhouse grows and the crop dies without power', () => {
  const g = bareGame();
  place(g, 's1', 'habitat', 3); place(g, 's2', 'solar', 3); place(g, 's3', 'battery', 3);
  const gh = place(g, 's4', 'greenhouse');
  g.state.resources.energy = 200;
  g.tick(3.1);
  assert.ok(gh.growth > 0.99, 'grown in 3 sols');
  assert.ok(g.dispatch({ type: 'toggle', slotId: 's4', enabled: false }).ok);
  g.drainEvents();
  g.tick(1.05);
  const ev = g.drainEvents();
  assert.equal(gh.growth, 0);
  assert.ok(ev.some((e) => e.type === 'alert' && e.key === 'alert.cropsDied'));
  assert.ok(ev.some((e) => e.type === 'science.panel' && e.id === 'cropsNeedLight'));
});

// ---------- professions ----------
test('professions: starting crew, matching bonus, physician ALARA', () => {
  const g = bareGame();
  assert.deepEqual(g.state.colonists.map((c) => c.profession).sort(), ['botanist', 'engineer', 'geologist', 'medic']);
  place(g, 's1', 'habitat', 3); place(g, 's2', 'reactor', 3); place(g, 's3', 'battery', 3);
  place(g, 's4', 'moxie'); place(g, 's5', 'moxie'); place(g, 's6', 'greenhouse', 1, { growth: 1 }); place(g, 's7', 'solar');
  g.state.resources.energy = 100;
  assert.ok(g.dispatch({ type: 'assign', colonistId: colonist(g, 'engineer').id, slotId: 's4' }).ok);
  assert.ok(g.dispatch({ type: 'assign', colonistId: colonist(g, 'medic').id, slotId: 's5' }).ok);
  assert.ok(g.dispatch({ type: 'assign', colonistId: colonist(g, 'botanist').id, slotId: 's6' }).ok);
  near(selectors.moduleRates(g.state, 's4').o2, 4 * (1 + PROFESSION_BONUS), 1e-9, 'engineer on moxie');
  near(selectors.moduleRates(g.state, 's5').o2, 4 * (1 + STAFF_BONUS), 1e-9, 'medic on moxie');
  near(selectors.moduleRates(g.state, 's6').food, 30 * C.CROP_YIELD_KG_M2_SOL * (1 + PROFESSION_BONUS), 1e-9, 'botanist on greenhouse');
});

// ---------- dust storms ----------
test('events: dust storm tau ramp, power drop, dust x10 and observed science', () => {
  const g = bareGame();
  place(g, 's1', 'habitat'); place(g, 's2', 'reactor', 3); place(g, 's3', 'battery', 3);
  const panel = place(g, 's4', 'solar');
  g.state.events.scheduled.push({ atT: 1, kind: 'dustGlobal', params: { sols: 6, tauPeak: 10.8 } });
  const solar = () => { let e = 0; for (let i = 0; i < 96; i++) { g.tick(TIME.STEP); e += selectors.moduleRates(g.state, 's4').gen * TIME.STEP; } return e; };
  g.tick(1.02 - g.state.t);
  const ev0 = g.drainEvents();
  const start = evOf(ev0, 'event.start', 'dustGlobal')[0];
  assert.ok(start && start.tauPeak === 10.8 && Math.abs(start.endsAt - 7) < 0.02, 'event.start dustGlobal');
  assert.ok(ev0.some((e) => e.type === 'science.panel' && e.id === 'globalStorm'));
  assert.equal(g.state.env.storm.kind, 'global');
  g.tick(0.5);
  near(g.state.env.tau, C.TAU_CLEAR + (10.8 - C.TAU_CLEAR) * 0.5, 0.03, 'tau halfway up the 1-sol ramp');
  g.tick(1.5 - (g.state.t - Math.floor(g.state.t)) % 1); // to t = 3.0 (on the plateau)
  assert.ok(Math.abs(g.state.env.tau - 10.8) < 1e-9, `tau on the plateau: ${g.state.env.tau}`);
  const dust0 = panel.dust;
  const eStorm = solar();
  near((panel.dust - dust0), C.DUST_RATE_PER_SOL * C.DUST_STORM_MULT.global, 0.02, 'dust x10 in a global storm');
  const clearRef = 100 * C.SOLAR_YIELD_CLEAR_KWH_M2_SOL * (1 - panel.dust);
  near(eStorm, clearRef * 22 / 645, 0.03, 'storm-sol solar energy');
  g.drainEvents();
  const sci0 = g.state.resources.science;
  g.tick(7.05 - g.state.t);
  const ev = g.drainEvents();
  assert.equal(g.state.env.storm, null);
  assert.equal(g.state.env.tau, C.TAU_CLEAR);
  const end = evOf(ev, 'event.end', 'dustGlobal')[0];
  assert.ok(end && end.science === EVENTS.observedScience, 'event.end with science');
  assert.ok(g.state.resources.science - sci0 >= EVENTS.observedScience - 1e-9);
  // regional: 0.5-sol ramp, x5 dust, panel dustStorm
  g.state.events.scheduled.push({ atT: g.state.t, kind: 'dustRegional', params: { sols: 3, tauPeak: 3 } });
  g.tick(0.25 + TIME.STEP);
  near(g.state.env.tau, C.TAU_CLEAR + (3 - C.TAU_CLEAR) * 0.5, 0.06, 'regional tau halfway up the 0.5-sol ramp');
  assert.ok(g.drainEvents().some((e) => e.type === 'science.panel' && e.id === 'dustStorm'));
});

test('events: a global storm forces shedding; a base with 2 batteries and O2 stock survives it', () => {
  // early base: level-1 habitat, 4 panels, 2 batteries, MOXIE, greenhouse; a typical storm (tau 9, 8 sols)
  const base = () => {
    const g = bareGame(11);
    place(g, 's1', 'habitat'); for (const id of ['s2', 's3', 's4', 's9']) place(g, id, 'solar');
    place(g, 's5', 'battery'); place(g, 's6', 'battery'); place(g, 's7', 'moxie'); place(g, 's8', 'greenhouse', 1, { growth: 1 });
    Object.assign(g.state.resources, { energy: 120, o2: 40, water: 200, food: 100 });
    g.state.events.scheduled.push({ atT: 1, kind: 'dustGlobal', params: { sols: 8, tauPeak: 9 } });
    return g;
  };
  // the player sheds MOXIE and the greenhouse when the storm starts and cleans the panels once
  const g = base();
  g.tick(1.05);
  assert.ok(g.state.env.storm, 'storm on');
  assert.ok(g.state.env.tau > C.TAU_CLEAR, 'tau ramping up');
  g.dispatch({ type: 'toggle', slotId: 's7', enabled: false });
  g.dispatch({ type: 'toggle', slotId: 's8', enabled: false });
  g.tick(4);
  for (const id of ['s2', 's3', 's4', 's9']) g.dispatch({ type: 'clean', slotId: id });
  g.tick(6);
  assert.equal(g.state.over, null, `lost: ${g.state.over?.reason}`);
  assert.ok(g.state.resources.o2 < 20, 'the O2 stock carried the crew');
  // a tau-10.8, 10-sol storm with a level-2 habitat and no reactor is too much for 2 small batteries
  const h = base();
  h.state.slots[0].module.level = 2;
  h.state.events.scheduled[0].params = { sols: 10, tauPeak: 10.8 };
  h.state.resources.o2 = 80;
  h.tick(1.05);
  h.dispatch({ type: 'toggle', slotId: 's7', enabled: false });
  h.dispatch({ type: 'toggle', slotId: 's8', enabled: false });
  h.tick(11);
  assert.equal(h.state.over?.reason, 'blackout');
});

test('events: dust devil, marsquake, failure payloads and panels', () => {
  const g = bareGame();
  place(g, 's1', 'habitat'); place(g, 's2', 'reactor'); place(g, 's3', 'battery', 3);
  const p = place(g, 's4', 'solar', 1, { dust: 0.4 }); place(g, 's5', 'moxie');
  g.state.resources.energy = 100;
  const sci0 = g.state.resources.science;
  g.state.events.scheduled.push({ atT: 0.5, kind: 'dustDevil' }, { atT: 0.6, kind: 'marsquake' }, { atT: 0.7, kind: 'failure', params: { slotId: 's5' } });
  g.tick(1);
  const ev = g.drainEvents();
  near(p.dust, 0.4 * (1 - EVENTS.dustDevil.removes) + 0.5 * C.DUST_RATE_PER_SOL, 0.01, 'dust devil halves the dust');
  assert.equal(evOf(ev, 'event.start', 'dustDevil')[0].slotId, 's4');
  assert.ok(evOf(ev, 'event.end', 'marsquake')[0].science === EVENTS.marsquake.science);
  assert.equal(evOf(ev, 'event.start', 'failure')[0].slotId, 's5');
  assert.equal(g.state.slots[4].module.status, 'broken');
  for (const id of ['cleaningEvent', 'marsquake', 'equipmentFailure']) assert.ok(ev.some((e) => e.type === 'science.panel' && e.id === id), id);
  assert.ok(g.state.resources.science - sci0 >= EVENTS.marsquake.science + EVENTS.observedScience);
  // a failure never hits a habitat, a battery or a shelter
  const f = bareGame();
  place(f, 's1', 'habitat'); place(f, 's2', 'battery'); place(f, 's3', 'shelter');
  for (let i = 0; i < 20; i++) f.state.events.scheduled.push({ atT: 0.4 + i * 0.01, kind: 'failure' });
  f.tick(1);
  assert.ok(f.state.slots.every((sl) => !sl.module || sl.module.status === 'ok'));
});

// ---------- repair ----------
test('repair: broken module stops, repair costs parts, engineer doubles the speed, event.end', () => {
  const setup = () => {
    const g = bareGame();
    place(g, 's1', 'habitat'); place(g, 's2', 'reactor'); place(g, 's3', 'battery', 3); place(g, 's4', 'moxie');
    g.state.resources.energy = 100;
    g.state.events.scheduled.push({ atT: 0.6, kind: 'failure', params: { slotId: 's4' } });
    g.tick(0.15);
    return g;
  };
  const g = setup();
  assert.equal(g.dispatch({ type: 'repair', slotId: 's4' }).reason, 'err.notBroken');
  assert.equal(g.dispatch({ type: 'repair', slotId: 's9' }).reason, 'err.slotEmpty');
  g.tick(0.25);
  const m = g.state.slots[3].module;
  assert.equal(m.status, 'broken');
  assert.equal(selectors.moduleRates(g.state, 's4').o2, 0, 'broken MOXIE makes no O2');
  g.state.resources.parts = 2;
  assert.equal(g.dispatch({ type: 'repair', slotId: 's4' }).reason, 'err.notEnoughParts');
  g.state.resources.parts = 10;
  assert.ok(g.dispatch({ type: 'repair', slotId: 's4' }).ok);
  assert.equal(g.state.resources.parts, 10 - EVENTS.failure.repairParts);
  assert.equal(m.status, 'repairing');
  g.drainEvents();
  g.tick(EVENTS.failure.repairSols / 2 + 0.02); // engineer on base: twice as fast
  assert.equal(m.status, 'ok');
  const end = evOf(g.drainEvents(), 'event.end', 'failure')[0];
  assert.ok(end && end.slotId === 's4' && end.science === EVENTS.observedScience);
  // without the engineer on base: full repairSols
  const h = setup();
  h.state.resources.energy = 100;
  assert.ok(h.dispatch({ type: 'startExpedition', site: 'minerals', colonistId: colonist(h, 'engineer').id }).ok);
  h.tick(0.25);
  assert.ok(h.dispatch({ type: 'repair', slotId: 's4' }).ok);
  h.tick(EVENTS.failure.repairSols / 2 + 0.02);
  assert.equal(h.state.slots[3].module.status, 'repairing');
  h.tick(EVENTS.failure.repairSols / 2);
  assert.equal(h.state.slots[3].module.status, 'ok');
});

// ---------- solar particle events ----------
const SEVERE = DONKI_EVENTS.find((e) => e.severity === 'severe');
const MODERATE = DONKI_EVENTS.find((e) => e.severity === 'moderate');
function speRun({ shelter, totalMsv = 60, tech = [] }) {
  const g = fortress(21);
  g.state.events.auto = false;
  g.state.tech.unlocked.push(...tech);
  assert.ok(g.dispatch({ type: 'startExpedition', site: 'minerals', colonistId: colonist(g, 'geologist').id }).ok);
  if (shelter) assert.ok(g.dispatch({ type: 'setShelter', on: true }).ok);
  g.state.events.scheduled.push({ atT: 1, kind: 'spe', params: { donkiId: SEVERE.id, totalMsv } });
  let doseBy = null, ev = [];
  for (let i = 0; i < 96 * 3; i++) {
    g.tick(TIME.STEP);
    ev.push(...g.drainEvents());
    if (g.state.env.spe) doseBy = { ...g.state.env.spe.doseBy };
  }
  return { g, doseBy, ev };
}
test('SPE: dose by location (expedition / habitat / shelter) with ALARA, payloads and panels', () => {
  const T = 60;
  const open = speRun({ shelter: false, totalMsv: T });
  const geo = colonist(open.g, 'geologist'), eng = colonist(open.g, 'engineer');
  near(open.doseBy[geo.id], T * C.SHIELD_SPE.expedition, 0.001, 'expedition dose');
  near(open.doseBy[eng.id], T * C.SHIELD_SPE.habitat * C.ALARA_FACTOR, 0.001, 'habitat dose');
  const warn = evOf(open.ev, 'event.start', 'spe').find((e) => e.phase === 'warning');
  const act = evOf(open.ev, 'event.start', 'spe').find((e) => e.phase === 'active');
  for (const k of ['donkiId', 'classType', 'peakTime', 'link', 'severity', 'startsAt']) assert.ok(warn[k] !== undefined, `payload ${k}`);
  assert.equal(warn.donkiId, SEVERE.id);
  assert.ok(act && Math.abs(act.t - warn.startsAt) <= TIME.STEP + 1e-9, 'active phase starts at startsAt');
  const end = evOf(open.ev, 'event.end', 'spe')[0];
  near(end.maxDoseMsv, T, 0.001, 'maxDoseMsv = the expedition member');
  for (const id of ['speWarning', 'speSevere']) assert.ok(open.ev.some((e) => e.type === 'science.panel' && e.id === id), id);
  const sh = speRun({ shelter: true, totalMsv: T });
  near(sh.doseBy[colonist(sh.g, 'engineer').id], T * C.SHIELD_SPE.shelter * C.ALARA_FACTOR, 0.001, 'shelter dose');
  assert.ok(sh.ev.some((e) => e.type === 'science.panel' && e.id === 'alara'));
  // pressurized rover halves the expedition dose
  const pr = speRun({ shelter: false, totalMsv: T, tech: ['spaceWeather', 'pressurizedRover'] });
  near(pr.doseBy[colonist(pr.g, 'geologist').id], T * 0.5, 0.001, 'pressurized rover');
  // a moderate event lasts moderateSols and ends with the speAtmosphere panel
  const m = fortress(22);
  m.state.events.auto = false;
  m.state.events.scheduled.push({ atT: 1, kind: 'spe', params: { donkiId: MODERATE.id } });
  m.tick(1.01);
  const spe = m.state.env.spe;
  assert.equal(spe.severity, 'moderate');
  near(spe.endsAt - spe.startsAt, EVENTS.spe.moderateSols, 1e-9, 'moderate duration');
  assert.ok(spe.totalMsv >= C.SPE_MODERATE_MSV[0] && spe.totalMsv <= C.SPE_MODERATE_MSV[1]);
  m.tick(3);
  assert.ok(m.drainEvents().some((e) => e.type === 'science.panel' && e.id === 'speAtmosphere'));
});

test('SPE: warning time = warning - comm delay, 1 sol with spaceWeather, never below the minimum', () => {
  const g = fortress(23);
  g.state.events.auto = false;
  const H = C.SOL_HOURS * 60;
  // t near 0: delay 4 min; t = 12.45: delay ~20 min (DESIGN 3), just before the conjunction blackout (D.2)
  g.state.events.scheduled.push({ atT: 0.31, kind: 'spe', params: { donkiId: SEVERE.id } });
  g.tick(0.03);
  const s1 = g.state.env.spe;
  near(s1.startsAt - g.state.t, EVENTS.spe.warningSols - g.state.env.commDelayMin / H, 0.12, 'warning at short delay');
  const w1 = selectors.speWarningSols(g.state);
  g.tick(12.45 - g.state.t);
  const D = g.state.env.commDelayMin;
  assert.ok(D > 19.9 && !g.state.env.comm.blackout);
  const w2 = selectors.speWarningSols(g.state);
  near(w2, EVENTS.spe.warningSols - D / H, 0.001, 'warning at long delay');
  assert.ok(w2 < w1, 'Mars far away -> less warning');
  g.state.tech.unlocked.push('spaceWeather');
  near(selectors.speWarningSols(g.state), EVENTS.spe.warningSolsTech - D / H, 0.001, 'warning with the spaceWeather tech');
  const tFire = g.state.t;
  g.state.events.scheduled.push({ atT: tFire, kind: 'spe', params: { donkiId: SEVERE.id } });
  g.tick(TIME.STEP);
  near(g.state.env.spe.startsAt - tFire, EVENTS.spe.warningSolsTech - D / H, 0.01, 'tech warning applied to the event');
  const fake = { ...g.state, tech: { unlocked: [] }, env: { ...g.state.env, commDelayMin: 500 } };
  assert.equal(selectors.speWarningSols(fake), EVENTS.spe.minWarningSols);
});

test('SPE: sheltering in time keeps doses low; 4-6 ignored severe storms retire a colonist', () => {
  // every colonist starts as a sol-200 veteran (transit + 200 sols of habitat GCR with a physician on base)
  const vet = C.TRANSIT_DOSE_MSV + 200 * C.GCR_SURFACE_MSV_PER_SOL * C.SHIELD_GCR.habitat[0] * C.ALARA_FACTOR;
  let retiredOpen = 0, retiredShelter = 0, maxShelterSpe = 0, stormsToRetire = [];
  for (let seed = 1; seed <= 6; seed++) {
    for (const shelter of [false, true]) {
      const g = fortress(100 + seed);
      g.state.events.auto = false;
      for (const c of g.state.colonists) c.dose = vet;
      for (let k = 0; k < 6; k++) g.state.events.scheduled.push({ atT: 1 + 3 * k, kind: 'spe', params: { donkiId: SEVERE.id } });
      let n = 0, retiredAfter = null;
      for (let i = 0; i < 20 * 20; i++) {
        if (shelter) g.dispatch({ type: 'setShelter', on: !!g.state.env.spe });
        g.tick(0.05);
        for (const e of g.drainEvents()) {
          if (e.type === 'event.end' && e.kind === 'spe') { n++; if (shelter) maxShelterSpe = Math.max(maxShelterSpe, e.maxDoseMsv); }
          if (e.type === 'colonist.retired' && retiredAfter === null) retiredAfter = n + 1;
        }
      }
      const retired = g.state.colonists.some((c) => c.status === 'retired');
      if (shelter) retiredShelter += retired; else { retiredOpen += retired; if (retiredAfter) stormsToRetire.push(retiredAfter); }
    }
  }
  assert.ok(retiredOpen >= 5, `ignoring 6 severe storms retired someone in only ${retiredOpen}/6 seeds`);
  assert.ok(stormsToRetire.every((k) => k >= 4 && k <= 6), `storms to retire: ${stormsToRetire}`);
  assert.equal(retiredShelter, 0, 'sheltered crews should not retire');
  assert.ok(maxShelterSpe < 0.2 * C.SPE_SEVERE_MSV[1], `sheltered dose per storm ${maxShelterSpe}`);
});

// ---------- shelter ----------
test('shelter: capacity split, assignment kept, construction / cleaning / bonuses / expeditions paused', () => {
  const g = bareGame();
  place(g, 's1', 'habitat', 2); place(g, 's2', 'reactor', 3); place(g, 's3', 'battery', 3);
  place(g, 's4', 'moxie'); place(g, 's5', 'shelter'); const pan = place(g, 's6', 'solar', 1, { dust: 0.3 });
  g.state.resources.energy = 100; g.state.resources.parts = 100;
  // 6 colonists, 4 shelter places
  for (let i = 0; i < 2; i++) g.state.colonists.push({ ...g.state.colonists[0], id: `x${i}`, name: `X${i}`, profession: null, dose: 400 + i });
  const eng = colonist(g, 'engineer');
  assert.ok(g.dispatch({ type: 'assign', colonistId: eng.id, slotId: 's4' }).ok);
  assert.ok(g.dispatch({ type: 'build', slotId: 's7', moduleType: 'solar' }).ok);
  assert.ok(g.dispatch({ type: 'clean', slotId: 's6' }).ok);
  const o2Staffed = selectors.moduleRates(g.state, 's4').o2;
  assert.ok(g.dispatch({ type: 'setShelter', on: true }).ok);
  assert.equal(g.state.sheltering, true);
  const locs = g.state.colonists.map((c) => c.location);
  assert.equal(locs.filter((l) => l === 'shelter').length, 4);
  assert.equal(locs.filter((l) => l === 'habitat').length, 2);
  assert.equal(eng.assignedTo, 's4', 'assignment kept');
  assert.ok(o2Staffed > 4 && selectors.moduleRates(g.state, 's4').o2 === 4, 'no staff bonus while sheltering');
  assert.equal(g.dispatch({ type: 'startExpedition', site: 'regolith', colonistId: colonist(g, 'geologist').id }).reason, 'err.sheltering');
  const ev = g.drainEvents();
  assert.ok(ev.some((e) => e.type === 'science.panel' && e.id === 'alara'));
  g.tick(2);
  assert.equal(g.state.slots[6].module.status, 'building', 'construction paused');
  assert.equal(g.state.slots[6].module.progress, 0);
  assert.equal(pan.status, 'cleaning', 'cleaning paused');
  assert.ok(g.dispatch({ type: 'setShelter', on: false }).ok);
  assert.equal(eng.location, 'module');
  assert.ok(g.state.colonists.every((c) => c.location !== 'shelter'));
  g.tick(1.05);
  assert.equal(g.state.slots[6].module.status, 'ok', 'construction resumed');
  assert.equal(pan.status, 'ok', 'cleaning resumed');
});

// ---------- tech ----------
test('tech: research errors, event, panel and techOptions', () => {
  const g = bareGame();
  const s = g.state;
  assert.equal(g.dispatch({ type: 'research', techId: 'warp' }).reason, 'err.unknownTech');
  assert.equal(g.dispatch({ type: 'research', techId: 'eds' }).reason, 'err.notEnoughScience');
  s.resources.science = 500;
  assert.equal(g.dispatch({ type: 'research', techId: 'fission' }).reason, 'err.missingPrereq');
  assert.ok(g.dispatch({ type: 'research', techId: 'eds' }).ok);
  assert.equal(s.resources.science, 500 - TECHS.eds.cost);
  assert.equal(g.dispatch({ type: 'research', techId: 'eds' }).reason, 'err.alreadyResearched');
  const ev = g.drainEvents();
  assert.ok(ev.some((e) => e.type === 'tech.unlocked' && e.techId === 'eds'));
  assert.ok(ev.some((e) => e.type === 'science.panel' && e.id === 'tech.eds'));
  const opts = selectors.techOptions(s);
  assert.equal(opts.length, 8);
  const f = opts.find((o) => o.id === 'fission');
  assert.deepEqual([f.cost, f.requires, f.unlocked, f.ok], [70, ['eds'], false, true]);
  assert.equal(opts.find((o) => o.id === 'eds').unlocked, true);
  assert.equal(opts.find((o) => o.id === 'bioregen').reason, 'err.missingPrereq');
  assert.equal(selectors.score(s) >= SCORE.perTech, true);
});

test('tech effects: eds, waterRecycling, regolithPrinting, plantHabitat, bioregen, pressurizedRover, fission', () => {
  const g = bareGame();
  const s = g.state;
  s.resources.science = 1000; s.resources.parts = 500; s.resources.regolith = 500; s.resources.energy = 100;
  place(g, 's1', 'habitat', 2); place(g, 's2', 'reactor', 3); place(g, 's3', 'battery', 3);
  const pan = place(g, 's4', 'solar'); const gh = place(g, 's5', 'greenhouse', 1, { growth: 1 }); place(g, 's9', 'shelter', 2);
  // eds: dust x0.2
  g.tick(1); const d1 = pan.dust; pan.dust = 0;
  g.dispatch({ type: 'research', techId: 'eds' }); g.tick(1);
  near(pan.dust, d1 * 0.2, 0.01, 'eds dust');
  // waterRecycling: crew water at 2% loss
  const w0 = s.rates.waterUse;
  g.dispatch({ type: 'research', techId: 'waterRecycling' });
  near(s.rates.waterUse - 30 * C.GH_WATER_KG_M2_SOL, 4 * C.WATER_GROSS_PER_CREW_SOL * (1 - C.WATER_RECYCLE_TECH), 1e-6, 'recycling 98%');
  assert.ok(s.rates.waterUse < w0);
  // regolithPrinting: parts x0.7 rounded up; level 3 habitat and shelter need it
  assert.equal(selectors.upgradeInfo(s, 's1').reason, 'err.locked');
  assert.equal(selectors.upgradeInfo(s, 's9').reason, 'err.locked');
  const moxCost = selectors.buildOptions(s, 's6').find((o) => o.type === 'moxie').cost.parts;
  assert.equal(moxCost, 12);
  g.dispatch({ type: 'research', techId: 'regolithPrinting' });
  assert.equal(selectors.buildOptions(s, 's6').find((o) => o.type === 'moxie').cost.parts, Math.ceil(12 * 0.7));
  assert.equal(selectors.upgradeInfo(s, 's1').ok, true);
  assert.equal(selectors.upgradeInfo(s, 's1').cost.parts, Math.ceil(26 * 0.7));
  const p0 = s.resources.parts;
  assert.ok(g.dispatch({ type: 'build', slotId: 's6', moduleType: 'moxie' }).ok);
  assert.equal(p0 - s.resources.parts, 9);
  // plantHabitat: food x1.5
  const f0 = selectors.moduleRates(s, 's5').food;
  g.dispatch({ type: 'research', techId: 'plantHabitat' });
  near(selectors.moduleRates(s, 's5').food, f0 * 1.5, 1e-9, 'plant habitat food');
  // bioregen: greenhouse O2 = area / 22.5 * O2_PER_CREW * growth
  assert.equal(selectors.moduleRates(s, 's5').o2, 0);
  g.dispatch({ type: 'research', techId: 'bioregen' });
  gh.growth = 0.5;
  near(selectors.moduleRates(s, 's5').o2, 30 / C.CROP_M2_PER_PERSON_O2 * C.O2_PER_CREW_SOL * 0.5, 1e-9, 'bioregen O2');
  // pressurizedRover: 2 rovers, GCR on expedition x0.5
  assert.equal(selectors.roversFree(s), 1);
  g.dispatch({ type: 'research', techId: 'spaceWeather' });
  g.dispatch({ type: 'research', techId: 'pressurizedRover' });
  assert.equal(selectors.roversFree(s), 2);
  assert.ok(g.dispatch({ type: 'startExpedition', site: 'minerals', colonistId: colonist(g, 'geologist').id }).ok);
  assert.ok(g.dispatch({ type: 'startExpedition', site: 'minerals', colonistId: colonist(g, 'botanist').id }).ok);
  assert.equal(selectors.roversFree(s), 0);
  const geo = colonist(g, 'geologist'), dg = geo.dose;
  g.tick(1);
  near(geo.dose - dg, C.GCR_SURFACE_MSV_PER_SOL * 0.5, 0.01, 'expedition GCR with the pressurized rover');
  // fission: reactor unlocked
  assert.equal(selectors.buildOptions(s, 's7').find((o) => o.type === 'reactor').reason, 'err.locked');
  g.dispatch({ type: 'research', techId: 'fission' });
  s.slots[1].module = null;
  assert.equal(selectors.buildOptions(s, 's7').find((o) => o.type === 'reactor').ok, true);
  assert.equal(s.tech.unlocked.length, 8);
});

// ---------- expeditions ----------
test('expeditions: errors, departure, reward with geologist, done event, panel', () => {
  const g = createGame({ seed: 31 });
  const s = g.state;
  s.events.auto = false;
  const geo = colonist(g, 'geologist'), eng = colonist(g, 'engineer');
  s.resources.energy = 30;
  assert.equal(g.dispatch({ type: 'startExpedition', site: 'moon', colonistId: geo.id }).reason, 'err.unknownSite');
  assert.equal(g.dispatch({ type: 'startExpedition', site: 'regolith', colonistId: 'zz' }).reason, 'err.noSuchColonist');
  s.resources.energy = 3;
  assert.equal(g.dispatch({ type: 'startExpedition', site: 'regolith', colonistId: geo.id }).reason, 'err.notEnoughEnergy');
  assert.equal(selectors.expeditionOptions(s).find((o) => o.site === 'regolith').reason, 'err.notEnoughEnergy');
  s.resources.energy = 30;
  const opt = selectors.expeditionOptions(s).find((o) => o.site === 'regolith');
  assert.deepEqual([opt.sols, opt.energy, opt.reward, opt.science, opt.ok], [1, 6, { regolith: 30 }, 2, true]);
  assert.ok(g.dispatch({ type: 'assign', colonistId: geo.id, slotId: 's7' }).ok);
  assert.ok(g.dispatch({ type: 'startExpedition', site: 'regolith', colonistId: geo.id }).ok);
  assert.equal(s.resources.energy, 30 - EXPEDITIONS.regolith.energy);
  assert.equal(geo.location, 'expedition');
  assert.equal(geo.assignedTo, null, 'left the module');
  assert.equal(s.slots[6].module.staff.length, 0);
  assert.equal(g.dispatch({ type: 'startExpedition', site: 'ice', colonistId: geo.id }).reason, 'err.colonistBusy');
  assert.equal(g.dispatch({ type: 'startExpedition', site: 'ice', colonistId: eng.id }).reason, 'err.noRover');
  assert.equal(selectors.roversFree(s), 0);
  const e = s.expeditions[0];
  assert.deepEqual(Object.keys(e).filter((k) => ['id', 'site', 'colonistId', 'startT', 'endT', 'recalled', 'stuck'].includes(k)).length, 7);
  e.stuck = false;
  const reg0 = s.resources.regolith, sci0 = s.resources.science;
  g.tick(1.02);
  const done = evOf(g.drainEvents(), 'expedition.done')[0];
  assert.ok(done, 'expedition.done');
  assert.deepEqual(done.reward, { regolith: Math.floor(30 * 1.5) }, 'geologist x1.5');
  near(done.science, 2 * 1.5, 1e-9, 'geologist science');
  assert.equal(s.resources.regolith - reg0, 45);
  assert.ok(s.resources.science - sci0 >= 3);
  assert.equal(geo.location, 'habitat');
  assert.equal(s.expeditions.length, 0);
  // ice with a non-geologist: plain reward, panel iceOnMars
  s.resources.energy = 30;
  assert.ok(g.dispatch({ type: 'startExpedition', site: 'ice', colonistId: eng.id }).ok);
  s.expeditions[0].stuck = false;
  const w0 = s.resources.water;
  g.tick(2.02);
  const ev = g.drainEvents();
  assert.deepEqual(evOf(ev, 'expedition.done')[0].reward, { water: 25 });
  assert.ok(ev.some((x) => x.type === 'science.panel' && x.id === 'iceOnMars'));
  assert.ok(s.resources.water > w0 + 20);
  // global storm: no departure, and an expedition out there does not advance
  s.resources.energy = 30;
  assert.ok(g.dispatch({ type: 'startExpedition', site: 'regolith', colonistId: eng.id }).ok);
  s.expeditions[0].stuck = false;
  s.events.scheduled.push({ atT: s.t + 0.2, kind: 'dustGlobal', params: { sols: 2, tauPeak: 6 } });
  g.tick(0.3);
  assert.equal(g.dispatch({ type: 'startExpedition', site: 'regolith', colonistId: geo.id }).reason, 'err.storm');
  g.tick(1);
  assert.equal(s.expeditions.length, 1, 'paused by the storm');
  g.tick(1.7);
  assert.equal(s.expeditions.length, 0, 'back after the storm');
});

test('expeditions: recall (half the elapsed time, proportional reward) and stuck', () => {
  const g = createGame({ seed: 32 });
  const s = g.state;
  s.events.auto = false;
  s.resources.energy = 60;
  const eng = colonist(g, 'engineer');
  assert.ok(g.dispatch({ type: 'startExpedition', site: 'minerals', colonistId: eng.id }).ok);
  const e = s.expeditions[0];
  e.stuck = false;
  g.tick(1.2);
  assert.equal(g.dispatch({ type: 'recallExpedition', id: 'e99' }).reason, 'err.noSuchExpedition');
  assert.ok(g.dispatch({ type: 'recallExpedition', id: e.id }).ok);
  assert.equal(e.recalled, true);
  near(e.endT - s.t, 0.5 * e.elapsed, 1e-9, 'returns in half the elapsed time');
  assert.equal(g.dispatch({ type: 'recallExpedition', id: e.id }).reason, 'err.busy');
  const frac = e.elapsed / 3;
  const p0 = s.resources.parts;
  g.tick(0.62);
  const done = evOf(g.drainEvents(), 'expedition.done')[0];
  assert.ok(done, 'recalled expedition done');
  assert.deepEqual(done.reward, { parts: Math.floor(8 * frac) });
  assert.equal(s.resources.parts - p0, Math.floor(8 * frac));
  // stuck: revealed halfway, +1 sol, panel roverStuck
  s.resources.energy = 60;
  assert.ok(g.dispatch({ type: 'startExpedition', site: 'minerals', colonistId: eng.id }).ok);
  const f = s.expeditions[0];
  f.stuck = true;
  const end0 = f.endT;
  g.tick(1.4);
  assert.equal(evOf(g.drainEvents(), 'expedition.stuck').length, 0);
  g.tick(0.15);
  const ev = g.drainEvents();
  assert.equal(evOf(ev, 'expedition.stuck')[0]?.id, f.id);
  assert.ok(ev.some((x) => x.type === 'science.panel' && x.id === 'roverStuck'));
  near(f.endT, end0 + EXPEDITIONS.stuckSols, 1e-9, 'stuck adds stuckSols');
  g.tick(1.6);
  assert.equal(s.expeditions.length, 1, 'still out (stuck)');
  g.tick(0.9);
  assert.equal(s.expeditions.length, 0, 'back after 4 sols');
  // the stuck draw is ~stuckChance
  let stuck = 0;
  for (let i = 0; i < 400; i++) {
    const h = createGame({ seed: 1000 + i });
    h.state.resources.energy = 30;
    h.dispatch({ type: 'startExpedition', site: 'regolith', colonistId: h.state.colonists[0].id });
    stuck += h.state.expeditions[0].stuck;
  }
  assert.ok(stuck > 400 * EXPEDITIONS.stuckChance * 0.5 && stuck < 400 * EXPEDITIONS.stuckChance * 1.6, `stuck ${stuck}/400`);
});

// ---------- ships ----------
test('ships: manifest, offer, decision, sequential validation and auto-accept', () => {
  const g = createGame({ seed: 41 });
  const s = g.state;
  s.events.auto = false;
  Object.assign(s.resources, { o2: 500, water: 500, food: 500 });
  place(g, 's1', 'habitat', 2); place(g, 's2', 'reactor', 3); // 4 + 8 places, plenty of power
  g.tick(SHIP.intervalSols - SHIP.announceSols - s.t + 0.02);
  let ev = g.drainEvents();
  const inc = evOf(ev, 'ship.incoming')[0];
  assert.ok(inc, 'ship.incoming');
  assert.equal(inc.arrivesAt, SHIP.intervalSols);
  assert.equal(inc.manifest.candidates.length, SHIP.candidates);
  for (const c of inc.manifest.candidates) assert.ok(['engineer', 'botanist', 'medic', 'geologist'].includes(c.profession) && typeof c.name === 'string');
  assert.ok(ev.some((e) => e.type === 'science.panel' && e.id === 'launchWindow'));
  assert.deepEqual(s.ship.manifest, inc.manifest);
  assert.equal(g.dispatch({ type: 'shipDecision', acceptIdx: [0] }).reason, 'err.noShip');
  g.tick(SHIP.intervalSols - s.t + 0.02);
  ev = g.drainEvents();
  const arr = evOf(ev, 'ship.arrived')[0];
  assert.ok(arr && arr.offer.length === 2 && arr.offer.every((o) => o.ok && o.reason === null));
  assert.deepEqual(arr.cargo, SHIP.cargo);
  assert.equal(s.ship.awaitingDecision, true);
  assert.equal(s.ship.nextArrivalT, 2 * SHIP.intervalSols);
  const pick = s.ship.offer[1];
  assert.ok(g.dispatch({ type: 'shipDecision', acceptIdx: [1] }).ok);
  const landed = evOf(g.drainEvents(), 'ship.landed')[0];
  assert.equal(landed.landed.length, 1);
  const c = s.colonists.find((x) => x.id === landed.landed[0]);
  assert.deepEqual([c.name, c.profession], [pick.name, pick.profession]);
  assert.equal(s.ship.awaitingDecision, false);
  assert.equal(s.stats.popPeak, 5);
  // second ship: no decision -> auto-accept after waitSols; only 12 - 5 = 7 places, so all fit
  g.tick(2 * SHIP.intervalSols - s.t + 0.02);
  assert.equal(s.ship.awaitingDecision, true);
  g.tick(SHIP.waitSols * 0.5);
  assert.equal(s.ship.awaitingDecision, true);
  g.tick(SHIP.waitSols * 0.5 + 0.02);
  const auto = evOf(g.drainEvents(), 'ship.landed')[0];
  assert.ok(auto && auto.landed.length === 2, 'auto-accepted');
  // third ship (2 arrived): 3 candidates; habitat room for exactly 1 -> sequential refusal
  s.colonists.push(...[0, 1, 2, 3].map((i) => ({ ...s.colonists[0], id: `y${i}`, name: `Y${i}` })));
  assert.equal(s.colonists.length, 11);
  Object.assign(s.resources, { o2: 2000, water: 2000, food: 2000 });
  g.tick(3 * SHIP.intervalSols - s.t + 0.02);
  assert.equal(s.ship.offer.length, 3);
  assert.ok(g.dispatch({ type: 'shipDecision', acceptIdx: [0, 2] }).ok);
  const seq = evOf(g.drainEvents(), 'ship.landed')[0];
  assert.equal(seq.landed.length, 1);
  assert.deepEqual(seq.refused, [{ idx: 2, reason: 'habitat' }]);
});

test('radiation: career limit retires, ship takes them home', () => {
  const g = createGame({ seed: 8 });
  g.state.events.auto = false;
  const c = g.state.colonists[0];
  c.dose = 599.9;
  g.dispatch({ type: 'assign', colonistId: c.id, slotId: 's7' });
  g.tick(1);
  assert.equal(c.status, 'retired');
  assert.equal(c.assignedTo, null);
  const ev = g.drainEvents();
  assert.ok(ev.some((e) => e.type === 'colonist.retired' && e.colonistId === c.id));
  assert.ok(ev.some((e) => e.type === 'science.panel' && e.id === 'careerLimit'));
  assert.equal(selectors.population(g.state), 3);
  assert.equal(selectors.headcount(g.state), 4);
  g.state.resources.o2 = 500; g.state.resources.food = 500; g.state.resources.water = 500;
  g.tick(26 - g.state.t + 0.01);
  const ship = g.drainEvents().find((e) => e.type === 'ship.arrived');
  assert.ok(ship, 'ship arrived');
  assert.deepEqual(ship.departed, [c.id]);
  assert.ok(!g.state.colonists.includes(c), 'retired colonist left');
  assert.equal(ship.offer.length, 2);
});

test('ship refuses candidates without habitat space', () => {
  const g = createGame({ seed: 9 });
  g.state.events.auto = false;
  g.state.resources.o2 = 500;
  g.tick(26);
  let ev = g.drainEvents();
  const ship = ev.find((e) => e.type === 'ship.arrived');
  assert.deepEqual(ship.offer.map((o) => o.reason), ['habitat', 'habitat']);
  g.tick(SHIP.waitSols + 0.05);
  ev = g.drainEvents();
  assert.deepEqual(ev.find((e) => e.type === 'ship.landed').refused, [{ idx: 0, reason: 'habitat' }, { idx: 1, reason: 'habitat' }]);
  assert.ok(ev.some((e) => e.type === 'science.panel' && e.id === 'shipRefused'));
  assert.equal(g.state.ship.nextArrivalT, 52);
});

// ---------- milestone ----------
test('milestone: self-sufficient after 26 sols with pop >= 12 and balances >= 0, once, +score', () => {
  const g = fortress(51);
  const s = g.state;
  s.events.auto = false;
  Object.assign(s.resources, { o2: 50, water: 50, food: 50 });
  place(g, 's8', 'extractor', 3); place(g, 's9', 'greenhouse', 3, { growth: 1 }); place(g, 's10', 'greenhouse', 3, { growth: 1 });
  place(g, 's11', 'greenhouse', 3, { growth: 1 }); place(g, 's12', 'battery', 3);
  s.tech.unlocked.push('plantHabitat', 'waterRecycling');
  while (s.colonists.length < 12) s.colonists.push({ ...s.colonists[1], id: `z${s.colonists.length}`, name: `Z${s.colonists.length}`, profession: null });
  assert.ok(g.dispatch({ type: 'assign', colonistId: colonist(g, 'engineer').id, slotId: 's4' }).ok);
  const sc0 = selectors.score(s);
  g.tick(20);
  assert.equal(s.stats.selfSufficientAt, null, 'too early');
  g.tick(8);
  const ev = g.drainEvents();
  assert.equal(evOf(ev, 'milestone').length, 1);
  assert.equal(evOf(ev, 'milestone')[0].id, 'selfSufficient');
  assert.ok(s.stats.selfSufficientAt > 25 && s.stats.selfSufficientAt < 28);
  assert.ok(selectors.score(s) >= sc0 + SCORE.selfSufficient);
  g.tick(30);
  assert.equal(evOf(g.drainEvents(), 'milestone').length, 0, 'only once');
  // a sol with a negative balance resets the streak
  const h = fortress(52);
  h.state.events.auto = false;
  h.tick(30);
  assert.equal(h.state.stats.selfSufficientAt, null, 'pop 4 is not a colony');
});

test('game over freezes the game', () => {
  const g = createGame({ seed: 10 });
  g.tick(30);
  assert.ok(g.state.over);
  const t = g.state.t;
  g.tick(5);
  assert.equal(g.state.t, t);
  assert.equal(g.dispatch({ type: 'clean', slotId: 's7' }).reason, 'err.gameOver');
  assert.equal(g.state.over.score, selectors.score(g.state));
});

// ---------- bots ----------
test('bot: idle bot loses between sol 4 and sol 15 (commander)', () => {
  for (const seed of [1, 2, 3]) {
    const { game, lostAt } = runBot(createGame, idleBot, { seed, sols: 40, every: 0.25 });
    assert.ok(lostAt !== null, 'idle bot survived');
    const sol = selectors.getSol(game.state);
    assert.ok(sol >= 4 && sol <= 15, `idle bot lost at sol ${sol}`);
  }
});

let competentRuns = null;
test('bot: competent bot survives 200 sols on commander in >= 16 of 20 seeds', () => {
  competentRuns = [];
  for (let seed = 1; seed <= 20; seed++) {
    const { game, lostAt, log } = runBot(createGame, competentBot, { seed, sols: 200, difficulty: 'commander' });
    competentRuns.push({ seed, lostAt, reason: game.state.over?.reason, popPeak: game.state.stats.popPeak, log });
  }
  const ok = competentRuns.filter((r) => r.lostAt === null).length;
  const fails = competentRuns.filter((r) => r.lostAt !== null).map((r) => `seed ${r.seed}: ${r.reason} at t=${r.lostAt.toFixed(2)}`);
  assert.ok(ok >= 16, `survived ${ok}/20. ${fails.join('; ')}`);
});
test('bot: competent bot reaches population 12 (in >= 12 of 20 seeds) and 8 before sol 90', () => {
  assert.ok(competentRuns, 'needs the survival run');
  const n12 = competentRuns.filter((r) => r.popPeak >= 12).length;
  assert.ok(n12 >= 12, `population 12 reached in ${n12}/20`);
  const late8 = competentRuns.filter((r) => !(r.log.pop8At <= 90)).length;
  assert.ok(late8 <= 4, `${late8} runs reached 8 after sol 90`);
});

let carelessRuns = null;
test('bot: careless bot (never shelters, cleans or repairs) survives 60 sols on cadet in >= 16 of 20 seeds', () => {
  carelessRuns = [];
  for (let seed = 1; seed <= 20; seed++) {
    const { game, lostAt, log } = runBot(createGame, carelessBot, { seed, sols: 60, difficulty: 'cadet' });
    carelessRuns.push({ seed, lostAt, reason: game.state.over?.reason, popPeak: game.state.stats.popPeak, log });
  }
  const ok = carelessRuns.filter((r) => r.lostAt === null).length;
  const fails = carelessRuns.filter((r) => r.lostAt !== null).map((r) => `seed ${r.seed}: ${r.reason} at t=${r.lostAt.toFixed(2)}`);
  assert.ok(ok >= 16, `survived ${ok}/20. ${fails.join('; ')}`);
});

// ---------- story mode (Apêndice C) ----------
const storyGame = (chapter, difficulty = 'commander', seed = 1) => createGame({ mode: 'story', chapter, difficulty, seed });

test('story: creation, first step, storyInfo, colony mode has everything unlocked', () => {
  const col = createGame({ seed: 1 });
  assert.equal(selectors.storyInfo(col.state), null);
  assert.deepEqual(col.state.unlocked.features, ['toggle', 'assign', 'clean', 'ships', 'tech', 'expeditions', 'shelter']);
  assert.equal(col.state.unlocked.techs, null);
  for (const n of [1, 2, 3]) {
    const g = storyGame(n);
    const s = g.state, def = CHAPTERS[n];
    assert.equal(s.mode, 'story');
    assert.equal(s.events.auto, false);
    near(s.t, def.startT, 1e-9, 'startT');
    assert.deepEqual(s.colonists.map((c) => c.name).slice(0, 4), ['Lia Moreira', 'Kenji Tanaka', 'Amara Okafor', 'Tomás Reyes']);
    assert.equal(s.slots.find((x) => x.id === 's6').module.type, 'habitat');
    const ev = g.drainEvents();
    assert.equal(evOf(ev, 'story.step')[0].id, def.steps[0].id);
    const info = selectors.storyInfo(s);
    assert.deepEqual([info.chapter, info.stepIdx, info.total, info.current.id, info.complete], [n, 0, def.steps.length, def.steps[0].id, false]);
    assert.ok(info.steps.every((x) => x.done === false));
    assert.deepEqual(def.intro, [`c${n}.intro1`, `c${n}.intro2`]);
    assert.deepEqual(def.outro, [`c${n}.outro1`]);
  }
  assert.throws(() => createGame({ mode: 'story', chapter: 9 }));
});

test('story: locked features and modules return err.locked (actions and selectors); a step unlocks them', () => {
  const g = storyGame(1);
  const s = g.state;
  g.drainEvents();
  const L = { ok: false, reason: 'err.locked' };
  assert.deepEqual(g.dispatch({ type: 'build', slotId: 's1', moduleType: 'battery' }), L);
  assert.deepEqual(g.dispatch({ type: 'toggle', slotId: 's6', enabled: false }), L);
  assert.deepEqual(g.dispatch({ type: 'assign', colonistId: s.colonists[0].id, slotId: 's6' }), L);
  assert.deepEqual(g.dispatch({ type: 'clean', slotId: 's6' }), L);
  assert.deepEqual(g.dispatch({ type: 'setShelter', on: true }), L);
  assert.deepEqual(g.dispatch({ type: 'research', techId: 'eds' }), L);
  assert.deepEqual(g.dispatch({ type: 'startExpedition', site: 'regolith', colonistId: s.colonists[0].id }), L);
  assert.deepEqual(g.dispatch({ type: 'shipDecision', acceptIdx: [] }), L);
  const opts = selectors.buildOptions(s, 's1');
  assert.equal(opts.find((o) => o.type === 'battery').reason, 'err.locked');
  assert.equal(opts.find((o) => o.type === 'solar').ok, true);
  assert.ok(selectors.techOptions(s).every((o) => o.ok === false && o.reason === 'err.locked'));
  assert.ok(selectors.expeditionOptions(s).every((o) => o.ok === false && o.reason === 'err.locked'));
  // build the panel: step c1.solar done unlocks the battery
  assert.ok(g.dispatch({ type: 'build', slotId: 's1', moduleType: 'solar' }).ok);
  g.tick(1.05);
  const ev = g.drainEvents();
  assert.ok(ev.some((e) => e.type === 'objective.done' && e.id === 'c1.solar'));
  assert.ok(ev.some((e) => e.type === 'science.panel' && e.id === 'nightPower'));
  assert.equal(evOf(ev, 'story.step')[0].id, 'c1.battery');
  assert.ok(s.unlocked.modules.includes('battery'));
  assert.equal(selectors.buildOptions(s, 's2').find((o) => o.type === 'battery').ok, true);
  assert.equal(selectors.storyInfo(s).steps[0].done, true);
  // chapter 2: only the listed techs; chapter 3: ships locked, so the ship does not come
  const h = storyGame(2);
  h.state.resources.science = 500;
  assert.equal(h.dispatch({ type: 'research', techId: 'waterRecycling' }).reason, 'err.locked');
  assert.equal(selectors.techOptions(h.state).find((o) => o.id === 'waterRecycling').reason, 'err.locked');
  assert.equal(selectors.techOptions(h.state).find((o) => o.id === 'fission').ok, true);
  assert.equal(selectors.techOptions(h.state).find((o) => o.id === 'eds').reason, 'err.alreadyResearched');
  const k = storyGame(3);
  Object.assign(k.state.resources, { o2: 500, water: 500, food: 500 });
  k.tick(12);
  assert.equal(evOf(k.drainEvents(), 'ship.arrived').length, 0, 'no ship while ships are locked');
});

/** A one-step test chapter around a single check (the second step never completes). */
function checkChapter(check, { colonists, modules, scheduled = [], unlocked } = {}) {
  const base = CHAPTERS[3];
  CHAPTERS[99] = {
    ...base, scheduled,
    start: { ...base.start, colonists: colonists || base.start.colonists.map((c) => ({ ...c, dose: 324 })), modules: modules || base.start.modules },
    unlocked: unlocked || { modules: Object.keys(MODULES), features: ['toggle', 'assign', 'clean', 'ships', 'tech', 'expeditions', 'shelter'], techs: Object.keys(TECHS) },
    steps: [{ id: 'x.check', check }, { id: 'x.wait', check: { kind: 'tReached', t: 1e6 } }],
  };
  const g = storyGame(99); // CHAPTERS[99] stays until the next call (the engine reads it every step)
  g.drainEvents();
  return g;
}
const doneNow = (g, dt = TIME.STEP) => { g.tick(dt); return g.drainEvents().some((e) => e.type === 'objective.done' && e.id === 'x.check'); };

test('story: every check kind works in isolation', () => {
  let g;
  // built (with level)
  g = checkChapter({ kind: 'built', module: 'shelter', count: 1, level: 2 });
  g.state.resources.regolith = 200;
  assert.ok(g.dispatch({ type: 'build', slotId: 's12', moduleType: 'shelter' }).ok);
  assert.equal(doneNow(g, 2.05), false, 'level 1 is not enough');
  assert.ok(g.dispatch({ type: 'upgrade', slotId: 's12' }).ok);
  assert.equal(doneNow(g, 2.05), true, 'built level 2');
  // tReached: fixed, and after the step started (capped at maxT)
  g = checkChapter({ kind: 'tReached', t: 91 });
  assert.equal(doneNow(g, 0.6), false); assert.equal(doneNow(g, 0.2), true);
  g = checkChapter({ kind: 'tReached', afterStepSols: 5, maxT: 91.3 });
  assert.equal(doneNow(g, 0.9), false); assert.equal(doneNow(g, 0.15), true);
  // netNonNegative and stockAtLeast
  g = checkChapter({ kind: 'netNonNegative', res: 'o2' });
  assert.ok(g.dispatch({ type: 'toggle', slotId: 's7', enabled: false }).ok);
  assert.equal(doneNow(g), false);
  assert.ok(g.dispatch({ type: 'toggle', slotId: 's7', enabled: true }).ok);
  assert.equal(doneNow(g), true);
  g = checkChapter({ kind: 'stockAtLeast', res: 'parts', amount: 50 });
  assert.equal(doneNow(g), false); g.state.resources.parts = 50; assert.equal(doneNow(g), true);
  // assigned (profession and module type)
  g = checkChapter({ kind: 'assigned', profession: 'botanist', module: 'greenhouse' });
  assert.ok(g.dispatch({ type: 'assign', colonistId: colonist(g, 'engineer').id, slotId: 's9' }).ok);
  assert.equal(doneNow(g), false);
  assert.ok(g.dispatch({ type: 'assign', colonistId: colonist(g, 'botanist').id, slotId: 's5' }).ok);
  assert.equal(doneNow(g), true);
  // cleaned: a cleaning has to finish
  g = checkChapter({ kind: 'cleaned' });
  assert.ok(g.dispatch({ type: 'clean', slotId: 's1' }).ok);
  assert.equal(doneNow(g), false);
  assert.equal(doneNow(g, 0.2), true);
  // researched
  g = checkChapter({ kind: 'researched', tech: 'spaceWeather' });
  assert.equal(doneNow(g), false);
  assert.ok(g.dispatch({ type: 'research', techId: 'spaceWeather' }).ok);
  assert.equal(doneNow(g), true);
  // expeditionDone (site) and recalled (site)
  g = checkChapter({ kind: 'expeditionDone', site: 'regolith' });
  assert.ok(g.dispatch({ type: 'startExpedition', site: 'regolith', colonistId: colonist(g, 'geologist').id }).ok);
  g.state.expeditions[0].stuck = false;
  assert.equal(doneNow(g, 0.5), false); assert.equal(doneNow(g, 0.55), true);
  g = checkChapter({ kind: 'recalled', site: 'minerals' });
  assert.ok(g.dispatch({ type: 'startExpedition', site: 'minerals', colonistId: colonist(g, 'geologist').id }).ok);
  assert.equal(doneNow(g, 0.5), false);
  assert.ok(g.dispatch({ type: 'recallExpedition', id: g.state.expeditions[0].id }).ok);
  assert.equal(doneNow(g), true);
  // recalled during a severe warning only
  g = checkChapter({ kind: 'recalled', duringSevereWarning: true }, { scheduled: [{ atT: 91, kind: 'spe', params: { severity: 'severe', donkiId: SEVERE.id } }] });
  assert.ok(g.dispatch({ type: 'startExpedition', site: 'minerals', colonistId: colonist(g, 'geologist').id }).ok);
  g.tick(0.2);
  assert.ok(g.dispatch({ type: 'recallExpedition', id: g.state.expeditions[0].id }).ok);
  assert.equal(doneNow(g), false, 'no warning yet');
  g.tick(0.53);
  assert.equal(g.state.env.spe?.phase, 'warning');
  assert.ok(g.dispatch({ type: 'startExpedition', site: 'regolith', colonistId: colonist(g, 'engineer').id }).ok);
  assert.ok(g.dispatch({ type: 'recallExpedition', id: g.state.expeditions[0].id }).ok);
  assert.equal(doneNow(g), true, 'recalled during the warning');
  // eventEnded (with severity) and shelteredWhen
  g = checkChapter({ kind: 'eventEnded', event: 'spe', severity: 'severe' }, { scheduled: [
    { atT: 90.4, kind: 'spe', params: { severity: 'moderate', donkiId: MODERATE.id, warningSols: 0.1 } },
    { atT: 93, kind: 'spe', params: { severity: 'severe', donkiId: SEVERE.id, warningSols: 0.1 } }] });
  assert.equal(doneNow(g, 2.5), false, 'a moderate one is not enough');
  assert.equal(doneNow(g, 2), true);
  g = checkChapter({ kind: 'eventEnded', event: 'dustRegional' }, { scheduled: [{ atT: 90.5, kind: 'dustRegional', params: { sols: 1, tauPeak: 2 } }] });
  assert.equal(doneNow(g, 0.9), false); assert.equal(doneNow(g, 0.4), true);
  g = checkChapter({ kind: 'shelteredWhen', severity: 'severe' }, { modules: [...CHAPTERS[3].start.modules, { slot: 's12', type: 'shelter', level: 1 }],
    scheduled: [{ atT: 90.4, kind: 'spe', params: { severity: 'severe', donkiId: SEVERE.id, warningSols: 0.1 } }] });
  assert.ok(g.dispatch({ type: 'setShelter', on: true }).ok);
  assert.equal(doneNow(g, 0.15), false, 'sheltered in the warning phase only');
  assert.equal(doneNow(g, 0.1), true, 'sheltered while active');
  // landed
  g = checkChapter({ kind: 'landed', count: 2 });
  g.state.ship.nextArrivalT = 91;
  assert.equal(doneNow(g, 0.75), false);
  assert.ok(g.state.ship.awaitingDecision);
  assert.ok(g.dispatch({ type: 'shipDecision', acceptIdx: [0, 1] }).ok);
  assert.equal(doneNow(g), true);
  // maxDoseBelow: passes, and reaching the limit while it is still ahead ends the game ('dose')
  g = checkChapter({ kind: 'maxDoseBelow', msv: 600 });
  assert.equal(doneNow(g), true);
  const h = storyGame(3);
  h.state.colonists[0].dose = 599.99;
  h.tick(0.2);
  assert.equal(h.state.over?.reason, 'dose');
  assert.ok(evOf(h.drainEvents(), 'game.over').some((e) => e.reason === 'dose'));
  // all: every sub-check
  g = checkChapter({ kind: 'all', checks: [{ kind: 'stockAtLeast', res: 'parts', amount: 50 }, { kind: 'researched', tech: 'eds' }] });
  assert.equal(doneNow(g), false);
  g.state.resources.parts = 60;
  assert.equal(doneNow(g), true);
  delete CHAPTERS[99];
});

test('story: no random events (only the scheduled ones), no conjunction blackout', () => {
  const g = storyGame(3, 'commander', 5);
  Object.assign(g.state.resources, { o2: 900, water: 900, food: 900 });
  g.tick(30); // nobody plays: the chapter waits on its first step
  const ev = g.drainEvents();
  assert.equal(g.state.over, null);
  const starts = evOf(ev, 'event.start').filter((e) => e.phase !== 'active');
  assert.deepEqual(starts.map((e) => `${e.kind}:${e.donkiId}`), ['spe:2017-09-10T15:35:00-FLR-001']);
  assert.equal(starts[0].severity, 'moderate');
  assert.equal(ev.filter((e) => e.type.startsWith('comm.blackout')).length, 0);
  assert.equal(g.state.env.comm.blackout, false);
});

test('story: serialize / load mid-chapter resumes identically', () => {
  const run = (g, until) => { while (g.state.t < until && !g.state.over && !g.state.story.complete) { chapter3Bot(g); g.tick(0.05); } };
  const g = storyGame(3, 'cadet', 7);
  run(g, 98.8); // the severe storm is on the schedule, the minerals expedition is out
  assert.ok(g.state.env.spe && g.state.env.spe.severity === 'severe');
  const h = loadGame(g.serialize());
  assert.deepEqual(selectors.storyInfo(h.state), selectors.storyInfo(g.state));
  run(g, 103); run(h, 103);
  assert.equal(g.serialize(), h.serialize());
  assert.equal(h.state.story.complete, true);
});

test('story: random actions never break a chapter (invariants)', () => {
  for (const n of [1, 2, 3]) {
    const g = storyGame(n, n % 2 ? 'commander' : 'cadet', n);
    const rand = makeRand(n * 13);
    for (let i = 0; i < 15 * 4 && !g.state.over && !g.state.story.complete; i++) {
      for (let k = 0; k < 3; k++) { const a = randomAction(rand, g.state); if (a) { const r = g.dispatch(a); assert.ok(r.ok === true || typeof r.reason === 'string'); } }
      g.tick(0.25);
      scanNumbers(g.state);
      for (const v of Object.values(g.state.resources)) assert.ok(v >= 0);
    }
    assert.deepEqual(JSON.parse(g.serialize()), g.state);
  }
});

const STORY_BOTS = { 1: chapter1Bot, 2: chapter2Bot, 3: chapter3Bot };
test('story: each chapter bot completes its chapter on both difficulties', () => {
  for (const n of [1, 2, 3]) {
    for (const difficulty of ['commander', 'cadet']) {
      const r = runChapter(createGame, n, STORY_BOTS[n], { difficulty, sols: 20 });
      const s = r.game.state;
      assert.equal(s.over, null, `chapter ${n} ${difficulty}: lost (${s.over?.reason})`);
      assert.ok(r.completeAt !== null, `chapter ${n} ${difficulty}: stuck at ${selectors.storyInfo(s).current?.id}`);
      const ev = r.events;
      assert.deepEqual(evOf(ev, 'objective.done').map((e) => e.id), CHAPTERS[n].steps.map((x) => x.id));
      const done = evOf(ev, 'story.complete')[0];
      assert.equal(done.chapter, n);
      assert.equal(done.score, selectors.score(s));
      assert.ok(s.story.complete && selectors.storyInfo(s).complete && selectors.storyInfo(s).current === null);
      // frozen like game over
      const t = s.t;
      r.game.tick(3);
      assert.equal(s.t, t);
      assert.equal(r.game.dispatch({ type: 'setShelter', on: true }).reason, 'err.gameOver');
      if (n === 1) assert.ok(r.completeAt - CHAPTERS[1].startT >= 7.5 && r.completeAt <= 12.01, `chapter 1 took until t=${r.completeAt}`);
      if (n === 2) assert.ok(evOf(ev, 'event.end', 'dustGlobal').length === 1);
      if (n === 3) {
        assert.ok(Math.max(...s.colonists.map((c) => c.dose)) < 600);
        assert.ok(evOf(ev, 'ship.landed')[0].landed.length === 2);
        const sev = evOf(ev, 'event.start', 'spe').find((e) => e.severity === 'severe' && e.phase === 'warning');
        assert.ok(sev && sev.t > 98 && sev.t < 99.5, `severe warning at ${sev?.t}`);
      }
    }
  }
});

test('story: doing nothing loses chapters 1 and 2; chapter 2 needs load shedding; chapter 3 needs shelter and recall', () => {
  for (const n of [1, 2]) for (const difficulty of ['commander', 'cadet']) {
    const r = runChapter(createGame, n, () => {}, { difficulty, sols: 20, every: 0.25 });
    assert.ok(r.lostAt !== null, `idle survived chapter ${n} on ${difficulty}`);
  }
  for (const difficulty of ['commander', 'cadet']) {
    const r = runChapter(createGame, 2, (g) => chapter2Bot(g, { budget: false }), { difficulty, sols: 20 });
    assert.equal(r.game.state.over?.reason, 'blackout', `chapter 2 without shedding on ${difficulty}`);
    const ns = runChapter(createGame, 3, (g) => chapter3Bot(g, { shelter: false }), { difficulty, sols: 20 });
    assert.equal(ns.game.state.over?.reason, 'dose', 'no shelter');
    assert.ok(ns.game.state.colonists.find((c) => c.name === 'Lia Moreira').dose >= 600, 'Lia over the limit');
    const nr = runChapter(createGame, 3, (g) => chapter3Bot(g, { recall: false }), { difficulty, sols: 20 });
    assert.equal(nr.game.state.over?.reason, 'dose', 'no recall');
    assert.ok(nr.game.state.colonists.find((c) => c.name === 'Tomás Reyes').dose >= 600, 'the expedition member over the limit');
  }
});

// ---------- Apêndice D: Sol real and communication ----------
test('Sol real: flare mapping (M5.0+ -> SPE, X5.0+ severe), whole days, bad input skipped, serializable', () => {
  const flares = [
    { id: 'a', peakTime: '2026-10-20T10:00Z', classType: 'M5.2', link: 'L' },
    { id: 'b', peakTime: '2026-10-25T23:00Z', classType: 'X1.0' },
    { id: 'c', peakTime: '2026-10-26T01:00Z', classType: 'X5.4' },
    { id: 'd', peakTime: '2026-10-27T00:00Z', classType: 'M4.9' },
    { id: 'e', peakTime: '2026-10-28T00:00Z', classType: 'C3' },
    { id: 'f', peakTime: 'garbage', classType: 'X9' }, { id: 'g', peakTime: '2026-10-28T00:00Z', classType: 'Q7' }, null, 42,
    { id: 'z', peakTime: '2026-11-14T00:00Z', classType: 'M1.0' }, // latest valid peak: the window is Oct 15 - Nov 14
  ];
  const g = createGame({ seed: 1, liveFlares: flares });
  const rs = g.state.realSun;
  assert.equal(rs.fetchedCount, flares.length);
  assert.equal(rs.windowStart, '2026-10-15T00:00:00.000Z');
  assert.deepEqual(rs.storms.map((x) => [x.params.record.id, x.atT, x.params.severity]), [['a', 10, 'moderate'], ['b', 15, 'moderate'], ['c', 16, 'severe']]);
  assert.deepEqual(createGame({ seed: 1, liveFlares: flares }).serialize(), g.serialize(), 'deterministic');
  const w = createGame({ seed: 1, liveFlares: flares, windowStart: '2026-10-20T00:00Z' });
  assert.equal(w.state.realSun.storms[0].atT, EVENTS.graceSols);
  assert.equal(createGame({ mode: 'story', chapter: 1, liveFlares: flares }).state.realSun, null, 'colony mode only');
  assert.equal(createGame({ seed: 1 }).state.realSun, null);
  // the scheduled storm fires with live: true and the real record
  g.state.events.auto = false;
  for (const sl of g.state.slots) sl.module = null;
  place(g, 's1', 'habitat', 3); place(g, 's2', 'reactor', 3); place(g, 's3', 'battery', 3);
  Object.assign(g.state.resources, { o2: 900, water: 900, food: 900, energy: 200 });
  g.tick(10.2 - g.state.t);
  const st = evOf(g.drainEvents(), 'event.start', 'spe')[0];
  assert.ok(st && st.live === true && st.donkiId === 'a' && st.classType === 'M5.2');
  assert.deepEqual(JSON.parse(g.serialize()), g.state);
});

test('Sol real: quiet Sun -> no solar storm from sol 5 to 35, the normal draw afterwards', () => {
  let inWindow = 0, after = 0, colonyInWindow = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const quiet = fortress(seed); // fortress = colony game with the random draw on
    quiet.state.realSun = null;
    const g = createGame({ seed, liveFlares: [] });
    Object.assign(g.state, { slots: quiet.state.slots, resources: quiet.state.resources });
    g.tick(80);
    for (const e of evOf(g.drainEvents(), 'event.start', 'spe')) if (e.phase === 'warning') { if (e.t >= 5 && e.t < 35) inWindow++; else if (e.t >= 35) after++; }
    quiet.tick(35);
    colonyInWindow += evOf(quiet.drainEvents(), 'event.start', 'spe').length;
    assert.ok(g.state.realSun && g.state.realSun.storms.length === 0);
  }
  assert.equal(inWindow, 0, 'a random SPE in the Sol real window');
  assert.ok(after > 0, 'no SPE after sol 35');
  assert.ok(colonyInWindow > 0, 'the plain colony game does draw SPEs in sols 5-35');
});

test('conjunction: blackout timing, events, panel, no warning without the tech, local warning with it, off in story and before sol 5', () => {
  const g = fortress(3);
  g.state.events.auto = false;
  const H = COMM.blackoutCenter - COMM.blackoutSols / 2;
  g.tick(H - 0.05 - g.state.t);
  assert.equal(g.state.env.comm.blackout, false);
  assert.ok(Math.abs(g.state.env.comm.delayMin - g.state.env.commDelayMin) < 1e-12);
  g.tick(0.1);
  let ev = g.drainEvents();
  const start = evOf(ev, 'comm.blackout.start')[0];
  assert.ok(start && Math.abs(start.endsAt - (H + COMM.blackoutSols)) < 1e-9);
  assert.ok(ev.some((e) => e.type === 'science.panel' && e.id === 'conjunction'));
  assert.equal(g.state.env.comm.blackout, true);
  assert.ok(Math.abs(g.state.env.comm.blackoutEndsAt - start.endsAt) < 1e-9);
  assert.equal(selectors.speWarningSols(g.state), 0);
  g.state.events.scheduled.push({ atT: g.state.t, kind: 'spe', params: { donkiId: SEVERE.id } });
  g.tick(TIME.STEP);
  ev = g.drainEvents();
  assert.equal(evOf(ev, 'event.start', 'spe')[0].phase, 'active', 'no warning reaches the base');
  assert.ok(!ev.some((e) => e.type === 'science.panel' && e.id === 'speWarning'));
  g.state.tech.unlocked.push('spaceWeather');
  assert.equal(selectors.speWarningSols(g.state), EVENTS.spe.warningSolsLocal);
  g.tick(H + COMM.blackoutSols + 0.05 - g.state.t);
  assert.equal(evOf(g.drainEvents(), 'comm.blackout.end').length, 1);
  assert.equal(g.state.env.comm.blackout, false);
  // next cycle: same window 26 sols later; never in the first 5 sols (window would be at 12.5 anyway), never in story mode
  const blk = [];
  const k = fortress(4);
  k.state.events.auto = false;
  for (let i = 0; i < 60 * 4; i++) { k.tick(0.25); for (const e of k.drainEvents()) if (e.type === 'comm.blackout.start') blk.push(e.t); }
  assert.equal(blk.length, 2);
  assert.ok(Math.abs(blk[1] - blk[0] - SHIP.intervalSols) < 0.02);
  assert.ok(blk[0] >= EVENTS.graceSols);
});

// ---------- report ----------
if (REPORT) {
  const f = (x, d = 0) => (x === Infinity ? 'inf' : x === null || x === undefined ? '-' : x.toFixed(d));
  const table = (difficulty, bot, sols) => {
    console.log(`\nBalance report: ${bot === competentBot ? 'competent' : 'careless'} bot, seed 1, ${difficulty}`);
    console.log('sol | energy  o2     water  food   parts reg  sci | net/sol E      o2     water  food  | pop | tau  | modules');
    const { log } = runBot(createGame, bot, {
      seed: 1, sols, difficulty,
      onSample: (s) => {
        const r = s.resources, n = selectors.netPerSol(s);
        const mods = s.slots.filter((sl) => sl.module).map((sl) => `${sl.module.type.slice(0, 3)}${sl.module.level}`).join(' ');
        console.log(`${String(selectors.getSol(s)).padStart(3)} | ${f(r.energy).padStart(6)} ${f(r.o2, 1).padStart(6)} ${f(r.water, 1).padStart(6)} ${f(r.food, 1).padStart(6)} ${f(r.parts).padStart(5)} ${f(r.regolith).padStart(4)} ${f(r.science).padStart(4)} | ${f(n.energy, 1).padStart(7)} ${f(n.o2, 2).padStart(6)} ${f(n.water, 2).padStart(6)} ${f(n.food, 2).padStart(6)} | ${String(selectors.population(s)).padStart(3)} | ${f(s.env.tau, 1).padStart(4)} | ${mods}`);
      },
    });
    console.log(`events: ${JSON.stringify(log.events)} severe SPE ${log.severeSpe}; techs ${log.techs.join(' ')}`);
  };
  const summary = (label, runs, sols) => {
    const ok = runs.filter((r) => r.lostAt === null).length;
    const tot = {};
    for (const r of runs) for (const [k, v] of Object.entries(r.log.events)) tot[k] = (tot[k] || 0) + v;
    const med = (xs) => { const v = xs.filter((x) => x !== null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
    const first10 = runs.map((r) => r.log.built.filter((t) => t < 25).length);
    console.log(`\n${label}: survived ${sols} sols in ${ok}/20`);
    console.log(`  population peak (median) ${med(runs.map((r) => r.popPeak))}; pop 8 at sol (median) ${f(med(runs.map((r) => r.log.pop8At)))}; pop 12 at sol (median) ${f(med(runs.map((r) => r.log.pop12At)))}`);
    console.log(`  modules finished in the first 25 sols (median) ${med(first10)}; expeditions/run ${f(runs.reduce((a, r) => a + r.log.expeditions, 0) / 20, 1)}; retired/run ${f(runs.reduce((a, r) => a + r.log.retired, 0) / 20, 2)}`);
    console.log(`  events per run: ${Object.entries(tot).map(([k, v]) => `${k} ${f(v / 20, 1)}`).join(', ')}; severe SPE ${f(runs.reduce((a, r) => a + r.log.severeSpe, 0) / 20, 1)}`);
    console.log(`  min O2 during a global storm (median) ${f(med(runs.map((r) => (r.log.minO2Storm === Infinity ? null : r.log.minO2Storm))), 1)} kg; max dose (median) ${f(med(runs.map((r) => r.log.maxDose)))} mSv`);
    console.log('  runs:', runs.map((r) => `${r.seed}:${r.lostAt === null ? 'ok' : r.reason}/peak${r.popPeak}`).join(' '));
  };
  table('commander', competentBot, 200);
  table('cadet', competentBot, 200);
  if (competentRuns) summary('competent bot, commander', competentRuns, 200);
  const cadetCompetent = [], carelessCommander = [];
  for (let seed = 1; seed <= 20; seed++) {
    const a = runBot(createGame, competentBot, { seed, sols: 200, difficulty: 'cadet' });
    cadetCompetent.push({ seed, lostAt: a.lostAt, reason: a.game.state.over?.reason, popPeak: a.game.state.stats.popPeak, log: a.log });
    const b = runBot(createGame, carelessBot, { seed, sols: 200, difficulty: 'commander' });
    carelessCommander.push({ seed, lostAt: b.lostAt, reason: b.game.state.over?.reason, popPeak: b.game.state.stats.popPeak, log: b.log });
  }
  summary('competent bot, cadet', cadetCompetent, 200);
  if (carelessRuns) summary('careless bot, cadet', carelessRuns, 60);
  summary('careless bot, commander', carelessCommander, 200);
}

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed (${((Date.now() - T0) / 1000).toFixed(1)} s)`);
process.exit(failed ? 1 : 0);
