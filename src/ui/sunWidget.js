import { t, getLang, onLangChange } from '../i18n/i18n.js';
import { el, fmtDate } from './util.js';
import { getSunState, onSunUpdate, loadSunToday } from '../net/donkiLive.js';

/** "The Sun today" box. Re-renders itself on data or language change and unsubscribes once detached. */
export function createSunWidget() {
  const box = el('section', { class: 'sun-widget', 'aria-live': 'polite' });
  function render() {
    const s = getSunState();
    const kids = [el('h3', {}, t('sun.title'))];
    if (s.status === 'live') {
      if (s.count > 0) {
        kids.push(el('p', {}, t('sun.count', { n: s.count })),
          el('p', {}, t('sun.strongest', { cls: s.classType, date: fmtDate(s.date) })));
      } else kids.push(el('p', {}, t('sun.quiet')));
      const time = new Date(s.fetchedAt).toLocaleTimeString(getLang() === 'pt' ? 'pt-BR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
      kids.push(el('p', { class: 'small sun-label sun-live' }, t('sun.live', { time })));
    } else if (s.status === 'archive') {
      if (s.classType) kids.push(el('p', {}, t('sun.archiveEvent', { cls: s.classType, date: fmtDate(s.date) })));
      kids.push(el('p', { class: 'small sun-label sun-archive' }, t('sun.archive', { date: fmtDate(s.archiveDate) })));
    } else kids.push(el('p', { class: 'muted' }, t('sun.loading')));
    box.replaceChildren(...kids);
  }
  const off1 = onSunUpdate(() => { if (!box.isConnected && box._seen) { off1(); off2(); return; } render(); });
  const off2 = onLangChange(() => { if (!box.isConnected && box._seen) { off1(); off2(); return; } render(); });
  // mark as seen once attached (first render happens before attaching)
  queueMicrotask(() => { box._seen = true; });
  loadSunToday();
  render();
  return box;
}
