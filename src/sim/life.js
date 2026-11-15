// Life support (DESIGN 5.2-5.4). Consumption counts everyone present (active and retired).
//   d(o2)/dt    = sum(moxie.o2 * staff) - n * O2_PER_CREW_SOL
//   d(water)/dt = sum(extractor.water * staff) - n * WATER_GROSS * (1 - recycle) - sum(gh.area * GH_WATER)
//   d(food)/dt  = sum(gh.area * CROP_YIELD * growth * staff) - n * FOOD_PER_CREW_SOL
// Stocks are clamped at 0; the grace timers (game.js) handle running out.
import { GREENHOUSE } from '../data/balance.js';
import { rawModuleRates, isActive, isBuilt, headcount, crewUse } from './model.js';
import { setAlert, showPanel } from './alerts.js';

export function stepLife(state, dt, emit) {
  const crew = crewUse(state, headcount(state));
  let o2Prod = 0, waterProd = 0, ghWater = 0, foodProd = 0;
  for (const sl of state.slots) {
    if (!sl.module) continue;
    const r = rawModuleRates(state, sl.module);
    o2Prod += r.o2;
    if (r.water >= 0) waterProd += r.water; else ghWater -= r.water;
    foodProd += r.food;
  }
  const res = state.resources;
  res.o2 = Math.max(0, res.o2 + (o2Prod - crew.o2) * dt);
  res.water = Math.max(0, res.water + (waterProd - crew.water - ghWater) * dt);
  res.food = Math.max(0, res.food + (foodProd - crew.food) * dt);

  const rt = state.rates;
  rt.o2Prod = o2Prod; rt.o2Use = crew.o2;
  rt.waterProd = waterProd; rt.waterUse = crew.water + ghWater;
  rt.foodProd = foodProd; rt.foodUse = crew.food;

  stepGreenhouses(state, dt, emit);
}

/** Growth 0 -> 1 over growSols while active; crop dies after dieAfterUnpoweredSols without power, water or switched off. DESIGN 5.4. */
function stepGreenhouses(state, dt, emit) {
  let died = false;
  for (const sl of state.slots) {
    const m = sl.module;
    if (!m || m.type !== 'greenhouse' || !isBuilt(m)) continue;
    if (isActive(state, m)) {
      m.growth = Math.min(1, m.growth + dt / GREENHOUSE.growSols);
      m.unpoweredSols = 0;
    } else {
      m.unpoweredSols += dt;
      if (m.unpoweredSols >= GREENHOUSE.dieAfterUnpoweredSols - 1e-9 && m.growth > 0) {
        m.growth = 0;
        died = true;
      }
    }
  }
  if (died) {
    // a one-shot alert: raise and immediately clear so the next death alerts again
    setAlert(state, emit, 'alert.cropsDied', true, 'danger');
    setAlert(state, emit, 'alert.cropsDied', false);
    showPanel(state, emit, 'cropsNeedLight');
  }
}
