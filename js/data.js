// ---------------------------------------------------------------------------
// Konfigurations-Daten: Bauteil-Gruppen, Farbpaletten, Holzarten, Presets
// ---------------------------------------------------------------------------

/** Konfigurierbare Bauteil-Gruppen ("Slots"), nach Kategorie sortiert. */
export const CATEGORIES = {
  body: {
    title: 'Gehäuse',
    allLabel: 'Komplett',
    slots: [
      { key: 'body.upper', label: 'Oberteil' },
      { key: 'body.head', label: 'Kopfteil' },
      { key: 'body.lower', label: 'Unterteil' },
      { key: 'body.base', label: 'Basis & Tropfschale' },
    ],
  },
  wood: {
    title: 'Holz',
    allLabel: 'Alle',
    slots: [
      { key: 'wood.paddle', label: 'Paddle' },
      { key: 'wood.knobs', label: 'Drehknöpfe' },
      { key: 'wood.handle', label: 'Siebträgergriff' },
    ],
  },
  metal: {
    title: 'Metallakzente',
    allLabel: 'Alle',
    slots: [
      { key: 'metal.screws', label: 'Schrauben' },
      { key: 'metal.wand', label: 'Dampflanze & Heißwasser' },
      { key: 'metal.portafilter', label: 'Siebträger' },
      { key: 'metal.group', label: 'Brühgruppe' },
      { key: 'metal.caps', label: 'Knopfkappen' },
      { key: 'metal.gauges', label: 'Manometer-Ringe' },
      { key: 'metal.grates', label: 'Gitter & Tassenablage' },
      { key: 'metal.logo', label: 'Schriftzug' },
    ],
  },
};

export const SLOT_LABELS = Object.fromEntries(
  Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => [s.key, `${c.title} · ${s.label}`])),
);

export const categoryOf = (slotKey) => slotKey.split('.')[0];

// ---------------------------------------------------------------------------
// Gehäuse-Lacke
// ---------------------------------------------------------------------------
export const BODY_COLORS = {
  uni: [
    { id: 'schwarz', name: 'Tiefschwarz', color: '#141414' },
    { id: 'weiss', name: 'Reinweiß', color: '#f1f0eb' },
    { id: 'creme', name: 'Cremeweiß', color: '#e6dcc8' },
    { id: 'kiesel', name: 'Kieselgrau', color: '#a39c91' },
    { id: 'sand', name: 'Sand', color: '#c8b89a' },
    { id: 'lichtgrau', name: 'Lichtgrau', color: '#c5c6c2' },
    { id: 'beton', name: 'Betongrau', color: '#6f706d' },
    { id: 'rot', name: 'Signalrot', color: '#a81f1d' },
    { id: 'orange', name: 'Orange', color: '#cf5b25' },
    { id: 'senf', name: 'Senfgelb', color: '#c8962c' },
    { id: 'salbei', name: 'Salbeigrün', color: '#93a08a' },
    { id: 'oliv', name: 'Olivgrün', color: '#545a3f' },
    { id: 'petrol', name: 'Petrol', color: '#24525a' },
    { id: 'pastellblau', name: 'Pastellblau', color: '#9cb6cc' },
    { id: 'marine', name: 'Marineblau', color: '#1f2e48' },
    { id: 'altrosa', name: 'Altrosa', color: '#c9a09c' },
  ],
  metallic: [
    { id: 'champagner', name: 'Champagner', color: '#c9b48e' },
    { id: 'goldbronze', name: 'Goldbronze', color: '#b89a62' },
    { id: 'bronze', name: 'Bronze', color: '#7d5a3a' },
    { id: 'kupfer', name: 'Kupfer', color: '#a65b37' },
    { id: 'rosegold', name: 'Roségold', color: '#c3907c' },
    { id: 'silber', name: 'Silber', color: '#b9bbbd' },
    { id: 'titan', name: 'Titangrau', color: '#77787a' },
    { id: 'anthrazit', name: 'Anthrazit', color: '#3a3c40' },
    { id: 'graphit', name: 'Graphitschwarz', color: '#1f2022' },
    { id: 'nachtblau', name: 'Nachtblau', color: '#1d2c4d' },
    { id: 'petrolmet', name: 'Petrol Metallic', color: '#1f4a52' },
    { id: 'racing', name: 'Racing Green', color: '#1e3a2c' },
    { id: 'bordeaux', name: 'Bordeaux', color: '#5a1824' },
  ],
};

export const BODY_FINISHES = [
  { id: 'gloss', name: 'Hochglanz' },
  { id: 'satin', name: 'Seidenmatt' },
  { id: 'matte', name: 'Matt' },
  { id: 'texture', name: 'Struktur' },
];

