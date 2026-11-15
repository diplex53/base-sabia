// Scientific constants for Base Sabiá.
// Every value cites its source (DESIGN.md section 13) and status:
//   confirmed            = checked at the source
//   pending verification = research team still confirming (DESIGN.md status V)
//   ASSUMPTION           = game value or our own fit, with a one-line justification
// Game-tuning values (costs, outputs, tolerances) live in balance.js, not here.

// ---------------------------------------------------------------------------
// Measured / published
// ---------------------------------------------------------------------------

// Length of a Mars solar day in hours.
// Source: NASA Mars Fact Sheet, https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html (confirmed)
export const SOL_HOURS = 24.6597;

// Mean solar irradiance at Mars orbit (W/m2).
// Source: NASA Mars Fact Sheet, https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html (confirmed)
export const SOLAR_IRRADIANCE_MARS_W_M2 = 586.2;

// Earth-Mars synodic period (days, ~26 months).
// Source: NASA Mars Fact Sheet, https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html (confirmed)
export const SYNODIC_PERIOD_DAYS = 779.94;

// NASA career radiation limit (mSv, ~3% risk of exposure-induced cancer death).
// Source: NASA-STD-3001, requirement V1 4030, https://www.nasa.gov/reference/4-0-human-performance/ (confirmed)
export const CAREER_DOSE_LIMIT_MSV = 600;

// Galactic cosmic ray dose on the Martian surface (mSv per Earth day), Curiosity/RAD, Aug 2012 - Jun 2013.
// Source: NASA, Curiosity/RAD, https://www.nasa.gov/news-release/nasa-rover-results-include-first-age-measurement-on-mars-and-help-for-human-exploration/ (confirmed)
export const GCR_SURFACE_MSV_PER_DAY = 0.67;

// Dose rate during Earth-Mars cruise (mSv per day), measured by RAD.
// Source: JPL, https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/ (confirmed)
export const CRUISE_MSV_PER_DAY = 1.8;

// One-way transit duration of the reference mission (days; MSL took 253).
// Source: NASA, https://science.nasa.gov/resource/radiation-exposure-comparisons-with-mars-trip-calculation/ (confirmed)
export const TRANSIT_DAYS = 180;

// Peak dust opacity (tau) at Opportunity, 10 Jun 2018 (sol 5111).
// Source: JPL, https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/ (confirmed)
export const OPPY_TAU_PEAK = 10.8;

// Opportunity energy per sol before the 2018 storm (Wh/sol).
// Source: Planetary Society, https://www.planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep (pending verification: NASA source still missing)
export const OPPY_WH_CLEAR = 645;

// Opportunity energy per sol at tau 10.8 (Wh/sol).
// Source: Planetary Society, https://www.planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep (pending verification: NASA source still missing)
export const OPPY_WH_STORM = 22;

// Typical clear-sky dust opacity.
// Source: JPL, https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/ (confirmed)
export const TAU_CLEAR = 0.5;

// InSight array output on sol 1 (Wh).
// Source: JPL, https://www.jpl.nasa.gov/news/mars-new-home-a-large-sandbox/ (confirmed)
export const INSIGHT_SOL1_WH = 4588;

// InSight solar array diameter (m), one of two round arrays.
// Source: InSight press kit (diameter only); area derived by us. (ASSUMPTION on the area: NASA does not publish it, we use the disc area)
export const INSIGHT_ARRAY_DIAMETER_M = 2.15;

// Number of InSight solar arrays.
// Source: InSight press kit (confirmed)
export const INSIGHT_ARRAY_COUNT = 2;

// Dust deposition on solar panels (fraction of output lost per sol), Mars Pathfinder.
// Source: Landis & Jenkins 2000, Mars Pathfinder (pending verification: original paper not opened yet)
export const DUST_RATE_PER_SOL = 0.0028;

// MOXIE peak oxygen production (g/h).
// Source: NASA MOXIE, https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/ (confirmed)
export const MOXIE_G_PER_HOUR = 12;

// MOXIE power draw (W).
// Source: NASA Mars 2020 instruments, https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/ (confirmed)
export const MOXIE_WATTS = 300;

