// Voxel module models as data.
// Each model is a list of boxes [x, y, z, w, h, d, colorKey] in footprint coordinates:
// x and z in [0, 8] (the 8x8 footprint), y >= 0 from the top of the slot pad. (x, y, z) is the min corner.
// Small helpers below generate repetitive boxes (stepped discs, panel rows, lattice towers).
// MODELS[type][level - 1] = { boxes, meta }.

// ---------- helpers ----------

// Stepped circle (rows along z). opts.step = row depth, opts.grow = extra size on all sides.
function disc(o, cx, y, cz, r, h, c, opts = {}) {
  const step = opts.step || (r < 2 ? 0.5 : 1);
  const g = opts.grow || 0;
  const n = Math.max(1, Math.ceil((r * 2) / step - 1e-6));
  const z0 = cz - (n * step) / 2;
  const q = step / 2;
  for (let i = 0; i < n; i++) {
    const zc = z0 + (i + 0.5) * step - cz;
    const hw = Math.sqrt(Math.max(0, r * r - zc * zc));
    const half = Math.max(q, Math.round(hw / q) * q);
    o.push([cx - half - g, y, z0 + i * step - g, half * 2 + g * 2, h, step + g * 2, c]);
  }
}

// Half-width of the stepped disc row containing offset `off` (used to place windows flush with the wall).
function discHalf(r, off, step = 1) {
  const n = Math.max(1, Math.ceil((r * 2) / step - 1e-6));
  const q = step / 2;
  const z0 = -(n * step) / 2;
  const i = Math.min(n - 1, Math.max(0, Math.floor((off - z0) / step)));
  const zc = z0 + (i + 0.5) * step;
  const hw = Math.sqrt(Math.max(0, r * r - zc * zc));
  return { half: Math.max(q, Math.round(hw / q) * q), rowZ: z0 + i * step };
}

// Windows on the four sides of a stepped cylinder.
function ringWindows(o, cx, cz, r, y, h, c, offsets = [-1.5, 0.5]) {
  for (const off of offsets) {
    const { half, rowZ } = discHalf(r, off + 0.5);
    const a = rowZ + 0.2;   // window spans 0.6 inside a 1-unit row
    o.push([cx + half - 0.05, y, cz + a, 0.18, h, 0.6, c]);   // +x
    o.push([cx - half - 0.13, y, cz + a, 0.18, h, 0.6, c]);   // -x
    o.push([cx + a, y, cz + half - 0.05, 0.6, h, 0.18, c]);   // +z
    o.push([cx + a, y, cz - half - 0.13, 0.6, h, 0.18, c]);   // -z
  }
}

function tank(o, cx, y, cz, r, h) {
  disc(o, cx, y, cz, r, h, 'tank', { step: 0.5 });
  disc(o, cx, y + h * 0.55, cz, r, 0.35, 'tankBlue', { step: 0.5, grow: 0.06 });
  disc(o, cx, y + h, cz, r * 0.6, 0.25, 'hull2', { step: 0.5 });
}

// ---------- habitat: white stepped cylinder + dome, window bands, airlock ----------
function habitat(L) {
  const o = [];
  const R = [3, 3.5, 3.5][L - 1];
  const H = [3, 4.5, 4.5][L - 1];
  disc(o, 4, 0, 4, R + 0.5, 0.5, 'hull2');
  disc(o, 4, 0.5, 4, R, H, 'hull');
  disc(o, 4, 0.5 + H - 0.7, 4, R, 0.35, 'accent', { grow: 0.07 });
  ringWindows(o, 4, 4, R, 1.4, 0.9, 'win');
  if (L >= 2) ringWindows(o, 4, 4, R, 3.0, 0.8, 'win');
  // airlock on +z
  const az = 4 + R - 0.6;
  o.push([3, 0.5, az, 2, 2.2, 8.3 - az, 'hull2']);
  o.push([3.4, 0.5, 8.3, 1.2, 1.7, 0.08, 'dark']);
  o.push([3.75, 2.75, 8.25, 0.5, 0.25, 0.12, 'led']);
  o.push([2.9, 2.7, az, 2.2, 0.15, 8.4 - az, 'accent']);
  let top = 0.5 + H;
  if (L >= 2) {
    // second airlock on +x
    const ax = 4 + R - 0.6;
    o.push([ax, 0.5, 3, 8.3 - ax, 2.2, 2, 'hull2']);
    o.push([8.3, 0.5, 3.4, 0.08, 1.7, 1.2, 'dark']);
    o.push([8.25, 2.75, 3.75, 0.12, 0.25, 0.5, 'led']);
  }
  if (L < 3) {
    disc(o, 4, top, 4, R - 0.8, 0.8, 'hull');
    disc(o, 4, top + 0.8, 4, R - 1.9, 0.6, 'hull2');
    top += 1.4;
    if (L === 2) {
      o.push([5.2, 0.5 + H, 2.2, 0.25, 3, 0.25, 'metal']);
      o.push([5.1, 3.5 + H, 2.1, 0.45, 0.3, 0.45, 'led']);
    }
  } else {
    // upper tier
    disc(o, 4, top, 4, 2.5, 2.6, 'hull');
    ringWindows(o, 4, 4, 2.5, top + 0.8, 0.9, 'win', [-1.5, 0.5]);
    disc(o, 4, top + 2.6 - 0.5, 4, 2.5, 0.3, 'accent', { grow: 0.07 });
    disc(o, 4, top + 2.6, 4, 1.6, 0.7, 'hull');
    disc(o, 4, top + 3.3, 4, 0.9, 0.5, 'hull2');
    // dish on the lower roof
    o.push([6.3, top, 6.3, 0.3, 1.4, 0.3, 'metal']);
    o.push([5.7, top + 1.4, 5.7, 1.5, 0.2, 1.5, 'hull2']);
    o.push([6.35, top + 1.6, 6.35, 0.2, 0.6, 0.2, 'metal']);
    o.push([6.3, top + 2.2, 6.3, 0.3, 0.3, 0.3, 'led']);
    top += 3.8;
  }
  return { boxes: o, meta: {} };
}

// ---------- solar: tilted (stepped) dark blue cell arrays on posts ----------
function solarArray(o, x0, z0, w, rows, yb, step) {
  for (let r = 0; r < rows; r++) {
    const y = yb + (rows - 1 - r) * step;
    o.push([x0 - 0.1, y - 0.15, z0 + r, w + 0.2, 0.15, 1, 'frame']);
    for (let c = 0; c < w; c++) {
      o.push([x0 + c + 0.06, y, z0 + r + 0.06, 0.88, 0.22, 0.88, (c + r) % 2 ? 'cell' : 'cell2']);
    }
  }
  const mid = Math.floor(rows / 2);
  const py = yb + (rows - 1 - mid) * step - 0.15;
  const posts = w > 5 ? [0.4, w / 2 - 0.2, w - 0.8] : [0.4, w - 0.8];
  for (const px of posts) o.push([x0 + px, 0, z0 + mid + 0.3, 0.4, py, 0.4, 'metal']);
  return yb + (rows - 1) * step + 0.22;
}

function solar(L) {
  const o = [];
  let top = 0;
  let z0 = 0, z1 = 8, x0 = 0, x1 = 8;
  if (L === 1) {
    top = solarArray(o, 0.5, 2.5, 7, 3, 1.2, 0.45);
    o.push([6.6, 0, 6.3, 1.1, 0.9, 1.1, 'hull2']);
    o.push([6.9, 0.9, 6.6, 0.5, 0.15, 0.5, 'led']);
    x0 = 0.5; x1 = 7.5; z0 = 2.5; z1 = 5.5;
  } else if (L === 2) {
    top = solarArray(o, 0.5, 0.4, 7, 3, 1.6, 0.45);
    solarArray(o, 0.5, 4.4, 7, 3, 1.6, 0.45);
    o.push([3.5, 0, 3.55, 1, 0.8, 0.7, 'hull2']);
    o.push([3.75, 0.8, 3.7, 0.5, 0.15, 0.4, 'led']);
    x0 = 0.5; x1 = 7.5; z0 = 0.4; z1 = 7.4;
  } else {
    top = solarArray(o, 0, 0, 8, 2, 2.6, 0.5);
    solarArray(o, 0, 2.9, 8, 2, 2.6, 0.5);
    solarArray(o, 0, 5.8, 8, 2, 2.6, 0.5);
    // weather mast in the gap
    o.push([7.6, 0, 2.1, 0.3, 6, 0.3, 'metal']);
    o.push([7.2, 6, 1.95, 1.1, 0.2, 0.6, 'hull2']);
    o.push([7.55, 6.2, 2.05, 0.4, 0.4, 0.4, 'led']);
    top = Math.max(top, 6.6);
  }
  return { boxes: o, meta: { sweep: { x0: x0 - 4, x1: x1 - 4, z0: z0 - 4, z1: z1 - 4, y: Math.min(top, 3.8) + 0.3 } } };
}

