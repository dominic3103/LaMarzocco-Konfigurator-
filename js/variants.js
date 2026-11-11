// ---------------------------------------------------------------------------
// Variationen: bis zu fünf Fassungen je Gerät (Maschine und Mühle getrennt),
// die sich beim Abschluss frei kombinieren und durchschalten lassen.
//
// Die gerade bearbeitete Konfiguration ist immer die aktive Variante; ihre
// Kopie in der Liste wird bei jeder Änderung nachgeführt.
// ---------------------------------------------------------------------------
import { DEVICES, STANDARD_DEVICE } from './devices.js';

export const MAX_VARIANTS = 5;
export const VARIANT_PRODUCTS = ['machine', 'grinder'];
// Einstellungen der Linea Mini R liegen (aus älteren Versionen) direkt in der Konfiguration
export const LMR_KEYS = ['gauges', 'screwHead', 'rail', 'railStyle', 'tray', 'shape'];
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Gerätespezifischer Teil einer Konfiguration (mit Gerät) */
export function extractVariant(product, cfg) {
  const id = cfg.devices?.[product] || STANDARD_DEVICE[product];
  const v = { device: id, slots: Object.fromEntries(DEVICES[id].slots.map((k) => [k, clone(cfg.slots[k])])) };
  if (id === 'lmr') {
    for (const k of LMR_KEYS) v[k] = clone(cfg[k]);
  } else if (id === 'eg1') {
    v.burrs = cfg.grinder.burrs;
  } else {
    v.opts = clone(cfg.opts?.[id] || {});
  }
  return v;
}

/** Konfiguration mit eingesetzter Variante (Kopie); wechselt bei Bedarf das Gerät */
export function applyVariant(product, cfg, v) {
  const out = clone(cfg);
  out.devices = { ...STANDARD_DEVICE, ...(out.devices || {}) };
  const oldId = out.devices[product];
  const id = v.device && DEVICES[v.device] ? v.device : STANDARD_DEVICE[product];
  if (oldId !== id && DEVICES[oldId]) for (const k of DEVICES[oldId].slots) delete out.slots[k];
  out.devices[product] = id;
  Object.assign(out.slots, clone(v.slots || {}));
  if (id === 'lmr') {
    for (const k of LMR_KEYS) if (v[k] !== undefined) out[k] = clone(v[k]);
  } else if (id === 'eg1') {
    out.grinder = { ...out.grinder, burrs: v.burrs || out.grinder.burrs };
  } else {
    out.opts = { ...(out.opts || {}), [id]: clone(v.opts || {}) };
  }
  return out;
}

/**
 * Variationen prüfen (z. B. aus einem Link). Die übergebene, bereits geprüfte Konfiguration
 * ist die aktive Variante.
 * @param {(cfg: object) => object} sanitizeCore  Prüfung einer einzelnen Konfiguration
 */
export function sanitizeVariants(raw, cfg, sanitizeCore) {
  const out = {};
  for (const p of VARIANT_PRODUCTS) {
    const r = raw && typeof raw === 'object' ? raw[p] : null;
    const list = Array.from({ length: MAX_VARIANTS }, (_, i) => {
      const v = r?.list?.[i];
      if (!v || typeof v !== 'object' || !v.slots || typeof v.slots !== 'object') return null;
      return extractVariant(p, sanitizeCore(applyVariant(p, cfg, v)));
    });
    const active = Number.isInteger(r?.active) && r.active >= 0 && r.active < MAX_VARIANTS ? r.active : 0;
    list[active] = extractVariant(p, cfg);
    out[p] = { active, list };
  }
  return out;
}

/** Belegte Plätze einer Liste */
export const filledVariants = (V) => V.list.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);

/** Nächste belegte Variante (zyklisch), dir = +1 / -1 */
export function stepVariant(V, dir) {
  const filled = filledVariants(V);
  const pos = filled.indexOf(V.active);
  return filled[(pos + dir + filled.length) % filled.length];
}
