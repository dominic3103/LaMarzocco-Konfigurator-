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
// Gehäuse-Lacke: IGP-DURA® Pulverlacke laut Farbkarten
//
// Code-Aufbau (laut Karte): 4201A = Uni, 4201E = Effektfarbton (metallischer
// Schimmer), 4201U = Effektfarbton mit IGP-Effectives®-Technologie (Glitzer).
// IGP-DURA® xal 4201 ist "glattverlaufend, tiefmatt".
//
// Die Hex-Werte sind aus Fotos der Farbkarten gemessen und weißabgeglichen –
// Näherungswerte für die Bildschirmdarstellung, keine Farbmesswerte.
// ---------------------------------------------------------------------------
const igp = (code, name, color, extra = {}) => ({
  id: code,
  code,
  name,
  color,
  effect: code.slice(4, 5) === 'U' ? 'U' : code.slice(4, 5) === 'A' ? 'A' : 'E',
  ...extra,
});

export const BODY_COLLECTIONS = [
  {
    id: 'warm',
    name: 'Warm Radiation',
    series: 'IGP-DURA® xal 42 · 4201',
    colors: [
      igp('4201E94136L30', 'Chiffon Silk', '#e2dfd8'),
      igp('4201E77499L30', 'Silver Tinsel', '#bdb8b3'),
      igp('4201E76256L3F', 'Style 23', '#b4a998'),
      igp('4201E77903L30', 'Titan Power', '#aea097'),
      igp('4201E83775L30', 'Velvet Brown', '#b7a28d'),
      igp('4201E82467L3F', 'Style 24', '#b79066'),
      igp('4201E83934L30', 'English Bronze', '#a18668'),
      igp('4201E83829L30', 'Amaranth Glow', '#8c755d', { sparkle: true }),
    ],
  },
  {
    id: 'tech',
    name: 'Tech Cold',
    series: 'IGP-DURA® xal 42 · 4201',
    colors: [
      igp('4201E79975L30', 'Natural Silver', '#c6c2c3'),
      igp('4201E94063L30', 'Fine Palladium', '#b0b2b9'),
      igp('4201E75307L3F', 'Radiant Silver', '#858489'),
      igp('4201U71386L10', 'Galaxy Depth', '#51515b'),
      igp('4201E83361L30', 'Quarzo Fumo', '#8f7670'),
      igp('4201U75249L10', 'Blued Metal', '#5b6170'),
      igp('4201E63923L3F', 'Jungle Street', '#3b4136'),
      igp('4201U90171L10', 'Traffic Black', '#2c2b2d'),
    ],
  },
  {
    id: 'brave',
    name: 'Brave Colours',
    series: 'IGP-DURA® xal 42 · 4201',
    colors: [
      igp('4201E32377L30', 'Warm Grey', '#c0bdc0'),
      igp('4201E54218L30', 'Admiral Blue', '#385878'),
      igp('4201E84585L30', 'Technical Ceramics', '#b6886e'),
      igp('4201E83618L3F', 'Rare Earth', '#8a534b'),
      igp('4201E64618L3F', 'Jungle Thicket', '#6f7f76'),
      igp('4201E41754L30', 'Rhodonite Stone', '#bd6e74'),
      igp('4201E94085L30', 'Silver Beige', '#bfbfb0'),
      igp('4201E13343L3F', 'Glory Curry', '#ccae63'),
    ],
  },
  {
    id: 'style',
    name: 'Style',
    series: 'IGP-DURA® xal 4201',
    colors: [
      igp('4201E82665L3F', 'xal-Style 21', '#8a7450'),
      igp('4201E13212L3F', 'xal-Style 22', '#8c7d64'),
      igp('4201E76256L3F', 'Style 23', '#b4a998', { label: 'xal-Style 23' }),
      igp('4201E13343L3F', 'Glory Curry', '#ccae63', { label: 'xal-Style 25' }),
      igp('4201E82291L3F', 'xal-Style 26', '#4a4944'),
      igp('4201E81872L3F', 'xal-Style 30', '#7d6b58'),
    ],
  },
  {
    id: 'trend',
    name: 'Trend',
    series: 'IGP-DURA® xal 4201',
    colors: [
      igp('4201E92246L3F', 'xal-Trend 3', '#5a4a3c'),
      igp('4201E90071L3F', 'xal-Trend 6', '#8a857b'),
    ],
  },
  {
    id: 'design',
    name: 'Design',
    series: 'IGP-DURA® xal 4601',
    colors: [
      igp('4601A81423L10', 'xal-Design 12', '#9b8046'),
      igp('4601A50240L10', 'xal-Design 17', '#6f98b6'),
      igp('4601A11572L10', 'xal-Design 20', '#cf831c'),
      igp('4601A62175L10', 'xal-Design 21', '#5b8f1d'),
    ],
  },
];

export const BODY_FINISHES = [
  { id: 'matte', name: 'Tiefmatt' },
  { id: 'satin', name: 'Seidenmatt' },
  { id: 'gloss', name: 'Hochglanz' },
  { id: 'texture', name: 'Struktur' },
];

