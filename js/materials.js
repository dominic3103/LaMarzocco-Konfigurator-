// ---------------------------------------------------------------------------
// Material-Verwaltung: ein Satz Materialien pro konfigurierbarem Slot.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { categoryOf, resolveBody, resolveMetal, resolveWood } from './data.js';
import { getFlakeNormalMap, getSparkleMaps, getStructureBumpMap, getWoodTextures } from './textures.js';

export class MaterialManager {
  constructor() {
    /** @type {Map<string, THREE.MeshPhysicalMaterial[]>} */
    this.slots = new Map();
    this.fixed = this.#createFixedMaterials();
    this.highlight = new Map();
  }

  /**
   * Liefert ein (neues) Material für einen Slot. Mehrere Meshes eines Slots
   * können eigene Materialien haben (z. B. unterschiedliche Gitter-Texturen),
   * werden aber immer gemeinsam umgefärbt.
   */
  get(slot, extra = {}) {
    const list = this.slots.get(slot) || [];
    if (!extra.map) {
      const plain = list.find((m) => !m.userData.baseMap);
      if (plain) return plain;
    }
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...extra });
    mat.userData.baseMap = extra.map || null;
    mat.userData.slot = slot;
    list.push(mat);
    this.slots.set(slot, list);
    return mat;
  }

  #createFixedMaterials() {
    return {
      rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85 }),
      blackPlastic: new THREE.MeshStandardMaterial({ color: 0x0f0f0f, roughness: 0.45 }),
      darkGap: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 }),
      gasket: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.03,
        metalness: 0,
        transparent: true,
        opacity: 0.18,
        clearcoat: 1,
        depthWrite: false,
      }),
      displayGlass: new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }),
      trayInner: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.7 }),
      steel: new THREE.MeshStandardMaterial({ color: 0xcfd1d3, metalness: 1, roughness: 0.34 }),
      // Rohbau (Montage-Animation)
      frame: new THREE.MeshStandardMaterial({ color: 0x8c9094, metalness: 0.75, roughness: 0.45 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xe4e6e9, metalness: 1, roughness: 0.12 }),
      copper: new THREE.MeshStandardMaterial({ color: 0xd08a63, metalness: 1, roughness: 0.28 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xd3b066, metalness: 1, roughness: 0.3 }),
      motor: new THREE.MeshStandardMaterial({ color: 0x2b2c2e, metalness: 0.3, roughness: 0.55 }),
      motorRib: new THREE.MeshStandardMaterial({ color: 0x55575a, metalness: 0.6, roughness: 0.4 }),
      pcb: new THREE.MeshStandardMaterial({ color: 0x1f6b3a, metalness: 0.1, roughness: 0.6 }),
      tank: new THREE.MeshPhysicalMaterial({ color: 0xcfe6f2, roughness: 0.08, transparent: true, opacity: 0.35, depthWrite: false }),
    };
  }

  /** Wendet eine komplette Konfiguration auf alle Materialien an. */
  apply(config) {
    for (const [slot, value] of Object.entries(config.slots)) this.applySlot(slot, value, config);
  }

  /** @param config komplette Konfiguration (für Akzente "Wie Gehäuse") */
  applySlot(slot, value, config) {
    const mats = this.slots.get(slot);
    if (!mats) return;
    const cat = categoryOf(slot);
    for (const m of mats) {
      if (cat === 'body') applyPaint(m, resolveBody(value), value.finish);
      else if (cat === 'wood') applyWood(m, resolveWood(value), value.finish);
      else {
        const metal = resolveMetal(value);
        if (metal.kind === 'paint') {
          applyPaint(m, metal, value.finish);
        } else if (metal.kind === 'body' && config) {
          // Akzent in Gehäusefarbe (wie Basis & Tropfschale)
          const base = config.slots['body.base'];
          applyPaint(m, resolveBody(base), base.finish);
        } else applyMetal(m, metal.kind === 'body' ? { ...metal, kind: 'uni' } : metal, value.finish);
      }
      m.userData.emissiveBase = m.emissive.getHex();
    }
  }

  /** Lässt die Materialien eines oder mehrerer Slots kurz aufleuchten. */
  setHighlight(slotKeys, amount) {
    const keys = Array.isArray(slotKeys) ? slotKeys : [slotKeys];
    for (const k of keys) {
      for (const m of this.slots.get(k) || []) {
        m.emissive.setRGB(0.42 * amount, 0.36 * amount, 0.26 * amount);
      }
    }
  }

  clearHighlight() {
    for (const mats of this.slots.values()) for (const m of mats) m.emissive.setHex(0x000000);
  }
}

