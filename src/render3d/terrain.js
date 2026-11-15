// Voxel heightfield terrain (diorama slab) + static props merged into one geometry.
import { GeoBuilder, colorOf } from './voxels.js';
import { garageBoxes, siteBoxes } from './models.js';
import { CELL, PAD, PAD_H, TERRAIN_HALF, SITES, LANDING_PAD, GARAGE, cellCenter, setGridSize } from './layout.js';
import * as THREE from 'three';

const BOTTOM = -7;
const _c = new THREE.Color();
function lin(hex) { _c.setHex(hex); return [_c.r, _c.g, _c.b]; }
const STRATA = [lin(0x714331), lin(0x965b42), lin(0x4c3640)];

function hash2(x, z) {
  let h = Math.imul(x * 374761393 + z * 668265263, 1274126177);
  h ^= h >>> 13;
  h = Math.imul(h, 1103515245);
  return ((h >>> 0) % 10000) / 10000;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = smooth(x - xi), zf = smooth(z - zi);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

const CRATERS = [
  { x: -44, z: 22, r: 6.5, d: 2.5 },
  { x: 38, z: -50, r: 5.5, d: 2 },
  { x: -58, z: -6, r: 4, d: 1.5 },
  { x: 56, z: 50, r: 3.5, d: 1.2 },
  { x: 8, z: -56, r: 3, d: 1 },
];

function sitePos() {
  return SITES.map((s) => ({ id: s.id, x: s.x, z: s.z }));
}

// Flatness mask: 1 = flattened base area.
let FLAT = 34;   // half extent of the flattened base area (grid half extent + margin)
function flatMask(x, z, sites) {
  const dx = Math.max(0, Math.abs(x) - FLAT);
  const dz = Math.max(0, z < 0 ? -z - FLAT : z - 58);
  let m = 1 - clamp01(Math.hypot(dx, dz) / 7);
  if (z > 0 && Math.abs(x) > FLAT) m = Math.min(m, 1 - clamp01((Math.abs(x) - FLAT) / 7));
  for (const s of sites) m = Math.max(m, 1 - clamp01((Math.hypot(x - s.x, z - s.z) - 5) / 4));
  return m;
}

function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = clamp01(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz));
  return Math.hypot(px - ax - vx * t, pz - az - vz * t);
}

