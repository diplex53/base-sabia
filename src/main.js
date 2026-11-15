import { createGame, loadGame } from './sim/index.js';
import { TIME, DEFAULT_ECONOMY } from './data/balance.js';
import { t, onLangChange } from './i18n/i18n.js';
import { applyStatic } from './ui/util.js';
import { toast } from './ui/toast.js';
import { showVictory, hideVictory } from './ui/victory.js';
import { createHud } from './ui/hud.js';
import { createSlotPanel } from './ui/slotPanel.js';
import { createColonistPanel } from './ui/colonists.js';
import { createModals } from './ui/modals.js';
import { advise } from './ui/advisor.js';
import { getSol } from './sim/selectors.js';
import { loadSunToday } from './net/donkiLive.js';
import { createStory, createObjectiveCard, sceneIds } from './ui/story.js';
import { currentGuide, guideSlots, createNewTracker, featureOn } from './ui/storyGuide.js';
import { createAutoplay, DEMO_SEED, DEMO_DIFFICULTY } from './demo/autoplay.js';
let demo = null; // presentation mode (created after the modals); never reads or writes the save
const demoOn = () => !!(demo && demo.active);

const SAVE_KEY = 'baseSabia.save.v1';
function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && o.v === 1 && typeof o.data === 'string' ? o : null;
  } catch (e) { return null; }
}
function writeSave(g) {
  if (demoOn()) return;
  try {
    const st = g.state;
    if (st.over || (st.story && st.story.complete)) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, mode: st.mode || 'colony', chapter: st.story ? st.story.chapter : null, difficulty: st.difficulty || 'cadet', sol: getSol(st), savedAt: Date.now(), data: g.serialize() }));
  } catch (e) { /* storage full or blocked: the game goes on */ }
}
function clearSave() { if (demoOn()) return; try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

const force2d = new URLSearchParams(location.search).get('view') === '2d';
const readBool = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch (e) { return d; } };

let game = createGame({ mode: 'colony', seed: Date.now() }); // backdrop behind the start screen
Object.defineProperty(window, '__game', { get: () => game, configurable: true });
let speed = 0;
let started = false;
let selected = null;
let overShown = false;
let lastSpe = null;
let view = null;
let viewKind = '';
const settings = { autoPause: readBool('sabia.autopause', true) };

function setLaunchScreen(on) {
  document.body.classList.toggle('is-launch', on);
  const hudRoot = document.getElementById('hud');
  if (hudRoot) hudRoot.inert = on;
}

/** Dome finished: frame the base, freeze the game and play the victory scene. */
function domeVictory(onContinue) {
  try { if (view && view.resetCamera) view.resetCamera(); } catch (e) { /* ignore */ }
  const st = game.state;
  if (onContinue) setSpeed(0);
  showVictory({ sol: Math.floor(st.t) + 1, colonists: st.colonists.length }, onContinue);
}
function setSpeed(s) {
  if (![0, 1, 2, 4].includes(s)) return;
  speed = s;
}
window.__setSpeed = setSpeed;

function act(action) {
  const r = game.dispatch(action);
  if (!r.ok) toast(t(r.reason));
  return r;
}

