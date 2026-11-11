// ---------------------------------------------------------------------------
// Variationen: bis zu fünf Fassungen je Gerät (Maschine und Mühle getrennt),
// die sich beim Abschluss frei kombinieren und durchschalten lassen.
//
// Die gerade bearbeitete Konfiguration ist immer die aktive Variante; ihre
// Kopie in der Liste wird bei jeder Änderung nachgeführt.
// ---------------------------------------------------------------------------
import { MACHINE_SLOTS, GRINDER_SLOTS } from './data.js';

export const MAX_VARIANTS = 5;
export const VARIANT_PRODUCTS = ['machine', 'grinder'];
const MACHINE_KEYS = ['gauges', 'screwHead', 'rail', 'railStyle', 'tray', 'shape'];
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Gerätespezifischer Teil einer Konfiguration */
export function extractVariant(product, cfg) {
  if (product === 'grinder') {
    return { slots: Object.fromEntries(GRINDER_SLOTS.map((k) => [k, clone(cfg.slots[k])])), burrs: cfg.grinder.burrs };
  }
  const v = { slots: Object.fromEntries(MACHINE_SLOTS.map((k) => [k, clone(cfg.slots[k])])) };
  for (const k of MACHINE_KEYS) v[k] = clone(cfg[k]);
  return v;
}

/** Konfiguration mit eingesetzter Variante (Kopie) */
export function applyVariant(product, cfg, v) {
  const out = clone(cfg);
  Object.assign(out.slots, clone(v.slots || {}));
  if (product === 'grinder') out.grinder = { ...out.grinder, burrs: v.burrs || out.grinder.burrs };
  else for (const k of MACHINE_KEYS) if (v[k] !== undefined) out[k] = clone(v[k]);
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