// Oxygen per crew member per Earth day (kg).
// Source: NASA BVAD Rev1, Table 3-33, https://ntrs.nasa.gov/api/citations/20180001338/downloads/20180001338.pdf (confirmed)
export const O2_KG_PER_CREW_DAY = 0.816;

// Gross water use per crew member per Earth day, early planetary base (kg; drinking + food prep = 2.5).
// Source: NASA BVAD Rev1, Table 4-20, https://ntrs.nasa.gov/api/citations/20180001338/downloads/20180001338.pdf (confirmed)
export const WATER_GROSS_KG_PER_CREW_DAY = 4.48;

// Dry food mass per crew member per Earth day (kg).
// Source: NASA BVAD Rev1, Table 4-57, https://ntrs.nasa.gov/api/citations/20180001338/downloads/20180001338.pdf (confirmed)
export const FOOD_DRY_KG_PER_CREW_DAY = 0.617;

// Potato dry yield (g per m2 per Earth day).
// Source: NASA BVAD Rev1, Table 4-97, https://ntrs.nasa.gov/api/citations/20180001338/downloads/20180001338.pdf (confirmed)
export const CROP_YIELD_G_M2_DAY = 21.06;

// Crop biomass per kWh of electricity (g/kWh); best case of the 1.6-10 range.
// Source: NASA BVAD Rev1, Table 4-95, https://ntrs.nasa.gov/api/citations/20180001338/downloads/20180001338.pdf (pending verification)
// ASSUMPTION: we use the best case of the range so a greenhouse is affordable in the game.
export const CROP_G_PER_KWH = 10;

// Crop area that supplies the O2 of one person (m2; 20-25, midpoint).
// Source: Wheeler, NASA KSC, https://ntrs.nasa.gov/api/citations/20200002230/downloads/20200002230.pdf (confirmed)
export const CROP_M2_PER_PERSON_O2 = 22.5;

// ISS water recovery before 2023.
// Source: NASA 2023, https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/ (confirmed)
export const WATER_RECYCLE_BASE = 0.93;

// ISS water recovery with the Brine Processor (2023).
// Source: NASA 2023, https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/ (confirmed)
export const WATER_RECYCLE_TECH = 0.98;

// Kilopower / KRUSTY electrical output (kWe).
// Source: NASA KRUSTY, https://www.nasa.gov/news-release/demonstration-proves-nuclear-fission-system-can-provide-space-exploration-power/ (confirmed)
export const KILOPOWER_KWE = 10;

// One-way Earth-Mars light delay, minimum and maximum (minutes).
// Source: NASA, https://www.nasa.gov/missions/tech-demonstration/deep-space-atomic-clock/how-an-atomic-clock-will-get-humans-to-mars-on-time/ (confirmed)
export const COMM_DELAY_MIN_MINUTES = 4;
export const COMM_DELAY_MAX_MINUTES = 20;

// Surface dose of a moderate solar particle event, range (mSv). Anchor: RAD saw >2x surface radiation for >2 days, Sep 2017.
// Source: JPL, https://www.jpl.nasa.gov/news/large-solar-storm-sparks-global-aurora-and-doubles-radiation-levels-on-the-martian-surface/ (confirmed)
// ASSUMPTION: the 1-5 mSv range is our translation of that measurement into a game dose.
export const SPE_MODERATE_MSV = [1, 5];

// Surface dose of a severe solar particle event, range (mSv): 1972 20-50, 1960 50-70, 1956 80-100 (modelled).
// Source: NASA TP-2979, https://ntrs.nasa.gov/citations/19900009041 (confirmed)
export const SPE_SEVERE_MSV = [20, 100];

// ---------------------------------------------------------------------------
// Derived (computed here, the arithmetic is in each comment)
// ---------------------------------------------------------------------------

// Earth day -> sol conversion: 24.6597 h / 24 h = 1.0275.
export const DAY_TO_SOL = SOL_HOURS / 24;

