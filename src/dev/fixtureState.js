// Fixture game states matching DESIGN.md Apêndice A.3, for developing the views without the core.
// makeFixture(variant): 'start' | 'full' | 'night' | 'storm' | 'alert' | 'levels1' | 'levels2' | 'levels3'
//   Phase 3: 'spe' | 'spe2' (warning / active) | 'sheltering' | 'expedition' | 'ship' | 'shipland' | 'repairing'

export const VARIANTS = ['start', 'full', 'night', 'storm', 'alert', 'levels1', 'levels2', 'levels3', 'spe', 'spe2', 'sheltering', 'expedition', 'ship', 'shipland', 'repairing'];

export function sunAt(t) {
  const f = ((t % 1) + 1) % 1;
  return Math.max(0, Math.sin((Math.PI * (f - 0.25)) / 0.5));
}

function commDelay(t) {
  return 4 + 16 * (1 - Math.cos((2 * Math.PI * t) / 26)) / 2;
}

function mod(type, level = 1, extra = {}) {
  return {
    type, level, enabled: true, powered: true, status: 'ok', progress: 0,
    dust: 0, growth: type === 'greenhouse' ? 1 : 0, unpoweredSols: 0, staff: [],
    ...extra,
  };
}

function colonist(i, extra = {}) {
  const names = ['Lia Moreira', 'Kenji Tanaka', 'Amara Okafor', 'Tomás Reyes', 'Priya Nair', 'Jonas Berg', 'Ana Lima', 'Omar Haddad'];
  return {
    id: 'c' + i, name: names[(i - 1) % names.length], profession: null, dose: 324 + i * 3,
    location: 'habitat', assignedTo: null, status: 'active', ...extra,
  };
}

function base(t) {
  const slots = [];
  for (let i = 0; i < 16; i++) slots.push({ id: 's' + (i + 1), gx: i % 4, gz: Math.floor(i / 4), module: null });
  return {
    version: 1, mode: 'colony', chapter: 0, seed: 12345, rng: 12345,
    t,
    resources: { energy: 30, o2: 30, water: 60, food: 80, regolith: 0, parts: 45, science: 0 },
    rates: { energyGen: 63, energyUse: 24, o2Prod: 0, o2Use: 3.36, waterProd: 0, waterUse: 1.29, foodProd: 0, foodUse: 2.54, science: 2 },
    env: { tau: 0.5, sun: sunAt(t), storm: null, spe: null, commDelayMin: commDelay(t) },
    unlocked: { modules: ['habitat', 'solar', 'battery', 'moxie', 'extractor', 'greenhouse', 'shelter'] },
    slots,
    colonists: [1, 2, 3, 4].map((i) => colonist(i)),
    expeditions: [],
    ship: { nextArrivalT: 26, manifest: null, awaitingDecision: false },
    tech: { unlocked: [] },
    sheltering: false,
    timers: { o2Out: 0, waterOut: 0, foodOut: 0, blackout: 0 },
    story: null,
    stats: { popPeak: 4, panelsSeen: [] },
    over: null,
  };
}

function put(state, slotId, m) {
  state.slots.find((s) => s.id === slotId).module = m;
}

function assign(state, colonistId, slotId) {
  const c = state.colonists.find((x) => x.id === colonistId);
  c.location = 'module';
  c.assignedTo = slotId;
  state.slots.find((s) => s.id === slotId).module.staff = [colonistId];
}

function start(t = 0.3) {
  const s = base(t);
  put(s, 's6', mod('habitat', 1));
  put(s, 's7', mod('solar', 1));
  put(s, 's10', mod('battery', 1));
  return s;
}

