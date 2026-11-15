import { t, getLang } from '../i18n/i18n.js';
import { el, icon, setText, setAttr, setCls, fmt, fmtSigned, pad2, langToggle } from './util.js';
import { getSol, getHour, capacity, autonomy, netPerSol, population, speWarningSols } from '../sim/selectors.js';
import { SCIENCE_PANELS } from '../data/sciencePanels.js';
import { createBanner } from './banner.js';
import { colonyProgress } from './progress.js';

const MAIN = ['energy', 'o2', 'water', 'food'];
const MARK = { ok: '●', warn: '▲', danger: '■' };
const TOTAL_PANELS = Object.keys(SCIENCE_PANELS).length;
const NARROW = '(max-width: 819px)';

export function createHud(ctx) {
  const hudEl = document.getElementById('hud');
  const top = document.getElementById('topbar');
  const alertsBody = document.querySelector('#alerts-panel .panel-body');
  let log = [];
  let logSig = '';

  // ---- row 1: brand + four main resources (icon, value, net/autonomy line)
  const res = {};
  const mainWrap = el('div', { class: 'res-main', role: 'list' });
  for (const k of MAIN) {
    const r = {
      root: el('div', { class: 'res res-' + k + ' ok', role: 'listitem' }),
      label: el('span', { class: 'res-label' }),
      stock: el('span', { class: 'res-stock num' }),
      unit: el('span', { class: 'res-unit num lbl-wide' }),
      net: el('span', { class: 'res-net num' }),
      auto: el('span', { class: 'res-auto num' }),
      state: el('span', { class: 'res-state', 'aria-hidden': 'true' }),
    };
    r.root.append(
      el('div', { class: 'res-heading' }, icon(k), r.label, r.state),
      el('div', { class: 'res-row' }, el('span', { class: 'res-val' }, r.stock, r.unit)),
      el('div', { class: 'res-sub' }, r.net, r.auto),
    );
    res[k] = r;
    mainWrap.append(r.root);
  }
  const brandText = el('span', { class: 'brand-name' });
  const brand = el('div', { class: 'brand lbl-wide' }, el('span', { class: 'brand-orbit', 'aria-hidden': 'true' }), brandText);
  const row1 = el('div', { class: 'top-row top-res' }, brand, mainWrap);

  // ---- row 2: status chips, secondary resources, shelter toggle, controls
  const subs = {};
  const subWrap = el('div', { class: 'res-secondary' });
  for (const k of ['regolith', 'parts', 'science']) {
    subs[k] = { label: el('span', { class: 'sub-label lbl-wide' }), val: el('span', { class: 'num' }) };
    subs[k].root = el('span', { class: 'chip chip-res' }, icon(k), subs[k].label, subs[k].val);
    subWrap.append(subs[k].root);
  }
  const c = {
    time: el('span', { class: 'chip chip-strong num' }),
    pop: el('span', { class: 'chip num' }),
    shipTxt: el('span', { class: 'num' }),
    shipShort: el('span', { class: 'num lbl-short' }),
    delay: el('span', { class: 'chip num lbl-wide' }),
  };
  c.popTxt = el('span', { class: 'num' });
  c.pop.append(icon('pop'), c.popTxt);
  c.timeTxt = el('span', {});
  c.dayGlyph = el('span', { class: 'day-glyph', 'aria-hidden': 'true' });
  c.time.append(c.timeTxt, c.dayGlyph);
  c.ship = el('button', { type: 'button', class: 'chip chip-btn', onclick: () => ctx.openShip() }, icon('ship'), c.shipTxt, c.shipShort);
  c.ship.querySelector('.num').classList.add('lbl-wide');
  const chipWrap = el('div', { class: 'status-chips' }, c.time, c.pop, c.ship, c.delay);

  const speedBtns = [0, 1, 2, 4].map((s) => el('button', {
    type: 'button', class: 'seg-btn', 'data-speed': s, onclick: () => ctx.setSpeed(s),
  }, s === 0 ? '' : s + 'x'));
  const speedSeg = el('div', { class: 'seg', role: 'group' }, speedBtns);
  const pausedTag = el('span', { class: 'paused-tag lbl-wide' });
  const shelterTxt = el('span', { class: 'lbl-wide' });
  const shelterBtn = el('button', {
    type: 'button', class: 'btn btn-shelter', 'aria-pressed': 'false',
    onclick: () => ctx.act({ type: 'setShelter', on: !ctx.getState().sheltering }),
  }, icon('shelter'), shelterTxt);
  const notebookBtn = el('button', { type: 'button', class: 'btn', onclick: () => ctx.openNotebook() });
  const helpBtn = el('button', { type: 'button', class: 'btn btn-advisor', onclick: () => ctx.openHelp() });
  const techBtn = el('button', { type: 'button', class: 'btn', onclick: () => ctx.openTech() });
  const glossBtn = el('button', { type: 'button', class: 'btn btn-round', onclick: () => ctx.openGlossary() }, '?');
  const infoBtn = el('button', { type: 'button', class: 'btn btn-round info-btn', onclick: () => ctx.openInfo() }, 'i');
  row1.append(infoBtn);
  const progBtn = el('button', { type: 'button', class: 'colony-bar', onclick: () => ctx.openProgress() });
  const progTxt = el('span', { class: 'cb-txt num' });
  const progFill = el('i');
  progBtn.append(progTxt, el('span', { class: 'cb-track', 'aria-hidden': 'true' }, progFill));
  const progMenu = el('button', { type: 'button', class: 'btn prog-menu', onclick: () => ctx.openProgress() });
  const dataBtn = el('button', { type: 'button', class: 'btn', onclick: () => ctx.openNasaData() });
  const lang = langToggle();
  const menuBtn = el('button', { type: 'button', class: 'btn btn-round menu-btn', 'aria-expanded': 'false', 'aria-haspopup': 'true' }, icon('menu'));
  const menu = el('div', { class: 'menu-pop', hidden: true });
  const controls = el('div', { class: 'controls' });
  const collapsible = [lang, notebookBtn, dataBtn, progMenu, glossBtn];
  const row2 = el('div', { class: 'top-row top-ctl' }, chipWrap, subWrap, el('div', { class: 'top-right' }, shelterBtn, speedSeg, pausedTag, controls, menuBtn));

  function setMenu(open) {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
  }
  menuBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
  menu.addEventListener('click', (e) => { if (e.target.closest('button') && !e.target.closest('.lang-toggle')) setMenu(false); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });

  const mq = window.matchMedia ? window.matchMedia(NARROW) : { matches: false, addEventListener() {} };
  function placeControls() {
    setMenu(false);
    collapsible.forEach((n) => menu.append(n));
    const target = mq.matches ? menu : controls;
    [helpBtn, techBtn].forEach((n) => target.append(n));
  }
  if (mq.addEventListener) mq.addEventListener('change', placeControls); else if (mq.addListener) mq.addListener(placeControls);
  placeControls();

  const banner = createBanner(ctx);
  top.append(row1, row2, progBtn, banner.root, menu);

  // ---- tabs (phone)
  const tabs = [...document.querySelectorAll('#sheet-tabs [data-tab]')];
  tabs.forEach((b) => b.addEventListener('click', () => showTab(hudEl.dataset.tab === b.dataset.tab ? '' : b.dataset.tab)));
  function showTab(name) {
    hudEl.dataset.tab = name;
    tabs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === name)));
  }

  // ---- auto-pause setting checkbox
  const cb = el('input', { type: 'checkbox', id: 'autopause' });
  cb.checked = ctx.settings.autoPause;
  cb.addEventListener('change', () => ctx.setAutoPause(cb.checked));
  const cbLabel = el('label', { for: 'autopause' });
  const settingRow = el('div', { class: 'setting-row' }, cb, cbLabel);
  const alertList = el('ol', { class: 'alert-list' });
  alertsBody.append(alertList, settingRow);

  function renderAlerts() {
    const sig = log.map((a) => a.sol + a.key + a.level).join('|') + getLang();
    if (sig === logSig) return;
    logSig = sig;
    alertList.replaceChildren(...(log.length
      ? log.map((a) => el('li', { class: 'alert alert-' + a.level },
        el('span', { class: 'alert-sol num' }, t('ui.alertSol', { n: a.sol })),
        el('span', { class: 'alert-tag' }, t('ui.state.' + (a.level === 'danger' ? 'danger' : 'warn'))),
        el('span', { class: 'alert-text' }, t(a.key))))
      : [el('li', { class: 'muted' }, t('ui.noAlerts'))]));
  }

  function logEvent(ev) {
    let key = null;
    if (ev.type === 'alert') { log.unshift({ sol: Math.floor(ev.t) + 1, key: ev.key, level: ev.level }); }
    else if (ev.type === 'event.start') {
      if (ev.kind === 'dustRegional') key = 'ev.log.dustRegional';
      else if (ev.kind === 'dustGlobal') key = 'ev.log.dustGlobal';
      else if (ev.kind === 'spe' && ev.phase === 'warning') key = 'ev.log.spe';
      else if (ev.kind === 'failure') key = 'ev.log.failure';
      if (key) log.unshift({ sol: Math.floor(ev.t) + 1, key, level: 'warn' });
    }
    log = log.slice(0, 6);
  }

  function update(state, events) {
    for (const ev of events) logEvent(ev);
    renderAlerts();

    setText(brandText, t('ui.title'));
    const cap = capacity(state);
    const au = autonomy(state);
    const net = netPerSol(state);
    for (const k of MAIN) {
      const r = res[k];
      const stock = state.resources[k];
      const a = au[k];
      let st = 'ok';
      if (stock <= 0.0001) st = 'danger';
      else if (Number.isFinite(a) && a < 2) st = 'warn';
      setText(r.label, t('res.' + k));
      setText(r.stock, fmt(stock, k === 'energy' ? 0 : 1));
      setText(r.unit, k === 'energy' ? ' / ' + fmt(cap.energy, 0) + ' kWh' : ' kg');
      setText(r.net, t('ui.perSolShort', { n: fmtSigned(net[k], 1) }));
      setText(r.auto, stock <= 0.0001 ? t('ui.empty') : Number.isFinite(a) ? t('ui.lastsShort', { n: fmt(a, 1) }) : '');
      setText(r.state, MARK[st]);
      setCls(r.root, 'ok', st === 'ok'); setCls(r.root, 'warn', st === 'warn'); setCls(r.root, 'danger', st === 'danger');
      setAttr(r.root, 'aria-label', t('res.' + k) + ': ' + fmt(stock, 1) + ', ' + t('ui.state.' + st) + ', ' + t('ui.perSol', { n: fmtSigned(net[k], 1) })
        + (Number.isFinite(a) ? ', ' + t('ui.lasts', { n: fmt(a, 1) }) : ''));
      setAttr(r.root, 'title', t('res.' + k) + (k === 'energy' ? ' (' + t('ui.tipKwh') + ')' : ''));
    }
    for (const k of ['regolith', 'parts', 'science']) {
      setText(subs[k].label, t('res.' + k));
      setText(subs[k].val, fmt(state.resources[k], 0));
      setAttr(subs[k].root, 'title', t('res.' + k + 'Short'));
      setAttr(subs[k].root, 'aria-label', t('res.' + k) + ': ' + fmt(state.resources[k], 0));
    }
    const hr = getHour(state);
    const h = Math.floor(hr);
    setText(c.timeTxt, t('ui.sol', { n: getSol(state) }) + ' · ' + pad2(h) + ':' + pad2(Math.min(59, Math.floor((hr - h) * 60))));
    const day = state.env.sun > 0.02;
    setText(c.dayGlyph, day ? '☀' : '☾');
    setAttr(c.time, 'aria-label', t('ui.sol', { n: getSol(state) }) + ', ' + pad2(h) + ':' + pad2(Math.min(59, Math.floor((hr - h) * 60))) + ', ' + t(day ? 'ui.day' : 'ui.night'));
    setAttr(c.time, 'title', t('ui.tipSol') + ' ' + t('ui.clock') + '. ' + t('ui.dayTitle') + ': ' + t(day ? 'ui.day' : 'ui.night'));
    setCls(c.time, 'is-night', !day);
    setText(c.popTxt, population(state) + '/' + cap.crew);
    setAttr(c.pop, 'title', t('ui.popTitle'));
    setAttr(c.pop, 'aria-label', t('ui.pop', { n: population(state), max: cap.crew }));
    const shipN = fmt(Math.max(0, Math.ceil(state.ship.nextArrivalT - state.t)), 0);
    setText(c.shipTxt, t('ui.shipIn', { n: shipN }));
    setText(c.shipShort, shipN);
    setAttr(c.ship, 'title', t('ui.shipChipTitle'));
    setAttr(c.ship, 'aria-label', t('ui.shipIn', { n: shipN }));
    const blackout = !!state.env.comm?.blackout;
    setText(c.delay, t(blackout ? 'comm.noContact' : 'ui.delay', { n: fmt(state.env.commDelayMin, 0) }));
    setAttr(c.delay, 'title', t('comm.expeditionWarning', { n: fmt(speWarningSols(state), 2) }));
    setCls(c.delay, 'comm-blackout', blackout);

    const sp = ctx.getSpeed();
    const effPaused = ctx.isHeld();
    speedBtns.forEach((b) => {
      const s = Number(b.dataset.speed);
      if (s === 0) setText(b, '❚❚');
      setAttr(b, 'aria-pressed', sp === s);
      setAttr(b, 'aria-label', t('ui.speed' + s));
      setAttr(b, 'title', t('ui.speed' + s));
    });
    setAttr(speedSeg, 'aria-label', t('ui.speedLabel'));
    setText(pausedTag, effPaused && sp > 0 ? t('ui.paused') : '');

    const sh = !!state.sheltering;
    setText(shelterTxt, t('ui.shelterBtn'));
    setAttr(shelterBtn, 'aria-pressed', sh);
    setAttr(shelterBtn, 'aria-label', t('ui.shelterBtn') + ': ' + t(sh ? 'ui.shelterTitleOff' : 'ui.shelterTitle'));
    setAttr(shelterBtn, 'title', t(sh ? 'ui.shelterTitleOff' : 'ui.shelterTitle'));

    const seen = state.stats.panelsSeen.length;
    setText(notebookBtn, t('ui.notebook') + ' ' + t('ui.notebookCount', { n: seen, total: TOTAL_PANELS }));
    setText(helpBtn, t('ui.help'));
    setText(techBtn, t('ui.tech'));
    setText(dataBtn, t('data.title'));
    const cp = colonyProgress(state);
    const showProg = !state.story;
    progBtn.hidden = !showProg; progMenu.hidden = !showProg;
    setText(progTxt, t('prog.short', { n: cp.pct }));
    setText(progMenu, t('prog.title') + ' · ' + cp.pct + '%');
    progFill.style.width = cp.pct + '%';
    setAttr(progBtn, 'title', t('prog.title'));
    setAttr(progBtn, 'aria-label', t('prog.title') + ': ' + cp.pct + '%');
    setAttr(infoBtn, 'aria-label', t('info.title'));
    setAttr(infoBtn, 'title', t('info.title'));
    techBtn.hidden = !ctx.featureOn('tech');
    shelterBtn.hidden = !ctx.featureOn('shelter');
    c.ship.hidden = !ctx.featureOn('ships');
    const guide = ctx.getGuide();
    for (const [node, target] of [[techBtn, 'tech'], [c.ship, 'ship'], [shelterBtn, 'shelter'], [speedSeg, 'speed']]) {
      setCls(node, 'guide-target', guide.hud.includes(target));
    }
    setAttr(glossBtn, 'aria-label', t('ui.glossaryBtn'));
    setAttr(glossBtn, 'title', t('ui.glossaryBtn'));
    setAttr(menuBtn, 'aria-label', t('ui.menu'));
    setAttr(menuBtn, 'title', t('ui.menu'));
    setText(cbLabel, t('ui.autoPause'));
    setAttr(top, 'aria-label', t('ui.hud'));
    banner.update(state);
  }

  function reset() { log = []; logSig = ''; showTab(''); }
  showTab('');

  return { update, showTab, reset };
}