// ---------------------------------------------------------------------------
// Metallakzente
// ---------------------------------------------------------------------------
export const METAL_COLORS = {
  metal: [
    { id: 'steel', name: 'Edelstahl', color: '#cfd1d3' },
    { id: 'chrome', name: 'Chrom', color: '#e4e6e9' },
    { id: 'blackchrome', name: 'Schwarzchrom', color: '#34363a' },
    { id: 'gunmetal', name: 'Gunmetal', color: '#55585d' },
    { id: 'titan', name: 'Titan', color: '#8d8b86' },
    { id: 'gold', name: 'Gold', color: '#e1b866' },
    { id: 'rosegold', name: 'Roségold', color: '#dba895' },
    { id: 'copper', name: 'Kupfer', color: '#cf8460' },
    { id: 'brass', name: 'Messing', color: '#c9a85c' },
    { id: 'bronze', name: 'Bronze', color: '#9c7a4c' },
    { id: 'champagne', name: 'Champagner', color: '#dccaa4' },
    { id: 'bluepvd', name: 'Blau PVD', color: '#3f5f93' },
  ],
  uni: [
    { id: 'black', name: 'Schwarz', color: '#161616' },
    { id: 'white', name: 'Weiß', color: '#efefea' },
    { id: 'grey', name: 'Grau', color: '#6e6f71' },
    { id: 'red', name: 'Rot', color: '#a51f1f' },
    { id: 'creme', name: 'Creme', color: '#e3d8c3' },
    { id: 'navy', name: 'Marine', color: '#1f2e48' },
  ],
};

export const METAL_FINISHES = [
  { id: 'gloss', name: 'Hochglanz' },
  { id: 'satin', name: 'Satiniert' },
  { id: 'matte', name: 'Matt' },
];

// ---------------------------------------------------------------------------
// Holzarten – Parameter für die prozedurale Holzmaserung (textures.js)
//   style:  straight | oak | zebra | olive | burl | solid
//   light/mid/dark: Farbverlauf hell -> dunkel
// ---------------------------------------------------------------------------
export const WOODS = [
  { id: 'olive', name: 'Olivenholz', style: 'olive', light: '#ead3a2', mid: '#bf9259', dark: '#4a2d18', seed: 11 },
  { id: 'walnut', name: 'Nussbaum', style: 'straight', light: '#8d6446', mid: '#5f4030', dark: '#2e1d13', freq: 13, warp: 0.1, contrast: 0.55, sharp: 2.5, pores: 0.9, seed: 3 },
  { id: 'oak', name: 'Eiche', style: 'oak', light: '#dcbb88', mid: '#c49a64', dark: '#8d6539', freq: 17, warp: 0.06, contrast: 0.55, sharp: 3.5, pores: 1.3, seed: 5 },
  { id: 'maple', name: 'Ahorn', style: 'straight', light: '#f2e3c4', mid: '#e3cda2', dark: '#c4a676', freq: 9, warp: 0.07, contrast: 0.35, sharp: 3, pores: 0.25, seed: 8 },
  { id: 'cherry', name: 'Kirschbaum', style: 'straight', light: '#c47f55', mid: '#a0603c', dark: '#6a3420', freq: 11, warp: 0.09, contrast: 0.45, sharp: 2.5, pores: 0.35, seed: 13 },
  { id: 'zebrano', name: 'Zebrano', style: 'zebra', light: '#e0caa0', mid: '#bfa073', dark: '#3f2c1b', freq: 15, warp: 0.035, contrast: 0.95, seed: 21 },
  { id: 'padouk', name: 'Padouk', style: 'straight', light: '#c9603a', mid: '#a4452a', dark: '#6b2414', freq: 14, warp: 0.05, contrast: 0.5, sharp: 2, pores: 0.8, seed: 17 },
  { id: 'wenge', name: 'Wengé', style: 'straight', light: '#6a5240', mid: '#3e2c21', dark: '#140d09', freq: 24, warp: 0.04, contrast: 0.85, sharp: 1.6, pores: 1.2, seed: 27 },
  { id: 'bogoak', name: 'Mooreiche', style: 'oak', light: '#5a5048', mid: '#3d3530', dark: '#1d1916', freq: 18, warp: 0.05, contrast: 0.5, sharp: 3, pores: 1.0, seed: 31 },
  { id: 'ebony', name: 'Makassar', style: 'zebra', light: '#86643f', mid: '#4a3322', dark: '#120b07', freq: 11, warp: 0.06, contrast: 1.0, seed: 37 },
  { id: 'burl', name: 'Nuss-Wurzel', style: 'burl', light: '#b07c4f', mid: '#7a5232', dark: '#2f1c10', seed: 41 },
  { id: 'black', name: 'Serie Schwarz', style: 'solid', light: '#1b1b1b', mid: '#161616', dark: '#101010', seed: 1, plastic: true },
];

export const WOOD_FINISHES = [
  { id: 'oiled', name: 'Geölt' },
  { id: 'lacquer', name: 'Hochglanz lackiert' },
];

export const DIALS = [
  { id: 'white', name: 'Weiß' },
  { id: 'black', name: 'Schwarz' },
];

// ---------------------------------------------------------------------------
// Konfigurationen
// ---------------------------------------------------------------------------
const allBody = (id, finish) =>
  Object.fromEntries(CATEGORIES.body.slots.map((s) => [s.key, { id, finish }]));
const allWood = (id, finish = 'oiled') =>
  Object.fromEntries(CATEGORIES.wood.slots.map((s) => [s.key, { id, finish }]));
