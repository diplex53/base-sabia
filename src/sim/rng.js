// Seeded RNG (mulberry32). Its whole state is one uint32 kept in state.rng,
// so the same seed + the same actions always give the same game.

/** Turn any seed (number or string) into a uint32. */
export function seedToUint32(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    // mix the high bits too (Date.now() is larger than 2^32)
    const hi = Math.floor(seed / 4294967296) >>> 0;
    return ((seed >>> 0) ^ Math.imul(hi, 0x9e3779b1)) >>> 0;
  }
  const s = String(seed);
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Next float in [0, 1); advances state.rng. */
export function random(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [min, max] inclusive. */
export const randInt = (state, min, max) => min + Math.floor(random(state) * (max - min + 1));
