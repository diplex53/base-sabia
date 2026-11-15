// Per-slot module views. Geometry is cached per (type, level) and shared between slots;
// each slot owns its materials so state is shown through uniforms (no rebuild per frame).
import * as THREE from 'three';
import { getModel, scaffoldBoxes } from './models.js';
import { buildBoxes, makeVoxMaterial } from './voxels.js';
import { PAD_H, cellCenter } from './layout.js';
import { GLOW } from './palette.js';

const DUST_MAX = 0.8;
const GAUGE_GREEN = new THREE.Color(0x4dff7a), GAUGE_AMBER = new THREE.Color(0xffb02e), GAUGE_RED = new THREE.Color(0xff3b30);

export class ModuleCache {
  constructor() { this.geo = new Map(); this.scaf = new Map(); }
  model(type, level) {
    const key = type + ':' + level;
    let g = this.geo.get(key);
    if (!g) {
      const m = getModel(type, level);
      if (!m) return null;
      const built = buildBoxes(m.boxes, -4, 0, -4);
      g = { ...built, meta: m.meta };
      this.geo.set(key, g);
    }
    return g;
  }
  scaffold(height) {
    const key = Math.round(height * 2) / 2;
    let g = this.scaf.get(key);
    if (!g) { g = buildBoxes(scaffoldBoxes(key)).opaque; this.scaf.set(key, g); }
    return g;
  }
  dispose() {
    for (const g of this.geo.values()) { g.opaque.dispose(); if (g.glass) g.glass.dispose(); }
    for (const g of this.scaf.values()) g.dispose();
    this.geo.clear(); this.scaf.clear();
  }
}

export class ModuleView {
  constructor(slot, cache, shared) {
    this.slotId = slot.id;
    this.cache = cache;
    this.shared = shared;            // { scaffoldMat, ghostMat, sweepGeo, sweepMat, repairGeo, repairMat }
    const c = cellCenter(slot.gx, slot.gz);
    this.cx = c.x; this.cz = c.z;
    this.group = new THREE.Group();
    this.group.position.set(c.x, PAD_H, c.z);
    this.type = null; this.level = 0;
    this.mod = null;
    this.body = null; this.glass = null; this.scaffold = null; this.ghost = null; this.sweep = null; this.repair = null;
    this.mat = null; this.glassMat = null;
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    this.height = 1;
    this.popT = -10;
  }

  set(mod) {
    this.mod = mod;
    if (!mod) { this.clear(); return; }
    if (mod.type !== this.type || mod.level !== this.level) this.rebuild(mod.type, mod.level);
    this.applyStatus();
  }

