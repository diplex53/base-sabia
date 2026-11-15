// Crafting data (team list, docs/lista-equipe.txt): ores, intermediate items, recipes, drill output.
// Quantities of recipes and drills are the team's; everything marked ASSUMPTION is game balance.

/** Ores that live in state.resources (shared with the rest of the economy). */
export const RESOURCE_ORES = { regolith: 'regolith', water: 'water', methane: 'methane' };

/** Ores stored in state.inv. */
export const ORES = ['iron', 'copper', 'silicon', 'aluminum', 'sulfur', 'carbon', 'titanium', 'lithium', 'nickel', 'cobalt', 'tungsten', 'boron', 'gold'];

export const ITEMS = ['ironBar', 'gear', 'reinforcedIronBar', 'wire', 'sulfurCement', 'siliconPlate', 'temperedGlass', 'silicaAerogel',
  'aluminumOxide', 'carbonFiber', 'polyethylene', 'titaniumRod', 'tungstenHead', 'boronNanotube', 'advancedBattery', 'goldMicrochip'];

const R = (id, station, inp, out) => ({ id, station, in: inp, out });

// station 'table' = Mesa de Producao, 'builder' = Construtora de Modulos (needs one on the map).
export const RECIPES = [
  // ASSUMPTION: sifting regolith yields basic ores (team request: "limpar o regolito e tirar ferro dele").
  R('siftRegolith', 'table', { regolith: 5 }, { iron: 2, silicon: 1, aluminum: 1 }),
  R('ironBar', 'table', { iron: 3 }, { ironBar: 1 }),
  R('gear', 'table', { iron: 3 }, { gear: 2 }),
  R('reinforcedIronBar', 'table', { iron: 3, nickel: 1 }, { reinforcedIronBar: 1 }),
  R('wire', 'table', { copper: 2 }, { wire: 1 }),
  R('sulfurCement', 'table', { regolith: 4, sulfur: 1 }, { sulfurCement: 1 }),
  R('siliconPlate', 'table', { silicon: 2 }, { siliconPlate: 1 }),
  R('temperedGlass', 'table', { silicon: 3 }, { temperedGlass: 1 }),
  R('silicaAerogel', 'table', { silicon: 3, water: 1 }, { silicaAerogel: 1 }),
  R('aluminumOxide', 'table', { aluminum: 2, water: 2 }, { aluminumOxide: 1 }),
  R('carbonFiber', 'table', { carbon: 3, methane: 1 }, { carbonFiber: 1 }),
  R('polyethylene', 'table', { methane: 2, water: 1 }, { polyethylene: 1 }),
  R('titaniumRod', 'table', { titanium: 3 }, { titaniumRod: 1 }),
  R('tungstenHead', 'table', { tungsten: 4 }, { tungstenHead: 1 }),
  R('boronNanotube', 'table', { boron: 3, carbon: 1 }, { boronNanotube: 1 }),
  R('advancedBattery', 'table', { lithium: 2, cobalt: 1 }, { advancedBattery: 1 }),
  R('goldMicrochip', 'table', { gold: 2, silicon: 1 }, { goldMicrochip: 1 }),
  R('kit.drillBasic', 'table', { ironBar: 2, gear: 2, wire: 1 }, { 'kit.drillBasic': 1 }),
  R('kit.drillAdvanced', 'table', { titaniumRod: 3, tungstenHead: 2, carbonFiber: 3, advancedBattery: 2 }, { 'kit.drillAdvanced': 1 }),
  R('kit.moduleBuilder', 'table', { ironBar: 6, gear: 4, wire: 4, sulfurCement: 4 }, { 'kit.moduleBuilder': 1 }),
  R('kit.greenhouse', 'table', { temperedGlass: 3, ironBar: 2, sulfurCement: 2 }, { 'kit.greenhouse': 1 }),
  R('kit.moxie', 'table', { ironBar: 4, wire: 4, siliconPlate: 3, aluminumOxide: 2 }, { 'kit.moxie': 1 }),
  R('kit.solar', 'builder', { siliconPlate: 6, wire: 4, ironBar: 4, temperedGlass: 2 }, { 'kit.solar': 1 }),
  R('kit.warehouse', 'builder', { sulfurCement: 10, ironBar: 6, polyethylene: 4 }, { 'kit.warehouse': 1 }),
  R('kit.sabatier', 'builder', { reinforcedIronBar: 6, wire: 5, aluminumOxide: 4, sulfurCement: 6 }, { 'kit.sabatier': 1 }),
  R('kit.battery', 'builder', { advancedBattery: 6, reinforcedIronBar: 4, wire: 4, silicaAerogel: 2 }, { 'kit.battery': 1 }),
  R('kit.gym', 'builder', { reinforcedIronBar: 6, gear: 5, carbonFiber: 5, polyethylene: 4 }, { 'kit.gym': 1 }),
  R('kit.thermal', 'builder', { silicaAerogel: 6, wire: 5, tungstenHead: 3, goldMicrochip: 3 }, { 'kit.thermal': 1 }),
  R('kit.decon', 'builder', { aluminumOxide: 6, polyethylene: 5, wire: 5, goldMicrochip: 3, advancedBattery: 2 }, { 'kit.decon': 1 }),
  R('kit.hospital', 'builder', { reinforcedIronBar: 6, temperedGlass: 5, goldMicrochip: 4, advancedBattery: 3 }, { 'kit.hospital': 1 }),
  R('kit.radShield', 'builder', { boronNanotube: 8, polyethylene: 6, reinforcedIronBar: 6, titaniumRod: 5, advancedBattery: 2 }, { 'kit.radShield': 1 }),
  R('kit.dome', 'builder', { polyethylene: 25, carbonFiber: 20, silicaAerogel: 15, aluminumOxide: 12, temperedGlass: 8 }, { 'kit.dome': 1 }),
];