// ---------- battery: low gray container bank + vertical charge gauge ----------
function container(o, x, y, z, w, h, d) {
  o.push([x, y, z, w, h, d, 'batt']);
  if (d >= w) {
    for (let i = 1; i < d - 0.3; i += 1) o.push([x - 0.08, y + 0.15, z + i - 0.1, w + 0.16, h - 0.3, 0.2, 'battDark']);
  } else {
    for (let i = 1; i < w - 0.3; i += 1) o.push([x + i - 0.1, y + 0.15, z - 0.08, 0.2, h - 0.3, d + 0.16, 'battDark']);
  }
  o.push([x - 0.1, y + h - 0.55, z - 0.1, w + 0.2, 0.3, d + 0.2, 'teal']);
  o.push([x + 0.25, y + h, z + 0.25, w - 0.5, 0.15, d - 0.5, 'hull2']);
  o.push([x + w - 0.7, y + h - 1.1, z + d - 0.02, 0.4, 0.25, 0.1, 'led']);
}

function gaugeTower(o, x, z, G) {
  const s = 1.3;
  o.push([x - 0.1, 0, z - 0.1, s + 0.2, 0.35, s + 0.2, 'dark']);
  for (const [px, pz] of [[0, 0], [s - 0.25, 0], [0, s - 0.25], [s - 0.25, s - 0.25]]) {
    o.push([x + px, 0.35, z + pz, 0.25, G - 0.35, 0.25, 'dark']);
  }
  o.push([x - 0.1, G, z - 0.1, s + 0.2, 0.3, s + 0.2, 'dark']);
  o.push([x + 0.2, 0.35, z + 0.2, s - 0.4, G - 0.4, s - 0.4, 'gauge']);
  return { x: x - 4, z: z - 4, base: 0.35, h: G - 0.4 };
}

function battery(L) {
  const o = [];
  let g;
  if (L === 1) {
    container(o, 0.6, 0, 1.2, 2.5, 2, 5.6);
    container(o, 3.4, 0, 1.2, 2.5, 2, 5.6);
    g = gaugeTower(o, 6.4, 3.2, 3.6);
    o.push([5.9, 0.5, 3.6, 0.6, 0.3, 0.3, 'dark']);
  } else if (L === 2) {
    container(o, 0.3, 0, 0.8, 1.9, 2.5, 6.4);
    container(o, 2.4, 0, 0.8, 1.9, 2.5, 6.4);
    container(o, 4.5, 0, 0.8, 1.9, 2.5, 6.4);
    g = gaugeTower(o, 6.7, 3.1, 4.8);
    o.push([6.4, 0.6, 3.6, 0.4, 0.3, 0.3, 'dark']);
  } else {
    container(o, 0.3, 0, 0.5, 2.8, 2.3, 7);
    container(o, 3.4, 0, 0.5, 2.8, 2.3, 7);
    container(o, 0.3, 2.45, 0.5, 2.8, 2.3, 7);
    container(o, 3.4, 2.45, 0.5, 2.8, 2.3, 7);
    // roof radiator
    for (let i = 0; i < 4; i++) o.push([1 + i * 1.3, 4.9, 2, 0.25, 0.9, 4, 'finDark']);
    g = gaugeTower(o, 6.6, 3.1, 6.6);
    o.push([6.2, 0.6, 3.6, 0.4, 0.3, 0.3, 'dark']);
    o.push([6.2, 3.1, 3.6, 0.4, 0.3, 0.3, 'dark']);
  }
  return { boxes: o, meta: { gauge: g } };
}

// ---------- MOXIE: gold cube, intake grill, glowing core, O2 tanks ----------
function goldCube(o, x, y, z, s, sy, coreFaces = true) {
  o.push([x, y, z, s, sy, s, 'gold']);
  o.push([x - 0.1, y, z - 0.1, s + 0.2, 0.3, s + 0.2, 'goldDark']);
  o.push([x - 0.1, y + sy - 0.3, z - 0.1, s + 0.2, 0.3, s + 0.2, 'goldDark']);
  // vertical edge strips
  for (const [px, pz] of [[0, 0], [s, 0], [0, s], [s, s]]) o.push([x + px - 0.15, y, z + pz - 0.15, 0.3, sy, 0.3, 'goldDark']);
  if (coreFaces) {
    const cw = s * 0.55, ch = sy * 0.4;
    o.push([x + (s - cw) / 2, y + sy * 0.3, z + s - 0.02, cw, ch, 0.14, 'core']);
    o.push([x + s - 0.02, y + sy * 0.3, z + (s - cw) / 2, 0.14, ch, cw, 'core']);
  }
}

function moxie(L) {
  const o = [];
  if (L === 1) {
    o.push([1, 0, 1, 6, 0.4, 6, 'steel']);
    goldCube(o, 2, 0.4, 2, 4, 4);
    o.push([1.1, 1.2, 2.8, 0.9, 2.2, 2.4, 'dark']);
    for (let i = 0; i < 3; i++) o.push([1.0, 1.45 + i * 0.65, 2.7, 0.9, 0.18, 2.6, 'metal']);
    o.push([3.4, 4.4, 3.4, 1.2, 0.6, 1.2, 'metal']);
    o.push([3.6, 5.0, 3.6, 0.8, 0.15, 0.8, 'core']);
    tank(o, 6.9, 0.4, 6.9, 0.9, 2.6);
    o.push([5.9, 1.3, 6.75, 0.8, 0.3, 0.3, 'metal']);
  } else if (L === 2) {
    o.push([0.5, 0, 0.5, 7, 0.4, 7, 'steel']);
    goldCube(o, 1.4, 0.4, 1.4, 5, 5);
    o.push([0.5, 1.2, 2.6, 0.95, 2.8, 2.8, 'dark']);
    for (let i = 0; i < 4; i++) o.push([0.4, 1.45 + i * 0.65, 2.5, 0.95, 0.18, 3.0, 'metal']);
    o.push([3.2, 5.4, 3.2, 1.6, 0.7, 1.6, 'metal']);
    o.push([3.5, 6.1, 3.5, 1.0, 0.15, 1.0, 'core']);
    o.push([5.4, 5.4, 1.8, 0.5, 1.6, 0.5, 'steel']);
    tank(o, 7.3, 0.4, 7.2, 0.75, 3.0);
    tank(o, 7.3, 0.4, 1.0, 0.75, 3.0);
    o.push([6.4, 1.6, 7.05, 0.5, 0.3, 0.3, 'metal']);
  } else {
    o.push([0, 0, 0, 8, 0.4, 8, 'steel']);
    goldCube(o, 0.9, 0.4, 0.9, 5.4, 5);
    goldCube(o, 2.1, 5.4, 2.1, 3, 2.8);
    o.push([0.0, 1.2, 2.3, 0.95, 2.8, 3.2, 'dark']);
    for (let i = 0; i < 4; i++) o.push([-0.1, 1.45 + i * 0.65, 2.2, 0.95, 0.18, 3.4, 'metal']);
    o.push([3.0, 8.2, 3.0, 1.2, 0.8, 1.2, 'metal']);
    o.push([3.2, 9.0, 3.2, 0.8, 0.15, 0.8, 'core']);
    o.push([1.2, 5.4, 6.0, 0.5, 2.2, 0.5, 'steel']);
    tank(o, 7.25, 0.4, 1.2, 0.7, 3.4);
    tank(o, 7.25, 0.4, 4.0, 0.7, 3.4);
    tank(o, 7.25, 0.4, 6.8, 0.7, 3.4);
    o.push([6.3, 2.4, 1.05, 0.4, 0.3, 6.0, 'metal']);
  }
  return { boxes: o, meta: {} };
}

// ---------- ice extractor: orange lattice drill tower + water tank ----------
function tower(o, x, z, s, h) {
  o.push([x - 0.4, 0, z - 0.4, s + 0.8, 0.3, s + 0.8, 'steel']);
  for (const [px, pz] of [[0, 0], [s - 0.4, 0], [0, s - 0.4], [s - 0.4, s - 0.4]]) {
    o.push([x + px, 0.3, z + pz, 0.4, h - 0.3, 0.4, 'orange']);
  }
  for (let y = 1.4; y < h - 0.5; y += 1.6) {
    o.push([x, y, z, s, 0.25, 0.25, 'orangeDark']);
    o.push([x, y, z + s - 0.25, s, 0.25, 0.25, 'orangeDark']);
    o.push([x, y, z, 0.25, 0.25, s, 'orangeDark']);
    o.push([x + s - 0.25, y, z, 0.25, 0.25, s, 'orangeDark']);
  }
  const c = s / 2;
  o.push([x + c - 0.3, 0.3, z + c - 0.3, 0.6, h - 0.3, 0.6, 'steel']);
  o.push([x + c - 0.8, 0.3, z + c - 0.8, 1.6, 0.4, 1.6, 'dark']);
  o.push([x - 0.3, h, z - 0.3, s + 0.6, 1.0, s + 0.6, 'hull2']);
  o.push([x - 0.35, h + 0.35, z - 0.35, s + 0.7, 0.25, s + 0.7, 'orange']);
  o.push([x + c - 0.45, h + 1.0, z + c - 0.45, 0.9, 0.5, 0.9, 'dark']);
  o.push([x + c - 0.2, h + 1.5, z + c - 0.2, 0.4, 0.3, 0.4, 'led']);
  return h + 1.8;
}

