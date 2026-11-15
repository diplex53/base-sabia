// World layout shared by the renderer. 1 voxel = 1 unit.
// Slot cells keep the Apêndice E.1 origin: x = (gx - 2.5) * CELL, z = (gz - 2.5) * CELL, for every grid size.
// The 72-slot map spans gx -1..7, gz -1..6 (see SLOTS in src/data/balance.js), i.e. x in [-40, 50], z in [-40, 40].

export const CELL = 10;          // slot cell size
export const PAD = 9;            // slot footprint (leaves a 1-unit walkway between slots)
export const PAD_H = 0;          // slots are flush with the soil; module models stand on the ground
export const TERRAIN_HALF = 80;  // detailed voxel terrain spans [-80, 80] in x and z
export const FAR_HALF = 720;     // low-cost far ground spans [-720, 720] (about 80x the voxel area)
export const PAN_LIMIT = 165;    // camera target clamp

export let GRID_N = 6;
export function setGridSize(n) { GRID_N = Math.max(1, Math.min(12, n | 0)); }
/** Size of the core square grid (kept for the dome, which covers the original 6x6 block). */
export function gridSizeOf() { return 6; }

export const DEFAULT_BOUNDS = { gx0: -1, gx1: 7, gz0: -1, gz1: 6 };
/** Cell bounds of a slot list: { gx0, gx1, gz0, gz1 } (inclusive). */
export function gridBoundsOf(slots) {
  let gx0 = Infinity, gx1 = -Infinity, gz0 = Infinity, gz1 = -Infinity;
  for (const s of slots || []) {
    if (typeof s.gx !== 'number' || typeof s.gz !== 'number') continue;
    gx0 = Math.min(gx0, s.gx); gx1 = Math.max(gx1, s.gx); gz0 = Math.min(gz0, s.gz); gz1 = Math.max(gz1, s.gz);
  }
  if (!isFinite(gx0)) return { ...DEFAULT_BOUNDS };
  return { gx0, gx1, gz0, gz1 };
}
/** World rectangle of the build area (cell edges): { x0, x1, z0, z1, cx, cz }. */
export function boundsRect(b) {
  const x0 = (b.gx0 - 3) * CELL, x1 = (b.gx1 - 2) * CELL, z0 = (b.gz0 - 3) * CELL, z1 = (b.gz1 - 2) * CELL;
  return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
}

export function cellCenter(gx, gz) {
  return { x: (gx - 2.5) * CELL, z: (gz - 2.5) * CELL };
}

// Mirrors SITES in src/data/balance.js (Apêndice A.2). The state does not carry sites.
// Absolute world positions, outside the 72-slot build area (x [-40, 50], z [-40, 40]) and outside the dome.
export const SITES = [
  { id: 'ice', x: -62, z: -30 },
  { id: 'regolith', x: 68, z: -12 },
  { id: 'minerals', x: 68, z: 22 },
];

// Fixed props south of the grid.
export const LANDING_PAD = { x: -18, z: 54 };
export const GARAGE = { x: 22, z: 54 };

// Fallback battery capacities (kWh) per level, used only if src/data/balance.js cannot be loaded.
export const BATTERY_CAPACITY_FALLBACK = [60, 120, 200];
