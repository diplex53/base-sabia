// Scripted players used by the balance tests. They only use the public API (dispatch + selectors + state).
import { MODULES, SHIP, EXPEDITIONS, SLOTS, oldSlotToNew } from '../src/data/balance.js';
import { TECHS } from '../src/data/tech.js';
import {
  SOLAR_YIELD_CLEAR_KWH_M2_SOL, MOXIE_KWH_PER_KG, EXTRACTOR_KWH_PER_KG, GH_KWH_PER_M2_SOL, CROP_M2_PER_PERSON_O2,
  O2_PER_CREW_SOL, WATER_GROSS_PER_CREW_SOL, WATER_RECYCLE_BASE, WATER_RECYCLE_TECH, FOOD_PER_CREW_SOL,
  CROP_YIELD_KG_M2_SOL, GH_WATER_KG_M2_SOL, SOL_HOURS,
} from '../src/data/constants.js';
import * as sel from '../src/sim/selectors.js';

const spec = (m, level = m.level) => MODULES[m.type].levels[level - 1];
const has = (s, id) => s.tech.unlocked.includes(id);

/** Rated energy use of a consumer at a level. */
function useOf(type, s) {
  if (type === 'habitat') return s.use;
  if (type === 'moxie') return s.o2 * MOXIE_KWH_PER_KG;
  if (type === 'extractor') return s.water * EXTRACTOR_KWH_PER_KG;
  if (type === 'greenhouse') return s.area * GH_KWH_PER_M2_SOL;
  return s.use || 0; // expansion modules (E.2); the sabatier is never built by the bots
}

/** Planning view: modules counted at the level they will have once current work finishes. */
function plan(state) {
  const p = { gen: 0, load: 0, battery: 0, o2: 0, water: 0, food: 0, ghWater: 0, crew: 0, shelter: 0, habUse: 0, solar: 0, reactor: 0, byType: {}, free: [] };
  const foodK = has(state, 'plantHabitat') ? 1.5 : 1;
  for (const sl of state.slots) {
    const m = sl.module;
    if (!m) { p.free.push(sl.id); continue; }
    const lvl = m.status === 'upgrading' ? m.level + 1 : m.level;
    const s = spec(m, lvl);
    (p.byType[m.type] ||= []).push(sl);
    if (m.type === 'solar') { const g = s.area * SOLAR_YIELD_CLEAR_KWH_M2_SOL * (1 - Math.min(m.dust, 0.15)); p.gen += g; p.solar += g; }
    if (m.type === 'reactor') { p.gen += s.kwe * SOL_HOURS; p.reactor += s.kwe * SOL_HOURS; }
    if (m.type === 'battery') p.battery += s.capacity;
    if (m.type === 'habitat') { p.crew += s.capacity; p.habUse += s.use; }
    if (m.type === 'shelter') p.shelter += s.capacity;
    if (m.type === 'moxie') p.o2 += s.o2;
    if (m.type === 'extractor') p.water += s.water;
    if (m.type === 'greenhouse') {
      p.food += s.area * CROP_YIELD_KG_M2_SOL * foodK;
      p.ghWater += s.area * GH_WATER_KG_M2_SOL;
      if (has(state, 'bioregen')) p.o2 += s.area / CROP_M2_PER_PERSON_O2 * O2_PER_CREW_SOL;
    }
    p.load += useOf(m.type, s);
  }
  return p;
}

// the old 4x4 order, moved to the middle of the 6x6 map (Apêndice E.1), then the outer ring
const CORE_SLOTS = ['s7', 's10', 's2', 's3', 's5', 's8', 's11', 's9', 's12', 's14', 's15', 's1', 's4', 's13', 's16', 's6'].map(oldSlotToNew);
const PREFERRED_SLOTS = [...CORE_SLOTS, ...SLOTS.map((s) => s.id).filter((id) => !CORE_SLOTS.includes(id))];
const RESEARCH_ORDER = ['eds', 'spaceWeather', 'fission', 'waterRecycling', 'regolithPrinting', 'robotics', 'domeEngineering', 'plantHabitat', 'bioregen', 'pressurizedRover', 'hydrogenShield'];
const MATCH = { engineer: ['moxie', 'solar', 'reactor', 'extractor'], botanist: ['greenhouse'] };

/** Builds nothing, ever. */
export function idleBot() { /* no actions */ }

