// Presentation mode: the game plays itself (fixed seed, cadet) while captions explain the NASA data behind it.
// Uses only the public sim API (dispatch + selectors + state). DOM parts are skipped when there is no document
// (so tools can dry-run the timeline in Node).
import { MODULES, SHIP, EXPEDITIONS, SLOTS, oldSlotToNew } from '../data/balance.js';
import { TECHS } from '../data/tech.js';
import {
  SOLAR_YIELD_CLEAR_KWH_M2_SOL, MOXIE_KWH_PER_KG, EXTRACTOR_KWH_PER_KG, GH_KWH_PER_M2_SOL, CROP_M2_PER_PERSON_O2,
  O2_PER_CREW_SOL, WATER_GROSS_PER_CREW_SOL, WATER_RECYCLE_BASE, WATER_RECYCLE_TECH, FOOD_PER_CREW_SOL,
  CROP_YIELD_KG_M2_SOL, GH_WATER_KG_M2_SOL, SOL_HOURS,
} from '../data/constants.js';
import * as sel from '../sim/selectors.js';
import { invGet } from '../sim/crafting.js';
import { t, onLangChange } from '../i18n/i18n.js';

export const DEMO_SEED = 34;          // dust storm sol 7, real DONKI flare sol 23, ship sol 27, dome ~sol 117
export const DEMO_DIFFICULTY = 'cadet';
const SOL_REAL = 24;                  // real seconds per sol at 1x (TIME.SOL_REAL_SECONDS)
const CHUNK = 0.01;                   // fixed sim step (sol): the run is the same whatever the frame rate
const FAST = 30;                      // sim speed between beats
const SLOW = 1;                       // sim speed while a caption about an on-screen event shows
const MAX_REAL = 200;                 // safety: end card after this many real seconds
const MAX_REAL_PRESENTER = 240;       // presenter mode: same safety, counting only un-paused time
const PANEL_SECONDS = 6;
const TECH_SECONDS = 5;
const STRAY_MODAL_SECONDS = 2;
const SHOW_PANELS = new Set(['moxieEnergy', 'dustStorm', 'speWarning']);

// ---------------------------------------------------------------------------------------------
// Policy (simplified port of the competent test bot)
const spec = (m, level = m.level) => MODULES[m.type].levels[level - 1];
const has = (s, id) => s.tech.unlocked.includes(id);
function useOf(type, s) {
  if (type === 'habitat') return s.use;
  if (type === 'moxie') return s.o2 * MOXIE_KWH_PER_KG;
  if (type === 'extractor') return s.water * EXTRACTOR_KWH_PER_KG;
  if (type === 'greenhouse') return s.area * GH_KWH_PER_M2_SOL;
  return s.use || 0;
}
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
const CORE_SLOTS = ['s7', 's10', 's2', 's3', 's5', 's8', 's11', 's9', 's12', 's14', 's15', 's1', 's4', 's13', 's16', 's6'].map(oldSlotToNew);
const PREFERRED_SLOTS = [...CORE_SLOTS, ...SLOTS.map((s) => s.id).filter((id) => !CORE_SLOTS.includes(id))];
const RESEARCH_ORDER = ['eds', 'spaceWeather', 'fission', 'waterRecycling', 'regolithPrinting', 'robotics', 'domeEngineering', 'plantHabitat', 'bioregen', 'pressurizedRover', 'hydrogenShield'];
const MATCH = { engineer: ['moxie', 'solar', 'reactor', 'extractor'], botanist: ['greenhouse'] };

function safe(game, a) { try { const r = game.dispatch(a); return !!(r && r.ok); } catch (e) { return false; } }

