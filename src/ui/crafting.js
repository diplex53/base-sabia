// Inventory (V) and crafting (P) screens. Live modals opened from modals.js; all their code lives here.
import { t } from '../i18n/i18n.js';
import { el, fmt, tOr } from './util.js';
import * as sel from '../sim/selectors.js';
import { ORES, ITEMS, KITS } from '../data/crafting.js';
import { invGet } from '../sim/crafting.js';

const RES_ORES = ['regolith', 'water', 'methane'];
export const invName = (k) => tOr('inv.' + k, k);
const n0 = (v) => fmt(Math.floor((v || 0) + 1e-9), 0);

function head(title, close) {
  return el('div', { class: 'craft-head' }, el('h2', {}, title),
    el('button', { type: 'button', class: 'btn btn-round craft-x', 'aria-label': t('ui.close'), title: t('ui.close'), onclick: close }, '×'));
}

function invGroup(state, titleKey, keys, showZero) {
  const cells = keys.map((k) => ({ k, v: invGet(state, k) })).filter((c) => showZero || c.v >= 1);
  return el('section', { class: 'inv-group' }, el('h3', {}, t(titleKey)),
    cells.length ? el('ul', { class: 'inv-grid' }, cells.map((c) => el('li', { class: 'inv-cell' + (c.v >= 1 ? '' : ' is-zero') },
      el('span', { class: 'inv-name' }, invName(c.k)), el('strong', { class: 'inv-num num' }, n0(c.v))))) : el('p', { class: 'muted small' }, '-'));
}

/** Inventory screen: every ore, item and kit; zero counts dimmed. */
export function inventoryNodes(mm, ctx, close) {
  const s = ctx.getState();
  return [
    head(t('inv.title'), close),
    el('p', { class: 'small muted' }, t('inv.hint')),
    invGroup(s, 'inv.ores', [...RES_ORES, ...ORES], true),
    invGroup(s, 'inv.items', ITEMS, true),
    invGroup(s, 'inv.kits', KITS, true),
  ];
}

export function inventorySig(state) {
  return [...RES_ORES, ...ORES, ...ITEMS, ...KITS].map((k) => Math.floor(invGet(state, k) + 1e-9)).join(',');
}

function recipeRow(state, o, ctx) {
  const ins = Object.entries(o.in).map(([k, n]) => {
    const have = invGet(state, k);
    return el('li', { class: 'cr-in' + (have >= n - 1e-9 ? '' : ' is-missing') }, el('span', {}, invName(k)), ' ', el('span', { class: 'num' }, t('craft.have', { have: n0(have), need: n })));
  });
  const outs = Object.entries(o.out).map(([k, n]) => el('li', { class: 'cr-out' }, el('strong', {}, (n > 1 ? n + ' x ' : '') + invName(k))));
  const title = tOr('recipe.' + o.id, ''); // named processes (e.g. sifting regolith); plain recipes are named by their output
  return el('li', { class: 'cr-row' + (o.ok ? ' is-ok' : '') },
    title ? el('p', { class: 'cr-title' }, el('strong', {}, title)) : null,
    el('ul', { class: 'cr-ins' }, ins),
    el('span', { class: 'cr-arrow', 'aria-hidden': 'true' }, '→'),
    el('ul', { class: 'cr-outs' }, outs),
    el('div', { class: 'cr-act' },
      el('button', { type: 'button', class: 'btn btn-primary', 'data-fid': 'craft-' + o.id, disabled: !o.ok,
        onclick: () => { const r = ctx.act({ type: 'craft', recipeId: o.id }); if (r && r.ok) ctx.toastCraft && ctx.toastCraft(title || invName(Object.keys(o.out)[0])); } }, t('craft.do')),
      o.ok ? null : el('p', { class: 'reason small' }, t(o.reason || 'err.missingIngredients'))));
}

/** Crafting screen: inventory strip, then table and builder recipes. */
export function craftNodes(mm, ctx, close) {
  const s = ctx.getState();
  const opts = sel.craftOptions(s);
  const inv = sel.inventory(s);
  const strip = Object.keys(inv).map((k) => el('li', {}, invName(k) + ' ', el('strong', { class: 'num' }, n0(inv[k]))));
  const section = (station, titleKey, noKey) => {
    const list = opts.filter((o) => o.station === station);
    const stationOk = list.length ? list[0].stationOk : false;
    return el('section', { class: 'cr-sec' }, el('h3', {}, t(titleKey)),
      stationOk ? null : el('p', { class: 'cr-notice' }, t(noKey)),
      el('ul', { class: 'cr-list' }, list.map((o) => recipeRow(s, o, ctx))));
  };
  return [
    head(t('craft.title'), close),
    el('ul', { class: 'inv-strip' }, strip.length ? strip : el('li', { class: 'muted' }, '-')),
    section('table', 'craft.table', 'craft.noTable'),
    section('builder', 'craft.builder', 'craft.noBuilder'),
  ];
}

export function craftSig(state) {
  return inventorySig(state) + '|' + sel.craftOptions(state).map((o) => (o.ok ? 1 : 0) + (o.stationOk ? 1 : 0)).join('');
}
