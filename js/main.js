// ---------------------------------------------------------------------------
// Einstiegspunkt: verbindet Modell, Materialien, Viewer und Oberfläche
// ---------------------------------------------------------------------------
import {
  DEFAULT_CONFIG,
  CATEGORIES,
  SLOT_LABELS,
  NEUTRAL_SLOTS,
  NEUTRAL_SHAPE,
  NEUTRAL_OPTIONS,
  RAIL_STYLES,
  TRAY_STYLES,
  KNOB_SHAPES,
  HANDLE_SHAPES,
  GAUGE_DIALS,
  NEEDLES,
  SCREW_HEADS,
  categoryOf,
  kindOf,
  productOf,
  baseSlotOf,
  MACHINE_SLOTS,
  GRINDER_SLOTS,
  GRINDER_CATEGORIES,
  BURRS,
  GRINDER_SIDES,
  resolveBody,
  resolveMetal,
  resolveWood,
} from './data.js';
import { MaterialManager } from './materials.js';
import { buildMachine } from './model.js';
import { Viewer, VIEWS } from './viewer.js';
import { ConfiguratorUI } from './ui.js';
import { getWoodTextures } from './wood.js';
import { LIGHTINGS, lightingById } from './lighting.js';
import { AssemblyShow, isInnerStage } from './assembly.js';
import { ARExperience } from './ar.js';
import { buildGrinder, EG1 } from './grinder.js';
import { GrinderUI } from './grinder-ui.js';
import { MAX_VARIANTS, VARIANT_PRODUCTS, extractVariant, applyVariant, sanitizeVariants, filledVariants, stepVariant } from './variants.js';

const STORAGE_KEY = 'lm-mini-r-konfigurator';
const ALL_SLOTS = [...MACHINE_SLOTS, ...GRINDER_SLOTS];
const SLOTS_OF = { machine: MACHINE_SLOTS, grinder: GRINDER_SLOTS, set: ALL_SLOTS };

// ---------- Konfiguration laden (Link > zuletzt gespeichert > Standard) ----------
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Konfiguration samt Variationen prüfen */
function sanitize(cfg) {
  const out = sanitizeCore(cfg);
  out.variants = sanitizeVariants(cfg && typeof cfg === 'object' ? cfg.variants : null, out, sanitizeCore);
  return out;
}

/** Eine einzelne Konfiguration prüfen (ohne Variationen) */
function sanitizeCore(cfg) {
  const out = clone(DEFAULT_CONFIG);
  if (!cfg || typeof cfg !== 'object') return out;
  // Manometer: neue Form je Anzeige; ältere Konfigurationen kannten nur ein Zifferblatt für beide
  for (const side of ['left', 'right']) {
    const g = cfg.gauges?.[side];
    if (g && GAUGE_DIALS.some((d) => d.id === g.dial) && NEEDLES.some((n) => n.id === g.needle)) out.gauges[side] = { dial: g.dial, needle: g.needle };
    else if (cfg.dial === 'white' || cfg.dial === 'black') out.gauges[side] = { dial: cfg.dial, needle: cfg.dial === 'black' ? 'gold' : 'red' };
  }
  if (SCREW_HEADS.some((h) => h.id === cfg.screwHead)) out.screwHead = cfg.screwHead;
  // Bauform der Reling und Lochbild der Bleche; ältere Konfigurationen behalten ihr bisheriges Aussehen
  const okStyle = (list, v) => list.some((x) => x.id === v);
  if (okStyle(RAIL_STYLES, cfg.railStyle)) out.railStyle = cfg.railStyle;
  else if (cfg.slots) out.railStyle = NEUTRAL_OPTIONS.railStyle;
  if (cfg.slots) out.tray = { ...NEUTRAL_OPTIONS.tray };
  if (cfg.tray) {
    if (okStyle(TRAY_STYLES, cfg.tray.drip)) out.tray.drip = cfg.tray.drip;
    if (okStyle(TRAY_STYLES, cfg.tray.cup)) out.tray.cup = cfg.tray.cup;
  }
  // ältere Konfigurationen ohne die neuen optionalen Teile: neutral ergänzen
  if (cfg.slots) {
    for (const [k, v] of Object.entries(NEUTRAL_SLOTS)) if (!cfg.slots[k]) out.slots[k] = clone(v);
  }
  out.rail = typeof cfg.rail === 'boolean' ? cfg.rail : cfg.slots ? false : out.rail;
  const shape = cfg.shape || (cfg.slots ? NEUTRAL_SHAPE : out.shape);
  out.shape = {
    knobs: KNOB_SHAPES.some((x) => x.id === shape.knobs) ? shape.knobs : NEUTRAL_SHAPE.knobs,
    handle: HANDLE_SHAPES.some((x) => x.id === shape.handle) ? shape.handle : NEUTRAL_SHAPE.handle,
  };
  for (const k of ALL_SLOTS) {
    const v = cfg.slots?.[k];
    const resolver = { body: resolveBody, wood: resolveWood, metal: resolveMetal }[kindOf(k)];
    // unbekannte Farb-IDs (z. B. aus älteren Links) -> Standard behalten
    if (v && typeof v.id === 'string' && v.id !== 'custom' && resolver(v).id !== v.id) continue;
    if (v && typeof v.id === 'string') {
      out.slots[k] = { id: v.id, finish: typeof v.finish === 'string' ? v.finish : out.slots[k].finish };
      if (v.id === 'custom' && /^#[0-9a-f]{6}$/i.test(v.color || '')) {
        out.slots[k].color = v.color;
        out.slots[k].kind = v.kind;
      } else if (v.id === 'custom') {
        out.slots[k] = clone(DEFAULT_CONFIG.slots[k]);
      }
    }
  }
  // Mühle: Mahlscheiben und Aufstellung
  const gr = cfg.grinder || {};
  out.grinder = {
    burrs: BURRS.some((b) => b.id === gr.burrs) ? gr.burrs : out.grinder.burrs,
    side: GRINDER_SIDES.some((x) => x.id === gr.side) ? gr.side : out.grinder.side,
  };
  return out;
}

