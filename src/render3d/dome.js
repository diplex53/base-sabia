// Geodesic-style dome that covers the whole build area (all slots): an elliptical half-shell centred on it.
// Faceted (low-poly icosphere half), translucent fill + frame lines.
// Building: panels and frame appear from the ground up with `progress`. Built: faint glass shell (opacity ~0.15, depthWrite off).
// Never pickable: it is not part of the picking root and its raycast is disabled.
import * as THREE from 'three';
import { boundsRect } from './layout.js';

const GLASS = new THREE.Color(0x9fe8ff), AMBER = new THREE.Color(0xffc070);
const LINE = new THREE.Color(0xd8f6ff), LINE_AMBER = new THREE.Color(0xffd9a0);

// rx, rz: horizontal semi-axes (ellipse through the build rectangle's corners, plus a margin)
function buildGeo(rx, rz) {
  const Hh = Math.min(rx, rz) * 0.62;
  const ico = new THREE.IcosahedronGeometry(1, 3);   // non-indexed; we keep the upper half
  const p = ico.attributes.position;
  const tris = [];
  for (let i = 0; i < p.count; i += 3) {
    const v = [];
    for (let k = 0; k < 3; k++) v.push([p.getX(i + k), p.getY(i + k), p.getZ(i + k)]);
    // Keep every facet that reaches above the ground. Keeping only facets whose centroid was above it
    // dropped the ones straddling the equator and left notches all around the rim (shell looked unfinished).
    if (Math.max(v[0][1], v[1][1], v[2][1]) <= 0.001) continue;
    for (const a of v) {
      // below-ground vertices are pulled onto the rim ellipse at y = 0, so the shell meets the ground all around
      if (a[1] < 0) { const h = Math.hypot(a[0], a[2]) || 1; a[0] /= h; a[2] /= h; a[1] = 0; }
      a[0] *= rx; a[1] *= Hh; a[2] *= rz;
    }
    tris.push({ v, cy: Math.min(v[0][1], v[1][1], v[2][1]) });
  }
  ico.dispose();
  tris.sort((a, b) => a.cy - b.cy);
  const pos = new Float32Array(tris.length * 9), col = new Float32Array(tris.length * 9);
  const edges = new Map();
  tris.forEach((t, i) => {
    const sh = 0.78 + 0.22 * (((i * 2654435761) >>> 8) % 100) / 100;
    for (let k = 0; k < 3; k++) {
      pos.set(t.v[k], i * 9 + k * 3);
      col[i * 9 + k * 3] = sh; col[i * 9 + k * 3 + 1] = sh; col[i * 9 + k * 3 + 2] = sh;
      const a = t.v[k], b = t.v[(k + 1) % 3];
      const ka = a.map((x) => Math.round(x * 20)).join(','), kb = b.map((x) => Math.round(x * 20)).join(',');
      if (ka === kb) continue;   // collapsed edge on the rim
      const key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      if (!edges.has(key)) edges.set(key, [a, b, Math.min(a[1], b[1])]);
    }
  });
  const el = [...edges.values()].sort((a, b) => a[2] - b[2]);
  const lpos = new Float32Array(el.length * 6);
  el.forEach((e, i) => { lpos.set(e[0], i * 6); lpos.set(e[1], i * 6 + 3); });
  const fill = new THREE.BufferGeometry();
  fill.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  fill.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
  const triMinY = Float32Array.from(tris, (t) => t.cy);
  const edgeY = Float32Array.from(el, (e) => Math.min(e[0][1], e[1][1]));
  return { fill, lines, triCount: tris.length, edgeCount: el.length, Hh, triMinY, edgeY };
}

export function createDome() {
  const group = new THREE.Group();
  group.visible = false;
  const fillMat = new THREE.MeshBasicMaterial({ color: GLASS, vertexColors: true, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const lineMat = new THREE.LineBasicMaterial({ color: LINE, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
  let g = null, mesh = null, lines = null, sig = '';
  let userVisible = true;   // player toggle (HUD button): hides only the 3D shell

  // b: cell bounds { gx0, gx1, gz0, gz1 } of the build area
  function setBounds(b) {
    const r = boundsRect(b);
    const s = [r.x0, r.x1, r.z0, r.z1].join(',');
    if (s === sig && g) return;
    sig = s;
    if (mesh) { group.remove(mesh, lines); mesh.geometry.dispose(); lines.geometry.dispose(); }
    const M = 3;   // margin (world units) beyond the corner slots
    g = buildGeo((r.x1 - r.x0) / 2 * Math.SQRT2 + M, (r.z1 - r.z0) / 2 * Math.SQRT2 + M);
    group.position.set(r.cx, -0.4, r.cz);   // sunk a little so the rim never floats over bumpy soil
    mesh = new THREE.Mesh(g.fill, fillMat);
    lines = new THREE.LineSegments(g.lines, lineMat);
    for (const o of [mesh, lines]) { o.frustumCulled = false; o.renderOrder = 6; o.castShadow = false; o.receiveShadow = false; o.raycast = () => {}; }
    group.add(mesh, lines);
  }

  // info: { exists, building, progress, amber }
  function update(info, time, nightK) {
    group.visible = !!info.exists && !!g && userVisible;
    if (!group.visible) return;
    const p = info.building ? Math.max(0, Math.min(1, info.progress || 0)) : 1;
    // panels / frame appear from the ground up: a facet shows once its lowest point is below the rising level
    const lvl = p >= 1 ? 1e9 : p * g.Hh;
    let tc = 0; while (tc < g.triCount && g.triMinY[tc] <= lvl) tc++;
    let ec = 0; while (ec < g.edgeCount && g.edgeY[ec] <= lvl) ec++;
    mesh.geometry.setDrawRange(0, tc * 3);
    lines.geometry.setDrawRange(0, ec * 2);
    fillMat.color.copy(GLASS).lerp(AMBER, info.amber ? 0.55 : 0);
    fillMat.opacity = info.building ? 0.09 : 0.15;
    lineMat.color.copy(LINE).lerp(LINE_AMBER, info.amber ? 0.6 : 0);
    lineMat.opacity = (info.building ? 0.7 + 0.2 * Math.sin(time * 3) : 0.4) * (1 - 0.35 * (nightK || 0));
  }

  function setVisible(on) { userVisible = !!on; if (!userVisible) group.visible = false; }

  function dispose() {
    if (mesh) { mesh.geometry.dispose(); lines.geometry.dispose(); }
    fillMat.dispose(); lineMat.dispose();
  }
  return { object: group, setBounds, setVisible, update, dispose };
}
