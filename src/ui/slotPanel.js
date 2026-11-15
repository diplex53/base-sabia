import { t, getLang } from '../i18n/i18n.js';
import { el, icon, tOr, setText, setWidth, fmt, moduleStatusKey, STATUS_MARK, costText } from './util.js';
import { moduleRates, buildOptions, upgradeInfo } from '../sim/selectors.js';
import { MODULES } from '../data/balance.js';
import { moduleHidden } from './storyGuide.js';

// Repair cost comes from the core (EVENTS.failure.repairParts); the module may not exist yet.
let REPAIR_PARTS = 3;
import('../sim/events.js').then((m) => { if (m && m.EVENTS && m.EVENTS.failure) REPAIR_PARTS = m.EVENTS.failure.repairParts || 3; }).catch(() => {});

const LINES = {
  habitat: ['use'], solar: ['gen'], battery: [], moxie: ['use', 'o2'], extractor: ['use', 'water'],
  greenhouse: ['use', 'food'], shelter: [], reactor: ['gen'],
};
const MODULE_ICONS = { habitat: 'pop', solar: 'energy', battery: 'energy', moxie: 'o2', extractor: 'water', greenhouse: 'food', shelter: 'shelter', reactor: 'tech',
  gym: 'pop', hospital: 'pop', thermal: 'energy', pressurizer: 'o2', waterFilter: 'water', decon: 'shelter', warehouse: 'regolith',
  factory: 'parts', sabatier: 'energy', mine: 'regolith', dome: 'shelter', radShield: 'shelter' };
const SECTIONS = [
  ['energy', ['solar', 'battery', 'reactor', 'sabatier', 'thermal']],
  ['life', ['habitat', 'moxie', 'extractor', 'greenhouse', 'waterFilter', 'pressurizer']],
  ['production', ['factory', 'mine', 'warehouse']],
  ['protection', ['shelter', 'decon', 'dome', 'radShield']],
  ['wellbeing', ['gym', 'hospital']],
];

