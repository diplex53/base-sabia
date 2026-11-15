import { t } from '../i18n/i18n.js';
import { el, icon, setText, setAttr, setCls, setWidth, fmt } from './util.js';
import * as SEL from '../sim/selectors.js';
import { MODULES } from '../data/balance.js';

/** Dome state from the slots: { kind: 'none'|'building'|'done', progress } or null when the core has no dome. */
export function domeInfo(state) {
  if (!MODULES || !MODULES.dome) return null;
  const slot = (state.slots || []).find((s) => s.module && s.module.type === 'dome');
  if (!slot) return { kind: 'none', progress: 0 };
  const m = slot.module;
  if (m.status === 'building') return { kind: 'building', progress: m.progress || 0 };
  return { kind: 'done', progress: 1 };
}

export function cityAvailable(state) {
  return typeof SEL.cityStats === 'function' && !!state;
}

function stats(state) {
  try { return typeof SEL.cityStats === 'function' ? SEL.cityStats(state) : null; } catch (e) { return null; }
}

/** The "City" panel body, built from selectors.cityStats when the core provides it. */
export function createCity(root, ctx) {
  const body = root.querySelector('.panel-body');
  const row = (labelEl, valueEl, bar) => el('div', { class: 'city-row' }, el('div', { class: 'city-line' }, labelEl, valueEl), bar || null);
  const mkBar = (cls) => { const i = el('i'); return { i, node: el('div', { class: 'bar ' + (cls || ''), role: 'presentation' }, i) }; };

  const popL = el('span', {}); const popV = el('strong', { class: 'num' });
  const hpL = el('span', {}); const hpV = el('strong', { class: 'num' }); const hpB = mkBar('health');
  const pwL = el('span', {}); const pwV = el('strong', { class: 'num' });
  const stL = el('h3', { class: 'city-h' });
  const st = {};
  const stWrap = el('div', { class: 'city-storage' });
  for (const k of ['o2', 'water', 'food']) {
    st[k] = { l: el('span', {}), v: el('span', { class: 'num' }), b: mkBar('stock-' + k) };
    stWrap.append(el('div', { class: 'city-row' }, el('div', { class: 'city-line' }, st[k].l, st[k].v), st[k].b.node));
  }
  const modL = el('span', {}); const modV = el('strong', { class: 'num' });
  const tecL = el('span', {}); const tecV = el('strong', { class: 'num' });

  const domeH = el('h3', { class: 'city-h' });
  const domeList = el('ul', { class: 'dome-list' });
  const domeItems = [el('li', {}), el('li', {}), el('li', {})];
  domeList.append(...domeItems);
  const domeTxt = el('p', { class: 'small num' });
  const domeB = mkBar('dome');
  const domeBox = el('div', { class: 'city-dome' }, domeH, domeList, domeTxt, domeB.node);

  body.append(
    row(popL, popV), row(hpL, hpV, hpB.node), row(pwL, pwV),
    stL, stWrap, row(modL, modV), row(tecL, tecV), domeBox);

  const mark = (ok) => (ok ? '✓ ' : '○ ');

  function update(state) {
    const cs = stats(state);
    root.dataset.has = cs ? '1' : '';
    if (!cs) return false;
    setText(popL, t('ui.city.pop')); setText(popV, cs.population + ' / ' + cs.crewCapacity);
    setText(hpL, t('ui.city.health'));
    const hp = cs.health != null ? cs.health : state.health;
    const hasHp = hp != null;
    hpB.node.parentElement.hidden = !hasHp;
    if (hasHp) { setText(hpV, fmt(hp, 0) + ' / 100'); setWidth(hpB.i, hp); setCls(hpB.node, 'low', hp < 50); }
    setText(pwL, t('ui.city.power'));
    setText(pwV, t('ui.city.powerVal', { gen: fmt(cs.powerGen || 0, 0), use: fmt(cs.powerUse || 0, 0) }));
    setText(stL, t('ui.city.storage'));
    for (const k of ['o2', 'water', 'food']) {
      const s = cs.storage && cs.storage[k];
      st[k].b.node.parentElement.hidden = !s;
      if (!s) continue;
      setText(st[k].l, t('res.' + k));
      setText(st[k].v, t('ui.storageOf', { a: fmt(s.amount, 0), c: fmt(s.cap, 0) }) + ' kg');
      setWidth(st[k].b.i, s.cap > 0 ? (s.amount / s.cap) * 100 : 0);
    }
    setText(modL, t('ui.city.modules')); setText(modV, String(cs.modules));
    setText(tecL, t('ui.city.techs')); setText(tecV, String(cs.techs));

    const d = domeInfo(state);
    domeBox.hidden = !d;
    if (d) {
      setText(domeH, t('ui.dome.title'));
      const cost = (MODULES.dome.levels && MODULES.dome.levels[0] && MODULES.dome.levels[0].cost) || { parts: 300, regolith: 400 };
      const techOk = !!(state.tech && state.tech.unlocked && state.tech.unlocked.includes('domeEngineering'));
      const parts = state.resources.parts || 0, reg = state.resources.regolith || 0;
      domeList.hidden = d.kind !== 'none';
      if (d.kind === 'none') {
        setText(domeItems[0], mark(techOk) + t('ui.dome.tech'));
        setText(domeItems[1], mark(parts >= (cost.parts || 0)) + t('ui.dome.parts', { n: fmt(parts, 0), max: fmt(cost.parts || 0, 0) }));
        setText(domeItems[2], mark(reg >= (cost.regolith || 0)) + t('ui.dome.regolith', { n: fmt(reg, 0), max: fmt(cost.regolith || 0, 0) }));
      }
      const pct = Math.round(d.progress * 100);
      domeB.node.hidden = d.kind === 'none';
      setWidth(domeB.i, pct);
      setText(domeTxt, d.kind === 'done' ? '✓ ' + t('ui.dome.done') : d.kind === 'building' ? t('ui.dome.building', { n: pct }) : '');
      setAttr(domeBox, 'data-kind', d.kind);
    }
    return true;
  }
  return { update };
}
