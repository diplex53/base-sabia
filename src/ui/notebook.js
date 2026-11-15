import { t } from '../i18n/i18n.js';
import { el } from './util.js';
import { SCIENCE_PANELS } from '../data/sciencePanels.js';
import { createSunWidget } from './sunWidget.js';

export function createNotebookContent(state, openPanel, close) {
  const ids = Object.keys(SCIENCE_PANELS);
  const seen = new Set(state.stats.panelsSeen);
  const items = ids.map((id) => seen.has(id)
    ? el('li', {}, el('button', { type: 'button', class: 'btn btn-full', onclick: () => openPanel(id) }, t('panel.' + id + '.title')))
    : el('li', { class: 'locked' }, t('ui.notebookLocked')));
  return [
    el('h2', {}, t('ui.notebook') + ' ' + t('ui.notebookCount', { n: seen.size, total: ids.length })),
    createSunWidget(),
    seen.size ? null : el('p', { class: 'muted' }, t('ui.notebookEmpty')),
    el('ul', { class: 'notebook-list' }, items),
    el('button', { type: 'button', class: 'btn btn-primary', 'data-autofocus': '', onclick: close }, t('ui.close')),
  ];
}