function extractor(L) {
  const o = [];
  if (L === 1) {
    tower(o, 1, 1, 3, 6.5);
    tank(o, 6, 0, 6, 1.4, 2.6);
    o.push([4.2, 0, 1.2, 2.4, 1.2, 2.2, 'orangeDark']);
    o.push([4.3, 1.2, 1.3, 2.2, 0.2, 2.0, 'regolith']);
    o.push([2.4, 0.8, 4.4, 0.35, 0.35, 2.2, 'metal']);
    o.push([2.4, 0.8, 6.3, 2.4, 0.35, 0.35, 'metal']);
  } else if (L === 2) {
    tower(o, 0.8, 0.8, 3.4, 8.5);
    tank(o, 6.1, 0, 6.1, 1.6, 3.4);
    tank(o, 2.2, 0, 6.6, 1.0, 2.2);
    o.push([4.6, 0, 0.8, 2.8, 1.4, 2.6, 'orangeDark']);
    o.push([4.7, 1.4, 0.9, 2.6, 0.2, 2.4, 'regolith']);
    o.push([3.2, 0.8, 6.45, 1.4, 0.35, 0.35, 'metal']);
  } else {
    tower(o, 0.6, 0.6, 3.8, 10.5);
    tank(o, 6.2, 0, 6.2, 1.6, 4.2);
    tank(o, 6.5, 0, 2.3, 1.2, 3.0);
    tank(o, 2.3, 0, 6.7, 1.1, 2.4);
    o.push([4.5, 0, 4.0, 1.5, 1.8, 1.5, 'hull2']);
    o.push([4.8, 1.8, 4.3, 0.9, 0.2, 0.9, 'led']);
    // conveyor arm from tower top-side down to the pump house
    for (let i = 0; i < 4; i++) o.push([4.4 + i * 0.45, 5.5 - i * 1.0, 2.0, 0.6, 0.3, 0.6, 'orangeDark']);
  }
  return { boxes: o, meta: {} };
}

// ---------- greenhouse: glazed stepped tunnel along x, soil beds, plants, grow lights ----------
function tunnel(o, x0, len, cz, prof, rowOffsets) {
  const t = 0.25;
  const n = prof.length;
  const outerHalf = prof[0][0];
  o.push([x0 - 0.2, 0, cz - outerHalf - 0.2, len + 0.4, 0.4, outerHalf * 2 + 0.4, 'hull2']);
  for (let k = 0; k < n; k++) {
    const yb = k === 0 ? 0.4 : prof[k - 1][1];
    const [half, yt] = prof[k];
    const nh = k < n - 1 ? prof[k + 1][0] : 0;
    o.push([x0, yb, cz - half, len, yt - yb, t, 'glass']);
    o.push([x0, yb, cz + half - t, len, yt - yb, t, 'glass']);
    if (k < n - 1) {
      o.push([x0, yt - t, cz - half, len, t, half - nh + t, 'glass']);
      o.push([x0, yt - t, cz + nh - t, len, t, half - nh + t, 'glass']);
    } else {
      o.push([x0, yt - t, cz - half, len, t, half * 2, 'glass']);
    }
    o.push([x0, yb, cz - half, t, yt - yb, half * 2, 'glass']);
    o.push([x0 + len - t, yb, cz - half, t, yt - yb, half * 2, 'glass']);
    // white ribs
    const ribs = Math.max(2, Math.round(len / 1.6));
    for (let i = 0; i <= ribs; i++) {
      const xr = x0 + (i * (len - 0.2)) / ribs;
      o.push([xr, yb, cz - half - 0.08, 0.2, yt - yb, 0.12, 'hull']);
      o.push([xr, yb, cz + half - 0.04, 0.2, yt - yb, 0.12, 'hull']);
      if (k < n - 1) {
        o.push([xr, yt - 0.02, cz - half - 0.08, 0.2, 0.12, half - nh + 0.1, 'hull']);
        o.push([xr, yt - 0.02, cz + nh - 0.02, 0.2, 0.12, half - nh + 0.1, 'hull']);
      } else {
        o.push([xr, yt - 0.02, cz - half - 0.08, 0.2, 0.12, half * 2 + 0.16, 'hull']);
      }
    }
  }
  // beds, plants and grow lights
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const off of rowOffsets) {
    const zr = cz + off;
    o.push([x0 + 0.4, 0.4, zr - 0.35, len - 0.8, 0.4, 0.7, 'soil']);
    for (let x = x0 + 0.55; x < x0 + len - 0.9; x += 0.75) {
      const ph = 0.7 + rnd() * 0.6;
      o.push([x, 0.8, zr - 0.25, 0.5, ph, 0.5, rnd() > 0.5 ? 'leaf' : 'leaf2']);
      if (rnd() > 0.7) o.push([x + 0.1, 0.8 + ph, zr - 0.15, 0.3, 0.25, 0.3, 'fruit']);
    }
    const a = Math.abs(off);
    let k = 0;
    while (k < n - 1 && prof[k + 1][0] > a + 0.3) k++;
    const ceil = prof[k][1] - t;
    o.push([x0 + 0.4, ceil - 0.16, zr - 0.15, len - 0.8, 0.12, 0.3, 'grow']);
  }
}

function greenhouse(L) {
  const o = [];
  if (L === 1) {
    tunnel(o, 1, 6, 4, [[2, 1.5], [1.5, 2.2], [0.9, 2.7]], [-0.85, 0.85]);
    o.push([7, 0.4, 3.2, 0.8, 1.6, 1.6, 'hull']);
    o.push([7.8, 0.4, 3.5, 0.06, 1.3, 1.0, 'dark']);
  } else if (L === 2) {
    tunnel(o, 0.4, 6.6, 4, [[3, 1.8], [2.4, 2.7], [1.6, 3.4], [0.8, 3.8]], [-1.9, -0.7, 0.7, 1.9]);
    o.push([7.0, 0.4, 3.2, 0.9, 1.8, 1.6, 'hull']);
    o.push([7.9, 0.4, 3.5, 0.06, 1.4, 1.0, 'dark']);
  } else {
    tunnel(o, 0.2, 7.0, 4, [[3.6, 2.2], [3.0, 3.2], [2.2, 4.1], [1.2, 4.7]], [-2.8, -1.7, -0.6, 0.6, 1.7, 2.8]);
    o.push([3.2, 4.7, 3.4, 1.2, 0.7, 1.2, 'hull2']);
    o.push([3.45, 5.4, 3.65, 0.7, 0.2, 0.7, 'led']);
    o.push([7.2, 0.4, 3.2, 0.8, 2.0, 1.6, 'hull']);
    o.push([8.0, 0.4, 3.5, 0.06, 1.5, 1.0, 'dark']);
  }
  return { boxes: o, meta: {} };
}

// ---------- radiation shelter: low bunker under a stepped regolith mound with a hatch ----------
function mound(o, layers) {
  let i = 0;
  for (const [hx, hz, y, h] of layers) {
    o.push([4 - hx, y, 4 - hz, hx * 2, h, hz * 2, i % 2 ? 'regolith2' : 'regolith']);
    // sandbag lumps along the top edge of the layer
    for (let x = 4 - hx + 0.2; x < 4 + hx - 0.8; x += 1.4) {
      o.push([x, y + h - 0.1, 4 - hz - 0.12, 0.9, 0.35, 0.6, 'sandbag']);
      o.push([x + 0.6, y + h - 0.1, 4 + hz - 0.48, 0.9, 0.35, 0.6, 'sandbag']);
    }
    for (let z = 4 - hz + 0.6; z < 4 + hz - 0.8; z += 1.4) {
      o.push([4 + hx - 0.48, y + h - 0.1, z, 0.6, 0.35, 0.9, 'sandbag']);
      o.push([4 - hx - 0.12, y + h - 0.1, z + 0.5, 0.6, 0.35, 0.9, 'sandbag']);
    }
    i++;
  }
}

function hatch(o, x, w, hgt) {
  o.push([x, 0, 6.4, w, hgt, 1.9, 'concrete']);
  o.push([x + 0.45, 0, 8.3, w - 0.9, hgt - 0.6, 0.06, 'dark']);
  const n = Math.max(3, Math.round((w - 0.4) / 0.6));
  const sw = (w - 0.4) / n;
  for (let i = 0; i < n; i++) o.push([x + 0.2 + i * sw, hgt - 0.45, 8.3, sw, 0.3, 0.06, i % 2 ? 'black' : 'yellow']);
  o.push([x + w / 2 - 0.25, hgt, 7.9, 0.5, 0.25, 0.4, 'led']);
}