function encodeConfig(cfg) {
  const json = JSON.stringify(cfg);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeConfig(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return null;
  }
}
// Kurzform für Links und QR-Codes: JSON komprimiert (deflate) und base64url-kodiert -> "#z=…"
const b64url = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function packConfig(cfg) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([JSON.stringify(cfg)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return b64url(new Uint8Array(await new Response(stream).arrayBuffer()));
  } catch {
    return null;
  }
}
async function unpackConfig(str) {
  try {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(stream).text());
  } catch {
    return null;
  }
}
const packedInHash = () => location.hash.match(/(?:^#|&)z=([\w-]+)/)?.[1] || null;

function loadInitial() {
  const m = location.hash.match(/cfg=([\w-]+)/);
  if (m) {
    const c = decodeConfig(m[1]);
    if (c) return sanitize(c);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {
    /* Speicher nicht verfügbar */
  }
  return sanitize(clone(DEFAULT_CONFIG));
}
function persist(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignorieren */
  }
}

let config = loadInitial();

// ---------- Produkt: Maschine, Mühle oder beide zusammen ----------
const PRODUCT_KEY = 'lm-mini-r-produkt';
const PRODUCTS = ['machine', 'grinder', 'set'];
function initialProduct() {
  const m = location.hash.match(/(?:^#|&)p=(machine|grinder|set)\b/);
  if (m) return m[1];
  try {
    const v = localStorage.getItem(PRODUCT_KEY);
    if (PRODUCTS.includes(v)) return v;
  } catch {
    /* Speicher nicht verfügbar */
  }
  return 'machine';
}
let product = initialProduct();
/** Produkt im Link (Maschine ist Standard und fehlt deshalb) */
const productParam = () => (product === 'machine' ? '' : `&p=${product}`);

// ---------- 3D ----------
const canvas = document.getElementById('scene');
const viewerEl = document.getElementById('viewer');
const mm = new MaterialManager();
const model = buildMachine(mm);
const gmodel = buildGrinder(mm);

/** Konfiguration komplett auf Materialien und Bauteile anwenden */
function applyAll() {
  mm.apply(config);
  syncParts();
}
/** Sichtbarkeit optionaler Teile und Formen */
function syncParts() {
  model.setRail(config.rail, config.railStyle);
  model.setTrays(config.tray);
  model.setPanels({
    upper: config.slots['wood.panelUpper'].id !== 'none',
    lower: config.slots['wood.panelLower'].id !== 'none',
  });
  model.setShapes(config.shape);
  model.setGauge('left', config.gauges.left);
  model.setGauge('right', config.gauges.right);
  model.setScrewHead(config.screwHead);
  // Mühle
  gmodel.setLid(config.slots['gwood.lid'].id !== 'none');
  const dial = resolveMetal(config.slots['gmetal.dial']);
  gmodel.setDialInk(dial.kind === 'body' ? resolveBody(config.slots['gbody.housing']).color : dial.color);
}
applyAll();

const LIGHT_KEY = 'lm-mini-r-licht';
let lightId = 'studio';
try {
  lightId = lightingById(localStorage.getItem(LIGHT_KEY) || 'studio').id;
} catch {
  /* Speicher nicht verfügbar */
}
// Darstellungsqualität: automatisch, per ?q=high|low erzwingbar (z. B. für Tests)
const params = new URLSearchParams(location.search);
const qParam = params.get('q');
const viewer = new Viewer(canvas, viewerEl, {
  lighting: lightId,
  quality: qParam === 'high' || qParam === 'low' ? qParam : 'auto',
  samples: Number(params.get('samples')) || 0,
});
viewer.setModel(model);
viewer.addModel(gmodel, { w: 0.4, d: 0.4, z: 0.004 });

// ---------- Oberfläche ----------
const ui = new ConfiguratorUI(document.getElementById('config'), {
  getConfig: () => config,
  onSlots: (keys, patch) => updateSlots(keys, patch),
  /** Manometer: Zifferblatt/Zeiger für eine oder beide Anzeigen */
  onGauge: (sides, patch) => {
    for (const side of sides) config.gauges[side] = { ...config.gauges[side], ...patch };
    syncParts();
    viewer.flash(mm, ['metal.gauges']);
    commit();
  },
  onScrewHead: (id) => {
    config.screwHead = id;
    syncParts();
    viewer.flash(mm, ['metal.screws']);
    commit();
  },
  onPreset: (preset) => applyPreset('machine', preset),
  onRail: (on) => {
    config.rail = !!on;
    syncParts();
    if (on) viewer.flash(mm, ['metal.rail']);
    commit();
  },
  onPanels: (mode) => {
    const id = panelWood();
    setPanelSlots(mode === 'both' || mode === 'upper' ? id : 'none', mode === 'both' || mode === 'lower' ? id : 'none');
  },
  /** Seitenplatten an einem Bereich anbringen (aus der Auswahlkarte) */
  onPanelAdd: (region) => {
    const id = panelWood();
    const up = config.slots['wood.panelUpper'].id;
    const lo = config.slots['wood.panelLower'].id;
    setPanelSlots(region === 'upper' ? id : up, region === 'lower' ? id : lo);
  },
  /** Wert eines Bauteils auf andere Bauteile übertragen */
  onCopy: (keys, value) => copySlots(keys, value),
  onHoverPart: (slot) => viewer.setHover(mm, slot),
  onPanelWood: (id) => {
    const up = config.slots['wood.panelUpper'].id !== 'none';
    const lo = config.slots['wood.panelLower'].id !== 'none';
    // noch keine Platten: Holz antippen bringt Platten am Unterteil an (wie bei rb.crafts üblich)
    if (!up && !lo) setPanelSlots('none', id);
    else setPanelSlots(up ? id : 'none', lo ? id : 'none');
  },
  onRailStyle: (id) => {
    config.railStyle = id;
    if (!config.rail) config.rail = true;
    syncParts();
    viewer.flash(mm, ['metal.rail']);
    commit();
  },
  onTray: (part, id) => {
    config.tray = { ...config.tray, [part]: id };
    syncParts();
    viewer.flash(mm, ['metal.grates']);
    commit();
  },
  onShape: (part, id) => {
    config.shape = { ...config.shape, [part]: id };
    syncParts();
    viewer.flash(mm, [part === 'knobs' ? 'wood.knobs' : 'wood.handle']);
    commit();
  },
  onFocus: (keys) => viewer.flash(mm, keys),
});

// ---------- Oberfläche der Mühle ----------
const gui = new GrinderUI(document.getElementById('config-grinder'), {
  getConfig: () => config,
  onSlots: (keys, patch) => updateSlots(keys, patch),
  onPreset: (preset) => applyPreset('grinder', preset),
  onCopy: (keys, value) => copySlots(keys, value),
  onHoverPart: (slot) => viewer.setHover(mm, slot),
  onFocus: (keys) => viewer.flash(mm, keys),
  onLid: (on) => setLid(on),
  onBurrs: (id) => {
    config.grinder.burrs = id;
    commit();
  },
  onSide: (id) => {
    config.grinder.side = id;
    if (product === 'set') setProduct('set', { force: true });
    commit();
  },
  onAdoptMachine: () => adoptMachine(),
});

/** Akzente "Wie Gehäuse" folgen der Gehäusefarbe ihres Geräts */
function reapplyFollowers(keys) {
  for (const base of ['body.base', 'gbody.housing']) {
    if (!keys.includes(base)) continue;
    for (const k of SLOTS_OF[productOf(base)]) {
      if (kindOf(k) === 'metal' && config.slots[k].id === 'body') mm.applySlot(k, config.slots[k], config);
    }
  }
}

/** Wert eines Bauteils auf andere Bauteile übertragen */
function copySlots(keys, value) {
  if (!keys.length) return;
  const v = clone(value);
  prepareWoods({ slots: Object.fromEntries(keys.map((k) => [k, v])) }, () => {
    for (const k of keys) {
      config.slots[k] = clone(v);
      mm.applySlot(k, config.slots[k], config);
    }
    reapplyFollowers(keys);
    syncParts();
    viewer.flash(mm, keys);
    commit();
  });
}

/** Preset nur für ein Gerät übernehmen – das andere bleibt, wie es ist */
function applyPreset(which, preset) {
  const merged = clone(config);
  const own = SLOTS_OF[which];
  for (const k of own) delete merged.slots[k];
  if (which === 'machine') {
    Object.assign(merged, clone(preset));
    merged.slots = { ...clone(config.slots), ...clone(preset.slots) };
    for (const k of MACHINE_SLOTS) if (!preset.slots[k]) delete merged.slots[k];
    merged.grinder = clone(config.grinder);
  } else {
    merged.slots = { ...merged.slots, ...clone(preset.slots) };
    merged.grinder = { ...config.grinder, burrs: preset.grinder?.burrs || config.grinder.burrs };
  }
  const next = sanitize(merged);
  prepareWoods(next, () => {
    config = next;
    applyAll();
    viewer.flash(mm, own);
    commit();
  });
}

/** Trichterdeckel aufsetzen (Holz wie die Auflage) oder abnehmen */
function setLid(on) {
  const cur = config.slots['gwood.lid'];
  const id = on ? (cur.id !== 'none' ? cur.id : config.slots['gwood.platen'].id) : 'none';
  updateSlots(['gwood.lid'], { id });
}

/** Mühle an die Maschine angleichen: Gehäusefarben, Holz und Akzente übernehmen */
function adoptMachine() {
  const m = config.slots;
  const pick = (k) => clone(m[k]);
  const wood = resolveWood(m['wood.handle']);
  const woodId = wood.plastic || wood.none ? null : wood.id;
  const next = {
    'gbody.housing': pick('body.upper'),
    'gbody.stand': pick('body.lower'),
    'gbody.base': pick('body.base'),
    'gmetal.rails': pick('metal.group'),
    'gmetal.cap': pick('metal.group'),
    'gmetal.dial': pick('metal.caps'),
    'gmetal.funnel': pick('metal.portafilter'),
    'gmetal.cup': pick('metal.portafilter'),
    'gmetal.platform': pick('metal.feet'),
    'gmetal.knob': pick('metal.caps'),
    'gmetal.screws': pick('metal.screws'),
    'gmetal.logo': pick('metal.logo'),
  };
  if (woodId) {
    next['gwood.platen'] = { id: woodId, finish: m['wood.handle'].finish };
    if (config.slots['gwood.lid'].id !== 'none') next['gwood.lid'] = { id: woodId, finish: m['wood.handle'].finish };
  }
  prepareWoods({ slots: next }, () => {
    for (const [k, v] of Object.entries(next)) {
      config.slots[k] = v;
      mm.applySlot(k, v, config);
    }
    reapplyFollowers(['gbody.housing']);
    syncParts();
    viewer.flash(mm, GRINDER_SLOTS);
    commit();
    toast('Farben, Holz und Akzente der Maschine übernommen');
  });
}

/** Holz für Seitenplatten: vorhandene Platten, sonst Griffholz, sonst Nussbaum */
function panelWood() {
  for (const k of ['wood.panelLower', 'wood.panelUpper']) if (config.slots[k].id !== 'none') return config.slots[k].id;
  const h = resolveWood(config.slots['wood.handle']);
  return h.plastic || h.none ? 'walnut' : h.id;
}
function setPanelSlots(upperId, lowerId) {
  const next = { 'wood.panelUpper': upperId, 'wood.panelLower': lowerId };
  prepareWoods({ slots: Object.fromEntries(Object.entries(next).map(([k, id]) => [k, { id }])) }, () => {
    for (const [k, id] of Object.entries(next)) {
      config.slots[k] = { id, finish: config.slots[k].finish || 'oiled' };
      mm.applySlot(k, config.slots[k], config);
    }
    syncParts();
    viewer.flash(mm, Object.keys(next).filter((k) => next[k] !== 'none'));
    commit();
  });
}

/** Holztexturen vorab erzeugen (kurze Rechenzeit), danach anwenden. */
function prepareWoods(cfg, done) {
  const ids = [...new Set(Object.entries(cfg.slots).filter(([k]) => kindOf(k) === 'wood').map(([, v]) => v.id))];
  ids.forEach((id) => {
    ui.setBusy(id, true);
    gui.setBusy(id, true);
  });
  setTimeout(() => {
    ids.forEach((id) => {
      const w = resolveWood({ id });
      if (!w.plastic && !w.none) getWoodTextures(w);
      ui.setBusy(id, false);
      gui.setBusy(id, false);
    });
    done();
  }, 30);
}

function updateSlots(keys, patch) {
  const apply = () => {
    for (const k of keys) {
      const cur = config.slots[k];
      let next;
      if (patch.id === 'custom') next = { id: 'custom', finish: cur.finish, color: patch.color, kind: patch.kind };
      else if (patch.id) next = { id: patch.id, finish: cur.finish };
      else next = { ...cur, ...patch };
      config.slots[k] = next;
      mm.applySlot(k, next, config);
    }
    reapplyFollowers(keys);
    syncParts();
    viewer.requestRender();
    commit();
  };
  if (patch.id && kindOf(keys[0]) === 'wood') {
    prepareWoods({ slots: Object.fromEntries(keys.map((k) => [k, { id: patch.id }])) }, apply);
  } else {
    apply();
  }
}

// Als Claude-Artifact eingebettet: keine Downloads und keine Konfiguration im Link möglich
const ARTIFACT = document.querySelector('.app')?.dataset.mode === 'artifact';

let hashTimer = null;
/** Aktive Variante je Gerät mit der bearbeiteten Konfiguration abgleichen */
function syncVariants() {
  for (const p of VARIANT_PRODUCTS) {
    const V = config.variants[p];
    V.list[V.active] = extractVariant(p, config);
  }
}

function commit() {
  syncVariants();
  ui.refresh();
  gui.refresh();
  renderSetPanel();
  renderVariants();
  viewer.requestRender();
  persist(config);
  if (ARTIFACT) return;
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    refreshPacked().then(() => history.replaceState(null, '', `#${linkCode()}${productParam()}`));
  }, 250);
}

// Kurzlink zur aktuellen Konfiguration vorhalten (wird beim Teilen ohne Wartezeit gebraucht).
// compact: ohne Variationen (nur die gezeigte Kombination), z. B. für den QR-Code
let packed = null;
const withoutVariants = (cfg) => {
  const c = clone(cfg);
  delete c.variants;
  return c;
};
/** Für den Link: Variationen nur mitnehmen, wenn es mehr als eine gibt */
const forLink = (cfg) => (VARIANT_PRODUCTS.some((p) => filledVariants(cfg.variants[p]).length > 1) ? cfg : withoutVariants(cfg));
function refreshPacked() {
  const json = JSON.stringify(config);
  const compact = withoutVariants(config);
  return Promise.all([packConfig(forLink(config)), packConfig(compact)]).then(([z, zc]) => {
    packed = z ? { z, zc, json } : null;
  });
}
function linkCode(compact = false) {
  const fresh = packed && packed.json === JSON.stringify(config);
  if (fresh) return `z=${compact ? packed.zc : packed.z}`;
  return `cfg=${encodeConfig(compact ? withoutVariants(config) : forLink(config))}`;
}
function shareUrl({ compact = false } = {}) {
  if (ARTIFACT) return null;
  return `${location.origin}${location.pathname}#${linkCode(compact)}${productParam()}`;
}

// ---------- Auswahl im 3D-Modell ----------
const tooltip = document.getElementById('tooltip');
viewer.on('hover', (slot, e) => {
  viewer.setHover(mm, slot);
  canvas.style.cursor = slot ? 'pointer' : '';
  if (slot && e) {
    const rect = viewerEl.getBoundingClientRect();
    tooltip.replaceChildren(
      Object.assign(document.createElement('strong'), { textContent: SLOT_LABELS[slot] }),
      Object.assign(document.createElement('span'), { textContent: 'Klicken zum Anpassen' }),
    );
    tooltip.style.transform = `translate(${e.clientX - rect.left + 14}px, ${e.clientY - rect.top + 16}px)`;
    tooltip.hidden = false;
  } else {
    tooltip.hidden = true;
  }
});
viewer.on('pick', (slot, e, part) => {
  if (!slot) return;
  // Teil des anderen Geräts (oder in der gemeinsamen Ansicht): zu dessen Bereich wechseln
  const p = productOf(slot);
  if (p !== product) setProduct(p);
  (p === 'grinder' ? gui : ui).selectPart(slot, part);
  viewer.flash(mm, [slot]);
});

// ---------- Ansichten & Auto-Rotation ----------
const viewBar = document.getElementById('views');
for (const [name, v] of Object.entries(VIEWS)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = v.label;
  b.dataset.view = name;
  b.addEventListener('click', () => {
    setAutoRotate(false);
    viewer.setView(name);
  });
  viewBar.append(b);
}
const rotateBtn = document.getElementById('autorotate');
function setAutoRotate(on) {
  viewer.setAutoRotate(on);
  rotateBtn.setAttribute('aria-pressed', String(on));
  rotateBtn.querySelector('.pill-label').textContent = on ? '360° läuft' : '360° drehen';
}
rotateBtn.addEventListener('click', () => setAutoRotate(!viewer.controls.autoRotate));
viewer.onInteraction(() => setAutoRotate(false));
// Start im Stillstand: so rechnet sich das Bild sofort in voller Qualität fertig
setAutoRotate(false);

// ---------- Lichtstimmungen ----------
const LIGHT_ICONS = {
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
  window: '<svg viewBox="0 0 24 24"><rect x="4.5" y="3.5" width="15" height="17" rx="1.5"/><path d="M12 3.5v17M4.5 12h15"/></svg>',
  sunset: '<svg viewBox="0 0 24 24"><path d="M6.5 16a5.5 5.5 0 0 1 11 0M2.5 19.5h19M12 4.5v3M4.8 9.3l1.9 1.6M19.2 9.3l-1.9 1.6"/></svg>',
  lamp: '<svg viewBox="0 0 24 24"><path d="M12 2.5v5M7 13.5a5 5 0 0 1 10 0zM10 16.5a2 2 0 0 0 4 0"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/></svg>',
};
const bgLayers = document.getElementById('bg-layers');
const lightList = document.getElementById('light-list');
const lightPop = document.getElementById('light-pop');
const lightToggle = document.getElementById('light-toggle');
const baristaToggle = document.getElementById('barista-toggle');
for (const l of LIGHTINGS) {
  const layer = document.createElement('div');
  layer.className = 'bg-layer';
  layer.dataset.light = l.id;
  layer.style.background = l.bg.css;
  bgLayers.append(layer);
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'light-item';
  b.dataset.light = l.id;
  b.innerHTML = `<span class="light-icon">${LIGHT_ICONS[l.icon]}</span><span>${l.name}</span>`;
  b.addEventListener('click', () => {
    applyLighting(l.id);
    closeLightMenu();
  });
  lightList.append(b);
}
function applyLighting(id, animate = true) {
  const l = lightingById(id);
  lightId = l.id;
  viewer.rig.baristaOverride = null; // Barista-Licht folgt wieder der Stimmung
  if (animate) viewer.setLighting(l.id);
  viewerEl.dataset.tone = l.tone;
  bgLayers.querySelectorAll('.bg-layer').forEach((el) => el.classList.toggle('active', el.dataset.light === l.id));
  lightList.querySelectorAll('.light-item').forEach((el) => {
    const on = el.dataset.light === l.id;
    el.classList.toggle('active', on);
    el.setAttribute('aria-pressed', String(on));
  });
  document.getElementById('light-label').textContent = l.name;
  document.getElementById('light-icon').innerHTML = LIGHT_ICONS[l.icon];
  baristaToggle.checked = l.barista > 0;
  try {
    localStorage.setItem(LIGHT_KEY, l.id);
  } catch {
    /* ignorieren */
  }
}
function closeLightMenu() {
  lightPop.hidden = true;
  lightToggle.setAttribute('aria-expanded', 'false');
}
lightToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = lightPop.hidden;
  lightPop.hidden = !open;
  lightToggle.setAttribute('aria-expanded', String(open));
});
lightPop.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', closeLightMenu);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightMenu();
});
baristaToggle.addEventListener('change', () => {
  const preset = lightingById(lightId);
  viewer.setBarista(baristaToggle.checked ? Math.max(preset.barista, 0.8) : 0);
});
applyLighting(lightId, false);