/**
 * Scripted player. Flags turn habits off: shelter (solar storms), clean (dusty panels), repair (failures),
 * expeditions, research, accept (ship colonists; without it the ship auto-accepts anyway), budget (switch
 * consumers off when generation cannot carry them, e.g. in a global dust storm).
 */
export function makeBot(opts = {}) {
  const o = { shelter: true, clean: true, repair: true, expeditions: true, research: true, accept: true, budget: true, ...opts };
  return function bot(game) {
    const s = game.state;
    const d = (a) => game.dispatch(a).ok;
    const r = s.resources;
    const n = s.colonists.length;
    const recycle = has(s, 'waterRecycling') ? WATER_RECYCLE_TECH : WATER_RECYCLE_BASE;
    const crewNeed = (k) => ({ o2: k * O2_PER_CREW_SOL, water: k * WATER_GROSS_PER_CREW_SOL * (1 - recycle), food: k * FOOD_PER_CREW_SOL });

    // ship: take everyone (the core validates one by one)
    if (o.accept && s.ship.awaitingDecision) d({ type: 'shipDecision', acceptIdx: s.ship.offer.map((x) => x.idx) });

    // solar storm: shelter during warning and active phase; recall an expedition that would come back later
    const spe = s.env.spe;
    if (o.shelter) {
      const want = !!spe && sel.capacity(s).shelter > 0;
      if (want !== s.sheltering) d({ type: 'setShelter', on: want });
      if (spe && spe.severity === 'severe') {
        for (const e of s.expeditions) if (!e.recalled && 0.5 * e.elapsed < e.endT - s.t) d({ type: 'recallExpedition', id: e.id });
      }
    }

    if (o.repair) for (const sl of s.slots) if (sl.module && sl.module.status === 'broken') d({ type: 'repair', slotId: sl.id });
    if (o.clean) for (const sl of s.slots) if (sl.module && sl.module.type === 'solar' && sl.module.dust > 0.15 && sl.module.status === 'ok') d({ type: 'clean', slotId: sl.id });

    if (o.research) {
      const next = RESEARCH_ORDER.find((id) => !has(s, id));
      if (next && r.science >= TECHS[next].cost) d({ type: 'research', techId: next });
    }

    if (o.budget) powerBudget(game, crewNeed(n));
    build(game, crewNeed);
    if (o.expeditions) expeditions(game, crewNeed(n));
    staff(game);
  };
}

/** Switch consumers on/off so their load fits the sol-average generation (habitats always on). */
function powerBudget(game, need) {
  const s = game.state, r = s.resources;
  const consumers = [];
  let habitat = 0, enabledUse = 0;
  for (const sl of s.slots) {
    const m = sl.module;
    if (!m || m.status === 'building' || m.status === 'broken' || m.status === 'repairing') continue;
    const u = useOf(m.type, spec(m));
    if (!u) continue;
    if (m.enabled) enabledUse += u;
    if (m.type === 'habitat') habitat += u; else consumers.push({ sl, m, u });
  }
  const gen = sel.netPerSol(s).energy + enabledUse;   // sol-average generation with the current tau and dust
  const cap = sel.capacity(s).energy;
  let budget = gen - habitat + Math.max(0, r.energy - 0.6 * cap);
  const o2Low = r.o2 < 10 * need.o2;
  const waterLow = r.water < 60;
  const rank = (t) => ({ extractor: waterLow ? 0 : 3, moxie: o2Low ? 1 : 2, greenhouse: o2Low ? 2 : 1, gym: 1.5 })[t] ?? 4;
  consumers.sort((a, b) => rank(a.m.type) - rank(b.m.type));
  for (const c of consumers) {
    const on = c.u <= budget + 1e-9;
    if (on) budget -= c.u;
    if (c.m.enabled !== on) game.dispatch({ type: 'toggle', slotId: c.sl.id, enabled: on });
  }
}

