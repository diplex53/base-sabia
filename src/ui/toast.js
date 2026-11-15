import { el } from './util.js';

export function toast(msg, ms = 3500) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  while (root.children.length >= 3) root.firstChild.remove();
  const n = el('div', { class: 'toast' }, msg);
  root.append(n);
  setTimeout(() => n.remove(), ms);
}