const allMetal = (id, finish = 'gloss') =>
  Object.fromEntries(CATEGORIES.metal.slots.map((s) => [s.key, { id, finish }]));

function preset(name, swatches, slots, dial = 'white') {
  return { name, swatches, config: { slots, dial } };
}

export const PRESETS = [
  preset('Olive & Kiesel', ['#a39c91', '#c9a066', '#161616'], {
    ...allBody('kiesel', 'satin'),
    ...allWood('olive'),
    ...allMetal('black', 'matte'),
    'metal.portafilter': { id: 'steel', finish: 'satin' },
    'metal.grates': { id: 'steel', finish: 'satin' },
    'metal.group': { id: 'blackchrome', finish: 'satin' },
  }, 'black'),
  preset('Goldbronze Struktur', ['#b89a62', '#c9a066', '#34363a'], {
    ...allBody('goldbronze', 'texture'),
    ...allWood('olive'),
    ...allMetal('blackchrome', 'satin'),
    'metal.grates': { id: 'steel', finish: 'gloss' },
    'metal.logo': { id: 'blackchrome', finish: 'gloss' },
  }),
  preset('Classic Black', ['#141414', '#1b1b1b', '#e4e6e9'], {
    ...allBody('schwarz', 'matte'),
    ...allWood('black'),
    ...allMetal('chrome', 'gloss'),
    'metal.screws': { id: 'steel', finish: 'satin' },
    'metal.caps': { id: 'white', finish: 'gloss' },
  }),
  preset('Arctic Oak', ['#f1f0eb', '#dcbb88', '#cfd1d3'], {
    ...allBody('weiss', 'gloss'),
    ...allWood('oak'),
    ...allMetal('steel', 'satin'),
  }),
  preset('Racing Walnut', ['#1e3a2c', '#5f4030', '#c9a85c'], {
    ...allBody('racing', 'gloss'),
    ...allWood('walnut', 'lacquer'),
    ...allMetal('brass', 'gloss'),
    'metal.grates': { id: 'steel', finish: 'gloss' },
  }),
  preset('Rosso Wengé', ['#a81f1d', '#3e2c21', '#e4e6e9'], {
    ...allBody('rot', 'gloss'),
    ...allWood('wenge'),
    ...allMetal('chrome', 'gloss'),
  }, 'black'),
  preset('Copper Noir', ['#3a3c40', '#3d3530', '#cf8460'], {
    ...allBody('anthrazit', 'satin'),
    ...allWood('bogoak'),
    ...allMetal('copper', 'satin'),
    'metal.grates': { id: 'blackchrome', finish: 'satin' },
  }, 'black'),
  preset('Midnight Burl', ['#1d2c4d', '#7a5232', '#e1b866'], {
    ...allBody('nachtblau', 'gloss'),
    ...allWood('burl', 'lacquer'),
    ...allMetal('gold', 'gloss'),
    'metal.grates': { id: 'steel', finish: 'gloss' },
  }),
  preset('Salbei & Ahorn', ['#93a08a', '#e3cda2', '#dba895'], {
    ...allBody('salbei', 'matte'),
    ...allWood('maple'),
    ...allMetal('rosegold', 'satin'),
  }),
  preset('Zebrano Titan', ['#77787a', '#bfa073', '#8d8b86'], {
    ...allBody('titan', 'satin'),
    ...allWood('zebrano'),
    ...allMetal('titan', 'satin'),
  }, 'black'),
];

export const DEFAULT_CONFIG = PRESETS[0].config;

// ---------------------------------------------------------------------------
// Nachschlagen von Farben (inkl. "Eigene Farbe")
// ---------------------------------------------------------------------------
const BODY_INDEX = new Map([
  ...BODY_COLORS.uni.map((c) => [c.id, { ...c, kind: 'uni' }]),
  ...BODY_COLORS.metallic.map((c) => [c.id, { ...c, kind: 'metallic' }]),
]);
const METAL_INDEX = new Map([
  ...METAL_COLORS.metal.map((c) => [c.id, { ...c, kind: 'metal' }]),
  ...METAL_COLORS.uni.map((c) => [c.id, { ...c, kind: 'uni' }]),
]);
const WOOD_INDEX = new Map(WOODS.map((w) => [w.id, w]));

/** Liefert {name,color,kind} für einen Slot-Wert (inkl. eigener Farbe). */
export function resolveBody(value) {
  if (value.id === 'custom') {
    return { id: 'custom', name: `Eigene Farbe ${value.color}`, color: value.color, kind: value.kind || 'uni' };
  }
  return BODY_INDEX.get(value.id) || BODY_INDEX.get('kiesel');
}
export function resolveMetal(value) {
  if (value.id === 'custom') {
    return { id: 'custom', name: `Eigene Farbe ${value.color}`, color: value.color, kind: value.kind || 'metal' };
  }
  return METAL_INDEX.get(value.id) || METAL_INDEX.get('steel');
}
export function resolveWood(value) {
  return WOOD_INDEX.get(value.id) || WOOD_INDEX.get('olive');
}
export const finishName = (list, id) => (list.find((f) => f.id === id) || list[0]).name;