// Darstellungsqualität (automatisch gewählt, hier umschaltbar)
const qualityToggle = document.getElementById('quality-toggle');
const qualityNote = document.getElementById('quality-note');
function syncQuality() {
  const high = viewer.quality === 'high';
  qualityToggle.checked = high;
  qualityToggle.disabled = !viewer.pipeline.supportsHigh;
  qualityNote.textContent = !viewer.pipeline.supportsHigh
    ? 'Dieses Gerät unterstützt nur die schnelle Darstellung.'
    : high
      ? 'Im Stillstand wird das Bild in wenigen Sekunden verfeinert.'
      : 'Schnelle Darstellung ohne weiche Schatten.';
}
qualityToggle.addEventListener('change', () => {
  viewer.setQuality(qualityToggle.checked ? 'high' : 'low');
  syncQuality();
});
viewer.onQualityChange = syncQuality;
syncQuality();

// ---------- Aktionen ----------
const toastEl = document.getElementById('toast');
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => (toastEl.hidden = true), 250);
  }, 2200);
}

const shareBtn = document.getElementById('btn-share');
if (ARTIFACT) shareBtn.hidden = true;
shareBtn.addEventListener('click', async () => {
  const url = shareUrl();
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    toast('Link zur Konfiguration kopiert');
  } catch {
    toast('Link steht jetzt in der Adresszeile – von dort kopieren');
  }
});
/** Text-Zusammenfassung für das aktuelle Produkt (beide im Set) */
function summaryText() {
  const tag = (p, text) => {
    const V = config.variants[p];
    if (filledVariants(V).length < 2) return text;
    return text.replace(/^(.*?) – Konfiguration/, `$1 – Variante ${V.active + 1} – Konfiguration`);
  };
  const m = tag('machine', ui.summaryText());
  const g = tag('grinder', gui.summaryText());
  if (product === 'grinder') return g;
  if (product === 'set') return `${m}\n\n${g}`;
  return m;
}
document.getElementById('btn-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(summaryText());
    toast('Zusammenfassung kopiert');
  } catch {
    toast('Kopieren nicht möglich');
  }
});
const shotBtn = document.getElementById('btn-shot');
const shotOverlay = document.getElementById('shot-overlay');
let shotOpener = shotBtn;
if (ARTIFACT) shotBtn.textContent = 'Bild ansehen';
function closeShot() {
  shotOverlay.hidden = true;
  shotOpener.focus();
}
document.getElementById('shot-close').addEventListener('click', closeShot);
shotOverlay.addEventListener('click', (e) => {
  if (e.target === shotOverlay) closeShot();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !shotOverlay.hidden) closeShot();
});
function takeShot(opener) {
  shotOpener = opener;
  const url = viewer.snapshot();
  if (!ARTIFACT) {
    const a = document.createElement('a');
    a.href = url;
    a.download = { machine: 'linea-mini-r', grinder: 'eg-1', set: 'linea-mini-r-und-eg-1' }[product] + '-konfiguration.png';
    a.click();
    toast('Bild gespeichert');
    return;
  }
  // Downloads sind im Artifact gesperrt: Bild anzeigen, Speichern per Rechtsklick / langem Drücken
  document.getElementById('shot-img').src = url;
  shotOverlay.hidden = false;
  document.getElementById('shot-close').focus();
}
shotBtn.addEventListener('click', () => takeShot(shotBtn));
document.getElementById('btn-reset').addEventListener('click', () => {
  // nur das gerade bearbeitete Gerät zurücksetzen (im Set beide)
  const next = clone(config);
  const d = clone(DEFAULT_CONFIG);
  for (const k of SLOTS_OF[product]) next.slots[k] = d.slots[k];
  if (product !== 'grinder') {
    for (const key of ['gauges', 'screwHead', 'rail', 'railStyle', 'tray', 'shape']) next[key] = d[key];
  }
  if (product !== 'machine') next.grinder = d.grinder;
  config = sanitize(next);
  applyAll();
  viewer.flash(mm, SLOTS_OF[product]);
  if (product === 'set') setProduct('set', { force: true });
  commit();
  toast(product === 'grinder' ? 'Mühle auf Standard zurückgesetzt' : product === 'set' ? 'Beide auf Standard zurückgesetzt' : 'Maschine auf Standard zurückgesetzt');
});

