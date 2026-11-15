// Technology research (DESIGN 9, Apêndice B.6). {type:'research', techId}: instant purchase with science.
// The effects live where they apply: eds (dust.js), waterRecycling / plantHabitat / bioregen (model.js),
// spaceWeather (events.speWarningSols), regolithPrinting (model.effectiveCost, build.checkUpgrade),
// pressurizedRover (expeditions.roverCount, radiation.js), fission (unlocks the reactor here).
import { TECHS } from '../data/tech.js';
import { hasTech } from './model.js';
import { showPanel } from './alerts.js';

/** Why a tech cannot be researched (error key) or null. */
export function checkResearch(state, techId) {
  const def = TECHS[techId];
  if (!def) return 'err.unknownTech';
  if (state.story && (!state.unlocked.features.includes('tech') || !state.unlocked.techs.includes(techId))) return 'err.locked';
  if (hasTech(state, techId)) return 'err.alreadyResearched';
  if (def.requires.some((r) => !hasTech(state, r))) return 'err.missingPrereq';
  if (state.resources.science < def.cost - 1e-9) return 'err.notEnoughScience';
  return null;
}

export function actResearch(state, { techId }, emit) {
  const err = checkResearch(state, techId);
  if (err) return err;
  state.resources.science = Math.max(0, state.resources.science - TECHS[techId].cost);
  state.tech.unlocked.push(techId);
  if (techId === 'fission' && !state.unlocked.modules.includes('reactor')) state.unlocked.modules.push('reactor');
  emit({ type: 'tech.unlocked', techId });
  showPanel(state, emit, `tech.${techId}`);
  return null;
}

/** Selector: every tech with its state (Apêndice B.6). */
export function techOptions(state) {
  return Object.keys(TECHS).map((id) => {
    const def = TECHS[id];
    const unlocked = hasTech(state, id);
    const reason = checkResearch(state, id);
    return { id, cost: def.cost, requires: [...def.requires], unlocked, ok: !reason, reason };
  });
}
