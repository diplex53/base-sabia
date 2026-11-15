// Tiny voxel colonists: two InstancedMeshes (white suit + coloured stripe).
import * as THREE from 'three';
import { buildBoxes } from './voxels.js';
import { colonistBoxes, colonistStripeBoxes } from './models.js';
import { STRIPES } from './palette.js';
import { PAD_H, cellCenter, LANDING_PAD } from './layout.js';

const SCALE = 1.25;
// idle spots on the walkways around a cell centre (dx, dz, walk axis)
const IDLE = [[5, -3, 'z'], [5, 0.5, 'z'], [-5, -1.5, 'z'], [-2.5, 5, 'x'], [1.5, 5, 'x'], [5, 3.5, 'z'], [-5, 2.5, 'z'], [-1, -5, 'x'], [2.5, -5, 'x'], [-3.5, -5, 'x']];

function hashId(id) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function createColonists(max = 32) {
  const suitGeo = buildBoxes(colonistBoxes()).opaque;
  const stripeGeo = buildBoxes(colonistStripeBoxes()).opaque;
  const suitMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const suit = new THREE.InstancedMesh(suitGeo, suitMat, max);
  const stripe = new THREE.InstancedMesh(stripeGeo, stripeMat, max);
  for (const m of [suit, stripe]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0; m.castShadow = true; m.frustumCulled = false;
  }
  stripe.setColorAt(0, new THREE.Color());
  const group = new THREE.Group();
  group.add(suit, stripe);

  let list = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(SCALE, SCALE, SCALE);
  const up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();

  function layout(state) {
    list = [];
    const slots = state.slots || [];
    const byId = new Map(slots.map((sl) => [sl.id, sl]));
    const find = (type) => slots.find((sl) => sl.module && sl.module.type === type && sl.module.status !== 'building');
    const home = find('habitat');
    const shelter = find('shelter');
    const homeC = home ? cellCenter(home.gx, home.gz) : { x: LANDING_PAD.x, z: LANDING_PAD.z - 7 };
    const shelterC = shelter ? cellCenter(shelter.gx, shelter.gz) : homeC;
    const gather = !!state.sheltering;   // everyone on the base goes to the shelter (or the habitat if there is none)
    const perModule = new Map();
    let idleHome = 0, idleShelter = 0;
    for (const col of state.colonists || []) {
      if (col.location === 'expedition') continue;
      const stripeHex = col.status === 'retired' ? 0x8a8a8a : STRIPES[hashId(col.id) % STRIPES.length];
      let slot = null;
      if (!gather && (col.location === 'module' || (col.assignedTo && col.location !== 'shelter' && col.location !== 'habitat'))) {
        slot = byId.get(col.assignedTo);
      }
      if (slot && slot.module) {
        const k = perModule.get(slot.id) || 0;
        perModule.set(slot.id, k + 1);
        const cc = cellCenter(slot.gx, slot.gz);
        list.push({ x: cc.x + 4.25, z: cc.z + 2.2 - k * 1.3, rot: -Math.PI / 2, wander: 0, axis: 'z', ph: hashId(col.id) % 7, stripe: stripeHex });
        continue;
      }
      const atShelter = col.location === 'shelter' || (gather && col.location !== 'habitat');
      const centre = atShelter ? shelterC : homeC;
      const idx = atShelter ? idleShelter++ : idleHome++;
      const spot = IDLE[idx % IDLE.length];
      const ring = Math.floor(idx / IDLE.length);
      list.push({
        x: centre.x + spot[0] + (spot[2] === 'x' ? ring * 0.9 : 0),
        z: centre.z + spot[1] + (spot[2] === 'z' ? ring * 0.9 : 0),
        rot: 0, wander: 0.9, axis: spot[2], ph: hashId(col.id) % 11, stripe: stripeHex,
      });
    }
    const n = Math.min(max, list.length);
    for (let i = 0; i < n; i++) stripe.setColorAt(i, c.setHex(list[i].stripe));
    if (stripe.instanceColor) stripe.instanceColor.needsUpdate = true;
    suit.count = stripe.count = n;
  }

  function animate(time) {
    const n = suit.count;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      let x = a.x, z = a.z, rot = a.rot;
      if (a.wander) {
        const w = Math.sin(time * 0.35 + a.ph) * a.wander;
        const dir = Math.cos(time * 0.35 + a.ph) >= 0 ? 1 : -1;
        if (a.axis === 'z') { z += w; rot = dir > 0 ? 0 : Math.PI; } else { x += w; rot = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      }
      const bob = Math.abs(Math.sin(time * 4 + a.ph)) * (a.wander ? 0.08 : 0.02);
      p.set(x, PAD_H * 0 + 0.12 + bob + (a.wander ? 0 : PAD_H - 0.12), z);
      q.setFromAxisAngle(up, rot);
      m4.compose(p, q, s);
      suit.setMatrixAt(i, m4);
      stripe.setMatrixAt(i, m4);
    }
    suit.instanceMatrix.needsUpdate = true;
    stripe.instanceMatrix.needsUpdate = true;
    group.visible = n > 0;
  }

  return {
    object: group,
    layout, animate,
    dispose() { suitGeo.dispose(); stripeGeo.dispose(); suitMat.dispose(); stripeMat.dispose(); suit.dispose(); stripe.dispose(); },
  };
}