const ctx = {
  settings,
  setLaunchScreen,
  act,
  getState: () => game.state,
  getSave() {
    const o = readSave();
    return o ? { sol: o.sol || 1, difficulty: o.difficulty === 'commander' ? 'commander' : 'cadet', mode: o.mode, chapter: o.chapter || null } : null;
  },
  continueGame,
  openTech: () => modals.showTech(),
  canToggleDome: () => !!(view && view.setDomeVisible),
  setDomeVisible: (on) => { if (view && view.setDomeVisible) view.setDomeVisible(on); },
  openCraft: () => modals.showCraft(),
  openInventory: () => modals.showInventory(),
  openShip: () => { if (!modals.showShipInfo(game.state)) toast(t('ui.shipIn', { n: Math.max(0, Math.ceil(game.state.ship.nextArrivalT - game.state.t)) })); },
  openShipDecision: () => modals.openShipDecisionNow(),
  getSelected: () => selected,
  clearSelection: () => { selected = null; if (view) view.setSelected(null); },
  getSpeed: () => speed,
  isHeld: () => modals.isOpen() || !started || !!game.state.over || !!(game.state.story && game.state.story.complete),
  setSpeed,
  setAutoPause(v) { settings.autoPause = v; try { localStorage.setItem('sabia.autopause', v ? '1' : '0'); } catch (e) { /* ignore */ } },
  openNotebook: () => modals.showNotebook(game.state),
  openHelp: () => modals.showHelp(advise(game.state)),
  openGlossary: () => modals.showGlossary(),
  openNasaData: () => modals.showNasaData(),
  startColony,
  startDemo: () => startDemo(),
  openSite,
  startStory,
  retryStory: () => { const n = game.state.story ? game.state.story.chapter : 1; startStory(n, { skipIntro: true }); },
  exitStory,
  startColonyFromStory: () => startColony('cadet'),
  openStoryMenu: () => story.openMenu(),
  openStart: () => modals.showStart(),
  openInfo: () => modals.showInfo(),
  openProgress: () => modals.showProgress(),
  openModuleScience: (type) => modals.showModuleScience(type),
  saveNow() { if (started && !game.state.over) { writeSave(game); toast(t('pause.saved')); } },
  exitGame() { modals.closeAll(); started = false; resetStoryUi(); modals.showStart(); },
  getGuide: () => guide,
  isNew: (kind, id) => tracker.isNew(kind, id),
  newSig: () => tracker.sig(),
  featureOn: (f) => featureOn(game.state, f),
  playAgain: () => { modals.closeAll(); modals.showStart(); started = false; },
};

const modals = createModals(document.getElementById('modal-root'), ctx);
const story = createStory(ctx, modals);
const storyCard = createObjectiveCard();
const tracker = createNewTracker();
let guide = currentGuide(null);
let guideSig = '';
const hud = createHud(ctx);
const slotPanel = createSlotPanel(document.getElementById('slot-panel'), ctx);
const colPanel = createColonistPanel(document.getElementById('colonists-panel'));

// ---- presentation mode (fixed seed, plays itself, no save)
demo = createAutoplay({
  getGame: () => game,
  modalsOpen: () => modals.isOpen(),
  closeModals: () => modals.closeAll(),
  openTech: () => modals.showTech(),
  openCraft: () => modals.showCraft(),
  showVictory: () => domeVictory(null),
  hideVictory,
  showScience: (id) => modals.showScience(id, { spe: lastSpe || (game.state.env && game.state.env.spe) }),
  onExit: () => exitDemo(),
  onReplay: () => startDemo(demo.mode),
  onPlay: () => { exitDemo({ toStart: false }); startColony('cadet'); },
});
// Presentation: seconds each stop stays on screen before going on by itself. ?demo=1&t=15 changes it; ?demo=manual waits for the key.
const demoQuery = new URLSearchParams(location.search);
const demoT = Number(demoQuery.get('t'));
const demoHold = demoQuery.get('demo') === 'manual' ? 0 : (demoQuery.get('t') !== null && Number.isFinite(demoT) && demoT >= 0 ? Math.min(120, demoT) : 10);
function startDemo(mode = 'presenter') {
  if (demo.active) demo.stop();
  hideVictory();
  modals.closeAll();
  game = createGame({ mode: 'colony', seed: DEMO_SEED, difficulty: DEMO_DIFFICULTY });
  selected = null;
  if (view) view.setSelected(null);
  hud.reset();
  resetStoryUi();
  overShown = false;
  lastSpe = null;
  speed = 1;
  started = true;
  setLaunchScreen(false);
  demo.start({ mode, hold: demoHold });
}
function exitDemo({ toStart = true } = {}) {
  demo.stop(); hideVictory();
  modals.closeAll();
  started = false;
  speed = 0;
  game = createGame({ mode: 'colony', seed: Date.now() });
  hud.reset();
  resetStoryUi();
  if (toStart) modals.showStart();
}

function slotScience(id) {
  const slot = game.state.slots.find((s) => s.id === id);
  if (started && slot && slot.module) modals.showModuleScience(slot.module.type);
}

function select(id) {
  if (demoOn()) return;
  selected = id;
  if (view) view.setSelected(id);
  const sl = id && game.state.slots.find((s) => s.id === id);
  hud.showTab(sl && sl.module ? 'slot' : '');
}