export function buildTerrain(gridN = 4) {
  setGridSize(gridN);
  const gh = gridN * CELL / 2;
  FLAT = Math.max(34, gh + 4);
  const N = TERRAIN_HALF * 2;
  const sites = sitePos();
  const H = new Float32Array(N * N);
  const C = [];
  const hAt = (i, j) => (i < 0 || j < 0 || i >= N || j >= N ? null : H[j * N + i]);

  const rust = lin(0xb46649), ochre = lin(0xc5835a), butter = lin(0xd8a373);
  const basalt = colorOf('rock');
  const packed = lin(0xbf8b6e);
  const track = lin(0xa36c51);

  const routes = [
    [GARAGE.x, GARAGE.z, 6, gh + 1.5], [LANDING_PAD.x, LANDING_PAD.z, -6, gh + 1.5],
    ...sites.map((s) => [GARAGE.x, GARAGE.z, s.x, s.z]),
  ];

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = i - TERRAIN_HALF + 0.5, z = j - TERRAIN_HALF + 0.5;
      const m = flatMask(x, z, sites);
      let h = (vnoise(x * 0.07, z * 0.07) - 0.45) * 5 + (vnoise(x * 0.16 + 9, z * 0.16 - 3) - 0.5) * 2.2;
      h += Math.sin(x * 0.11 + z * 0.05) * 1.2;
      let crater = 0;
      for (const c of CRATERS) {
        const r = Math.hypot(x - c.x, z - c.z) / c.r;
        if (r < 0.85) { h -= c.d * (1 - (r / 0.85) ** 2); crater = 1; }
        else if (r < 1.3) h += c.d * 0.6 * (1 - Math.abs(r - 1.05) / 0.25) * (r < 1.3 ? 1 : 0);
      }
      h = Math.max(-3, h) * (1 - m);
      const hi = Math.round(h);
      H[j * N + i] = hi;
      // colour
      const n = vnoise(x * 0.12 + 40, z * 0.12 + 40);
      const k = hash2(i * 3 + 1, j * 7 + 2) * 0.025 - 0.0125;   // soft grain; silhouette and terraces carry the detail
      let col;
      if (n < 0.4) col = rust; else if (n < 0.7) col = ochre; else col = butter;
      if (hi >= 2) col = butter;
      if (crater && hi < 0) col = basalt;
      if (m > 0.6) col = packed;
      for (const r of routes) {
        if (segDist(x, z, r[0], r[1], r[2], r[3]) < 0.9 && hash2(i, j + 99) > 0.25) { col = track; break; }
      }
      const f = (1 + k + hi * 0.018) * (m > 0.6 ? 0.98 : 0.89);
      C.push([col[0] * f, col[1] * f, col[2] * f]);
    }
  }

  const gb = new GeoBuilder();
  const fx = [0, 0, 0];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const h = H[j * N + i];
      const col = C[j * N + i];
      const x0 = i - TERRAIN_HALF, z0 = j - TERRAIN_HALF, x1 = x0 + 1, z1 = z0 + 1;
      gb.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], 0, 1, 0, col, col, fx);
      const sides = [
        [hAt(i + 1, j), 'px'], [hAt(i - 1, j), 'nx'], [hAt(i, j + 1), 'pz'], [hAt(i, j - 1), 'nz'],
      ];
      for (const [nh0, dir] of sides) {
        const nh = nh0 === null ? BOTTOM : nh0;
        if (nh >= h) continue;
        const edge = nh0 === null;
        const top = [col[0] * 0.92, col[1] * 0.92, col[2] * 0.92];
        let bot = [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7];
        if (edge) {
          // strata on the diorama edge, banded
          for (let y = nh; y < h; y += 1) {
            const yb = y, yt = Math.min(h, y + 1);
            const band = ((y % 3) + 3) % 3;
            const base = STRATA[band];
            const s = 0.85 + hash2(i + y * 5, j - y * 3) * 0.15;
            const c = [base[0] * s, base[1] * s, base[2] * s];
            pushSide(gb, dir, x0, x1, z0, z1, yb, yt, c, c);
          }
          continue;
        }
        pushSide(gb, dir, x0, x1, z0, z1, nh, h, bot, top);
      }
    }
  }

  // rocks
  for (let r = 0; r < 26; r++) {
    const x = (hash2(r, 11) - 0.5) * (N - 8), z = (hash2(r, 23) - 0.5) * (N - 8);
    if (flatMask(x, z, sites) > 0.05) continue;
    const i = Math.floor(x + TERRAIN_HALF), j = Math.floor(z + TERRAIN_HALF);
    const h = H[j * N + i];
    const s = 1 + hash2(r, 5) * 1.8;
    const c = hash2(r, 7) > 0.5 ? colorOf('rock') : colorOf('rock2');
    gb.box(Math.floor(x), h, Math.floor(z), Math.ceil(s), Math.ceil(s * 0.8), Math.ceil(s), c, { skipBottom: true });
    if (s > 1.8) gb.box(Math.floor(x) + 1, h, Math.floor(z) - 1, 1, 1, 1, colorOf('rock2'), { skipBottom: true });
  }

  // slot pads (gridN x gridN cells)
  const pad = colorOf('pad'), edge = colorOf('padEdge'), line = colorOf('padLine');
  for (let gz = 0; gz < gridN; gz++) for (let gx = 0; gx < gridN; gx++) {
    const { x, z } = cellCenter(gx, gz);
    const h = PAD / 2;
    gb.box(x - h, 0, z - h, PAD, PAD_H, PAD, pad, { skipBottom: true });
    gb.box(x - h, 0, z - h, PAD, PAD_H + 0.05, 0.35, edge, { skipBottom: true });
    gb.box(x - h, 0, z + h - 0.35, PAD, PAD_H + 0.05, 0.35, edge, { skipBottom: true });
    gb.box(x - h, 0, z - h + 0.35, 0.35, PAD_H + 0.05, PAD - 0.7, edge, { skipBottom: true });
    gb.box(x + h - 0.35, 0, z - h + 0.35, 0.35, PAD_H + 0.05, PAD - 0.7, edge, { skipBottom: true });
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      gb.box(x + cx * (h - 0.9) - 0.3, 0, z + cz * (h - 0.9) - 0.3, 0.6, PAD_H + 0.04, 0.6, line, { skipBottom: true });
    }
  }
  // walkway between pads (slightly raised strips)
  const walk = lin(0x41515b);
  gb.box(-gh, 0, -gh, gh * 2, 0.12, gh * 2, walk, { skipBottom: true });

  // Discreet perimeter lights give the build area a clear boundary at night.
  // They are decorative navigation lights, not an indication of power supply.
  for (const x of [-gh - 0.4, gh + 0.4]) for (const z of [-gh - 0.4, gh + 0.4]) {
    gb.box(x - 0.35, 0, z - 0.35, 0.7, 0.8, 0.7, colorOf('dark'), { skipBottom: true });
    gb.box(x - 0.25, 0.8, z - 0.25, 0.5, 0.2, 0.5, colorOf('siteIce'), { fx: [1, 0, 0], ao: 1 });
  }

  // landing pad
  {
    const { x, z } = LANDING_PAD;
    const c1 = colorOf('concrete');
    for (let r = 0; r < 12; r++) {
      const zc = r - 6 + 0.5;
      const half = Math.round(Math.sqrt(Math.max(0, 36.5 - zc * zc)) * 2) / 2;
      gb.box(x - half, 0, z - 6 + r, half * 2, 0.4, 1, c1, { skipBottom: true });
    }
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      gb.box(x + Math.cos(a) * 4.6 - 0.35, 0.4, z + Math.sin(a) * 4.6 - 0.35, 0.7, 0.05, 0.7, line, { skipBottom: true });
    }
    // Universal landing mark: visible even when there is no ship on the pad.
    gb.box(x - 2.0, 0.4, z - 2.3, 0.55, 0.06, 4.6, line, { skipBottom: true });
    gb.box(x + 1.45, 0.4, z - 2.3, 0.55, 0.06, 4.6, line, { skipBottom: true });
    gb.box(x - 1.45, 0.4, z - 0.3, 2.9, 0.06, 0.6, line, { skipBottom: true });
    for (const [dx, dz] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) {
      gb.box(x + dx - 0.3, 0.4, z + dz - 0.3, 0.6, 0.3, 0.6, colorOf('led'), { fx: [1, 0, 0], ao: 1 });
    }
    // the lander is a dynamic mesh (view3d.js): it only shows while a ship is landing / waiting / leaving
  }
  // garage
  for (const b of garageBoxes()) gb.dataBox(b, GARAGE.x, 0, GARAGE.z, {});
  // site markers
  for (const s of sites) for (const b of siteBoxes(s.id)) gb.dataBox(b, s.x, 0, s.z, {});

  const geometry = gb.geometry();
  // ground height under a world point (0 on the flat base area); used by moving props such as rovers
  const heightAt = (x, z) => {
    const i = Math.max(0, Math.min(N - 1, Math.floor(x + TERRAIN_HALF))), j = Math.max(0, Math.min(N - 1, Math.floor(z + TERRAIN_HALF)));
    return H[j * N + i];
  };
  return { geometry, sites, heightAt };
}

