// Expeditions (DESIGN 8, Apêndice B.7).
// {type:'startExpedition', site, colonistId}: an active colonist on base, a free rover (1; 2 with pressurizedRover),
// the energy (taken from the battery at departure), no global dust storm, no sheltering.
// Getting stuck (stuckChance, like Spirit in 2009) is drawn at departure and revealed halfway out:
// endT += stuckSols and the rover makes no progress for stuckSols. During a global storm nothing advances.
// At the end: reward (floored) and science, x GEOLOGIST_MULT with a geologist; the colonist is back on base.
// {type:'recallExpedition', id}: comes back in 0.5 * elapsed (+ what is left of being stuck), with
// reward and science x min(1, elapsed / sols).
// Fields beyond the contract: elapsed (outbound progress, sols), stuckLeft, stuckRevealed, rewardFrac.
import { EXPEDITIONS, EXPEDITION_SITES, GEOLOGIST_MULT } from '../data/balance.js';
import { TECH_EFFECTS } from '../data/tech.js';
import { random } from './rng.js';
import { hasTech } from './model.js';
import { findColonist, unassign } from './colonists.js';
import { showPanel } from './alerts.js';

export const roverCount = (state) => (hasTech(state, 'pressurizedRover') ? TECH_EFFECTS.roversTech : TECH_EFFECTS.rovers);

/** Selector: rovers not on an expedition. */
export const roversFree = (state) => Math.max(0, roverCount(state) - state.expeditions.length);

const globalStorm = (state) => !!(state.env.storm && state.env.storm.kind === 'global');
const availableColonist = (c) => c.status === 'active' && c.location !== 'expedition';

/** Checks that do not depend on the colonist (shared with expeditionOptions). */
function checkConditions(state, site) {
  if (state.story && !state.unlocked.features.includes('expeditions')) return 'err.locked';
  if (state.sheltering) return 'err.sheltering';
  if (globalStorm(state)) return 'err.storm';
  if (roversFree(state) <= 0) return 'err.noRover';
  if (state.resources.energy < EXPEDITIONS[site].energy - 1e-9) return 'err.notEnoughEnergy';
  return null;
}

export function checkExpedition(state, site, colonistId) {
  if (!EXPEDITION_SITES.includes(site)) return 'err.unknownSite';
  const c = findColonist(state, colonistId);
  if (!c) return 'err.noSuchColonist';
  if (!availableColonist(c)) return 'err.colonistBusy';
  return checkConditions(state, site);
}

export function actStartExpedition(state, { site, colonistId }) {
  const err = checkExpedition(state, site, colonistId);
  if (err) return err;
  const def = EXPEDITIONS[site];
  const c = findColonist(state, colonistId);
  state.resources.energy -= def.energy;
  unassign(state, c);
  c.location = 'expedition';
  state.expeditions.push({
    id: `e${state.sim.nextExpeditionId++}`, site, colonistId, startT: state.t, endT: state.t + def.sols,
    recalled: false, stuck: random(state) < EXPEDITIONS.stuckChance,
    elapsed: 0, stuckLeft: 0, stuckRevealed: false, rewardFrac: 1,
  });
  return null;
}

export function actRecallExpedition(state, { id }) {
  const e = state.expeditions.find((x) => x.id === id);
  if (!e) return 'err.noSuchExpedition';
  if (e.recalled) return 'err.busy';
  e.recalled = true;
  e.rewardFrac = Math.min(1, e.elapsed / EXPEDITIONS[e.site].sols);
  e.endT = state.t + 0.5 * e.elapsed + e.stuckLeft;
  return null;
}

function finish(state, e, emit) {
  const def = EXPEDITIONS[e.site];
  const c = findColonist(state, e.colonistId);
  const geo = c && c.profession === 'geologist' ? GEOLOGIST_MULT : 1;
  const reward = {};
  for (const [k, v] of Object.entries(def.reward)) {
    reward[k] = Math.floor(v * e.rewardFrac * geo + 1e-9);
    state.resources[k] = (state.resources[k] || 0) + reward[k];
  }
  const science = def.science * e.rewardFrac * geo;
  state.resources.science += science;
  if (c) c.location = 'habitat'; // shelter.placeColonists puts them in the shelter if it is on
  state.expeditions = state.expeditions.filter((x) => x !== e);
  emit({ type: 'expedition.done', id: e.id, site: e.site, colonistId: e.colonistId, reward, science });
  if (e.site === 'ice') showPanel(state, emit, 'iceOnMars');
}

export function stepExpeditions(state, dt, emit) {
  if (!state.expeditions.length) return;
  const paused = globalStorm(state);
  for (const e of [...state.expeditions]) {
    if (paused) { e.endT += dt; continue; }
    if (e.stuckLeft > 0) e.stuckLeft = Math.max(0, e.stuckLeft - dt);
    else if (!e.recalled) e.elapsed += dt;
    if (!e.recalled && e.stuck && !e.stuckRevealed && e.elapsed >= EXPEDITIONS[e.site].sols / 2 - 1e-9) {
      e.stuckRevealed = true;
      e.stuckLeft = EXPEDITIONS.stuckSols;
      e.endT += EXPEDITIONS.stuckSols;
      emit({ type: 'expedition.stuck', id: e.id });
      showPanel(state, emit, 'roverStuck');
    }
    if (state.t + dt >= e.endT - 1e-9) finish(state, e, emit);
  }
}

/** Selector: every site with its numbers and whether an expedition could leave now (Apêndice B.7). */
export function expeditionOptions(state) {
  const anyone = state.colonists.some(availableColonist);
  return EXPEDITION_SITES.map((site) => {
    const def = EXPEDITIONS[site];
    const reason = checkConditions(state, site) || (anyone ? null : 'err.colonistBusy');
    return { site, sols: def.sols, energy: def.energy, reward: { ...def.reward }, science: def.science, ok: !reason, reason };
  });
}
