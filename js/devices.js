// ---------------------------------------------------------------------------
// Geräteliste: alle wählbaren Maschinen und Mühlen
//
// Jedes Gerät bringt mit: Maße (mm), Kontaktschatten und Kameraausschnitt,
// seine Slot-Schlüssel, Standardwerte und eine Funktion, die das 3D-Modell
// baut (erst bei Bedarf). Slots neuer Geräte sind mit "<id>:" vorangestellt,
// damit sie sich nicht mit denen anderer Geräte überschneiden.
// ---------------------------------------------------------------------------
import { MACHINE_SLOTS, GRINDER_SLOTS, CATEGORIES, GRINDER_CATEGORIES, PRESETS, GRINDER_PRESETS, DEVICE_KIND } from './data.js';
import { buildMachine } from './model.js';
import { buildGrinder } from './grinder.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

export const DEVICES = {
  lmr: {
    id: 'lmr',
    kind: 'machine',
    brand: 'La Marzocco',
    name: 'Linea Mini R',
    full: 'La Marzocco Linea Mini R',
    file: 'Linea-Mini-R',
    code: 'LMR',
    dims: { w: 357, d: 540, h: 378 },
    rootZ: 0.064,
    shadow: { w: 0.62, d: 0.72, z: -0.069 },
    frame: { target: [0, 0.185, 0], scale: 1 },
    slots: MACHINE_SLOTS,
    categories: CATEGORIES,
    presets: PRESETS,
    build: (mm) => buildMachine(mm),
    // Rollen für "Wie meine Maschine" (erstes Element = Hauptteil)
    roles: {
      body: ['body.upper', 'body.lower', 'body.base', 'body.head'],
      accent: ['metal.group', 'metal.caps', 'metal.portafilter', 'metal.wand', 'metal.gauges', 'metal.feet', 'metal.rail', 'metal.grates'],
      wood: ['wood.handle', 'wood.knobs', 'wood.paddle'],
      screws: ['metal.screws'],
      logo: ['metal.logo'],
    },
  },
  eg1: {
    id: 'eg1',
    kind: 'grinder',
    brand: 'Weber Workshops',
    name: 'EG-1',
    full: 'Weber Workshops EG-1',
    file: 'EG-1',
    code: 'EG1',
    dims: { w: 245, d: 235, h: 456 },
    rootZ: 0,
    shadow: { w: 0.4, d: 0.4, z: 0.004 },
    frame: { target: [0, 0.226, 0.012], scale: 1.08 },
    slots: GRINDER_SLOTS,
    categories: GRINDER_CATEGORIES,
    presets: GRINDER_PRESETS,
    build: (mm) => buildGrinder(mm),
    roles: {
      body: ['gbody.housing', 'gbody.stand', 'gbody.base'],
      accent: ['gmetal.rails', 'gmetal.cap', 'gmetal.dial', 'gmetal.funnel', 'gmetal.cup', 'gmetal.platform', 'gmetal.knob'],
      wood: ['gwood.platen'],
      screws: ['gmetal.screws'],
      logo: ['gmetal.logo'],
    },
  },
};

/** Neues Gerät aufnehmen (Gerätemodule rufen das beim Import auf) */
export function registerDevice(def) {
  DEVICES[def.id] = def;
  DEVICE_KIND[def.id] = def.kind;
}

export const STANDARD_DEVICE = { machine: 'lmr', grinder: 'eg1' };
export const deviceOf = (id) => DEVICES[id];
export const devicesOfKind = (kind) => Object.values(DEVICES).filter((d) => d.kind === kind);

/** Standard-Variante eines Geräts (erstes Preset) */
export function defaultVariantOf(id) {
  const d = DEVICES[id];
  const p = clone(d.presets[0].config);
  if (id === 'lmr') {
    const { slots, gauges, screwHead, rail, railStyle, tray, shape } = p;
    return { device: id, slots, gauges, screwHead, rail, railStyle, tray, shape };
  }
  if (id === 'eg1') return { device: id, slots: p.slots, burrs: p.grinder.burrs };
  return { device: id, slots: p.slots, opts: p.opts || {} };
}