function shelter(L) {
  const o = [];
  if (L === 1) {
    mound(o, [[4, 4, 0, 0.9], [3.4, 3.4, 0.9, 0.9], [2.7, 2.7, 1.8, 0.8], [1.8, 1.8, 2.6, 0.6]]);
    hatch(o, 2.7, 2.6, 2.2);
    o.push([4.8, 3.2, 3.2, 0.4, 1.0, 0.4, 'metal']);
    o.push([4.7, 4.2, 3.1, 0.6, 0.2, 0.6, 'steel']);
  } else if (L === 2) {
    mound(o, [[4.2, 4.2, 0, 1], [3.6, 3.6, 1, 1], [3.0, 3.0, 2, 1], [2.2, 2.2, 3, 0.8], [1.3, 1.3, 3.8, 0.5]]);
    hatch(o, 2.4, 3.2, 2.6);
    o.push([2.6, 4.3, 3.0, 0.4, 1.2, 0.4, 'metal']);
    o.push([2.5, 5.5, 2.9, 0.6, 0.2, 0.6, 'steel']);
    o.push([5.0, 4.3, 4.6, 0.4, 1.2, 0.4, 'metal']);
    o.push([4.9, 5.5, 4.5, 0.6, 0.2, 0.6, 'steel']);
  } else {
    mound(o, [[4.3, 4.3, 0, 1], [3.9, 3.9, 1, 1], [3.4, 3.4, 2, 1], [2.8, 2.8, 3, 1], [2.0, 2.0, 4, 0.8], [1.1, 1.1, 4.8, 0.5]]);
    hatch(o, 2.0, 4.0, 3.0);
    o.push([1.8, 0, 6.2, 0.5, 3.4, 2.2, 'concrete']);
    o.push([5.7, 0, 6.2, 0.5, 3.4, 2.2, 'concrete']);
    o.push([1.8, 3.2, 6.2, 4.4, 0.5, 2.2, 'concrete']);
    // antenna
    o.push([5.4, 3.0, 2.4, 0.3, 4.0, 0.3, 'metal']);
    o.push([4.95, 7.0, 1.95, 1.2, 0.2, 1.2, 'hull2']);
    o.push([5.4, 7.2, 2.4, 0.3, 0.3, 0.3, 'led']);
    o.push([2.4, 5.3, 3.4, 0.4, 1.0, 0.4, 'metal']);
  }
  return { boxes: o, meta: {} };
}

// ---------- fission reactor: small cylinder core, big flat radiator fins, blue glow ----------
function fin(o, dir, y0, h, inner, outer) {
  const t = 0.3;
  const len = outer - inner;
  if (dir === 'x+') { o.push([4 + inner, y0, 4 - t / 2, len, h, t, 'fin']); o.push([4 + outer - 0.25, y0, 4 - 0.25, 0.25, h, 0.5, 'finDark']); }
  if (dir === 'x-') { o.push([4 - outer, y0, 4 - t / 2, len, h, t, 'fin']); o.push([4 - outer, y0, 4 - 0.25, 0.25, h, 0.5, 'finDark']); }
  if (dir === 'z+') { o.push([4 - t / 2, y0, 4 + inner, t, h, len, 'fin']); o.push([4 - 0.25, y0, 4 + outer - 0.25, 0.5, h, 0.25, 'finDark']); }
  if (dir === 'z-') { o.push([4 - t / 2, y0, 4 - outer, t, h, len, 'fin']); o.push([4 - 0.25, y0, 4 - outer, 0.5, h, 0.25, 'finDark']); }
}

function reactor(L) {
  const o = [];
  o.push([0.5, 0, 0.5, 7, 0.4, 7, 'concrete']);
  for (const [px, pz] of [[0.5, 0.5], [6.5, 0.5], [0.5, 6.5], [6.5, 6.5]]) {
    o.push([px, 0.4, pz, 1, 0.08, 1, 'yellow']);
  }
  const coreH = [3.2, 4.4, 5.8][L - 1];
  const finY = [0.9, 0.8, 0.7][L - 1];
  const finH = [4.2, 5.8, 7.4][L - 1];
  disc(o, 4, 0.4, 4, 1.5, coreH, 'hull2', { step: 0.5 });
  disc(o, 4, 0.4 + coreH * 0.55, 4, 1.5, 0.35, 'rglow', { step: 0.5, grow: 0.08 });
  disc(o, 4, 0.4 + coreH - 0.6, 4, 1.5, 0.3, 'rglow', { step: 0.5, grow: 0.08 });
  disc(o, 4, 0.4 + coreH, 4, 1.0, 0.6, 'steel', { step: 0.5 });
  disc(o, 4, 1.0 + coreH, 4, 0.5, 0.4, 'rglow', { step: 0.5 });
  const outer = L === 1 ? 3.6 : 3.95;
  for (const d of ['x+', 'x-', 'z+', 'z-']) fin(o, d, finY, finH, 1.3, outer);
  // coolant collars on top of fins
  o.push([4 - outer, finY + finH, 3.75, outer * 2, 0.25, 0.5, 'steel']);
  o.push([3.75, finY + finH, 4 - outer, 0.5, 0.25, outer * 2, 'steel']);
  if (L >= 2) {
    // hazard band on base
    for (let i = 0; i < 7; i++) o.push([0.5 + i, 0.05, 7.45, 1, 0.3, 0.1, i % 2 ? 'black' : 'yellow']);
  }
  if (L === 3) {
    // diagonal stepped fins
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      for (let i = 0; i < 5; i++) {
        const r = 1.5 + i * 0.5;
        o.push([4 + dx * r - 0.25, finY + 0.5, 4 + dz * r - 0.25, 0.5, finH - 1.5, 0.5, 'fin']);
      }
    }
    o.push([3.85, 1.4 + coreH, 3.85, 0.3, 1.4, 0.3, 'metal']);
    o.push([3.75, 2.8 + coreH, 3.75, 0.5, 0.3, 0.5, 'led']);
  }
  return { boxes: o, meta: {} };
}

// ---------- Apêndice E.2: expansion modules ----------

// Horizontal cylinder along x (stepped cross-section): x0..x0+len, centre (cy, cz).
function hcyl(o, x0, len, cy, cz, r, c, grow = 0) {
  const n = Math.max(1, Math.ceil((r * 2) / 0.5 - 1e-6));
  for (let i = 0; i < n; i++) {
    const yc = -r + (i + 0.5) * 0.5;
    const hw = Math.max(0.25, Math.sqrt(Math.max(0, r * r - yc * yc)));
    o.push([x0 - grow, cy + yc - 0.25, cz - hw - grow, len + grow * 2, 0.5, hw * 2 + grow * 2, c]);
  }
}

// Stepped sphere.
function sphere(o, cx, cy, cz, r, c) {
  const n = Math.ceil((r * 2) / 0.5);
  for (let i = 0; i < n; i++) {
    const yc = -r + (i + 0.5) * 0.5;
    const rr = Math.sqrt(Math.max(0, r * r - yc * yc));
    if (rr > 0.3) disc(o, cx, cy + yc - 0.25, cz, rr, 0.5, c, { step: 0.5 });
  }
}

// fallback for unknown module types: plain gray box
function generic() {
  const o = [];
  o.push([0.8, 0, 0.8, 6.4, 0.3, 6.4, 'steel']);
  o.push([1, 0.3, 1, 6, 2.4, 6, 'hullDark']);
  o.push([0.9, 2.7, 0.9, 6.2, 0.3, 6.2, 'steel']);
  o.push([3.4, 0.3, 7.0, 1.2, 1.6, 0.1, 'dark']);
  o.push([3.75, 2.2, 7.0, 0.5, 0.2, 0.12, 'led']);
  return { boxes: o, meta: {} };
}

// gym: blue-gray box, striped roof, big windows
function gym(L) {
  const o = [];
  const H = [2.6, 3.2, 3.2][L - 1];
  o.push([0.3, 0, 0.8, 7.4, 0.3, 6.4, 'gymDark']);
  o.push([0.5, 0.3, 1, 7, H, 6, 'gymBody']);
  for (let i = 0; i < 7; i++) o.push([0.4 + i, 0.3 + H, 0.9, 1, 0.22, 6.2, i % 2 ? 'accent' : 'hull']);
  for (const x of [1.0, 4.9]) o.push([x, 0.9, 6.97, 2.1, H - 1.2, 0.12, 'win']);
  o.push([3.45, 0.3, 6.97, 1.1, 1.8, 0.12, 'dark']);
  for (const z of [1.7, 4.3]) o.push([7.47, 0.9, z, 0.12, H - 1.2, 1.9, 'win']);
  o.push([6.2, 0.52 + H, 5.4, 1.2, 0.6, 1.2, 'steel']);
  const top = 0.52 + H;
  if (L >= 2) {
    o.push([2.6, top + 0.75, 3.9, 2.8, 0.2, 0.2, 'steel']);   // dumbbell sign
    for (const x of [2.3, 5.2]) o.push([x, top + 0.45, 3.8, 0.5, 0.8, 0.4, 'dark']);
    o.push([3.7, top, 3.9, 0.2, 0.75, 0.2, 'metal']);
  }
  if (L === 3) {
    o.push([1.4, top, 1.8, 4.8, 1.7, 3.2, 'gymBody']);
    o.push([1.5, top + 0.5, 5.0, 4.6, 0.7, 0.1, 'win']);
    o.push([1.3, top + 1.7, 1.7, 5, 0.22, 3.4, 'accent']);
  }
  return { boxes: o, meta: {} };
}

