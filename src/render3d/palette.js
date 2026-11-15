// Color keys used by the voxel model data (sRGB hex).
// `emit` keys are drawn as dark glass when the module is off and glow when it is on.
// `dust` keys are solar cells: they blend toward dust tan with the panel's dust level.
// `plant` keys grow vertically with the greenhouse growth.
// `glass` keys go to a separate translucent mesh.

export const PALETTE = {
  // structure
  hull: 0xf1f2eb,
  hull2: 0xc7d3d4,
  hullDark: 0x8599a2,
  metal: 0xa3b4bd,
  steel: 0x627985,
  dark: 0x243442,
  frame: 0x405564,
  concrete: 0xa89d8f,
  accent: 0xf48a48,     // mission-orange band, shared visual language with the HUD
  teal: 0x40bbb6,
  blue: 0x3d7fd6,
  red: 0xc23b2b,
  yellow: 0xf2c230,
  black: 0x222226,
  // module identities
  gold: 0xe2ad2f,
  goldDark: 0xa8741a,
  batt: 0x748f9d,
  battDark: 0x415d6d,
  orange: 0xe27a26,
  orangeDark: 0xb0561a,
  tank: 0xe4eaee,
  tankBlue: 0x4f9fd6,
  fin: 0xdfe4e8,
  finDark: 0x9aa3ab,
  soil: 0x5a3a26,
  regolith: 0x9c5236,
  regolith2: 0x8a4630,
  sandbag: 0xb98657,
  // expansion modules
  gymBody: 0x6b86a0,
  gymDark: 0x4a6076,
  shed: 0x959ea4,
  shedDark: 0x6d777e,
  aqua: 0x2f8fd0,
  // ground / props
  pad: 0x65747d,
  padEdge: 0x344652,
  padLine: 0xc6d8d8,
  plus: 0xf2dfb6,   // light sand "+" on empty slots, readable on the soil
  rock: 0x4b3a35,
  rock2: 0x5e4740,
  ice: 0xcdeaf3,
  crystal: 0x9b6bd6,
  wheel: 0x2b2b2f,
  // solar cells (dust)
  cell: 0x173c65,
  cell2: 0x215c86,
  // plants
  leaf: 0x3aa845,
  leaf2: 0x6ccf55,
  fruit: 0xe85a3a,
  // emissive
  win: 0xffdeb0,
  core: 0xff7a2a,
  grow: 0xff3fd0,
  rglow: 0x6fd0ff,
  led: 0x7dff8a,
  ledRed: 0xff4a3a,
  gauge: 0xffffff,
  siteIce: 0x7fe8ff,
  siteReg: 0xff9a3c,
  siteMin: 0xc58bff,
  // glass
  glass: 0xffffff,
};

export const EMIT_KEYS = new Set(['win', 'core', 'grow', 'rglow', 'led', 'ledRed', 'gauge', 'siteIce', 'siteReg', 'siteMin']);
export const DUST_KEYS = new Set(['cell', 'cell2']);
export const PLANT_KEYS = new Set(['leaf', 'leaf2', 'fruit']);
export const GLASS_KEYS = new Set(['glass']);
export const GAUGE_KEYS = new Set(['gauge']);

// Suit stripe colors for colonists (picked by a hash of the colonist id).
export const STRIPES = [0xe06a2a, 0x3d7fd6, 0x2aa198, 0xd6409f, 0xf2c230, 0x8bc34a, 0x9b6bd6, 0xe0453a];

// Ground glow colour per module type (night halo).
export const GLOW = {
  habitat: 0xffc060,
  greenhouse: 0xff40d0,
  reactor: 0x60c8ff,
  moxie: 0xff7a2a,
  sabatier: 0xff8a30,
  factory: 0xffb060,
  hospital: 0xffe0c0,
  gym: 0xa8c4ff,
};