export function createSlotPanel(root, ctx) {
  const body = root.querySelector('.panel-body');
  let sig = null;
  let refs = {};
  let confirm = false;
  let lastSel = null;
  let cache = {};

  function rebuild(fn) {
    const a = document.activeElement;
    const fid = a && body.contains(a) ? a.dataset.fid : null;
    refs = {};
    body.replaceChildren(...fn());
    if (fid) { const n = body.querySelector(`[data-fid="${fid}"]`); if (n && !n.disabled) n.focus(); }
  }
  const act = (action) => { const r = ctx.act(action); sig = null; return r; };
  const modName = (type) => tOr('mod.' + type + '.name', type);
  const modDesc = (type) => tOr('mod.' + type + '.desc', '');
  const modScience = (type) => {
    const s = tOr('mod.' + type + '.science', '');
    if (!s) return null;
    return el('div', { class: 'opt-science' }, el('h5', { class: 'opt-science-h' }, tOr('ui.scienceLabel', 'Science')), el('p', { class: 'opt-science-p' }, s));
  };

  function viewNone() {
    return [el('div', { class: 'inspector-empty' }, el('span', { class: 'empty-cross', 'aria-hidden': 'true' }, '+'), el('p', { class: 'muted' }, t('ui.noSlot')))];
  }

  // ---- build menu pop-up (self-contained overlay) ----
  let pop = null;
  function closePopup() {
    if (!pop) return;
    window.removeEventListener('keydown', pop.onKey, true);
    pop.back.remove();
    pop = null;
  }
  function dismissPopup() {
    closePopup();
    if (ctx.clearSelection) ctx.clearSelection();
  }
  function ensurePopup() {
    if (pop) return;
    const title = el('h2', { id: 'build-menu-title', class: 'build-menu-title' });
    const closeBtn = el('button', { type: 'button', class: 'btn btn-round build-menu-close', 'aria-label': t('ui.close'), title: t('ui.close'), 'data-fid': 'build-close', onclick: dismissPopup }, '×');
    const content = el('div', { class: 'build-menu-body' });
    const box = el('div', { class: 'build-menu', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'build-menu-title' },
      el('div', { class: 'build-menu-head' }, title, closeBtn), content);
    const back = el('div', { class: 'build-menu-back', onclick: (e) => { if (e.target === back) dismissPopup(); } }, box);
    const onKey = (e) => { if (e.key === 'Escape' && pop) { e.stopImmediatePropagation(); e.preventDefault(); dismissPopup(); } };
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(back);
    pop = { back, title, content, closeBtn, onKey };
    closeBtn.focus();
  }

  function renderPopup(slot) {
    ensurePopup();
    const g = ctx.getGuide();
    const state = ctx.getState();
    const shown = cache.opts.filter((o) => !moduleHidden(state, o.type));
    const card = (o) => {
      const isNew = ctx.isNew('module', o.type);
      return el('li', { class: 'opt' + (isNew ? ' is-new' : '') },
        el('div', { class: 'opt-head' }, icon(MODULE_ICONS[o.type]), el('strong', {}, modName(o.type)), isNew ? el('span', { class: 'new-tag' }, t('story.new')) : null),
        el('p', { class: 'muted' }, modDesc(o.type)),
        modScience(o.type),
        el('p', { class: 'small' }, t('ui.cost', { c: costText(o.cost) }) + '. ' + t('ui.buildTime', { n: fmt(o.buildSols, 1) })),
        o.ok ? null : el('p', { class: 'reason' }, t(o.reason || 'err.locked')),
        el('button', {
          type: 'button', class: 'btn btn-primary' + (g.build === o.type ? ' guide-target' : ''), 'data-fid': 'build-' + o.type, disabled: !o.ok,
          onclick: () => { const r = act({ type: 'build', slotId: slot.id, moduleType: o.type }); if (!r || r.ok !== false) closePopup(); },
        }, t('ui.build')));
    };
    const byType = new Map(shown.map((o) => [o.type, card(o)]));
    const groups = SECTIONS.map(([id, types]) => [id, types.filter((x) => byType.has(x))]);
    const known = new Set(SECTIONS.flatMap(([, ty]) => ty));
    groups.push(['other', shown.map((o) => o.type).filter((x) => !known.has(x))]);
    const secs = groups.filter(([, ty]) => ty.length).map(([id, ty]) => el('section', { class: 'opt-sec' },
      el('h4', { class: 'opt-sec-title' }, t('ui.sec.' + id)), el('ul', { class: 'opt-list build-grid' }, ty.map((x) => byType.get(x)))));
    const a = document.activeElement;
    const fid = a && pop.back.contains(a) ? a.dataset.fid : null;
    const top = pop.content.scrollTop;
    setText(pop.title, t('ui.buildMenuTitle'));
    pop.closeBtn.setAttribute('aria-label', t('ui.close'));
    pop.content.replaceChildren(...secs);
    pop.content.scrollTop = top;
    if (fid) { const n = pop.back.querySelector('[data-fid="' + fid + '"]'); if (n && !n.disabled) n.focus({ preventScroll: true }); }
  }

  function viewEmpty(slot) {
    return [el('h3', {}, t('ui.emptySlot', { id: slot.id })), el('p', { class: 'muted' }, t('ui.buildMenuHint'))];
  }

  function viewModule(slot, state) {
    const m = slot.module;
    const key = moduleStatusKey(m);
    const out = [];
    out.push(el('div', { class: 'mod-head' }, icon(MODULE_ICONS[m.type]), el('h3', {}, modName(m.type)), el('span', { class: 'badge' }, t('ui.level', { n: m.level })), el('button', { type: 'button', class: 'btn btn-round sci-btn', 'aria-label': t('ui.moduleScience'), title: t('ui.moduleScience'), onclick: () => ctx.openModuleScience(m.type) }, '?')));
    refs.status = el('p', { class: 'status st-' + key }, el('span', { class: 'mark', 'aria-hidden': 'true' }, STATUS_MARK[key]), ' ', t('status.' + key));
    out.push(refs.status);
    if (key === 'building' || key === 'upgrading' || key === 'cleaning' || key === 'repairing') {
      refs.barText = el('span', { class: 'small num' });
      refs.bar = el('i');
      out.push(el('div', {}, refs.barText, el('div', { class: 'bar', role: 'presentation' }, refs.bar)));
    }
    if (key === 'broken') {
      out.push(el('button', {
        type: 'button', class: 'btn btn-primary', 'data-fid': 'repair', disabled: state.resources.parts < REPAIR_PARTS,
        onclick: () => act({ type: 'repair', slotId: slot.id }),
      }, t('ui.repair')), el('p', { class: 'small' }, t('ui.repairCost', { c: costText({ parts: REPAIR_PARTS }) })));
      if (state.resources.parts < REPAIR_PARTS) out.push(el('p', { class: 'reason' }, t('err.notEnoughParts')));
    }
    out.push(el('p', { class: 'muted' }, modDesc(m.type)));

    const def = MODULES[m.type] && MODULES[m.type].levels[m.level - 1];
    const caps = [];
    if (def) {
      if (m.type === 'habitat') caps.push(t('ui.cap.crew', { n: def.capacity }));
      if (m.type === 'battery') caps.push(t('ui.cap.battery', { n: def.capacity }));
      if (m.type === 'shelter') caps.push(t('ui.cap.shelter', { n: def.capacity }));
    }
    refs.lines = {};
    const ul = el('ul', { class: 'rates' }, caps.map((c) => el('li', {}, c)));
    for (const k of LINES[m.type] || []) { refs.lines[k] = el('li', { class: 'num' }); ul.append(refs.lines[k]); }
    out.push(ul);

    if (m.type === 'solar') {
      refs.dust = el('span', { class: 'small num' });
      refs.dustBar = el('i');
      out.push(el('div', {}, refs.dust, el('div', { class: 'bar dust', role: 'presentation' }, refs.dustBar)));
      if (ctx.featureOn('clean')) out.push(el('button', {
        type: 'button', class: 'btn' + (ctx.getGuide().panel.includes('clean') ? ' guide-target' : '') + (ctx.isNew('feature', 'clean') ? ' is-new' : ''), 'data-fid': 'clean', disabled: key === 'cleaning' || key === 'building',
        onclick: () => act({ type: 'clean', slotId: slot.id }),
      }, t('ui.clean')));
    }

    if (ctx.featureOn('toggle')) out.push(el('button', {
      type: 'button', class: 'btn' + (ctx.isNew('feature', 'toggle') ? ' is-new' : ''), 'data-fid': 'toggle', disabled: key === 'building',
      onclick: () => act({ type: 'toggle', slotId: slot.id, enabled: !m.enabled }),
    }, m.enabled ? t('ui.turnOff') : t('ui.turnOn')));

    const up = cache.up;
    if (up) {
      out.push(el('button', {
        type: 'button', class: 'btn', 'data-fid': 'upgrade', disabled: !up.ok,
        onclick: () => act({ type: 'upgrade', slotId: slot.id }),
      }, t('ui.upgradeTo', { n: up.nextLevel })));
      out.push(el('p', { class: 'small' }, t('ui.cost', { c: costText(up.cost) }) + '. ' + t('ui.buildTime', { n: fmt(up.buildSols, 1) })));
      if (!up.ok && up.reason) out.push(el('p', { class: 'reason' }, key === 'broken' ? t('story.repairFirst') : t(up.reason)));
    } else if (m.level >= 3) {
      out.push(el('p', { class: 'muted' }, t('ui.maxLevel')));
    }

    // colonist assignment
    if (!ctx.featureOn('assign')) return finishView(out, slot);
    const act2 = state.colonists.filter((c) => c.status === 'active');
    const ids = [null, ...act2.map((c) => c.id)];
    const sel = el('select', { id: 'assign-sel', 'data-fid': 'assign' });
    sel.append(el('option', { value: '' }, t('ui.assignNone')));
    for (const c of act2) {
      let label = c.profession ? c.name + ' (' + t('prof.' + c.profession + '.name') + ')' : c.name;
      if (c.assignedTo && c.assignedTo !== slot.id) {
        const other = state.slots.find((s) => s.id === c.assignedTo);
        if (other && other.module) label = t('ui.assignAt', { name: label, module: modName(other.module.type) });
      }
      sel.append(el('option', { value: String(c.id) }, label));
    }
    const cur = m.staff && m.staff[0] != null ? m.staff[0] : null;
    sel.selectedIndex = Math.max(0, ids.indexOf(cur));
    sel.addEventListener('change', () => {
      const id = ids[sel.selectedIndex];
      if (id == null) { if (cur != null) act({ type: 'assign', colonistId: cur, slotId: null }); }
      else act({ type: 'assign', colonistId: id, slotId: slot.id });
    });
    if (ctx.getGuide().panel.includes('assign')) sel.classList.add('guide-target');
    if (ctx.isNew('feature', 'assign')) sel.classList.add('is-new');
    out.push(el('label', { for: 'assign-sel', class: 'field-label' }, t('ui.assign')), sel);
    return finishView(out, slot);
  }

  function finishView(out, slot) {

    if (confirm) {
      out.push(el('p', { class: 'reason' }, t('ui.demolishConfirm')),
        el('div', { class: 'btn-row' },
          el('button', { type: 'button', class: 'btn btn-danger', 'data-fid': 'demo-yes', onclick: () => { confirm = false; act({ type: 'demolish', slotId: slot.id }); } }, t('ui.demolishYes')),
          el('button', { type: 'button', class: 'btn', 'data-fid': 'demo-no', onclick: () => { confirm = false; sig = null; } }, t('ui.cancel'))));
    } else {
      out.push(el('button', { type: 'button', class: 'btn btn-danger-outline', 'data-fid': 'demo', onclick: () => { confirm = true; sig = null; } }, t('ui.demolish')));
    }
    return out;
  }

  function update(state) {
    const id = ctx.getSelected();
    if (id !== lastSel) { lastSel = id; confirm = false; sig = null; }
    const slot = id ? state.slots.find((s) => s.id === id) : null;
    let s;
    if (!slot) s = 'none';
    else if (!slot.module) {
      cache.opts = buildOptions(state, id);
      s = 'empty|' + id + '|' + cache.opts.map((o) => o.type + (o.ok ? 1 : 0) + (o.reason || '')).join(',');
    } else {
      const m = slot.module;
      cache.up = upgradeInfo(state, id);
      const colSig = state.colonists.map((c) => c.id + ':' + c.status + ':' + (c.assignedTo || '') + ':' + (c.profession || '')).join(',') + (state.resources.parts >= REPAIR_PARTS ? 'R' : 'r');
      s = ['mod', id, m.type, m.level, moduleStatusKey(m), cache.up ? cache.up.nextLevel + '' + cache.up.ok + (cache.up.reason || '') : '-', m.staff && m.staff[0], confirm, colSig].join('|');
    }
    s += '|' + getLang() + '|' + JSON.stringify(ctx.getGuide()) + '|' + ctx.newSig() + '|' + ['assign', 'clean', 'toggle'].map((x) => (ctx.featureOn(x) ? 1 : 0)).join('') + (state.unlocked && state.unlocked.modules ? state.unlocked.modules.length : '');
    if (s !== sig) {
      sig = s;
      root.classList.toggle('slot-empty', !(slot && slot.module));
      if (!slot) { closePopup(); rebuild(viewNone); }
      else if (!slot.module) { rebuild(() => viewEmpty(slot)); renderPopup(slot); }
      else { closePopup(); rebuild(() => viewModule(slot, state)); }
    }
    if (slot && slot.module) live(state, slot);
  }

  function live(state, slot) {
    const m = slot.module;
    if (refs.bar) {
      const p = (m.progress || 0) * 100;
      setWidth(refs.bar, p);
      setText(refs.barText, t('ui.progress', { n: fmt(p, 0) }));
    }
    if (refs.dust) {
      const pct = (m.dust || 0) * 100;
      setText(refs.dust, t('ui.dust', { n: fmt(pct, 0) }));
      setWidth(refs.dustBar, pct / 0.8);
    }
    if (Object.keys(refs.lines).length) {
      const r = moduleRates(state, slot.id);
      for (const k of Object.keys(refs.lines)) setText(refs.lines[k], t('ui.rate.' + k, { n: fmt(r[k] || 0, 1) }));
    }
  }

  return { update };
}