let colonyStarting = false;
async function startColony(difficulty, useRealSun = false) {
  if (colonyStarting) return;
  colonyStarting = true;
  let sun = null;
  try {
    if (useRealSun) sun = await loadSunToday();
  } finally { colonyStarting = false; }
  modals.closeAll();
  const live = sun && sun.status === 'live';
  game = createGame({ mode: 'colony', seed: Date.now(), difficulty, economy: DEFAULT_ECONOMY,
    ...(live ? { liveFlares: sun.flares, liveWindowStart: sun.startDate } : {}) });
  if (useRealSun) toast(t(live ? (game.state.realSun && game.state.realSun.storms.length ? 'sun.gameLive' : 'sun.gameQuiet') : 'sun.gameArchive'));
  selected = null;
  if (view) view.setSelected(null);
  hud.reset();
  overShown = false;
  lastSpe = null;
  speed = 1;
  started = true;
  setLaunchScreen(false);
  writeSave(game);
  if (game.state.economy === 'craft') toast(t('craft.welcome'));
}

function resetStoryUi() { tracker.reset(); storyCard.reset(); guide = currentGuide(null); guideSig = '#reset'; }

function startStory(n, { skipIntro = false } = {}) {
  let g;
  try {
    g = createGame({ mode: 'story', chapter: n, seed: Date.now(), difficulty: 'cadet' });
    if (!g || !g.state || !g.state.story) throw new Error('core without story mode');
  } catch (e) {
    console.warn('Story mode unavailable.', e);
    toast(t('story.unavailable'));
    return;
  }
  modals.closeAll();
  game = g;
  selected = null;
  if (view) view.setSelected(null);
  hud.reset();
  resetStoryUi();
  overShown = false;
  lastSpe = null;
  speed = 1;
  started = false;
  const go = () => { started = true; speed = 1; setLaunchScreen(false); writeSave(game); };
  if (skipIntro) go(); else story.playScenes(sceneIds(n, 'intro'), { onDone: go });
}

function exitStory() {
  modals.closeAll();
  started = false;
  clearSave();
  resetStoryUi();
  modals.showStart();
}

function continueGame() {
  const o = readSave();
  try {
    if (!o) throw new Error('no save');
    const g = loadGame(o.data);
    modals.closeAll();
    game = g;
  } catch (e) {
    console.warn('Could not load the saved game.', e);
    clearSave();
    toast(t('ui.saveBroken'));
    modals.closeAll();
    modals.showStart();
    return;
  }
  selected = null;
  if (view) view.setSelected(null);
  hud.reset();
  resetStoryUi();
  overShown = false;
  lastSpe = game.state.env && game.state.env.spe ? game.state.env.spe : null;
  speed = 1;
  started = true;
  setLaunchScreen(false);
}

function openSite(id) {
  if (!started || game.state.over || demoOn()) return;
  if (!featureOn(game.state, 'expeditions')) { toast(t('err.locked')); return; }
  modals.showExpedition(id);
}

async function mountView() {
  const container = document.getElementById('view');
  const handlers = { onSlotClick: select, onSiteClick: openSite, onSlotContext: slotScience };
  if (!force2d) {
    try {
      const m = await import('./render3d/view3d.js');
      view = m.createView(container, handlers);
      viewKind = '3d';
      return;
    } catch (e) {
      console.warn('3D view unavailable, using 2D view.', e);
      container.replaceChildren();
    }
  }
  const m2 = await import('./render2d/view2d.js');
  view = m2.createView(container, handlers);
  viewKind = '2d';
  view.setSelected(selected);
}

async function fallbackTo2d(err) {
  console.warn('3D view failed, switching to 2D view.', err);
  try { view.dispose(); } catch (e) { /* ignore */ }
  view = null;
  document.getElementById('view').replaceChildren();
  const m2 = await import('./render2d/view2d.js');
  view = m2.createView(document.getElementById('view'), { onSlotClick: select, onSiteClick: openSite, onSlotContext: slotScience });
  viewKind = '2d';
  view.setSelected(selected);
}

