// ---------------------------------------------------------------------------
// Bedienoberfläche für die Mühle Weber Workshops EG-1
// Nutzt dieselben Auswahl-Bausteine wie die Maschine (Farbkarten, Holz, Metall,
// Auswahlkarte beim Anklicken), mit eigenen Schritten und Texten.
// ---------------------------------------------------------------------------
import {
  GRINDER_CATEGORIES,
  GRINDER_PRESETS,
  BODY_COLLECTIONS,
  BODY_FINISHES,
  METAL_FINISHES,
  WOOD_FINISHES,
  BURRS,
  GRINDER_SIDES,
  collectionOf,
  resolveBody,
  resolveMetal,
  resolveWood,
  finishName,
  categoryOf,
  kindOf,
} from './data.js';
import { ConfiguratorUI, paintBackground, swatchBackground, el, setActive, woodGradient } from './ui.js';

const GSLOTS = (cat) => GRINDER_CATEGORIES[cat].slots.map((s) => s.key);
const SLOT_INFO = Object.fromEntries(
  Object.values(GRINDER_CATEGORIES).flatMap((c) => c.slots.map((s) => [s.key, { label: s.label, cat: c.title }])),
);
const burrShort = (id) => finishName(BURRS, id).split(' ')[0];

export class GrinderUI extends ConfiguratorUI {
  /**
   * @param {HTMLElement} root
   * @param {object} opts  wie ConfiguratorUI, zusätzlich onLid(on), onBurrs(id), onSide(id), onAdoptMachine()
   */
  constructor(root, opts) {
    super(root, {
      ...opts,
      cats: GRINDER_CATEGORIES,
      baseSlot: 'gbody.housing',
      primarySlot: 'gbody.housing',
      idPrefix: 'g-',
      open: 'gbody',
      emptyHint: 'Klicke in der 3D-Ansicht auf ein Bauteil der Mühle – Trichter, Einstellring, Schiene, Becher … – um es hier einzeln anzupassen.',
    });
  }

  // Hinweis: build/refresh laufen schon im Konstruktor der Basisklasse – deshalb keine
  // privaten Felder (#…) in dieser Klasse.
  build() {
    const r = this.root;
    r.innerHTML = '';
    r.append(this._buildEditor());

    const row = el('div', { class: 'preset-row', role: 'list' });
    GRINDER_PRESETS.forEach((p, i) => {
      row.append(
        el('button', { class: 'preset', type: 'button', role: 'listitem', 'data-gpreset': i, onclick: () => this.opts.onPreset(p.config) }, [
          el('span', { class: 'preset-dots', 'aria-hidden': 'true' }, p.swatches.map((c) => el('span', { style: `background:${c}` }))),
          el('span', { class: 'preset-name', text: p.name }),
        ]),
      );
    });
    r.append(el('section', { class: 'block presets' }, [el('h2', { class: 'label', text: 'Inspiration' }), row]));

    // Abstimmung mit der Maschine
    r.append(
      el('section', { class: 'block match-machine' }, [
        el('div', { class: 'match-text' }, [
          el('strong', { text: 'Passend zur Maschine' }),
          el('span', { text: 'Gehäusefarbe, Holz und Akzente deiner Linea Mini R übernehmen.' }),
        ]),
        el('button', { class: 'btn small accent', type: 'button', id: 'g-adopt', text: 'Wie meine Maschine', onclick: () => this.opts.onAdoptMachine() }),
      ]),
    );

    const steps = el('div', { class: 'steps' });
    steps.append(this._gBodyStep('01'), this._gMetalStep('02'), this._gWoodStep('03'), this._gDetailStep('04'));
    r.append(steps);

    this.refs.summary = el('dl', { class: 'summary-list' });
    r.append(
      el('details', { class: 'block summary' }, [
        el('summary', {}, [el('span', { class: 'label', text: 'Deine Mühle' }), el('span', { class: 'chev', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' })]),
        this.refs.summary,
      ]),
    );
  }

  _gBodyStep(num) {
    const picker = this._bodyPicker('body', () => this._targetKeys('gbody'));
    const step = this._step('gbody', num, 'Gehäuse', [this._chips('gbody'), picker.node]);
    Object.assign(this.refs.steps.gbody, { picker });
    return step;
  }

  _gMetalStep(num) {
    const picker = this._accentPicker('metal', () => this._targetKeys('gmetal'));
    const step = this._step('gmetal', num, 'Metallakzente', [this._chips('gmetal'), picker.node]);
    Object.assign(this.refs.steps.gmetal, { picker });
    return step;
  }

  _gWoodStep(num) {
    const lidSeg = this._segmented(
      [
        { id: 'on', name: 'Mit Holzdeckel' },
        { id: 'off', name: 'Ohne' },
      ],
      (id) => this.opts.onLid(id === 'on'),
    );
    const picker = this._woodPicker(() => this._targetKeys('gwood'), { panel: true });
    const step = this._step('gwood', num, 'Holz', [
      this._chips('gwood'),
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Trichterdeckel' }), lidSeg]),
      el('p', { class: 'hint-text small', text: 'Die Holzauflage (Platen) zentriert den Becher. Ab Werk ist sie aus Eiche.' }),
      picker.node,
    ]);
    Object.assign(this.refs.steps.gwood, { picker, lidSeg });
    return step;
  }

  _gDetailStep(num) {
    const burrSeg = this._segmented(BURRS.map((b) => ({ id: b.id, name: b.name.split(' (')[0] })), (id) => this.opts.onBurrs(id));
    const burrNote = el('p', { class: 'hint-text small' });
    const sideSeg = this._segmented(GRINDER_SIDES.map((s) => ({ id: s.id, name: s.name.replace(' der Maschine', '') })), (id) => this.opts.onSide(id));
    const step = this._step('gdetails', num, 'Mahlscheiben & Aufstellung', [
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Mahlscheiben (80 mm, ab Werk)' }), burrSeg, burrNote]),
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'Aufstellung neben der Maschine' }), sideSeg]),
    ]);
    Object.assign(this.refs.steps.gdetails, { burrSeg, burrNote, sideSeg });
    return step;
  }

