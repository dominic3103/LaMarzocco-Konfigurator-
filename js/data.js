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
      { key: 'wood.panelUpper', label: 'Holzumrandung oben', panel: true, chip: false },
      { key: 'wood.panelLower', label: 'Seitenplatten unten', panel: true, chip: false },
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
      { key: 'metal.rail', label: 'Cup Rail', chip: false },
      { key: 'metal.feet', label: 'Füße' },
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

const ral = (num, name, color) => ({ id: `RAL${num}`, code: `RAL ${num}`, name: `RAL ${num} ${name}`, color, effect: 'A' });

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
    id: 'ral',
    name: 'RAL',
    series: 'RAL Classic – Wunschfarbe als Pulverlack (Näherungswerte)',
    colors: [
      ral('1015', 'Hellelfenbein', '#e5d8bd'),
      ral('1003', 'Signalgelb', '#e9a41c'),
      ral('1013', 'Perlweiß', '#e8e1cc'),
      ral('9001', 'Cremeweiß', '#ece4d3'),
      ral('9010', 'Reinweiß', '#f1ece1'),
      ral('9016', 'Verkehrsweiß', '#f1f0ea'),
      ral('1014', 'Elfenbein', '#dfcea1'),
      ral('1019', 'Graubeige', '#a39382'),
      ral('7044', 'Seidengrau', '#b5b0a1'),
      ral('7039', 'Quarzgrau', '#6b695f'),
      ral('7016', 'Anthrazitgrau', '#383e42'),
      ral('7021', 'Schwarzgrau', '#2f3234'),
      ral('9005', 'Tiefschwarz', '#111113'),
      ral('6009', 'Tannengrün', '#27352a'),
      ral('6021', 'Blassgrün', '#8ba27c'),
      ral('5011', 'Stahlblau', '#1a2b3c'),
      ral('5024', 'Pastellblau', '#6a93b0'),
      ral('3004', 'Purpurrot', '#6b1c23'),
      ral('8017', 'Schokoladenbraun', '#44322d'),
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
    { id: 'gold', name: 'Gold', color: '#e1b866' },
    { id: 'steel', name: 'Edelstahl', color: '#cfd1d3' },
    { id: 'dlc', name: 'Schwarz DLC', color: '#232427' },
    { id: 'chrome', name: 'Chrom', color: '#e4e6e9' },
    { id: 'blackchrome', name: 'Schwarzchrom', color: '#34363a' },
    { id: 'gunmetal', name: 'Gunmetal', color: '#55585d' },
    { id: 'titan', name: 'Titan', color: '#8d8b86' },
    { id: 'rosegold', name: 'Roségold', color: '#dba895' },
    { id: 'copper', name: 'Kupfer', color: '#cf8460' },
    { id: 'brass', name: 'Messing', color: '#c9a85c' },
    { id: 'bronze', name: 'Bronze', color: '#9c7a4c' },
    { id: 'champagne', name: 'Champagner', color: '#dccaa4' },
    { id: 'bluepvd', name: 'Blau PVD', color: '#3f5f93' },
  ],
  uni: [
    { id: 'body', name: 'Wie Gehäuse', color: '#b4a998', followsBody: true },
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
// Holzarten – Kennwerte für die prozedurale Maserung (wood.js)
//   style:   ring (Jahresringe) | olive | zebra | burl | solid
//   light/mid/dark: Farbverlauf Frühholz -> Spätholz
//   rings:   Anzahl Jahresringe bzw. Streifen auf 160 mm Breite
//   contrast/late: Kontrast und Anteil des Spätholzes
//   warp/figure: Schlingern der Faser, Stärke der Fladerung
//   pore:    Gefäße {nx, ny: Raster quer/längs, density, dark, w, ring: nur im Frühholz}
//   streak:  Kernholzstreifen / Adern {color, amt}
// ---------------------------------------------------------------------------
export const WOODS = [
  // rb.crafts-Sortiment (rb: true): Walnuss, Eiche, Olive – Farben nach den Produktfotos
  { id: 'walnut', rb: true, name: 'Walnuss', style: 'ring', light: '#9b7359', mid: '#6e4b3a', dark: '#38231a', rings: 30, contrast: 0.6, late: 0.26, warp: 0.035, figure: 4, fiber: 0.7, tone: 0.16, pore: { nx: 240, ny: 70, density: 0.26, dark: 0.2, w: 0.24 }, streak: { color: '#2b1c16', amt: 0.45, fx: 3 }, seed: 3 },
  { id: 'oak', rb: true, name: 'Eiche', style: 'ring', light: '#e6b068', mid: '#d99c52', dark: '#b67b3a', rings: 26, contrast: 0.5, late: 0.28, warp: 0.03, figure: 8, fiber: 0.6, tone: 0.1, pore: { nx: 200, ny: 80, density: 0.9, dark: 0.3, w: 0.34, ring: 0.3 }, seed: 5 },
  { id: 'olive', rb: true, name: 'Olivenholz', style: 'olive', light: '#f4b257', mid: '#dd9540', dark: '#b56f28', rings: 46, contrast: 0.3, late: 0.3, warp: 0.05, figure: 3, fiber: 0.5, tone: 0.14, pore: { nx: 250, ny: 110, density: 0.18, dark: 0.18 }, streak: { color: '#5a3d24' }, seed: 11 },
  // weitere Hölzer (auf Anfrage)
  { id: 'maple', name: 'Ahorn', style: 'ring', light: '#f0e2c6', mid: '#e6d2ae', dark: '#cfb68c', rings: 30, contrast: 0.36, late: 0.25, warp: 0.03, figure: 6, fiber: 0.45, tone: 0.1, pore: { nx: 256, ny: 120, density: 0.12, dark: 0.12 }, seed: 8 },
  { id: 'cherry', name: 'Kirschbaum', style: 'ring', light: '#cd9468', mid: '#b6744d', dark: '#8d5134', rings: 24, contrast: 0.45, late: 0.22, warp: 0.035, figure: 7, fiber: 0.55, tone: 0.14, pore: { nx: 256, ny: 110, density: 0.22, dark: 0.3 }, streak: { color: '#7a4630', amt: 0.3, fx: 2 }, seed: 13 },
  { id: 'zebrano', name: 'Zebrano', style: 'zebra', light: '#e2c995', mid: '#cfb07a', dark: '#b8975f', rings: 30, stripe: 0.36, warp: 0.02, fiber: 0.6, tone: 0.08, pore: { nx: 200, ny: 80, density: 0.5, dark: 0.3 }, streak: { color: '#4a3220' }, seed: 21 },
  { id: 'padouk', name: 'Padouk', style: 'ring', light: '#cf6c40', mid: '#b55230', dark: '#84331c', rings: 18, contrast: 0.4, late: 0.25, warp: 0.03, figure: 5, fiber: 0.6, tone: 0.16, pore: { nx: 180, ny: 70, density: 0.6, dark: 0.34, w: 0.34 }, streak: { color: '#6e2a18', amt: 0.35, fx: 3 }, seed: 17 },
  { id: 'wenge', name: 'Wengé', style: 'ring', light: '#6b503d', mid: '#422f23', dark: '#1c120c', rings: 64, contrast: 0.95, late: 0.5, warp: 0.02, figure: 5, fiber: 0.7, tone: 0.1, pore: { nx: 170, ny: 60, density: 0.55, dark: 0.3, w: 0.36 }, seed: 27 },
  { id: 'bogoak', name: 'Mooreiche', style: 'ring', light: '#5f554c', mid: '#443c35', dark: '#26201c', rings: 26, contrast: 0.5, late: 0.28, warp: 0.03, figure: 8, fiber: 0.6, tone: 0.1, pore: { nx: 190, ny: 70, density: 0.95, dark: 0.45, w: 0.36, ring: 0.3 }, seed: 31 },
  { id: 'ebony', name: 'Makassar', style: 'zebra', light: '#8d6a45', mid: '#775637', dark: '#5f432b', rings: 20, stripe: 0.62, warp: 0.03, fiber: 0.6, tone: 0.1, pore: { nx: 220, ny: 90, density: 0.3, dark: 0.3 }, streak: { color: '#170e09' }, seed: 37 },
  { id: 'burl', name: 'Nuss-Wurzel', style: 'burl', light: '#b78555', mid: '#8a5f3c', dark: '#553622', fiber: 0.5, tone: 0.16, pore: { nx: 230, ny: 200, density: 0.3, dark: 0.3 }, streak: { color: '#2c1a10' }, seed: 41 },
  { id: 'black', name: 'Serie Schwarz', style: 'solid', light: '#1b1b1b', mid: '#161616', dark: '#101010', seed: 1, plastic: true },
];

export const WOOD_FINISHES = [
  { id: 'oiled', name: 'Geölt' },
  { id: 'lacquer', name: 'Hochglanz lackiert' },
];

/** Formen der Holzteile – 'groove' und 'facet' (Griff) sind die rb.crafts-Formen */
export const KNOB_SHAPES = [
  { id: 'groove', name: 'rb.crafts (gerillt)' },
  { id: 'facet', name: 'Facettiert' },
  { id: 'wave', name: 'Gewellt' },
];
export const HANDLE_SHAPES = [
  { id: 'facet', name: 'rb.crafts' },
  { id: 'round', name: 'La Marzocco' },
];

/** Cup Rail: Flachstahl-Rahmen (rb.crafts) oder Rundstab auf Pfosten */
export const RAIL_STYLES = [
  { id: 'flat', name: 'rb.crafts (Flachstahl)' },
  { id: 'rod', name: 'Rundstab' },
];

/** Lochbild von Tropfblech und Tassenablage */
export const TRAY_STYLES = [
  { id: 'slots', name: 'Original (Schlitze)' },
  { id: 'diamond', name: 'rb.crafts (Rauten)' },
];

/** Holz-Schriftzug (magnetisch): Slot-Wert 'wood:<Holz>' */
export const LOGO_WOODS = ['walnut', 'oak', 'olive'];

/** Platzhalter für Holzverkleidungen ohne Holz */
export const NO_WOOD = { id: 'none', name: 'Ohne Holz', none: true, light: '#d9d4cc', mid: '#c9c3ba', dark: '#b9b2a8' };

/** Manometer: Zifferblatt und Zeiger je Anzeige wählbar */
export const GAUGES = [
  { id: 'left', name: 'Brühdruck (links)', short: 'Brühdruck' },
  { id: 'right', name: 'Dampfdruck (rechts)', short: 'Dampfdruck' },
];
export const GAUGE_DIALS = [
  { id: 'white', name: 'Weiß' },
  { id: 'black', name: 'Schwarz' },
  { id: 'cream', name: 'Creme' },
  { id: 'naked', name: 'Naked (offenes Werk)' },
];
export const NEEDLES = [
  { id: 'red', name: 'Rot', color: '#c2231d' },
  { id: 'black', name: 'Schwarz', color: '#161616' },
  { id: 'white', name: 'Weiß', color: '#f1eee6' },
  { id: 'gold', name: 'Gold', color: '#d6ae58', metal: true },
];
export const needleById = (id) => NEEDLES.find((n) => n.id === id) || NEEDLES[0];
export const DEFAULT_GAUGE = { dial: 'white', needle: 'red' };

/** Schraubenköpfe: ab Werk Linsenkopf mit Schlitz */
export const SCREW_HEADS = [
  { id: 'slot', name: 'Schlitz' },
  { id: 'hex', name: 'Innensechskant' },
];

// ---------------------------------------------------------------------------
// Konfigurationen
// ---------------------------------------------------------------------------
const MAIN_WOOD = ['wood.paddle', 'wood.knobs', 'wood.handle'];
const allBody = (id, finish) =>
  Object.fromEntries(CATEGORIES.body.slots.map((s) => [s.key, { id, finish }]));
const allWood = (id, finish = 'oiled') => Object.fromEntries(MAIN_WOOD.map((k) => [k, { id, finish }]));
const allMetal = (id, finish = 'gloss') =>
  Object.fromEntries(CATEGORIES.metal.slots.map((s) => [s.key, { id, finish }]));

/** Neutrale Werte für optionale Teile (ohne Holzverkleidung, ohne Cup Rail) */
export const NEUTRAL_SLOTS = {
  'wood.panelUpper': { id: 'none', finish: 'oiled' },
  'wood.panelLower': { id: 'none', finish: 'oiled' },
  'metal.rail': { id: 'steel', finish: 'satin' },
  'metal.feet': { id: 'black', finish: 'matte' },
};
export const NEUTRAL_SHAPE = { knobs: 'wave', handle: 'round' };
export const NEUTRAL_OPTIONS = { railStyle: 'rod', tray: { drip: 'slots', cup: 'slots' } };

function preset(name, swatches, slots, extra = {}) {
  return {
    name,
    swatches,
    config: {
      slots: { ...NEUTRAL_SLOTS, ...slots },
      // Manometer: Zifferblatt + Zeiger je Anzeige (extra.dial/needle gilt für beide)
      gauges: {
        left: { dial: extra.dial || 'white', needle: extra.needle || 'red', ...(extra.gauges?.left || {}) },
        right: { dial: extra.dial || 'white', needle: extra.needle || 'red', ...(extra.gauges?.right || {}) },
      },
      screwHead: extra.screws || 'slot',
      rail: !!extra.rail,
      railStyle: extra.railStyle || 'flat',
      tray: { drip: extra.drip || 'slots', cup: extra.cup || 'slots' },
      shape: { knobs: extra.knobs || 'groove', handle: extra.handle || 'facet' },
    },
  };
}

// Editionen von rb.crafts (laut rb-crafts.de). Die IGP-/RAL-Zuordnung der Lackfarben ist ein
// Fotoabgleich und damit eine Schätzung – verbindlich ist der Farbcode von rb.crafts.
const WOODSET = (id) => ({ ...allWood(id), 'metal.logo': { id: `wood:${id}`, finish: 'oiled' } });
const BLACK_DETAILS = {
  ...allMetal('black', 'matte'),
  'metal.wand': { id: 'dlc', finish: 'matte' },
  'metal.group': { id: 'dlc', finish: 'matte' },
  'metal.portafilter': { id: 'dlc', finish: 'matte' },
  'metal.gauges': { id: 'dlc', finish: 'matte' },
};

export const PRESETS = [
  // "Custom Linea Mini R & Bentwood": ruhiges Grau, Walnuss, schwarze Details, Holzumrandung, schwarze Reling
  preset('Grau · Walnuss · Schwarz', ['#aea097', '#6e4b3a', '#161616'], {
    ...allBody('4201E77903L30', 'matte'),
    ...WOODSET('walnut'),
    'wood.panelUpper': { id: 'walnut', finish: 'oiled' },
    ...BLACK_DETAILS,
    'metal.grates': { id: 'body', finish: 'matte' },
    'metal.logo': { id: 'wood:walnut', finish: 'oiled' },
  }, { dial: 'naked', rail: true }),
  // "Special Brown mit Olive": warmer Braunton mit leichtem Goldschimmer, schwarze Akzente
  preset('Special Brown · Olive', ['#8c755d', '#dd9540', '#161616'], {
    ...allBody('4201E83829L30', 'texture'),
    ...WOODSET('olive'),
    ...BLACK_DETAILS,
    'metal.grates': { id: 'body', finish: 'texture' },
    'metal.logo': { id: 'wood:olive', finish: 'oiled' },
  }, { dial: 'naked' }),
  // "All Black": ultramatt schwarz, DLC, Walnuss mit Holzumrandung
  preset('All Black · Walnuss', ['#111113', '#6e4b3a', '#232427'], {
    ...allBody('RAL9005', 'matte'),
    ...WOODSET('walnut'),
    'wood.panelUpper': { id: 'walnut', finish: 'oiled' },
    ...BLACK_DETAILS,
    'metal.logo': { id: 'wood:walnut', finish: 'oiled' },
  }, { dial: 'naked', drip: 'diamond', cup: 'diamond' }),
  // Elfenbein mit Gold und Walnuss (Edition mit goldener Cup Rail)
  preset('Elfenbein · Gold · Walnuss', ['#e5d8bd', '#6e4b3a', '#e1b866'], {
    ...allBody('RAL1015', 'satin'),
    ...allWood('walnut'),
    'wood.panelLower': { id: 'walnut', finish: 'oiled' },
    ...allMetal('gold', 'gloss'),
    'metal.grates': { id: 'body', finish: 'satin' },
  }, { rail: true, railStyle: 'rod' }),
  // Elfenbein & Eiche mit schwarzen DLC-Teilen
  preset('Elfenbein · Eiche · DLC', ['#e5d8bd', '#d99c52', '#232427'], {
    ...allBody('RAL1015', 'satin'),
    ...WOODSET('oak'),
    ...BLACK_DETAILS,
    'metal.grates': { id: 'body', finish: 'satin' },
    'metal.logo': { id: 'wood:oak', finish: 'oiled' },
  }, { dial: 'naked', rail: true }),
  // Weiß mit Walnuss, Edelstahl bleibt sichtbar
  preset('Weiß · Walnuss', ['#f1f0ea', '#6e4b3a', '#cfd1d3'], {
    ...allBody('RAL9016', 'gloss'),
    ...allWood('walnut'),
    ...allMetal('steel', 'gloss'),
    'metal.feet': { id: 'black', finish: 'matte' },
  }, {}),
  // "Special Bronze mit Walnuss" (bei rb.crafts als Micra gezeigt)
  preset('Special Bronze · Walnuss', ['#8c7d64', '#6e4b3a', '#161616'], {
    ...allBody('4201E13212L3F', 'texture'),
    ...WOODSET('walnut'),
    'wood.panelUpper': { id: 'walnut', finish: 'oiled' },
    ...BLACK_DETAILS,
    'metal.grates': { id: 'body', finish: 'texture' },
    'metal.logo': { id: 'wood:walnut', finish: 'oiled' },
  }, { dial: 'naked', rail: true }),
  // Gelb mit Walnuss und gebürsteter Edelstahl-Reling (Foto zur Cup Rail)
  preset('Signalgelb · Walnuss', ['#e9a41c', '#6e4b3a', '#cfd1d3'], {
    ...allBody('RAL1003', 'satin'),
    ...allWood('walnut'),
    ...BLACK_DETAILS,
    'metal.rail': { id: 'steel', finish: 'satin' },
    'metal.grates': { id: 'body', finish: 'satin' },
  }, { rail: true }),
  // weitere Kombinationen mit IGP-Farben
  preset('Style 23 · Olive', ['#b4a998', '#dd9540', '#161616'], {
    ...allBody('4201E76256L3F', 'matte'),
    ...WOODSET('olive'),
    ...BLACK_DETAILS,
    'metal.portafilter': { id: 'steel', finish: 'satin' },
    'metal.grates': { id: 'steel', finish: 'satin' },
    'metal.logo': { id: 'wood:olive', finish: 'oiled' },
  }, { dial: 'black', needle: 'gold' }),
  preset('Jungle Street · Messing', ['#3b4136', '#6e4b3a', '#c9a85c'], {
    ...allBody('4201E63923L3F', 'matte'),
    ...allWood('walnut'),
    'wood.panelUpper': { id: 'walnut', finish: 'oiled' },
    ...allMetal('brass', 'satin'),
    'metal.grates': { id: 'steel', finish: 'satin' },
  }, { rail: true }),
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
  ...METAL_COLORS.uni.map((c) => [c.id, { ...c, kind: c.followsBody ? 'body' : 'uni' }]),
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
  if (METAL_INDEX.has(value.id)) return METAL_INDEX.get(value.id);
  // Holz-Schriftzug: 'wood:<Holz>'
  if (typeof value.id === 'string' && value.id.startsWith('wood:') && WOOD_INDEX.has(value.id.slice(5))) {
    const w = WOOD_INDEX.get(value.id.slice(5));
    return { id: value.id, name: `Holz ${w.name}`, color: w.mid, kind: 'wood', wood: w };
  }
  // Akzent in einem IGP- oder RAL-Pulverlack (z. B. Cup Rail in Gehäusefarbe-Variante)
  if (BODY_INDEX.has(value.id)) return { ...BODY_INDEX.get(value.id), kind: 'paint' };
  return METAL_INDEX.get('steel');
}
export function resolveWood(value) {
  if (value.id === 'none') return NO_WOOD;
  return WOOD_INDEX.get(value.id) || WOOD_INDEX.get('olive');
}
export const finishName = (list, id) => (list.find((f) => f.id === id) || list[0]).name;
