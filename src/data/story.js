// Scripted tutorial chapters. Starting stocks/capacities are game balance, not science.
import { MODULES, EXPANSION_MODULES, oldSlotToNew } from './balance.js';

// Apêndice E.4: the story never unlocks the expansion modules.
const STORY_MODULES = Object.keys(MODULES).filter((x) => !EXPANSION_MODULES.includes(x));

export const STORY_FEATURES = ['toggle', 'assign', 'clean', 'ships', 'tech', 'expeditions', 'shelter'];
const crew = [
  { name: 'Lia Moreira', profession: 'engineer', dose: 324 },
  { name: 'Kenji Tanaka', profession: 'medic', dose: 324 },
  { name: 'Amara Okafor', profession: 'botanist', dose: 324 },
  { name: 'Tomás Reyes', profession: 'geologist', dose: 324 },
];
// Slots are written in the old 4x4 numbering and mapped to the middle of the 6x6 map (Apêndice E.1).
const module = (slot, type, level = 1, extra = {}) => ({ slot: oldSlotToNew(slot), type, level, ...extra });
const base = [module('s6', 'habitat', 2), module('s1', 'solar', 1, { dust: 0.12 }),
  module('s2', 'solar', 1, { dust: 0.12 }), module('s3', 'solar', 1, { dust: 0.12 }),
  module('s10', 'battery', 3), module('s11', 'battery', 3), module('s7', 'moxie'),
  module('s8', 'extractor'), module('s9', 'greenhouse', 1, { growth: 1 })];
const manifest = { cargo: { parts: 25, food: 40, regolith: 10 }, candidates: [
  { name: 'Rafael', profession: 'engineer' }, { name: 'Mei', profession: 'botanist' },
] };
const step = (id, check, extra = {}) => ({ id, check, ...extra });
const scenes = n => ({ intro: [`c${n}.intro1`, `c${n}.intro2`], outro: [`c${n}.outro1`] });

export const CHAPTERS = {
  1: {
    ...scenes(1), startT: 0.3,
    start: { resources: { energy: 60, o2: 30, water: 40, food: 60, parts: 70, regolith: 20, science: 0 },
      modules: [module('s6', 'habitat'), module('s10', 'battery')], colonists: crew,
      tech: [], shipNextArrivalT: 26 },
    unlocked: { modules: ['solar'], features: [], techs: [] }, scheduled: [],
    steps: [
      step('c1.solar', { kind: 'built', module: 'solar', count: 1 }, { unlock: { modules: ['battery'] }, panel: 'nightPower' }),
      step('c1.battery', { kind: 'built', module: 'battery', count: 2 }, { unlock: { features: ['toggle'] } }),
      step('c1.night', { kind: 'tReached', t: 1.3 }, { unlock: { modules: ['moxie'] } }),
      step('c1.moxie', { kind: 'built', module: 'moxie', count: 1 }, { panel: 'moxieEnergy' }),
      step('c1.o2', { kind: 'netNonNegative', res: 'o2' }, { unlock: { modules: ['extractor'] } }),
      step('c1.water', { kind: 'built', module: 'extractor', count: 1 }, { unlock: { modules: ['greenhouse'] }, panel: 'iceOnMars' }),
      step('c1.food', { kind: 'built', module: 'greenhouse', count: 1 }, { panel: 'cropsNeedLight' }),
      step('c1.end', { kind: 'tReached', afterStepSols: 1, maxT: 12 }),
    ],
  },
  2: {
    ...scenes(2), startT: 40.3,
    // Two full N3 batteries provide the habitat's seven-sol storm reserve;
    // oxygen reserve lets both candidates pass the 26-sol sustain check.
    start: { resources: { energy: 400, o2: 110, water: 100, food: 100, parts: 40, regolith: 10, science: 40 },
      modules: base, colonists: crew, tech: ['eds'], shipNextArrivalT: 41, shipManifest: manifest },
    unlocked: { modules: STORY_MODULES.filter(x => x !== 'reactor'), features: ['toggle', 'assign', 'clean', 'ships', 'tech'], techs: ['eds', 'fission'] },
    scheduled: [{ atT: 44, kind: 'dustRegional', params: { tauPeak: 3, sols: 2 } },
      { atT: 46.5, kind: 'dustGlobal', params: { tauPeak: 10.8, sols: 7 } }],
    steps: [step('c2.land', { kind: 'landed', count: 2 }),
      step('c2.assign', { kind: 'assigned', profession: 'engineer', module: 'solar' }),
      step('c2.clean', { kind: 'cleaned' }, { panel: 'dustOnPanels' }),
      step('c2.regional', { kind: 'eventEnded', event: 'dustRegional' }),
      step('c2.global', { kind: 'eventEnded', event: 'dustGlobal' }, { panel: 'globalStorm' }),
      step('c2.fission', { kind: 'researched', tech: 'fission' })],
  },
  3: {
    ...scenes(3), startT: 90.3,
    start: { resources: { energy: 400, o2: 160, water: 200, food: 200, parts: 30, regolith: 15, science: 30 },
      modules: [...base, module('s4', 'reactor'), module('s5', 'greenhouse', 1, { growth: 1 })],
      // Lia 565 / crew 500: an unsheltered severe storm (100 mSv x 0.5 habitat x 0.85 ALARA = 42.5) pushes Lia past
      // 600, and so does the full 100 mSv for whoever is left out on the expedition; sheltered (8.5) everyone stays under.
      colonists: crew.map((c, i) => ({ ...c, dose: i === 0 ? 565 : 500 })),
      tech: ['eds', 'fission'], shipNextArrivalT: 101, shipManifest: manifest },
    unlocked: { modules: [...STORY_MODULES], features: STORY_FEATURES.filter(x => x !== 'ships'), techs: ['spaceWeather'] },
    // the real 2017-09-10 X8.2 flare, played as moderate (Mars' atmosphere helps, as Curiosity/RAD measured)
    scheduled: [{ atT: 95, kind: 'spe', params: { severity: 'moderate', donkiId: '2017-09-10T15:35:00-FLR-001', totalMsv: 4 } }],
    steps: [step('c3.regolith', { kind: 'expeditionDone', site: 'regolith' }),
      step('c3.shelter', { kind: 'built', module: 'shelter', count: 1 }, { panel: 'alara' }),
      step('c3.alert', { kind: 'researched', tech: 'spaceWeather' }),
      step('c3.first', { kind: 'eventEnded', event: 'spe', severity: 'moderate' }, { panel: 'speAtmosphere' }),
      // the severe warning comes 0.6 sol after this step starts (t ~98.6 for a player on schedule), while the
      // minerals expedition the step asks for is out and can still be recalled
      step('c3.minerals', { kind: 'recalled', site: 'minerals', duringSevereWarning: true },
        { schedule: [{ in: 0.6, kind: 'spe', params: { severity: 'severe', donkiId: '2017-09-06T11:53:00-FLR-001', totalMsv: 100 } }] }),
      step('c3.severe', { kind: 'all', checks: [{ kind: 'shelteredWhen', severity: 'severe' }, { kind: 'eventEnded', event: 'spe', severity: 'severe' }] }, { panel: 'speSevere' }),
      step('c3.dose', { kind: 'maxDoseBelow', msv: 600 }, { unlock: { features: ['ships'] } }),
      step('c3.ship', { kind: 'landed', count: 2 })],
  },
};