/** Construction decisions (a few per call). */
function build(game, crewNeed) {
  const s = game.state, r = s.resources;
  const d = (a) => game.dispatch(a).ok;
  const freeSlot = (p) => PREFERRED_SLOTS.find((id) => p.free.includes(id));
  const costOf = (t) => sel.buildOptions(s, 's1').find((x) => x.type === t).cost; // effective level-1 cost
  const costOk = (c, reserve = 0) => (c.parts || 0) + reserve <= r.parts && (c.regolith || 0) <= r.regolith;
  const cand = Math.min(SHIP.maxCandidates, SHIP.candidates + Math.floor((s.sim.shipsArrived || 0) / 2));

  for (let guard = 0; guard < 8; guard++) {
    const p = plan(s);
    const n = s.colonists.length;
    const need = (k) => { const c = crewNeed(k); return { ...c, water: c.water + p.ghWater }; };
    const of = (t) => (p.byType[t] || []);
    const upgradeCheapest = (t) => {
      const cands = of(t).filter((sl) => sl.module.status === 'ok' && sl.module.level < 3 && sel.upgradeInfo(s, sl.id)?.ok)
        .sort((a, b) => a.module.level - b.module.level);
      return cands.length ? d({ type: 'upgrade', slotId: cands[0].id }) : false;
    };
    // free a slot by demolishing a surplus level-1 panel or battery (only for food / life-support modules)
    const makeRoom = () => {
      const spare = (sl) => {
        const m = sl.module;
        if (m.level !== 1 || m.status !== 'ok') return false;
        if (m.type === 'solar') return p.gen - spec(m) .area * SOLAR_YIELD_CLEAR_KWH_M2_SOL >= (p.load + 80) * 1.15;
        if (m.type === 'battery') return p.battery - spec(m).capacity >= Math.max(0.62 * p.load, 11 * Math.max(0, p.habUse - p.reactor - 0.04 * p.solar));
        return false;
      };
      const sl = [...of('solar'), ...of('battery')].find(spare);
      return sl ? d({ type: 'demolish', slotId: sl.id }) : false;
    };
    const buildOrUpgrade = (t, keepFree = 2, preferUpgrade = false) => {
      if (preferUpgrade && upgradeCheapest(t)) return true;
      const slot = freeSlot(p);
      if (slot && p.free.length > keepFree && costOk(costOf(t)) && d({ type: 'build', slotId: slot, moduleType: t })) return true;
      if (upgradeCheapest(t)) return true;
      // life support may use the last free slots, and then make room
      if (!['greenhouse', 'habitat', 'extractor', 'moxie'].includes(t) || !costOk(costOf(t), 10)) return false;
      if (slot) return d({ type: 'build', slotId: slot, moduleType: t });
      return makeRoom();
    };
    const power = () => {
      if (has(s, 'fission') && !of('reactor').length) {
        const slot = freeSlot(p);
        if (slot && costOk(costOf('reactor'))) return d({ type: 'build', slotId: slot, moduleType: 'reactor' });
        if (r.parts < 45) return false; // save for the reactor
      }
      if (of('reactor').length && upgradeCheapest('reactor')) return true;
      return buildOrUpgrade('solar', 1, p.free.length < 6);
    };
    const powerOk = (extra) => p.gen >= (p.load + extra) * 1.15;
    const batteryOk = (extra) => p.battery >= 0.62 * (p.load + extra);
    // global-dust-storm reserve: the habitats must run ~10 sols (battery not always full) on ~4% solar
    // plus the reactor and the batteries
    const stormOk = (extraHab) => p.battery >= 11 * Math.max(0, p.habUse + extraHab - p.reactor - 0.04 * p.solar);
    const consumer = (extra, type, act) => {
      const own = costOf(type).parts || 0;
      if (!powerOk(extra)) return r.parts >= 8 + own && power();
      if (!batteryOk(extra)) return r.parts >= 6 + own && buildOrUpgrade('battery', 4);
      return act();
    };
    const HORIZON = 40;
    const shipFood = SHIP.cargo.food / SHIP.intervalSols;
    const short = (k, extraGhWater = 0) => {
      const nd = need(k);
      return {
        // keep about 12 sols of O2 in the tank for a global dust storm
        o2: nd.o2 * 1.05 - p.o2 - (r.o2 - 12 * nd.o2) / HORIZON,
        water: nd.water + extraGhWater - p.water - (r.water - 60) / HORIZON,
        food: r.food > 40 * nd.food ? -1 : nd.food * 1.1 - p.food - shipFood,
      };
    };
    const sNow = short(n);
    const GH_W = MODULES.greenhouse.levels[0].area * GH_WATER_KG_M2_SOL;
    const greenhouse = () => (short(n, GH_W).water > 0
      ? consumer(6, 'extractor', () => buildOrUpgrade('extractor', 2, true))
      : consumer(65, 'greenhouse', () => buildOrUpgrade('greenhouse', 2)));
    const hab = of('habitat').find((sl) => sl.module.status === 'ok' && sl.module.level < 3 && sel.upgradeInfo(s, sl.id)?.ok);
    const stormReserve = () => (has(s, 'fission') && !of('reactor').length ? power() : buildOrUpgrade('battery', 3, p.free.length < 5));
    const moreHabitat = () => {
      if (!stormOk(16)) return stormReserve();
      return (hab && d({ type: 'upgrade', slotId: hab.id })) || buildOrUpgrade('habitat', 1);
    };
    const sNext = short(n + cand);
    // E.2 / E.3: a gym before health gets low, a warehouse when a stock nears its cap, the dome when it can
    const capNow = sel.capacity(s);
    const nearCap = ['o2', 'water', 'food'].some((k) => r[k] > 0.85 * capNow[k]);
    const gymLevels = of('gym').reduce((a, sl) => a + sl.module.level, 0);
    const savingForDome = has(s, 'domeEngineering') && !of('dome').length && n >= 8;
    const dome = () => {
      const slot = freeSlot(p);
      return !!slot && costOk(costOf('dome')) && d({ type: 'build', slotId: slot, moduleType: 'dome' });
    };
    // priorities, first one that acts wins; a "block" entry means "save parts for this, do nothing else"
    const rules = [
      [() => !of('moxie').length, () => d({ type: 'build', slotId: freeSlot(p), moduleType: 'moxie' }), true],
      [() => !powerOk(0), power, true],
      [() => !batteryOk(0), () => buildOrUpgrade('battery', 4, p.free.length < 6), true],
      [() => !stormOk(0), stormReserve, true],
      [() => sNow.o2 > 0, () => consumer(75, 'moxie', () => buildOrUpgrade('moxie', 2, true)), true],
      [() => sNow.water > 0, () => consumer(6, 'extractor', () => buildOrUpgrade('extractor', 2, true)), true],
      [() => !of('shelter').length && r.regolith >= 40 && r.parts >= 4, () => buildOrUpgrade('shelter', 1)],
      [() => s.health < 92 && gymLevels === 0, () => consumer(8, 'gym', () => buildOrUpgrade('gym', 1)), s.health < 70],
      [() => s.health < 60 && gymLevels < 2, () => consumer(4, 'gym', () => upgradeCheapest('gym'))],
      [() => sNow.food > 0 && r.regolith >= 10, greenhouse],
      [() => p.crew < n + cand && r.regolith >= 20 && r.parts >= 15, moreHabitat],
      [() => has(s, 'fission') && !of('reactor').length, power],
      [() => nearCap && r.regolith >= 20 && r.parts >= 10, () => buildOrUpgrade('warehouse', 2, true)],
      [() => savingForDome && p.crew >= n, dome, true],
      [() => has(s, 'robotics') && !of('mine').length && r.parts >= 30, () => consumer(25, 'mine', () => buildOrUpgrade('mine', 2))],
      [() => p.shelter < n && r.regolith >= 60, () => buildOrUpgrade('shelter', 3, true)],
      // get ready for the next ship's candidates
      [() => sNext.o2 > 0, () => consumer(75, 'moxie', () => buildOrUpgrade('moxie', 2, true))],
      [() => sNext.water > 0, () => consumer(6, 'extractor', () => buildOrUpgrade('extractor', 2, true))],
      [() => sNext.food > 0 && r.regolith >= 10, greenhouse],
    ];
    let acted = false;
    for (const [cond, act, block] of rules) {
      if (!cond()) continue;
      acted = act();
      if (acted || block) break;
    }
    if (!acted) break;
  }
}