/** Module types that have a kit recipe. */
export const KIT_TYPES = RECIPES.filter((r) => r.id.startsWith('kit.')).map((r) => r.id.slice(4));

/** Every inventory key (ores, items, kits), in display order. */
export const KITS = KIT_TYPES.map((t) => 'kit.' + t);

// ---------- craft economy (state.economy === 'craft') ----------
// ASSUMPTION: item build cost of the structures without a team recipe, basic-tier items only, sized like the
// cheap team recipes. craftTable costs raw ore so the game can never deadlock.
export const CRAFT_BUILD_COST = {
  craftTable: { iron: 6, regolith: 4 },
  habitat: { ironBar: 4, sulfurCement: 4, temperedGlass: 2, wire: 2 },
  extractor: { ironBar: 2, gear: 2, wire: 2 },
  shelter: { sulfurCement: 6, ironBar: 2 },
  reactor: { ironBar: 8, gear: 4, wire: 6, siliconPlate: 4 },
  pressurizer: { ironBar: 3, gear: 2, wire: 2 },
  waterFilter: { ironBar: 2, siliconPlate: 2, wire: 1 },
  factory: { ironBar: 4, gear: 4, wire: 3 },
  mine: { ironBar: 4, gear: 3, wire: 2 },
};
// ASSUMPTION: every supply ship also brings ores that only the advanced drill can mine, so the first ship
// lets the player craft one advanced drill (titanium 9 = 3 rods, tungsten 8 = 2 heads, lithium 4 + cobalt 2 = 2 batteries).
export const SHIP_ORES = { titanium: 9, tungsten: 8, lithium: 4, cobalt: 2, nickel: 4, boron: 3, gold: 2 };
// ASSUMPTION: what an expedition to the mineral outcrop adds (x reward fraction and geologist bonus).
export const MINERALS_ORES = { titanium: 3, tungsten: 2, lithium: 2, cobalt: 1, nickel: 2, boron: 2, gold: 1 };
// Craft economy bootstrap: starter items; one craftTable and one drillBasic are placed next to the start modules.
export const CRAFT_START_INV = { ironBar: 14, gear: 6, wire: 12, sulfurCement: 6, siliconPlate: 9, temperedGlass: 5, aluminumOxide: 2, 'kit.solar': 1 };
export const CRAFT_START_MODULES = ['craftTable', 'drillBasic'];

// Drill output per cycle (team list: "produz a cada 20 segundos").
// 20 s of real time at 1x speed; 1 sol = 24 s (TIME.SOL_REAL_SECONDS), so a cycle is 20/24 sol.
export const DRILL_CYCLE_SOLS = 20 / 24;
export const DRILLS = {
  drillBasic: { regolith: 5, iron: 3, copper: 3, silicon: 3, aluminum: 3, sulfur: 3, carbon: 3 },
  drillAdvanced: {
    regolith: 8, iron: 5, copper: 5, silicon: 5, aluminum: 5, sulfur: 5, carbon: 5,
    titanium: 3, lithium: 3, nickel: 3, cobalt: 3, water: 3, methane: 3, tungsten: 2, boron: 2, gold: 2,
  },
};