/** Übernimmt eine Konfiguration aus dem Link; liefert ein Promise, das nach dem Anwenden erfüllt ist. */
async function applyFromHash() {
  const z = packedInHash();
  const m = location.hash.match(/cfg=([\w-]+)/);
  const c = z ? await unpackConfig(z) : m && decodeConfig(m[1]);
  if (!c) return false;
  const next = sanitize(c);
  if (JSON.stringify(next) === JSON.stringify(config)) return false;
  await new Promise((resolve) => {
    prepareWoods(next, () => {
      config = next;
      applyAll();
      commit();
      resolve();
    });
  });
  return true;
}
window.addEventListener('hashchange', applyFromHash);

// ---------- AR: Maschine in Originalgröße in den Raum stellen ----------
const ar = new ARExperience({
  getRoots: () => (product === 'grinder' ? [gmodel.root] : product === 'set' ? [model.root, gmodel.root] : [model.root]),
  getName: () => ({ machine: 'Linea-Mini-R', grinder: 'EG-1', set: 'Linea-Mini-R-und-EG-1' })[product],
  // QR-Code: nur die gezeigte Kombination (kürzer, besser lesbar)
  getShareUrl: () => shareUrl({ compact: true }),
});
const arBtn = document.getElementById('btn-ar');
arBtn.addEventListener('click', () => ar.open(arBtn));
document.getElementById('final-ar').addEventListener('click', (e) => ar.open(e.currentTarget));