export function demoPolicy(game) {
  const s = game.state;
  const d = (a) => safe(game, a);
  const r = s.resources;
  const n = s.colonists.length;
  const recycle = has(s, 'waterRecycling') ? WATER_RECYCLE_TECH : WATER_RECYCLE_BASE;
  const crewNeed = (k) => ({ o2: k * O2_PER_CREW_SOL, water: k * WATER_GROSS_PER_CREW_SOL * (1 - recycle), food: k * FOOD_PER_CREW_SOL });
  if (s.ship.awaitingDecision && s.ship.offer) d({ type: 'shipDecision', acceptIdx: s.ship.offer.map((x) => x.idx) });
  const spe = s.env.spe;
  const want = !!spe && sel.capacity(s).shelter > 0;
  if (want !== s.sheltering) d({ type: 'setShelter', on: want });
  if (spe && spe.severity === 'severe') {
    for (const e of s.expeditions) if (!e.recalled && 0.5 * e.elapsed < e.endT - s.t) d({ type: 'recallExpedition', id: e.id });
  }
  for (const sl of s.slots) if (sl.module && sl.module.status === 'broken') d({ type: 'repair', slotId: sl.id });
  for (const sl of s.slots) if (sl.module && sl.module.type === 'solar' && sl.module.dust > 0.15 && sl.module.status === 'ok') d({ type: 'clean', slotId: sl.id });
  const next = RESEARCH_ORDER.find((id) => !has(s, id));
  if (next && TECHS[next] && r.science >= TECHS[next].cost) d({ type: 'research', techId: next });
  powerBudget(game, crewNeed(n));
  build(game, crewNeed);
  expeditions(game, crewNeed(n));
  staff(game);
}

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
  const gen = sel.netPerSol(s).energy + enabledUse;
  const cap = sel.capacity(s).energy;
  let budget = gen - habitat + Math.max(0, r.energy - 0.6 * cap);
  const o2Low = r.o2 < 10 * need.o2;
  const waterLow = r.water < 60;
  const rank = (ty) => ({ extractor: waterLow ? 0 : 3, moxie: o2Low ? 1 : 2, greenhouse: o2Low ? 2 : 1, gym: 1.5 })[ty] ?? 4;
  consumers.sort((a, b) => rank(a.m.type) - rank(b.m.type));
  for (const c of consumers) {
    const on = c.u <= budget + 1e-9;
    if (on) budget -= c.u;
    if (c.m.enabled !== on) safe(game, { type: 'toggle', slotId: c.sl.id, enabled: on });
  }
}

