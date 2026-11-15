// Supply ships with a choice (DESIGN 7, Apêndice B.5).
// announceSols before arrival: ship.manifest = { cargo, candidates: [{ name, profession }] } and ship.incoming.
//   candidates = min(maxCandidates, candidates + floor(shipsArrived / 2)), professions drawn with the seeded RNG.
// On arrival: cargo is unloaded, retired colonists on base board for Earth, ship.awaitingDecision = true,
//   ship.offer = [{ idx, name, profession, ok, reason }] (sustain test of each one alone) and ship.arrived.
// {type:'shipDecision', acceptIdx}: validated one by one, in order, counting the ones already accepted
//   -> ship.landed { landed, refused: [{ idx, reason }] }. With no decision after waitSols, every candidate
//   that passes is accepted.
// Sustain test for one more person:
//   1. a free habitat place;
//   2. O2:    stock + horizon * nominal production >= horizon * consumption;
//   3. water: same, with recycling and greenhouse irrigation;
//   4. food:  stock (cargo included) + horizon * nominal production >= horizon * consumption;
// horizon = SHIP.intervalSols. "Nominal production" = rated output of built, enabled, working modules (techs included).
import { SHIP, PROFESSIONS } from '../data/balance.js';
import { newColonist, pickName } from './state.js';
import { random } from './rng.js';
import { peopleCapacity, headcount, nominalProduction, crewUse, activeCount } from './model.js';
import { unassign } from './colonists.js';
import { showPanel } from './alerts.js';
import { grantParts, invAdd } from './crafting.js';
import { SHIP_ORES } from '../data/crafting.js';

/** Why one more person cannot land ('habitat' | 'o2' | 'water' | 'food') or null. */
export function sustainCheck(state) {
  const n = headcount(state) + 1;
  if (peopleCapacity(state, 'habitat') < n) return 'habitat';
  const H = SHIP.intervalSols;
  const p = nominalProduction(state);
  const use = crewUse(state, n);
  const r = state.resources;
  if (r.o2 + H * p.o2 < H * use.o2) return 'o2';
  if (r.water + H * p.water < H * (use.water + p.ghWater)) return 'water';
  if (r.food + H * p.food < H * use.food) return 'food';
  return null;
}

/** Cargo of the next ship: base * (1 + cargoGrowth * shipsSoFar), rounded down (DESIGN 7 "crescendo"). */
function nextCargo(state) {
  const k0 = 1 + (SHIP.cargoGrowth || 0) * (state.sim.shipsArrived || 0);
  const cargo = {};
  for (const k of Object.keys(SHIP.cargo)) cargo[k] = Math.floor(SHIP.cargo[k] * k0);
  return cargo;
}

function makeManifest(state) {
  const n = Math.min(SHIP.maxCandidates, SHIP.candidates + Math.floor((state.sim.shipsArrived || 0) / 2));
  const candidates = [];
  for (let i = 0; i < n; i++) {
    const name = pickName(state, candidates.map((c) => c.name));
    const profession = PROFESSIONS[Math.floor(random(state) * PROFESSIONS.length)];
    candidates.push({ name, profession });
  }
  return { cargo: nextCargo(state), candidates };
}

function arrive(state, emit) {
  const sh = state.ship;
  const manifest = sh.manifest || makeManifest(state);
  const cargo = manifest.cargo;
  for (const [k, v] of Object.entries(cargo)) { if (k === 'parts') grantParts(state, v); else state.resources[k] = (state.resources[k] || 0) + v; }
  if (state.economy === 'craft') for (const [k, v] of Object.entries(SHIP_ORES)) invAdd(state, k, v);
  state.sim.shipsArrived = (state.sim.shipsArrived || 0) + 1;

  // retired colonists on base go home (one still on an expedition waits for the next ship)
  const leaving = state.colonists.filter((x) => x.status === 'retired' && x.location !== 'expedition');
  const departed = leaving.map((c) => { unassign(state, c); return c.id; });
  state.colonists = state.colonists.filter((x) => !leaving.includes(x));

  const reason = sustainCheck(state);
  sh.offer = manifest.candidates.map((c, idx) => ({ idx, name: c.name, profession: c.profession, ok: !reason, reason }));
  sh.awaitingDecision = true;
  sh.decideBy = state.t + SHIP.waitSols;
  sh.manifest = null;
  sh.nextArrivalT += SHIP.intervalSols;
  emit({ type: 'ship.arrived', cargo, departed, offer: sh.offer.map((o) => ({ ...o })) });
}

/** Land the chosen candidates (validated in order, counting the ones already landed). */
function decide(state, acceptIdx, emit) {
  const sh = state.ship;
  const landed = [];
  const refused = [];
  const seen = new Set();
  for (const idx of acceptIdx) {
    const cand = sh.offer.find((o) => o.idx === idx);
    if (!cand || seen.has(idx)) continue;
    seen.add(idx);
    const reason = sustainCheck(state);
    if (reason) { refused.push({ idx, reason }); continue; }
    const c = newColonist(state, { name: cand.name, profession: cand.profession });
    state.colonists.push(c);
    landed.push(c.id);
  }
  sh.awaitingDecision = false;
  sh.offer = null;
  sh.decideBy = null;
  state.stats.popPeak = Math.max(state.stats.popPeak, activeCount(state));
  emit({ type: 'ship.landed', landed, refused });
  if (refused.length) showPanel(state, emit, 'shipRefused');
}

export function actShipDecision(state, { acceptIdx }, emit) {
  if (!state.ship.awaitingDecision) return 'err.noShip';
  if (!Array.isArray(acceptIdx)) return 'err.badRequest';
  decide(state, acceptIdx, emit);
  return null;
}

export function stepShips(state, emit) {
  if (state.story && !state.unlocked.features.includes('ships')) return;
  const sh = state.ship;
  if (sh.awaitingDecision && state.t >= sh.decideBy - 1e-9) {
    // no decision in time: accept everyone who passes
    decide(state, sh.offer.map((o) => o.idx), emit);
  }
  if (!sh.manifest && !sh.awaitingDecision && state.t >= sh.nextArrivalT - SHIP.announceSols - 1e-9 && state.t < sh.nextArrivalT - 1e-9) {
    sh.manifest = makeManifest(state);
    emit({ type: 'ship.incoming', manifest: JSON.parse(JSON.stringify(sh.manifest)), arrivesAt: sh.nextArrivalT });
    showPanel(state, emit, 'launchWindow');
  }
  if (state.t >= sh.nextArrivalT - 1e-9) {
    if (sh.awaitingDecision) decide(state, sh.offer.map((o) => o.idx), emit);
    arrive(state, emit);
  }
}
