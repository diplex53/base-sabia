// Tutorial director. Evidence is stored in the save, independently of the UI event queue.
import { CHAPTERS } from '../data/story.js';
import { isBuilt } from './model.js';
import { netPerSol, score } from './selectors.js';
import { showPanel } from './alerts.js';

export function featureUnlocked(state, feature) {
  return !state.story || state.unlocked.features.includes(feature);
}

const ACTION_FEATURE = { toggle: 'toggle', assign: 'assign', clean: 'clean', repair: 'clean',
  setShelter: 'shelter', research: 'tech', startExpedition: 'expeditions', recallExpedition: 'expeditions', shipDecision: 'ships' };
export function checkStoryAction(state, action) {
  if (!state.story) return null;
  const feature = ACTION_FEATURE[action.type];
  if (feature && !featureUnlocked(state, feature)) return 'err.locked';
  if (action.type === 'research' && !state.unlocked.techs.includes(action.techId)) return 'err.locked';
  return null;
}

export function recordStoryEvent(state, ev) {
  if (!state.story) return;
  const facts = state.story.facts;
  if (ev.type === 'clean.done') facts.cleaned = true;
  if (ev.type === 'event.end') facts.ended.push({ kind: ev.kind, severity: ev.severity || null });
  if (ev.type === 'expedition.done') facts.expeditions.push(ev.site);
  if (ev.type === 'ship.landed') facts.landed += ev.landed.length;
}

export function recordStoryRecall(state, expedition) {
  if (!state.story || !expedition) return;
  const sp = state.env.spe;
  state.story.facts.recalled.push({ site: expedition.site, severeWarning: sp?.severity === 'severe' && sp.phase === 'warning' });
}

function satisfied(state, check) {
  const st = state.story, facts = st.facts;
  switch (check.kind) {
    case 'all': return check.checks.every(c => satisfied(state, c));
    case 'built': return state.slots.filter(sl => isBuilt(sl.module) && sl.module.type === check.module && sl.module.level >= (check.level || 1)).length >= check.count;
    // tReached { t } or { afterStepSols, maxT? }: a fixed time, or some time after the step started (capped at maxT)
    case 'tReached': return state.t >= (check.t ?? Math.min(st.stepStartedAt + check.afterStepSols, check.maxT ?? Infinity)) - 1e-9;
    case 'netNonNegative': return netPerSol(state)[check.res] >= -1e-9;
    case 'stockAtLeast': return state.resources[check.res] >= check.amount;
    case 'assigned': return state.colonists.some(c => c.status === 'active' && (!check.profession || c.profession === check.profession) && state.slots.some(sl => sl.id === c.assignedTo && sl.module?.type === check.module));
    case 'cleaned': return facts.cleaned;
    case 'researched': return state.tech.unlocked.includes(check.tech);
    case 'expeditionDone': return facts.expeditions.includes(check.site);
    case 'eventEnded': return facts.ended.some(e => e.kind === check.event && (!check.severity || e.severity === check.severity));
    case 'shelteredWhen': return facts.sheltered.includes(check.severity || 'any');
    case 'recalled': return facts.recalled.some(r => (!check.site || r.site === check.site) && (!check.duringSevereWarning || r.severeWarning));
    case 'landed': return facts.landed >= check.count;
    case 'maxDoseBelow': return state.colonists.length > 0 && state.colonists.every(c => c.dose < check.msv);
    default: return false;
  }
}

/** A step becomes current: story.step, and its step-relative events go on the schedule ({ in } sols from now). */
export function startStep(state, emit, def) {
  for (const e of def.schedule || []) state.events.scheduled.push({ atT: state.t + e.in, kind: e.kind, params: JSON.parse(JSON.stringify(e.params || {})) });
  emit({ type: 'story.step', id: def.id });
}

export function stepStory(state, emit) {
  const st = state.story;
  if (!st || st.complete || state.over) return;
  if (state.env.spe?.phase === 'active' && state.colonists.length && state.colonists.every(c => c.location === 'shelter')) {
    for (const key of ['any', state.env.spe.severity]) if (!st.facts.sheltered.includes(key)) st.facts.sheltered.push(key);
  }
  const steps = CHAPTERS[st.chapter].steps;
  while (st.stepIdx < steps.length && satisfied(state, steps[st.stepIdx].check)) {
    const def = steps[st.stepIdx];
    st.steps[st.stepIdx].done = true;
    for (const [kind, values] of Object.entries(def.unlock || {})) {
      for (const value of values) if (!state.unlocked[kind].includes(value)) state.unlocked[kind].push(value);
    }
    emit({ type: 'objective.done', id: def.id });
    if (def.panel) showPanel(state, emit, def.panel);
    st.stepIdx++;
    st.stepStartedAt = state.t;
    if (st.stepIdx < steps.length) startStep(state, emit, steps[st.stepIdx]);
  }
  // a maxDoseBelow objective still ahead fails the chapter as soon as someone reaches the limit
  const pending = steps.slice(st.stepIdx).flatMap((s) => (s.check.kind === 'all' ? s.check.checks : [s.check]));
  const dose = pending.find((c) => c.kind === 'maxDoseBelow');
  if (dose && state.colonists.some((c) => c.dose >= dose.msv)) {
    state.over = { reason: 'dose', score: score(state) };
    emit({ type: 'game.over', reason: 'dose', score: state.over.score });
    return;
  }
  if (st.stepIdx === steps.length) {
    st.complete = true;
    emit({ type: 'story.complete', chapter: st.chapter, score: score(state) });
  }
}
