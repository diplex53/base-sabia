// Merged voxel geometry builder and the shared "voxel" material.
// One BufferGeometry per model with position, normal, color and aFx attributes:
//   aFx.x = emissive flag (dark glass when off, glows with uEmitColor when on)
//   aFx.y = kind (1 = solar cell, blends to dust; 2 = plant, tinted by growth)
//   aFx.z = 1000 + base y for vertices that scale vertically with uScaleY (plants, battery gauge); 0 = none
import * as THREE from 'three';
import { PALETTE, EMIT_KEYS, DUST_KEYS, PLANT_KEYS, GLASS_KEYS, GAUGE_KEYS } from './palette.js';

const _c = new THREE.Color();
const LINEAR = {};
function linearColor(key) {
  let v = LINEAR[key];
  if (!v) {
    const hex = PALETTE[key] !== undefined ? PALETTE[key] : 0xff00ff;
    _c.setHex(hex);   // sRGB hex -> linear working space
    v = LINEAR[key] = [_c.r, _c.g, _c.b];
  }
  return v;
}

function hash3(x, y, z) {
  let h = Math.imul((x * 73856093) ^ (y * 19349663) ^ (z * 83492791), 0x27d4eb2d);
  h ^= h >>> 15;
  return ((h >>> 0) % 1000) / 1000;
}

export class GeoBuilder {
  constructor() {
    this.pos = []; this.nor = []; this.col = []; this.fx = []; this.idx = [];
    this.n = 0;
  }
  quad(a, b, c, d, nx, ny, nz, colA, colC, fx) {
    // a,b bottom (colA), c,d top (colC)
    const P = this.pos, N = this.nor, C = this.col, F = this.fx;
    P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    for (let i = 0; i < 4; i++) { N.push(nx, ny, nz); F.push(fx[0], fx[1], fx[2]); }
    C.push(colA[0], colA[1], colA[2], colA[0], colA[1], colA[2], colC[0], colC[1], colC[2], colC[0], colC[1], colC[2]);
    const n = this.n;
    this.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    this.n += 4;
  }
  // Box with min corner (x, y, z) and size (w, h, d). rgb = linear color. opts: {skipBottom, ao, fx}
  box(x, y, z, w, h, d, rgb, opts = {}) {
    const x0 = x, y0 = y, z0 = z, x1 = x + w, y1 = y + h, z1 = z + d;
    const fx = opts.fx || [0, 0, 0];
    const ao = opts.ao === undefined ? 0.82 : opts.ao;
    const top = rgb;
    const side = [rgb[0] * 0.97, rgb[1] * 0.97, rgb[2] * 0.97];
    const bot = h > 0.45 ? [side[0] * ao, side[1] * ao, side[2] * ao] : side;
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, bot, side, fx);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, bot, side, fx);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, bot, side, fx);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, bot, side, fx);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, top, top, fx);
    if (!opts.skipBottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, -1, 0, side, side, fx);
  }
  // Box from model data [x, y, z, w, h, d, key] with an offset.
  dataBox(b, ox, oy, oz, opts = {}) {
    const key = b[6];
    let rgb = linearColor(key);
    const emit = EMIT_KEYS.has(key);
    if (!emit && opts.jitter !== false) {
      const j = 0.94 + hash3(Math.round(b[0] * 4 + ox), Math.round(b[1] * 4 + oy), Math.round(b[2] * 4 + oz)) * 0.1;
      rgb = [rgb[0] * j, rgb[1] * j, rgb[2] * j];
    }
    let fx = [emit ? 1 : 0, DUST_KEYS.has(key) ? 1 : PLANT_KEYS.has(key) ? 2 : 0, 0];
    if (PLANT_KEYS.has(key) || GAUGE_KEYS.has(key)) fx[2] = 1000 + (PLANT_KEYS.has(key) ? 0.8 : b[1]);
    this.box(b[0] + ox, b[1] + oy, b[2] + oz, b[3], b[4], b[5], rgb, {
      fx,
      skipBottom: b[1] + oy <= (opts.groundY === undefined ? 0.001 : opts.groundY),
      ao: emit ? 1 : undefined,
    });
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aFx', new THREE.Float32BufferAttribute(this.fx, 3));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

// Build {opaque, glass} geometries from model boxes. Footprint models use offset -4 to centre.
export function buildBoxes(boxes, ox = 0, oy = 0, oz = 0, opts = {}) {
  const gb = new GeoBuilder();
  const glass = new GeoBuilder();
  for (const b of boxes) {
    if (GLASS_KEYS.has(b[6])) glass.dataBox(b, ox, oy, oz, { jitter: false, groundY: -1 });
    else gb.dataBox(b, ox, oy, oz, opts);
  }
  return { opaque: gb.geometry(), glass: glass.n ? glass.geometry() : null };
}

export function colorOf(key) { return linearColor(key); }

// ---------- material ----------

const VERT_PARS = `
attribute vec3 aFx;
varying vec3 vFx;
varying float vLX;
uniform float uScaleY;
`;
const VERT_BEGIN = `
#include <begin_vertex>
vFx = aFx;
vLX = position.x;
if (aFx.z > 0.5) {
  float by = aFx.z - 1000.0;
  transformed.y = by + (transformed.y - by) * uScaleY;
}
`;
const FRAG_PARS = `
varying vec3 vFx;
varying float vLX;
uniform float uSat;
uniform float uBright;
uniform vec3 uEmitColor;
uniform float uDust;
uniform vec3 uDustColor;
uniform float uSweepX;
uniform float uGrowth;
`;
const FRAG_COLOR = `
#include <color_fragment>
vec3 vxGlow = diffuseColor.rgb;
float vxEmit = step(0.5, vFx.x);
if (vFx.y > 0.5 && vFx.y < 1.5) {
  float d = uDust * step(uSweepX, vLX);
  diffuseColor.rgb = mix(diffuseColor.rgb, uDustColor, d);
}
if (vFx.y > 1.5) {
  diffuseColor.rgb *= mix(vec3(1.35, 1.2, 0.45), vec3(1.0), uGrowth);
}
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.045, 0.05, 0.065), vxEmit);
float vxL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(vec3(vxL), diffuseColor.rgb, uSat) * uBright;
`;
const FRAG_EMIT = `
#include <emissivemap_fragment>
totalEmissiveRadiance += vxGlow * uEmitColor * vxEmit;
`;

export function makeVoxMaterial(params = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, ...params });
  const u = {
    uSat: { value: 1 },
    uBright: { value: 1 },
    uEmitColor: { value: new THREE.Color(1, 1, 1) },
    uDust: { value: 0 },
    uDustColor: { value: new THREE.Color(0xc4995f) },
    uSweepX: { value: -1000 },
    uGrowth: { value: 1 },
    uScaleY: { value: 1 },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <begin_vertex>', VERT_BEGIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <color_fragment>', FRAG_COLOR)
      .replace('#include <emissivemap_fragment>', FRAG_EMIT);
  };
  mat.customProgramCacheKey = () => 'voxel-v1';
  return mat;
}
