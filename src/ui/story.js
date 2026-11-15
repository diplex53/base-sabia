import { t } from '../i18n/i18n.js';
import { el, setCls, fmt } from './util.js';
import { getLang } from '../i18n/i18n.js';

const KEY = 'baseSabia.story.v1';
const CHAPTERS = [1, 2, 3];

// Optional: the core's chapter table (scene ids). The UI falls back to c<N>.introN / outro1 names.
let coreChapters = null;
import('../data/story.js').then((m) => { coreChapters = m.CHAPTERS || null; }).catch(() => {});

function loadProgress() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (o && typeof o === 'object') return { done: o.done && typeof o.done === 'object' ? o.done : {}, all: !!o.all };
  } catch (e) { /* ignore */ }
  return { done: {}, all: false };
}
function saveProgress(p) { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, ...p })); } catch (e) { /* ignore */ } }

export function sceneIds(chapter, which) {
  const c = coreChapters && coreChapters[chapter];
  const list = c && Array.isArray(c[which]) && c[which].length ? c[which] : null;
  if (list) return list;
  return which === 'intro' ? ['c' + chapter + '.intro1', 'c' + chapter + '.intro2'] : ['c' + chapter + '.outro1'];
}

/**
 * Story-mode interface: chapter menu, scene cards, objective card, end-of-chapter flow.
 * `modals` is the object from createModals (needs open/close/enqueue), `ctx` the main context.
 */
export function createStory(ctx, modals) {
  let prog = loadProgress();
  const isUnlocked = (n) => n === 1 || prog.all || prog.done[n - 1] != null;

  // ---------- chapter menu
  function openMenu() {
    ctx.setLaunchScreen(true);
    modals.open((mm) => [
      el('p', { class: 'modal-eyebrow' }, t('design.mission')),
      el('h2', {}, t('story.menuTitle')),
      el('p', {}, t('story.menuIntro')),
      el('ul', { class: 'chapter-list' }, CHAPTERS.map((n) => {
        const open = isUnlocked(n);
        const done = prog.done[n] != null;
        return el('li', { class: 'chapter-card' + (open ? '' : ' is-locked') },
          el('div', { class: 'chapter-head' },
            el('span', { class: 'chapter-n' }, t('story.chapterN', { n })),
            done ? el('span', { class: 'badge chapter-done' }, '✓ ' + t('story.done')) : null),
          el('h3', {}, t('story.ch' + n + '.title')),
          el('p', {}, t('story.ch' + n + '.teaser')),
          done ? el('p', { class: 'small muted num' }, t('story.best', { n: fmt(prog.done[n] || 0, 0) })) : null,
          open
            ? el('button', { type: 'button', class: 'btn' + (done ? '' : ' btn-primary'), 'data-fid': 'play-' + n, 'data-autofocus': n === CHAPTERS.find(isUnlocked) ? '' : null,
              onclick: () => ctx.startStory(n) }, done ? t('story.replay') : t('story.play'))
            : el('p', { class: 'small muted' }, '🔒 ' + t('story.locked')));
      })),
      el('div', { class: 'btn-row' },
        el('button', { type: 'button', class: 'btn', onclick: () => { modals.close(mm); ctx.openStart(); } }, t('story.back')),
        el('button', { type: 'button', class: 'link-btn', onclick: () => { prog.all = !prog.all; saveProgress(prog); modals.rerender(mm); } }, t('story.unlockAll'))),
    ], { dismissible: false, label: () => t('story.menuTitle'), className: 'chapter-modal', wide: true });
  }

  // ---------- scene cards
  function playScenes(ids, { onDone, lastLabel = 'story.start' } = {}) {
    const list = ids.filter((id) => id);
    let finished = false;
    const finish = () => { if (finished) return; finished = true; if (onDone) onDone(); };
    if (!list.length) { finish(); return null; }
    let i = 0;
    return modals.open((mm) => {
      const id = list[i];
      const last = i === list.length - 1;
      const credit = t('scene.' + id + '.credit') !== 'scene.' + id + '.credit' ? t('scene.' + id + '.credit') : t('scene.credit');
      const fig = el('figure', { class: 'scene-fig', hidden: true },
        el('img', {
          class: 'scene-img', src: 'assets/scenes/' + id + '.jpg', alt: t('story.imageAlt'),
          onload: (e) => { fig.hidden = false; void e; },
          onerror: () => fig.remove(),
        }),
        el('figcaption', { class: 'small muted' }, credit));
      return [
        fig,
        list.length > 1 ? el('p', { class: 'small muted' }, t('story.sceneOf', { n: i + 1, total: list.length })) : null,
        el('h2', {}, t('scene.' + id + '.title')),
        el('p', { class: 'big scene-body' }, t('scene.' + id + '.body')),
        el('p', { class: 'small muted scene-ara' }, t('ara.line')),
        el('div', { class: 'btn-row' },
          el('button', {
            type: 'button', class: 'btn btn-primary', 'data-autofocus': '',
            onclick: () => { if (last) modals.close(mm); else { i += 1; modals.rerender(mm); } },
          }, last ? t(lastLabel) : t('story.next')),
          last ? null : el('button', { type: 'button', class: 'btn', onclick: () => modals.close(mm) }, t('story.skip'))),
      ];
    }, { dismissible: true, label: () => t('scene.' + list[i] + '.title'), onClose: finish, className: 'scene-modal' });
  }

  // ---------- end of chapter
  function onComplete(ev, state) {
    const n = (ev && ev.chapter) || (state.story && state.story.chapter) || 1;
    const score = (ev && ev.score) != null ? ev.score : 0;
    prog.done[n] = Math.max(prog.done[n] || 0, score);
    saveProgress(prog);
    const result = () => modals.open((mm) => [
      el('h2', {}, t('story.chapterDone', { n })),
      el('p', { class: 'big' }, t('story.ch' + n + '.title')),
      el('p', { class: 'score' }, t('story.score', { n: fmt(score, 0) })),
      n >= 3 ? el('p', {}, t('story.colonyInvite')) : null,
      el('div', { class: 'btn-row' },
        n < 3 ? el('button', { type: 'button', class: 'btn btn-primary', 'data-autofocus': '', onclick: () => ctx.startStory(n + 1) }, t('story.nextChapter'))
          : el('button', { type: 'button', class: 'btn btn-primary', 'data-autofocus': '', onclick: () => ctx.startColonyFromStory() }, t('story.toColony')),
        el('button', { type: 'button', class: 'btn', onclick: () => ctx.exitStory() }, t('story.toMenu'))),
    ], { dismissible: false, label: () => t('story.chapterDone', { n }) });
    modals.enqueue(() => playScenes(sceneIds(n, 'outro'), { lastLabel: 'story.next', onDone: () => result() }));
  }

  return { openMenu, playScenes, onComplete, resetProgressCache() { prog = loadProgress(); } };
}