// ---------- Produktwechsel: Panels, Kamera, Aufstellung ----------
const productSwitch = document.getElementById('product-switch');
const panels = { machine: document.getElementById('config'), grinder: document.getElementById('config-grinder'), set: document.getElementById('config-set') };
const TEXTS = {
  machine: {
    eyebrow: 'Schritt 1 · Maschine',
    title: 'Deine Linea Mini R',
    lede: 'Gehäuse, Holz und Metallakzente frei kombinieren – jede Änderung siehst du sofort in 360°.',
    brand: 'Linea Mini R',
    finish: 'Maschine abschließen',
  },
  grinder: {
    eyebrow: 'Schritt 2 · Mühle',
    title: 'Deine EG-1',
    lede: 'Die Mühle Weber Workshops EG-1 im selben Umfang gestalten – passend zur Maschine oder ganz eigen.',
    brand: 'Weber EG-1',
    finish: 'Mühle abschließen',
  },
  set: {
    eyebrow: 'Schritt 3 · Zusammen',
    title: 'Maschine & Mühle',
    lede: 'Beide Geräte maßstabsgetreu nebeneinander – in 360° und in AR bei dir zuhause.',
    brand: 'Linea Mini R & EG-1',
    finish: 'Set präsentieren',
  },
};
// Kamera: Drehpunkt (m), Abstandsfaktor, Schattenbereich
const FRAMES = {
  machine: { target: [0, 0.185, 0], scale: 1, shadow: 1 },
  grinder: { target: [0, 0.226, 0.012], scale: 1.08, shadow: 1 },
  set: { target: [0, 0.2, 0.01], scale: 1.72, shadow: 1.5, maxDistance: 4.2 },
};
const SET_GAP = 0.09; // Abstand zwischen Maschine und Mühle (m)
/** Positionen (x, z in m) und Sichtbarkeit der Geräte je Produkt */
function layoutFor(p) {
  const side = config.grinder.side === 'right' ? 1 : -1;
  const mw = 0.357;
  const gw = EG1.width / 1000;
  const total = mw + SET_GAP + gw;
  if (p === 'set') {
    return {
      machine: { x: -side * (total / 2 - mw / 2), z: 0.064, on: true },
      grinder: { x: side * (total / 2 - gw / 2), z: 0.02, on: true },
    };
  }
  if (p === 'grinder') return { machine: { x: -side * (mw / 2 + SET_GAP + 0.45), z: 0.064, on: false }, grinder: { x: 0, z: 0, on: true } };
  return { machine: { x: 0, z: 0.064, on: true }, grinder: { x: side * (mw / 2 + SET_GAP + 0.4), z: 0, on: false } };
}
let layoutTicker = null;
function applyLayout(p, animate) {
  const L = layoutFor(p);
  const items = [
    [model.root, L.machine],
    [gmodel.root, L.grinder],
  ];
  if (layoutTicker) viewer.removeTicker(layoutTicker);
  if (!animate) {
    for (const [root, to] of items) {
      root.position.x = to.x;
      root.position.z = to.z;
      root.visible = to.on;
    }
    viewer.syncContacts();
    return;
  }
  // Geräte gleiten an ihren Platz; ausgeblendete Geräte erst am Ende verstecken
  const from = items.map(([root]) => ({ x: root.position.x, z: root.position.z }));
  for (const [root, to] of items) {
    if (to.on && !root.visible) {
      root.visible = true;
      root.position.x = to.x + Math.sign(to.x || -1) * 0.5;
      from[items.findIndex(([r]) => r === root)].x = root.position.x;
    }
  }
  let t = 0;
  layoutTicker = (dt) => {
    t = Math.min(1, t + dt / 0.9);
    const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    items.forEach(([root, to], i) => {
      root.position.x = from[i].x + (to.x - from[i].x) * k;
      root.position.z = from[i].z + (to.z - from[i].z) * k;
      if (t >= 1) root.visible = to.on;
    });
    viewer.syncContacts();
    if (t >= 1) layoutTicker = null;
    return t < 1;
  };
  viewer.addTicker(layoutTicker);
}

