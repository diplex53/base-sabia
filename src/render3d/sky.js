// Day/night and dust lighting: computes light/sky/fog parameters from the state,
// and draws the background (vertical gradient + stars) in its own tiny scene.
import * as THREE from 'three';

const col = (h) => new THREE.Color(h);
const C = {
  // A dark presentation stage separates the voxel diorama from the interface.
  // Lighting on the terrain still follows the simulated day/night cycle.
  dayTop: col(0x101d2d), dayBot: col(0x344550),
  duskTop: col(0x142033), duskBot: col(0x65454b),
  nightTop: col(0x050a14), nightBot: col(0x172338),
  stormTop: col(0x2d2530), stormBot: col(0x775141),
  sunNoon: col(0xffecd8), sunLow: col(0xffac72), sunStorm: col(0xffb07c),
  hemiDay: col(0xcbdfe7), hemiNight: col(0x8da7d5), hemiStorm: col(0xc99778),
  groundDay: col(0x80513e), groundNight: col(0x243144),
  speWarnTop: col(0x6a3aa8), speWarnBot: col(0xb070d0),
  speActTop: col(0x9a1fa8), speActBot: col(0xf0409a),
};

function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

const _a = new THREE.Color(), _b = new THREE.Color(), _c = new THREE.Color(), _d = new THREE.Color();

export function skyParams(state, out = {}, time = 0) {
  const t = state.t || 0;
  const f = ((t % 1) + 1) % 1;
  const env = state.env || {};
  const sun = Math.max(0, Math.min(1, env.sun !== undefined ? env.sun : Math.max(0, Math.sin(Math.PI * (f - 0.25) / 0.5))));
  const tau = env.tau !== undefined ? env.tau : 0.5;
  const dustK = Math.pow(smoothstep(0.5, 9.5, tau), 0.75);

  // sun direction: rises in +x (east) at f=0.25, sets in -x at f=0.75, slightly to the south (+z)
  const th = Math.PI * (f - 0.25) / 0.5;
  const el = Math.sin(th);
  out.sunDir = out.sunDir || new THREE.Vector3();
  if (sun > 0) out.sunDir.set(Math.cos(th), Math.max(0.12, el) + 0.08, 0.55).normalize();
  else out.sunDir.set(0.3, 1, 0.55).normalize();

  const dayK = smoothstep(0.0, 0.45, sun);
  const twK = smoothstep(0.0, 0.12, sun);   // twilight onset
  const lowK = 1 - smoothstep(0.1, 0.55, sun); // low sun warmth

  out.sunColor = (out.sunColor || new THREE.Color()).copy(C.sunNoon).lerp(C.sunLow, lowK).lerp(C.sunStorm, dustK * 0.6);
  out.sunI = 2.15 * Math.pow(sun, 0.55) * (1 - 0.8 * dustK);

  // ambient
  out.hemiSky = (out.hemiSky || new THREE.Color()).copy(C.hemiNight).lerp(C.hemiDay, dayK).lerp(C.hemiStorm, dustK * 0.7);
  out.hemiGround = (out.hemiGround || new THREE.Color()).copy(C.groundNight).lerp(C.groundDay, dayK);
  out.hemiI = 0.95 + 0.65 * dayK - 0.25 * dustK * dayK;
  out.fillI = 0.22 + 0.38 * (1 - dayK);

  // sky gradient
  _a.copy(C.nightTop).lerp(C.duskTop, twK); _a.lerp(C.dayTop, dayK);
  _b.copy(C.nightBot).lerp(C.duskBot, twK); _b.lerp(C.dayBot, smoothstep(0.15, 0.6, sun));
  const stormBright = 0.25 + 0.75 * dayK;
  out.bgTop = (out.bgTop || new THREE.Color()).copy(_a).lerp(_c.copy(C.stormTop).multiplyScalar(stormBright), dustK * 0.9);
  out.bgBot = (out.bgBot || new THREE.Color()).copy(_b).lerp(_d.copy(C.stormBot).multiplyScalar(stormBright), dustK * 0.9);
  // solar particle event: violet (warning, slow pulse) or magenta (active); distinct from the brown dust look
  let speK = 0, speA = 0;
  const spe = env.spe;
  if (spe && (spe.phase === 'warning' || spe.phase === 'active')) {
    if (spe.phase === 'active') { speA = 1; speK = 0.68 + 0.1 * Math.sin(time * 2.6); }
    else speK = 0.22 + 0.22 * (0.5 + 0.5 * Math.sin(time * 1.1));
    _c.copy(C.speWarnTop).lerp(C.speActTop, speA);
    _d.copy(C.speWarnBot).lerp(C.speActBot, speA);
    out.bgTop.lerp(_c, speK * 0.9);
    out.bgBot.lerp(_d, speK * 0.75);
    out.hemiSky.lerp(_d, 0.2 + 0.3 * speA);
    out.sunColor.lerp(_d, 0.12 + 0.2 * speA);
  }
  out.speK = speK;
  out.speActive = speA;
  out.fogColor = (out.fogColor || new THREE.Color()).copy(out.bgBot).lerp(out.bgTop, 0.25);
  out.fogNear = 200 - 110 * dustK;
  out.fogFar = 420 - 120 * dustK;

  out.nightK = 1 - dayK;
  out.starAlpha = (1 - twK * 0.6 - dayK * 0.4) * (1 - dustK) * (1 - dayK);
  out.dustK = dustK;
  out.storm = !!env.storm;
  out.particleAlpha = env.storm ? 0.55 + 0.35 * dustK : 0.5 * smoothstep(1.5, 4, tau);
  out.sun = sun;
  return out;
}

