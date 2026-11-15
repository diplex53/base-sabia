import { t, getLang } from '../i18n/i18n.js';
import { el, fmt, moduleStatusKey, STATUS_MARK } from '../ui/util.js';
import { SITES } from '../data/balance.js';

const lerp = (a, b, k) => a + (b - a) * k;
const mix = (c1, c2, k) => c1.map((v, i) => Math.round(lerp(v, c2[i], k)));
const DAY = [226, 158, 82];      // butterscotch
const NIGHT = [18, 14, 30];
const DUSTY = [112, 74, 48];

export function createView(container, { onSlotClick, onSiteClick, onSlotContext } = {}) {
  const root = el('div', { class: 'v2d' });
  const stage = el('div', { class: 'v2d-stage' });
  const grid = el('div', { class: 'v2d-grid', role: 'group' });
  const left = el('div', { class: 'v2d-side v2d-left' });
  const right = el('div', { class: 'v2d-side v2d-right' });
  stage.append(left, grid, right);
  root.append(stage);
  container.append(root);

  const tiles = new Map();
  let selected = null;
  let lastBg = '';
  const chips = [];

  function addTile(slot) {
    const name = el('span', { class: 'tile-name' });
    const level = el('span', { class: 'tile-level' });
    const mark = el('span', { class: 'mark', 'aria-hidden': 'true' });
    const stText = el('span', {});
    const bar = el('span', { class: 'tile-bar' }, el('i'));
    const dust = el('span', { class: 'tile-dust num' });
    const node = el('button', { type: 'button', class: 'tile', 'data-slot': slot.id, onclick: () => onSlotClick && onSlotClick(slot.id) },
      name, level, el('span', { class: 'tile-status' }, mark, stText), bar, dust);
    if (onSlotContext) {
      node.addEventListener('contextmenu', (e) => { e.preventDefault(); onSlotContext(slot.id); });
      let timer = null;
      node.addEventListener('touchstart', () => { timer = setTimeout(() => { timer = null; onSlotContext(slot.id); }, 600); }, { passive: true });
      for (const ev of ['touchend', 'touchmove', 'touchcancel']) node.addEventListener(ev, () => { if (timer) { clearTimeout(timer); timer = null; } }, { passive: true });
    }
    node.style.gridColumn = String(slot.gx + 1);
    node.style.gridRow = String(slot.gz + 1);
    grid.append(node);
    if (hl.includes(slot.id)) node.classList.add('guide-target');
    tiles.set(slot.id, { node, name, level, mark, stText, bar, dust, sig: '' });
  }

  function addSites() {
    for (const s of SITES) {
      const nameN = el('span', {});
      const infoN = el('small', {});
      const chip = el('button', { type: 'button', class: 'site-chip', 'data-site': s.id, onclick: () => onSiteClick && onSiteClick(s.id) }, nameN, infoN);
      chip.style.gridRow = String(Math.min(4, Math.max(1, s.gz + 1)));
      (s.gx < 0 ? left : right).append(chip);
      chips.push({ chip, id: s.id, nameN, infoN, sig: '' });
    }
  }
  addSites();

  function paintBg(state) {
    const sun = Math.max(0, Math.min(1, state.env.sun));
    let c = mix(NIGHT, DAY, sun);
    c = mix(c, mix(NIGHT, DUSTY, 0.4 + 0.6 * sun), Math.min(0.75, (state.env.tau / 10.8) * 0.75));
    const c2 = mix(c, [0, 0, 0], 0.35);
    const bg = `linear-gradient(180deg, rgb(${c2}) 0%, rgb(${c}) 100%)`;
    if (bg !== lastBg) { lastBg = bg; root.style.background = bg; }
  }

  let lang = '';
  function update(state) {
    paintBg(state);
    if (!tiles.size) state.slots.forEach(addTile);
    const lg = getLang();
    if (lg !== lang) {
      lang = lg;
      grid.setAttribute('aria-label', t('ui.view'));
    }
    const exps = state.expeditions || [];
    for (const c of chips) {
      const e = exps.find((x) => x.site === c.id);
      const pct = e ? Math.round(Math.max(0, Math.min(1, (state.t - e.startT) / Math.max(0.001, e.endT - e.startT))) * 100) : -1;
      const sig = lg + '|' + pct;
      if (sig === c.sig) continue;
      c.sig = sig;
      c.nameN.textContent = t('site.' + c.id);
      c.infoN.textContent = e ? t('ui.siteBusy') + ' ' + pct + '%' : '';
      c.chip.classList.toggle('busy', !!e);
      c.chip.setAttribute('aria-label', t('site.' + c.id) + (e ? ', ' + t('ui.siteBusy') + ' ' + pct + '%' : ''));
    }
    for (const slot of state.slots) {
      const tl = tiles.get(slot.id);
      if (!tl) continue;
      const m = slot.module;
      const key = m ? moduleStatusKey(m) : 'empty';
      const pct = m ? Math.round((m.progress || 0) * 100) : 0;
      const dust = m && m.type === 'solar' ? Math.round((m.dust || 0) * 100) : -1;
      const sig = [lg, key, m && m.type, m && m.level, pct, dust, selected === slot.id].join('|');
      if (sig === tl.sig) continue;
      tl.sig = sig;
      const cls = ['tile', 'st-' + key];
      if (selected === slot.id) cls.push('selected');
      if (key === 'unpowered' || key === 'broken') cls.push('blink');
      tl.node.className = cls.join(' ');
      tl.node.setAttribute('aria-pressed', String(selected === slot.id));
      if (!m) {
        tl.name.textContent = '+';
        tl.level.textContent = '';
        tl.mark.textContent = '';
        tl.stText.textContent = t('ui.emptySlot', { id: slot.id });
        tl.bar.hidden = true; tl.dust.textContent = '';
        tl.node.setAttribute('aria-label', t('ui.emptySlot', { id: slot.id }) + '. ' + t('ui.build'));
      } else {
        const nm = t('mod.' + m.type + '.name');
        tl.name.textContent = nm;
        tl.level.textContent = t('ui.level', { n: m.level });
        tl.mark.textContent = STATUS_MARK[key];
        tl.stText.textContent = ' ' + t('status.' + key);
        const busy = key === 'building' || key === 'upgrading' || key === 'cleaning' || key === 'repairing';
        tl.bar.hidden = !busy;
        if (busy) tl.bar.firstChild.style.width = pct + '%';
        tl.dust.textContent = dust >= 0 ? t('ui.dust', { n: fmt(dust, 0) }) : '';
        tl.node.setAttribute('aria-label', nm + ', ' + t('ui.level', { n: m.level }) + ', ' + t('status.' + key));
      }
    }
  }

  let hl = [];
  function setHighlight(ids) { hl = ids || []; for (const [id, tl] of tiles) tl.node.classList.toggle('guide-target', hl.includes(id)); }
  function setSelected(id) { selected = id; for (const tl of tiles.values()) tl.sig = ''; }
  return {
    update,
    setSelected,
    setHighlight,
    resize() {},
    dispose() { root.remove(); },
  };
}
