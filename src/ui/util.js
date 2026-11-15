import { t, getLang, setLang, onLangChange } from '../i18n/i18n.js';

export function el(tag, props, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) {
    if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Small inline pictograms (own drawing, no external assets). */
const ICONS = {
  energy: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  o2: '<circle cx="9" cy="14" r="6"/><circle cx="17" cy="7" r="3.5"/><circle cx="6" cy="5" r="2"/>',
  water: '<path d="M12 2.5C9 7 6 10.5 6 14.5a6 6 0 0 0 12 0C18 10.5 15 7 12 2.5z"/>',
  food: '<path d="M11 21v-8"/><path d="M11 13C6 13 4 9 4 5c5 0 7 3 7 8z"/><path d="M11 15c0-4 2-7 8-7 0 4-3 7-8 7z"/>',
  regolith: '<path d="M3 18l4-7 4 4 3-6 7 9z"/>',
  parts: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  science: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  shelter: '<path d="M3 20v-7a9 9 0 0 1 18 0v7z"/><path d="M10 20v-5h4v5"/>',
  tech: '<circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
  pop: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21v-3a5 5 0 0 1 14 0v3"/>',
  ship: '<path d="M12 2c3 3 4 7 4 11l-4 3-4-3c0-4 1-8 4-11z"/><path d="M8 14l-3 4 4-1M16 14l3 4-4-1"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><path d="M12 17.2v.1"/>',
};
export function icon(name) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'icon icon-' + name);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.innerHTML = ICONS[name] || '';
  return s;
}

/** Translation with a fallback (e.g. the module type id) when the key is missing. */
export function tOr(key, fallback, params) {
  const v = t(key, params);
  return v === key ? fallback : v;
}

export function setText(node, v) {
  if (node._t !== v) { node._t = v; node.textContent = v; }
}
export function setAttr(node, k, v) {
  v = String(v);
  if (node.getAttribute(k) !== v) node.setAttribute(k, v);
}
export function setCls(node, cls, on) {
  if (node.classList.contains(cls) !== !!on) node.classList.toggle(cls, !!on);
}
export function setWidth(node, pct) {
  const v = Math.max(0, Math.min(100, pct)).toFixed(1) + '%';
  if (node._w !== v) { node._w = v; node.style.width = v; }
}

const nfCache = {};
export function fmt(n, d = 0) {
  const lang = getLang();
  const k = lang + d;
  const f = nfCache[k] || (nfCache[k] = new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
  return f.format(n);
}
export function fmtSigned(n, d = 1) {
  const s = fmt(Math.abs(n), d);
  if (Number(Math.abs(n).toFixed(d)) === 0) return fmt(0, d);
  return (n > 0 ? '+' : '−') + s;
}
export const pad2 = (n) => String(n).padStart(2, '0');

export function moduleStatusKey(m) {
  if (['building', 'upgrading', 'cleaning', 'broken', 'repairing'].includes(m.status)) return m.status;
  if (!m.enabled) return 'off';
  if (m.powered === false) return 'unpowered';
  return 'ok';
}
export const STATUS_MARK = {
  ok: '●', building: '◐', upgrading: '◐', off: '○', unpowered: '!', cleaning: '~', broken: '✕', repairing: '◐',
};

export function costText(cost) {
  const parts = Object.entries(cost || {}).filter(([, n]) => n > 0)
    .map(([k, n]) => fmt(n, 0) + ' ' + t('res.' + k).toLowerCase());
  return parts.length ? parts.join(' + ') : '0';
}

export function langToggle() {
  const wrap = el('div', { class: 'seg lang-toggle', role: 'group' });
  const btns = ['pt', 'en'].map((code) => el('button', { type: 'button', class: 'seg-btn', lang: code, 'data-lang': code, onclick: () => setLang(code) }, code.toUpperCase()));
  wrap.append(...btns);
  const sync = () => {
    wrap.setAttribute('aria-label', t('ui.language'));
    btns.forEach((b) => b.setAttribute('aria-pressed', String(getLang() === b.dataset.lang)));
  };
  onLangChange(sync);
  sync();
  return wrap;
}

/** Apply data-i18n (text), data-i18n-aria and data-i18n-title attributes. */
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach((n) => n.setAttribute('aria-label', t(n.dataset.i18nAria)));
  root.querySelectorAll('[data-i18n-title]').forEach((n) => n.setAttribute('title', t(n.dataset.i18nTitle)));
}

/** Translate a reason that may be an i18n key, a short code (ship.refused.*) or plain text. */
export function tr(r) {
  if (!r) return '';
  for (const k of [r, 'ship.refused.' + r, 'err.' + r]) { const v = t(k); if (v !== k) return v; }
  return String(r);
}
/** 'YYYY-MM-DD...' -> localized short date (UTC). */
export function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return String(iso || '');
  return d.toLocaleDateString(getLang() === 'pt' ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
/** Real-event line: "Based on the real solar flare of <date>, class <X>, NASA DONKI" (+ link). */
export function realEventLine(spe) {
  if (!spe || !spe.classType) return null;
  const p = el('p', { class: 'real-event' }, t('ui.basedOnReal', { date: fmtDate(spe.peakTime), cls: spe.classType }));
  if (spe.link) p.append(' ', el('a', { href: spe.link, target: '_blank', rel: 'noopener noreferrer' }, t('ev.spe.link')));
  return p;
}