/** Zwischen Maschine, Mühle und gemeinsamer Ansicht wechseln */
function setProduct(p, { animate = true, force = false } = {}) {
  if (!PRODUCTS.includes(p)) return;
  const changed = p !== product;
  if (!changed && !force) return;
  product = p;
  try {
    localStorage.setItem(PRODUCT_KEY, p);
  } catch {
    /* ignorieren */
  }
  ui.clearSelection();
  gui.clearSelection();
  for (const [k, el] of Object.entries(panels)) el.hidden = k !== p;
  const t = TEXTS[p];
  document.getElementById('panel-eyebrow').textContent = t.eyebrow;
  document.getElementById('panel-title').textContent = t.title;
  document.getElementById('panel-lede').textContent = t.lede;
  document.getElementById('brand-name').textContent = t.brand;
  document.getElementById('finish-label').textContent = t.finish;
  productSwitch.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.product === p;
    b.classList.toggle('active', on);
    b.setAttribute('aria-current', on ? 'step' : 'false');
  });
  document.querySelector('.app').dataset.product = p;
  applyLayout(p, animate);
  viewer.setFocus(FRAMES[p], animate && (changed || force));
  renderSetPanel();
  renderVariants();
  if (!ARTIFACT) {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      history.replaceState(null, '', `#${linkCode()}${productParam()}`);
    }, 250);
  }
  if (changed) document.querySelector('.panel')?.scrollTo?.({ top: 0, behavior: animate ? 'smooth' : 'auto' });
}
productSwitch.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setProduct(b.dataset.product)));

// ---------- Set-Panel: beide Geräte im Überblick ----------
let setRefs = null;
function renderSetPanel() {
  const root = panels.set;
  if (!root || !gui) return;
  if (!setRefs) {
    const mk = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text) n.textContent = text;
      return n;
    };
    root.replaceChildren();
    const intro = mk('p', 'set-intro', 'Maschine und Mühle stehen maßstabsgetreu nebeneinander. Ziehe zum Drehen, tippe ein Teil an, um es zu ändern.');
    const cards = mk('div', 'set-cards');
    const card = (which, name) => {
      const c = mk('article', 'set-card');
      c.dataset.product = which;
      const dots = mk('span', 'set-dots');
      const txt = mk('div', 'set-text');
      txt.append(mk('p', 'set-name', name), mk('p', 'set-desc'));
      const btn = mk('button', 'btn small', 'Bearbeiten');
      btn.type = 'button';
      btn.addEventListener('click', () => setProduct(which));
      c.append(dots, txt, btn);
      cards.append(c);
      return { dots, desc: txt.querySelector('.set-desc') };
    };
    const cm = card('machine', 'La Marzocco Linea Mini R');
    const cg = card('grinder', 'Weber Workshops EG-1');
    const sideField = mk('div', 'field');
    sideField.append(mk('span', 'label', 'Aufstellung'));
    const seg = mk('div', 'seg');
    for (const s of GRINDER_SIDES) {
      const b = mk('button', '', s.id === 'left' ? 'Mühle links' : 'Mühle rechts');
      b.type = 'button';
      b.dataset.id = s.id;
      b.addEventListener('click', () => {
        config.grinder.side = s.id;
        setProduct('set', { force: true });
        commit();
      });
      seg.append(b);
    }
    sideField.append(seg);
    const actions = mk('div', 'set-actions');
    const arB = mk('button', 'btn primary', 'Beide in AR ansehen');
    arB.type = 'button';
    arB.id = 'set-ar';
    arB.addEventListener('click', () => ar.open(arB));
    const adopt = mk('button', 'btn', 'Mühle an die Maschine angleichen');
    adopt.type = 'button';
    adopt.addEventListener('click', () => adoptMachine());
    actions.append(arB, adopt);
    const dims = mk('p', 'hint-text small', 'Maße (B × T × H): Linea Mini R 357 × 540 × 378 mm, EG-1 245 × 235 × 456 mm. Abstand zwischen den Geräten 9 cm.');
    root.append(intro, cards, sideField, actions, dims);
    setRefs = { cm, cg, seg };
  }
  // Kurzbeschreibung: Gehäuse · Holz · Akzente (je Gerät aus der Abschluss-Zusammenfassung)
  const fill = (ref, rows, labels) => {
    const pick = labels.map((l) => rows.find(([label]) => label === l)).filter(Boolean);
    ref.dots.replaceChildren(
      ...pick.map(([, , bg]) => {
        const d = document.createElement('span');
        d.style.background = bg;
        return d;
      }),
    );
    ref.desc.textContent = pick.map(([, v]) => v.split(' · ')[0].replace(/ \(.*\)$/, '')).join(' · ');
  };
  fill(setRefs.cm, ui.finalSummary(), ['Gehäuse', 'Holzteile', 'Akzente']);
  fill(setRefs.cg, gui.finalSummary(), ['Gehäuse', 'Holz', 'Akzente']);
  for (const [ref, p, name] of [
    [setRefs.cm, 'machine', 'La Marzocco Linea Mini R'],
    [setRefs.cg, 'grinder', 'Weber Workshops EG-1'],
  ]) {
    const V = config.variants[p];
    const n = filledVariants(V).length;
    ref.dots.parentElement.querySelector('.set-name').textContent = n > 1 ? `${name} · Variante ${V.active + 1}` : name;
  }
  setRefs.seg.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.id === config.grinder.side;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

// ---------- Variationen: bis zu 5 je Gerät, frei kombinierbar ----------
const PRODUCT_NAME = { machine: 'Maschine', grinder: 'Mühle' };
const variantBar = document.getElementById('variant-bar');
const variantSkip = document.getElementById('variant-skip');
const finalVariants = document.getElementById('final-variants');

/** Farbpunkte und Kurztext einer Variante */
function describeVariant(p, i) {
  const V = config.variants[p];
  const cfg = i === V.active ? config : applyVariant(p, config, V.list[i]);
  const rows = p === 'grinder' ? gui.finalSummary(cfg) : ui.finalSummary(cfg);
  const labels = p === 'grinder' ? ['Gehäuse', 'Holz', 'Akzente'] : ['Gehäuse', 'Holzteile', 'Akzente'];
  const pick = labels.map((l) => rows.find(([x]) => x === l)).filter(Boolean);
  return { dots: pick.map(([, , bg]) => bg), text: pick.map(([, v]) => v.split(' · ')[0].replace(/ \(.*\)$/, '')).join(' · ') };
}