  rebuild(type, level) {
    this.clearMeshes();
    const g = this.cache.model(type, level);
    if (!g) { this.type = null; return; }
    this.type = type; this.level = level;
    this.meta = g.meta;
    this.height = g.meta.height;
    if (!this.mat) this.mat = makeVoxMaterial();
    this.mat.clipShadows = true;
    this.body = new THREE.Mesh(g.opaque, this.mat);
    this.body.castShadow = true; this.body.receiveShadow = true;
    this.body.userData.slotId = this.slotId;
    this.group.add(this.body);
    if (g.glass) {
      this.glassMat = this.glassMat || new THREE.MeshLambertMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.32, depthWrite: false, emissive: 0x000000 });
      this.glass = new THREE.Mesh(g.glass, this.glassMat);
      this.glass.renderOrder = 4;
      this.group.add(this.glass);
    }
    if (this.meta.sweep) {
      this.sweep = new THREE.Mesh(this.shared.sweepGeo, this.shared.sweepMat);
      this.sweep.visible = false;
      this.group.add(this.sweep);
    }
    this.statusKey = null;
  }

  applyStatus() {
    const m = this.mod;
    const building = m.status === 'building';
    const upgrading = m.status === 'upgrading';
    const repairing = m.status === 'repairing';
    const key = (building ? 'b' : upgrading ? 'u' : repairing ? 'r' : 'n');
    if (key === this.statusKey) return;
    this.statusKey = key;
    // clipping while building
    this.mat.clippingPlanes = building ? [this.clipPlane] : null;
    this.mat.needsUpdate = true;
    // scaffold
    if (this.scaffold) { this.group.remove(this.scaffold); this.scaffold = null; }
    if (building || upgrading || repairing) {
      let h = this.height;
      if (upgrading) {
        const next = this.cache.model(m.type, Math.min(3, m.level + 1));
        if (next) h = Math.max(h, next.meta.height);
      }
      this.scaffold = new THREE.Mesh(this.cache.scaffold(h), this.shared.scaffoldMat);
      this.scaffold.castShadow = true;
      this.group.add(this.scaffold);
    }
    if (this.repair) { this.group.remove(this.repair); this.repair = null; }
    if (repairing) {
      this.repair = new THREE.Mesh(this.shared.repairGeo, this.shared.repairMat);
      this.group.add(this.repair);
    }
    if (this.ghost) { this.group.remove(this.ghost); this.ghost = null; }
    if (building && this.body) {
      this.ghost = new THREE.Mesh(this.body.geometry, this.shared.ghostMat);
      this.ghost.renderOrder = 4;
      this.group.add(this.ghost);
    }
  }

  pop(time) { this.popT = time; }

  // Per-frame animation. ctx: { time, nightK, batteryFrac, sheltering, beacons, glows }
  animate(ctx) {
    const m = this.mod;
    if (!m || !this.body) return;
    const u = this.mat.userData.u;
    const time = ctx.time;
    const st = m.status;
    const building = st === 'building';
    const broken = st === 'broken';
    const repairing = st === 'repairing';
    const enabled = m.enabled !== false;
    const powered = m.powered !== false;
    const active = !building && !broken && !repairing && enabled && powered;

    let sat = 1, bright = 1, emit = active ? 1 : 0;
    if (building) { sat = 0.75; bright = 1.0; }
    else if (broken) { sat = 0.5; bright = 0.55; }
    else if (repairing) { sat = 0.65; bright = 0.78; }
    else if (!enabled) { sat = 0.35; bright = 0.82; }
    else if (!powered) { sat = 0.8; bright = 0.88; }
    u.uSat.value = sat; u.uBright.value = bright;

    const ec = u.uEmitColor.value;
    ec.setRGB(emit, emit, emit);
    if (active) {
      if (this.type === 'moxie') ec.multiplyScalar(0.55 + 0.45 * (0.5 + 0.5 * Math.sin(time * 3)));
      else if (this.type === 'reactor') ec.multiplyScalar(0.75 + 0.25 * Math.sin(time * 1.4));
    }

    // battery gauge
    if (this.type === 'battery') {
      const f = Math.max(0, Math.min(1, ctx.batteryFrac));
      u.uScaleY.value = Math.max(0.04, f);
      if (!building && !broken && !repairing && enabled) {
        const g = f < 0.2 ? GAUGE_RED : f < 0.5 ? GAUGE_AMBER : GAUGE_GREEN;
        ec.copy(g);
        if (f < 0.2) ec.multiplyScalar(0.6 + 0.4 * (Math.sin(time * 6) > 0 ? 1 : 0.3));
      }
    }
    // greenhouse growth + glass glow
    if (this.type === 'greenhouse') {
      const gr = Math.max(0, Math.min(1, m.growth || 0));
      u.uScaleY.value = Math.max(0.08, gr);
      u.uGrowth.value = gr;
      if (this.glassMat) {
        this.glassMat.emissive.setHex(0xff40d0).multiplyScalar(active ? 0.22 + 0.25 * ctx.nightK : 0);
        this.glassMat.opacity = active ? 0.36 : 0.3;
      }
    }
    // solar dust and cleaning sweep
    if (this.type === 'solar') {
      const d = Math.max(0, Math.min(1, (m.dust || 0) / DUST_MAX));
      u.uDust.value = d > 0 ? Math.min(0.92, 0.12 + 0.85 * Math.pow(d, 0.7)) : 0;
      const sw = this.meta.sweep;
      if (st === 'cleaning' && sw && this.sweep) {
        const pr = Math.max(0, Math.min(1, m.progress || 0));
        const front = sw.x0 + (sw.x1 - sw.x0) * pr;
        const x = Math.max(sw.x0, Math.min(sw.x1, front + Math.sin(time * 5) * 0.5));
        u.uSweepX.value = front;
        this.sweep.visible = true;
        this.sweep.position.set(x, sw.y, (sw.z0 + sw.z1) / 2);
        this.sweep.scale.set(1, 1, sw.z1 - sw.z0 + 0.6);
      } else {
        u.uSweepX.value = -1000;
        if (this.sweep) this.sweep.visible = false;
      }
    }
    // repair: a small spark circling the scaffold
    if (repairing && this.repair) {
      const a = time * 1.7;
      const k = 0.5 + 0.5 * Math.sin(time * 2.9);
      this.repair.position.set(Math.cos(a) * 4.2, 0.8 + k * Math.max(1.5, this.height), Math.sin(a) * 4.2);
      const sc = 0.7 + 0.5 * (Math.sin(time * 23) > 0 ? 1 : 0);
      this.repair.scale.set(sc, sc, sc);
    }
    // construction rise
    if (building) {
      const pr = Math.max(0, Math.min(1, m.progress || 0));
      this.clipPlane.constant = PAD_H + 0.02 + pr * this.height;
      this.body.visible = pr > 0.005;
    } else {
      this.body.visible = true;
    }

    // beacons
    const topY = PAD_H + this.height + 0.25;
    if (broken) {
      ctx.beacons.add(this.cx, topY, this.cz, 0xffa020, Math.sin(time * Math.PI * 0.9) > 0);
    } else if (!building && enabled && !powered) {
      ctx.beacons.add(this.cx, topY, this.cz, 0xff2a1a, Math.sin(time * Math.PI * 2.2) > 0);
    }
    // shelter in use: small steady blue light
    if (this.type === 'shelter' && ctx.sheltering && !building) {
      ctx.beacons.add(this.cx + 1.6, topY, this.cz + 1.6, 0x4aa8ff, true);
      ctx.glows.add(this.cx, this.cz, 6.5, 0x3a90ff, 0.5 + 0.1 * Math.sin(time * 2));
    }
    // night ground glow
    const glow = GLOW[this.type];
    if (glow && active) ctx.glows.add(this.cx, this.cz, this.type === 'habitat' ? 9 : 7, glow, ctx.nightK * (this.type === 'moxie' ? 0.35 : 0.55));

    // build-done pop
    const dt = time - this.popT;
    if (dt >= 0 && dt < 0.6) {
      const k = 1 + 0.12 * Math.sin((dt / 0.6) * Math.PI);
      this.group.scale.set(k, k, k);
    } else if (this.group.scale.x !== 1) this.group.scale.set(1, 1, 1);
  }

  clearMeshes() {
    for (const o of [this.body, this.glass, this.scaffold, this.ghost, this.sweep, this.repair]) if (o) this.group.remove(o);
    this.body = this.glass = this.scaffold = this.ghost = this.sweep = this.repair = null;
    this.statusKey = null;
  }

  clear() {
    this.clearMeshes();
    this.type = null; this.level = 0; this.height = 1;
  }

  dispose() {
    this.clear();
    if (this.mat) this.mat.dispose();
    if (this.glassMat) this.glassMat.dispose();
  }
}
