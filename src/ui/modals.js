import { t, onLangChange, getLang } from '../i18n/i18n.js';
import { el, fmt, langToggle, tr, costText, realEventLine, icon } from './util.js';
import { SCIENCE_PANELS } from '../data/sciencePanels.js';
import { SCORE } from '../data/balance.js';
import * as sel from '../sim/selectors.js';
import { createNotebookContent } from './notebook.js';
import { createSunWidget } from './sunWidget.js';
import { colonyProgress } from './progress.js';
import { nasaDataNodes } from './nasaData.js';

const FOCUSABLE = 'button:not([disabled]), a[href], select, input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const profName = (p) => (p ? t('prof.' + p + '.name') : t('prof.none'));

export function createModals(root, ctx) {
  const stack = [];
  const queue = [];
  let eventModal = null;
  let overOpen = false;
  let decisionModal = null;
  let lastOffer = [];

  function focusIn(m) {
    const f = m.card.querySelector('[data-autofocus]') || m.card.querySelector(FOCUSABLE) || m.card;
    f.focus();
  }
  function render(m) {
    m.card.replaceChildren(...m.render(m).flat(Infinity).filter(Boolean));
    m.card.setAttribute('aria-label', m.label ? m.label() : '');
  }
  /** Re-render keeping keyboard focus on the same data-fid control. */
  function rerender(m) {
    const a = document.activeElement;
    const fid = a && m.card.contains(a) ? a.dataset.fid : null;
    const sc = m.card.scrollTop;
    render(m);
    m.card.scrollTop = sc;
    if (fid) { const n = m.card.querySelector(`[data-fid="${fid}"]`); if (n && !n.disabled) n.focus(); }
  }

  function open(renderFn, { dismissible = true, label, onClose, wide = false, className = '', backClass = '' } = {}) {
    const back = el('div', { class: 'modal-back ' + backClass });
    const card = el('div', { class: 'modal' + (wide ? ' modal-wide' : '') + ' ' + className, role: 'dialog', 'aria-modal': 'true', tabindex: '-1' });
    back.append(card);
    const m = { back, card, render: renderFn, label, dismissible, onClose, prevFocus: document.activeElement, update: null };
    stack.forEach((o) => { o.back.hidden = true; });
    root.append(back);
    stack.push(m);
    render(m);
    back.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dismissible) { e.stopPropagation(); close(m); }
      if (e.key === 'Tab') {
        const f = [...card.querySelectorAll(FOCUSABLE)];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    focusIn(m);
    return m;
  }
  function close(m) {
    const i = stack.indexOf(m);
    if (i < 0) return;
    stack.splice(i, 1);
    m.back.remove();
    const top = stack[stack.length - 1];
    if (top) { top.back.hidden = false; focusIn(top); }
    else if (m.prevFocus && m.prevFocus.focus && document.contains(m.prevFocus)) m.prevFocus.focus();
    if (m.onClose) m.onClose();
  }
  onLangChange(() => stack.forEach((m) => { render(m); }));

  /** Modal that re-renders itself when sigFn(state) changes. */
  function openLive(renderFn, sigFn, opts) {
    let sig = null;
    const m = open(renderFn, opts);
    sig = sigFn(ctx.getState()) + getLang();
    m.update = (state) => {
      const s = sigFn(state) + getLang();
      if (s !== sig) { sig = s; rerender(m); }
    };
    return m;
  }

  function pump() {
    if (eventModal || overOpen || !queue.length) return;
    const fn = queue.shift();
    eventModal = fn();
    const prev = eventModal.onClose;
    eventModal.onClose = () => { if (prev) prev(); eventModal = null; pump(); };
  }
  const enqueue = (fn) => { queue.push(fn); pump(); };
  const closeBtn = (mm, key = 'ui.gotIt', focus = true) => el('button', { type: 'button', class: 'btn btn-primary', 'data-autofocus': focus ? '' : null, onclick: () => close(mm) }, t(key));

  // ---- content builders
  function panelNodes(id, extra) {
    const info = SCIENCE_PANELS[id];
    const out = [el('div', { class: 'modal-header' }, el('p', { class: 'modal-eyebrow' }, icon('science'), t('design.science')), el('h2', {}, t('panel.' + id + '.title'))), el('p', { class: 'science-body' }, t('panel.' + id + '.body'))];
    if (info && info.donki && extra && extra.spe) out.push(realEventLine(extra.spe));
    out.push(el('p', { class: 'panel-note' }, t('ui.panelNote')));
    if (info) {
      const list = info.sources || [{ name: info.sourceName, url: info.url }];
      const links = [];
      list.forEach((s, i) => {
        if (i) links.push('; ');
        links.push(el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.name));
      });
      out.push(el('p', { class: 'panel-source' }, t('ui.source') + ': ', links));
    }
    return out;
  }

  function showScienceNow(id, extra) {
    return open((mm) => [...panelNodes(id, extra), closeBtn(mm)], { label: () => t('panel.' + id + '.title') });
  }

  const cargoItems = (cargo) => Object.entries(cargo || {}).filter(([, n]) => n > 0)
    .map(([k, n]) => el('li', {}, t('res.' + k) + ': ' + fmt(n, 0) + (k === 'food' ? ' kg' : '')));
  const nameOf = (state, id) => (state.colonists.find((c) => c.id === id) || {}).name || String(id);

  // ---- ship
  function shipIncomingNodes(mm, manifest, arrivesAt) {
    const state = ctx.getState();
    const cands = (manifest && manifest.candidates) || [];
    return [
      el('h2', {}, t('ui.shipIncomingTitle')),
      el('p', { class: 'big num' }, t('ui.shipArrivesIn', { n: fmt(Math.max(0, Math.ceil((arrivesAt != null ? arrivesAt : state.ship.nextArrivalT) - state.t)), 0) })),
      el('h3', {}, t('ui.cargo')), el('ul', {}, cargoItems(manifest && manifest.cargo)),
      el('h3', {}, t('ui.manifest')),
      cands.length ? el('ul', {}, cands.map((c) => el('li', {}, t('ui.candidate', { name: c.name, prof: profName(c.profession) }))))
        : el('p', { class: 'muted' }, t('ui.noManifest')),
      closeBtn(mm),
    ];
  }

  function showShipDecisionNow() {
    if (decisionModal && stack.includes(decisionModal)) return decisionModal;
    const checked = new Set();
    let init = false;
    const offerOf = () => (ctx.getState().ship && ctx.getState().ship.offer) || [];
    const m = open((mm) => {
      const offer = offerOf();
      lastOffer = offer;
      if (!init) { init = true; offer.forEach((o) => { if (o.ok) checked.add(o.idx); }); }
      const rows = offer.map((o) => {
        const id = 'cand-' + o.idx;
        return el('li', { class: 'cand' },
          el('input', {
            type: 'checkbox', id, 'data-fid': id, checked: checked.has(o.idx) && o.ok, disabled: !o.ok,
            onchange: (e) => { if (e.target.checked) checked.add(o.idx); else checked.delete(o.idx); },
          }),
          el('label', { for: id },
            el('strong', {}, o.name), ' · ', profName(o.profession), el('br'),
            o.ok ? el('span', { class: 'tag-ok' }, t('ui.candOk')) : el('span', { class: 'tag-no' }, t('ui.candNo', { r: tr(o.reason) })),
            o.profession ? el('div', { class: 'small muted' }, t('prof.' + o.profession + '.bonus')) : null));
      });
      return [
        el('h2', {}, t('ui.shipChooseTitle')),
        el('p', {}, t('ui.shipChooseInfo')),
        el('ul', { class: 'cand-list' }, rows),
        el('button', {
          type: 'button', class: 'btn btn-primary', 'data-autofocus': '',
          onclick: () => { const r = ctx.act({ type: 'shipDecision', acceptIdx: [...checked].sort((a, b) => a - b) }); if (r.ok) close(mm); },
        }, t('ui.confirm')),
      ];
    }, { dismissible: false, label: () => t('ui.shipChooseTitle') });
    m.update = (state) => { if (!(state.ship && state.ship.awaitingDecision)) close(m); };
    const prev = m.onClose;
    m.onClose = () => { decisionModal = null; if (prev) prev(); };
    decisionModal = m;
    return m;
  }

  function showLandedNow(info) {
    return open((mm) => [
      el('h2', {}, t('ui.shipTitle')),
      info.cargo ? [el('h3', {}, t('ui.cargo')), el('ul', {}, cargoItems(info.cargo))] : null,
      el('h3', {}, t('ui.landedSummary')),
      info.landedNames.length ? el('ul', {}, info.landedNames.map((n) => el('li', {}, n))) : el('p', {}, t('ui.nobodyLanded')),
      info.refused.length ? [el('h3', {}, t('ui.refused')), el('ul', {}, info.refused.map((r) => {
        const o = lastOffer.find((x) => x.idx === r.idx);
        return el('li', {}, (o ? o.name + ': ' : '') + tr(r.reason));
      }))] : null,
      closeBtn(mm),
    ], { label: () => t('ui.shipTitle') });
  }

  // ---- technologies
  function techNodes(mm) {
    const state = ctx.getState();
    const opts = sel.techOptions ? sel.techOptions(state) : null;
    if (!opts) return [el('h2', {}, t('ui.techTitle')), el('p', { class: 'muted' }, t('ui.noTech')), closeBtn(mm, 'ui.close')];
    const have = new Set(opts.filter((o) => o.unlocked).map((o) => o.id));
    const cards = opts.filter((o) => !Array.isArray(state.unlocked.techs) || state.unlocked.techs.includes(o.id)).map((o) => {
      const reqs = o.requires || [];
      const met = reqs.every((r) => have.has(r));
      const st = o.unlocked ? 'unlocked' : met ? 'available' : 'locked';
      return el('li', { class: 'tech-card ' + st },
        el('span', { class: 'tech-state' }, t('ui.techState.' + st)),
        el('h3', {}, t('tech.' + o.id + '.name')),
        el('p', { class: 'small' }, t('tech.' + o.id + '.desc')),
        el('p', { class: 'small muted' }, t('ui.techReal', { real: t('tech.' + o.id + '.real') })),
        el('p', { class: 'small num' }, t('ui.techCost', { n: o.cost })),
        reqs.length ? el('p', { class: 'small' }, t('ui.techRequires', { name: reqs.map((r) => t('tech.' + r + '.name')).join(', ') })) : null,
        o.unlocked ? null : el('button', {
          type: 'button', class: 'btn btn-primary', 'data-fid': 'tech-' + o.id, disabled: !o.ok,
          onclick: () => ctx.act({ type: 'research', techId: o.id }),
        }, t('ui.research')),
        !o.unlocked && !o.ok && o.reason ? el('p', { class: 'reason' }, tr(o.reason)) : null);
    });
    return [
      el('h2', {}, t('ui.techTitle')),
      el('p', { class: 'num' }, t('ui.techScience', { n: fmt(state.resources.science, 0) })),
      el('ul', { class: 'tech-grid' }, cards),
      closeBtn(mm, 'ui.close', false),
    ];
  }
  const techSig = (state) => (sel.techOptions ? sel.techOptions(state).map((o) => o.id + o.unlocked + o.ok + (o.reason || '')).join(',') : '-') + Math.floor(state.resources.science);

  // ---- expeditions
  function expeditionNodes(mm, siteId, pick) {
    const state = ctx.getState();
    const siteName = t('site.' + siteId);
    const opts = sel.expeditionOptions ? sel.expeditionOptions(state) : null;
    const o = opts && opts.find((x) => x.site === siteId);
    const out = [el('h2', {}, t('ui.expTitle', { site: siteName }))];
    out.push(el('p', { class: state.env.comm && state.env.comm.blackout ? 'reason' : 'small' },
      t(state.env.comm && state.env.comm.blackout ? 'comm.expeditionBlackout' : 'comm.expeditionWarning', { n: fmt(sel.speWarningSols(state), 2) })));
    if (!o) { out.push(el('p', { class: 'muted' }, t('ui.sitesSoon')), closeBtn(mm, 'ui.close')); return out; }
    const free = state.colonists.filter((c) => c.status === 'active' && c.location !== 'expedition');
    if (pick.id == null || !free.some((c) => c.id === pick.id)) pick.id = free.length ? (free.find((c) => c.profession === 'geologist') || free[0]).id : null;
    out.push(el('ul', { class: 'rates' },
      el('li', { class: 'num' }, t('ui.expTime', { n: fmt(o.sols, 0) })),
      el('li', { class: 'num' }, t('ui.expEnergy', { n: fmt(o.energy, 0) })),
      el('li', {}, t('ui.expReward', { c: costText(o.reward) })),
      el('li', { class: 'num' }, t('ui.expScience', { n: fmt(o.science, 0) }))));
    if (free.length) {
      const select = el('select', { id: 'exp-who', 'data-fid': 'exp-who', onchange: (e) => { pick.id = e.target.value; rerender(mm); } },
        free.map((c) => el('option', { value: String(c.id), selected: c.id === pick.id }, c.name + ' (' + profName(c.profession) + ')')));
      out.push(el('label', { for: 'exp-who', class: 'field-label' }, t('ui.expWho')), select);
      const who = free.find((c) => c.id === pick.id);
      if (free.some((c) => c.profession === 'geologist')) {
        out.push(el('p', { class: 'small ' + (who && who.profession === 'geologist' ? '' : 'muted') }, t('ui.expGeoNote')));
      }
    } else out.push(el('p', { class: 'muted' }, t('ui.expNoOne')));
    const canGo = o.ok && pick.id != null;
    out.push(el('button', {
      type: 'button', class: 'btn btn-primary', 'data-autofocus': '', 'data-fid': 'exp-go', disabled: !canGo,
      onclick: () => { const r = ctx.act({ type: 'startExpedition', site: siteId, colonistId: pick.id }); if (r.ok) close(mm); },
    }, t('ui.expStart')));
    if (!o.ok && o.reason) out.push(el('p', { class: 'reason' }, tr(o.reason)));
    const active = (state.expeditions || []).filter((e) => e.site === siteId);
    if (active.length) {
      out.push(el('h3', {}, t('ui.expActive')));
      for (const e of active) {
        const pct = Math.round(Math.max(0, Math.min(1, (state.t - e.startT) / Math.max(0.001, e.endT - e.startT))) * 100);
        out.push(el('div', { class: 'exp-row' },
          el('p', { class: 'num' }, t('ui.expProgress', { name: nameOf(state, e.colonistId), n: pct })),
          el('div', { class: 'bar', role: 'presentation' }, el('i', { style: 'width:' + pct + '%' })),
          e.stuckRevealed ? el('p', { class: 'reason' }, t('ui.expStuck')) : null,
          e.recalled ? el('p', { class: 'small muted' }, t('ui.expRecalled'))
            : el('button', { type: 'button', class: 'btn', 'data-fid': 'recall-' + e.id, onclick: () => ctx.act({ type: 'recallExpedition', id: e.id }) }, t('ui.expRecall'))));
      }
    }
    out.push(el('button', { type: 'button', class: 'btn', onclick: () => close(mm) }, t('ui.close')));
    return out;
  }
  const expSig = (state, siteId) => {
    const o = sel.expeditionOptions ? sel.expeditionOptions(state).find((x) => x.site === siteId) : null;
    return [o && o.ok, o && o.reason, state.env.comm && state.env.comm.blackout, sel.speWarningSols(state).toFixed(2), state.colonists.map((c) => c.id + c.location + c.status).join(','),
      (state.expeditions || []).map((e) => e.id + ':' + e.stuck + e.recalled + ':' + Math.floor(((state.t - e.startT) / Math.max(0.001, e.endT - e.startT)) * 50)).join(',')].join('|');
  };

  // ---- game over breakdown
  function scoreRows(state) {
    const st = state.stats || {};
    const sols = Math.floor(state.t); // the core scores completed sols
    const rows = [
      [t('ui.sc.sols', { n: sols }), sols * (SCORE.perSol || 0)],
      [t('ui.sc.pop', { n: st.popPeak || 0 }), (st.popPeak || 0) * (SCORE.perPopPeak || 0)],
      [t('ui.sc.tech', { n: ((state.tech && state.tech.unlocked) || []).length }), ((state.tech && state.tech.unlocked) || []).length * (SCORE.perTech || 0)],
      [t('ui.sc.panels', { n: (st.panelsSeen || []).length }), (st.panelsSeen || []).length * (SCORE.perPanel || 0)],
    ];
    if (st.selfSufficientAt != null) rows.push([t('ui.sc.self'), SCORE.selfSufficient || 0]);
    return rows;
  }

  return {
    open, close, enqueue, rerender,
    isOpen: () => stack.length > 0,
    update(state) { const top = stack[stack.length - 1]; if (top && top.update) top.update(state); },
    closeAll() { queue.length = 0; overOpen = false; decisionModal = null; [...stack].forEach((m) => close(m)); },
    showScience(id, extra) { enqueue(() => showScienceNow(id, extra)); },
    openPanelFromNotebook(id) { showScienceNow(id); },
    /** Phase 1 style summary (core without ship offers). */
    showShip(info) {
      enqueue(() => open((mm) => [
        el('h2', {}, t('ui.shipTitle')),
        el('h3', {}, t('ui.cargo')), el('ul', {}, cargoItems(info.cargo)),
        el('h3', {}, t('ui.landed')),
        info.landedNames.length ? el('ul', {}, info.landedNames.map((n) => el('li', {}, n))) : el('p', {}, t('ui.nobodyLanded')),
        info.refused.length ? [el('h3', {}, t('ui.refused')), el('ul', {}, info.refused.map((r) => el('li', {}, tr(r.reason))))] : null,
        closeBtn(mm),
      ], { label: () => t('ui.shipTitle') }));
    },
    showShipIncoming(manifest, arrivesAt) {
      enqueue(() => openLive((mm) => shipIncomingNodes(mm, manifest, arrivesAt),
        (state) => Math.ceil((arrivesAt != null ? arrivesAt : state.ship.nextArrivalT) - state.t), { label: () => t('ui.shipIncomingTitle') }));
    },
    /** Opens the manifest of the ship on its way (from the HUD chip). */
    showShipInfo(state) {
      const mf = state.ship && state.ship.manifest;
      if (!mf) return false;
      openLive((mm) => shipIncomingNodes(mm, mf, state.ship.nextArrivalT),
        (s) => Math.ceil(s.ship.nextArrivalT - s.t), { label: () => t('ui.shipIncomingTitle') });
      return true;
    },
    showShipDecision() { enqueue(showShipDecisionNow); },
    openShipDecisionNow() { if (!decisionModal) showShipDecisionNow(); },
    showShipLanded(info) { enqueue(() => showLandedNow(info)); },
    showTech() { openLive(techNodes, techSig, { wide: true, label: () => t('ui.techTitle') }); },
    showExpedition(siteId) {
      const pick = { id: null };
      openLive((mm) => expeditionNodes(mm, siteId, pick), (s) => expSig(s, siteId), { label: () => t('ui.expTitle', { site: t('site.' + siteId) }) });
    },
    showMilestone() {
      enqueue(() => open((mm) => [el('h2', {}, t('ui.milestoneTitle')), el('p', { class: 'big' }, t('ui.milestoneBody')), closeBtn(mm)],
        { label: () => t('ui.milestoneTitle') }));
    },
    showHelp(hintKey) {
      open((mm) => [el('h2', {}, t('ui.hintTitle')), el('p', { class: 'big' }, t(hintKey)), closeBtn(mm)], { label: () => t('ui.hintTitle') });
    },
    showGlossary() {
      open((mm) => [el('h2', {}, t('ui.glossaryTitle')),
        el('dl', { class: 'glossary' }, ['sol', 'kwh', 'msv', 'tau'].map((k) => [el('dt', {}, t('glossary.' + k + '.term')), el('dd', {}, t('glossary.' + k + '.def'))])),
        closeBtn(mm, 'ui.close')],
      { label: () => t('ui.glossaryTitle') });
    },
    showNotebook(state) {
      open((mm) => createNotebookContent(state, (id) => showScienceNow(id), () => close(mm)), { label: () => t('ui.notebook') });
    },
    showNasaData() {
      open((mm) => [...nasaDataNodes((id) => showScienceNow(id)), closeBtn(mm, 'ui.close')], { wide: true, label: () => t('data.title') });
    },
    showOver(over, state) {
      queue.length = 0;
      overOpen = true;
      if (state.story) {
        open(() => [
          el('h2', {}, t('story.failTitle')),
          el('p', { class: 'big' }, t('story.failBody')),
          el('p', {}, t('over.' + over.reason)),
          panelNodes('over.' + over.reason),
          el('div', { class: 'btn-row' },
            el('button', { type: 'button', class: 'btn btn-primary', 'data-autofocus': '', onclick: () => ctx.retryStory() }, t('story.retry')),
            el('button', { type: 'button', class: 'btn', onclick: () => ctx.exitStory() }, t('story.toMenu'))),
        ], { dismissible: false, label: () => t('story.failTitle') });
        return;
      }
      open(() => [
        el('h2', {}, t('ui.gameOver')),
        el('p', { class: 'big' }, t('over.' + over.reason)),
        el('p', {}, t('ui.survived', { n: sel.getSol(state) })),
        el('h3', {}, t('ui.scoreBreakdown')),
        el('table', { class: 'score-table' }, el('tbody', {}, scoreRows(state).map(([a, b]) => el('tr', {}, el('td', {}, a), el('td', { class: 'num' }, '+' + fmt(b, 0)))))),
        el('p', { class: 'score' }, t('ui.score', { n: fmt(over.score || 0, 0) })),
        panelNodes('over.' + over.reason),
        el('button', { type: 'button', class: 'btn btn-primary', 'data-autofocus': '', onclick: () => ctx.playAgain() }, t('ui.playAgain')),
      ], { dismissible: false, label: () => t('ui.gameOver') });
    },
    showPause() {
      if (stack.length) return;
      open((mm) => [
        el('h2', {}, t('pause.title')),
        el('div', { class: 'btn-col' },
          el('button', { type: 'button', class: 'btn btn-primary', 'data-autofocus': '', onclick: () => close(mm) }, t('pause.resume')),
          el('button', { type: 'button', class: 'btn', onclick: () => ctx.saveNow() }, t('pause.save')),
          el('button', { type: 'button', class: 'btn btn-danger-outline', onclick: () => ctx.exitGame() }, t('pause.exit'))),
        el('p', { class: 'small muted' }, t('pause.hint')),
      ], { label: () => t('pause.title') });
    },
    showInfo() {
      const link = (u) => el('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, u);
      open((mm) => [
        el('h2', {}, t('info.title')),
        el('section', { class: 'info-sec' }, el('h3', {}, t('info.donki.name')), el('p', {}, t('info.donki.body')), el('p', { class: 'small' }, link('https://ccmc.gsfc.nasa.gov/tools/DONKI/'))),
        el('section', { class: 'info-sec' }, el('h3', {}, t('info.osdr.name')), el('p', {}, t('info.osdr.body')), el('p', { class: 'small' }, link('https://osdr.nasa.gov/bio/repo/search?q=&data_source=cgene,alsda,esa&data_type=study'))),
        closeBtn(mm, 'ui.close'),
      ], { label: () => t('info.title') });
    },
    showProgress() {
      openLive((mm) => {
        const p = colonyProgress(ctx.getState());
        return [
          el('h2', {}, t('prog.title')),
          el('p', { class: 'big num' }, t('prog.pct', { n: p.pct })),
          el('div', { class: 'bar', role: 'presentation' }, el('i', { style: 'width:' + p.pct + '%' })),
          el('ul', { class: 'prog-list' }, p.rows.map((r) => el('li', { class: r.ok ? 'ok' : 'no' },
            el('span', { 'aria-hidden': 'true' }, r.ok ? '✓ ' : '○ '), t('prog.' + r.id, { n: r.n, max: r.max }) + ' · ' + t(r.ok ? 'prog.ok' : 'prog.notYet')))),
          el('p', { class: 'small muted' }, t('prog.goal')),
          closeBtn(mm, 'ui.close'),
        ];
      }, (s) => { const p = colonyProgress(s); return p.pct + p.rows.map((r) => r.ok).join(''); }, { label: () => t('prog.title') });
    },
    showModuleScience(type) {
      if (!type) return;
      open((mm) => [
        el('h2', {}, t('mod.' + type + '.name')),
        el('p', { class: 'big' }, t('mod.' + type + '.science')),
        closeBtn(mm, 'ui.close'),
      ], { label: () => t('mod.' + type + '.name') });
    },
    showStart() {
      ctx.setLaunchScreen(true);
      let diff = 'cadet';
      let realSun = false;
      let starting = false;
      const m = open((mm) => {
        const dbtn = (id, nameKey, descKey) => el('button', { type: 'button', class: 'diff-btn', 'data-fid': 'difficulty-' + id, 'aria-pressed': String(diff === id), onclick: () => { diff = id; rerender(mm); } },
          el('strong', {}, t(nameKey)), el('span', { class: 'small' }, t(descKey)));
        const save = ctx.getSave();
        return [
          el('header', { class: 'launch-brand' },
            el('p', { class: 'launch-kicker' }, icon('ship'), t('design.mission')),
            el('h1', { class: 'launch-title' }, t('ui.title')),
            el('p', { class: 'launch-intro' }, t('design.intro')),
            el('p', { class: 'launch-ara small' }, t('ara.line')),
            el('div', { class: 'launch-meta' },
              el('span', {}, icon('regolith'), t('design.explore')),
              el('span', {}, icon('parts'), t('design.build')),
              el('span', {}, icon('pop'), t('design.care')))),
          save ? el('div', { class: 'launch-resume' },
            el('button', { type: 'button', class: 'btn btn-primary', 'data-autofocus': '', onclick: () => ctx.continueGame() },
              icon('ship'), t('ui.continue'), el('span', { 'aria-hidden': 'true' }, '→')),
            el('p', { class: 'small muted' }, save.mode === 'story' ? t('story.continueInfo', { n: save.chapter || 1, s: save.sol }) : t('ui.continueInfo', { n: save.sol, d: t('ui.diffName.' + save.difficulty) }))) : null,
          el('section', { class: 'launch-setup', 'aria-label': t('ui.difficulty') },
            el('h2', { class: 'launch-label' }, t('ui.difficulty')),
            el('div', { class: 'diff-row' }, dbtn('cadet', 'ui.diffCadet', 'ui.diffCadetDesc'), dbtn('commander', 'ui.diffCommander', 'ui.diffCommanderDesc')),
            el('div', { class: 'launch-sun-option' },
              el('label', { class: 'setting-row' },
                el('input', { type: 'checkbox', checked: realSun, disabled: starting, onchange: (e) => { realSun = e.target.checked; } }),
                el('span', {}, t('sun.mode'))),
              el('p', { class: 'small muted' }, t('sun.modeInfo')))),
          el('div', { class: 'launch-actions' },
            el('button', { type: 'button', class: 'btn' + (save ? '' : ' btn-primary'), disabled: starting, 'data-autofocus': save ? null : '', onclick: () => { starting = true; render(mm); ctx.startColony(diff, realSun).catch(() => { starting = false; render(mm); }); } },
              el('span', {}, starting ? t('sun.starting') : save ? t('ui.newGame') : t('ui.modeColony')), el('span', { 'aria-hidden': 'true' }, '→')),
            el('button', { type: 'button', class: 'btn launch-story', disabled: starting, onclick: () => { close(m); ctx.openStoryMenu(); } }, t('ui.modeStory'))),
          el('p', { class: 'launch-mode-note' }, t('design.modeNote')),
          el('section', { class: 'launch-secondary' }, createSunWidget(),
            el('div', { class: 'launch-links' },
              el('button', { type: 'button', class: 'link-btn', onclick: () => ctx.openNasaData() }, icon('science'), t('data.title')),
              el('div', { class: 'start-lang' }, langToggle()))),
          el('footer', { class: 'launch-footer' }, el('p', {}, t('design.disclaimer')), el('p', {}, t('ui.keysHint'))),
        ];
      }, { dismissible: false, label: () => t('ui.title'), className: 'launch-modal', backClass: 'launch-back' });
      return m;
    },
  };
}
