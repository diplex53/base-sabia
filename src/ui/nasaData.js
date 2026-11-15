import { t } from '../i18n/i18n.js';
import { el } from './util.js';
import { SCIENCE_PANELS } from '../data/sciencePanels.js';

// Reuse the source registry so the data overview and science notebook agree.
const DATA = [
  ['donki', 'tech.spaceWeather'], ['rad', 'speAtmosphere'], ['career', 'careerLimit'],
  ['dust', 'globalStorm'], ['insight', 'dustOnPanels'], ['moxie', 'moxieEnergy'],
  ['bvad', 'over.o2'], ['plants', 'cropsNeedLight'], ['water', 'over.water'],
  ['mars', 'nightPower'], ['comm', 'conjunction'], ['radlab', 'radlab'], ['osdr', 'osdrHealth'], ['osdr2', 'muscleLoss'],
];

export function nasaDataNodes(openPanel) {
  return [
    el('h2', {}, t('data.title')),
    el('p', {}, t('data.intro')),
    el('ul', { class: 'data-list' }, DATA.filter(([, panel]) => SCIENCE_PANELS[panel]).map(([id, panel]) => {
      const info = SCIENCE_PANELS[panel];
      return el('li', {}, el('h3', {}, t('data.' + id + '.name')),
        el('p', {}, t('data.' + id + '.use')),
        el('p', { class: 'small' }, info.sources.map((source, i) => [i ? ' · ' : '',
          el('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, source.name)])),
        ['radlab', 'osdrHealth', 'muscleLoss', 'conjunction'].includes(panel)
          ? el('button', { type: 'button', class: 'link-btn', onclick: () => openPanel(panel) }, t('data.readPanel')) : null);
    })),
    el('p', { class: 'panel-note' }, t('data.assumptions')),
    el('p', { class: 'panel-note' }, t('data.flareRule')),
  ];
}