function full(t = 4.5) {
  const s = base(t);
  s.colonists = [1, 2, 3, 4, 5, 6, 7].map((i) => colonist(i));
  s.stats.popPeak = 7;
  s.tech.unlocked = ['fission'];
  s.unlocked.modules.push('reactor');
  put(s, 's1', mod('extractor', 1, { status: 'broken' }));
  put(s, 's2', mod('moxie', 2));
  put(s, 's3', mod('solar', 3, { dust: 0 }));
  put(s, 's4', mod('reactor', 3));
  put(s, 's5', mod('moxie', 1, { status: 'building', progress: 0.4 }));
  put(s, 's6', mod('habitat', 2, { status: 'upgrading', progress: 0.5 }));
  put(s, 's7', mod('solar', 2, { dust: 0.3 }));
  put(s, 's8', mod('solar', 1, { dust: 0.8, status: 'cleaning', progress: 0.35 }));
  put(s, 's9', mod('greenhouse', 1, { growth: 0.2 }));
  put(s, 's10', mod('battery', 1));
  put(s, 's11', mod('battery', 2));
  put(s, 's12', mod('extractor', 3, { enabled: false }));
  put(s, 's13', mod('greenhouse', 3, { growth: 1 }));
  put(s, 's14', mod('moxie', 3, { powered: false, unpoweredSols: 0.3 }));
  put(s, 's15', mod('shelter', 2));
  // s16 left empty
  assign(s, 'c1', 's2');
  assign(s, 'c2', 's6');
  assign(s, 'c3', 's9');
  assign(s, 'c4', 's13');
  s.resources = { energy: 162, o2: 64, water: 120, food: 140, regolith: 35, parts: 22, science: 41 };   // 90% of 180 kWh
  s.rates = { energyGen: 520, energyUse: 430, o2Prod: 7, o2Use: 5.9, waterProd: 6, waterUse: 2.5, foodProd: 3.1, foodUse: 4.4, science: 3.5 };
  return s;
}

export function makeFixture(variant = 'start') {
  switch (variant) {
    case 'start':
      return start(0.3);
    case 'full':
      return full(4.5);
    case 'night': {
      const s = full(3.9);
      s.resources.energy = 36;   // 20% of 180 kWh
      return s;
    }
    case 'storm': {
      const s = full(5.5);
      s.env.tau = 8;
      s.env.storm = { kind: 'global', endsAt: 99 };
      s.slots.find((x) => x.id === 's7').module.dust = 0.6;
      s.resources.energy = 70;
      return s;
    }
    case 'alert': {
      const s = start(2.8);
      put(s, 's11', mod('moxie', 1, { powered: false, unpoweredSols: 0.2 }));
      const hab = s.slots.find((x) => x.id === 's6').module;
      hab.powered = false;
      hab.unpoweredSols = 0.2;
      s.resources.energy = 0;
      s.timers.blackout = 0.2;
      s.slots.find((x) => x.id === 's7').module.dust = 0.5;
      return s;
    }
    case 'levels1': case 'levels2': case 'levels3': {
      const L = Number(variant.slice(-1));
      const s = base(4.45);
      const types = ['habitat', 'solar', 'battery', 'moxie', 'extractor', 'greenhouse', 'shelter', 'reactor'];
      types.forEach((type, i) => put(s, 's' + (i + 5), mod(type, L)));
      s.resources.energy = 60 * 0.7;
      return s;
    }
    case 'spe': case 'spe2': {
      const s = full(variant === 'spe' ? 4.6 : 4.55);
      s.env.spe = { phase: variant === 'spe' ? 'warning' : 'active', donkiId: 'fx-1', classType: 'X2.1', peakTime: 5, link: '', severity: 'severe', startsAt: 4.7, endsAt: 5.7, totalMsv: 40 };
      return s;
    }
    case 'sheltering': {
      const s = full(4.55);
      s.sheltering = true;
      s.env.spe = { phase: 'active', donkiId: 'fx-1', classType: 'M5.0', peakTime: 5, link: '', severity: 'moderate', startsAt: 4.5, endsAt: 5.5, totalMsv: 3 };
      for (const c of s.colonists) { c.location = 'shelter'; }
      return s;
    }
    case 'expedition': {
      const s = full(4.6);
      s.colonists[4].location = 'expedition'; s.colonists[5].location = 'expedition';
      s.expeditions = [
        { id: 'x1', site: 'ice', colonistId: 'c5', startT: 4.2, endT: 5.0, recalled: false, stuck: false },
        { id: 'x2', site: 'minerals', colonistId: 'c6', startT: 4.05, endT: 5.65, recalled: false, stuck: false },
      ];
      return s;
    }
    case 'ship': {
      const s = full(4.6);
      s.ship = { nextArrivalT: 9.5, manifest: { cargo: { parts: 20 }, candidates: [{ name: 'Rui', profession: 'engineer' }] }, awaitingDecision: false };
      return s;
    }
    case 'shipland': {
      const s = full(4.6);
      s.ship = { nextArrivalT: 31, manifest: null, awaitingDecision: true, offer: [] };
      return s;
    }
    case 'repairing': {
      const s = full(4.6);
      put(s, 's1', mod('extractor', 1, { status: 'repairing', progress: 0.4 }));
      put(s, 's16', mod('solar', 2, { status: 'repairing', progress: 0.7 }));
      put(s, 's12', mod('extractor', 3, { status: 'broken' }));
      return s;
    }
    default:
      throw new Error('unknown fixture variant: ' + variant);
  }
}
