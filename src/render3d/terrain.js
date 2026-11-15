// Voxel heightfield terrain (diorama slab) + static props merged into one geometry.
import { GeoBuilder, colorOf } from './voxels.js';
import { garageBoxes, siteBoxes } from './models.js';
import { PAD, PAD_H, TERRAIN_HALF, FAR_HALF, SITES, LANDING_PAD, GARAGE, DEFAULT_BOUNDS, boundsRect } from './layout.js';
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

// Flatness mask: 1 = flattened base area (build area + margin, extended south to the landing pad and garage).
let FLAT = { x0: -44, x1: 54, z0: -44, z1: 63 };
function flatMask(x, z, sites) {
  const dx = Math.max(0, FLAT.x0 - x, x - FLAT.x1);
  const dz = Math.max(0, FLAT.z0 - z, z - FLAT.z1);
  let m = 1 - clamp01(Math.hypot(dx, dz) / 7);
  for (const s of sites) m = Math.max(m, 1 - clamp01((Math.hypot(x - s.x, z - s.z) - 5) / 4));
  return m;
}
// 1 inside the voxel patch, falling to 0 over the last cells so the patch edge meets the far ground at y = 0
const EDGE_FADE = 12;
function edgeFade(x, z) {
  const d = TERRAIN_HALF - Math.max(Math.abs(x), Math.abs(z));
  return clamp01((d - 1) / EDGE_FADE);
}

function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = clamp01(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz));
  return Math.hypot(px - ax - vx * t, pz - az - vz * t);
}

/**
 * bounds = { gx0, gx1, gz0, gz1 } (slot cell bounds, inclusive); cells = [{ x, z }] slot centres (all slots).
 */