// hospital: white block with a plain coloured band, canopy
function hospital(L) {
  const o = [];
  const H = [2.8, 3.6, 4.6][L - 1];
  o.push([0.4, 0, 0.8, 7.2, 0.3, 6.6, 'hull2']);
  o.push([0.6, 0.3, 1, 6.8, H, 6.2, 'hull']);
  o.push([0.5, 0.3 + H * 0.5, 0.9, 7, 0.55, 6.4, 'accent']);
  for (let i = 0; i < 3; i++) o.push([1.2 + i * 2.0, 0.4 + H * 0.5 + 0.9, 7.17, 1.2, 0.7, 0.1, 'win']);
  if (H > 3) for (let i = 0; i < 3; i++) o.push([1.2 + i * 2.0, 0.4, 7.17, 1.2, 0.8, 0.1, 'win']);
  o.push([3.2, 0.3, 7.17, 1.6, 1.7, 0.1, 'dark']);
  o.push([2.8, 2.1, 7.2, 2.4, 0.2, 0.9, 'hull2']);
  for (const x of [2.9, 4.9]) o.push([x, 0.3, 7.9, 0.2, 1.8, 0.2, 'metal']);
  o.push([0.5, 0.3 + H, 0.9, 7, 0.22, 6.4, 'hull2']);
  const top = 0.52 + H;
  if (L === 1) o.push([5.4, top, 2.2, 1.6, 0.8, 1.4, 'steel']);
  if (L === 2) {
    o.push([0.2, 0.3, 2.4, 0.5, 2.4, 3.2, 'hull']);
    o.push([5.6, top, 2.0, 1.5, 0.8, 1.5, 'steel']);
    o.push([1.0, top, 5.4, 0.3, 1.2, 0.3, 'metal']);
    o.push([0.9, top + 1.2, 5.3, 0.5, 0.2, 0.5, 'led']);
  }
  if (L === 3) {
    disc(o, 4, top, 4, 2.7, 0.2, 'concrete', { step: 0.5 });   // rooftop helipad
    o.push([3.0, top + 0.2, 3.7, 2.0, 0.05, 0.6, 'yellow']);
    o.push([3.0, top + 0.2, 4.9, 2.0, 0.05, 0.6, 'yellow']);
    o.push([3.7, top + 0.2, 3.1, 0.6, 0.05, 2.6, 'yellow']);
    for (const [px, pz] of [[1.5, 1.5], [6.2, 1.5], [1.5, 6.2], [6.2, 6.2]]) o.push([px, top, pz, 0.3, 0.3, 0.3, 'led']);
  }
  return { boxes: o, meta: {} };
}

// thermal: central unit, big radiator fins, red/blue pipes
function thermal(L) {
  const o = [];
  const nf = [6, 8, 9][L - 1];
  const fh = [3.2, 4.0, 4.8][L - 1];
  o.push([0.3, 0, 0.3, 7.4, 0.3, 7.4, 'steel']);
  o.push([0.6, 0.3, 2.4, 3.2, 2.2, 3.2, 'hull2']);
  o.push([0.5, 2.5, 2.3, 3.4, 0.3, 3.4, 'accent']);
  o.push([1.2, 0.3, 5.6, 1.6, 1.0, 0.1, 'dark']);
  o.push([1.5, 2.8, 3.4, 1.0, 0.6, 1.0, 'steel']);
  for (let i = 0; i < nf; i++) o.push([4.4 + i * 0.4, 0.5, 1.2, 0.2, fh, 5.6, 'fin']);
  o.push([4.3, 0.5 + fh, 1.1, nf * 0.4 + 0.2, 0.25, 5.8, 'finDark']);
  o.push([4.3, 0.3, 1.1, nf * 0.4 + 0.2, 0.2, 5.8, 'finDark']);
  o.push([3.8, 1.0, 3.0, 4.2, 0.3, 0.3, 'red']);
  o.push([3.8, 1.5, 4.7, 4.2, 0.3, 0.3, 'blue']);
  o.push([3.8, 1.0, 3.0, 0.3, 0.3, 1.9, 'red']);
  o.push([3.6, 1.5, 4.6, 0.3, 0.3, 0.4, 'blue']);
  if (L >= 2) {
    o.push([0.6, 0.3, 0.6, 1.6, 1.4, 1.5, 'hull2']);
    o.push([1.0, 1.7, 1.0, 0.8, 0.5, 0.8, 'steel']);
    o.push([2.2, 0.9, 1.3, 2.2, 0.3, 0.3, 'blue']);
  }
  if (L === 3) {
    for (let i = 0; i < 5; i++) o.push([0.5 + i * 0.5, 2.8, 6.2, 0.2, 2.2, 1.6, 'fin']);
    o.push([2.4, 5.0, 6.1, 0.3, 0.25, 1.8, 'finDark']);
    o.push([2.7, 1.0, 5.9, 0.3, 0.3, 1.2, 'red']);
  }
  return { boxes: o, meta: {} };
}

// pressurizer: horizontal pressure tanks with a compressor
function pressurizer(L) {
  const o = [];
  const zs = L === 1 ? [2.5, 5.5] : [1.4, 3.7, 6.0];
  const r = L === 1 ? 1.1 : 1.0;
  o.push([0.3, 0, 0.3, 7.4, 0.3, 7.4, 'steel']);
  for (const z of zs) {
    for (const x of [1.2, 4.8]) o.push([x, 0.3, z - 0.6, 0.5, r * 0.5 + 0.2, 1.2, 'dark']);
    hcyl(o, 0.6, 5.8, 0.3 + r + 0.2, z, r, 'tank');
    for (const x of [1.5, 4.9]) hcyl(o, x, 0.35, 0.3 + r + 0.2, z, r, 'tankBlue', 0.06);
    hcyl(o, 6.4, 0.3, 0.3 + r + 0.2, z, r * 0.45, 'metal');
  }
  if (L === 3) {
    hcyl(o, 1.0, 5.0, 0.3 + r * 2 + 1.1, 2.55, 0.9, 'tank');
    hcyl(o, 2.4, 0.35, 0.3 + r * 2 + 1.1, 2.55, 0.9, 'tankBlue', 0.06);
  }
  o.push([6.8, 0.3, 1.0, 1.0, 2.4, 6.0, 'hullDark']);   // compressor
  o.push([6.7, 2.7, 0.9, 1.2, 0.25, 6.2, 'accent']);
  o.push([6.75, 0.8, 1.5, 0.12, 0.2, 5.0, 'dark']);
  o.push([6.75, 1.4, 1.5, 0.12, 0.2, 5.0, 'dark']);
  o.push([7.0, 2.95, 3.6, 0.5, 0.25, 0.5, 'led']);
  return { boxes: o, meta: {} };
}

