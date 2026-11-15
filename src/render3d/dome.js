// Geodesic-style dome that covers the whole grid. Faceted (low-poly icosphere half), translucent fill + frame lines.
// Building: panels and frame appear from the ground up with `progress`. Built: faint glass shell (opacity ~0.15, depthWrite off).
// Never pickable: it is not part of the picking root and its raycast is disabled.
import * as THREE from 'three';
import { CELL } from './layout.js';

const GLASS = new THREE.Color(0x9fe8ff), AMBER = new THREE.Color(0xffc070);
const LINE = new THREE.Color(0xd8f6ff), LINE_AMBER = new THREE.Color(0xffd9a0);

function buildGeo(n) {
  const R = n * CELL / 2 * 1.414 + 2;
  const Hh = R * 0.68;
  const ico = new THREE.IcosahedronGeometry(1, 3);   // non-indexed, 1280/4... faces; we keep the upper half
  const p = ico.attributes.position;
  const tris = [];
  for (let i = 0; i < p.count; i += 3) {
    const v = [];
    let cy = 0;
    for (let k = 0; k < 3; k++) { v.push([p.getX(i + k), p.getY(i + k), p.getZ(i + k)]); cy += p.getY(i + k) / 3; }
    if (cy < -0.001) continue;
    for (const a of v) { a[0] *= R; a[1] = Math.max(0, a[1]) * Hh; a[2] *= R; }
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
  const triY = Float32Array.from(tris, (t) => Math.max(t.v[0][1], t.v[1][1], t.v[2][1]) - 0.0);
  const triMinY = Float32Array.from(tris, (t) => Math.min(t.v[0][1], t.v[1][1], t.v[2][1]));
  const edgeY = Float32Array.from(el, (e) => Math.min(e[0][1], e[1][1]));
  return { fill, lines, triCount: tris.length, edgeCount: el.length, R, Hh, triMinY, edgeY };
}

export function createDome() {
  const group = new THREE.Group();
  group.visible = false;
  const fillMat = new THREE.MeshBasicMaterial({ color: GLASS, vertexColors: true, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const lineMat = new THREE.LineBasicMaterial({ color: LINE, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
  let g = null, mesh = null, lines = null, n = 0;
  const _c = new THREE.Color();

  function setGrid(newN) {
    if (newN === n && g) return;
    n = newN;
    if (mesh) { group.remove(mesh, lines); mesh.geometry.dispose(); lines.geometry.dispose(); }
    g = buildGeo(n);
    mesh = new THREE.Mesh(g.fill, fillMat);
    lines = new THREE.LineSegments(g.lines, lineMat);
    for (const o of [mesh, lines]) { o.frustumCulled = false; o.renderOrder = 6; o.castShadow = false; o.receiveShadow = false; o.raycast = () => {}; }
    group.add(mesh, lines);
  }

  // info: { exists, building, progress, amber }
  function update(info, time, nightK) {
    group.visible = !!info.exists && !!g;
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

  function dispose() {
    if (mesh) { mesh.geometry.dispose(); lines.geometry.dispose(); }
    fillMat.dispose(); lineMat.dispose();
  }
  return { object: group, setGrid, update, dispose, _c };
}