  // -------------------------------------------------------------------------
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
    const S = this.refs.steps;
    S.gbody.current.textContent = S.gbody.picker.refresh(cfg, this._targetKeys('gbody'));
    S.gmetal.current.textContent = S.gmetal.picker.refresh(cfg, this._targetKeys('gmetal'));
    const lidOn = cfg.slots['gwood.lid'].id !== 'none';
    setActive(S.gwood.lidSeg, lidOn ? 'on' : 'off');
    const woodText = S.gwood.picker.refresh(cfg, this._targetKeys('gwood'));
    S.gwood.current.textContent = `${woodText}${lidOn ? ' · mit Deckel' : ''}`;
    setActive(S.gdetails.burrSeg, cfg.grinder.burrs);
    setActive(S.gdetails.sideSeg, cfg.grinder.side);
    S.gdetails.burrNote.textContent = finishName(BURRS, cfg.grinder.burrs);
    S.gdetails.current.textContent = `${burrShort(cfg.grinder.burrs)} · ${finishName(GRINDER_SIDES, cfg.grinder.side).replace(' der Maschine', '')}`;
    this.editor?.refresh(cfg);
    this._renderSummary(cfg);
  }

  /** Bauteil der Mühle auswählen (Klick im 3D-Modell) */
  selectPart(slot) {
    const cfg = this.opts.getConfig();
    const kind = kindOf(slot);
    const cat = categoryOf(slot);
    const info = SLOT_INFO[slot];
    const ed = this.refs.editor;
    const value = cfg.slots[slot];
    const blocks = [];
    const refreshers = [];
    const action = (text, onclick, cls = '') => el('button', { class: `btn small ${cls}`, type: 'button', text, onclick });
    const actions = el('div', { class: 'editor-actions' });

    if (kind === 'body') {
      this.colorTab.edit = value.id === 'custom' ? 'custom' : collectionOf(value.id) || BODY_COLLECTIONS[0].id;
      const picker = this._bodyPicker('edit', () => [slot], { compact: true });
      blocks.push(picker.node);
      refreshers.push((c) => picker.refresh(c, [slot]));
      const others = GSLOTS('gbody').filter((k) => k !== slot);
      actions.append(action('Auf die ganze Mühle übertragen', () => this.opts.onCopy(others, this.opts.getConfig().slots[slot])));
    } else if (kind === 'wood') {
      const isLid = slot === 'gwood.lid';
      const note = el('p', { class: 'editor-note' });
      if (isLid) blocks.push(note);
      const picker = this._woodPicker(() => [slot], { panel: true, compact: true });
      blocks.push(picker.node);
      refreshers.push((c) => picker.refresh(c, [slot]));
      const other = isLid ? 'gwood.platen' : 'gwood.lid';
      const copyBtn = action(isLid ? 'Gleiches Holz für die Auflage' : 'Gleiches Holz für den Deckel', () => this.opts.onCopy([other], this.opts.getConfig().slots[slot]));
      const removeBtn = isLid ? action('Deckel entfernen', () => this.opts.onLid(false), 'ghost') : null;
      actions.append(...[copyBtn, removeBtn].filter(Boolean));
      refreshers.push((c) => {
        const on = c.slots[slot].id !== 'none';
        if (isLid) {
          note.textContent = on ? 'Holzdeckel auf dem Trichter (rb.crafts-Stil).' : 'Kein Deckel – Holz antippen, um einen Holzdeckel aufzusetzen.';
          note.classList.toggle('warn', !on);
          removeBtn.hidden = !on;
        }
        copyBtn.hidden = !on || c.slots[other].id === c.slots[slot].id;
      });
    } else {
      const k = resolveMetal(value).kind;
      this.colorTab.edit = k === 'metal' ? 'metal' : k === 'paint' ? 'igp' : 'uni';
      const picker = this._accentPicker('edit', () => [slot]);
      blocks.push(picker.node);
      refreshers.push((c) => picker.refresh(c, [slot]));
      const others = GSLOTS('gmetal').filter((x) => x !== slot);
      actions.append(action('Auf alle Akzente der Mühle übertragen', () => this.opts.onCopy(others, this.opts.getConfig().slots[slot])));
    }
    if (actions.childElementCount) blocks.push(actions);

    this.selected = slot;
    if (slot !== 'gwood.lid' || value.id !== 'none') this.target[cat] = slot;
    ed.title.textContent = info.label;
    ed.sub.textContent = `Mühle · ${info.cat}`;
    ed.body.replaceChildren(...blocks);
    ed.card.classList.remove('empty');
    ed.card.classList.remove('glow');
    void ed.card.offsetWidth;
    ed.card.classList.add('glow');
    this.editor = { slot, refresh: (c) => refreshers.forEach((fn) => fn(c)) };
    this.refresh();
    requestAnimationFrame(() => ed.card.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  // -------------------------------------------------------------------------
  _accentBg(cfg, r) {
    if (r.kind === 'paint') return paintBackground(r);
    if (r.kind === 'body') return paintBackground(resolveBody(cfg.slots['gbody.housing']));
    if (r.kind === 'wood') return woodGradient(r.wood);
    return swatchBackground(r.color, r.kind);
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
    const name = r.kind === 'body' ? `Wie Gehäuse (${resolveBody(cfg.slots['gbody.housing']).name})` : r.name;
    return `${name} · ${finishName(METAL_FINISHES, v.finish)}`;
  }

  _renderSummary(cfg) {
    const dl = this.refs.summary;
    dl.innerHTML = '';
    for (const c of Object.values(GRINDER_CATEGORIES)) {
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
        dl.append(
          el('dd', {}, [
            el('span', { class: 'sum-dot', style: `background:${bg}` }),
            el('span', { class: 'sum-part', text: s.label }),
            el('span', { class: 'sum-val', text: this._valueText(cfg, s.key) }),
          ]),
        );
      }
    }
    dl.append(el('dt', { class: 'sum-cat', text: 'Mahlscheiben' }));
    dl.append(
      el('dd', {}, [
        el('span', { class: 'sum-dot', style: 'background:linear-gradient(135deg,#e8eaec,#9a9ea3)' }),
        el('span', { class: 'sum-part', text: '80 mm, flach' }),
        el('span', { class: 'sum-val', text: finishName(BURRS, cfg.grinder.burrs) }),
      ]),
    );
  }

  /** Name der Farbe eines Slots (für Montageliste) */
  _gName(cfg, key) {
    const kind = kindOf(key);
    if (kind === 'body') return resolveBody(cfg.slots[key]).name;
    if (kind === 'wood') return resolveWood(cfg.slots[key]).name;
    const r = resolveMetal(cfg.slots[key]);
    return r.kind === 'body' ? 'Wie Gehäuse' : r.name;
  }

  stageLabel(id) {
    const cfg = this.opts.getConfig();
    const p = (k) => this._gName(cfg, k);
    const labels = {
      gbase: ['Sockel', p('gbody.base')],
      'gsk-pcb': ['Steuerung & Netzteil', 'Platine, PID-Regelung'],
      gblock: ['Elektronikblock', p('gbody.stand')],
      gcolumn: ['Säule', p('gbody.stand')],
      'gsk-motor': ['Motor', 'Drehzahl stufenlos'],
      'gsk-drive': ['Antrieb & Welle', 'Stahl'],
      'gsk-burrs': ['Mahlscheiben', `80 mm ${burrShort(cfg.grinder.burrs)}, magnetisch`],
      'gsk-wires': ['Kabel', ''],
      ghousing: ['Korpus', p('gbody.housing')],
      grails: ['Seitenschienen', p('gmetal.rails')],
      gdial: ['Einstellring', p('gmetal.dial')],
      gchamber: ['Mahlkammer & Frontkappe', `${p('gbody.housing')}, Kappe ${p('gmetal.cap')}`],
      gfront: ['Frontblock & Auslauf', p('gmetal.rails')],
      gfunnel: ['Trichter', p('gmetal.funnel')],
      glid: ['Holzdeckel', p('gwood.lid')],
      gplatform: ['Becherteller & Holzauflage', `${p('gmetal.platform')}, ${p('gwood.platen')}`],
      gcup: ['Becher (Blind Shaker)', p('gmetal.cup')],
      gknob: ['Drehzahlknopf', p('gmetal.knob')],
      gscrews: ['Schrauben', p('gmetal.screws')],
      glogo: ['Logo', p('gmetal.logo')],
    };
    const [part, material] = labels[id] || [id, ''];
    return { part, material };
  }

  configCode() {
    const cfg = this.opts.getConfig();
    const str = JSON.stringify([Object.values(GRINDER_CATEGORIES).flatMap((c) => c.slots.map((s) => cfg.slots[s.key])), cfg.grinder.burrs]);
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return `EG1-${h.toString(36).toUpperCase().padStart(7, '0').slice(-7)}`;
  }

  finalSummary(cfg = this.opts.getConfig()) {
    const rows = [];
    const h = resolveBody(cfg.slots['gbody.housing']);
    const same = (keys) => keys.every((k) => JSON.stringify(cfg.slots[k]) === JSON.stringify(cfg.slots[keys[0]]));
    rows.push([
      'Gehäuse',
      same(GSLOTS('gbody')) ? `${h.name}${h.code ? ' · ' + h.code : ''} · ${finishName(BODY_FINISHES, cfg.slots['gbody.housing'].finish)}` : `Korpus ${h.name}, Säule ${resolveBody(cfg.slots['gbody.stand']).name}`,
      paintBackground(h),
    ]);
    const metal = GSLOTS('gmetal');
    const counts = {};
    for (const k of metal) counts[cfg.slots[k].id] = (counts[cfg.slots[k].id] || 0) + 1;
    const [topId, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const topKey = metal.find((k) => cfg.slots[k].id === topId);
    rows.push([
      'Akzente',
      n === metal.length ? this._gName(cfg, topKey) : `${this._gName(cfg, topKey)} (${n} von ${metal.length} Teilen)`,
      this._accentBg(cfg, resolveMetal(cfg.slots[topKey])),
    ]);
    rows.push(['Trichter & Becher', `${this._gName(cfg, 'gmetal.funnel')} / ${this._gName(cfg, 'gmetal.cup')}`, this._accentBg(cfg, resolveMetal(cfg.slots['gmetal.funnel']))]);
    const platen = resolveWood(cfg.slots['gwood.platen']);
    const lid = resolveWood(cfg.slots['gwood.lid']);
    rows.push(['Holz', `Auflage ${platen.name}${lid.none ? ', ohne Deckel' : `, Deckel ${lid.name}`}`, woodGradient(platen)]);
    rows.push(['Mahlscheiben', finishName(BURRS, cfg.grinder.burrs), 'linear-gradient(135deg,#e8eaec,#9a9ea3)']);
    return rows;
  }

  summaryText() {
    const cfg = this.opts.getConfig();
    const lines = [`Weber Workshops EG-1 – Konfiguration ${this.configCode()}`, ''];
    for (const c of Object.values(GRINDER_CATEGORIES)) {
      lines.push(c.title);
      for (const s of c.slots) lines.push(`  ${s.label}: ${this._valueText(cfg, s.key, true)}`);
    }
    lines.push('Details');
    lines.push(`  Mahlscheiben: ${finishName(BURRS, cfg.grinder.burrs)}`);
    lines.push(`  Aufstellung: ${finishName(GRINDER_SIDES, cfg.grinder.side)}`);
    return lines.join('\n');
  }
}