// waterFilter: tall blue cylinders with pipes
function waterFilter(L) {
  const o = [];
  const h = [4.5, 5.5, 6.5][L - 1];
  const pts = L === 1 ? [[2.3, 2.3], [5.7, 2.3]] : L === 2 ? [[2.1, 2.1], [5.9, 2.1], [4.0, 5.9]] : [[2.1, 2.1], [5.9, 2.1], [2.1, 5.9], [5.9, 5.9]];
  const r = L === 1 ? 1.3 : 1.2;
  o.push([0.3, 0, 0.3, 7.4, 0.3, 7.4, 'steel']);
  for (const [x, z] of pts) {
    disc(o, x, 0.3, z, r, h, 'tankBlue', { step: 0.5 });
    disc(o, x, 0.3 + h * 0.3, z, r, 0.3, 'tank', { step: 0.5, grow: 0.06 });
    disc(o, x, 0.3 + h * 0.7, z, r, 0.3, 'tank', { step: 0.5, grow: 0.06 });
    disc(o, x, 0.3 + h, z, r * 0.7, 0.35, 'steel', { step: 0.5 });
    o.push([x - 0.15, 0.65 + h, z - 0.15, 0.3, 0.5, 0.3, 'led']);
  }
  const y = 1.0;
  const a = pts[0], b = pts[1];
  o.push([a[0], y, a[1] - 0.15, b[0] - a[0], 0.3, 0.3, 'metal']);
  if (L === 1) {
    o.push([2.0, 0.3, 5.0, 4.0, 1.5, 2.2, 'hull2']);
    o.push([2.2, 1.8, 5.2, 1.0, 0.5, 1.0, 'steel']);
    o.push([3.7, y, 3.5, 0.3, 0.3, 1.6, 'metal']);
  } else if (L === 2) {
    o.push([b[0] - 0.15, y, b[1], 0.3, 0.3, 3.9, 'metal']);
    o.push([4.0, y, 5.75, 1.9, 0.3, 0.3, 'metal']);
    o.push([0.6, 0.3, 4.6, 1.5, 1.4, 2.4, 'hull2']);
  } else {
    o.push([2.1, y, 5.75, 3.8, 0.3, 0.3, 'metal']);
    o.push([1.95, y, 2.1, 0.3, 0.3, 3.8, 'metal']);
    o.push([5.75, y, 2.1, 0.3, 0.3, 3.8, 'metal']);
    o.push([2.1, 0.3 + h + 0.9, 1.95, 3.8, 0.3, 0.3, 'metal']);
    o.push([2.1, 0.3 + h + 0.9, 5.75, 3.8, 0.3, 0.3, 'metal']);
    o.push([3.85, 0.3, 3.7, 0.5, 2.6, 0.5, 'aqua']);
  }
  return { boxes: o, meta: {} };
}

// decon: airlock tunnel with yellow stripes
function tunnelX(o, x0, len, z0, w) {
  o.push([x0, 0.3, z0, len, 1.8, w, 'hull2']);
  o.push([x0, 2.1, z0 + 0.4, len, 0.6, w - 0.8, 'hull2']);
  o.push([x0, 2.7, z0 + 1.0, len, 0.5, w - 2.0, 'hull2']);
  for (let i = 0; i + 0.8 <= len; i++) {
    const c = i % 2 ? 'black' : 'yellow';
    const x = x0 + 0.3 + i * 1.0;
    o.push([x, 0.3, z0 - 0.06, 0.5, 1.8, w + 0.12, c]);
    o.push([x, 2.1, z0 + 0.34, 0.5, 0.6, w - 0.68, c]);
    o.push([x, 2.7, z0 + 0.94, 0.5, 0.5, w - 1.88, c]);
  }
  return z0 + w / 2;
}

function decon(L) {
  const o = [];
  o.push([0.2, 0, 0.5, 7.6, 0.3, 7.0, 'steel']);
  const len = [5, 7, 7][L - 1];
  const x0 = L === 1 ? 1.5 : 0.5;
  const zm = tunnelX(o, x0, len, 2.3, 3.4);
  o.push([x0 - 0.1, 0.3, zm - 1.1, 0.12, 1.8, 2.2, 'dark']);
  o.push([x0 + len - 0.02, 0.3, zm - 1.1, 0.12, 1.8, 2.2, 'dark']);
  o.push([x0 + len - 0.1, 2.5, zm - 0.3, 0.2, 0.25, 0.6, 'led']);
  if (L >= 2) {
    o.push([x0 + 1.5, 3.2, zm - 0.2, len - 3, 0.2, 0.4, 'steel']);   // shower rail
    for (let i = 0; i < 4; i++) o.push([x0 + 2 + i * 1.0, 3.0, zm - 0.1, 0.2, 0.2, 0.2, 'tankBlue']);
    o.push([x0 + 0.5, 0.3, 5.9, 1.5, 1.2, 1.3, 'hullDark']);
  }
  if (L === 3) {
    o.push([3.3, 0.3, 0.6, 1.6, 1.8, 1.7, 'hull2']);   // cross passage
    o.push([3.3, 0.3, 5.7, 1.6, 1.8, 1.7, 'hull2']);
    for (let i = 0; i < 2; i++) {
      const c = i % 2 ? 'black' : 'yellow';
      o.push([3.24, 0.3, 0.8 + i * 0.7, 1.72, 1.8, 0.4, c]);
      o.push([3.24, 0.3, 5.9 + i * 0.7, 1.72, 1.8, 0.4, c]);
    }
    o.push([3.9, 0.3, 0.5, 0.5, 1.4, 0.12, 'dark']);
  }
  return { boxes: o, meta: {} };
}

// warehouse: large low gray shed
function warehouse(L) {
  const o = [];
  const H = [2.2, 2.6, 3.0][L - 1];
  o.push([0.2, 0, 0.4, 7.6, 0.25, 7.2, 'shedDark']);
  o.push([0.4, 0.25, 0.6, 7.2, H, 6.8, 'shed']);
  for (let i = 0; i < 8; i++) o.push([0.35 + i * 1.0, 0.25, 0.55, 0.2, H, 6.9, 'shedDark']);
  o.push([0.3, 0.25 + H, 0.5, 7.4, 0.25, 7.0, 'shedDark']);
  o.push([1.0, 0.5 + H, 1.2, 6, 0.3, 5.6, 'shed']);
  o.push([2.0, 0.8 + H, 2.2, 4, 0.25, 3.6, 'shedDark']);
  const nd = L === 1 ? 1 : 2;
  for (let d = 0; d < nd; d++) {
    const x = nd === 1 ? 2.8 : 0.9 + d * 3.6;
    const w = nd === 1 ? 2.8 : 2.6;
    o.push([x, 0.25, 7.38, w, H - 0.5, 0.12, 'dark']);
    for (let k = 0; k < 4; k++) o.push([x, 0.6 + k * (H - 1) / 4, 7.46, w, 0.1, 0.1, 'shedDark']);
    o.push([x + w / 2 - 0.25, H - 0.2, 7.5, 0.5, 0.2, 0.1, 'led']);
  }
  if (L === 3) {
    o.push([0.5, 0.25, 7.6, 7, 0.3, 0.4, 'concrete']);
    for (const [x, z, c] of [[0.1, 1.0, 'orange'], [0.1, 2.3, 'sandbag'], [7.1, 3.0, 'orange']]) o.push([x, 0.25, z, 0.8, 0.8, 1.0, c]);
  }
  return { boxes: o, meta: {} };
}

// factory: block with chimney stacks and a conveyor
function factory(L) {
  const o = [];
  const H = [2.8, 3.4, 3.8][L - 1];
  o.push([0.2, 0, 0.3, 7.6, 0.3, 7.4, 'steel']);
  o.push([0.5, 0.3, 2.6, 4.6, H, 4.8, 'hullDark']);
  o.push([0.4, 0.3 + H, 2.5, 4.8, 0.3, 5.0, 'dark']);
  for (let i = 0; i < 4; i++) o.push([0.7 + i * 1.1, 0.6 + H, 3.0, 0.7, 0.5, 4.0, 'steel']);
  o.push([0.8, 0.9, 7.38, 1.4, 1.2, 0.1, 'win']);
  o.push([3.3, 0.3, 7.38, 1.4, 1.8, 0.1, 'dark']);
  o.push([0.5, 0.3 + H * 0.55, 7.36, 4.6, 0.3, 0.1, 'yellow']);
  const ns = [2, 3, 4][L - 1];
  for (let i = 0; i < ns; i++) {
    const x = 1.1 + i * 1.2;
    const sh = 2.6 + (i % 2) * 0.8 + L * 0.6;
    disc(o, x, 0.3 + H + 0.3, 1.6, 0.5, sh, 'hull2', { step: 0.5 });
    disc(o, x, 0.3 + H + 0.3 + sh * 0.7, 1.6, 0.5, 0.3, 'red', { step: 0.5, grow: 0.05 });
    disc(o, x, 0.3 + H + 0.3 + sh, 1.6, 0.4, 0.2, 'black', { step: 0.5 });
  }
  o.push([0.5, 0.3 + H, 1.2, ns * 1.2 + 0.2, 0.3, 0.9, 'dark']);
  for (let i = 0; i < 6; i++) {   // conveyor along the east side, rising into the building
    const x = 5.2 + i * 0.45;
    o.push([x, 0.5 + i * 0.28, 3.2, 0.5, 0.18, 2.6, 'dark']);
    o.push([x, 0.5 + i * 0.28 + 0.18, 3.2, 0.5, 0.1, 0.12, 'yellow']);
    o.push([x, 0.5 + i * 0.28 + 0.18, 5.68, 0.5, 0.1, 0.12, 'yellow']);
  }
  for (const x of [5.4, 6.8, 7.4]) o.push([x, 0.3, 4.3, 0.22, 0.5 + (x - 5.2) * 0.62, 0.22, 'metal']);
  o.push([6.4, 1.6, 4.1, 0.6, 0.35, 0.5, 'regolith']);
  o.push([7.0, 1.95, 4.5, 0.5, 0.3, 0.5, 'regolith2']);
  o.push([6.9, 0.3, 6.3, 1.1, 0.7, 1.1, 'regolith']);
  if (L >= 2) o.push([5.4, 0.3, 0.8, 2.3, 1.6, 1.6, 'orangeDark']);
  if (L === 3) {
    o.push([5.2, 1.9, 0.9, 2.5, 0.2, 1.4, 'orange']);
    o.push([5.4, 0.3, 6.5, 0.8, 0.8, 0.8, 'tank']);
  }
  return { boxes: o, meta: {} };
}

