// World layout shared by the renderer. 1 voxel = 1 unit.
// The grid size N (slots per side) is derived from the state (max gx/gz + 1); 4 -> 16 slots, 6 -> 36 slots.

export const CELL = 10;          // slot cell size
export const PAD = 9;            // slot pad size (leaves a 1-unit walkway between pads)
export const PAD_H = 0.5;        // pad height; module models stand on top of it
export const TERRAIN_HALF = 64;  // terrain spans [-64, 64] in x and z
export const PAN_LIMIT = 55;     // camera target clamp

export let GRID_N = 4;
export function setGridSize(n) { GRID_N = Math.max(1, Math.min(12, n | 0)); }
export function gridSizeOf(slots) {
  let m = 0;
  for (const s of slots || []) {
    if (typeof s.gx === 'number') m = Math.max(m, s.gx + 1);
    if (typeof s.gz === 'number') m = Math.max(m, s.gz + 1);
  }
  return Math.max(4, m);
}

// x = (gx - (n-1)/2) * CELL, same for z
export function cellCenter(gx, gz) {
  const o = (GRID_N - 1) / 2;
  return { x: (gx - o) * CELL, z: (gz - o) * CELL };
}

// Mirrors SITES in src/data/balance.js (Apêndice A.2). The state does not carry sites.
// Absolute world positions, outside the 6x6 grid (which spans [-30, 30]) and outside the dome.
export const SITES = [
  { id: 'ice', x: -48, z: -34 },
  { id: 'regolith', x: 50, z: -10 },
  { id: 'minerals', x: 50, z: 20 },
];

// Fixed props south of the grid.
export const LANDING_PAD = { x: -20, z: 49 };
export const GARAGE = { x: 20, z: 49 };

// Fallback battery capacities (kWh) per level, used only if src/data/balance.js cannot be loaded.
export const BATTERY_CAPACITY_FALLBACK = [60, 120, 200];
