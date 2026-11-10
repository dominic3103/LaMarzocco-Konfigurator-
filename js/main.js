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

const STORAGE_KEY = 'lm-mini-r-konfigurator';
const ALL_SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));

// ---------- Konfiguration laden (Link > zuletzt gespeichert > Standard) ----------
const clone = (o) => JSON.parse(JSON.stringify(o));

function sanitize(cfg) {
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
    const resolver = { body: resolveBody, wood: resolveWood, metal: resolveMetal }[categoryOf(k)];
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
  return clone(DEFAULT_CONFIG);
}
function persist(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignorieren */
  }
}

let config = loadInitial();

// ---------- 3D ----------
const canvas = document.getElementById('scene');
const viewerEl = document.getElementById('viewer');
const mm = new MaterialManager();
const model = buildMachine(mm);

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
  onPreset: (preset) => {
    const next = sanitize(preset);
    prepareWoods(next, () => {
      config = next;
      applyAll();
      viewer.flash(mm, ALL_SLOTS);
      commit();
    });
  },
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
  onCopy: (keys, value) => {
    if (!keys.length) return;
    const v = clone(value);
    prepareWoods({ slots: Object.fromEntries(keys.map((k) => [k, v])) }, () => {
      for (const k of keys) {
        config.slots[k] = clone(v);
        mm.applySlot(k, config.slots[k], config);
      }
      if (keys.includes('body.base')) {
        for (const k of CATEGORIES.metal.slots.map((s) => s.key)) {
          if (config.slots[k].id === 'body') mm.applySlot(k, config.slots[k], config);
        }
      }
      syncParts();
      viewer.flash(mm, keys);
      commit();
    });
  },
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
  const ids = [...new Set(Object.entries(cfg.slots).filter(([k]) => categoryOf(k) === 'wood').map(([, v]) => v.id))];
  ids.forEach((id) => ui.setBusy(id, true));
  setTimeout(() => {
    ids.forEach((id) => {
      const w = resolveWood({ id });
      if (!w.plastic && !w.none) getWoodTextures(w);
      ui.setBusy(id, false);
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
    // Akzente "Wie Gehäuse" folgen der Gehäusefarbe
    if (keys.some((k) => k === 'body.base')) {
      for (const k of CATEGORIES.metal.slots.map((s) => s.key)) {
        if (config.slots[k].id === 'body') mm.applySlot(k, config.slots[k], config);
      }
    }
    syncParts();
    viewer.requestRender();
    commit();
  };
  if (patch.id && categoryOf(keys[0]) === 'wood') {
    prepareWoods({ slots: Object.fromEntries(keys.map((k) => [k, { id: patch.id }])) }, apply);
  } else {
    apply();
  }
}

// Als Claude-Artifact eingebettet: keine Downloads und keine Konfiguration im Link möglich
const ARTIFACT = document.querySelector('.app')?.dataset.mode === 'artifact';

let hashTimer = null;
function commit() {
  ui.refresh();
  viewer.requestRender();
  persist(config);
  if (ARTIFACT) return;
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    history.replaceState(null, '', `#cfg=${encodeConfig(config)}`);
    refreshPacked();
  }, 250);
}

