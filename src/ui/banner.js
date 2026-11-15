import { t, getLang } from '../i18n/i18n.js';
import { el, setText, setAttr, fmt, fmtDate } from './util.js';
import { SOL_HOURS } from '../data/constants.js';
import { speWarningSols } from '../sim/selectors.js';

/** Event banner (dust storm, solar storm, sheltering note, ship offer). Built once, updated per frame. */
export function createBanner(ctx) {
  const root = el('div', { class: 'banner' });

  // dust storm
  const dustTitle = el('strong', {});
  const dustInfo = el('span', { class: 'num' });
  const dust = el('div', { class: 'banner-item dust', role: 'status' }, dustTitle, dustInfo);

  // solar storm
  const speMain = el('strong', {});
  const speReal = el('span', { class: 'small' });
  const speLink = el('a', { href: '#', target: '_blank', rel: 'noopener noreferrer' });
  const speBtn = el('button', { type: 'button', class: 'btn btn-danger btn-big', onclick: () => ctx.act({ type: 'setShelter', on: true }) });
  const spe = el('div', { class: 'banner-item spe', role: 'alert' },
    el('div', { class: 'banner-text' }, speMain, el('div', {}, speReal, ' ', speLink)), speBtn);

  // sheltering
  const shNote = el('span', {});
  const shBtn = el('button', { type: 'button', class: 'btn', onclick: () => ctx.act({ type: 'setShelter', on: false }) });
  const shelter = el('div', { class: 'banner-item sheltering', role: 'status' }, shNote, shBtn);

  // ship offer waiting
  const shipNote = el('span', {});
  const shipBtn = el('button', { type: 'button', class: 'btn btn-primary', onclick: () => ctx.openShipDecision() });
  const ship = el('div', { class: 'banner-item shipwait' }, shipNote, shipBtn);

  const comm = el('div', { class: 'banner-item comm-blackout', role: 'status' });
  const realSun = el('div', { class: 'banner-item real-sun', role: 'status' });
  root.append(dust, spe, shelter, ship, comm, realSun);
  const hide = (n, h) => { if (n.hidden !== h) n.hidden = h; };

  function timeText(sols) {
    const h = Math.max(0, sols) * SOL_HOURS;
    if (h >= 24) return t('ev.timeSols', { n: fmt(h / SOL_HOURS, 1) });
    return h < 1 ? t('ev.timeMin', { n: Math.max(1, Math.round(h * 60)) }) : t('ev.timeH', { n: fmt(h, 1) });
  }

  function update(state) {
    const env = state.env || {};
    const st = env.storm;
    hide(dust, !st);
    if (st) {
      setText(dustTitle, t(st.kind === 'global' ? 'ev.dustGlobal' : 'ev.dustRegional'));
      setText(dustInfo, t('ev.endsIn', { n: fmt(Math.max(0, st.endsAt - state.t), 1) }) + ' ' + t('ev.tauNow', { n: fmt(env.tau, 1) }));
    }
    const sp = env.spe;
    const sheltering = !!state.sheltering;
    hide(spe, !sp);
    if (sp) {
      const warn = sp.phase === 'warning';
      setText(speMain, warn ? t('ev.spe.warning', { t: timeText(sp.startsAt - state.t) }) : t('ev.spe.active', { t: timeText(sp.endsAt - state.t) }));
      setText(speReal, (sp.live ? t('sun.eventLive') + ' · ' : '') + t('ui.basedOnReal', { date: fmtDate(sp.peakTime), cls: sp.classType }));
      if (sp.link) { setAttr(speLink, 'href', sp.link); setText(speLink, t('ev.spe.link')); hide(speLink, false); } else hide(speLink, true);
      setText(speBtn, t('ev.shelterAll'));
      hide(speBtn, sheltering || !ctx.featureOn('shelter'));
      spe.classList.toggle('warning', warn);
    }
    hide(shelter, !sheltering);
    if (sheltering) { setText(shNote, t('ev.sheltered')); setText(shBtn, t('ev.release')); }
    const wait = !!(state.ship && state.ship.awaitingDecision);
    hide(ship, !wait);
    if (wait) { setText(shipNote, t('ev.decide')); setText(shipBtn, t('ev.decideBtn')); }
    hide(comm, !env.comm?.blackout);
    if (env.comm?.blackout) setText(comm, t('comm.banner', { n: fmt(Math.max(0, env.comm.blackoutEndsAt - state.t), 1), w: fmt(speWarningSols(state), 2) }));
    hide(realSun, !state.realSun);
    if (state.realSun) setText(realSun, t(state.t >= 35 ? 'sun.windowEnded' : state.realSun.storms.length ? 'sun.windowStorms' : 'sun.windowQuiet', { n: state.realSun.storms.length }));
    void getLang;
  }
  return { root, update };
}
