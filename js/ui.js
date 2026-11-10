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
  DIALS,
  PRESETS,
  KNOB_SHAPES,
  HANDLE_SHAPES,
  resolveBody,
  resolveMetal,
  resolveWood,
  finishName,
} from './data.js';
import { woodPreviewURL } from './textures.js';

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
};

export class ConfiguratorUI {
  /**
   * @param {HTMLElement} root   Container des Panels
   * @param {object} opts        { getConfig, onSlots(keys, patch), onDial(id), onPreset(config), onFocus(keys) }
   */
  constructor(root, opts) {
    this.root = root;
    this.opts = opts;
    this.target = { body: 'all', wood: 'all', metal: 'all' };
    const bodyId = opts.getConfig().slots['body.upper'].id;
    this.colorTab = { body: collectionOf(bodyId) || (bodyId === 'custom' ? 'custom' : BODY_COLLECTIONS[0].id), metal: 'metal', rail: 'metal' };
    this.open = 'body';
    this.refs = { steps: {} };
    this.build();
    this.refresh();
  }

  // -------------------------------------------------------------------------
  build() {
    const r = this.root;
    r.innerHTML = '';

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

  #step(cat, num, title, body) {
    const current = el('span', { class: 'step-current' });
    const head = el(
      'button',
      {
        class: 'step-head',
        type: 'button',
        'aria-expanded': 'false',
        'aria-controls': `step-${cat}`,
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
    const section = el('section', { class: 'step', 'data-cat': cat }, [head, el('div', { class: 'step-body', id: `step-${cat}` }, body)]);
    this.refs.steps[cat] = { section, head, current };
    return section;
  }

  #chips(cat) {
    const c = CATEGORIES[cat];
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
          this.opts.onFocus(this.#targetKeys(cat));
        },
      });
    wrap.append(mk('all', c.allLabel));
    c.slots.filter((s) => s.chip !== false).forEach((s) => wrap.append(mk(s.key, s.label)));
    return wrap;
  }

  #segmented(items, onPick, cls = '') {
    const wrap = el('div', { class: `seg ${cls}`, role: 'group' });
    items.forEach((it) =>
      wrap.append(el('button', { type: 'button', 'data-id': it.id, text: it.name, onclick: () => onPick(it.id) })),
    );
    return wrap;
  }

  /** Gehäuse: IGP-DURA®-Kollektionen als Farbkarten + eigene Farbe. */
  #buildBodyStep(num) {
    const tabs = [...BODY_COLLECTIONS.map((c) => ({ id: c.id, name: c.name })), { id: 'custom', name: 'Eigene Farbe' }];
    const tabBar = this.#segmented(
      tabs,
      (id) => {
        this.colorTab.body = id;
        this.refresh();
      },
      'tabs scroll',
    );
    const grids = {};
    const gridWrap = el('div', { class: 'swatch-wrap' });
    for (const col of BODY_COLLECTIONS) {
      const grid = el('div', { class: 'paints', 'data-tab': col.id, role: 'group', 'aria-label': col.name });
      for (const c of col.colors) {
        grid.append(
          el(
            'button',
            {
              class: 'paint',
              type: 'button',
              title: `${c.label || c.name} · ${c.code}`,
              'data-id': c.id,
              onclick: () => this.opts.onSlots(this.#targetKeys('body'), { id: c.id }),
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
    // eigene Farbe
    const input = el('input', { type: 'color', value: '#9a8f80', 'aria-label': 'Eigene Farbe wählen' });
    const kindSeg = this.#segmented(
      [
        { id: 'uni', name: 'Uni' },
        { id: 'metallic', name: 'Metallic' },
      ],
      (id) => this.opts.onSlots(this.#targetKeys('body'), { id: 'custom', color: input.value, kind: id }),
    );
    input.addEventListener('input', () => {
      const kind = kindSeg.querySelector('button.active')?.dataset.id || 'uni';
      this.opts.onSlots(this.#targetKeys('body'), { id: 'custom', color: input.value, kind });
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
    const finishSeg = this.#segmented(BODY_FINISHES, (id) => this.opts.onSlots(this.#targetKeys('body'), { finish: id }));
    const step = this.#step('body', num, CATEGORIES.body.title, [
      this.#chips('body'),
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
    Object.assign(this.refs.steps.body, { tabBar, grids, customPanel, input, kindSeg, customFill, finishSeg, nameLine, series });
    return step;
  }

  /**
   * Farbwahl für Akzentteile (Metall/PVD, Lack inkl. "Wie Gehäuse", IGP/RAL-Pulverlack).
   * @param {string} tabKey  Schlüssel in this.colorTab
   * @param {() => string[]} getKeys  Ziel-Slots
   */
  #accentPicker(tabKey, getKeys) {
    const tabs = [
      { id: 'metal', name: 'Metall / PVD' },
      { id: 'uni', name: 'Lack & Gehäuse' },
      { id: 'igp', name: 'IGP / RAL' },
    ];
    const tabBar = this.#segmented(
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
    const nameLine = el('p', { class: 'pick-name' });
    const finishSeg = this.#segmented(METAL_FINISHES, (id) => this.opts.onSlots(getKeys(), { finish: id }));
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
      if (bodyTile) bodyTile.style.background = paintBackground(resolveBody(cfg.slots['body.base']));
      setActive(finishSeg, sameFinish ? first.finish : null);
      const label = resolved.kind === 'body' ? `Wie Gehäuse (${resolveBody(cfg.slots['body.base']).name})` : resolved.name;
      const text = sameId ? `${label}${sameFinish ? ' · ' + finishName(METAL_FINISHES, first.finish) : ''}` : 'Individuell kombiniert';
      nameLine.textContent = sameId
        ? `${label}${resolved.code ? ' · ' + resolved.code : ''}${sameFinish ? ' · ' + finishName(METAL_FINISHES, first.finish) : ''}`
        : 'Mehrere Farben – Auswahl gilt für alle markierten Bauteile';
      return text;
    };
    return { node, refresh };
  }

  #buildPaintStep(cat, num) {
    const picker = this.#accentPicker('metal', () => this.#targetKeys(cat));
    const step = this.#step(cat, num, CATEGORIES[cat].title, [this.#chips(cat), picker.node]);
    Object.assign(this.refs.steps[cat], { picker });
    return step;
  }

  /** Seitenplatten (Holz) und Cup Rail – die typischen Anbauteile der veredelten Linea Mini R */
  #buildExtrasStep(num) {
    const modes = [
      { id: 'both', name: 'Oben & unten' },
      { id: 'upper', name: 'Nur oben' },
      { id: 'lower', name: 'Nur unten' },
      { id: 'none', name: 'Ohne' },
    ];
    const modeSeg = this.#segmented(modes, (id) => this.opts.onPanels(id));
    const woodGrid = el('div', { class: 'woods compact', role: 'group', 'aria-label': 'Holz der Seitenplatten' });
    for (const w of WOODS.filter((x) => !x.plastic)) {
      const tile = el('span', {
        class: 'wood-tile',
        style: `background: linear-gradient(100deg, ${w.light}, ${w.mid} 45%, ${w.dark} 55%, ${w.mid} 70%, ${w.light})`,
      });
      (w._tiles ||= []).push(tile);
      woodGrid.append(
        el('button', { class: 'wood', type: 'button', 'data-id': w.id, title: w.name, onclick: () => this.opts.onPanelWood(w.id) }, [
          tile,
          el('span', { class: 'wood-name', text: w.name }),
        ]),
      );
    }
    const panelKeys = () => {
      const cfg = this.opts.getConfig();
      return ['wood.panelUpper', 'wood.panelLower'].filter((k) => cfg.slots[k].id !== 'none');
    };
    const panelFinish = this.#segmented(WOOD_FINISHES, (id) => {
      const keys = panelKeys();
      if (keys.length) this.opts.onSlots(keys, { finish: id });
    });
    const panelName = el('p', { class: 'pick-name' });
    const railSeg = this.#segmented(
      [
        { id: 'on', name: 'Montiert' },
        { id: 'off', name: 'Ohne' },
      ],
      (id) => this.opts.onRail(id === 'on'),
    );
    const railPicker = this.#accentPicker('rail', () => ['metal.rail']);
    const step = this.#step('extras', num, 'Seitenplatten & Cup Rail', [
      el('div', { class: 'sub' }, [
        el('h3', { class: 'sub-title', text: 'Seitenplatten aus Holz' }),
        el('p', { class: 'hint-text tight', text: 'Verkleidung der Seitenwangen oben und/oder der schrägen Seiten des Unterteils.' }),
        modeSeg,
        woodGrid,
        panelName,
        el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Oberfläche' }), panelFinish]),
      ]),
      el('div', { class: 'sub' }, [
        el('h3', { class: 'sub-title', text: 'Cup Rail' }),
        el('p', { class: 'hint-text tight', text: 'Stangenreling auf Pfosten über der Tassenablage.' }),
        railSeg,
        railPicker.node,
      ]),
    ]);
    Object.assign(this.refs.steps.extras, { modeSeg, woodGrid, panelFinish, panelName, railSeg, railPicker });
    return step;
  }

  #buildWoodStep(num) {
    const grid = el('div', { class: 'woods', role: 'group', 'aria-label': 'Holzart' });
    for (const w of WOODS) {
      const tile = el('span', {
        class: 'wood-tile',
        style: `background: linear-gradient(100deg, ${w.light}, ${w.mid} 45%, ${w.dark} 55%, ${w.mid} 70%, ${w.light})`,
      });
      grid.append(
        el(
          'button',
          {
            class: 'wood',
            type: 'button',
            'data-id': w.id,
            title: w.name,
            onclick: () => this.opts.onSlots(this.#targetKeys('wood'), { id: w.id }),
          },
          [tile, el('span', { class: 'wood-name', text: w.name })],
        ),
      );
      (w._tiles ||= []).push(tile);
    }
    // echte Maserungs-Vorschau nachladen (rechenintensiv -> nach dem ersten Rendern)
    const loadPreviews = () => {
      let i = 0;
      const next = () => {
        if (i >= WOODS.length) return;
        const w = WOODS[i++];
        const url = woodPreviewURL(w);
        (w._tiles || []).forEach((t) => (t.style.background = `url(${url}) center/cover`));
        setTimeout(next, 0);
      };
      next();
    };
    setTimeout(loadPreviews, 400);

    const nameLine = el('p', { class: 'pick-name' });
    const finishSeg = this.#segmented(WOOD_FINISHES, (id) => this.opts.onSlots(this.#targetKeys('wood'), { finish: id }));
    const knobSeg = this.#segmented(KNOB_SHAPES, (id) => this.opts.onShape('knobs', id));
    const handleSeg = this.#segmented(HANDLE_SHAPES, (id) => this.opts.onShape('handle', id));
    const step = this.#step('wood', num, CATEGORIES.wood.title, [
      this.#chips('wood'),
      grid,
      nameLine,
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Oberfläche' }), finishSeg]),
      el('div', { class: 'field two' }, [
        el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Form Drehknöpfe' }), knobSeg]),
        el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Form Siebträgergriff' }), handleSeg]),
      ]),
    ]);
    Object.assign(this.refs.steps.wood, {
      grid,
      finishSeg,
      nameLine,
      knobSeg,
      handleSeg,
    });
    return step;
  }

  #buildDetailsStep(num) {
    const dialSeg = this.#segmented(DIALS, (id) => this.opts.onDial(id));
    const step = this.#step('details', num, 'Details', [
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Manometer-Zifferblatt' }), dialSeg]),
      el('p', {
        class: 'hint-text',
        text: 'Tipp: Klicke direkt auf ein Bauteil der Maschine, um es auszuwählen – z. B. auf die Dampflanze oder den Siebträgergriff.',
      }),
    ]);
    Object.assign(this.refs.steps.details, { dialSeg });
    return step;
  }

  // -------------------------------------------------------------------------
  #targetKeys(cat) {
    const t = this.target[cat];
    if (t !== 'all') return [t];
    const slots = CATEGORIES[cat].slots;
    if (cat !== 'wood') return slots.map((s) => s.key);
    const cfg = this.opts.getConfig();
    return slots.filter((s) => !s.panel || cfg.slots[s.key].id !== 'none').map((s) => s.key);
  }

  /** Gemeinsamer Wert der Ziel-Slots oder null bei gemischter Auswahl. */
  #commonValue(cat) {
    const cfg = this.opts.getConfig();
    const vals = this.#targetKeys(cat).map((k) => cfg.slots[k]);
    const first = vals[0];
    const same = (key) => vals.every((v) => v[key] === first[key]);
    return {
      first,
      sameId: same('id') && (first.id !== 'custom' || (same('color') && same('kind'))),
      sameFinish: same('finish'),
    };
  }

  /** Bauteil von außen auswählen (z. B. Klick im 3D-Modell). */
  focusSlot(slotKey) {
    const v = this.opts.getConfig().slots[slotKey];
    const tabOf = (kind) => (kind === 'metal' ? 'metal' : kind === 'paint' ? 'igp' : 'uni');
    if (slotKey.startsWith('wood.panel') || slotKey === 'metal.rail') {
      this.open = 'extras';
      if (slotKey === 'metal.rail') this.colorTab.rail = tabOf(resolveMetal(v).kind);
      this.refresh();
      const sec = this.refs.steps.extras.section;
      requestAnimationFrame(() => sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
      return;
    }
    const cat = slotKey.split('.')[0];
    this.open = cat;
    this.target[cat] = slotKey;
    if (cat === 'metal') this.colorTab.metal = tabOf(resolveMetal(v).kind);
    if (cat === 'body') this.colorTab.body = v.id === 'custom' ? 'custom' : collectionOf(v.id) || this.colorTab.body;
    this.refresh();
    const sec = this.refs.steps[cat].section;
    requestAnimationFrame(() => sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
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
      const { first, sameId, sameFinish } = this.#commonValue('body');
      const resolved = resolveBody(first);
      const tab = this.colorTab.body;
      setActive(s.tabBar, tab);
      for (const [id, grid] of Object.entries(s.grids)) {
        grid.hidden = id !== tab;
        grid.querySelectorAll('.paint').forEach((b) => {
          const on = sameId && b.dataset.id === first.id;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', String(on));
        });
      }
      s.customPanel.hidden = tab !== 'custom';
      const isCustom = sameId && first.id === 'custom';
      if (isCustom) {
        s.input.value = first.color;
        s.customFill.style.background = paintBackground(resolved);
      }
      setActive(s.kindSeg, isCustom ? resolved.kind : s.kindSeg.querySelector('button.active')?.dataset.id || 'uni');
      const col = BODY_COLLECTIONS.find((c) => c.id === tab);
      s.series.textContent = col ? `${col.series} – ${col.name}` : 'Eigener Farbton';
      setActive(s.finishSeg, sameFinish ? first.finish : null);
      const finish = sameFinish ? ' · ' + finishName(BODY_FINISHES, first.finish) : '';
      const text = sameId ? `${resolved.name}${finish}` : 'Individuell kombiniert';
      s.nameLine.textContent = sameId
        ? `${resolved.name}${resolved.code ? ' · ' + resolved.code : ''}${finish}`
        : 'Mehrere Farben – Auswahl gilt für alle markierten Bauteile';
      s.current.textContent = text;
    }

    // Metallakzente
    {
      const s = this.refs.steps.metal;
      s.current.textContent = s.picker.refresh(cfg, this.#targetKeys('metal'));
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
      const where = { both: 'oben & unten', upper: 'oben', lower: 'unten' }[mode];
      const panelText = mode === 'none' ? 'Ohne Seitenplatten' : `${woodId ? resolveWood({ id: woodId }).name : 'Gemischt'} ${where}`;
      s.panelName.textContent =
        mode === 'none' ? 'Ohne Seitenplatten – Holz antippen, um Platten unten anzubringen' : `${panelText}${fin ? ' · ' + finishName(WOOD_FINISHES, fin) : ''}`;
      setActive(s.railSeg, cfg.rail ? 'on' : 'off');
      const railText = s.railPicker.refresh(cfg, ['metal.rail']);
      s.railPicker.node.classList.toggle('dimmed', !cfg.rail);
      s.current.textContent = `${panelText} · ${cfg.rail ? 'Rail ' + railText.split(' · ')[0] : 'ohne Rail'}`;
    }

    // Holz
    {
      const s = this.refs.steps.wood;
      const { first, sameId, sameFinish } = this.#commonValue('wood');
      s.grid.querySelectorAll('.wood').forEach((b) => {
        const on = sameId && b.dataset.id === first.id;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      setActive(s.finishSeg, sameFinish ? first.finish : null);
      setActive(s.knobSeg, cfg.shape.knobs);
      setActive(s.handleSeg, cfg.shape.handle);
      const w = resolveWood(first);
      const text = sameId ? `${w.name}${sameFinish ? ' · ' + finishName(WOOD_FINISHES, first.finish) : ''}` : 'Individuell kombiniert';
      s.nameLine.textContent = sameId ? text : 'Mehrere Holzarten – Auswahl gilt für alle markierten Bauteile';
      s.current.textContent = text;
    }

    // Details
    {
      const s = this.refs.steps.details;
      setActive(s.dialSeg, cfg.dial);
      s.current.textContent = `Zifferblatt ${finishName(DIALS, cfg.dial)}`;
    }

    this.#renderSummary(cfg);
  }

  setBusy(woodId, busy) {
    const b = this.refs.steps.wood.grid.querySelector(`[data-id="${woodId}"]`);
    b?.classList.toggle('busy', busy);
  }

  #renderSummary(cfg) {
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
            cat === 'body' || r.kind === 'paint' ? paintBackground(r) : r.kind === 'body' ? paintBackground(base) : swatchBackground(r.color, r.kind);
          if (r.kind === 'body') r = { ...r, name: `Wie Gehäuse (${base.name})` };
          name = `${r.name} · ${finishName(cat === 'body' ? BODY_FINISHES : METAL_FINISHES, v.finish)}`;
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
    dl.append(el('dt', { class: 'sum-cat', text: 'Details' }));
    dl.append(
      el('dd', {}, [
        el('span', { class: 'sum-dot', style: `background:${cfg.dial === 'black' ? '#151515' : '#f4f2ec'}` }),
        el('span', { class: 'sum-part', text: 'Zifferblatt' }),
        el('span', { class: 'sum-val', text: finishName(DIALS, cfg.dial) }),
      ]),
    );
  }

  /** Text-Zusammenfassung (z. B. für die Zwischenablage). */
  summaryText() {
    const cfg = this.opts.getConfig();
    const lines = ['Linea Mini R – Konfiguration', ''];
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
          name = `${r.name} (${finishName(cat === 'body' ? BODY_FINISHES : METAL_FINISHES, v.finish)}${code})`;
        }
        lines.push(`  ${s.label}: ${name}`);
      }
    }
    lines.push(`Zifferblatt: ${finishName(DIALS, cfg.dial)}`);
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
