import pt from './pt.js';
import en from './en.js';

const dict = { pt, en };
const subs = new Set();
let lang = 'en';
try { if (/^pt/i.test(navigator.language || '')) lang = 'pt'; } catch (e) { /* default */ }
try {
  const s = localStorage.getItem('sabia.lang');
  if (s === 'en' || s === 'pt') lang = s;
} catch (e) { /* storage blocked */ }

function syncHtmlLang() {
  if (typeof document !== 'undefined') document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
}
syncHtmlLang();

export function t(key, params) {
  let s = dict[lang][key];
  if (s === undefined) s = dict.pt[key];
  if (s === undefined) return key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
  return s;
}
export function getLang() { return lang; }
export function setLang(l) {
  if (!dict[l] || l === lang) return;
  lang = l;
  try { localStorage.setItem('sabia.lang', l); } catch (e) { /* ignore */ }
  syncHtmlLang();
  subs.forEach((cb) => cb(l));
}
export function onLangChange(cb) { subs.add(cb); return () => subs.delete(cb); }