export function createBackground() {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const gradMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() } },
    vertexShader: 'varying vec2 vUV; void main(){ vUV = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uBot; varying vec2 vUV; void main(){ vec3 c = mix(uBot, uTop, smoothstep(0.0, 1.0, vUV.y)); float vignette = 1.0 - 0.32 * smoothstep(0.2, 0.85, distance(vUV, vec2(0.5, 0.45))); gl_FragColor = vec4(c * vignette, 1.0); \n#include <colorspace_fragment>\n }',
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), gradMat);
  quad.frustumCulled = false;
  scene.add(quad);

  const n = 260;
  const pos = new Float32Array(n * 3);
  const sz = new Float32Array(n);
  let s = 12345;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rnd() * 2 - 1; pos[i * 3 + 1] = rnd() * 2 - 1; pos[i * 3 + 2] = 0;
    sz[i] = rnd() < 0.85 ? 1.5 : 2.6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 }, uPR: { value: 1 } },
    vertexShader: 'attribute float aSize; uniform float uPR; uniform float uTime; varying float vTw; void main(){ vTw = 0.65 + 0.35 * sin(uTime * 1.7 + position.x * 91.0 + position.y * 57.0); gl_PointSize = aSize * uPR; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform float uAlpha; varying float vTw; void main(){ gl_FragColor = vec4(vec3(1.0, 0.95, 0.9), uAlpha * vTw); }',
    transparent: true, depthTest: false, depthWrite: false,
  });
  const stars = new THREE.Points(g, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  // announced ship: one bright point high in the sky
  const shipG = new THREE.BufferGeometry();
  shipG.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0.32, 0.62, 0]), 3));
  const shipMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 } },
    vertexShader: 'uniform float uTime; uniform float uPR; varying float vP; void main(){ vP = 0.75 + 0.25 * sin(uTime * 3.0); gl_PointSize = (9.0 + 3.0 * vP) * uPR; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'varying float vP; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); a = a * a; gl_FragColor = vec4(vec3(1.0, 0.97, 0.88), clamp(a * 1.3 * vP, 0.0, 1.0)); }',
    transparent: true, depthTest: false, depthWrite: false,
  });
  const shipPt = new THREE.Points(shipG, shipMat);
  shipPt.frustumCulled = false;
  shipPt.visible = false;
  scene.add(shipPt);

  // SPE (active): thin fast streaks crossing the sky away from the sun's side
  const NS = 48;
  const sp = new Float32Array(NS * 2 * 3);
  const se = new Float32Array(NS * 2);
  const ss = new Float32Array(NS * 2 * 2);
  for (let i = 0; i < NS; i++) {
    const a = rnd(), b = rnd();
    for (let k = 0; k < 2; k++) { se[i * 2 + k] = k; ss[(i * 2 + k) * 2] = a; ss[(i * 2 + k) * 2 + 1] = b; }
  }
  const streakG = new THREE.BufferGeometry();
  streakG.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  streakG.setAttribute('aEnd', new THREE.BufferAttribute(se, 1));
  streakG.setAttribute('aSeed', new THREE.BufferAttribute(ss, 2));
  const streakMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDir: { value: new THREE.Vector2(0, -1) }, uAlpha: { value: 0 } },
    vertexShader: 'attribute float aEnd; attribute vec2 aSeed; uniform float uTime; uniform vec2 uDir; varying float vA; void main(){ vec2 perp = vec2(-uDir.y, uDir.x); float ph = fract(uTime * (0.55 + aSeed.y * 0.6) + aSeed.x * 7.0); vec2 p = perp * ((fract(aSeed.x * 13.7) * 2.0 - 1.0) * 1.5) + uDir * (ph * 3.4 - 1.7) - uDir * aEnd * (0.1 + 0.12 * aSeed.y); vA = (1.0 - aEnd) * sin(ph * 3.14159); gl_Position = vec4(p, 0.0, 1.0); }',
    fragmentShader: 'uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(1.0, 0.7, 1.0, vA * uAlpha); }',
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const streaks = new THREE.LineSegments(streakG, streakMat);
  streaks.frustumCulled = false;
  streaks.visible = false;
  scene.add(streaks);

  return {
    scene, camera,
    apply(p, time, pr) {
      shipPt.visible = !!p.shipPoint;
      if (p.shipPoint) { shipMat.uniforms.uTime.value = time; shipMat.uniforms.uPR.value = pr; }
      const sa = p.speActive ? 0.5 : 0;
      streaks.visible = sa > 0;
      if (sa > 0) {
        streakMat.uniforms.uTime.value = time;
        streakMat.uniforms.uAlpha.value = sa;
        streakMat.uniforms.uDir.value.set(p.speDirX || 0, p.speDirY === undefined ? -1 : p.speDirY);
      }
      gradMat.uniforms.uTop.value.copy(p.bgTop);
      gradMat.uniforms.uBot.value.copy(p.bgBot);
      starMat.uniforms.uAlpha.value = p.starAlpha;
      starMat.uniforms.uTime.value = time;
      starMat.uniforms.uPR.value = pr;
      stars.visible = p.starAlpha > 0.02;
    },
    dispose() {
      quad.geometry.dispose(); gradMat.dispose(); g.dispose(); starMat.dispose();
      shipG.dispose(); shipMat.dispose(); streakG.dispose(); streakMat.dispose();
    },
  };
}
