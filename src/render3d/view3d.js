// 3D voxel view of the base. Reads the game state only; never mutates it.
// createView(container, { onSlotClick, onSiteClick }) -> { update(state, events, dtReal), setSelected(id|null), setInsets({top,right,bottom,left}), resize(), dispose() }
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildTerrain, buildEmptyMarks } from './terrain.js';
import { buildBoxes, makeVoxMaterial } from './voxels.js';
import { roverBoxes, landerBoxes } from './models.js';
import { ModuleCache, ModuleView } from './modules.js';
import { skyParams, createBackground } from './sky.js';
import { createDust, createBeacons, createGlows, createOutlines } from './effects.js';
import { createColonists } from './colonists.js';
import { cellCenter, PAD, PAD_H, PAN_LIMIT, GARAGE, LANDING_PAD, SITES, CELL, setGridSize, gridSizeOf, gridBoundsOf, boundsRect, DEFAULT_BOUNDS, BATTERY_CAPACITY_FALLBACK } from './layout.js';
import { createDome } from './dome.js';

let BATTERY_CAPS = BATTERY_CAPACITY_FALLBACK;
try {
  const balance = await import('../data/balance.js');
  const lv = balance && balance.MODULES && balance.MODULES.battery && balance.MODULES.battery.levels;
  if (Array.isArray(lv) && lv.length) BATTERY_CAPS = lv.map((l) => l.capacity);
} catch (e) { /* balance.js not available yet: use the fallback table */ }

const DEG = Math.PI / 180;
const CLICK_PX = 6;
const SITE_GLOW = { ice: 0x7fe8ff, regolith: 0xff9a3c, minerals: 0xc58bff };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// screen extent (world units) of the build area (b = cell bounds) plus ~1 cell margin, at the default view angle (az 45, polar 55)
const gridW = (b) => (b.gx1 - b.gx0 + b.gz1 - b.gz0 + 2) * CELL * 0.707 + 14.5;
const gridH = (b) => (b.gx1 - b.gx0 + b.gz1 - b.gz0 + 2) * CELL * 0.405 + 14.5;
// The camera sits far from its target so the wide far ground never crosses the near plane; fog distances
// from sky.js were tuned for a distance of 180 and are shifted by the difference.
const DIST = 700;
const FOG_SHIFT = DIST - 180;

function batteryFraction(state) {
  let cap = 0;
  for (const s of state.slots || []) {
    const m = s.module;
    if (m && m.type === 'battery' && m.status !== 'building') cap += BATTERY_CAPS[Math.min(BATTERY_CAPS.length, m.level) - 1] || 0;
  }
  const e = (state.resources && state.resources.energy) || 0;
  return cap > 0 ? e / cap : 0;
}

