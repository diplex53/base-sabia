// Colonists: assignment (Apêndice A.4 'assign') and retirement.
// A module holds at most one colonist; an assigned colonist gives the module +STAFF_BONUS.

export const findColonist = (state, id) => state.colonists.find((c) => c.id === id);

/** Remove a colonist from whatever module they staff and send them back to the habitat. */
export function unassign(state, c) {
  if (c.assignedTo) {
    const sl = state.slots.find((s) => s.id === c.assignedTo);
    if (sl && sl.module) sl.module.staff = sl.module.staff.filter((id) => id !== c.id);
  }
  c.assignedTo = null;
  if (c.location === 'module') c.location = 'habitat';
}

/** Unassign every colonist staffing a slot (used by demolish). */
export function clearStaff(state, slot) {
  if (!slot.module) return;
  for (const id of slot.module.staff) {
    const c = findColonist(state, id);
    if (c) { c.assignedTo = null; if (c.location === 'module') c.location = 'habitat'; }
  }
  slot.module.staff = [];
}

export function actAssign(state, { colonistId, slotId }) {
  const c = findColonist(state, colonistId);
  if (!c) return 'err.noSuchColonist';
  if (c.status !== 'active' || c.location === 'expedition') return 'err.busy';
  if (slotId === null || slotId === undefined) {
    unassign(state, c);
    return null;
  }
  const sl = state.slots.find((s) => s.id === slotId);
  if (!sl) return 'err.noSuchSlot';
  if (!sl.module) return 'err.slotEmpty';
  if (sl.module.staff.length > 0 && sl.module.staff[0] !== c.id) return 'err.busy';
  if (c.assignedTo === slotId) return null;
  unassign(state, c);
  sl.module.staff = [c.id];
  c.assignedTo = slotId;
  c.location = 'module';
  return null;
}

/** Career limit reached (DESIGN 5.5): stops working, keeps consuming, leaves on the next ship. */
export function retire(state, c, emit) {
  unassign(state, c);
  c.status = 'retired';
  emit({ type: 'colonist.retired', colonistId: c.id });
}
