import { t, getLang } from '../i18n/i18n.js';
import { el, setText, setAttr, setWidth, setCls, fmt } from './util.js';

const LIMIT = 600;

export function createColonistPanel(root) {
  const body = root.querySelector('.panel-body');
  let sig = null;
  let rows = [];

  function whereText(c, state) {
    if (c.status === 'retired') return t('ui.retired');
    if (c.location === 'expedition') {
      const e = (state.expeditions || []).find((x) => x.colonistId === c.id);
      return e ? t('ui.loc.expeditionAt', { site: t('site.' + e.site), n: fmt(Math.max(0, e.endT - state.t), 1) }) : t('ui.loc.expedition');
    }
    if (c.location === 'shelter') return t('ui.loc.shelter');
    if (c.assignedTo) {
      const s = state.slots.find((x) => x.id === c.assignedTo);
      if (s && s.module) return t('ui.loc.module', { module: t('mod.' + s.module.type + '.name') });
    }
    return t('ui.loc.habitat');
  }

  function update(state) {
    const s = state.colonists.map((c) => c.id + c.name + c.status + (c.profession || '') + c.location + (c.assignedTo || '')
      + (c.assignedTo ? (state.slots.find((x) => x.id === c.assignedTo)?.module?.type || '') : '')).join('|') + getLang();
    if (s !== sig) {
      sig = s;
      rows = state.colonists.map((c) => ({
        c,
        where: el('p', { class: 'small crew-location' }),
        dose: el('span', { class: 'small num' }),
        bar: el('i'),
        barWrap: el('div', { class: 'bar dose', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(LIMIT) }),
        root: el('li', { class: 'colonist' + (c.status === 'retired' ? ' retired' : '') }),
      }));
      for (const r of rows) {
        r.barWrap.append(r.bar);
        const prof = r.c.profession;
        r.root.append(el('div', { class: 'crew-heading' },
          el('span', { class: 'crew-avatar crew-' + (prof || 'none'), 'aria-hidden': 'true' }, r.c.name.split(/\s+/).map((n) => n[0]).slice(0, 2).join('')),
          el('div', {}, el('strong', {}, r.c.name),
            prof ? el('details', { class: 'crew-details' },
              el('summary', { class: 'prof-tag', title: t('prof.' + prof + '.bonus') }, t('prof.' + prof + '.name')),
              el('p', { class: 'prof-line' }, t('prof.' + prof + '.bonus'))) : null)),
          r.where,
          el('div', { class: 'dose-row', title: t('ui.tipMsv') }, el('span', { class: 'small' }, t('ui.dose') + ': '), r.dose), r.barWrap);
      }
      body.replaceChildren(rows.length ? el('ul', { class: 'colonist-list' }, rows.map((r) => r.root)) : el('p', { class: 'muted' }, t('ui.noColonists')));
    }
    const byId = new Map(state.colonists.map((c) => [c.id, c]));
    for (const r of rows) {
      const c = byId.get(r.c.id);
      if (!c) continue;
      const d = Math.round(c.dose * 10) / 10;
      setText(r.where, whereText(c, state));
      setText(r.dose, t('ui.doseText', { n: fmt(d, 0), max: LIMIT }));
      setWidth(r.bar, (c.dose / LIMIT) * 100);
      setAttr(r.barWrap, 'aria-valuenow', Math.round(c.dose));
      setAttr(r.barWrap, 'aria-label', t('ui.dose'));
      setCls(r.root, 'warn', c.dose >= LIMIT * 0.6 && c.dose < LIMIT * 0.9);
      setCls(r.root, 'danger', c.dose >= LIMIT * 0.9);
    }
  }
  return { update };
}