const pausing = () => { if (settings.autoPause) setSpeed(0); };
function handleEvents(events, state) {
  for (const ev of events) {
    if (demoOn()) { // the demo answers its own decisions; only remember the flare and pass science panels on
      if (ev.type === 'event.start' && ev.kind === 'spe') lastSpe = { donkiId: ev.donkiId, classType: ev.classType, peakTime: ev.peakTime, link: ev.link };
      else if (ev.type === 'science.panel' && !String(ev.id).startsWith('over.')) demo.onScience(ev.id);
      continue;
    }
    switch (ev.type) {
      case 'sol.start':
        if (started) writeSave(game);
        break;
      case 'science.panel':
        if (!String(ev.id).startsWith('over.')) modals.showScience(ev.id, { spe: lastSpe || (state.env && state.env.spe) });
        break;
      case 'event.start':
        if (ev.kind === 'dustRegional' || ev.kind === 'dustGlobal') pausing();
        else if (ev.kind === 'spe') {
          lastSpe = { donkiId: ev.donkiId, classType: ev.classType, peakTime: ev.peakTime, link: ev.link };
          if (ev.phase === 'warning' || ev.phase === 'active') pausing();
        } else if (ev.kind === 'failure') { pausing(); toast(t('ev.toast.failure')); }
        else if (ev.kind === 'dustDevil') toast(t('ev.toast.dustDevil'));
        else if (ev.kind === 'marsquake') toast(t('ev.toast.marsquake'));
        break;
      case 'comm.blackout.start':
        pausing();
        toast(t('comm.started'));
        break;
      case 'comm.blackout.end':
        toast(t('comm.ended'));
        break;
      case 'event.end':
        if (ev.kind === 'spe') toast(t('ev.toast.speEnd', { n: Math.round((ev.maxDoseMsv || 0) * 10) / 10 }));
        else if (ev.kind === 'dustRegional' || ev.kind === 'dustGlobal') toast(t('ev.toast.stormEnd'));
        break;
      case 'ship.incoming':
        pausing();
        modals.showShipIncoming(ev.manifest, ev.arrivesAt);
        break;
      case 'ship.arrived':
        pausing();
        if (ev.offer || (state.ship && state.ship.awaitingDecision)) modals.showShipDecision();
        else {
          modals.showShip({
            cargo: ev.cargo,
            landedNames: (ev.landed || []).map((id) => (state.colonists.find((c) => c.id === id) || {}).name || String(id)),
            refused: ev.refused || [],
          });
        }
        break;
      case 'ship.landed':
        modals.showShipLanded({
          cargo: null,
          landedNames: (ev.landed || []).map((id) => (state.colonists.find((c) => c.id === id) || {}).name || String(id)),
          refused: ev.refused || [],
        });
        break;
      case 'tech.unlocked':
        toast(t('ev.toast.tech', { name: t('tech.' + ev.techId + '.name') }));
        break;
      case 'expedition.done':
        toast(t('ui.expDone', { c: Object.entries(ev.reward || {}).map(([k, n]) => n + ' ' + t('res.' + k).toLowerCase()).join(' + ') || '0' }));
        break;
      case 'expedition.stuck':
        toast(t('ui.expStuckToast'));
        break;
      case 'milestone':
        if (ev.id === 'selfSufficient') modals.showMilestone();
        else if (ev.id === 'dome') domeVictory(() => { setSpeed(1); modals.showMilestone('dome'); });
        break;
      case 'alert':
        if (ev.level === 'danger') pausing();
        break;
      case 'objective.done':
        toast('✓ ' + t('step.' + ev.id + '.title'));
        break;
      case 'story.complete':
        pausing();
        clearSave();
        story.onComplete(ev, state);
        break;
      case 'game.over':
        showOver(state);
        break;
      default:
    }
  }
}
function showOver(state) {
  if (overShown || demoOn()) return;
  overShown = true;
  clearSave();
  modals.showOver(state.over || { reason: 'noCrew', score: 0 }, state);
}

function updateGuide(s) {
  guide = currentGuide(s);
  const ids = guideSlots(s, guide);
  const sig = ids.join(',');
  if (view && sig !== guideSig) {
    guideSig = sig;
    if (view.setHighlight) { try { view.setHighlight(ids); } catch (e) { /* optional */ } }
  }
  const v = document.getElementById('view');
  v.classList.toggle('no-sites', !featureOn(s, 'expeditions'));
  v.classList.toggle('guide-sites', guide.hud.includes('sites'));
}

