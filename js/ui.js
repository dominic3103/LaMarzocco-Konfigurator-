// ---------------------------------------------------------------------------
// Bedienoberfläche des Konfigurators
// ---------------------------------------------------------------------------
import {
  CATEGORIES,
  BODY_COLLECTIONS,
  BODY_FINISHES,
  collectionOf,
  METAL_COLORS,
  METAL_FINISHES,
  WOODS,
  WOOD_FINISHES,
  GAUGES,
  GAUGE_DIALS,
  NEEDLES,
  needleById,
  SCREW_HEADS,
  RAIL_STYLES,
  TRAY_STYLES,
  LOGO_WOODS,
  PRESETS,
  KNOB_SHAPES,
  HANDLE_SHAPES,
  resolveBody,
  resolveMetal,
  resolveWood,
  finishName,
  categoryOf,
} from './data.js';
import { woodPreviewURL } from './wood.js';
import { gaugePreviewURL } from './textures.js';

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
};

function mix(hex, other, t) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(other.slice(1), 16);
  const ch = (n, s) => (n >> s) & 255;
  const r = Math.round(ch(a, 16) + (ch(b, 16) - ch(a, 16)) * t);
  const g = Math.round(ch(a, 8) + (ch(b, 8) - ch(a, 8)) * t);
  const bl = Math.round(ch(a, 0) + (ch(b, 0) - ch(a, 0)) * t);
  return `rgb(${r},${g},${bl})`;
}

/** CSS-Hintergrund für eine Farbkachel (Metallic mit Glanzverlauf). */
export function swatchBackground(color, kind) {
  if (kind === 'metal') {
    return `linear-gradient(135deg, ${mix(color, '#ffffff', 0.55)} 0%, ${color} 38%, ${mix(color, '#000000', 0.35)} 62%, ${mix(color, '#ffffff', 0.35)} 100%)`;
  }
  if (kind === 'metallic') {
    return `radial-gradient(circle at 30% 25%, ${mix(color, '#ffffff', 0.45)} 0%, ${color} 45%, ${mix(color, '#000000', 0.35)} 100%)`;
  }
  return color;
}

// unregelmäßiges Glitzerkorn (SVG-Rauschen, helle + dunkle Partikel)
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>" +
    "<filter id='a'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' seed='3'/>" +
    "<feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 9 -6.4'/></filter>" +
    "<filter id='b'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='8'/>" +
    "<feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 7 -4.6'/></filter>" +
    "<rect width='120' height='120' filter='url(#b)' opacity='.45'/>" +
    "<rect width='120' height='120' filter='url(#a)' opacity='.8'/></svg>",
)}")`;

/** Kachel-Hintergrund für Pulverlacke: Uni flach, Effekt mit Schimmer, U mit Glitzerkorn. */
export function paintBackground(c) {
  const fx = c.effect || (c.kind === 'metallic' ? 'M' : 'A');
  if (fx === 'A') return c.color;
  const sheen = `linear-gradient(135deg, ${mix(c.color, '#ffffff', 0.22)} 0%, ${c.color} 45%, ${mix(c.color, '#000000', 0.18)} 100%)`;
  if (fx === 'U' || c.sparkle) return `${GRAIN} center / 120px 120px, ${sheen}`;
  return sheen;
}

const ICONS = {
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  pointer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 7-6 2-2 6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};

/** Bezeichnung eines Bauteils, z. B. "Seitenplatten unten" */
const SLOT_INFO = Object.fromEntries(
  Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => [s.key, { label: s.label, cat: c.title }])),
);
const MAIN_WOOD = ['wood.paddle', 'wood.knobs', 'wood.handle'];
const woodGradient = (w) => `linear-gradient(100deg, ${w.light}, ${w.mid} 45%, ${w.dark} 55%, ${w.mid} 70%, ${w.light})`;

export class ConfiguratorUI {
  /**
   * @param {HTMLElement} root   Container des Panels
   * @param {object} opts        { getConfig, onSlots(keys, patch), onDial(id), onPreset(config), onFocus(keys) }
   */
  constructor(root, opts) {
    this.root = root;
    this.opts = opts;
    // Produkt-Einstellungen (Standard: Maschine); die Mühle übergibt eigene Werte
    this.cats = opts.cats || CATEGORIES;
    this.baseSlot = opts.baseSlot || 'body.base';
    this.idp = opts.idPrefix || '';
    this.target = Object.fromEntries(Object.keys(this.cats).map((k) => [k, 'all']));
    this.gaugeTarget = { step: 'both', edit: 'both' };
    const bodyId = opts.getConfig().slots[opts.primarySlot || 'body.upper'].id;
    this.colorTab = { body: collectionOf(bodyId) || (bodyId === 'custom' ? 'custom' : BODY_COLLECTIONS[0].id), metal: 'metal', rail: 'metal' };
    this.colorTab.edit = 'metal';
    this.open = opts.open || 'body';
    this.refs = { steps: {} };
    this.selected = null;
    this.editor = null;
    this.woodPreviews = new Map();
    this.woodTiles = new Set();
    this.build();
    this.refresh();
    setTimeout(() => this._loadWoodPreviews(), 400);
  }