/** Variante zeigen; ein leerer Platz wird als Kopie der aktuellen Variante angelegt */
function switchVariant(p, idx) {
  const V = config.variants[p];
  if (idx === V.active || idx < 0 || idx >= MAX_VARIANTS) return;
  syncVariants();
  const from = V.active;
  const created = !V.list[idx];
  if (created) V.list[idx] = clone(V.list[from]);
  V.active = idx;
  const next = sanitize(applyVariant(p, config, V.list[idx]));
  prepareWoods(next, () => {
    config = next;
    applyAll();
    if (!created) viewer.flash(mm, SLOTS_OF[p]);
    commit();
    if (!finalCard.hidden) updateFinalCard();
    toast(created ? `Variante ${idx + 1} angelegt (Kopie von ${from + 1}) – jetzt anpassen` : `${PRODUCT_NAME[p]}: Variante ${idx + 1}`);
  });
}

/** Variante entfernen (mindestens eine bleibt) */
function deleteVariant(p, idx) {
  const V = config.variants[p];
  if (filledVariants(V).length < 2 || !V.list[idx]) return;
  syncVariants();
  if (idx !== V.active) {
    V.list[idx] = null;
    commit();
    toast(`Variante ${idx + 1} gelöscht`);
    return;
  }
  const target = stepVariant(V, -1);
  V.list[idx] = null;
  V.active = target;
  const next = sanitize(applyVariant(p, config, V.list[target]));
  prepareWoods(next, () => {
    config = next;
    applyAll();
    viewer.flash(mm, SLOTS_OF[p]);
    commit();
    toast(`Variante ${idx + 1} gelöscht – Variante ${target + 1} wird gezeigt`);
  });
}

const vmk = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/** Knöpfe 1–5 eines Geräts; showEmpty: freie Plätze als "+" zum Anlegen */
function variantButtons(p, showEmpty) {
  const V = config.variants[p];
  const wrap = vmk('div', 'variant-list');
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', `Variationen ${PRODUCT_NAME[p]}`);
  for (let i = 0; i < MAX_VARIANTS; i++) {
    const v = V.list[i];
    if (!v && !showEmpty) continue;
    const b = vmk('button', `variant${v ? '' : ' empty'}${i === V.active ? ' active' : ''}`);
    b.type = 'button';
    b.dataset.product = p;
    b.dataset.index = String(i);
    b.append(vmk('span', 'v-num', String(i + 1)));
    if (v) {
      const d = describeVariant(p, i);
      const dots = vmk('span', 'v-dots');
      for (const bg of d.dots) {
        const dot = vmk('span');
        dot.style.background = bg;
        dots.append(dot);
      }
      b.append(dots);
      b.title = `Variante ${i + 1}: ${d.text}`;
      b.setAttribute('aria-pressed', String(i === V.active));
    } else {
      b.append(vmk('span', 'v-plus', '+'));
      b.title = `Variante ${i + 1} anlegen (Kopie der aktuellen Variante)`;
    }
    b.setAttribute('aria-label', b.title);
    b.addEventListener('click', () => switchVariant(p, i));
    wrap.append(b);
  }
  return wrap;
}

/** Zeile zum Durchschalten: ‹  1 2 3  › */
function variantStepper(p, { compact = false } = {}) {
  const V = config.variants[p];
  const row = vmk('div', `variant-row${compact ? ' compact' : ''}`);
  row.dataset.product = p;
  const prev = vmk('button', 'v-step', '‹');
  prev.type = 'button';
  prev.setAttribute('aria-label', `Vorherige Variante ${PRODUCT_NAME[p]}`);
  prev.addEventListener('click', () => switchVariant(p, stepVariant(config.variants[p], -1)));
  const next = vmk('button', 'v-step', '›');
  next.type = 'button';
  next.setAttribute('aria-label', `Nächste Variante ${PRODUCT_NAME[p]}`);
  next.addEventListener('click', () => switchVariant(p, stepVariant(config.variants[p], 1)));
  const filled = filledVariants(V);
  row.append(vmk('span', 'v-label', PRODUCT_NAME[p]));
  if (compact) {
    row.append(prev, vmk('span', 'v-count', `${filled.indexOf(V.active) + 1} / ${filled.length}`), next);
    row.title = `${PRODUCT_NAME[p]}: Variante ${V.active + 1} – ${describeVariant(p, V.active).text}`;
  } else row.append(prev, variantButtons(p, false), next);
  return row;
}

/** Alle Ansichten der Variationen aktualisieren (Panel, Schnellumschalter, Abschlusskarte) */
function renderVariants() {
  if (!variantBar) return;
  const many = (p) => filledVariants(config.variants[p]).length > 1;
  // Panel
  variantBar.replaceChildren();
  if (product === 'set') {
    const head = vmk('div', 'variant-head');
    head.append(vmk('span', 'label', 'Varianten vergleichen'));
    variantBar.append(head);
    if (many('machine') || many('grinder')) {
      for (const p of VARIANT_PRODUCTS) if (many(p)) variantBar.append(variantStepper(p));
      variantBar.append(vmk('p', 'hint-text small', 'Maschine und Mühle unabhängig wählen – z. B. Maschine Variante 2 mit Mühle Variante 1.'));
    } else {
      variantBar.append(vmk('p', 'hint-text small', 'In Schritt 1 und 2 lassen sich je Gerät bis zu fünf Varianten anlegen, die du hier kombinierst.'));
    }
  } else {
    const p = product;
    const V = config.variants[p];
    const head = vmk('div', 'variant-head');
    head.append(vmk('span', 'label', `Variationen der ${p === 'machine' ? 'Maschine' : 'Mühle'}`));
    if (many(p)) {
      const del = vmk('button', 'v-delete', `Variante ${V.active + 1} löschen`);
      del.type = 'button';
      del.addEventListener('click', () => deleteVariant(p, V.active));
      head.append(del);
    }
    variantBar.append(head, variantButtons(p, true));
    if (!many(p)) variantBar.append(vmk('p', 'hint-text small', 'Unentschlossen? Mit „+“ eine weitere Variante anlegen – beim Abschluss schaltest du zwischen allen hin und her.'));
  }
  // Schnellumschalter im 3D-Bereich
  const skipProducts = (product === 'set' ? VARIANT_PRODUCTS : [product]).filter(many);
  variantSkip.replaceChildren(...skipProducts.map((p) => variantStepper(p, { compact: true })));
  variantSkip.hidden = !skipProducts.length;
  viewerEl.dataset.variants = skipProducts.length ? '1' : '';
  // Abschlusskarte
  const finalProducts = (product === 'set' ? VARIANT_PRODUCTS : [product]).filter(many);
  finalVariants.replaceChildren();
  if (finalProducts.length) {
    finalVariants.append(vmk('p', 'final-variants-title', 'Varianten durchschalten'));
    for (const p of finalProducts) finalVariants.append(variantStepper(p));
  }
  finalVariants.hidden = !finalProducts.length;
}