/** Keep the rover(s) busy: regolith when short, ice when water is short, minerals (parts) otherwise. */
function expeditions(game, need) {
  const s = game.state, r = s.resources;
  if (s.env.spe || s.sheltering || sel.roversFree(s) <= 0) return;
  const cap = sel.capacity(s).energy;
  const free = s.colonists.filter((c) => c.status === 'active' && c.location !== 'expedition');
  const medics = free.filter((c) => c.profession === 'medic').length;
  const engineers = free.filter((c) => c.profession === 'engineer').length;
  const pick = free.find((c) => c.profession === 'geologist')
    || free.find((c) => c.profession === 'botanist' && !c.assignedTo)
    || free.find((c) => !c.assignedTo && !(c.profession === 'medic' && medics < 2) && !(c.profession === 'engineer' && engineers < 2));
  if (!pick) return;
  const waterShort = r.water < 25 * need.water + 40 && sel.netPerSol(s).water < 0;
  const regolithGoal = has(s, 'domeEngineering') && !s.slots.some((sl) => sl.module && sl.module.type === 'dome') ? 420 : 70;
  const site = waterShort && r.regolith >= 70 ? 'ice' : r.regolith < regolithGoal ? 'regolith' : waterShort ? 'ice' : 'minerals';
  const opt = sel.expeditionOptions(s).find((x) => x.site === site);
  if (!opt.ok || r.energy < EXPEDITIONS[site].energy + 0.3 * cap) return;
  game.dispatch({ type: 'startExpedition', site, colonistId: pick.id });
}

