// ---------------------------------------------------------------------------
// Allgemeine Bedienoberfläche für weitere Geräte (Maschinen und Mühlen)
//
// Gesteuert über die Gerätebeschreibung (devices/*.js): Kategorien und Slots,
// Presets, Optionen und Texte für Montage und Abschluss. Nutzt dieselben
// Bausteine wie die Linea Mini R (Farbkarten, Holz, Metall, Auswahlkarte).
// ---------------------------------------------------------------------------
import { BODY_COLLECTIONS, BODY_FINISHES, METAL_FINISHES, WOOD_FINISHES, GRINDER_SIDES, collectionOf, resolveBody, resolveMetal, resolveWood, finishName, categoryOf, kindOf } from './data.js';
import { ConfiguratorUI, paintBackground, swatchBackground, el, setActive, woodGradient } from './ui.js';

const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export class DeviceUI extends ConfiguratorUI {
  /**
   * @param {HTMLElement} root
   * @param {object} def   Gerätebeschreibung
   * @param {object} opts  getConfig, onSlots, onPreset, onCopy, onFocus, onHoverPart, onOption(key, value), [onSide, onAdoptMachine]
   */
  constructor(root, def, opts) {
    const cats = def.categories;
    super(root, {
      ...opts,
      def,
      cats,
      baseSlot: `${def.id}:body.main`,
      primarySlot: `${def.id}:body.main`,
      idPrefix: `${def.id}-`,
      open: Object.keys(cats)[0],
      emptyHint: `Klicke in der 3D-Ansicht auf ein Bauteil der ${def.name} – es lässt sich dann hier einzeln anpassen.`,
    });
  }

  /** Gerätebeschreibung (auch für temporäre Objekte ohne Konstruktor, siehe summaryOf in main.js) */
  get D() {
    return this.def || this.opts.def;
  }

  _catOfKind(kind) {
    return Object.keys(this.D.categories).find((c) => kindOf(`${c}.x`) === kind);
  }

  build() {
    const D = this.D;
    const r = this.root;
    r.innerHTML = '';
    r.append(this._buildEditor());
    const row = el('div', { class: 'preset-row', role: 'list' });
    D.presets.forEach((p, i) => {
      row.append(
        el('button', { class: 'preset', type: 'button', role: 'listitem', 'data-dpreset': i, onclick: () => this.opts.onPreset(p.config) }, [
          el('span', { class: 'preset-dots', 'aria-hidden': 'true' }, p.swatches.map((c) => el('span', { style: `background:${c}` }))),
          el('span', { class: 'preset-name', text: p.name }),
        ]),
      );
    });
    r.append(el('section', { class: 'block presets' }, [el('h2', { class: 'label', text: 'Inspiration' }), row]));
    if (D.kind === 'grinder' && this.opts.onAdoptMachine) {
      r.append(
        el('section', { class: 'block match-machine' }, [
          el('div', { class: 'match-text' }, [el('strong', { text: 'Passend zur Maschine' }), el('span', { text: 'Gehäusefarbe, Holz und Akzente deiner Maschine übernehmen.' })]),
          el('button', { class: 'btn small accent', type: 'button', text: 'Wie meine Maschine', onclick: () => this.opts.onAdoptMachine() }),
        ]),
      );
    }
    const steps = el('div', { class: 'steps' });
    let n = 1;
    const num = () => String(n++).padStart(2, '0');
    for (const [cat, c] of Object.entries(D.categories)) {
      const kind = kindOf(`${cat}.x`);
      let picker;
      if (kind === 'body') picker = this._bodyPicker('body', () => this._targetKeys(cat));
      else if (kind === 'wood') picker = this._woodPicker(() => this._targetKeys(cat), { panel: true });
      else picker = this._accentPicker('metal', () => this._targetKeys(cat));
      const extra = [];
      // optionale Holzteile (z. B. Deckel, Seitenteile) an/aus
      const optional = c.slots.filter((s) => s.panel);
      const toggles = optional.map((s) => {
        const seg = this._segmented(
          [
            { id: 'on', name: 'Mit' },
            { id: 'off', name: 'Ohne' },
          ],
          (id) => this.opts.onSlots([s.key], { id: id === 'on' ? this._fallbackWood(s.key) : 'none' }),
        );
        extra.push(el('div', { class: 'field' }, [el('span', { class: 'label', text: s.label }), seg]));
        return { key: s.key, seg };
      });
      const step = this._step(cat, num(), c.title, [c.slots.length > 1 ? this._chips(cat) : null, ...extra, c.hint ? el('p', { class: 'hint-text small', text: c.hint }) : null, picker.node]);
      Object.assign(this.refs.steps[cat], { picker, toggles });
      steps.append(step);
    }
    // Optionen (Bauform, Ausstattung …) und bei Mühlen die Aufstellung
    const optFields = [];
    const segs = {};
    for (const o of D.options || []) {
      const seg = this._segmented(o.choices, (id) => this.opts.onOption(o.key, id));
      segs[o.key] = seg;
      optFields.push(el('div', { class: 'field' }, [el('span', { class: 'label', text: o.label }), seg, o.hint ? el('p', { class: 'hint-text small', text: o.hint }) : null]));
    }
    if (D.kind === 'grinder' && this.opts.onSide) {
      const seg = this._segmented(GRINDER_SIDES.map((s) => ({ id: s.id, name: s.name.replace(' der Maschine', '') })), (id) => this.opts.onSide(id));
      segs.__side = seg;
      optFields.push(el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Aufstellung neben der Maschine' }), seg]));
    }
    if (optFields.length) {
      steps.append(this._step('options', num(), D.optionsTitle || 'Ausstattung', optFields));
      Object.assign(this.refs.steps.options, { segs });
    }
    r.append(steps);
    this.refs.summary = el('dl', { class: 'summary-list' });
    r.append(
      el('details', { class: 'block summary' }, [el('summary', {}, [el('span', { class: 'label', text: `Deine ${D.name}` }), el('span', { class: 'chev', html: CHEVRON })]), this.refs.summary]),
    );
  }

  /** Holz für ein optionales Teil: das erste angebrachte Holz des Geräts, sonst Walnuss */
  _fallbackWood(key) {
    const cfg = this.opts.getConfig();
    const woodCat = this._catOfKind('wood');
    for (const s of this.D.categories[woodCat]?.slots || []) {
      const v = cfg.slots[s.key];
      if (s.key !== key && v && v.id !== 'none' && !resolveWood(v).plastic) return v.id;
    }
    return 'walnut';
  }

  refresh() {
    const cfg = this.opts.getConfig();
    const D = this.D;
    for (const [cat, s] of Object.entries(this.refs.steps)) {
      const isOpen = this.open === cat;
      s.section.classList.toggle('open', isOpen);
      s.head.setAttribute('aria-expanded', String(isOpen));
      s.section.querySelectorAll('.chip').forEach((c) => {
        const on = c.dataset.target === this.target[cat];
        c.classList.toggle('active', on);
        c.setAttribute('aria-pressed', String(on));
      });
      if (cat === 'options') continue;
      const keys = this._targetKeys(cat);
      s.current.textContent = keys.length ? s.picker.refresh(cfg, keys) : 'Ohne';
      for (const t of s.toggles || []) setActive(t.seg, cfg.slots[t.key].id !== 'none' ? 'on' : 'off');
    }
    const o = this.refs.steps.options;
    if (o) {
      const opts = cfg.opts?.[D.id] || {};
      const texts = [];
      for (const op of D.options || []) {
        setActive(o.segs[op.key], opts[op.key]);
        texts.push(finishName(op.choices, opts[op.key]));
      }
      if (o.segs.__side) {
        setActive(o.segs.__side, cfg.grinder.side);
        texts.push(finishName(GRINDER_SIDES, cfg.grinder.side).replace(' der Maschine', ''));
      }
      o.current.textContent = texts.join(' · ');
    }
    this.editor?.refresh(cfg);
    this._renderSummary(cfg);
  }

  /** Bauteil auswählen (Klick im 3D-Modell) */
  selectPart(slot) {
    const D = this.D;
    const cfg = this.opts.getConfig();
    const kind = kindOf(slot);
    const cat = categoryOf(slot);
    const c = D.categories[cat];
    const info = c.slots.find((s) => s.key === slot);
    if (!info) return;
    const ed = this.refs.editor;
    const value = cfg.slots[slot];
    const blocks = [];
    const refreshers = [];
    const action = (text, onclick, cls = '') => el('button', { class: `btn small ${cls}`, type: 'button', text, onclick });
    const actions = el('div', { class: 'editor-actions' });
    const others = c.slots.map((s) => s.key).filter((k) => k !== slot && (!c.slots.find((x) => x.key === k).panel || cfg.slots[k].id !== 'none'));
    if (kind === 'body') {
      this.colorTab.edit = value.id === 'custom' ? 'custom' : collectionOf(value.id) || BODY_COLLECTIONS[0].id;
      const picker = this._bodyPicker('edit', () => [slot], { compact: true });
      blocks.push(picker.node);
      refreshers.push((x) => picker.refresh(x, [slot]));
      if (others.length) actions.append(action(`Auf das ganze Gehäuse übertragen`, () => this.opts.onCopy(others, this.opts.getConfig().slots[slot])));
    } else if (kind === 'wood') {
      const picker = this._woodPicker(() => [slot], { panel: true, compact: true });
      blocks.push(picker.node);
      refreshers.push((x) => picker.refresh(x, [slot]));
      if (info.panel) {
        const removeBtn = action(`${info.label} entfernen`, () => this.opts.onSlots([slot], { id: 'none' }), 'ghost');
        actions.append(removeBtn);
        refreshers.push((x) => (removeBtn.hidden = x.slots[slot].id === 'none'));
      }
      if (others.length) actions.append(action('Auf alle Holzteile übertragen', () => this.opts.onCopy(others, this.opts.getConfig().slots[slot])));
    } else {
      const k = resolveMetal(value).kind;
      this.colorTab.edit = k === 'metal' ? 'metal' : k === 'paint' ? 'igp' : 'uni';
      const picker = this._accentPicker('edit', () => [slot]);
      blocks.push(picker.node);
      refreshers.push((x) => picker.refresh(x, [slot]));
      if (others.length) actions.append(action('Auf alle Akzente übertragen', () => this.opts.onCopy(others, this.opts.getConfig().slots[slot])));
    }
    if (actions.childElementCount) blocks.push(actions);
    this.selected = slot;
    if (!info.panel || value.id !== 'none') this.target[cat] = slot;
    ed.title.textContent = info.label;
    ed.sub.textContent = `${D.name} · ${c.title}`;
    ed.body.replaceChildren(...blocks);
    ed.card.classList.remove('empty');
    ed.card.classList.remove('glow');
    void ed.card.offsetWidth;
    ed.card.classList.add('glow');
    this.editor = { slot, refresh: (x) => refreshers.forEach((fn) => fn(x)) };
    this.refresh();
    requestAnimationFrame(() => ed.card.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  // -------------------------------------------------------------------------
  _accentBg(cfg, r) {
    if (r.kind === 'paint') return paintBackground(r);
    if (r.kind === 'body') return paintBackground(resolveBody(cfg.slots[`${this.D.id}:body.main`]));
    if (r.kind === 'wood') return woodGradient(r.wood);
    return swatchBackground(r.color, r.kind);
  }

  _name(cfg, key) {
    const kind = kindOf(key);
    const v = cfg.slots[key];
    if (kind === 'body') return resolveBody(v).name;
    if (kind === 'wood') return resolveWood(v).name;
    const r = resolveMetal(v);
    return r.kind === 'body' ? 'Wie Gehäuse' : r.name;
  }

  _valueText(cfg, key, long = false) {
    const v = cfg.slots[key];
    const kind = kindOf(key);
    if (kind === 'wood') {
      const w = resolveWood(v);
      return w.none ? 'Ohne' : `${w.name} · ${finishName(WOOD_FINISHES, v.finish)}`;
    }
    if (kind === 'body') {
      const r = resolveBody(v);
      return `${r.name}${long && r.code ? ` (${r.series} ${r.code})` : ''} · ${finishName(BODY_FINISHES, v.finish)}`;
    }
    const r = resolveMetal(v);
    const name = r.kind === 'body' ? `Wie Gehäuse (${resolveBody(cfg.slots[`${this.D.id}:body.main`]).name})` : r.name;
    return `${name} · ${finishName(METAL_FINISHES, v.finish)}`;
  }

  _renderSummary(cfg) {
    const D = this.D;
    const dl = this.refs.summary;
    dl.innerHTML = '';
    for (const c of Object.values(D.categories)) {
      dl.append(el('dt', { class: 'sum-cat', text: c.title }));
      for (const s of c.slots) {
        const v = cfg.slots[s.key];
        const kind = kindOf(s.key);
        let bg;
        if (kind === 'wood') {
          const w = resolveWood(v);
          bg = w.none ? 'transparent' : `linear-gradient(100deg, ${w.light}, ${w.mid} 50%, ${w.dark})`;
        } else if (kind === 'body') bg = paintBackground(resolveBody(v));
        else bg = this._accentBg(cfg, resolveMetal(v));
        dl.append(el('dd', {}, [el('span', { class: 'sum-dot', style: `background:${bg}` }), el('span', { class: 'sum-part', text: s.label }), el('span', { class: 'sum-val', text: this._valueText(cfg, s.key) })]));
      }
    }
    if (D.options?.length) {
      dl.append(el('dt', { class: 'sum-cat', text: D.optionsTitle || 'Ausstattung' }));
      const opts = cfg.opts?.[D.id] || {};
      for (const o of D.options) {
        dl.append(el('dd', {}, [el('span', { class: 'sum-dot', style: 'background:transparent' }), el('span', { class: 'sum-part', text: o.label }), el('span', { class: 'sum-val', text: finishName(o.choices, opts[o.key]) })]));
      }
    }
  }

  stageLabel(id) {
    const cfg = this.opts.getConfig();
    const l = this.D.stageLabels?.[id];
    if (!l) return { part: id, material: '' };
    const [part, mat] = l;
    // Material: Slot-Schlüssel(n) -> Farbname, sonst fester Text
    const material = Array.isArray(mat) ? mat.map((k) => this._name(cfg, k)).join(', ') : cfg.slots[mat] ? this._name(cfg, mat) : mat || '';
    return { part, material };
  }

  configCode() {
    const cfg = this.opts.getConfig();
    const D = this.D;
    const str = JSON.stringify([D.slots.map((k) => cfg.slots[k]), cfg.opts?.[D.id] || {}]);
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return `${D.code}-${h.toString(36).toUpperCase().padStart(7, '0').slice(-7)}`;
  }

  /** Eckdaten für Abschlusskarte, Set-Panel und Variationen: Gehäuse, Akzente, Holz, Optionen */
  finalSummary(cfg = this.opts.getConfig()) {
    const D = this.D;
    const rows = [];
    const bodyCat = this._catOfKind('body');
    const metalCat = this._catOfKind('metal');
    const woodCat = this._catOfKind('wood');
    const main = resolveBody(cfg.slots[`${D.id}:body.main`]);
    const bodyKeys = D.categories[bodyCat].slots.map((s) => s.key);
    const same = bodyKeys.every((k) => JSON.stringify(cfg.slots[k]) === JSON.stringify(cfg.slots[bodyKeys[0]]));
    rows.push(['Gehäuse', `${main.name}${main.code ? ' · ' + main.code : ''} · ${finishName(BODY_FINISHES, cfg.slots[`${D.id}:body.main`].finish)}${same ? '' : ' (mehrfarbig)'}`, paintBackground(main)]);
    if (woodCat) {
      const woods = D.categories[woodCat].slots.map((s) => [s, resolveWood(cfg.slots[s.key])]).filter(([, w]) => !w.none);
      if (woods.length) {
        const names = [...new Set(woods.map(([, w]) => w.name))];
        rows.push(['Holz', `${names.join(' / ')} · ${woods.map(([s]) => s.label).join(', ')}`, woodGradient(woods[0][1])]);
      } else rows.push(['Holz', 'Ohne', 'transparent']);
    }
    if (metalCat) {
      const metal = D.categories[metalCat].slots.map((s) => s.key);
      const counts = {};
      for (const k of metal) counts[cfg.slots[k].id] = (counts[cfg.slots[k].id] || 0) + 1;
      const [topId, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      const topKey = metal.find((k) => cfg.slots[k].id === topId);
      rows.push(['Akzente', n === metal.length ? this._name(cfg, topKey) : `${this._name(cfg, topKey)} (${n} von ${metal.length} Teilen)`, this._accentBg(cfg, resolveMetal(cfg.slots[topKey]))]);
    }
    const opts = cfg.opts?.[D.id] || {};
    for (const o of D.options || []) rows.push([o.label, finishName(o.choices, opts[o.key]), 'transparent']);
    return rows;
  }

  summaryText() {
    const cfg = this.opts.getConfig();
    const D = this.D;
    const lines = [`${D.full} – Konfiguration ${this.configCode()}`, ''];
    for (const c of Object.values(D.categories)) {
      lines.push(c.title);
      for (const s of c.slots) lines.push(`  ${s.label}: ${this._valueText(cfg, s.key, true)}`);
    }
    if (D.options?.length) {
      lines.push(D.optionsTitle || 'Ausstattung');
      const opts = cfg.opts?.[D.id] || {};
      for (const o of D.options) lines.push(`  ${o.label}: ${finishName(o.choices, opts[o.key])}`);
    }
    return lines.join('\n');
  }
}