// ---------- Konfiguration abschließen: Montage-Animation ----------
const appEl = document.querySelector('.app');
const showUi = document.getElementById('show-ui');
const showList = document.getElementById('show-list');
const showBar = document.getElementById('show-bar');
const showTitle = document.querySelector('#show-ui .show-title');
const showEyebrow = document.querySelector('#show-ui .show-eyebrow');
const finalCard = document.getElementById('show-final');
const finishBtn = document.getElementById('btn-finish');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const showHooks = (labelUI, isInner) => ({
  onStage: (id) => {
    const inner = isInner(id);
    showTitle.textContent = inner ? 'Das Innenleben wird montiert' : 'Deine Konfiguration kommt dazu';
    showEyebrow.textContent = inner ? 'Montage · Innenleben' : 'Montage · Deine Konfiguration';
    const { part, material } = labelUI.stageLabel(id);
    const li = document.createElement('li');
    if (inner) li.className = 'inner';
    const name = document.createElement('span');
    name.className = 'show-part';
    name.textContent = part;
    li.append(name);
    if (material) {
      const mat = document.createElement('span');
      mat.className = 'show-mat';
      mat.textContent = material;
      li.append(mat);
    }
    showList.append(li);
  },
  onProgress: (p) => {
    showBar.style.transform = `scaleX(${p})`;
  },
  onDone: () => openFinalCard(),
});
const show = new AssemblyShow(viewer, model, showHooks(ui, isInnerStage));
const gshow = new AssemblyShow(viewer, gmodel, showHooks(gui, gmodel.isInner), {
  stages: gmodel.stages,
  isInner: gmodel.isInner,
  target: FRAMES.grinder.target,
  dist: FRAMES.grinder.scale,
});
// Set: keine Montage, nur eine Kamerafahrt um beide Geräte
const sshow = new AssemblyShow(viewer, { root: { children: [] }, skeleton: { visible: false } }, showHooks(ui, () => false), {
  stages: [],
  target: FRAMES.set.target,
  dist: FRAMES.set.scale,
});
const shows = { machine: show, grinder: gshow, set: sshow };
let currentShow = show;

const nextBtn = document.getElementById('final-next');
function finalRows() {
  if (product === 'grinder') return gui.finalSummary();
  if (product === 'set') {
    const vt = (p) => (filledVariants(config.variants[p]).length > 1 ? ` V${config.variants[p].active + 1}` : '');
    const m = ui.finalSummary().slice(0, 3).map(([l, v, bg]) => [`Maschine${vt('machine')} · ${l}`, v, bg]);
    const g = gui.finalSummary().slice(0, 3).map(([l, v, bg]) => [`Mühle${vt('grinder')} · ${l}`, v, bg]);
    return [...m, ...g];
  }
  return ui.finalSummary();
}
function openFinalCard() {
  showUi.hidden = true;
  updateFinalCard();
  finalCard.hidden = false;
  renderVariants();
  (nextBtn.hidden ? document.getElementById('final-shot') : nextBtn).focus({ preventScroll: true });
  // Maschine neben (Desktop) bzw. über (Handy) die Karte rücken
  requestAnimationFrame(() => {
    const v = viewerEl.getBoundingClientRect();
    const c = finalCard.getBoundingClientRect();
    if (c.left > v.left + v.width * 0.45) viewer.setFrameShift((v.right - c.left) / 2 + 8, 0);
    else viewer.setFrameShift(0, (v.bottom - c.top) / 2 - 20);
  });
}

/** Titel, Nummer und Eckdaten der Abschlusskarte (auch nach dem Umschalten einer Variante) */
function updateFinalCard() {
  const vtag = (p) => (filledVariants(config.variants[p]).length > 1 ? ` · V${config.variants[p].active + 1}` : '');
  document.getElementById('final-title').textContent = {
    machine: `Deine Linea Mini R${vtag('machine')}`,
    grinder: `Deine EG-1${vtag('grinder')}`,
    set: 'Dein Set',
  }[product];
  document.getElementById('final-code').textContent =
    product === 'grinder' ? gui.configCode() : product === 'set' ? `${ui.configCode()} + ${gui.configCode()}` : ui.configCode();
  nextBtn.hidden = product === 'set';
  nextBtn.textContent = product === 'machine' ? 'Weiter zur Mühle' : 'Maschine & Mühle zusammen ansehen';
  const dl = document.getElementById('final-list');
  dl.replaceChildren();
  for (const [label, value, bg] of finalRows()) {
    const row = document.createElement('div');
    row.className = 'final-row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    const dot = document.createElement('span');
    dot.className = 'final-dot';
    dot.style.background = bg;
    if (bg === 'transparent') dot.classList.add('empty');
    const txt = document.createElement('span');
    txt.textContent = value;
    dd.append(dot, txt);
    row.append(dt, dd);
    dl.append(row);
  }
}

function resetShowText() {
  showEyebrow.textContent = product === 'set' ? 'Präsentation' : 'Montage';
  showTitle.textContent = {
    machine: 'Deine Linea Mini R entsteht – von null an',
    grinder: 'Deine EG-1 entsteht – von null an',
    set: 'Maschine und Mühle – dein Set',
  }[product];
  showList.replaceChildren();
}

function startShow() {
  closeLightMenu();
  setAutoRotate(false);
  ui.clearSelection();
  gui.clearSelection();
  currentShow = shows[product];
  appEl.classList.add('show-mode');
  finalCard.hidden = true;
  resetShowText();
  showBar.style.transform = 'scaleX(0)';
  showUi.hidden = false;
  window.scrollTo({ top: 0 });
  if (reduceMotion.matches) {
    currentShow.skip();
    return;
  }
  // kurz warten, bis das Panel eingefahren ist
  setTimeout(() => currentShow.play(), 420);
}

function endShow() {
  viewer.setFrameShift(0, 0);
  currentShow.exit();
  showUi.hidden = true;
  finalCard.hidden = true;
  appEl.classList.remove('show-mode');
  finishBtn.focus({ preventScroll: true });
}

finishBtn.addEventListener('click', startShow);
document.getElementById('show-skip').addEventListener('click', () => currentShow.skip());
nextBtn.addEventListener('click', () => {
  const to = product === 'machine' ? 'grinder' : 'set';
  endShow();
  setProduct(to);
});
document.getElementById('final-replay').addEventListener('click', () => {
  viewer.setFrameShift(0, 0);
  finalCard.hidden = true;
  resetShowText();
  showUi.hidden = false;
  currentShow.play();
});
document.getElementById('final-edit').addEventListener('click', endShow);
document.getElementById('final-shot').addEventListener('click', (e) => takeShot(e.currentTarget));
document.getElementById('final-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(summaryText());
    toast('Zusammenfassung kopiert');
  } catch {
    toast('Kopieren nicht möglich');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !shotOverlay.hidden) return;
  if (currentShow.active) currentShow.skip();
  else if (!finalCard.hidden) endShow();
});

// Ladeanzeige ausblenden
requestAnimationFrame(() => document.body.classList.add('ready'));

// für Tests / Debugging
window.__konfigurator = {
  viewer,
  mm,
  model,
  gmodel,
  getConfig: () => config,
  ui,
  gui,
  show,
  gshow,
  sshow,
  ar,
  shareUrl,
  setProduct,
  getProduct: () => product,
};

// Startansicht: gespeichertes bzw. im Link genanntes Produkt
setProduct(product, { animate: false, force: true });

// Kurzlink (#z=…) übernehmen; mit "ar=1" – z. B. vom QR-Code – gleich den AR-Dialog öffnen
{
  const wantsAR = /(?:^#|&)ar=1\b/.test(location.hash);
  const start = packedInHash() ? applyFromHash() : Promise.resolve();
  start.then(() => {
    refreshPacked();
    if (wantsAR) ar.open(arBtn);
  });
}