export function createView(container, { onSlotClick, onSiteClick, onSlotContext } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    throw new Error('WebGL unavailable: ' + (e && e.message ? e.message : e));
  }
  if (!renderer.getContext()) throw new Error('WebGL unavailable');

  let pr = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(pr);
  renderer.autoClear = false;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  canvas.style.transition = 'filter 0.8s';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe0b890, 200 + FOG_SHIFT, 420 + FOG_SHIFT);
  const bg = createBackground();

  // camera: orthographic isometric
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DIST + 900);
  const target = new THREE.Vector3(0, 0, 0);
  const polar = 55 * DEG, az = 45 * DEG;
  let bounds = { ...DEFAULT_BOUNDS };
  function homeCamera() {
    const R = boundsRect(bounds);
    target.set(R.cx, 0, R.cz);
    camera.position.set(target.x + DIST * Math.sin(polar) * Math.sin(az), target.y + DIST * Math.cos(polar), target.z + DIST * Math.sin(polar) * Math.cos(az));
    camera.zoom = 1;
    camera.lookAt(target);
  }
  homeCamera();

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = 35 * DEG;
  controls.maxPolarAngle = 65 * DEG;
  controls.minZoom = 0.17;   // ~3x farther out than before: the far ground and fog fill the view
  controls.maxZoom = 5;
  controls.screenSpacePanning = false;
  controls.zoomSpeed = 1.2;
  controls.rotateSpeed = 0.7;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.update();

  // lights
  const hemi = new THREE.HemisphereLight(0xcbdfe7, 0x80513e, 1.6);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffecd8, 2.15);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80; sc.near = 1; sc.far = 360;
  sunLight.shadow.bias = -0.0006;
  sunLight.shadow.normalBias = 0.04;
  sunLight.shadow.radius = 2;
  scene.add(sunLight, sunLight.target);
  const fill = new THREE.DirectionalLight(0x9bbdd8, 0.22);
  fill.position.set(-60, 90, 40);
  scene.add(fill);

  // static world
  const staticMat = makeVoxMaterial();
  let gridN = 6;   // core 6x6 block (the dome covers it)
  let boundsSig = '';
  let terrain = buildTerrain(bounds);
  const staticMesh = new THREE.Mesh(terrain.geometry, staticMat);
  staticMesh.receiveShadow = true;
  staticMesh.castShadow = true;
  scene.add(staticMesh);
  const dome = createDome();
  dome.setGrid(gridN);
  scene.add(dome.object);
  let domeSig = '';
  let domeExtra = 0;   // extra screen height (world units) reserved for the dome while it exists

  const roverGeo = buildBoxes(roverBoxes()).opaque;
  const ROVER_HOME = { x: GARAGE.x, z: GARAGE.z + 6.2 };
  const rovers = [new THREE.Mesh(roverGeo, staticMat), new THREE.Mesh(roverGeo, staticMat)];
  for (const r of rovers) { r.castShadow = true; scene.add(r); }
  rovers[0].position.set(ROVER_HOME.x, 0.3, ROVER_HOME.z);
  rovers[1].visible = false;
  const expLast = [0.5, 0.5];   // last outbound fraction per expedition index (start point when recalled)
  const routes = new Map();     // siteId -> { x, z, ex, ez, yaw }
  for (const s of terrain.sites) {
    const dx = s.x - ROVER_HOME.x, dz = s.z - ROVER_HOME.z, d = Math.hypot(dx, dz) || 1;
    const stop = Math.max(0, d - 5.6);
    routes.set(s.id, { x: s.x, z: s.z, ex: ROVER_HOME.x + dx / d * stop, ez: ROVER_HOME.z + dz / d * stop, yaw: Math.atan2(dx, dz) });
  }

  // ship lander (dynamic): descends, waits on the pad, takes off
  const landerGeo = buildBoxes(landerBoxes()).opaque;
  const lander = new THREE.Mesh(landerGeo, staticMat);
  lander.castShadow = true; lander.visible = false;
  lander.position.set(LANDING_PAD.x, 0, LANDING_PAD.z);
  scene.add(lander);
  const plumeGeo = new THREE.BoxGeometry(1.5, 5, 1.5); plumeGeo.translate(0, -2.5, 0);
  const plumeMat = new THREE.MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: 0.85, toneMapped: false, fog: false, depthWrite: false });
  const plume = new THREE.Mesh(plumeGeo, plumeMat);
  plume.visible = false; scene.add(plume);
  const PUFF_N = 28;
  const puffPos = new Float32Array(PUFF_N * 3), puffA = new Float32Array(PUFF_N), puffR = new Float32Array(PUFF_N), puffH = new Float32Array(PUFF_N);
  for (let i = 0; i < PUFF_N; i++) { puffA[i] = (i / PUFF_N) * Math.PI * 2 + (i % 3) * 0.2; puffR[i] = 0.55 + ((i * 37) % 10) / 22; puffH[i] = 0.4 + ((i * 53) % 10) / 16; }
  const puffGeo = new THREE.BufferGeometry();
  puffGeo.setAttribute('position', new THREE.BufferAttribute(puffPos, 3));
  const puffMat = new THREE.PointsMaterial({ color: 0xd9b48a, size: 7, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const puff = new THREE.Points(puffGeo, puffMat);
  puff.frustumCulled = false; puff.visible = false; puff.renderOrder = 5;
  scene.add(puff);
  const L = { phase: 'none', pk: 0, age: 0, seen: false, puffT: 99 };

  const marksMat = makeVoxMaterial();
  let marks = null;

  // shared materials for modules
  const shared = {
    scaffoldMat: makeVoxMaterial(),
    ghostMat: new THREE.MeshBasicMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.16, depthWrite: false }),
    sweepGeo: (() => { const g = new THREE.BoxGeometry(0.5, 0.35, 1); return g; })(),
    sweepMat: new THREE.MeshBasicMaterial({ color: 0x9ff6ff, toneMapped: false }),
    repairGeo: new THREE.BoxGeometry(0.6, 0.6, 0.6),
    repairMat: new THREE.MeshBasicMaterial({ color: 0xbff4ff, toneMapped: false, fog: false }),
  };
  const cache = new ModuleCache();
  const views = new Map();     // slotId -> ModuleView
  const slotInfo = new Map();  // slotId -> { x, z, gx, gz }

  const beacons = createBeacons();
  const glows = createGlows();
  const dust = createDust();
  const outlines = createOutlines();
  const colonists = createColonists();
  scene.add(beacons.object, glows.object, dust.object, outlines.hover, outlines.sel, colonists.object);

  // picking
  const pickRoot = new THREE.Group();
  const pickMat = new THREE.MeshBasicMaterial();
  const pickBox = new THREE.BoxGeometry(1, 1, 1);
  pickBox.translate(0, 0.5, 0);
  const slotPicks = new Map();
  for (const s of terrain.sites) {
    const m = new THREE.Mesh(pickBox, pickMat);
    m.position.set(s.x, 0, s.z);
    m.scale.set(8, 6, 8);
    m.userData.siteId = s.id;
    pickRoot.add(m);
  }
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const domeInfo = { exists: false, building: false, progress: 0, amber: false };
  let state = null;
  let selected = null;
  let hovered = null;
  let lastSig = new Map();
  let colSig = '';
  let marksSig = '';
  let disposed = false;
  const sky = {};

  function ensureSlot(slot) {
    if (!slotInfo.has(slot.id)) {
      const c = cellCenter(slot.gx, slot.gz);
      slotInfo.set(slot.id, { ...c, gx: slot.gx, gz: slot.gz });
      const v = new ModuleView(slot, cache, shared);
      views.set(slot.id, v);
      scene.add(v.group);
      const pm = new THREE.Mesh(pickBox, pickMat);
      pm.position.set(c.x, 0, c.z);
      pm.scale.set(PAD + 0.6, 1.2, PAD + 0.6);
      pm.userData.slotId = slot.id;
      pickRoot.add(pm);
      slotPicks.set(slot.id, pm);
    }
  }

  boundsSig = [bounds.gx0, bounds.gx1, bounds.gz0, bounds.gz1].join(',');
  function applyGrid(n, b) {
    const sig = [b.gx0, b.gx1, b.gz0, b.gz1].join(',');
    if (n === gridN && sig === boundsSig) return;
    const rebuild = sig !== boundsSig;
    gridN = n; boundsSig = sig; bounds = { ...b };
    setGridSize(n);
    if (rebuild) {
      const old = terrain.geometry;
      terrain = buildTerrain(bounds);
      staticMesh.geometry = terrain.geometry;
      old.dispose();
    }
    dome.setGrid(n);
    for (const v of views.values()) { scene.remove(v.group); v.dispose(); }
    views.clear(); slotInfo.clear(); lastSig.clear();
    for (const pm of slotPicks.values()) pickRoot.remove(pm);
    slotPicks.clear();
    marksSig = '!'; colSig = '';
    hovered = null; outlines.setHover(null);
    frame2D();
  }

  function sync(st) {
    applyGrid(gridSizeOf(st.slots), gridBoundsOf(st.slots));
    const empties = [];
    let domeMod = null, shield = false;
    for (const sl of st.slots || []) {
      const mm = sl.module;
      if (mm && mm.type === 'dome') domeMod = mm;
      if (mm && mm.type === 'radShield' && mm.status !== 'building') shield = true;
    }
    const dsig = domeMod ? 'd' + (shield ? 'a' : '') : '';
    if (dsig !== domeSig) { domeSig = dsig; domeExtra = domeMod ? 22 : 0; if (W) frame2D(); }
    domeInfo.exists = !!domeMod; domeInfo.building = !!domeMod && domeMod.status === 'building';
    domeInfo.progress = domeMod ? domeMod.progress || 0 : 0; domeInfo.amber = shield;
    for (const slot of st.slots || []) {
      ensureSlot(slot);
      const m = slot.module;
      const sig = m ? `${m.type}|${m.level}|${m.status}` : '';
      const v = views.get(slot.id);
      if (sig !== lastSig.get(slot.id)) {
        v.set(m || null);
        lastSig.set(slot.id, sig);
        const pm = slotPicks.get(slot.id);
        pm.scale.y = m ? Math.max(1.2, v.height + PAD_H) : 1.2;
      } else if (m) {
        v.mod = m;   // keep latest object for per-frame values (dust, growth, progress...)
      }
      if (!m) empties.push(slotInfo.get(slot.id));
    }
    const ms = empties.map((e) => e.x + ',' + e.z).join(';');
    if (ms !== marksSig) {
      marksSig = ms;
      if (marks) { scene.remove(marks); marks.geometry.dispose(); marks = null; }
      const g = buildEmptyMarks(empties);
      if (g) { marks = new THREE.Mesh(g, marksMat); marks.receiveShadow = true; scene.add(marks); }
    }
    const cs = (st.colonists || []).map((c) => `${c.id}:${c.location}:${c.assignedTo}:${c.status}`).join('|') + '#' +
      (st.slots || []).map((s) => (s.module ? s.module.type[0] + s.module.status[0] : '-')).join('') + (st.sheltering ? '!' : '');
    if (cs !== colSig) { colSig = cs; colonists.layout(st); }
    pickRoot.updateMatrixWorld(true);
  }

  // ---------- input ----------
  let down = null;
  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickRoot.children, false);
    return hits.length ? hits[0].object.userData : null;
  }
  let pressTimer = 0, ctxMoved = false;
  function clearPress() { if (pressTimer) { clearTimeout(pressTimer); pressTimer = 0; } }
  function onDown(ev) {
    down = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, moved: false, fired: false };
    ctxMoved = false;
    clearPress();
    if (onSlotContext && ev.pointerType === 'touch') {
      const cx = ev.clientX, cy = ev.clientY, d = down;
      pressTimer = setTimeout(() => {
        pressTimer = 0;
        if (disposed || d !== down || d.moved) return;
        const h = pick({ clientX: cx, clientY: cy });
        if (h && h.slotId) { d.fired = true; onSlotContext(h.slotId); }
      }, 600);
    }
  }
  function onMove(ev) {
    if (down && ev.pointerId === down.id && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > CLICK_PX) { down.moved = true; ctxMoved = true; clearPress(); }
    if (ev.pointerType === 'mouse' && !down) {
      const h = pick(ev);
      const id = h && h.slotId ? h.slotId : null;
      if (id !== hovered) {
        hovered = id;
        outlines.setHover(id ? slotInfo.get(id) : null);
      }
      canvas.style.cursor = h ? 'pointer' : '';
    }
  }
  function onUp(ev) {
    const d = down;
    down = null;
    clearPress();
    if (!d || d.moved || d.fired || ev.pointerId !== d.id) return;
    if (ev.button !== undefined && ev.button > 0) return;
    const h = pick(ev);
    if (!h) return;
    if (h.slotId && onSlotClick) onSlotClick(h.slotId);
    else if (h.siteId && onSiteClick) onSiteClick(h.siteId);
  }
  function onLeave() { hovered = null; outlines.setHover(null); canvas.style.cursor = ''; }
  function onCancel() { down = null; clearPress(); }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  const onContext = (e) => {
    e.preventDefault();
    if (!onSlotContext || ctxMoved || e.pointerType === 'touch') return;
    const h = pick(e);
    if (h && h.slotId) onSlotContext(h.slotId);
  };
  canvas.addEventListener('contextmenu', onContext);

  // ---------- size ----------
  let W = 0, H = 0;
  let insets = { top: 0, right: 0, bottom: 0, left: 0 };
  function frame2D() {
    // centre the 4x4 grid in the free rectangle (not covered by HUD panels) and fit it to ~85% of it
    const fw = Math.max(120, W - insets.left - insets.right), fh = Math.max(120, H - insets.top - insets.bottom);
    const S = Math.min(fw * 0.85 / gridW(bounds), fh * 0.85 / (gridH(bounds) + domeExtra * 0.5));   // px per world unit at zoom 1
    const cx = insets.left + fw / 2, cy = insets.top + fh / 2 + 2 * S;   // modules rise above the ground: nudge the ground point down
    camera.left = -cx / S; camera.right = (W - cx) / S; camera.top = cy / S; camera.bottom = -(H - cy) / S;
    camera.updateProjectionMatrix();
  }
  function setInsets(i) {
    const n = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);
    insets = { top: n(i && i.top), right: n(i && i.right), bottom: n(i && i.bottom), left: n(i && i.left) };
    if (W) frame2D();
  }
  function resize() {
    const w = Math.max(1, container.clientWidth | 0), h = Math.max(1, container.clientHeight | 0);
    const npr = Math.min(2, window.devicePixelRatio || 1);
    if (npr !== pr) { pr = npr; renderer.setPixelRatio(pr); }
    W = w; H = h;
    renderer.setSize(w, h, false);
    frame2D();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(container);
  window.addEventListener('resize', resize);
  resize();

  // ---------- loop ----------
  let lastNow = performance.now();
  let time = 0;
  const lastInfo = { calls: 0, triangles: 0 };
  const _t = new THREE.Vector3();
  const animCtx = { time: 0, nightK: 0, batteryFrac: 0, sheltering: false, beacons, glows };

  // ---------- expeditions ----------
  function groundY(x, z) {
    const h = Math.max(terrain.heightAt(x, z), terrain.heightAt(x + 1.6, z), terrain.heightAt(x - 1.6, z), terrain.heightAt(x, z + 2.4), terrain.heightAt(x, z - 2.4));
    return h + 0.3;
  }
  function animateExpeditions() {
    const ex = state.expeditions;
    const n = Array.isArray(ex) ? Math.min(2, ex.length) : 0;
    rovers[0].visible = n === 0 ? true : false;
    rovers[1].visible = false;
    if (n === 0) { rovers[0].position.set(ROVER_HOME.x, 0.3, ROVER_HOME.z); rovers[0].rotation.y = 0; return; }
    const t = state.t || 0;
    for (let i = 0; i < n; i++) {
      const e = ex[i], r = rovers[i], route = e && routes.get(e.site);
      if (!route) continue;
      const dur = Math.max(1e-6, (e.endT - e.startT) || 1e-6);
      let f, back;
      if (e.recalled) {
        // recall sets endT = recallT + 0.5 * elapsed  =>  recallT = startT + dur / 1.5
        const rt = e.startT + dur / 1.5;
        f = expLast[i] * (1 - clamp01((t - rt) / Math.max(1e-6, e.endT - rt)));
        back = true;
      } else {
        const p = clamp01((t - e.startT) / dur);
        back = p >= 0.5;
        f = back ? (1 - p) * 2 : p * 2;
        expLast[i] = f;
      }
      r.visible = true;
      const x = ROVER_HOME.x + (route.ex - ROVER_HOME.x) * f, z = ROVER_HOME.z + (route.ez - ROVER_HOME.z) * f;
      r.position.set(x, groundY(x, z) + Math.abs(Math.sin(time * 9 + i)) * 0.05, z);
      r.rotation.y = route.yaw + (back ? Math.PI : 0);
      // site marker pulses while an expedition targets it
      const pu = 0.5 + 0.5 * Math.sin(time * 4.5);
      beacons.add(route.x, 5.2, route.z, SITE_GLOW[e.site] || 0xffffff, pu > 0.4);
      glows.add(route.x, route.z, 6.5, SITE_GLOW[e.site] || 0xffffff, 0.3 + 0.4 * pu, 0.35);
    }
  }

  // ---------- ship ----------
  function shipWindow() {
    const sh = state && state.ship;
    if (!sh || !sh.manifest || typeof sh.nextArrivalT !== 'number') return 0;
    const t = state.t || 0, T = sh.nextArrivalT;
    return t >= T - 0.15 && t < T ? (t - (T - 0.15)) / 0.15 : 0;
  }
  function shipVisible() {
    const sh = state && state.ship;
    if (L.phase !== 'none' || !sh || !sh.manifest) return false;
    if (typeof sh.nextArrivalT === 'number' && (state.t || 0) >= sh.nextArrivalT - 0.15) return false;
    return true;
  }
  function stepLander(dt) {
    const winK = shipWindow();
    const awaiting = !!(state.ship && state.ship.awaitingDecision);
    L.puffT += dt;
    if (L.phase === 'none') {
      if (winK > 0) { L.phase = 'descend'; L.pk = winK; }
      else if (awaiting) { L.phase = 'landed'; L.pk = 1; L.age = 0; L.seen = true; }
    }
    if (L.phase === 'descend') {
      L.pk = winK > 0 ? Math.max(L.pk, winK) : L.pk + dt / 3.2;
      if (L.pk >= 1) { L.pk = 1; L.phase = 'landed'; L.age = 0; L.seen = awaiting; L.puffT = 0; }
    } else if (L.phase === 'landed') {
      L.age += dt;
      if (awaiting) L.seen = true;
      else if (L.seen || L.age > 10) { L.phase = 'ascend'; L.pk = 0; L.puffT = 0; }
    } else if (L.phase === 'ascend') {
      L.pk += dt / 4;
      if (L.pk >= 1) { L.pk = 0; L.phase = 'none'; }
    }
  }
  function animateLander(dt) {
    const ph = L.phase;
    lander.visible = ph !== 'none';
    let moving = false, y = 0;
    if (ph === 'descend') { const k = 1 - L.pk; y = 75 * k * k; moving = L.pk < 0.985; }
    else if (ph === 'ascend') { y = 90 * L.pk * L.pk; moving = true; }
    lander.position.y = y;
    plume.visible = moving;
    if (moving) {
      plume.position.set(LANDING_PAD.x, y + 1.7, LANDING_PAD.z);
      const fl = 0.8 + 0.3 * Math.sin(time * 40);
      plume.scale.set(fl, (ph === 'descend' ? 0.5 + 0.7 * (1 - L.pk) : 1.2) * fl, fl);
    }
    // dust puff: while the engine is near the ground, then fading after touchdown / lift-off
    let q = -1, a = 0;
    if (ph === 'descend' && L.pk > 0.9) { q = 0.18; a = 0.55; }
    else if (L.puffT < 1.8 && (ph === 'landed' || ph === 'ascend')) { q = L.puffT / 1.8; a = 0.8 * (1 - q); }
    puff.visible = q >= 0;
    if (q >= 0) {
      puffMat.opacity = a;
      for (let i = 0; i < PUFF_N; i++) {
        const r = 1.8 + q * 10 * puffR[i];
        puffPos[i * 3] = LANDING_PAD.x + Math.cos(puffA[i]) * r;
        puffPos[i * 3 + 1] = 0.7 + q * 2.4 * puffH[i];
        puffPos[i * 3 + 2] = LANDING_PAD.z + Math.sin(puffA[i]) * r;
      }
      puffGeo.attributes.position.needsUpdate = true;
    }
    if (moving || q >= 0) glows.add(LANDING_PAD.x, LANDING_PAD.z, 8, 0xffa050, moving ? 0.5 : 0.25 * (1 - Math.max(0, q)), 0.5);
  }

  function frame() {
    if (disposed) return;
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    time += dt;
    controls.update();
    // clamp panning to the terrain
    _t.copy(controls.target);
    _t.x = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, _t.x));
    _t.z = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, _t.z));
    _t.y = 0;
    if (!_t.equals(controls.target)) {
      const d = _t.clone().sub(controls.target);
      controls.target.add(d);
      camera.position.add(d);
    }
    if (W < 2 || H < 2) return;

    if (state) {
      stepLander(dt);
      skyParams(state, sky, time);
      sunLight.color.copy(sky.sunColor);
      sunLight.intensity = sky.sunI;
      sunLight.position.copy(controls.target).addScaledVector(sky.sunDir, 150);
      sunLight.target.position.copy(controls.target);
      sunLight.shadow.intensity = Math.min(1, 0.35 + 0.65 * (1 - sky.dustK));
      renderer.shadowMap.autoUpdate = sky.sunI > 0.03;
      hemi.color.copy(sky.hemiSky); hemi.groundColor.copy(sky.hemiGround); hemi.intensity = sky.hemiI;
      fill.intensity = sky.fillI;
      scene.fog.color.copy(sky.fogColor);
      scene.fog.near = sky.fogNear + FOG_SHIFT; scene.fog.far = sky.fogFar + FOG_SHIFT;
      sky.shipPoint = shipVisible();
      if (sky.speActive) {
        const me = camera.matrixWorld.elements, sd = sky.sunDir;
        const sx = sd.x * me[0] + sd.y * me[1] + sd.z * me[2], sy = sd.x * me[4] + sd.y * me[5] + sd.z * me[6];
        const sl = Math.hypot(sx, sy);
        sky.speDirX = sl > 0.08 ? -sx / sl : 0.35; sky.speDirY = sl > 0.08 ? -sy / sl : -0.94;
      }
      bg.apply(sky, time, pr);
      dust.update(time, sky.particleAlpha, pr, camera.zoom, controls.target);
      dome.update(domeInfo, time, sky.nightK);

      animCtx.time = time;
      animCtx.nightK = sky.nightK;
      animCtx.batteryFrac = batteryFraction(state);
      animCtx.sheltering = !!state.sheltering;
      beacons.begin(); glows.begin();
      for (const v of views.values()) v.animate(animCtx);
      animateExpeditions();
      animateLander(dt);
      beacons.end(); glows.end();
      colonists.animate(time);
    }
    outlines.animate(time);

    renderer.info.reset();
    renderer.clear();
    renderer.render(bg.scene, bg.camera);
    renderer.clearDepth();
    renderer.render(scene, camera);
    lastInfo.calls = renderer.info.render.calls;
    lastInfo.triangles = renderer.info.render.triangles;
  }
  renderer.setAnimationLoop(frame);

  // ---------- public ----------
  function update(st, events) {
    if (!st || disposed) return;
    state = st;
    sync(st);
    if (events && events.length) {
      for (const ev of events) {
        if (ev && ev.type === 'ship.arrived' && L.phase === 'none') { L.phase = 'descend'; L.pk = 0.25; }
        if (ev && ev.type === 'build.done' && views.has(ev.slotId)) views.get(ev.slotId).pop(time);
      }
    }
    canvas.style.filter = st.over ? 'saturate(0.35) brightness(0.8)' : '';
    if (selected && !slotInfo.has(selected)) outlines.setSelected(null);
    else if (selected) outlines.setSelected(slotInfo.get(selected));
  }

  function resetCamera() {
    homeCamera();
    controls.target.copy(target);
    frame2D();
    controls.update();
  }

  function setSelected(id) {
    selected = id || null;
    outlines.setSelected(selected && slotInfo.has(selected) ? slotInfo.get(selected) : null);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('contextmenu', onContext);
    window.removeEventListener('resize', resize);
    if (ro) ro.disconnect();
    clearPress();
    controls.dispose();
    for (const v of views.values()) v.dispose();
    views.clear();
    cache.dispose();
    terrain.geometry.dispose(); dome.dispose(); staticMat.dispose(); roverGeo.dispose();
    landerGeo.dispose(); plumeGeo.dispose(); plumeMat.dispose(); puffGeo.dispose(); puffMat.dispose();
    if (marks) marks.geometry.dispose();
    marksMat.dispose();
    shared.scaffoldMat.dispose(); shared.ghostMat.dispose(); shared.sweepGeo.dispose(); shared.sweepMat.dispose(); shared.repairGeo.dispose(); shared.repairMat.dispose();
    beacons.dispose(); glows.dispose(); dust.dispose(); outlines.dispose(); colonists.dispose(); bg.dispose();
    pickBox.dispose(); pickMat.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  return {
    update, setSelected, setInsets, resetCamera, resize, dispose,
    // debug only (dev page): last frame draw calls / triangles
    _info: () => ({ ...lastInfo }),
  };
}