// sabatier: two tanks with a flame-coloured core light (core keys glow while the module is active)
function sabatier(L) {
  const o = [];
  const r = [1.4, 1.6, 1.7][L - 1];
  o.push([0.3, 0, 0.3, 7.4, 0.3, 7.4, 'steel']);
  const cy = 0.3 + 0.9 + r;
  sphere(o, 1.9, cy, 2.1, r, 'tank');
  disc(o, 1.9, cy - 0.15, 2.1, r, 0.3, 'orange', { step: 0.5, grow: 0.06 });
  for (const [px, pz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) o.push([1.9 + px - 0.12, 0.3, 2.1 + pz - 0.12, 0.24, 1.0, 0.24, 'dark']);
  if (L === 1) {
    for (const [px, pz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) o.push([1.9 + px - 0.12, 0.3, 5.9 + pz - 0.12, 0.24, 1.0, 0.24, 'dark']);
    sphere(o, 1.9, cy, 5.9, r, 'tank');
    disc(o, 1.9, cy - 0.15, 5.9, r, 0.3, 'orange', { step: 0.5, grow: 0.06 });
  } else {
    const th = 3.4 + L * 0.4;
    disc(o, 1.9, 0.3, 5.9, r, th, 'tank', { step: 0.5 });
    disc(o, 1.9, 1.5, 5.9, r, 0.35, 'orange', { step: 0.5, grow: 0.06 });
    disc(o, 1.9, 0.3 + th, 5.9, r * 0.6, 0.3, 'steel', { step: 0.5 });
  }
  o.push([4.4, 0.3, 2.6, 3.2, 3.0, 2.8, 'orangeDark']);   // reactor unit (the lit part)
  o.push([4.3, 3.3, 2.5, 3.4, 0.25, 3.0, 'steel']);
  o.push([6.05, 0.9, 3.4, 0.12, 1.9, 1.2, 'core']);
  o.push([4.7, 0.9, 5.38, 2.4, 1.6, 0.12, 'core']);
  disc(o, 6.0, 3.55, 4.0, 0.5, 1.4, 'steel', { step: 0.5 });
  o.push([5.7, 4.95, 3.7, 0.6, 0.5, 0.6, 'core']);
  o.push([3.4, 1.0, 2.0, 1.1, 0.3, 0.3, 'metal']);
  o.push([3.4, 1.0, 5.8, 1.1, 0.3, 0.3, 'metal']);
  o.push([3.4, 1.0, 2.0, 0.3, 0.3, 3.9, 'metal']);
  if (L === 3) {
    o.push([6.4, 0.3, 6.2, 1.2, 1.2, 1.2, 'hull2']);
    o.push([6.8, 1.5, 6.6, 0.4, 0.3, 0.4, 'led']);
  }
  return { boxes: o, meta: {} };
}

// mine: drill rig over a pit, ore piles, tiny robots
function mine(L) {
  const o = [];
  const gh = [4.8, 6.0, 7.2][L - 1];
  o.push([0.2, 0, 0.2, 7.6, 0.2, 7.6, 'regolith2']);
  o.push([2.0, 0.2, 2.0, 4.0, 0.05, 4.0, 'black']);   // pit floor inside a raised rim
  o.push([1.6, 0.2, 1.6, 4.8, 0.45, 0.5, 'regolith']);
  o.push([1.6, 0.2, 5.9, 4.8, 0.45, 0.5, 'regolith']);
  o.push([1.6, 0.2, 2.1, 0.5, 0.45, 3.8, 'regolith']);
  o.push([5.9, 0.2, 2.1, 0.5, 0.45, 3.8, 'regolith']);
  for (const [x, z] of [[2.2, 2.2], [5.4, 2.2], [2.2, 5.4], [5.4, 5.4]]) o.push([x, 0.2, z, 0.4, gh, 0.4, 'yellow']);
  for (let y = 1.4; y < gh - 0.3; y += 1.6) {
    o.push([2.2, y, 2.2, 3.6, 0.2, 0.2, 'black']);
    o.push([2.2, y, 5.4, 3.6, 0.2, 0.2, 'black']);
    o.push([2.2, y, 2.2, 0.2, 0.2, 3.6, 'black']);
    o.push([5.6, y, 2.2, 0.2, 0.2, 3.6, 'black']);
  }
  o.push([2.0, gh, 2.0, 4.0, 0.5, 4.0, 'hullDark']);
  o.push([3.4, gh + 0.5, 3.4, 1.2, 0.8, 1.2, 'steel']);
  o.push([3.8, gh + 1.3, 3.8, 0.4, 0.4, 0.4, 'led']);
  o.push([3.75, 0.25, 3.75, 0.5, gh - 0.2, 0.5, 'metal']);   // drill rod
  o.push([3.55, 0.25, 3.55, 0.9, 0.5, 0.9, 'steel']);
  o.push([0.4, 0.2, 0.5, 1.4, 0.8, 1.3, 'regolith']);
  o.push([0.7, 1.0, 0.7, 0.8, 0.5, 0.7, 'regolith2']);
  o.push([6.5, 0.2, 6.5, 1.2, 0.7, 1.2, 'crystal']);
  if (L >= 2) o.push([6.4, 0.2, 0.4, 1.3, 0.9, 1.4, 'regolith']);
  if (L === 3) { o.push([0.5, 0.2, 6.4, 1.2, 0.6, 1.2, 'crystal']); o.push([6.6, 0.9, 6.7, 0.6, 0.5, 0.6, 'crystal']); }
  const robots = L === 1 ? [[0.5, 3.2]] : L === 2 ? [[0.5, 3.2], [6.8, 3.6]] : [[0.5, 3.2], [6.8, 3.6], [4.0, 6.9]];
  for (const [x, z] of robots) {
    o.push([x, 0.2, z, 0.9, 0.35, 0.7, 'wheel']);
    o.push([x + 0.05, 0.55, z + 0.05, 0.8, 0.4, 0.6, 'hull2']);
    o.push([x + 0.55, 0.95, z + 0.2, 0.2, 0.2, 0.2, 'led']);
  }
  return { boxes: o, meta: {} };
}

// radShield: ring of dark panels (kept simple)
function radShield(L) {
  const o = [];
  const h = [3, 4, 5][L - 1];
  o.push([0.8, 0, 0.8, 6.4, 0.25, 6.4, 'steel']);
  for (const [x, z, w, d] of [[1.0, 0.9, 2.4, 0.4], [4.6, 0.9, 2.4, 0.4], [1.0, 6.7, 2.4, 0.4], [4.6, 6.7, 2.4, 0.4],
    [0.9, 1.0, 0.4, 2.4], [0.9, 4.6, 0.4, 2.4], [6.7, 1.0, 0.4, 2.4], [6.7, 4.6, 0.4, 2.4]]) {
    o.push([x, 0.25, z, w, h, d, 'dark']);
    o.push([x - 0.05, h + 0.25, z - 0.05, w + 0.1, 0.2, d + 0.1, 'frame']);
    o.push([x - 0.02, 1.2, z - 0.02, w + 0.04, 0.2, d + 0.04, 'accent']);
  }
  o.push([3.6, 0.25, 3.6, 0.8, h + 0.6, 0.8, 'hullDark']);
  o.push([3.4, h + 0.85, 3.4, 1.2, 0.3, 1.2, 'steel']);
  o.push([3.8, h + 1.15, 3.8, 0.4, 0.4, 0.4, 'led']);
  return { boxes: o, meta: {} };
}

// dome: the slot shows a small control base; the big shell is drawn by dome.js
function domeBase() {
  const o = [];
  disc(o, 4, 0, 4, 3.6, 0.35, 'concrete', { step: 0.5 });
  disc(o, 4, 0.35, 4, 3.0, 0.2, 'frame', { step: 0.5 });
  for (const [px, pz] of [[1.2, 1.2], [6.5, 1.2], [1.2, 6.5], [6.5, 6.5]]) {
    o.push([px, 0.35, pz, 0.3, 1.6, 0.3, 'metal']);
    o.push([px - 0.05, 1.95, pz - 0.05, 0.4, 0.2, 0.4, 'led']);
  }
  disc(o, 4, 0.55, 4, 1.6, 0.8, 'hull2', { step: 0.5 });
  disc(o, 4, 1.35, 4, 1.1, 0.5, 'glass', { step: 0.5 });
  disc(o, 4, 1.85, 4, 0.6, 0.4, 'glass', { step: 0.5 });
  return { boxes: o, meta: {} };
}

const BUILDERS = { habitat, solar, battery, moxie, extractor, greenhouse, shelter, reactor, gym, hospital, thermal, pressurizer, waterFilter, decon, warehouse, factory, sabatier, mine, dome: domeBase, radShield };

export const MODULE_TYPES = Object.keys(BUILDERS);

export const MODELS = {};
for (const type of MODULE_TYPES) {
  MODELS[type] = [1, 2, 3].map((L) => {
    const m = BUILDERS[type](L);
    let top = 0;
    for (const b of m.boxes) top = Math.max(top, b[1] + b[4]);
    m.meta.height = top;
    return m;
  });
}

MODELS.__generic = [1, 2, 3].map(() => { const m = generic(); let top = 0; for (const b of m.boxes) top = Math.max(top, b[1] + b[4]); m.meta.height = top; return m; });

export function getModel(type, level) {
  const list = MODELS[type] || MODELS.__generic;   // unknown module types: generic gray box
  if (!list) return null;
  return list[Math.min(3, Math.max(1, level | 0)) - 1];
}

// ---------- props (static scenery) ----------

export function landerBoxes() {
  const o = [];
  for (const [px, pz] of [[-2.6, -2.6], [2.2, -2.6], [-2.6, 2.2], [2.2, 2.2]]) {
    o.push([px, 0.4, pz, 0.4, 2.2, 0.4, 'metal']);
    o.push([px - 0.3, 0.4, pz - 0.3, 1.0, 0.2, 1.0, 'steel']);
  }
  disc(o, 0, 2.2, 0, 2.2, 1.6, 'hull');
  disc(o, 0, 2.6, 0, 2.2, 0.4, 'gold', { grow: 0.06 });
  disc(o, 0, 3.8, 0, 1.6, 1.0, 'hull');
  disc(o, 0, 4.8, 0, 0.9, 0.5, 'hull2');
  o.push([1.4, 3.9, 1.4, 0.6, 0.5, 0.15, 'win']);
  o.push([-0.4, 1.6, -0.4, 0.8, 0.6, 0.8, 'dark']);
  return o;
}

export function garageBoxes() {
  const o = [];
  o.push([-4, 0, -3, 8, 0.3, 6.5, 'concrete']);
  o.push([-4, 0.3, -3, 8, 3.6, 0.5, 'hull2']);
  o.push([-4, 0.3, -3, 0.5, 3.6, 5.5, 'hull2']);
  o.push([3.5, 0.3, -3, 0.5, 3.6, 5.5, 'hull2']);
  o.push([-4.2, 3.9, -3.2, 8.4, 0.5, 6.0, 'hull']);
  o.push([-4.25, 3.5, 2.3, 8.5, 0.35, 0.3, 'accent']);
  o.push([-3.5, 0.3, -2.5, 7, 0.1, 4.8, 'dark']);
  o.push([-3.7, 4.4, -2, 3, 0.15, 3.5, 'cell']);
  o.push([0.3, 4.4, -2, 3, 0.15, 3.5, 'cell2']);
  o.push([3.2, 3.0, 2.3, 0.5, 0.25, 0.12, 'led']);
  o.push([-3.7, 3.0, 2.3, 0.5, 0.25, 0.12, 'led']);
  return o;
}

export function roverBoxes() {
  const o = [];
  for (const wz of [-1.6, 0, 1.6]) {
    o.push([-1.75, 0, wz - 0.45, 0.5, 0.9, 0.9, 'wheel']);
    o.push([1.25, 0, wz - 0.45, 0.5, 0.9, 0.9, 'wheel']);
  }
  o.push([-1.3, 0.6, -2.3, 2.6, 0.7, 4.6, 'hull']);
  o.push([-1.4, 0.85, -2.4, 2.8, 0.2, 4.8, 'accent']);
  o.push([-1.2, 1.3, -2.1, 2.4, 0.15, 2.4, 'cell']);
  o.push([-0.9, 1.3, 0.5, 1.8, 1.0, 1.6, 'hull2']);
  o.push([-0.7, 1.6, 2.08, 1.4, 0.5, 0.1, 'win']);
  o.push([0.6, 2.3, 1.2, 0.2, 1.2, 0.2, 'metal']);
  o.push([0.35, 3.5, 1.0, 0.7, 0.4, 0.6, 'dark']);
  return o;
}

// Site markers: stone ring + pole with a coloured beacon + resource pile.
export function siteBoxes(id) {
  const o = [];
  const beacon = id === 'ice' ? 'siteIce' : id === 'regolith' ? 'siteReg' : 'siteMin';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const s = 0.6 + ((i * 37) % 5) * 0.12;
    o.push([Math.cos(a) * 3.6 - s / 2, 0, Math.sin(a) * 3.6 - s / 2, s, s * 0.7, s, i % 2 ? 'rock' : 'rock2']);
  }
  o.push([-0.2, 0, -0.2, 0.4, 4.2, 0.4, 'metal']);
  o.push([-0.45, 4.2, -0.45, 0.9, 0.9, 0.9, beacon]);
  o.push([-0.6, 0, -0.6, 1.2, 0.3, 1.2, 'steel']);
  if (id === 'ice') {
    o.push([0.8, 0, 0.6, 1.4, 0.9, 1.2, 'ice']);
    o.push([-2.0, 0, 0.9, 1.0, 0.7, 1.0, 'ice']);
    o.push([0.4, 0, -2.0, 1.1, 1.2, 0.9, 'ice']);
    o.push([1.0, 0.9, 0.8, 0.8, 0.5, 0.7, 'ice']);
  } else if (id === 'regolith') {
    o.push([0.6, 0, 0.4, 2.2, 0.8, 2.0, 'regolith']);
    o.push([0.9, 0.8, 0.7, 1.4, 0.6, 1.3, 'regolith2']);
    o.push([-2.4, 0, -0.5, 1.4, 0.6, 1.6, 'regolith']);
  } else {
    o.push([0.8, 0, 0.5, 0.6, 1.6, 0.6, 'crystal']);
    o.push([1.4, 0, 1.0, 0.5, 1.0, 0.5, 'crystal']);
    o.push([-1.8, 0, 0.8, 0.6, 1.3, 0.6, 'crystal']);
    o.push([0.2, 0, -1.9, 1.3, 0.8, 1.1, 'rock']);
  }
  return o;
}

// Construction scaffold around the footprint (local coords, centred).
export function scaffoldBoxes(height) {
  const o = [];
  const H = Math.max(2, height + 0.6);
  const lo = -4.45, hi = 4.2;
  const ps = [lo, -0.12, hi];
  for (const x of ps) for (const z of ps) {
    if (x === -0.12 && z === -0.12) continue;
    o.push([x, 0, z, 0.25, H, 0.25, 'yellow']);
  }
  for (let y = 1.6; y <= H; y += 1.8) {
    o.push([lo, y, lo, hi - lo + 0.25, 0.15, 0.2, 'yellow']);
    o.push([lo, y, hi, hi - lo + 0.25, 0.15, 0.2, 'yellow']);
    o.push([lo, y, lo, 0.2, 0.15, hi - lo + 0.25, 'yellow']);
    o.push([hi, y, lo, 0.2, 0.15, hi - lo + 0.25, 'yellow']);
    o.push([lo, y - 0.12, hi - 0.6, hi - lo + 0.25, 0.1, 0.8, 'hull2']);
  }
  // crane arm
  o.push([hi, H, hi, 0.3, 1.6, 0.3, 'yellow']);
  o.push([-1.5, H + 1.6, hi, 6, 0.3, 0.3, 'yellow']);
  o.push([-1.3, H + 0.4, hi + 0.05, 0.1, 1.2, 0.1, 'dark']);
  o.push([-1.6, H - 0.1, hi - 0.25, 0.7, 0.5, 0.7, 'orange']);
  return o;
}

// Colonist figure (local coords, centred at feet, facing +z). Stripe boxes are separate.
export function colonistBoxes() {
  return [
    [-0.32, 0, -0.15, 0.26, 0.7, 0.3, 'hull'],
    [0.06, 0, -0.15, 0.26, 0.7, 0.3, 'hull'],
    [-0.36, 0.7, -0.2, 0.72, 0.75, 0.42, 'hull'],
    [-0.3, 0.75, -0.42, 0.6, 0.65, 0.22, 'hull2'],
    [-0.52, 0.8, -0.12, 0.16, 0.6, 0.24, 'hull'],
    [0.36, 0.8, -0.12, 0.16, 0.6, 0.24, 'hull'],
    [-0.28, 1.45, -0.26, 0.56, 0.52, 0.52, 'hull'],
    [-0.2, 1.55, 0.2, 0.4, 0.28, 0.1, 'gold'],
  ];
}
export function colonistStripeBoxes() {
  return [
    [-0.38, 1.05, -0.22, 0.76, 0.16, 0.46, 'hull'],
    [-0.3, 0.75, -0.44, 0.62, 0.12, 0.26, 'hull'],
  ];
}