export function buildTerrain(bounds = DEFAULT_BOUNDS) {
  const R = boundsRect(bounds);
  FLAT = { x0: R.x0 - 4, x1: R.x1 + 4, z0: R.z0 - 4, z1: Math.max(R.z1 + 4, LANDING_PAD.z + 9, GARAGE.z + 9) };
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
    [GARAGE.x, GARAGE.z, 6, R.z1 + 1.5], [LANDING_PAD.x, LANDING_PAD.z, -6, R.z1 + 1.5],
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
      h = Math.max(-3, h) * (1 - m) * edgeFade(x, z);
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
        // the patch edge is at y = 0 and continues into the far ground: no diorama wall
        if (edge) continue;
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

  // Slots are plain soil, flush with the ground (no pads): empty ones get a "+" mark (buildEmptyMarks).
  const line = colorOf('padLine');

  // Discreet perimeter lights give the build area a clear boundary at night.
  // They are decorative navigation lights, not an indication of power supply.
  for (const x of [R.x0 - 0.4, R.x1 + 0.4]) for (const z of [R.z0 - 0.4, R.z1 + 0.4]) {
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
  addFarGround(gb, [rust, ochre, butter]);

  const geometry = gb.geometry();
  // ground height under a world point (0 on the flat base area); used by moving props such as rovers
  const heightAt = (x, z) => {
    const i = Math.max(0, Math.min(N - 1, Math.floor(x + TERRAIN_HALF))), j = Math.max(0, Math.min(N - 1, Math.floor(z + TERRAIN_HALF)));
    return H[j * N + i];
  };
  return { geometry, sites, heightAt };
}

// Far ground around the voxel patch: a coarse faceted heightfield (40-unit quads, about 2.5k triangles) plus a
// few big mesas and crater rims, all merged into the same geometry (no extra draw call). Height 0 on the patch edge.
const FAR_CELL = 40;
const MESAS = [
  { x: -260, z: -330, w: 90, d: 60, h: 22 }, { x: 330, z: -240, w: 70, d: 100, h: 30 },
  { x: -420, z: 120, w: 110, d: 70, h: 18 }, { x: 180, z: 380, w: 80, d: 60, h: 26 },
  { x: 470, z: 300, w: 60, d: 90, h: 16 }, { x: -150, z: 470, w: 100, d: 50, h: 20 },
  { x: 60, z: -520, w: 120, d: 70, h: 34 }, { x: -540, z: -160, w: 70, d: 120, h: 28 },
];
const FAR_CRATERS = [{ x: 250, z: 60, r: 70 }, { x: -230, z: -120, r: 55 }, { x: -60, z: 260, r: 45 }];
function farHeight(x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z)) - TERRAIN_HALF;
  if (d <= 0) return 0;
  const k = smooth(clamp01(d / 160));
  let h = (vnoise(x * 0.008 + 3, z * 0.008 - 7) - 0.4) * 22 + (vnoise(x * 0.025, z * 0.025) - 0.5) * 6;
  for (const c of FAR_CRATERS) {
    const r = Math.hypot(x - c.x, z - c.z) / c.r;
    if (r < 0.9) h -= 8 * (1 - (r / 0.9) ** 2);
    else if (r < 1.4) h += 5 * (1 - Math.abs(r - 1.1) / 0.3);
  }
  return Math.max(-6, h) * k;
}
function addFarGround(gb, cols) {
  const n = Math.round((FAR_HALF * 2) / FAR_CELL);
  const fx = [0, 0, 0];
  const hv = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) hv.push(farHeight(-FAR_HALF + i * FAR_CELL, -FAR_HALF + j * FAR_CELL));
  const H = (i, j) => hv[j * (n + 1) + i];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x0 = -FAR_HALF + i * FAR_CELL, z0 = -FAR_HALF + j * FAR_CELL, x1 = x0 + FAR_CELL, z1 = z0 + FAR_CELL;
      if (x0 >= -TERRAIN_HALF && x1 <= TERRAIN_HALF && z0 >= -TERRAIN_HALF && z1 <= TERRAIN_HALF) continue;
      const a = [x0, H(i, j + 1), z1], b = [x1, H(i + 1, j + 1), z1], c = [x1, H(i + 1, j), z0], d = [x0, H(i, j), z0];
      // face normal from the diagonals (quads are nearly planar)
      const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = d[0] - b[0], vy = d[1] - b[1], vz = d[2] - b[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const t = vnoise((x0 + 20) * 0.012 + 40, (z0 + 20) * 0.012 + 40);
      const base = t < 0.4 ? cols[0] : t < 0.7 ? cols[1] : cols[2];
      const f = 0.74 + hash2(i + 500, j - 500) * 0.05;   // a bit darker than the voxel tops so the patch edge blends
      const col = [base[0] * f, base[1] * f, base[2] * f];
      gb.quad(a, b, c, d, nx / l, ny / l, nz / l, col, col, fx);
    }
  }
  const rockC = colorOf('rock'), rock2C = colorOf('rock2');
  const top = [cols[2][0] * 0.9, cols[2][1] * 0.9, cols[2][2] * 0.9];
  for (const m of MESAS) {
    const y0 = -6;
    gb.box(m.x - m.w / 2, y0, m.z - m.d / 2, m.w, m.h - y0, m.d, cols[0], { skipBottom: true, ao: 0.7 });
    gb.box(m.x - m.w * 0.3, m.h, m.z - m.d * 0.25, m.w * 0.5, m.h * 0.35, m.d * 0.45, top, { skipBottom: true, ao: 0.75 });
  }
  for (const c of FAR_CRATERS) {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + c.r;
      const x = c.x + Math.cos(a) * c.r * 1.1, z = c.z + Math.sin(a) * c.r * 1.1;
      const s = 10 + hash2(k, c.r) * 10;
      gb.box(x - s / 2, farHeight(x, z) - 3, z - s / 2, s, 6 + hash2(c.r, k) * 6, s, k % 2 ? rockC : rock2C, { skipBottom: true });
    }
  }
}

function pushSide(gb, dir, x0, x1, z0, z1, yb, yt, bot, top) {
  const fx = [0, 0, 0];
  if (dir === 'px') gb.quad([x1, yb, z1], [x1, yb, z0], [x1, yt, z0], [x1, yt, z1], 1, 0, 0, bot, top, fx);
  else if (dir === 'nx') gb.quad([x0, yb, z0], [x0, yb, z1], [x0, yt, z1], [x0, yt, z0], -1, 0, 0, bot, top, fx);
  else if (dir === 'pz') gb.quad([x0, yb, z1], [x1, yb, z1], [x1, yt, z1], [x0, yt, z1], 0, 0, 1, bot, top, fx);
  else gb.quad([x1, yb, z0], [x0, yb, z0], [x0, yt, z0], [x1, yt, z0], 0, 0, -1, bot, top, fx);
}

// A flat "+" in the middle of each empty slot (the slot itself is plain soil). Returns a geometry (or null if no empty slot).
export function buildEmptyMarks(cells) {
  if (!cells.length) return null;
  const gb = new GeoBuilder();
  const c = colorOf('plus');
  const y = PAD_H;
  const L = PAD * 0.34, T = 0.42;   // arm length and thickness
  for (const { x, z } of cells) {
    gb.box(x - L / 2, y, z - T / 2, L, 0.08, T, c, { skipBottom: true });
    gb.box(x - T / 2, y, z - L / 2, T, 0.08, (L - T) / 2, c, { skipBottom: true });
    gb.box(x - T / 2, y, z + T / 2, T, 0.08, (L - T) / 2, c, { skipBottom: true });
  }
  return gb.geometry();
}
