// World layout shared by the renderer. 1 voxel = 1 unit.

export const CELL = 10;          // slot cell size
export const PAD = 9;            // slot pad size (leaves a 1-unit walkway between pads)
export const PAD_H = 0.5;        // pad height; module models stand on top of it
export const TERRAIN_HALF = 48;  // terrain spans [-48, 48] in x and z
export const PAN_LIMIT = 40;     // camera target clamp

export function cellCenter(gx, gz) {
  return { x: (gx - 1.5) * CELL, z: (gz - 1.5) * CELL };
}

// Mirrors SITES in src/data/balance.js (Apêndice A.2). The state does not carry sites.
export const SITES = [
  { id: 'ice', gx: -2, gz: -1 },
  { id: 'regolith', gx: 5, gz: 1 },
  { id: 'minerals', gx: 5, gz: 4 },
];

// Fixed props south of the grid (grid spans z in [-20, 20]).
export const LANDING_PAD = { x: -12, z: 31 };
export const GARAGE = { x: 13, z: 31 };

// Fallback battery capacities (kWh) per level, used only if src/data/balance.js cannot be loaded.
export const BATTERY_CAPACITY_FALLBACK = [60, 120, 200];
