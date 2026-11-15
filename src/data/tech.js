// Technology tree (DESIGN 9, Apêndice B.6). Cost in science points, bought instantly.
// Each tech is based on real NASA work; the effects are game values.
export const TECHS = {
  eds: { cost: 20, requires: [] },                          // Electrodynamic Dust Shield (NASA Kennedy)
  waterRecycling: { cost: 25, requires: [] },               // ISS ECLSS with the Brine Processor (2023)
  spaceWeather: { cost: 25, requires: [] },                 // NASA solar monitoring / MAVEN
  regolithPrinting: { cost: 35, requires: [] },             // 3D-printed habitat, Mars Dune Alpha (CHAPEA)
  plantHabitat: { cost: 40, requires: [] },                 // Veggie -> Advanced Plant Habitat (ISS)
  bioregen: { cost: 50, requires: ['plantHabitat'] },       // bioregenerative life support (NASA Kennedy)
  pressurizedRover: { cost: 50, requires: ['spaceWeather'] }, // Space Exploration Vehicle
  fission: { cost: 70, requires: ['eds'] },                 // Kilopower / KRUSTY (2018)
};

// Effect sizes (Apêndice B.6). waterRecycling uses WATER_RECYCLE_TECH and spaceWeather EVENTS.spe.warningSolsTech.
export const TECH_EFFECTS = {
  edsDustMult: 0.2,          // eds: dust deposition x 0.2
  printingPartsMult: 0.7,    // regolithPrinting: parts cost x 0.7, rounded up
  plantFoodMult: 1.5,        // plantHabitat: greenhouse food x 1.5
  roverShield: 0.5,          // pressurizedRover: dose on expedition x 0.5
  rovers: 1, roversTech: 2,  // pressurizedRover: simultaneous expeditions
};