// Kurzlink zur aktuellen Konfiguration vorhalten (wird beim Teilen ohne Wartezeit gebraucht)
let packed = null;
function refreshPacked() {
  const json = JSON.stringify(config);
  packConfig(config).then((z) => {
    packed = z ? { z, json } : null;
  });
}
function shareUrl() {
  if (ARTIFACT) return null;
  const code = packed && packed.json === JSON.stringify(config) ? `z=${packed.z}` : `cfg=${encodeConfig(config)}`;
  return `${location.origin}${location.pathname}#${code}`;
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
  ui.selectPart(slot, part);
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
document.getElementById('btn-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(ui.summaryText());
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
    a.download = 'linea-mini-r-konfiguration.png';
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
  config = clone(DEFAULT_CONFIG);
  applyAll();
  viewer.flash(mm, ALL_SLOTS);
  commit();
  toast('Auf Standard zurückgesetzt');
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
const ar = new ARExperience({ getRoot: () => model.root, getShareUrl: shareUrl });
const arBtn = document.getElementById('btn-ar');
arBtn.addEventListener('click', () => ar.open(arBtn));
document.getElementById('final-ar').addEventListener('click', (e) => ar.open(e.currentTarget));

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

const show = new AssemblyShow(viewer, model, {
  onStage: (id) => {
    const inner = isInnerStage(id);
    showTitle.textContent = inner ? 'Das Innenleben wird montiert' : 'Deine Konfiguration kommt dazu';
    showEyebrow.textContent = inner ? 'Montage · Innenleben' : 'Montage · Deine Konfiguration';
    const { part, material } = ui.stageLabel(id);
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

function openFinalCard() {
  showUi.hidden = true;
  document.getElementById('final-code').textContent = ui.configCode();
  const dl = document.getElementById('final-list');
  dl.replaceChildren();
  for (const [label, value, bg] of ui.finalSummary()) {
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
  finalCard.hidden = false;
  document.getElementById('final-shot').focus({ preventScroll: true });
  // Maschine neben (Desktop) bzw. über (Handy) die Karte rücken
  requestAnimationFrame(() => {
    const v = viewerEl.getBoundingClientRect();
    const c = finalCard.getBoundingClientRect();
    if (c.left > v.left + v.width * 0.45) viewer.setFrameShift((v.right - c.left) / 2 + 8, 0);
    else viewer.setFrameShift(0, (v.bottom - c.top) / 2 - 20);
  });
}

function resetShowText() {
  showEyebrow.textContent = 'Montage';
  showTitle.textContent = 'Deine Linea Mini R entsteht – von null an';
  showList.replaceChildren();
}

function startShow() {
  closeLightMenu();
  setAutoRotate(false);
  ui.clearSelection();
  appEl.classList.add('show-mode');
  finalCard.hidden = true;
  resetShowText();
  showBar.style.transform = 'scaleX(0)';
  showUi.hidden = false;
  window.scrollTo({ top: 0 });
  if (reduceMotion.matches) {
    show.skip();
    return;
  }
  // kurz warten, bis das Panel eingefahren ist
  setTimeout(() => show.play(), 420);
}

function endShow() {
  viewer.setFrameShift(0, 0);
  show.exit();
  showUi.hidden = true;
  finalCard.hidden = true;
  appEl.classList.remove('show-mode');
  finishBtn.focus({ preventScroll: true });
}

finishBtn.addEventListener('click', startShow);
document.getElementById('show-skip').addEventListener('click', () => show.skip());
document.getElementById('final-replay').addEventListener('click', () => {
  viewer.setFrameShift(0, 0);
  finalCard.hidden = true;
  resetShowText();
  showUi.hidden = false;
  show.play();
});
document.getElementById('final-edit').addEventListener('click', endShow);
document.getElementById('final-shot').addEventListener('click', (e) => takeShot(e.currentTarget));
document.getElementById('final-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(ui.summaryText());
    toast('Zusammenfassung kopiert');
  } catch {
    toast('Kopieren nicht möglich');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !shotOverlay.hidden) return;
  if (show.active) show.skip();
  else if (!finalCard.hidden) endShow();
});

// Ladeanzeige ausblenden
requestAnimationFrame(() => document.body.classList.add('ready'));

// für Tests / Debugging
window.__konfigurator = { viewer, mm, model, getConfig: () => config, ui, show, ar, shareUrl };

// Kurzlink (#z=…) übernehmen; mit "ar=1" – z. B. vom QR-Code – gleich den AR-Dialog öffnen
{
  const wantsAR = /(?:^#|&)ar=1\b/.test(location.hash);
  const start = packedInHash() ? applyFromHash() : Promise.resolve();
  start.then(() => {
    refreshPacked();
    if (wantsAR) ar.open(arBtn);
  });
}