function build(game, crewNeed) {
  const s = game.state, r = s.resources;
  const d = (a) => safe(game, a);
  const freeSlot = (p) => PREFERRED_SLOTS.find((id) => p.free.includes(id));
  const costOf = (ty) => { const o = sel.buildOptions(s, 's1').find((x) => x.type === ty); return o ? o.cost : { parts: 1e9 }; };
  const costOk = (c, reserve = 0) => (c.parts || 0) + reserve <= r.parts && (c.regolith || 0) <= r.regolith;
  const cand = Math.min(SHIP.maxCandidates, SHIP.candidates + Math.floor((s.sim.shipsArrived || 0) / 2));
  for (let guard = 0; guard < 8; guard++) {
    const p = plan(s);
    const n = s.colonists.length;
    const need = (k) => { const c = crewNeed(k); return { ...c, water: c.water + p.ghWater }; };
    const of = (ty) => (p.byType[ty] || []);
    const upgradeCheapest = (ty) => {
      const cands = of(ty).filter((sl) => sl.module.status === 'ok' && sl.module.level < 3 && sel.upgradeInfo(s, sl.id)?.ok)
        .sort((a, b) => a.module.level - b.module.level);
      return cands.length ? d({ type: 'upgrade', slotId: cands[0].id }) : false;
    };
    const makeRoom = () => {
      const spare = (sl) => {
        const m = sl.module;
        if (m.level !== 1 || m.status !== 'ok') return false;
        if (m.type === 'solar') return p.gen - spec(m).area * SOLAR_YIELD_CLEAR_KWH_M2_SOL >= (p.load + 80) * 1.15;
        if (m.type === 'battery') return p.battery - spec(m).capacity >= Math.max(0.62 * p.load, 11 * Math.max(0, p.habUse - p.reactor - 0.04 * p.solar));
        return false;
      };
      const sl = [...of('solar'), ...of('battery')].find(spare);
      return sl ? d({ type: 'demolish', slotId: sl.id }) : false;
    };
    const buildOrUpgrade = (ty, keepFree = 2, preferUpgrade = false) => {
      if (preferUpgrade && upgradeCheapest(ty)) return true;
      const slot = freeSlot(p);
      if (slot && p.free.length > keepFree && costOk(costOf(ty)) && d({ type: 'build', slotId: slot, moduleType: ty })) return true;
      if (upgradeCheapest(ty)) return true;
      if (!['greenhouse', 'habitat', 'extractor', 'moxie'].includes(ty) || !costOk(costOf(ty), 10)) return false;
      if (slot) return d({ type: 'build', slotId: slot, moduleType: ty });
      return makeRoom();
    };
    const power = () => {
      if (has(s, 'fission') && !of('reactor').length) {
        const slot = freeSlot(p);
        if (slot && costOk(costOf('reactor'))) return d({ type: 'build', slotId: slot, moduleType: 'reactor' });
        if (r.parts < 45) return false;
      }
      if (of('reactor').length && upgradeCheapest('reactor')) return true;
      return buildOrUpgrade('solar', 1, p.free.length < 6);
    };
    const powerOk = (extra) => p.gen >= (p.load + extra) * 1.15;
    const batteryOk = (extra) => p.battery >= 0.62 * (p.load + extra);
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
    const capNow = sel.capacity(s);
    const nearCap = ['o2', 'water', 'food'].some((k) => r[k] > 0.85 * capNow[k]);
    const gymLevels = of('gym').reduce((a, sl) => a + sl.module.level, 0);
    const savingForDome = has(s, 'domeEngineering') && !of('dome').length && n >= 8;
    const dome = () => {
      const slot = freeSlot(p);
      return !!slot && costOk(costOf('dome')) && d({ type: 'build', slotId: slot, moduleType: 'dome' });
    };
    const rules = [
      [() => !of('moxie').length, () => { const sl = freeSlot(p); return !!sl && d({ type: 'build', slotId: sl, moduleType: 'moxie' }); }, true],
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

// Presenter mode only: show the crafting system once, at low priority (spare parts, room left, not saving for the dome).
const CRAFT_SHOW_MIN_SOL = 10;
const CRAFT_SHOW_MIN_PARTS = 15;
function craftShow(game) {
  const s = game.state, r = s.resources;
  const p = plan(s);
  const of = (ty) => (p.byType[ty] || []);
  const ready = (ty) => of(ty).some((sl) => sl.module.status === 'ok');
  if (ready('craftTable') && invGet(s, 'iron') >= 3 && !(s.inv && s.inv.ironBar)) {
    return safe(game, { type: 'craft', recipeId: 'ironBar' }) ? 'crafted' : null;
  }
  if (s.t < CRAFT_SHOW_MIN_SOL || r.parts < CRAFT_SHOW_MIN_PARTS || p.free.length < 6) return null;
  if (has(s, 'domeEngineering') && !of('dome').length) return null;
  const slot = [...PREFERRED_SLOTS].reverse().find((id) => p.free.includes(id)); // outer slots, away from the core
  if (!slot) return null;
  if (!of('drillBasic').length) safe(game, { type: 'build', slotId: slot, moduleType: 'drillBasic' });
  else if (!of('craftTable').length) safe(game, { type: 'build', slotId: slot, moduleType: 'craftTable' });
  return null;
}

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
  if (!opt || !opt.ok || r.energy < EXPEDITIONS[site].energy + 0.3 * cap) return;
  safe(game, { type: 'startExpedition', site, colonistId: pick.id });
}

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
      safe(game, { type: 'assign', colonistId: free.splice(i, 1)[0].id, slotId: sl.id });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Script

const BEAT_SECONDS = { intro: 7, moxie: 7, water: 6, dust: 7, spe: 7, tech: 6, ship: 7, expedition: 6, city: 6, grow: 6, reactor: 6, domeTech: 6, dome: 7, lost: 6 };
const CONTINUE_KEYS = new Set([' ', 'Spacebar', 'Enter', 'ArrowRight']);

/*
 * Two modes:
 *  - 'presenter' (default, ?demo=1 and the title-screen button): the bot plays fast between beats; when a beat
 *    starts or the demo opens a panel, the sim freezes (no ticks, no bot) until the presenter continues
 *    (Space / Enter / ArrowRight / the button). MAX_REAL counts only un-paused time.
 *  - 'auto' (?demo=auto): the original timed show for unattended screens.
 */

/**
 * h = { getGame, modalsOpen, closeModals, openTech, openCraft, showScience(id), onExit, onReplay, onPlay }
 */
export function createAutoplay(h) {
  const hasDom = typeof document !== 'undefined';
  let active = false, finished = false;
  let tReal = 0, budget = 0, modalT = 0, modalLimit = STRAY_MODAL_SECONDS;
  let cur = null;
  let queue = [];
  let seen = new Set();
  let log = [];
  let ships = 0;
  let ui = null;
  let presenter = true;
  let hold = 10;   // presenter mode: seconds each stop stays before going on by itself (0 = wait for the key)
  let waitT = 0;   // real seconds spent on the current stop
  let lastWall = 0; // wall clock of the previous update (the hold time must not depend on the frame rate)
  const wallNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  let demoModal = false; // presenter mode: a panel/modal the demo opened is waiting for the presenter

  function buildUi() {
    if (!hasDom || ui) return;
    const mk = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
    const caption = mk('div', 'demo-caption');
    caption.hidden = true;
    const capText = mk('div', 'demo-caption-text');
    capText.setAttribute('role', 'status');
    capText.setAttribute('aria-live', 'polite');
    const cont = mk('button', 'btn btn-primary demo-continue');
    cont.type = 'button';
    cont.hidden = true;
    cont.addEventListener('click', () => { advance(); try { cont.blur(); } catch (e) { /* ignore */ } });
    caption.append(capText, cont);
    const badge = mk('div', 'demo-badge');
    const badgeLabel = mk('span', 'demo-badge-label');
    const exitBtn = mk('button', 'btn demo-exit');
    exitBtn.type = 'button';
    exitBtn.addEventListener('click', () => h.onExit());
    badge.append(badgeLabel, exitBtn);
    const end = mk('div', 'demo-end-back');
    end.hidden = true;
    document.body.append(caption, badge, end);
    ui = { caption, capText, cont, badge, badgeLabel, exitBtn, end };
    window.addEventListener('keydown', (e) => {
      if (!active || e.key !== 'Escape') return;
      e.preventDefault(); e.stopPropagation();
      h.onExit();
    }, true);
    onLangChange(() => { if (active) paint(); });
  }

  function paint() {
    if (!ui) return;
    ui.badgeLabel.textContent = t('demo.badge');
    ui.exitBtn.textContent = t('demo.exit');
    const wait = waiting();
    if (cur || wait) {
      ui.capText.textContent = cur ? t('demo.b.' + cur.key) : '';
      ui.capText.hidden = !cur;
      const left = hold > 0 && wait ? Math.max(0, Math.ceil((cur && cur.key === 'dome' ? Math.max(hold, 8) : hold) - waitT)) : null;
      ui.cont.textContent = t('demo.continue') + (left != null ? ' · ' + left : '');
      ui.cont.hidden = !wait;
      ui.caption.hidden = false;
    } else { ui.caption.hidden = true; ui.cont.hidden = true; }
    if (finished && !ui.end.hidden) renderEnd();
  }

  function renderEnd() {
    const mk = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
    const card = mk('div', 'demo-end');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.append(mk('h2', '', t('demo.end.title')), mk('p', 'demo-end-line', t('demo.end.l1')), mk('p', 'demo-end-line', t('demo.end.l2')), mk('p', 'demo-end-line', t('demo.end.l3')));
    const row = mk('div', 'demo-end-row');
    const replay = mk('button', 'btn', t('demo.end.replay')); replay.type = 'button'; replay.addEventListener('click', () => h.onReplay());
    const play = mk('button', 'btn btn-primary', t('demo.end.play')); play.type = 'button'; play.addEventListener('click', () => h.onPlay());
    row.append(replay, play);
    card.append(row);
    ui.end.replaceChildren(card);
    setTimeout(() => { try { play.focus(); } catch (e) { /* ignore */ } }, 0);
  }

  function waiting() { return active && !finished && presenter && (!!cur || demoModal); }

  /** Presenter continues: close what the demo opened, end the beat, resume fast play. No-op when nothing waits. */
  function advance() {
    if (!waiting()) return false;
    waitT = 0;
    if (h.modalsOpen()) { try { h.closeModals(); } catch (e) { /* ignore */ } }
    demoModal = false; modalT = 0; modalLimit = STRAY_MODAL_SECONDS;
    if (cur) endBeat(); else paint();
    return true;
  }

  function onKey(e) {
    if (!active || finished || !presenter) return;
    if (e.ctrlKey || e.metaKey || e.altKey || !CONTINUE_KEYS.has(e.key)) return;
    if (!waiting()) return; // nothing to continue: leave the key alone
    e.preventDefault(); e.stopPropagation();
    if (e.repeat) return; // holding the key must not skip several beats
    advance();
  }

  function push(key) {
    if (seen.has(key) || finished) return;
    seen.add(key);
    queue.push(key);
  }

  function startBeat(key) {
    cur = { key, until: presenter ? Infinity : tReal + (BEAT_SECONDS[key] || 6), slow: key !== 'intro' };
    log.push({ key, at: Math.round(tReal), sol: Math.floor(h.getGame().state.t) + 1 });
    if (key === 'dome' && h.showVictory) { try { h.showVictory(); } catch (e) { /* ignore */ } }
    if (key === 'craft' && h.openCraft && !h.modalsOpen()) { try { h.openCraft(); modalLimit = TECH_SECONDS; modalT = 0; demoModal = presenter; } catch (e) { /* ignore */ } }
    if (key === 'tech' && h.openTech && !h.modalsOpen()) { try { h.openTech(); modalLimit = TECH_SECONDS; modalT = 0; demoModal = presenter; } catch (e) { /* ignore */ } }
    if (key === 'city' && hasDom) {
      const cp = document.getElementById('city-panel');
      if (cp) { cp.classList.remove('is-collapsed'); cp.classList.add('demo-focus'); }
    }
    paint();
  }
  function endBeat() {
    if (cur && cur.key === 'dome' && h.hideVictory) { try { h.hideVictory(); } catch (e) { /* ignore */ } }
    if (cur && cur.key === 'city' && hasDom) { const cp = document.getElementById('city-panel'); if (cp) cp.classList.remove('demo-focus'); }
    const k = cur && cur.key;
    cur = null;
    paint();
    if (k === 'dome' || k === 'lost') finish();
  }

  function finish() {
    if (finished) return;
    finished = true;
    cur = null; queue = []; demoModal = false;
    log.push({ key: 'end', at: Math.round(tReal), sol: Math.floor(h.getGame().state.t) + 1 });
    if (h.closeModals) { try { h.closeModals(); } catch (e) { /* ignore */ } }
    if (ui) { ui.caption.hidden = true; ui.end.hidden = false; renderEnd(); }
  }

  function update(dtReal) {
    if (!active || finished) return;
    const dt = Math.max(0, Math.min(0.1, dtReal || 0));
    const wall = wallNow();
    const wallDt = lastWall ? Math.max(0, Math.min(1, (wall - lastWall) / 1000)) : 0;
    lastWall = wall;
    if (presenter) {
      if (demoModal && !h.modalsOpen()) { demoModal = false; paint(); } // presenter closed the panel by hand
      if (!cur && queue.length) startBeat(queue.shift());
      if (cur || demoModal) { // frozen (no ticks, no bot, no clock) until the key or until the hold time runs out
        if (hold > 0) {
          const before = Math.ceil(hold - waitT);
          waitT += wallDt;
          if (waitT >= (cur && cur.key === 'dome' ? Math.max(hold, 8) : hold)) { advance(); return; } // the victory scene stays at least 8 s
          if (Math.ceil(hold - waitT) !== before) paint();
        }
        return;
      }
      waitT = 0;
    }
    tReal += dt;
    if (h.modalsOpen()) {
      modalT += dt;
      if (modalT >= modalLimit) { try { h.closeModals(); } catch (e) { /* ignore */ } modalT = 0; modalLimit = STRAY_MODAL_SECONDS; }
    } else { modalT = 0; modalLimit = STRAY_MODAL_SECONDS; }
    if (cur && tReal >= cur.until) endBeat();
    if (finished) return;
    if (!cur && queue.length) startBeat(queue.shift());
    if (!cur && tReal >= (presenter ? MAX_REAL_PRESENTER : MAX_REAL)) { finish(); return; }
    const game = h.getGame();
    if (game.state.over) { push('lost'); return; }
    if (h.modalsOpen()) return; // the sim waits while a panel is on screen
    // city panel shows up when the colony grows
    if (hasDom && !seen.has('city')) { const cp = document.getElementById('city-panel'); if (cp && !cp.hidden && game.state.t > 30) push('city'); }
    const spd = cur && cur.slow ? SLOW : FAST;
    budget += (dt * spd) / SOL_REAL;
    let guard = 0;
    while (budget >= CHUNK && guard++ < 60 && !game.state.over) {
      demoPolicy(game);
      if (presenter && !seen.has('craft') && craftShow(game) === 'crafted') push('craft');
      game.tick(CHUNK);
      budget -= CHUNK;
    }
  }

  /** Called with the events main.js drained this frame. */
  function onEvents(events) {
    if (!active || finished) return;
    for (const ev of events) {
      if (ev.type === 'build.done' && ev.level === 1) {
        if (ev.moduleType === 'moxie') push('moxie');
        else if (ev.moduleType === 'extractor' || ev.moduleType === 'greenhouse') push('water');
        else if (ev.moduleType === 'reactor') push('reactor');
        else if (ev.moduleType === 'dome') push('dome');
        else if (presenter && ev.moduleType === 'drillBasic') push('drill');
      } else if (ev.type === 'event.start') {
        if (ev.kind === 'dustRegional' || ev.kind === 'dustGlobal') push('dust');
        else if (ev.kind === 'spe') push('spe');
        else if (presenter && ev.kind === 'dustDevil') push('devil');
        else if (presenter && ev.kind === 'marsquake') push('quake');
        else if (presenter && ev.kind === 'failure') push('failure');
      } else if (ev.type === 'tech.unlocked') push(ev.techId === 'domeEngineering' ? 'domeTech' : 'tech');
      else if (ev.type === 'ship.arrived') { ships++; push('ship'); if (ships >= 3) push('grow'); }
      else if (ev.type === 'expedition.done') push('expedition');
      else if (ev.type === 'milestone' && ev.id === 'dome') push('dome');
      else if (ev.type === 'game.over') push('lost');
    }
  }

  /** main.js routes science.panel events here while the demo runs. */
  function onScience(id) {
    if (!active || finished || !SHOW_PANELS.has(id) || seen.has('panel.' + id)) return;
    seen.add('panel.' + id);
    if (id === 'moxieEnergy') push('moxie');
    if (h.modalsOpen()) return;
    try { h.showScience(id); modalLimit = PANEL_SECONDS; modalT = 0; demoModal = presenter; } catch (e) { /* ignore */ }
    log.push({ key: 'panel.' + id, at: Math.round(tReal), sol: Math.floor(h.getGame().state.t) + 1 });
    paint();
  }

  /** opts.mode: 'presenter' (default) or 'auto' (the original timed show). */
  function start(opts = {}) {
    buildUi();
    presenter = opts.mode !== 'auto';
    hold = Number.isFinite(opts.hold) && opts.hold >= 0 ? opts.hold : 10;
    waitT = 0;
    demoModal = false;
    if (hasDom) { window.removeEventListener('keydown', onKey, true); if (presenter) window.addEventListener('keydown', onKey, true); }
    active = true; finished = false;
    tReal = 0; budget = 0; modalT = 0; modalLimit = STRAY_MODAL_SECONDS;
    cur = null; queue = []; seen = new Set(); log = [];
    if (hasDom) document.body.classList.add('is-demo');
    if (ui) { ui.end.hidden = true; ui.end.replaceChildren(); ui.badge.hidden = false; }
    ships = 0;
    push('intro');
    push('moxie');
    paint();
  }
  function stop() {
    active = false; finished = false; cur = null; queue = []; demoModal = false;
    if (hasDom) {
      window.removeEventListener('keydown', onKey, true);
      document.body.classList.remove('is-demo');
      const cp = document.getElementById('city-panel'); if (cp) cp.classList.remove('demo-focus');
    }
    if (ui) { ui.caption.hidden = true; ui.cont.hidden = true; ui.end.hidden = true; ui.end.replaceChildren(); ui.badge.hidden = true; }
  }

  return {
    start, stop, update, onEvents, onScience, advance,
    get mode() { return presenter ? 'presenter' : 'auto'; },
    get paused() { return waiting(); },
    get active() { return active; },
    get finished() { return finished; },
    get log() { return log; },
    get elapsed() { return tReal; },
  };
}