function pushSide(gb, dir, x0, x1, z0, z1, yb, yt, bot, top) {
  const fx = [0, 0, 0];
  if (dir === 'px') gb.quad([x1, yb, z1], [x1, yb, z0], [x1, yt, z0], [x1, yt, z1], 1, 0, 0, bot, top, fx);
  else if (dir === 'nx') gb.quad([x0, yb, z0], [x0, yb, z1], [x0, yt, z1], [x0, yt, z0], -1, 0, 0, bot, top, fx);
  else if (dir === 'pz') gb.quad([x0, yb, z1], [x1, yb, z1], [x1, yt, z1], [x0, yt, z1], 0, 0, 1, bot, top, fx);
  else gb.quad([x1, yb, z0], [x0, yb, z0], [x0, yt, z0], [x1, yt, z0], 0, 0, -1, bot, top, fx);
}

// Plus marks and dashed outlines on empty pads. Returns a geometry (or null if no empty slot).
export function buildEmptyMarks(cells) {
  if (!cells.length) return null;
  const gb = new GeoBuilder();
  const c = colorOf('plus');
  const y = PAD_H;
  for (const { x, z } of cells) {
    gb.box(x - 1.2, y, z - 0.28, 2.4, 0.1, 0.56, c, { skipBottom: true });
    gb.box(x - 0.28, y, z - 1.2, 0.56, 0.1, 2.4, c, { skipBottom: true });
    const h = PAD / 2 - 0.8;
    for (let k = -3; k <= 3; k += 2) {
      const t = (k / 3) * (h - 0.6);
      gb.box(x + t - 0.5, y, z - h - 0.15, 1.0, 0.1, 0.3, c, { skipBottom: true });
      gb.box(x + t - 0.5, y, z + h - 0.15, 1.0, 0.1, 0.3, c, { skipBottom: true });
      gb.box(x - h - 0.15, y, z + t - 0.5, 0.3, 0.1, 1.0, c, { skipBottom: true });
      gb.box(x + h - 0.15, y, z + t - 0.5, 0.3, 0.1, 1.0, c, { skipBottom: true });
    }
  }
  return gb.geometry();
}
