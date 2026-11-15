// Sheltering (DESIGN 7 "Abrigar todos", Apêndice B.3).
// {type:'setShelter', on} -> state.sheltering. While on, colonists on base go to location 'shelter' up to the
// places of usable shelters; the rest stay in 'habitat'. assignedTo is kept and applies again when it is off.
// While on: no staff bonus (model.staffMult), construction / cleaning / repair paused, no expedition can leave.
// Who gets a place: those already sheltered, then active before retired, then highest dose first.
import { shelterPlaces } from './model.js';
import { showPanel } from './alerts.js';

/** Recompute the location of everyone on base. Idempotent; runs every step and after every action. */
export function placeColonists(state) {
  const onBase = state.colonists.filter((c) => c.location !== 'expedition');
  if (!state.sheltering) {
    for (const c of onBase) c.location = c.assignedTo ? 'module' : 'habitat';
    return;
  }
  const order = onBase.map((c, i) => ({ c, i })).sort((a, b) => (
    (b.c.location === 'shelter') - (a.c.location === 'shelter')
    || (b.c.status === 'active') - (a.c.status === 'active')
    || b.c.dose - a.c.dose
    || a.i - b.i));
  let places = shelterPlaces(state);
  for (const { c } of order) {
    if (places > 0) { c.location = 'shelter'; places--; } else c.location = 'habitat';
  }
}

export function actSetShelter(state, { on }, emit) {
  const want = typeof on === 'boolean' ? on : !state.sheltering;
  if (want === state.sheltering) return null;
  state.sheltering = want;
  placeColonists(state);
  if (want) showPanel(state, emit, 'alara');
  return null;
}

export const stepShelter = (state) => placeColonists(state);