// Clear-sky solar yield per m2 per sol (kWh), InSight anchor:
// 4.588 kWh / (2 * pi * 1.075^2 m2 = 7.26 m2) = 0.632 kWh/m2/sol. Empirical, no cell efficiency assumed.
export const SOLAR_YIELD_CLEAR_KWH_M2_SOL =
  (INSIGHT_SOL1_WH / 1000) / (INSIGHT_ARRAY_COUNT * Math.PI * (INSIGHT_ARRAY_DIAMETER_M / 2) ** 2);

// Dust-opacity attenuation coefficient: ln(645 / 22) / (10.8 - 0.5) = 0.328.
// ASSUMPTION: exponential form f_tau = exp(-K_TAU (tau - TAU_CLEAR)), a two-point fit to Opportunity 2018.
export const K_TAU = Math.log(OPPY_WH_CLEAR / OPPY_WH_STORM) / (OPPY_TAU_PEAK - TAU_CLEAR);

// MOXIE energy per kg of O2: 300 W / 12 g/h = 25 Wh/g = 25 kWh/kg.
export const MOXIE_KWH_PER_KG = MOXIE_WATTS / MOXIE_G_PER_HOUR;

// Per-sol crew needs: per-day value * 1.0275.
export const O2_PER_CREW_SOL = O2_KG_PER_CREW_DAY * DAY_TO_SOL;                  // 0.838 kg/sol
export const WATER_GROSS_PER_CREW_SOL = WATER_GROSS_KG_PER_CREW_DAY * DAY_TO_SOL; // 4.603 kg/sol
export const FOOD_PER_CREW_SOL = FOOD_DRY_KG_PER_CREW_DAY * DAY_TO_SOL;          // 0.634 kg/sol

// Crop yield per m2 per sol: 21.06 g / 1000 * 1.0275 = 0.0216 kg/m2/sol.
export const CROP_YIELD_KG_M2_SOL = CROP_YIELD_G_M2_DAY / 1000 * DAY_TO_SOL;

// Greenhouse lighting energy: 21.06 g/m2/day / 10 g/kWh * 1.0275 = 2.16 kWh/m2/sol.
export const GH_KWH_PER_M2_SOL = CROP_YIELD_G_M2_DAY / CROP_G_PER_KWH * DAY_TO_SOL;

// Surface GCR dose per sol: 0.67 * 1.0275 = 0.688 mSv/sol.
export const GCR_SURFACE_MSV_PER_SOL = GCR_SURFACE_MSV_PER_DAY * DAY_TO_SOL;

// Dose already received on the trip: 1.8 mSv/day * 180 days = 324 mSv.
export const TRANSIT_DOSE_MSV = CRUISE_MSV_PER_DAY * TRANSIT_DAYS;

// ---------------------------------------------------------------------------
// ASSUMPTION values (research team to replace with literature values)
// ---------------------------------------------------------------------------

// ASSUMPTION: GCR shielding factors per location. Habitat levels 1/2/3 get thicker walls;
// a regolith shelter halves GCR. Game values to be calibrated with shielding literature.
export const SHIELD_GCR = { expedition: 1.0, habitat: [0.8, 0.7, 0.6], shelter: 0.5 };

// ASSUMPTION: SPE shielding factors per location. Solar protons are far easier to stop than GCR,
// so habitat walls halve them and a regolith shelter cuts 90%. Game values.
export const SHIELD_SPE = { expedition: 1.0, habitat: 0.5, shelter: 0.1 };

// ASSUMPTION: dose multiplier with a physician on base (NASA ALARA principle); the 15% value is ours.
export const ALARA_FACTOR = 0.85;

// ASSUMPTION: ice extractor energy per kg of water. Physical minimum to melt ice from -60 C is ~0.13 kWh/kg
// (latent + sensible heat); the rest covers excavation and losses.
export const EXTRACTOR_KWH_PER_KG = 1;

// ASSUMPTION: net irrigation water loss of the greenhouse (kg/m2/sol); most transpired water is recovered.
export const GH_WATER_KG_M2_SOL = 0.1;

// ASSUMPTION: dust deposition multiplier during storms (clear / regional / global). Game values.
export const DUST_STORM_MULT = { none: 1, regional: 5, global: 10 };

// ASSUMPTION: dust coverage saturates at 80% loss; panels never go fully dark from dust alone.
export const DUST_MAX = 0.8;
