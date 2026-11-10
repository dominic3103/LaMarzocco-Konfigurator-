// ---------------------------------------------------------------------------
// Einstiegspunkt: verbindet Modell, Materialien, Viewer und Oberfläche
// ---------------------------------------------------------------------------
import { DEFAULT_CONFIG, CATEGORIES, SLOT_LABELS, categoryOf, resolveWood } from './data.js';
import { MaterialManager } from './materials.js';
import { buildMachine } from './model.js';
import { Viewer, VIEWS } from './viewer.js';
import { ConfiguratorUI } from './ui.js';
import { getWoodTextures } from './textures.js';

const STORAGE_KEY = 'lm-mini-r-konfigurator';
const ALL_SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));

// ---------- Konfiguration laden (Link > zuletzt gespeichert > Standard) ----------
const clone = (o) => JSON.parse(JSON.stringify(o));

function sanitize(cfg) {
  const out = clone(DEFAULT_CONFIG);
  if (!cfg || typeof cfg !== 'object') return out;
  if (cfg.dial === 'white' || cfg.dial === 'black') out.dial = cfg.dial;
  for (const k of ALL_SLOTS) {
    const v = cfg.slots?.[k];
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
mm.apply(config);
model.setDial(config.dial);

const viewer = new Viewer(canvas, viewerEl);
viewer.setModel(model);

// ---------- Oberfläche ----------
const ui = new ConfiguratorUI(document.getElementById('config'), {
  getConfig: () => config,
  onSlots: (keys, patch) => updateSlots(keys, patch),
  onDial: (id) => {
    config.dial = id;
    model.setDial(id);
    commit();
  },
  onPreset: (preset) => {
    const next = sanitize(preset);
    prepareWoods(next, () => {
      config = next;
      mm.apply(config);
      model.setDial(config.dial);
      viewer.flash(mm, ALL_SLOTS);
      commit();
    });
  },
  onFocus: (keys) => viewer.flash(mm, keys),
});

/** Holztexturen vorab erzeugen (kurze Rechenzeit), danach anwenden. */
function prepareWoods(cfg, done) {
  const ids = [...new Set(Object.entries(cfg.slots).filter(([k]) => categoryOf(k) === 'wood').map(([, v]) => v.id))];
  ids.forEach((id) => ui.setBusy(id, true));
  setTimeout(() => {
    ids.forEach((id) => {
      const w = resolveWood({ id });
      if (!w.plastic) getWoodTextures(w);
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
      mm.applySlot(k, next);
    }
    viewer.requestRender();
    commit();
  };
  if (patch.id && categoryOf(keys[0]) === 'wood') {
    prepareWoods({ slots: Object.fromEntries(keys.map((k) => [k, { id: patch.id }])) }, apply);
  } else {
    apply();
  }
}

let hashTimer = null;
function commit() {
  ui.refresh();
  viewer.requestRender();
  persist(config);
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    history.replaceState(null, '', `#cfg=${encodeConfig(config)}`);
  }, 250);
}

// ---------- Auswahl im 3D-Modell ----------
const tooltip = document.getElementById('tooltip');
viewer.on('hover', (slot, e) => {
  viewer.setHover(mm, slot);
  canvas.style.cursor = slot ? 'pointer' : '';
  if (slot && e) {
    const rect = viewerEl.getBoundingClientRect();
    tooltip.textContent = SLOT_LABELS[slot];
    tooltip.style.transform = `translate(${e.clientX - rect.left + 14}px, ${e.clientY - rect.top + 16}px)`;
    tooltip.hidden = false;
  } else {
    tooltip.hidden = true;
  }
});
viewer.on('pick', (slot) => {
  if (!slot) return;
  ui.focusSlot(slot);
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
setAutoRotate(!matchMedia('(prefers-reduced-motion: reduce)').matches);

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

document.getElementById('btn-share').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}#cfg=${encodeConfig(config)}`;
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    toast('Link zur Konfiguration kopiert');
  } catch {
    prompt('Link zur Konfiguration:', url);
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
document.getElementById('btn-shot').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = viewer.snapshot();
  a.download = 'linea-mini-r-konfiguration.png';
  a.click();
  toast('Bild gespeichert');
});
document.getElementById('btn-reset').addEventListener('click', () => {
  config = clone(DEFAULT_CONFIG);
  mm.apply(config);
  model.setDial(config.dial);
  viewer.flash(mm, ALL_SLOTS);
  commit();
  toast('Auf Standard zurückgesetzt');
});

window.addEventListener('hashchange', () => {
  const m = location.hash.match(/cfg=([\w-]+)/);
  const c = m && decodeConfig(m[1]);
  if (!c) return;
  const next = sanitize(c);
  if (JSON.stringify(next) === JSON.stringify(config)) return;
  prepareWoods(next, () => {
    config = next;
    mm.apply(config);
    model.setDial(config.dial);
    commit();
  });
});

// Ladeanzeige ausblenden
requestAnimationFrame(() => document.body.classList.add('ready'));

// für Tests / Debugging
window.__konfigurator = { viewer, mm, model, getConfig: () => config, ui };
