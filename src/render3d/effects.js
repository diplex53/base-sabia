// Cheap effects: storm dust particles, blinking beacons, night ground glows, slot hover/selection outlines.
import * as THREE from 'three';
import { GeoBuilder } from './voxels.js';
import { PAD, PAD_H } from './layout.js';

export function createDust(count = 900) {
  const pos = new Float32Array(count * 3);
  const rnd = mulberry(99);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rnd() * 120 - 60; pos[i * 3 + 1] = rnd() * 22; pos[i * 3 + 2] = rnd() * 120 - 60;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uAlpha: { value: 0 }, uSize: { value: 4 }, uColor: { value: new THREE.Color(0xc98a52) },
      uCenter: { value: new THREE.Vector3() },
    },
    vertexShader: `
      uniform float uTime; uniform float uSize; uniform vec3 uCenter; varying float vF;
      void main(){
        vec3 p = position;
        p.x += uTime * 9.0 + sin(uTime * 0.7 + p.z * 0.1) * 2.0;
        p.z += uTime * 3.5;
        p.y += sin(uTime * 1.3 + p.x * 0.2) * 0.8;
        p.xz = mod(p.xz - uCenter.xz + 60.0, 120.0) - 60.0 + uCenter.xz;
        vF = fract(position.x * 13.37);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.6 + vF);
      }`,
    fragmentShader: `
      uniform float uAlpha; uniform vec3 uColor; varying float vF;
      void main(){ gl_FragColor = vec4(uColor * (0.8 + 0.4 * vF), uAlpha * (0.5 + 0.5 * vF));
      #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return {
    object: points,
    update(time, alpha, pr, zoom, center) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uAlpha.value = alpha;
      mat.uniforms.uSize.value = 2.2 * pr * Math.max(0.6, Math.min(3, zoom));
      mat.uniforms.uCenter.value.copy(center);
      points.visible = alpha > 0.01;
    },
    dispose() { g.dispose(); mat.dispose(); },
  };
}

export function createBeacons(max = 24) {
  const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  geo.translate(0, 0.4, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  mesh.count = 0;
  mesh.frustumCulled = false;
  const m4 = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let n = 0;
  return {
    object: mesh,
    begin() { n = 0; },
    add(x, y, z, hex, on) {
      if (n >= max) return;
      const k = on ? 1 : 0.18;
      s.set(1, on ? 1.15 : 0.9, 1);
      p.set(x, y, z);
      m4.compose(p, q, s);
      mesh.setMatrixAt(n, m4);
      c.setHex(hex).multiplyScalar(k);
      mesh.setColorAt(n, c);
      n++;
    },
    end() {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.visible = n > 0;
    },
    dispose() { geo.dispose(); mat.dispose(); mesh.dispose(); },
  };
}

export function createGlows(max = 20) {
  const geo = new THREE.CircleGeometry(1, 28);
  geo.rotateX(-Math.PI / 2);
  const cnt = geo.attributes.position.count;
  const colors = new Float32Array(cnt * 4);
  for (let i = 0; i < cnt; i++) {
    const x = geo.attributes.position.getX(i), z = geo.attributes.position.getZ(i);
    const r = Math.hypot(x, z);
    colors[i * 4] = 1; colors[i * 4 + 1] = 1; colors[i * 4 + 2] = 1; colors[i * 4 + 3] = r < 0.01 ? 1 : 0;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.setColorAt(0, new THREE.Color(0, 0, 0));
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  const m4 = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let n = 0;
  return {
    object: mesh,
    begin() { n = 0; },
    add(x, z, radius, hex, k, y = PAD_H + 0.12) {
      if (n >= max || k <= 0.01) return;
      p.set(x, y, z); s.set(radius, 1, radius);
      m4.compose(p, q, s);
      mesh.setMatrixAt(n, m4);
      c.setHex(hex).multiplyScalar(k);
      mesh.setColorAt(n, c);
      n++;
    },
    end() {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.visible = n > 0;
    },
    dispose() { geo.dispose(); mat.dispose(); mesh.dispose(); },
  };
}

// Square outline frame around a pad, optionally with corner posts (selection).
function frameGeometry(size, thick, height, posts) {
  const gb = new GeoBuilder();
  const w = [1, 1, 1];
  const h = size / 2;
  gb.box(-h, 0, -h, size, height, thick, w);
  gb.box(-h, 0, h - thick, size, height, thick, w);
  gb.box(-h, 0, -h + thick, thick, height, size - thick * 2, w);
  gb.box(h - thick, 0, -h + thick, thick, height, size - thick * 2, w);
  if (posts) {
    const L = 2.2;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = sx < 0 ? -h - 0.15 : h - 0.45, z = sz < 0 ? -h - 0.15 : h - 0.45;
      gb.box(x, 0, z, 0.6, 1.6, 0.6, w);
      gb.box(sx < 0 ? -h - 0.15 : h + 0.15 - L, 0, z, L, 0.5, 0.6, w);
      gb.box(x, 0, sz < 0 ? -h - 0.15 : h + 0.15 - L, 0.6, 0.5, L, w);
    }
  }
  return gb.geometry();
}

export function createOutlines() {
  const hoverMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, fog: false });
  const hover = new THREE.Mesh(frameGeometry(PAD + 0.3, 0.35, 0.25, false), hoverMat);
  hover.visible = false;
  hover.renderOrder = 3;
  const selMat = new THREE.MeshBasicMaterial({ color: 0xffe14d, toneMapped: false, fog: false });
  const sel = new THREE.Group();
  const selFrame = new THREE.Mesh(frameGeometry(PAD + 0.5, 0.45, 0.3, false), selMat);
  const selPosts = new THREE.Mesh(frameGeometry(PAD + 1.2, 0.01, 0.01, true), selMat);
  sel.add(selFrame, selPosts);
  sel.visible = false;
  const base = new THREE.Color(0xffe14d), hi = new THREE.Color(0xffffff);
  return {
    hover, sel,
    setHover(pos) {
      hover.visible = !!pos;
      if (pos) hover.position.set(pos.x, PAD_H + 0.02, pos.z);
    },
    setSelected(pos) {
      sel.visible = !!pos;
      if (pos) sel.position.set(pos.x, PAD_H + 0.02, pos.z);
    },
    animate(time) {
      if (!sel.visible) return;
      const k = 0.5 + 0.5 * Math.sin(time * 5);
      selMat.color.copy(base).lerp(hi, k * 0.6);
      const s = 1 + 0.03 * Math.sin(time * 5);
      selPosts.scale.set(s, 1, s);
      selPosts.position.y = 0.25 * k;
    },
    dispose() {
      hover.geometry.dispose(); hoverMat.dispose(); selFrame.geometry.dispose(); selPosts.geometry.dispose(); selMat.dispose();
    },
  };
}

export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