function setMaps(m, maps) {
  let changed = false;
  for (const [k, v] of Object.entries(maps)) {
    if (m[k] !== v) {
      if (!!m[k] !== !!v) changed = true;
      m[k] = v;
    }
  }
  if (changed) m.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Lack (Gehäuse)
// ---------------------------------------------------------------------------
// Effekt-Typen: A = Uni, E = Effektfarbton (feiner metallischer Schimmer),
// U = IGP-Effectives®/Perleffekt (grobe Glitzerpartikel), M = Metallic (eigene Farbe)
const EFFECT = {
  A: { metal: 0, rough: { matte: 0.82, satin: 0.5, gloss: 0.28, texture: 0.78 } },
  E: { metal: 0.38, rough: { matte: 0.6, satin: 0.45, gloss: 0.32, texture: 0.6 } },
  U: { metal: 0.3, rough: { matte: 0.56, satin: 0.42, gloss: 0.3, texture: 0.56 } },
  M: { metal: 0.72, rough: { matte: 0.58, satin: 0.42, gloss: 0.32, texture: 0.55 } },
};
const CLEARCOAT = {
  matte: { cc: 0, ccr: 0.5 },
  satin: { cc: 0.35, ccr: 0.32 },
  gloss: { cc: 1, ccr: 0.03 },
  texture: { cc: 0, ccr: 0.6 },
};

function applyPaint(m, color, finish) {
  const fx = color.effect || (color.kind === 'metallic' ? 'M' : 'A');
  const e = EFFECT[fx] || EFFECT.A;
  const f = CLEARCOAT[finish] ? finish : 'matte';
  m.color.set(color.color);
  m.sheen = 0;
  // helle Effektlacke (Perlweiß, Silber) wirken sonst zu grau
  const lum = m.color.r * 0.2126 + m.color.g * 0.7152 + m.color.b * 0.0722;
  m.metalness = fx === 'E' || fx === 'U' ? e.metal * (1 - 0.6 * Math.min(1, Math.max(0, (lum - 0.45) / 0.35))) : e.metal;
  m.roughness = e.rough[f];
  m.clearcoat = CLEARCOAT[f].cc;
  m.clearcoatRoughness = CLEARCOAT[f].ccr;
  m.envMapIntensity = 1;
  const sparkle = fx === 'U' || color.sparkle;
  const structure = f === 'texture' ? getStructureBumpMap() : null;
  let normalMap = null;
  let map = m.userData.baseMap || null;
  if (sparkle) {
    const sp = getSparkleMaps();
    normalMap = structure ? null : sp.normalMap;
    map = sp.map;
    m.normalScale.set(0.55, 0.55);
  } else if ((fx === 'E' || fx === 'M') && !structure) {
    normalMap = getFlakeNormalMap();
    m.normalScale.set(fx === 'E' ? 0.12 : 0.22, fx === 'E' ? 0.12 : 0.22);
  }
  setMaps(m, { normalMap, bumpMap: structure, map });
  m.bumpScale = 1.6;
}

// ---------------------------------------------------------------------------
// Holz
// ---------------------------------------------------------------------------
function applyWood(m, wood, finish) {
  const lacquer = finish === 'lacquer';
  if (wood.none) return; // Teil wird ausgeblendet
  if (wood.plastic) {
    setMaps(m, { map: null, bumpMap: null, normalMap: null });
    m.color.set(wood.mid);
    m.metalness = 0;
    m.roughness = lacquer ? 0.25 : 0.5;
    m.clearcoat = lacquer ? 0.8 : 0.1;
    m.clearcoatRoughness = 0.15;
    return;
  }
  const tex = getWoodTextures(wood);
  setMaps(m, { map: tex.map, bumpMap: tex.bumpMap, normalMap: null });
  m.color.set(0xffffff);
  m.metalness = 0;
  m.roughness = lacquer ? 0.38 : 0.62;
  m.clearcoat = lacquer ? 1 : 0.12;
  m.clearcoatRoughness = lacquer ? 0.04 : 0.45;
  m.bumpScale = lacquer ? 0.6 : 1.4;
}

// ---------------------------------------------------------------------------
// Metall / Akzentlack
// ---------------------------------------------------------------------------
function applyMetal(m, color, finish) {
  m.color.set(color.color);
  setMaps(m, { normalMap: null, bumpMap: null, map: m.userData.baseMap || null });
  if (color.kind === 'metal') {
    m.metalness = 1;
    m.roughness = { gloss: 0.1, satin: 0.3, matte: 0.48 }[finish] ?? 0.1;
    m.clearcoat = 0;
  } else {
    m.metalness = 0;
    m.roughness = { gloss: 0.22, satin: 0.45, matte: 0.72 }[finish] ?? 0.45;
    m.clearcoat = finish === 'gloss' ? 1 : 0;
    m.clearcoatRoughness = 0.05;
  }
}
