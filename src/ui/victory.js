// Victory scene shown when the dome is finished: cinema bars, title, sparks. View only, no simulation.
import { t } from '../i18n/i18n.js';

let node = null;

const mk = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

export function hideVictory() { if (node) { node.remove(); node = null; } }
export const victoryOpen = () => !!node;

/** info: { sol, colonists }. onContinue: shown as a button when given (normal game); without it the scene is passive (presentation). */
export function showVictory(info = {}, onContinue = null) {
  hideVictory();
  node = mk('div', 'victory');
  node.setAttribute('role', 'dialog');
  node.setAttribute('aria-label', t('victory.title'));
  const top = mk('div', 'victory-bar victory-top');
  top.append(mk('p', 'victory-kicker', t('victory.kicker')), mk('h2', 'victory-title', t('victory.title')));
  const bottom = mk('div', 'victory-bar victory-bottom');
  bottom.append(mk('p', 'victory-line', t('victory.line')));
  if (info.sol != null) bottom.append(mk('p', 'victory-stats', t('victory.stats', { sol: info.sol, n: info.colonists ?? 0 })));
  if (onContinue) {
    const b = mk('button', 'btn btn-primary victory-btn', t('victory.continue'));
    b.type = 'button';
    b.addEventListener('click', () => { hideVictory(); onContinue(); });
    bottom.append(b);
    setTimeout(() => { try { b.focus(); } catch (e) { /* ignore */ } }, 0);
  }
  const sparks = mk('div', 'victory-sparks');
  sparks.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 28; i++) {
    const s = mk('i');
    s.style.left = (3 + Math.random() * 94).toFixed(1) + '%';
    s.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
    s.style.animationDuration = (2.6 + Math.random() * 2.4).toFixed(2) + 's';
    sparks.append(s);
  }
  node.append(sparks, top, bottom);
  document.body.append(node);
}
