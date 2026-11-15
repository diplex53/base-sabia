// Story guidance: which step points at which control, plus the lock helpers.
// Colony mode (or an older core) has no `state.unlocked.features`: everything counts as unlocked.

export const FEATURES = ['toggle', 'assign', 'clean', 'ships', 'tech', 'expeditions', 'shelter'];

/** True when the feature is available (always true outside story mode). */
export function featureOn(state, f) {
  const u = state && state.unlocked;
  if (!u || !Array.isArray(u.features)) return true;
  return u.features.includes(f);
}
/** True when the module type may be built. In colony mode the core decides (err.locked). */
export function moduleHidden(state, type) {
  const u = state && state.unlocked;
  if (!state || !state.story || !u || !Array.isArray(u.modules)) return false;
  return !u.modules.includes(type);
}

/**
 * step id -> target.
 *   slots:  'empty' (pulse empty slots) or a module type (pulse slots holding that module)
 *   build:  module type whose build button pulses
 *   hud:    HUD control names: tech, ship, shelter, speed, sites
 *   panel:  buttons inside the module panel: clean, assign
 */
export const STEP_TARGETS = {
  'c1.solar': { slots: 'empty', build: 'solar' },
  'c1.battery': { slots: 'empty', build: 'battery' },
  'c1.night': { hud: ['speed'] },
  'c1.moxie': { slots: 'empty', build: 'moxie' },
  'c1.o2': { slots: 'empty', build: 'solar' },
  'c1.water': { slots: 'empty', build: 'extractor' },
  'c1.food': { slots: 'empty', build: 'greenhouse' },
  'c1.end': { hud: ['speed'] },
  'c2.land': { hud: ['ship'] },
  'c2.assign': { slots: 'solar', panel: ['assign'] },
  'c2.clean': { slots: 'solar', panel: ['clean'] },
  'c2.fission': { hud: ['tech'] },
  'c2.regional': {},
  'c2.global': {},
  'c3.regolith': { hud: ['sites'] },
  'c3.shelter': { slots: 'empty', build: 'shelter' },
  'c3.alert': { hud: ['tech'] },
  'c3.first': { hud: ['shelter'] },
  'c3.minerals': { hud: ['sites'] },
  'c3.severe': { hud: ['shelter'] },
  'c3.dose': {},
  'c3.ship': { hud: ['ship'] },
};

const NONE = { slots: null, build: null, hud: [], panel: [] };

/** Target of the current step (normalized), or an empty target. */
export function currentGuide(state) {
  const st = state && state.story;
  if (!st || st.complete) return NONE;
  const step = st.steps && st.steps[st.stepIdx];
  const tg = step && STEP_TARGETS[step.id];
  if (!tg) return NONE;
  return { slots: tg.slots || null, build: tg.build || null, hud: tg.hud || [], panel: tg.panel || [] };
}

/** Ids of the slots to pulse right now. */
export function guideSlots(state, g) {
  if (!g.slots) return [];
  return state.slots.filter((s) => (g.slots === 'empty' ? !s.module : s.module && s.module.type === g.slots)).map((s) => s.id);
}

/** Tracks what the last step unlocked so the new buttons can glow for a few seconds. */
export function createNewTracker() {
  let seen = null;
  const fresh = new Map(); // 'kind:id' -> expiry (ms)
  const TTL = 9000;
  return {
    update(state) {
      const u = state && state.unlocked;
      if (!u) { seen = null; fresh.clear(); return; }
      const cur = new Set([
        ...(u.modules || []).map((x) => 'module:' + x),
        ...(Array.isArray(u.features) ? u.features : []).map((x) => 'feature:' + x),
      ]);
      const now = Date.now();
      if (seen) for (const k of cur) if (!seen.has(k)) fresh.set(k, now + TTL);
      seen = cur;
      for (const [k, e] of fresh) if (e < now) fresh.delete(k);
    },
    isNew: (kind, id) => fresh.has(kind + ':' + id),
    sig: () => [...fresh.keys()].join(','),
    reset() { seen = null; fresh.clear(); },
  };
}