/** Fixed objective card (top centre on desktop, full width under the top bar on phones). */
export function createObjectiveCard() {
  const root = el('aside', { id: 'story-card', class: 'story-card', hidden: true, 'aria-live': 'polite' });
  document.body.append(root);
  let sig = '';
  let collapsed = false;
  let showDone = false;
  let lastState = null;

  function render(state) {
    const st = state.story;
    const steps = st.steps || [];
    const idx = Math.min(st.stepIdx || 0, Math.max(0, steps.length - 1));
    const cur = steps[idx];
    const doneSteps = steps.filter((s) => s.done);
    const head = el('div', { class: 'sc-head' },
      el('span', { class: 'sc-tag' }, t('story.objective')),
      el('span', { class: 'sc-prog num' }, t('story.progress', { n: Math.min(doneSteps.length + 1, steps.length), total: steps.length })),
      el('button', {
        type: 'button', class: 'sc-toggle', 'aria-expanded': String(!collapsed), title: t(collapsed ? 'story.expand' : 'story.collapse'),
        'aria-label': t(collapsed ? 'story.expand' : 'story.collapse'),
        onclick: () => { collapsed = !collapsed; sig = ''; render(lastState); },
      }, collapsed ? '▾' : '▴'));
    const kids = [head];
    if (cur) kids.push(el('h2', { class: 'sc-title' }, t('step.' + cur.id + '.title')));
    if (cur && !collapsed) {
      kids.push(el('p', { class: 'sc-hint' }, el('strong', {}, t('story.hintBy') + ': '), t('step.' + cur.id + '.hint')));
      kids.push(el('button', {
        type: 'button', class: 'link-btn sc-done-btn', 'aria-expanded': String(showDone),
        onclick: () => { showDone = !showDone; sig = ''; render(lastState); },
      }, (showDone ? '▾ ' : '▸ ') + t('story.doneList', { n: doneSteps.length })));
      if (showDone) {
        kids.push(doneSteps.length
          ? el('ul', { class: 'sc-done' }, doneSteps.map((s) => el('li', {}, '✓ ' + t('step.' + s.id + '.title'))))
          : el('p', { class: 'small muted' }, t('story.noneYet')));
      }
    }
    root.replaceChildren(...kids);
  }

  return {
    root,
    update(state, active) {
      const st = state && state.story;
      const show = !!(active && st && !st.complete && st.steps && st.steps.length);
      if (root.hidden === show) root.hidden = !show;
      if (!show) { sig = ''; return; }
      lastState = state;
      const s = [st.stepIdx, st.steps.filter((x) => x.done).length, getLang(), collapsed, showDone].join('|');
      if (s !== sig) { sig = s; render(state); }
    },
    isVisible: () => !root.hidden,
    reset() { sig = ''; collapsed = false; showDone = false; },
  };
}
void setCls;
