// Scripted players for the story chapters (Apêndice C). They follow the current step the way its hint suggests.
// Public API only (dispatch + selectors + state).
import { MODULES } from '../src/data/balance.js';
import { SOLAR_YIELD_CLEAR_KWH_M2_SOL, MOXIE_KWH_PER_KG, EXTRACTOR_KWH_PER_KG, GH_KWH_PER_M2_SOL } from '../src/data/constants.js';
import * as sel from '../src/sim/selectors.js';

const SLOT_ORDER = ['s7', 's11', 's2', 's3', 's5', 's8', 's9', 's12', 's1', 's4', 's13', 's14', 's15', 's16', 's10', 's6'];
const freeSlot = (s) => SLOT_ORDER.find((id) => !s.slots.find((x) => x.id === id).module);
const ofType = (s, t) => s.slots.filter((sl) => sl.module && sl.module.type === t);
const useOf = (m) => {
  const L = MODULES[m.type].levels[m.level - 1];
  return { habitat: L.use, moxie: (L.o2 || 0) * MOXIE_KWH_PER_KG, extractor: (L.water || 0) * EXTRACTOR_KWH_PER_KG, greenhouse: (L.area || 0) * GH_KWH_PER_M2_SOL }[m.type] || 0;
};
const current = (s) => sel.storyInfo(s)?.current?.id;
const build = (g, type) => { const slot = freeSlot(g.state); return slot ? g.dispatch({ type: 'build', slotId: slot, moduleType: type }).ok : false; };
const ensure = (g, type, n = 1) => (ofType(g.state, type).length < n ? build(g, type) : false);
const by = (s, prof) => s.colonists.find((c) => c.profession === prof);

/** Planned clear-sky generation and the load of every built or building consumer (kWh/sol). */
function powerPlan(s) {
  let gen = 0, load = 0;
  for (const sl of s.slots) {
    const m = sl.module;
    if (!m) continue;
    if (m.type === 'solar') gen += MODULES.solar.levels[m.level - 1].area * SOLAR_YIELD_CLEAR_KWH_M2_SOL * (1 - m.dust);
    if (m.type === 'reactor') gen += 246;
    if (m.enabled) load += useOf(m);
  }
  return { gen, load };
}

/** Chapter 1: build what each step names, plus panels so the plan carries the load (the moxieEnergy lesson). */
export function chapter1Bot(g) {
  const s = g.state;
  const step = current(s);
  if (!step) return;
  ensure(g, 'solar');
  if (step === 'c1.battery') ensure(g, 'battery', 2);
  if (['c1.moxie', 'c1.o2', 'c1.water', 'c1.food', 'c1.end'].includes(step)) ensure(g, 'moxie');
  if (['c1.water', 'c1.food', 'c1.end'].includes(step)) ensure(g, 'extractor');
  if (['c1.food', 'c1.end'].includes(step)) ensure(g, 'greenhouse');
  // keep enough panels for what is (or is about to be) on the bus; keep parts for the modules the steps still ask for
  const reserve = (ofType(s, 'moxie').length ? 0 : 12) + (ofType(s, 'extractor').length ? 0 : 8) + (ofType(s, 'greenhouse').length ? 0 : 10);
  const p = powerPlan(s);
  const coming = step === 'c1.night' || step === 'c1.battery' ? 100 : 0;
  if (p.gen < (p.load + coming) * 1.1 && s.resources.parts >= 8 + reserve) build(g, 'solar');
}

/**
 * Chapter 2: accept the ship, put the engineer on a panel, clean dusty panels, switch the greenhouse and MOXIE off
 * while a dust storm lasts (back on when it ends), research fission.
 */
export function chapter2Bot(g, { clean = true, budget = true } = {}) {
  const s = g.state;
  if (!current(s)) return;
  if (s.ship.awaitingDecision) g.dispatch({ type: 'shipDecision', acceptIdx: s.ship.offer.map((o) => o.idx) });
  const eng = s.colonists.find((c) => c.profession === 'engineer' && c.status === 'active' && !c.assignedTo);
  const panel = ofType(s, 'solar').find((sl) => !sl.module.staff.length);
  if (eng && panel && !s.colonists.some((c) => c.profession === 'engineer' && c.assignedTo && s.slots.find((x) => x.id === c.assignedTo).module?.type === 'solar')) {
    g.dispatch({ type: 'assign', colonistId: eng.id, slotId: panel.id });
  }
  const bot = s.colonists.find((c) => c.profession === 'botanist' && c.status === 'active' && !c.assignedTo);
  const gh = ofType(s, 'greenhouse').find((sl) => !sl.module.staff.length);
  if (bot && gh) g.dispatch({ type: 'assign', colonistId: bot.id, slotId: gh.id });
  if (clean) for (const sl of ofType(s, 'solar')) if (sl.module.dust > 0.08 && sl.module.status === 'ok') g.dispatch({ type: 'clean', slotId: sl.id });
  if (budget) {
    const storm = !!s.env.storm;
    for (const t of ['greenhouse', 'moxie']) for (const sl of ofType(s, t)) if (sl.module.enabled === !!storm) g.dispatch({ type: 'toggle', slotId: sl.id, enabled: !storm });
  }
  if (current(s) === 'c2.fission') g.dispatch({ type: 'research', techId: 'fission' });
}

/**
 * Chapter 3: regolith expedition, shelter, space-weather tech, minerals expedition, recall on the severe warning,
 * shelter during every solar storm, accept the ship.
 */
export function chapter3Bot(g, { shelter = true, recall = true } = {}) {
  const s = g.state;
  const step = current(s);
  if (!step) return;
  const geo = by(s, 'geologist');
  const free = s.expeditions.length === 0 && !s.sheltering;
  if (step === 'c3.regolith' && free && !s.env.spe) g.dispatch({ type: 'startExpedition', site: 'regolith', colonistId: geo.id });
  if (step === 'c3.shelter' || ofType(s, 'shelter').length === 0) { if (s.resources.regolith >= 40) ensure(g, 'shelter'); }
  if (step === 'c3.alert') g.dispatch({ type: 'research', techId: 'spaceWeather' });
  if (step === 'c3.minerals' && free && !(s.env.spe && s.env.spe.severity === 'severe')) g.dispatch({ type: 'startExpedition', site: 'minerals', colonistId: geo.id });
  if (recall && s.env.spe && s.env.spe.severity === 'severe') for (const e of s.expeditions) if (!e.recalled) g.dispatch({ type: 'recallExpedition', id: e.id });
  if (shelter) {
    const want = !!s.env.spe && sel.capacity(s).shelter > 0;
    if (want !== s.sheltering) g.dispatch({ type: 'setShelter', on: want });
  }
  if (s.ship.awaitingDecision) g.dispatch({ type: 'shipDecision', acceptIdx: s.ship.offer.map((o) => o.idx) });
}

/** Play a chapter: returns { game, events, completeAt, lostAt }. */
export function runChapter(createGame, chapter, bot, { difficulty = 'commander', seed = 1, sols = 20, every = 0.05 } = {}) {
  const game = createGame({ mode: 'story', chapter, difficulty, seed });
  const events = game.drainEvents();
  const n = Math.round(sols / every);
  for (let i = 0; i < n && !game.state.over && !game.state.story.complete; i++) {
    bot(game);
    game.tick(every);
    events.push(...game.drainEvents());
  }
  const done = events.find((e) => e.type === 'story.complete');
  return { game, events, completeAt: done ? done.t : null, lostAt: game.state.over ? game.state.t : null };
}