/** Kollektion, in der eine Farbe (zuerst) vorkommt. */
export function collectionOf(colorId) {
  return BODY_COLLECTIONS.find((c) => c.colors.some((x) => x.id === colorId))?.id || null;
}

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
  preset('Style 23 & Olive', ['#b4a998', '#c9a066', '#161616'], {
    ...allBody('4201E76256L3F', 'matte'),
    ...allWood('olive'),
    ...allMetal('black', 'matte'),
    'metal.portafilter': { id: 'steel', finish: 'satin' },
    'metal.grates': { id: 'steel', finish: 'satin' },
    'metal.group': { id: 'blackchrome', finish: 'satin' },
  }, 'black'),
  preset('Style 21 & Olive', ['#8a7450', '#c9a066', '#34363a'], {
    ...allBody('4201E82665L3F', 'matte'),
    ...allWood('olive'),
    ...allMetal('blackchrome', 'satin'),
    'metal.grates': { id: 'steel', finish: 'gloss' },
    'metal.logo': { id: 'blackchrome', finish: 'gloss' },
  }),
  preset('Traffic Black', ['#2c2b2d', '#1b1b1b', '#e4e6e9'], {
    ...allBody('4201U90171L10', 'matte'),
    ...allWood('black'),
    ...allMetal('chrome', 'gloss'),
    'metal.screws': { id: 'steel', finish: 'satin' },
    'metal.caps': { id: 'white', finish: 'gloss' },
  }),
  preset('Chiffon Silk & Eiche', ['#e2dfd8', '#dcbb88', '#cfd1d3'], {
    ...allBody('4201E94136L30', 'matte'),
    ...allWood('oak'),
    ...allMetal('steel', 'satin'),
  }),
  preset('Jungle Street & Nuss', ['#3b4136', '#5f4030', '#c9a85c'], {
    ...allBody('4201E63923L3F', 'matte'),
    ...allWood('walnut'),
    ...allMetal('brass', 'satin'),
    'metal.grates': { id: 'steel', finish: 'satin' },
  }),
  preset('Rare Earth & Wengé', ['#8a534b', '#3e2c21', '#34363a'], {
    ...allBody('4201E83618L3F', 'matte'),
    ...allWood('wenge'),
    ...allMetal('blackchrome', 'satin'),
    'metal.grates': { id: 'steel', finish: 'satin' },
  }, 'black'),
  preset('Galaxy Depth & Kupfer', ['#51515b', '#3d3530', '#cf8460'], {
    ...allBody('4201U71386L10', 'matte'),
    ...allWood('bogoak'),
    ...allMetal('copper', 'satin'),
    'metal.grates': { id: 'blackchrome', finish: 'satin' },
  }, 'black'),
  preset('Admiral Blue & Wurzel', ['#385878', '#7a5232', '#e1b866'], {
    ...allBody('4201E54218L30', 'matte'),
    ...allWood('burl', 'lacquer'),
    ...allMetal('gold', 'satin'),
    'metal.grates': { id: 'steel', finish: 'satin' },
  }),
  preset('English Bronze & Olive', ['#a18668', '#c9a066', '#55585d'], {
    ...allBody('4201E83934L30', 'matte'),
    ...allWood('olive'),
    ...allMetal('gunmetal', 'satin'),
  }),
  preset('Jungle Thicket & Ahorn', ['#6f7f76', '#e3cda2', '#dba895'], {
    ...allBody('4201E64618L3F', 'matte'),
    ...allWood('maple'),
    ...allMetal('rosegold', 'satin'),
  }),
];

export const DEFAULT_CONFIG = PRESETS[0].config;

// ---------------------------------------------------------------------------
// Nachschlagen von Farben (inkl. "Eigene Farbe")
// ---------------------------------------------------------------------------
const BODY_INDEX = new Map();
for (const col of BODY_COLLECTIONS) {
  for (const c of col.colors) {
    if (!BODY_INDEX.has(c.id)) BODY_INDEX.set(c.id, { ...c, kind: c.effect === 'A' ? 'uni' : 'metallic', series: col.series });
  }
}
export const DEFAULT_BODY_ID = '4201E76256L3F';
const METAL_INDEX = new Map([
  ...METAL_COLORS.metal.map((c) => [c.id, { ...c, kind: 'metal' }]),
  ...METAL_COLORS.uni.map((c) => [c.id, { ...c, kind: 'uni' }]),
]);
const WOOD_INDEX = new Map(WOODS.map((w) => [w.id, w]));

/** Liefert {name,color,kind} für einen Slot-Wert (inkl. eigener Farbe). */
export function resolveBody(value) {
  if (value.id === 'custom') {
    const kind = value.kind === 'metallic' ? 'metallic' : 'uni';
    return { id: 'custom', name: `Eigene Farbe ${value.color}`, color: value.color, kind, effect: kind === 'metallic' ? 'M' : 'A' };
  }
  return BODY_INDEX.get(value.id) || BODY_INDEX.get(DEFAULT_BODY_ID);
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