// ---- layout insets for the 3D view: pixels covered by HUD panels on each side
let insetSig = '';
function reportInsets() {
  if (!view || !view.setInsets) return;
  const W = window.innerWidth, H = window.innerHeight;
  const vis = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(n).display !== 'none' ? r : null; };
  let top = 0, right = 0, bottom = 0, left = 0;
  const tb = vis(topEl); if (tb) top = Math.max(top, tb.bottom);
  const sc = vis(storyCard.root); if (sc && sc.width > W * 0.6) top = Math.max(top, sc.bottom);
  for (const id of ['colonists-panel', 'alerts-panel']) { const r = vis(document.getElementById(id)); if (!r) continue; if (r.width > W * 0.6) bottom = Math.max(bottom, H - r.top); else left = Math.max(left, r.right); }
  const sp = vis(document.getElementById('slot-panel')); if (sp) { if (sp.width > W * 0.6) bottom = Math.max(bottom, H - sp.top); else right = Math.max(right, W - sp.left); }
  const tabs = vis(document.getElementById('sheet-tabs')); if (tabs) bottom = Math.max(bottom, H - tabs.top);
  const dock = vis(document.querySelector('.control-dock')); if (dock) bottom = Math.max(bottom, H - dock.top);
  if (document.body.classList.contains('is-launch')) {
    top = right = bottom = left = 0;
    const launch = vis(document.querySelector('.launch-modal'));
    if (launch && W >= 1000) left = Math.min(launch.right + 20, W * 0.48);
  }
  const o = { top: Math.round(top), right: Math.round(right), bottom: Math.round(bottom), left: Math.round(left) };
  const sig = [o.top, o.right, o.bottom, o.left].join(',');
  if (sig === insetSig) return;
  insetSig = sig;
  try { view.setInsets(o); } catch (e) { /* optional */ }
}
window.addEventListener('resize', () => { insetSig = ''; reportInsets(); });
setInterval(reportInsets, 400);

let last = performance.now();
function frame(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  try {
    const state = game.state;
    const eff = ctx.isHeld() ? 0 : speed;
    if (demoOn()) demo.update(dtReal);
    else if (eff > 0) game.tick((dtReal * eff) / TIME.SOL_REAL_SECONDS);
    const events = game.drainEvents();
    handleEvents(events, game.state);
    if (demoOn()) demo.onEvents(events);
    if (game.state.over && !overShown) showOver(game.state);
    const s = game.state;
    tracker.update(s);
    if (started) updateGuide(s);
    storyCard.update(s, started && !s.over);
    hud.update(s, events);
    slotPanel.update(s);
    colPanel.update(s);
    modals.update(s);
    if (view) {
      try { view.update(s, events, dtReal); } catch (e) {
        if (viewKind === '3d') { viewKind = 'switching'; fallbackTo2d(e); } else console.error(e);
      }
    }
  } catch (e) {
    console.error(e);
  }
  requestAnimationFrame(frame);
}

// keyboard
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (modals.isOpen() || demoOn()) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (e.repeat) return;
    setSpeed(speed > 0 ? 0 : (window.__lastSpeed || 1));
  } else if (e.key === 'Escape') {
    if (started && !game.state.over) modals.showPause();
  } else if (e.key === 'b' || e.key === 'B' || e.key === 'Home') {
    if (started && view && view.resetCamera) view.resetCamera();
  } else if (e.key === 'v' || e.key === 'V') {
    if (started && !game.state.over) modals.showInventory();
  } else if (e.key === 'p' || e.key === 'P') {
    if (started && !game.state.over) modals.showCraft();
  } else if (e.key === '1' || e.key === '2' || e.key === '3') {
    setSpeed([1, 2, 4][Number(e.key) - 1]);
  }
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space' && !modals.isOpen()) e.preventDefault(); });
// remember last non-zero speed for the Space toggle
setInterval(() => { if (speed > 0) window.__lastSpeed = speed; }, 100);

const topEl = document.getElementById('topbar');
if (window.ResizeObserver) new ResizeObserver(() => document.documentElement.style.setProperty('--top-h', topEl.offsetHeight + 'px')).observe(topEl);
applyStatic();
loadSunToday();
onLangChange(() => { applyStatic(); document.title = t('ui.title'); });
const demoParam = new URLSearchParams(location.search).get('demo'); // 1 = presenter (pauses at each beat), auto = timed show
if (demoParam === '1' || demoParam === 'manual' || demoParam === 'auto') startDemo(demoParam === 'auto' ? 'auto' : 'presenter'); else modals.showStart();
mountView().catch((e) => console.error(e));
requestAnimationFrame(frame);