/** Staff the producers, matching professions first. */
function staff(game) {
  const s = game.state;
  const free = s.colonists.filter((c) => c.status === 'active' && !c.assignedTo && c.location !== 'expedition' && c.profession !== 'geologist');
  for (const type of ['moxie', 'reactor', 'greenhouse', 'solar', 'extractor']) {
    for (const sl of s.slots) {
      if (!free.length) return;
      if (!sl.module || sl.module.type !== type || sl.module.staff.length) continue;
      let i = free.findIndex((c) => (MATCH[c.profession] || []).includes(type));
      if (i < 0) i = free.findIndex((c) => !MATCH[c.profession]);
      if (i < 0) i = 0;
      game.dispatch({ type: 'assign', colonistId: free.splice(i, 1)[0].id, slotId: sl.id });
    }
  }
}

export const competentBot = makeBot();
/** Builds like the competent bot but never shelters, never cleans panels, never repairs. */
export const carelessBot = makeBot({ shelter: false, clean: false, repair: false });

/**
 * Run a bot for up to `sols`, calling it every `every` sols (fine enough to react inside a solar-storm warning).
 * Returns { game, lostAt, log } where log summarises what happened (events, ships, population milestones).
 */
export function runBot(createGame, bot, { seed, sols, every = 0.05, difficulty, onSample } = {}) {
  const game = createGame({ seed, difficulty });
  const log = { events: {}, severeSpe: 0, retired: 0, landed: 0, refused: 0, expeditions: 0, techs: [], built: [], pop8At: null, pop12At: null, minO2Storm: Infinity, maxDose: 0 };
  let nextSample = 0;
  const steps = Math.round(sols / every);
  for (let i = 0; i < steps && !game.state.over; i++) {
    bot(game);
    game.tick(every);
    for (const e of game.drainEvents()) {
      if (e.type === 'event.start' && e.phase !== 'active') {
        log.events[e.kind] = (log.events[e.kind] || 0) + 1;
        if (e.kind === 'spe' && e.severity === 'severe') log.severeSpe++;
      }
      if (e.type === 'colonist.retired') log.retired++;
      if (e.type === 'ship.landed') { log.landed += e.landed.length; log.refused += e.refused.length; }
      if (e.type === 'expedition.done') log.expeditions++;
      if (e.type === 'tech.unlocked') log.techs.push(`${e.techId}@${Math.floor(e.t) + 1}`);
      if (e.type === 'build.done' && e.level === 1) log.built.push(e.t);
    }
    const st = game.state;
    const pop = sel.population(st);
    if (pop >= 8 && log.pop8At === null) log.pop8At = sel.getSol(st);
    if (pop >= 12 && log.pop12At === null) log.pop12At = sel.getSol(st);
    if (st.env.storm && st.env.storm.kind === 'global') log.minO2Storm = Math.min(log.minO2Storm, st.resources.o2);
    if (onSample && st.t >= nextSample) { onSample(st); nextSample += 10; }
  }
  log.maxDose = Math.max(0, ...game.state.colonists.map((c) => c.dose));
  return { game, lostAt: game.state.over ? game.state.t : null, log };
}

// Story-chapter bots (Apêndice C) live in storyBots.mjs.
export * from './storyBots.mjs';