  // -------------------------------------------------------------------------
  build() {
    const r = this.root;
    r.innerHTML = '';
    r.append(this._buildEditor());

    // Presets
    const presetRow = el('div', { class: 'preset-row', role: 'list' });
    PRESETS.forEach((p, i) => {
      const dots = el(
        'span',
        { class: 'preset-dots', 'aria-hidden': 'true' },
        p.swatches.map((c) => el('span', { style: `background:${c}` })),
      );
      presetRow.append(
        el('button', { class: 'preset', type: 'button', role: 'listitem', 'data-preset': i, onclick: () => this.opts.onPreset(p.config) }, [
          dots,
          el('span', { class: 'preset-name', text: p.name }),
        ]),
      );
    });
    r.append(el('section', { class: 'block presets' }, [el('h2', { class: 'label', text: 'Inspiration' }), presetRow]));

    // Schritte
    const steps = el('div', { class: 'steps' });
    steps.append(this.#buildBodyStep('01'));
    steps.append(this.#buildWoodStep('02'));
    steps.append(this.#buildExtrasStep('03'));
    steps.append(this.#buildPaintStep('metal', '04'));
    steps.append(this.#buildDetailsStep('05'));
    r.append(steps);

    // Zusammenfassung
    this.refs.summary = el('dl', { class: 'summary-list' });
    r.append(
      el('details', { class: 'block summary' }, [
        el('summary', {}, [el('span', { class: 'label', text: 'Ihre Konfiguration' }), el('span', { class: 'chev', html: ICONS.chevron })]),
        this.refs.summary,
      ]),
    );
  }

  _step(cat, num, title, body) {
    const current = el('span', { class: 'step-current' });
    const head = el(
      'button',
      {
        class: 'step-head',
        type: 'button',
        'aria-expanded': 'false',
        'aria-controls': `${this.idp}step-${cat}`,
        onclick: () => {
          this.open = this.open === cat ? null : cat;
          this.refresh();
        },
      },
      [
        el('span', { class: 'step-num', text: num }),
        el('span', { class: 'step-title', text: title }),
        current,
        el('span', { class: 'chev', html: ICONS.chevron }),
      ],
    );
    const section = el('section', { class: 'step', 'data-cat': cat }, [head, el('div', { class: 'step-body', id: `${this.idp}step-${cat}` }, body)]);
    this.refs.steps[cat] = { section, head, current };
    return section;
  }

  _chips(cat) {
    const c = this.cats[cat];
    const wrap = el('div', { class: 'chips', role: 'group', 'aria-label': 'Bauteil wählen' });
    const mk = (key, label) =>
      el('button', {
        class: 'chip',
        type: 'button',
        'data-target': key,
        text: label,
        onclick: () => {
          this.target[cat] = key;
          this.refresh();
          this.opts.onFocus(this._targetKeys(cat));
        },
      });
    wrap.append(mk('all', c.allLabel));
    c.slots.filter((s) => s.chip !== false).forEach((s) => wrap.append(mk(s.key, s.label)));
    return wrap;
  }

  _segmented(items, onPick, cls = '') {
    const wrap = el('div', { class: `seg ${cls}`, role: 'group' });
    items.forEach((it) =>
      wrap.append(el('button', { type: 'button', 'data-id': it.id, text: it.name, onclick: () => onPick(it.id) })),
    );
    return wrap;
  }

  // -------------------------------------------------------------------------
  // Holz-Vorschaukacheln (echte Maserung, einmal berechnet und wiederverwendet)
  _woodTile(w) {
    const tile = el('span', { class: 'wood-tile' });
    tile.style.background = this.woodPreviews.has(w.id) ? `url(${this.woodPreviews.get(w.id)}) center/cover` : woodGradient(w);
    tile.dataset.wood = w.id;
    this.woodTiles.add(tile);
    return tile;
  }

  _loadWoodPreviews() {
    let i = 0;
    const next = () => {
      if (i >= WOODS.length) return;
      const w = WOODS[i++];
      const url = woodPreviewURL(w);
      this.woodPreviews.set(w.id, url);
      for (const t of this.woodTiles) {
        if (!t.isConnected && t.dataset.done) this.woodTiles.delete(t);
        else if (t.dataset.wood === w.id) {
          t.style.background = `url(${url}) center/cover`;
          t.dataset.done = '1';
        }
      }
      setTimeout(next, 0);
    };
    next();
  }

  /**
   * Gehäusefarbe: IGP-DURA®-Kollektionen als Farbkarten + eigene Farbe.
   * @returns {{node: HTMLElement, refresh: (cfg, keys) => string}}
   */
  _bodyPicker(tabKey, getKeys, { compact = false } = {}) {
    const tabs = [...BODY_COLLECTIONS.map((c) => ({ id: c.id, name: c.name })), { id: 'custom', name: 'Eigene Farbe' }];
    const tabBar = this._segmented(
      tabs,
      (id) => {
        this.colorTab[tabKey] = id;
        this.refresh();
      },
      'tabs scroll',
    );
    const grids = {};
    const gridWrap = el('div', { class: 'swatch-wrap' });
    for (const col of BODY_COLLECTIONS) {
      const grid = el('div', { class: `paints${compact ? ' compact' : ''}`, 'data-tab': col.id, role: 'group', 'aria-label': col.name });
      for (const c of col.colors) {
        grid.append(
          el(
            'button',
            {
              class: 'paint',
              type: 'button',
              title: `${c.label || c.name} · ${c.code}`,
              'data-id': c.id,
              onclick: () => this.opts.onSlots(getKeys(), { id: c.id }),
            },
            [
              el('span', { class: 'paint-tile', style: `background:${paintBackground(c)}` }),
              el('span', { class: 'paint-name', text: c.label || c.name }),
              el('span', { class: 'paint-code', text: c.code }),
            ],
          ),
        );
      }
      grids[col.id] = grid;
      gridWrap.append(grid);
    }
    const input = el('input', { type: 'color', value: '#9a8f80', 'aria-label': 'Eigene Farbe wählen' });
    const kindSeg = this._segmented(
      [
        { id: 'uni', name: 'Uni' },
        { id: 'metallic', name: 'Metallic' },
      ],
      (id) => this.opts.onSlots(getKeys(), { id: 'custom', color: input.value, kind: id }),
    );
    input.addEventListener('input', () => {
      const kind = kindSeg.querySelector('button.active')?.dataset.id || 'uni';
      this.opts.onSlots(getKeys(), { id: 'custom', color: input.value, kind });
    });
    const customFill = el('span', { class: 'custom-fill', html: ICONS.plus });
    const customPanel = el('div', { class: 'custom-panel', 'data-tab': 'custom' }, [
      el('label', { class: 'custom-pick' }, [customFill, el('span', { text: 'Farbe wählen' }), input]),
      kindSeg,
      el('p', { class: 'hint-text', text: 'Für Farbtöne außerhalb der IGP-Karten, z. B. RAL-Farben.' }),
    ]);
    gridWrap.append(customPanel);
    const series = el('p', { class: 'series-line' });
    const nameLine = el('p', { class: 'pick-name' });
    const finishSeg = this._segmented(BODY_FINISHES, (id) => this.opts.onSlots(getKeys(), { finish: id }));
    const node = el('div', { class: 'body-picker' }, [
      tabBar,
      series,
      gridWrap,
      nameLine,
      el('div', { class: 'field' }, [
        el('span', { class: 'label', text: 'Oberfläche' }),
        finishSeg,
        el('p', {
          class: 'hint-text small',
          text: 'IGP-DURA® xal 4201 ist laut Hersteller glattverlaufend und tiefmatt. Die anderen Oberflächen dienen nur zum Vergleich.',
        }),
      ]),
    ]);
    const refresh = (cfg, keys) => {
      const vals = keys.map((k) => cfg.slots[k]);
      const first = vals[0];
      const same = (key) => vals.every((v) => v[key] === first[key]);
      const sameId = same('id') && (first.id !== 'custom' || (same('color') && same('kind')));
      const sameFinish = same('finish');
      const resolved = resolveBody(first);
      const tab = this.colorTab[tabKey];
      setActive(tabBar, tab);
      for (const [id, grid] of Object.entries(grids)) {
        grid.hidden = id !== tab;
        grid.querySelectorAll('.paint').forEach((b) => {
          const on = sameId && b.dataset.id === first.id;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', String(on));
        });
      }
      customPanel.hidden = tab !== 'custom';
      const isCustom = sameId && first.id === 'custom';
      if (isCustom) {
        input.value = first.color;
        customFill.style.background = paintBackground(resolved);
      }
      setActive(kindSeg, isCustom ? resolved.kind : kindSeg.querySelector('button.active')?.dataset.id || 'uni');
      const col = BODY_COLLECTIONS.find((c) => c.id === tab);
      series.textContent = col ? `${col.series} – ${col.name}` : 'Eigener Farbton';
      setActive(finishSeg, sameFinish ? first.finish : null);
      const finish = sameFinish ? ' · ' + finishName(BODY_FINISHES, first.finish) : '';
      nameLine.textContent = sameId
        ? `${resolved.name}${resolved.code ? ' · ' + resolved.code : ''}${finish}`
        : 'Mehrere Farben – Auswahl gilt für alle markierten Bauteile';
      return sameId ? `${resolved.name}${finish}` : 'Individuell kombiniert';
    };
    return { node, refresh };
  }

  /** Holzkacheln in zwei Gruppen: rb.crafts-Sortiment (Walnuss, Eiche, Olive) und weitere Hölzer */
  _woodGroups(compact, filter, onPick) {
    const wrap = el('div', { class: 'wood-groups', role: 'group', 'aria-label': 'Holzart' });
    const group = (title, list) => {
      const grid = el('div', { class: `woods${compact ? ' compact' : ''}` });
      for (const w of list) {
        grid.append(
          el('button', { class: 'wood', type: 'button', 'data-id': w.id, title: w.name, onclick: () => onPick(w) }, [
            this._woodTile(w),
            el('span', { class: 'wood-name', text: w.name }),
          ]),
        );
      }
      wrap.append(el('p', { class: 'swatch-group-title', text: title }), grid);
    };
    const all = WOODS.filter(filter);
    group('rb.crafts Hölzer', all.filter((w) => w.rb));
    group('Weitere Hölzer (auf Anfrage)', all.filter((w) => !w.rb));
    return wrap;
  }

  /**
   * Holzauswahl (Holzart + Oberfläche).
   * @param {{panel?: boolean}} o  panel: Kunststoff-Variante ausblenden (Seitenplatten)
   */
  _woodPicker(getKeys, { panel = false, compact = false } = {}) {
    const grid = this._woodGroups(compact, (w) => !(panel && w.plastic), (w) => this.opts.onSlots(getKeys(), { id: w.id }));
    const nameLine = el('p', { class: 'pick-name' });
    const finishSeg = this._segmented(WOOD_FINISHES, (id) => this.opts.onSlots(getKeys(), { finish: id }));
    const node = el('div', { class: 'wood-picker' }, [
      grid,
      nameLine,
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Oberfläche' }), finishSeg]),
    ]);
    const refresh = (cfg, keys) => {
      const vals = keys.map((k) => cfg.slots[k]);
      const first = vals[0];
      const sameId = vals.every((v) => v.id === first.id);
      const sameFinish = vals.every((v) => v.finish === first.finish);
      grid.querySelectorAll('.wood').forEach((b) => {
        const on = sameId && b.dataset.id === first.id;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      setActive(finishSeg, sameFinish ? first.finish : null);
      const w = resolveWood(first);
      const text = sameId ? `${w.name}${sameFinish && !w.none ? ' · ' + finishName(WOOD_FINISHES, first.finish) : ''}` : 'Individuell kombiniert';
      nameLine.textContent = sameId ? text : 'Mehrere Holzarten – Auswahl gilt für alle markierten Bauteile';
      return text;
    };
    return { node, refresh };
  }

  /** Gehäuse-Schritt */
  #buildBodyStep(num) {
    const picker = this._bodyPicker('body', () => this._targetKeys('body'));
    const step = this._step('body', num, CATEGORIES.body.title, [this._chips('body'), picker.node]);
    Object.assign(this.refs.steps.body, { picker });
    return step;
  }

  /**
   * Farbwahl für Akzentteile (Metall/PVD, Lack inkl. "Wie Gehäuse", IGP/RAL-Pulverlack).
   * @param {string} tabKey  Schlüssel in this.colorTab
   * @param {() => string[]} getKeys  Ziel-Slots
   */
  _accentPicker(tabKey, getKeys, { wood = false } = {}) {
    const tabs = [
      { id: 'metal', name: 'Metall / PVD' },
      { id: 'uni', name: 'Lack & Gehäuse' },
      { id: 'igp', name: 'IGP / RAL' },
    ];
    if (wood) tabs.unshift({ id: 'wood', name: 'Holz' });
    const tabBar = this._segmented(
      tabs,
      (id) => {
        this.colorTab[tabKey] = id;
        this.refresh();
      },
      'tabs',
    );
    const swatch = (c, bg) =>
      el(
        'button',
        {
          class: 'swatch',
          type: 'button',
          title: c.code ? `${c.name} · ${c.code}` : c.name,
          'aria-label': c.name,
          'data-id': c.id,
          onclick: () => this.opts.onSlots(getKeys(), { id: c.id }),
        },
        [el('span', { class: 'swatch-fill', style: `background:${bg}` })],
      );
    const grids = {};
    const wrap = el('div', { class: 'swatch-wrap' });
    for (const t of ['metal', 'uni']) {
      const grid = el('div', { class: 'swatches', 'data-tab': t, role: 'group' });
      for (const c of METAL_COLORS[t]) grid.append(swatch(c, swatchBackground(c.color, t)));
      const input = el('input', { type: 'color', value: METAL_COLORS[t][1].color, 'aria-label': 'Eigene Farbe wählen' });
      input.addEventListener('input', () => this.opts.onSlots(getKeys(), { id: 'custom', color: input.value, kind: t }));
      grid.append(
        el('label', { class: 'swatch custom', title: 'Eigene Farbe', 'data-id': 'custom' }, [
          el('span', { class: 'swatch-fill', html: ICONS.plus }),
          input,
        ]),
      );
      grids[t] = { grid, input };
      wrap.append(grid);
    }
    // alle Pulverlacke der Farbkarten (IGP) und RAL, nach Kollektion
    const igp = el('div', { class: 'swatch-groups', 'data-tab': 'igp' });
    for (const col of BODY_COLLECTIONS) {
      const g = el('div', { class: 'swatches' });
      const seen = new Set();
      for (const c of col.colors) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        g.append(swatch({ ...c, name: c.label || c.name }, paintBackground(c)));
      }
      igp.append(el('p', { class: 'swatch-group-title', text: col.name }), g);
    }
    grids.igp = { grid: igp, input: null };
    wrap.append(igp);
    if (wood) {
      // Holz-Schriftzug (magnetisch), in den drei rb.crafts-Hölzern
      const wg = el('div', { class: 'woods compact', 'data-tab': 'wood', role: 'group' });
      for (const id of LOGO_WOODS) {
        const w = WOODS.find((x) => x.id === id);
        wg.append(
          el(
            'button',
            { class: 'wood swatch', type: 'button', 'data-id': `wood:${id}`, title: w.name, onclick: () => this.opts.onSlots(getKeys(), { id: `wood:${id}`, finish: 'oiled' }) },
            [this._woodTile(w), el('span', { class: 'wood-name', text: w.name })],
          ),
        );
      }
      grids.wood = { grid: wg, input: null };
      wrap.append(wg);
    }
    const nameLine = el('p', { class: 'pick-name' });
    const finishSeg = this._segmented(METAL_FINISHES, (id) => this.opts.onSlots(getKeys(), { finish: id }));
    const node = el('div', { class: 'accent-picker' }, [
      tabBar,
      wrap,
      nameLine,
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Oberfläche' }), finishSeg]),
    ]);
    const refresh = (cfg, keys) => {
      const vals = keys.map((k) => cfg.slots[k]);
      const first = vals[0];
      const same = (key) => vals.every((v) => v[key] === first[key]);
      const sameId = same('id') && (first.id !== 'custom' || (same('color') && same('kind')));
      const sameFinish = same('finish');
      const resolved = resolveMetal(first);
      const tab = this.colorTab[tabKey];
      setActive(tabBar, tab);
      for (const [t, { grid, input }] of Object.entries(grids)) {
        grid.hidden = t !== tab;
        grid.querySelectorAll('.swatch').forEach((b) => {
          const on = sameId && b.dataset.id === first.id && (first.id !== 'custom' || resolved.kind === t);
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        if (input && sameId && first.id === 'custom' && resolved.kind === t) {
          input.value = first.color;
          grid.querySelector('.custom .swatch-fill').style.background = first.color;
        }
      }
      const bodyTile = grids.uni.grid.querySelector('[data-id="body"] .swatch-fill');
      if (bodyTile) bodyTile.style.background = paintBackground(resolveBody(cfg.slots[this.baseSlot]));
      setActive(finishSeg, sameFinish ? first.finish : null);
      const label = resolved.kind === 'body' ? `Wie Gehäuse (${resolveBody(cfg.slots[this.baseSlot]).name})` : resolved.name;
      const isWood = resolved.kind === 'wood';
      const fin = isWood ? 'Geölt' : finishName(METAL_FINISHES, first.finish);
      finishSeg.classList.toggle('dimmed', sameId && isWood);
      const text = sameId ? `${label}${sameFinish ? ' · ' + fin : ''}` : 'Individuell kombiniert';
      nameLine.textContent = sameId
        ? `${label}${resolved.code ? ' · ' + resolved.code : ''}${sameFinish ? ' · ' + fin : ''}`
        : 'Mehrere Farben – Auswahl gilt für alle markierten Bauteile';
      return text;
    };
    return { node, refresh };
  }

  #buildPaintStep(cat, num) {
    const picker = this._accentPicker('metal', () => this._targetKeys(cat));
    const step = this._step(cat, num, CATEGORIES[cat].title, [this._chips(cat), picker.node]);
    Object.assign(this.refs.steps[cat], { picker });
    return step;
  }

  /** Seitenplatten (Holz) und Cup Rail – die typischen Anbauteile der veredelten Linea Mini R */
  #buildExtrasStep(num) {
    const modes = [
      { id: 'upper', name: 'Umrandung oben' },
      { id: 'lower', name: 'Platten unten' },
      { id: 'both', name: 'Beides' },
      { id: 'none', name: 'Ohne' },
    ];
    const modeSeg = this._segmented(modes, (id) => this.opts.onPanels(id));
    const woodGrid = this._woodGroups(true, (w) => !w.plastic, (w) => this.opts.onPanelWood(w.id));
    const panelKeys = () => {
      const cfg = this.opts.getConfig();
      return ['wood.panelUpper', 'wood.panelLower'].filter((k) => cfg.slots[k].id !== 'none');
    };
    const panelFinish = this._segmented(WOOD_FINISHES, (id) => {
      const keys = panelKeys();
      if (keys.length) this.opts.onSlots(keys, { finish: id });
    });
    const panelName = el('p', { class: 'pick-name' });
    const railSeg = this._segmented(
      [
        { id: 'on', name: 'Montiert' },
        { id: 'off', name: 'Ohne' },
      ],
      (id) => this.opts.onRail(id === 'on'),
    );
    const railStyleSeg = this._segmented(RAIL_STYLES, (id) => this.opts.onRailStyle(id));
    const railPicker = this._accentPicker('rail', () => ['metal.rail']);
    const dripSeg = this._segmented(TRAY_STYLES, (id) => this.opts.onTray('drip', id));
    const cupSeg = this._segmented(TRAY_STYLES, (id) => this.opts.onTray('cup', id));
    const step = this._step('extras', num, 'Holzumrandung, Cup Rail & Bleche', [
      el('div', { class: 'sub' }, [
        el('h3', { class: 'sub-title', text: 'Holzumrandung & Seitenplatten' }),
        el('p', {
          class: 'hint-text tight',
          text: 'Die Holzumrandung läuft oben um beide Seiten und die Rückseite (bei rb.crafts magnetisch befestigt). Seitenplatten sitzen auf den schrägen Seiten des Unterteils.',
        }),
        modeSeg,
        woodGrid,
        panelName,
        el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Oberfläche' }), panelFinish]),
      ]),
      el('div', { class: 'sub' }, [
        el('h3', { class: 'sub-title', text: 'Cup Rail' }),
        el('p', { class: 'hint-text tight', text: 'Reling über der Tassenablage – bei rb.crafts ein Rahmen aus Flachstahl, gebürstet oder schwarz.' }),
        railSeg,
        el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Bauform' }), railStyleSeg]),
        railPicker.node,
      ]),
      el('div', { class: 'sub' }, [
        el('h3', { class: 'sub-title', text: 'Tropfblech & Tassenablage' }),
        el('p', { class: 'hint-text tight', text: 'Lochbild der Bleche. Die Farbe wählst du unter „Metallakzente“ (Gitter & Tassenablage).' }),
        el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Tropfblech' }), dripSeg]),
        el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Tassenablage' }), cupSeg]),
      ]),
    ]);
    Object.assign(this.refs.steps.extras, { modeSeg, woodGrid, panelFinish, panelName, railSeg, railStyleSeg, railPicker, dripSeg, cupSeg });
    return step;
  }

  #buildWoodStep(num) {
    const picker = this._woodPicker(() => this._targetKeys('wood'));
    const knobSeg = this._segmented(KNOB_SHAPES, (id) => this.opts.onShape('knobs', id));
    const handleSeg = this._segmented(HANDLE_SHAPES, (id) => this.opts.onShape('handle', id));
    const step = this._step('wood', num, CATEGORIES.wood.title, [
      this._chips('wood'),
      picker.node,
      el('div', { class: 'field two' }, [
        el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Form Drehknöpfe' }), knobSeg]),
        el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Form Siebträgergriff' }), handleSeg]),
      ]),
    ]);
    Object.assign(this.refs.steps.wood, { picker, knobSeg, handleSeg });
    return step;
  }

  /**
   * Manometer-Auswahl: welche Anzeige, Zifferblatt (inkl. offenes Werk) und Zeigerfarbe.
   * @param {'step'|'edit'} key  eigener Zustand für Schritt und Auswahlkarte
   */
  #gaugePicker(key) {
    const sides = () => (this.gaugeTarget[key] === 'both' ? ['left', 'right'] : [this.gaugeTarget[key]]);
    const targetSeg = this._segmented([{ id: 'both', name: 'Beide' }, ...GAUGES.map((g) => ({ id: g.id, name: g.name }))], (id) => {
      this.gaugeTarget[key] = id;
      this.refresh();
    });
    const dials = el('div', { class: 'dials', role: 'group', 'aria-label': 'Zifferblatt' });
    const imgs = {};
    for (const d of GAUGE_DIALS) {
      const img = el('img', { class: 'dial-img', alt: '', width: 48, height: 48 });
      imgs[d.id] = img;
      dials.append(
        el('button', { class: 'dial', type: 'button', 'data-id': d.id, title: d.name, onclick: () => this.opts.onGauge(sides(), { dial: d.id }) }, [
          img,
          el('span', { class: 'dial-name', text: d.name }),
        ]),
      );
    }
    const needles = el('div', { class: 'swatches needles', role: 'group', 'aria-label': 'Zeigerfarbe' });
    for (const n of NEEDLES) {
      needles.append(
        el(
          'button',
          { class: 'swatch', type: 'button', title: n.name, 'aria-label': `Zeiger ${n.name}`, 'data-id': n.id, onclick: () => this.opts.onGauge(sides(), { needle: n.id }) },
          [el('span', { class: 'swatch-fill', style: `background:${swatchBackground(n.color, n.metal ? 'metal' : 'uni')}` })],
        ),
      );
    }
    const nameLine = el('p', { class: 'pick-name' });
    const node = el('div', { class: 'gauge-picker' }, [
      targetSeg,
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Zifferblatt' }), dials]),
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Zeiger' }), needles]),
      nameLine,
    ]);
    const refresh = (cfg) => {
      setActive(targetSeg, this.gaugeTarget[key]);
      const vals = sides().map((sd) => cfg.gauges[sd]);
      const sameDial = vals.every((v) => v.dial === vals[0].dial);
      const sameNeedle = vals.every((v) => v.needle === vals[0].needle);
      const col = needleById(vals[0].needle).color;
      for (const d of GAUGE_DIALS) imgs[d.id].src = gaugePreviewURL(d.id, col);
      setActive(dials, sameDial ? vals[0].dial : null);
      setActive(needles, sameNeedle ? vals[0].needle : null);
      nameLine.textContent = GAUGES.map((g) => `${g.short}: ${this.gaugeText(cfg, g.id)}`).join(' · ');
    };
    return { node, refresh };
  }

  /** z. B. "Naked, Zeiger Rot" */
  gaugeText(cfg, side) {
    const g = cfg.gauges[side];
    return `${finishName(GAUGE_DIALS, g.dial).replace(' (offenes Werk)', '')}, Zeiger ${needleById(g.needle).name}`;
  }

  #buildDetailsStep(num) {
    const picker = this.#gaugePicker('step');
    const screwSeg = this._segmented(SCREW_HEADS, (id) => this.opts.onScrewHead(id));
    const step = this._step('details', num, 'Manometer & Schrauben', [
      picker.node,
      el('p', { class: 'hint-text tight-top', text: 'Die Farbe der Manometer-Ringe wählst du unter „Metallakzente“ oder per Klick auf ein Manometer.' }),
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Schraubenköpfe' }), screwSeg]),
      el('p', {
        class: 'hint-text',
        text: 'Tipp: Klicke in der 3D-Ansicht direkt auf ein Bauteil – z. B. eine Seitenplatte, die Reling oder eine Schraube. Oben im Panel erscheint dann eine Karte mit allen Optionen für genau dieses Teil.',
      }),
    ]);
    Object.assign(this.refs.steps.details, { picker, screwSeg });
    return step;
  }

  // -------------------------------------------------------------------------
  _targetKeys(cat) {
    const t = this.target[cat];
    if (t !== 'all') return [t];
    const slots = this.cats[cat].slots;
    const cfg = this.opts.getConfig();
    // optionale Holzteile (Seitenplatten, Trichterdeckel) nur, wenn sie angebracht sind
    return slots.filter((s) => !s.panel || cfg.slots[s.key].id !== 'none').map((s) => s.key);
  }

  /** Gemeinsamer Wert der Ziel-Slots oder null bei gemischter Auswahl. */
  _commonValue(cat) {
    const cfg = this.opts.getConfig();
    const vals = this._targetKeys(cat).map((k) => cfg.slots[k]);
    const first = vals[0];
    const same = (key) => vals.every((v) => v[key] === first[key]);
    return {
      first,
      sameId: same('id') && (first.id !== 'custom' || (same('color') && same('kind'))),
      sameFinish: same('finish'),
    };
  }

  // -------------------------------------------------------------------------
  // Auswahlkarte: Bauteil in der 3D-Ansicht anklicken -> Optionen nur für dieses Teil
  // -------------------------------------------------------------------------
  _buildEditor() {
    const title = el('h2', { class: 'editor-title', id: `${this.idp}editor-title` });
    const sub = el('p', { class: 'editor-sub' });
    const close = el('button', {
      class: 'icon-btn',
      type: 'button',
      'aria-label': 'Auswahl schließen',
      html: ICONS.close,
      onclick: () => this.clearSelection(),
    });
    const body = el('div', { class: 'editor-body' });
    const head = el('div', { class: 'editor-head' }, [el('div', { class: 'editor-titles' }, [sub, title]), close]);
    const empty = el('p', { class: 'editor-empty' }, [
      el('span', { class: 'editor-empty-icon', html: ICONS.pointer }),
      el('span', {
        text: this.opts.emptyHint || 'Klicke in der 3D-Ansicht auf ein Bauteil – Seitenplatte, Reling, Schraube, Knopf … – um es hier einzeln anzupassen.',
      }),
    ]);
    const card = el('section', { class: 'part-editor empty', id: `${this.idp}part-editor`, 'aria-labelledby': `${this.idp}editor-title` }, [empty, head, body]);
    // Karte überfahren -> Bauteil im Modell hervorheben
    card.addEventListener('mouseenter', () => this.selected && this.opts.onHoverPart?.(this.selected));
    card.addEventListener('mouseleave', () => this.opts.onHoverPart?.(null));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.selected) this.clearSelection();
    });
    this.refs.editor = { card, title, sub, body, head, empty };
    return card;
  }

  clearSelection() {
    this.selected = null;
    this.editor = null;
    const ed = this.refs.editor;
    ed.body.innerHTML = '';
    ed.card.classList.add('empty');
    ed.card.classList.remove('glow');
    this.opts.onHoverPart?.(null);
  }

  /** Bauteil auswählen (Klick im 3D-Modell) und die passende Karte zeigen. */
  selectPart(slot, part = null) {
    const cfg = this.opts.getConfig();
    const cat = categoryOf(slot);
    const info = SLOT_INFO[slot];
    const ed = this.refs.editor;
    const value = cfg.slots[slot];
    const blocks = [];
    const refreshers = [];
    const action = (text, onclick, cls = '') => el('button', { class: `btn small ${cls}`, type: 'button', text, onclick });
    const actions = el('div', { class: 'editor-actions' });

    if (cat === 'body') {
      this.colorTab.edit = value.id === 'custom' ? 'custom' : collectionOf(value.id) || BODY_COLLECTIONS[0].id;
      const picker = this._bodyPicker('edit', () => [slot], { compact: true });
      blocks.push(picker.node);
      refreshers.push((c) => picker.refresh(c, [slot]));
      const allBody = CATEGORIES.body.slots.map((s) => s.key).filter((k) => k !== slot);
      actions.append(action('Auf das ganze Gehäuse übertragen', () => this.opts.onCopy(allBody, this.opts.getConfig().slots[slot])));
      // Anbauteile direkt am angeklickten Bereich
      const region = slot === 'body.upper' ? 'upper' : slot === 'body.lower' ? 'lower' : null;
      if (region || slot === 'body.upper') {
        const extra = el('div', { class: 'editor-extra' });
        const panelSlot = region === 'upper' ? 'wood.panelUpper' : 'wood.panelLower';
        const panelBtn = region
          ? action(`Holz-Seitenplatten ${region === 'upper' ? 'oben' : 'unten'} anbringen`, () => {
              this.opts.onPanelAdd(region);
              this.selectPart(panelSlot);
            }, 'accent')
          : null;
        const railBtn =
          slot === 'body.upper'
            ? action('Cup Rail montieren', () => {
                this.opts.onRail(true);
                this.selectPart('metal.rail');
              }, 'accent')
            : null;
        extra.append(el('span', { class: 'label', text: 'Anbauteile' }), ...[panelBtn, railBtn].filter(Boolean));
        blocks.push(extra);
        refreshers.push((c) => {
          if (panelBtn) panelBtn.hidden = c.slots[panelSlot].id !== 'none';
          if (railBtn) railBtn.hidden = !!c.rail;
          extra.hidden = (!panelBtn || panelBtn.hidden) && (!railBtn || railBtn.hidden);
        });
      }
    } else if (cat === 'wood') {
      const isPanel = slot.startsWith('wood.panel');
      const note = el('p', { class: 'editor-note' });
      if (isPanel) blocks.push(note);
      const picker = this._woodPicker(() => [slot], { panel: isPanel, compact: true });
      blocks.push(picker.node);
      refreshers.push((c) => picker.refresh(c, [slot]));
      if (slot === 'wood.knobs' || slot === 'wood.handle') {
        const part = slot === 'wood.knobs' ? 'knobs' : 'handle';
        const seg = this._segmented(part === 'knobs' ? KNOB_SHAPES : HANDLE_SHAPES, (id) => this.opts.onShape(part, id));
        blocks.push(el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Form' }), seg]));
        refreshers.push((c) => setActive(seg, c.shape[part]));
      }
      if (isPanel) {
        const other = slot === 'wood.panelUpper' ? 'wood.panelLower' : 'wood.panelUpper';
        const otherName = other === 'wood.panelUpper' ? 'oben' : 'unten';
        const copyBtn = action(`Gleiches Holz auch ${otherName}`, () => this.opts.onCopy([other], this.opts.getConfig().slots[slot]));
        const removeBtn = action('Seitenplatten entfernen', () => this.opts.onSlots([slot], { id: 'none' }), 'ghost');
        actions.append(copyBtn, removeBtn);
        refreshers.push((c) => {
          const on = c.slots[slot].id !== 'none';
          note.textContent = on
            ? 'Gilt für die Platten auf beiden Seiten der Maschine.'
            : 'Nicht angebracht – Holz antippen, um die Seitenplatten anzubringen.';
          note.classList.toggle('warn', !on);
          removeBtn.hidden = !on;
          copyBtn.hidden = !on || c.slots[other].id === c.slots[slot].id;
        });
      } else {
        actions.append(
          action('Auf alle Holzteile übertragen', () => {
            const c = this.opts.getConfig();
            const v = c.slots[slot];
            const plastic = resolveWood(v).plastic;
            const keys = [...MAIN_WOOD, 'wood.panelUpper', 'wood.panelLower'].filter(
              (k) => k !== slot && (!k.startsWith('wood.panel') || (!plastic && c.slots[k].id !== 'none')),
            );
            this.opts.onCopy(keys, v);
          }),
        );
      }
    } else {
      const kind = resolveMetal(value).kind;
      this.colorTab.edit = kind === 'metal' ? 'metal' : kind === 'paint' ? 'igp' : kind === 'wood' ? 'wood' : 'uni';
      if (slot === 'metal.rail') {
        const railSeg = this._segmented(
          [
            { id: 'on', name: 'Montiert' },
            { id: 'off', name: 'Ohne' },
          ],
          (id) => this.opts.onRail(id === 'on'),
        );
        const styleSeg = this._segmented(RAIL_STYLES, (id) => this.opts.onRailStyle(id));
        blocks.push(railSeg, el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Bauform' }), styleSeg]));
        refreshers.push((c) => {
          setActive(railSeg, c.rail ? 'on' : 'off');
          setActive(styleSeg, c.railStyle);
        });
      }
      if (slot === 'metal.grates') {
        const dripSeg = this._segmented(TRAY_STYLES, (id) => this.opts.onTray('drip', id));
        const cupSeg = this._segmented(TRAY_STYLES, (id) => this.opts.onTray('cup', id));
        blocks.push(
          el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Lochbild Tropfblech' }), dripSeg]),
          el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Lochbild Tassenablage' }), cupSeg]),
        );
        refreshers.push((c) => {
          setActive(dripSeg, c.tray.drip);
          setActive(cupSeg, c.tray.cup);
        });
      }
      if (slot === 'metal.gauges') {
        // angeklicktes Manometer vorwählen; Zifferblatt und Zeiger je Anzeige
        this.gaugeTarget.edit = part?.gauge || 'both';
        const gp = this.#gaugePicker('edit');
        blocks.push(gp.node, el('span', { class: 'label', text: 'Ring (beide Manometer)' }));
        refreshers.push((c) => gp.refresh(c));
      }
      if (slot === 'metal.screws') {
        const seg = this._segmented(SCREW_HEADS, (id) => this.opts.onScrewHead(id));
        blocks.push(el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Kopfform' }), seg]));
        refreshers.push((c) => setActive(seg, c.screwHead));
      }
      const picker = this._accentPicker('edit', () => [slot], { wood: slot === 'metal.logo' });
      blocks.push(picker.node);
      refreshers.push((c) => {
        picker.refresh(c, [slot]);
        if (slot === 'metal.rail') picker.node.classList.toggle('dimmed', !c.rail);
      });
      const allMetal = CATEGORIES.metal.slots.map((s) => s.key).filter((k) => k !== slot);
      const copyBtn = action('Auf alle Metallakzente übertragen', () => this.opts.onCopy(allMetal, this.opts.getConfig().slots[slot]));
      actions.append(copyBtn);
      refreshers.push((c) => (copyBtn.hidden = resolveMetal(c.slots[slot]).kind === 'wood'));
    }
    if (actions.childElementCount) blocks.push(actions);

    this.selected = slot;
    // passende Bereiche der Schritte mitziehen (gleiche Auswahl beim Aufklappen)
    if (cat !== 'wood' || !slot.startsWith('wood.panel')) {
      if (slot !== 'metal.rail') this.target[cat] = slot;
    }
    ed.title.textContent = slot === 'metal.gauges' ? 'Manometer' : info.label;
    ed.sub.textContent = info.cat;
    ed.body.replaceChildren(...blocks);
    ed.card.classList.remove('empty');
    ed.card.classList.remove('glow');
    void ed.card.offsetWidth; // Animation neu starten
    ed.card.classList.add('glow');
    this.editor = { slot, refresh: (c) => refreshers.forEach((fn) => fn(c)) };
    this.refresh();
    requestAnimationFrame(() => ed.card.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  refresh() {
    const cfg = this.opts.getConfig();
    for (const [cat, s] of Object.entries(this.refs.steps)) {
      const isOpen = this.open === cat;
      s.section.classList.toggle('open', isOpen);
      s.head.setAttribute('aria-expanded', String(isOpen));
      s.section.querySelectorAll('.chip').forEach((c) => {
        const on = c.dataset.target === this.target[cat];
        c.classList.toggle('active', on);
        c.setAttribute('aria-pressed', String(on));
      });
    }

    // Gehäuse (IGP-Karten)
    {
      const s = this.refs.steps.body;
      s.current.textContent = s.picker.refresh(cfg, this._targetKeys('body'));
    }

    // Metallakzente
    {
      const s = this.refs.steps.metal;
      s.current.textContent = s.picker.refresh(cfg, this._targetKeys('metal'));
    }

    // Seitenplatten & Cup Rail
    {
      const s = this.refs.steps.extras;
      const up = cfg.slots['wood.panelUpper'];
      const lo = cfg.slots['wood.panelLower'];
      const mode = up.id !== 'none' && lo.id !== 'none' ? 'both' : up.id !== 'none' ? 'upper' : lo.id !== 'none' ? 'lower' : 'none';
      setActive(s.modeSeg, mode);
      const enabled = [up, lo].filter((v) => v.id !== 'none');
      const woodId = enabled.length && enabled.every((v) => v.id === enabled[0].id) ? enabled[0].id : null;
      s.woodGrid.querySelectorAll('.wood').forEach((b) => {
        const on = b.dataset.id === woodId;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      s.woodGrid.classList.toggle('dimmed', mode === 'none');
      const fin = enabled.length && enabled.every((v) => v.finish === enabled[0].finish) ? enabled[0].finish : null;
      setActive(s.panelFinish, fin);
      const where = { both: 'Umrandung + Platten', upper: 'Umrandung', lower: 'Platten unten' }[mode];
      const panelText = mode === 'none' ? 'Ohne Holz am Gehäuse' : `${where} ${woodId ? resolveWood({ id: woodId }).name : 'gemischt'}`;
      s.panelName.textContent =
        mode === 'none' ? 'Ohne Holz am Gehäuse – Holz antippen, um die Holzumrandung anzubringen' : `${panelText}${fin ? ' · ' + finishName(WOOD_FINISHES, fin) : ''}`;
      setActive(s.railSeg, cfg.rail ? 'on' : 'off');
      setActive(s.railStyleSeg, cfg.railStyle);
      s.railStyleSeg.classList.toggle('dimmed', !cfg.rail);
      setActive(s.dripSeg, cfg.tray.drip);
      setActive(s.cupSeg, cfg.tray.cup);
      const railText = s.railPicker.refresh(cfg, ['metal.rail']);
      s.railPicker.node.classList.toggle('dimmed', !cfg.rail);
      s.current.textContent = `${panelText} · ${cfg.rail ? 'Rail ' + railText.split(' · ')[0] : 'ohne Rail'}`;
    }

    // Holz
    {
      const s = this.refs.steps.wood;
      setActive(s.knobSeg, cfg.shape.knobs);
      setActive(s.handleSeg, cfg.shape.handle);
      s.current.textContent = s.picker.refresh(cfg, this._targetKeys('wood'));
    }

    // Manometer & Schrauben
    {
      const s = this.refs.steps.details;
      s.picker.refresh(cfg);
      setActive(s.screwSeg, cfg.screwHead);
      const dl = cfg.gauges.left.dial;
      const dr = cfg.gauges.right.dial;
      const short = (id) => finishName(GAUGE_DIALS, id).replace(' (offenes Werk)', '');
      s.current.textContent = `${dl === dr ? short(dl) : `${short(dl)} / ${short(dr)}`} · ${finishName(SCREW_HEADS, cfg.screwHead)}`;
    }

    // Auswahlkarte
    this.editor?.refresh(cfg);

    this._renderSummary(cfg);
  }

  setBusy(woodId, busy) {
    this.root.querySelectorAll(`.wood[data-id="${woodId}"]`).forEach((b) => b.classList.toggle('busy', busy));
  }

  _renderSummary(cfg) {
    const dl = this.refs.summary;
    dl.innerHTML = '';
    for (const [cat, c] of Object.entries(CATEGORIES)) {
      dl.append(el('dt', { class: 'sum-cat', text: c.title }));
      for (const s of c.slots) {
        const v = cfg.slots[s.key];
        let swatch;
        let name;
        if (cat === 'wood') {
          const w = resolveWood(v);
          swatch = `linear-gradient(100deg, ${w.light}, ${w.mid} 50%, ${w.dark})`;
          name = w.none ? w.name : `${w.name} · ${finishName(WOOD_FINISHES, v.finish)}`;
          if (s.key === 'wood.knobs') name += ` · ${finishName(KNOB_SHAPES, cfg.shape.knobs)}`;
          if (s.key === 'wood.handle') name += ` · ${finishName(HANDLE_SHAPES, cfg.shape.handle)}`;
        } else if (s.key === 'metal.rail' && !cfg.rail) {
          swatch = 'transparent';
          name = 'nicht montiert';
        } else {
          let r = cat === 'body' ? resolveBody(v) : resolveMetal(v);
          const base = resolveBody(cfg.slots['body.base']);
          swatch =
            cat === 'body' || r.kind === 'paint'
              ? paintBackground(r)
              : r.kind === 'body'
                ? paintBackground(base)
                : r.kind === 'wood'
                  ? woodGradient(r.wood)
                  : swatchBackground(r.color, r.kind);
          if (r.kind === 'body') r = { ...r, name: `Wie Gehäuse (${base.name})` };
          name = r.kind === 'wood' ? `${r.name} · Geölt` : `${r.name} · ${finishName(cat === 'body' ? BODY_FINISHES : METAL_FINISHES, v.finish)}`;
          if (s.key === 'metal.rail') name += ` · ${finishName(RAIL_STYLES, cfg.railStyle).replace(/ \(.*\)/, '')}`;
        }
        dl.append(
          el('dd', {}, [
            el('span', { class: 'sum-dot', style: `background:${swatch}` }),
            el('span', { class: 'sum-part', text: s.label }),
            el('span', { class: 'sum-val', text: name }),
          ]),
        );
      }
    }
    dl.append(el('dt', { class: 'sum-cat', text: 'Manometer & Schrauben' }));
    for (const g of GAUGES) {
      dl.append(
        el('dd', {}, [
          el('span', { class: 'sum-dot', style: `background:${needleById(cfg.gauges[g.id].needle).color}` }),
          el('span', { class: 'sum-part', text: g.short }),
          el('span', { class: 'sum-val', text: this.gaugeText(cfg, g.id) }),
        ]),
      );
    }
    dl.append(
      el('dd', {}, [
        el('span', { class: 'sum-dot', style: 'background:transparent' }),
        el('span', { class: 'sum-part', text: 'Schraubenköpfe' }),
        el('span', { class: 'sum-val', text: finishName(SCREW_HEADS, cfg.screwHead) }),
      ]),
    );
  }

  // -------------------------------------------------------------------------
  // Texte für die Montage-Animation und die Abschlusskarte
  // -------------------------------------------------------------------------
  _paintName(cfg, key) {
    const v = cfg.slots[key];
    if (categoryOf(key) === 'body') return resolveBody(v).name;
    const r = resolveMetal(v);
    return r.kind === 'body' ? 'Wie Gehäuse' : r.name;
  }

  /** Beschriftung eines Montageschritts mit dem gewählten Material */
  stageLabel(id) {
    const cfg = this.opts.getConfig();
    const p = (k) => this._paintName(cfg, k);
    const w = (k) => resolveWood(cfg.slots[k]).name;
    const panels = ['wood.panelUpper', 'wood.panelLower'].filter((k) => cfg.slots[k].id !== 'none');
    const labels = {
      // Innenleben
      chassis: ['Füße & Bodenwanne', p('metal.feet')],
      'sk-base': ['Bodenrahmen', 'Stahl verzinkt'],
      'sk-front': ['Frontblech', 'Stahl verzinkt'],
      'sk-rear': ['Rückwand-Stütze', 'Stahl verzinkt'],
      'sk-struts': ['Pfosten & Streben', 'Stahl verzinkt'],
      'sk-tank': ['Wassertank', '2,5 l'],
      'sk-pump': ['Pumpe & Motor', 'Rotationspumpe'],
      'sk-steam': ['Dampfkessel', 'Edelstahl, 3 l'],
      'sk-brew': ['Brühkessel & Brühgruppe', 'Edelstahl'],
      'sk-head': ['Ventile & Paddle-Mechanik', 'Messing'],
      'sk-valves': ['Magnetventile', ''],
      'sk-pcb': ['Elektronik', 'Steuerplatine'],
      'sk-pipes': ['Leitungen', 'Kupfer, Messingverschraubungen'],
      'sk-wires': ['Kabelbaum', ''],
      // Konfiguration
      base: ['Basis', p('body.base')],
      drip: ['Tropfschale', p('body.base')],
      lower: ['Unterteil', p('body.lower')],
      gauges: ['Manometer', `${p('metal.gauges')}, ${cfg.gauges.left.dial === 'naked' || cfg.gauges.right.dial === 'naked' ? 'offenes Werk' : finishName(GAUGE_DIALS, cfg.gauges.left.dial)}`],
      upper: ['Oberteil', p('body.upper')],
      head: ['Kopfteil', p('body.head')],
      groupcap: ['Brühgruppe', p('metal.group')],
      wand: ['Dampflanze', p('metal.wand')],
      portafilter: ['Siebträger', `${p('metal.portafilter')}, Griff ${w('wood.handle')}`],
      paddle: ['Paddle', w('wood.paddle')],
      knobs: ['Drehknöpfe', `${w('wood.knobs')}, ${finishName(KNOB_SHAPES, cfg.shape.knobs).toLowerCase()}`],
      panels: [cfg.slots['wood.panelUpper'].id !== 'none' ? 'Holzumrandung' : 'Seitenplatten', panels.length ? w(panels[0]) : ''],
      tray: ['Tassenablage', p('metal.grates')],
      rail: ['Cup Rail', p('metal.rail')],
      screws: ['Schrauben', p('metal.screws')],
      logo: ['Schriftzug', p('metal.logo')],
    };
    const [part, material] = labels[id] || [id, ''];
    return { part, material };
  }

  /** Kurze Konfigurationsnummer (Prüfsumme der Auswahl), z. B. für eine Anfrage */
  configCode() {
    const str = JSON.stringify(this.opts.getConfig());
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return `LMR-${h.toString(36).toUpperCase().padStart(7, '0').slice(-7)}`;
  }

  /** Eckdaten der Konfiguration für die Abschlusskarte: [Bereich, Wert, Farbfeld] */
  finalSummary() {
    const cfg = this.opts.getConfig();
    const rows = [];
    const common = (keys, fn) => {
      const vals = keys.map((k) => fn(k));
      return vals.every((v) => v === vals[0]) ? vals[0] : null;
    };
    // Gehäuse
    const bodyKeys = CATEGORIES.body.slots.map((s) => s.key);
    const b = resolveBody(cfg.slots['body.upper']);
    const bodySame = common(bodyKeys, (k) => JSON.stringify(cfg.slots[k]));
    rows.push([
      'Gehäuse',
      bodySame ? `${b.name}${b.code ? ' · ' + b.code : ''} · ${finishName(BODY_FINISHES, cfg.slots['body.upper'].finish)}` : 'Individuell (mehrere Farben)',
      paintBackground(b),
    ]);
    // Holzteile
    const wood = resolveWood(cfg.slots['wood.handle']);
    const woodSame = common(MAIN_WOOD, (k) => cfg.slots[k].id);
    rows.push([
      'Holzteile',
      `${woodSame ? wood.name : 'Gemischt'} · Knöpfe ${finishName(KNOB_SHAPES, cfg.shape.knobs).toLowerCase()}, Griff ${finishName(HANDLE_SHAPES, cfg.shape.handle).toLowerCase()}`,
      woodGradient(wood),
    ]);
    // Seitenplatten
    const up = cfg.slots['wood.panelUpper'];
    const lo = cfg.slots['wood.panelLower'];
    const pw = resolveWood(lo.id !== 'none' ? lo : up);
    const where = up.id !== 'none' && lo.id !== 'none' ? 'Umrandung + Platten unten' : up.id !== 'none' ? 'Holzumrandung oben' : lo.id !== 'none' ? 'Seitenplatten unten' : '';
    rows.push(['Holz am Gehäuse', where ? `${where}, ${pw.name}` : 'Ohne', where ? woodGradient(pw) : 'transparent']);
    // Cup Rail
    const rail = resolveMetal(cfg.slots['metal.rail']);
    const accentBg = (r) =>
      r.kind === 'paint'
        ? paintBackground(r)
        : r.kind === 'body'
          ? paintBackground(resolveBody(cfg.slots['body.base']))
          : r.kind === 'wood'
            ? woodGradient(r.wood)
            : swatchBackground(r.color, r.kind);
    rows.push(['Cup Rail', cfg.rail ? this._paintName(cfg, 'metal.rail') : 'Ohne', cfg.rail ? accentBg(rail) : 'transparent']);
    // Metallakzente (häufigster Ton)
    const metalKeys = CATEGORIES.metal.slots.map((s) => s.key).filter((k) => k !== 'metal.rail');
    const counts = {};
    for (const k of metalKeys) counts[cfg.slots[k].id] = (counts[cfg.slots[k].id] || 0) + 1;
    const topId = Object.entries(counts).sort((a, b2) => b2[1] - a[1])[0][0];
    const topKey = metalKeys.find((k) => cfg.slots[k].id === topId);
    const n = counts[topId];
    rows.push([
      'Akzente',
      n === metalKeys.length ? this._paintName(cfg, topKey) : `${this._paintName(cfg, topKey)} (${n} von ${metalKeys.length} Teilen)`,
      accentBg(resolveMetal(cfg.slots[topKey])),
    ]);
    // Manometer
    const gl = this.gaugeText(cfg, 'left');
    const gr = this.gaugeText(cfg, 'right');
    rows.push(['Manometer', gl === gr ? gl : `${gl} / ${gr}`, needleById(cfg.gauges.left.needle).color]);
    return rows;
  }

  /** Text-Zusammenfassung (z. B. für die Zwischenablage). */
  summaryText() {
    const cfg = this.opts.getConfig();
    const lines = [`Linea Mini R – Konfiguration ${this.configCode()}`, ''];
    for (const [cat, c] of Object.entries(CATEGORIES)) {
      lines.push(c.title);
      for (const s of c.slots) {
        const v = cfg.slots[s.key];
        let name;
        if (cat === 'wood') {
          const w = resolveWood(v);
          name = w.none ? w.name : `${w.name} (${finishName(WOOD_FINISHES, v.finish)})`;
          if (s.key === 'wood.knobs') name += `, Form ${finishName(KNOB_SHAPES, cfg.shape.knobs)}`;
          if (s.key === 'wood.handle') name += `, Form ${finishName(HANDLE_SHAPES, cfg.shape.handle)}`;
        } else if (s.key === 'metal.rail' && !cfg.rail) {
          name = 'nicht montiert';
        } else {
          const r = cat === 'body' ? resolveBody(v) : resolveMetal(v);
          const code = r.code ? `, ${r.series} ${r.code}` : '';
          name = r.kind === 'wood' ? `${r.name} (geölt)` : `${r.name} (${finishName(cat === 'body' ? BODY_FINISHES : METAL_FINISHES, v.finish)}${code})`;
          if (s.key === 'metal.rail') name += `, Bauform ${finishName(RAIL_STYLES, cfg.railStyle)}`;
        }
        lines.push(`  ${s.label}: ${name}`);
      }
    }
    lines.push('Manometer & Schrauben');
    for (const g of GAUGES) lines.push(`  ${g.name}: ${this.gaugeText(cfg, g.id)}`);
    lines.push(`  Tropfblech: ${finishName(TRAY_STYLES, cfg.tray.drip)}`);
    lines.push(`  Tassenablage: ${finishName(TRAY_STYLES, cfg.tray.cup)}`);
    lines.push(`  Schraubenköpfe: ${finishName(SCREW_HEADS, cfg.screwHead)}`);
    return lines.join('\n');
  }
}

function setActive(group, id) {
  group.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.id === id;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

// für die Oberfläche der Mühle (grinder-ui.js)
export { el, setActive, ICONS, woodGradient };
