// ---------------------------------------------------------------------------
// Prozedurale Holztexturen
//
// Die Maserung wird so aufgebaut, wie Holz tatsächlich entsteht:
//   - Jahresringe: helles Frühholz, zum Ringende dichteres dunkles Spätholz,
//     scharfe Ringgrenze; jeder Ring etwas anders breit und dunkel
//   - Fladerung ("Kathedralen"), wo das Brett die Ringe flach anschneidet
//   - feine Fasern längs, Poren (Gefäße) als kurze dunkle Striche
//   - Kernholzstreifen und leichte Tonwechsel
// Ergebnis je Holzart: Farbkarte, Reliefkarte (Normal-Map) und Glanzkarte.
//
// Eine Kachel entspricht 160 mm quer (U) × 400 mm längs (V) zur Faser und ist
// in beide Richtungen nahtlos wiederholbar.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { createNoise, cellDist, clamp01, smoothstep, hexToRgb, makeCanvas } from './noise.js';

/** Physikalische Größe einer Kachel in mm (quer, längs) */
export const WOOD_TILE = { u: 160, v: 400 };

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Berechnet Farbe (RGBA), Höhe und Rauheit für eine Holzart.
 * @returns {{color: Uint8ClampedArray, height: Float32Array, rough: Float32Array, size: number}}
 */
export function generateWood(def, size = 1024) {
  const W = size;
  const H = size;
  const seed = def.seed || 7;
  const N = createNoise(seed);
  const N2 = createNoise(seed * 7 + 3);
  const color = new Uint8ClampedArray(W * H * 4);
  const height = new Float32Array(W * H);
  const rough = new Float32Array(W * H);
  const L = hexToRgb(def.light);
  const M = hexToRgb(def.mid);
  const D = hexToRgb(def.dark);
  const S = def.streak ? hexToRgb(def.streak.color) : null;

  const K = def.rings || 24;
  const contrast = def.contrast ?? 0.5;
  const late = def.late ?? 0.35;
  const warp = def.warp ?? 0.03;
  const figure = def.figure ?? 2;
  const fiber = def.fiber ?? 0.5;
  const pore = def.pore || null;
  const tone = def.tone ?? 0.12;
  const style = def.style || 'ring';
  const fine = W >= 512; // feinste Details nur bei hoher Auflösung (sonst Flimmern)

  const hash = (i, k) => {
    let h = Math.imul((i | 0) * 374761393 + k * 668265263 + seed * 362437, 0x9e3779b1);
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967295;
  };
  const mod = (i, n) => ((i % n) + n) % n;
  // Fladerung: zwei "Hügel" im Ringverlauf, deren Höhe sich längs ändert
  const u0 = 0.28 + 0.2 * hash(1, 11);
  const u1 = (u0 + 0.5) % 1;
  const ph0 = hash(2, 11) * TAU;
  const ph1 = hash(3, 11) * TAU;
  const wrapD = (a) => a - Math.round(a);

  for (let y = 0; y < H; y++) {
    const v = y / H;
    const g0 = 0.5 + 0.5 * Math.sin(TAU * v + ph0);
    const g1 = 0.5 + 0.5 * Math.sin(TAU * v + ph1);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const idx = y * W + x;
      // sanftes Schlingern der Faser
      const w1 = N.fbm(u, v, 2, 1, 3);
      const w2 = N.fbm(u, v, 5, 2, 2);
      const uu = u + warp * w1 + warp * 0.35 * w2;
      // feine Fasern (stark längs gestreckt)
      let fib = N.noise(u * 128, v * 6, 128, 6) * 0.55;
      if (fine) fib += N2.noise(u * 256, v * 14, 256, 14) * 0.45;
      const lowTone = N2.fbm(u, v, 2, 1, 3);

      let T = 0; // 0 = hell, 1 = dunkel
      let dens = 0; // Spätholz-Anteil (für Glanz/Relief)
      let dark = 0; // zusätzliche dunkle Zeichnung (Adern, Streifen)
      let poreGate = 1;

      if (style === 'ring' || style === 'olive') {
        const d0 = wrapD(u - u0) / 0.13;
        const d1 = wrapD(u - u1) / 0.17;
        const hill = Math.exp(-d0 * d0) * g0 - 0.7 * Math.exp(-d1 * d1) * g1;
        // unregelmäßige Ringbreiten: breite und enge Jahrgänge wechseln sich ab
        const rc = K * uu + figure * hill + 1.5 * N.fbm(u, v, 3, 1, 2) + 0.9 * Math.sin(TAU * (2 * u + ph0));
        const ri = Math.floor(rc);
        const t = rc - ri;
        const rk = mod(ri, K);
        const lw = late * (0.7 + 0.6 * hash(rk, 1));
        const amp = 0.65 + 0.35 * hash(rk, 2);
        // Dichteverlauf im Ring: langsam ansteigend, am Ringende scharf abfallend
        dens = smoothstep(1 - lw * 1.3, 0.97, t) * (1 - smoothstep(0.985, 1, t)) + 0.04 * t;
        dens *= amp;
        T = 0.16 + contrast * dens;
        poreGate = pore && pore.ring ? 1 - smoothstep(0.1, 0.1 + pore.ring, t) : 1;
      }

      if (style === 'olive') {
        // dunkle, fließende Adern entlang der Ringe – mal kräftig, mal auslaufend
        const big = N2.fbm(u, v, 2, 2, 3);
        const med = N.fbm(u, v, 5, 4, 2);
        const uo = u + 0.15 * big + 0.045 * med;
        const strength = smoothstep(-0.3, 0.3, N.fbm(u, v, 3, 2, 3));
        // kräftige Adern mit wechselnder Breite
        const r1 = 11 * uo + 0.9 * N.fbm(u, v, 3, 2, 2);
        const a1 = Math.abs(r1 - Math.floor(r1) - 0.5);
        const wd1 = 0.04 + 0.16 * smoothstep(-0.2, 0.6, N2.noise(u * 5, v * 4, 5, 4));
        const vein1 = 1 - smoothstep(wd1 * 0.25, wd1, a1);
        // feine Begleitlinien
        const r2 = 29 * uo + 1.1 * N2.fbm(u, v, 4, 2, 2);
        const a2 = Math.abs(r2 - Math.floor(r2) - 0.5);
        const vein2 = 1 - smoothstep(0.03, 0.12, a2);
        // wolkige, honigbraune Zonen
        const cloud = smoothstep(-0.1, 0.5, N.fbm(u + 0.3, v, 3, 2, 3));
        dark = clamp01(vein1 * (0.25 + 0.75 * strength) + vein2 * 0.38 * strength + cloud * 0.12);
        T += cloud * 0.4;
      } else if (style === 'zebra') {
        const bc = K * uu + 0.55 * N.fbm(u, v, 4, 1, 2);
        const bi = Math.floor(bc);
        const t = bc - bi;
        const bk = mod(bi, K);
        const wdt = (def.stripe ?? 0.4) * (0.6 + 0.8 * hash(bk, 1));
        const edge = 0.07;
        const stripe = smoothstep(1 - wdt - edge, 1 - wdt + edge, t) * (1 - smoothstep(1 - edge, 1, t));
        dark = stripe * (0.6 + 0.4 * hash(bk, 2));
        // feine Zwischenringe
        const fr = K * 4 * uu + N2.fbm(u, v, 6, 1, 2);
        dens = smoothstep(0.55, 0.95, fr - Math.floor(fr));
        T = 0.14 + 0.16 * dens;
      } else if (style === 'burl') {
        // Wurzelmaser: verwirbelte Ringe und gruppierte "Augen"
        const qx = N.fbm(u, v, 4, 4, 3);
        const qy = N2.fbm(u, v, 5, 5, 3);
        const r = N.fbm(u + 0.2 * qx, v + 0.2 * qy, 6, 6, 4);
        const sw = 0.5 + 0.5 * Math.sin(TAU * r * 6);
        const cluster = smoothstep(-0.1, 0.3, N2.fbm(u, v, 3, 3, 2));
        const dc = cellDist(u * 26, v * 26, 26, seed);
        const eye = (1 - smoothstep(0.06, 0.15, dc)) * cluster;
        const ringE = (0.5 + 0.5 * Math.sin(dc * 42)) * (1 - smoothstep(0.15, 0.42, dc)) * cluster;
        dens = sw * sw;
        T = 0.24 + 0.3 * dens + 0.18 * ringE;
        dark = eye * 0.85;
        fib *= 0.4;
      } else if (style === 'solid') {
        T = 0.5;
        fib *= 0.2;
      }

      // Poren: kurze dunkle Striche längs der Faser
      let pm = 0;
      if (pore && fine) {
        const gx = u * pore.nx;
        // jede Spalte zufällig längs versetzt, damit keine Reihen entstehen
        const gy = v * pore.ny + hash(mod(Math.floor(gx), pore.nx), 9) * 7.31;
        const cx = Math.floor(gx);
        const cy = Math.floor(gy);
        const kx = mod(cx, pore.nx);
        const ky = mod(cy, pore.ny);
        if (hash(kx * 131 + ky, 5) < pore.density * poreGate) {
          const sz = 0.6 + 0.8 * hash(kx * 131 + ky, 8);
          const dx = (gx - cx - (0.3 + 0.4 * hash(kx * 131 + ky, 6))) / ((pore.w || 0.28) * sz);
          const dy = (gy - cy - (0.3 + 0.4 * hash(kx * 131 + ky, 7))) / (0.34 * sz);
          const m = 1 - dx * dx - dy * dy;
          if (m > 0) pm = m;
        }
      }

      T += fiber * 0.09 * fib + tone * lowTone;
      T = clamp01(T);
      let r;
      let g;
      let b;
      if (T < 0.5) {
        const k = T * 2;
        r = lerp(L[0], M[0], k);
        g = lerp(L[1], M[1], k);
        b = lerp(L[2], M[2], k);
      } else {
        const k = (T - 0.5) * 2;
        r = lerp(M[0], D[0], k);
        g = lerp(M[1], D[1], k);
        b = lerp(M[2], D[2], k);
      }
      // Kernholzstreifen / Adern in eigener Farbe
      if (S) {
        let sm = dark;
        if (def.streak.amt) sm = Math.max(sm, smoothstep(0.05, 0.5, N2.fbm(u + 0.17, v, def.streak.fx || 3, 1, 3)) * def.streak.amt);
        r = lerp(r, S[0], sm);
        g = lerp(g, S[1], sm);
        b = lerp(b, S[2], sm);
      }
      // feine Farbschwankung der Fasern + Poren
      const fv = 1 + fiber * 0.05 * fib;
      const pd = 1 - (pore ? pore.dark : 0) * pm;
      const o = idx * 4;
      color[o] = r * fv * pd;
      color[o + 1] = g * fv * pd;
      color[o + 2] = b * fv * pd;
      color[o + 3] = 255;
      height[idx] = -0.4 * pm + 0.22 * fiber * fib - 0.12 * dens - 0.25 * dark;
      rough[idx] = clamp01(0.6 + 0.28 * pm - 0.1 * dens - 0.06 * dark + 0.05 * fib);
    }
  }
  return { color, height, rough, size };
}

/** Höhenfeld -> Normal-Map (tangential, OpenGL-Konvention; Kachel nahtlos) */
function heightToNormal(height, size, strength) {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    const yu = ((y - 1 + size) % size) * size;
    const yd = ((y + 1) % size) * size;
    for (let x = 0; x < size; x++) {
      const xl = (x - 1 + size) % size;
      const xr = (x + 1) % size;
      const nx = (height[y * size + xl] - height[y * size + xr]) * strength;
      // Canvas-Zeile +1 liegt in der Textur weiter unten (kleineres V)
      const ny = (height[yd + x] - height[yu + x]) * strength;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const o = (y * size + x) * 4;
      out[o] = (nx * inv * 0.5 + 0.5) * 255;
      out[o + 1] = (ny * inv * 0.5 + 0.5) * 255;
      out[o + 2] = (inv * 0.5 + 0.5) * 255;
      out[o + 3] = 255;
    }
  }
  return out;
}

function toCanvas(data, size) {
  const c = makeCanvas(size, size);
  c.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0);
  return c;
}

const cache = new Map();

/**
 * Die Tonwertkurve des Renderers (Khronos Neutral) zieht vom dunkelsten Farbkanal bis zu 0.04 ab –
 * als Ausgleich für den Glanzschleier, den echte Oberflächen haben. Mattes, dunkles Holz hat im
 * Modell kaum Schleier und würde dadurch übersättigt (Walnuss wird orange). Deshalb wird der Abzug
 * hier vorab auf die Farbe gelegt: Bei mittlerer Beleuchtung erscheint das Holz im Bild so wie in
 * der Palette festgelegt. Gilt nur für die 3D-Textur, nicht für die Vorschau-Kacheln.
 */
const TONE_LIGHT = 0.8; // typische Beleuchtungsstärke × Belichtung auf einer Holzfläche
function compensateToneCurve(color, undo = false) {
  const toLin = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    toLin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  const toSrgb = (l) => 255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);
  for (let o = 0; o < color.length; o += 4) {
    const r = toLin[color[o]];
    const g = toLin[color[o + 1]];
    const b = toLin[color[o + 2]];
    let add;
    if (undo) {
      // Umkehrung: aus dem korrigierten dunkelsten Kanal den ursprünglichen berechnen
      const cm = Math.min(r, g, b);
      const x = cm >= 0.08 / TONE_LIGHT ? cm - 0.04 / TONE_LIGHT : 6.25 * TONE_LIGHT * cm * cm;
      add = x - cm;
    } else {
      // gewünschter Ausgabewert des dunkelsten Kanals -> nötiger Wert vor der Tonwertkurve
      const m = Math.min(r, g, b) * TONE_LIGHT;
      add = (m < 0.04 ? Math.sqrt(m / 6.25) - m : 0.04) / TONE_LIGHT;
    }
    color[o] = toSrgb(Math.max(0, r + add));
    color[o + 1] = toSrgb(Math.max(0, g + add));
    color[o + 2] = toSrgb(Math.max(0, b + add));
  }
}

/** Holztexturen (Farbe, Relief, Glanz) für eine Holzart, gecacht. */
export function getWoodTextures(def) {
  if (cache.has(def.id)) return cache.get(def.id);
  const size = 1024;
  const w = generateWood(def, size);
  compensateToneCurve(w.color);
  const map = new THREE.CanvasTexture(toCanvas(w.color, size));
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(toCanvas(heightToNormal(w.height, size, 1.6), size));
  // Rauheit im Grün-Kanal (Three.js-Konvention)
  const rg = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = w.rough[i] * 255;
    rg[i * 4] = v;
    rg[i * 4 + 1] = v;
    rg[i * 4 + 2] = 0;
    rg[i * 4 + 3] = 255;
  }
  const roughnessMap = new THREE.CanvasTexture(toCanvas(rg, size));
  for (const t of [map, normalMap, roughnessMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  const entry = { map, normalMap, roughnessMap };
  cache.set(def.id, entry);
  compensated.add(map.source);
  return entry;
}

// Bildquellen der korrigierten Holzfarben (Kopien einer Textur teilen sich die Quelle)
const compensated = new WeakSet();
const plainCanvases = new WeakMap();

/**
 * Holzfarbe ohne den Ausgleich der Tonwertkurve – für den Export in andere Renderer (AR),
 * die die Farbe unverändert darstellen. Liefert ein Canvas oder null, wenn die Textur kein Holz ist.
 */
export function plainWoodCanvas(texture) {
  const source = texture && texture.source;
  if (!source || !compensated.has(source)) return null;
  if (plainCanvases.has(source)) return plainCanvases.get(source);
  const src = source.data;
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  compensateToneCurve(img.data, true);
  ctx.putImageData(img, 0, 0);
  plainCanvases.set(source, c);
  return c;
}

/** Kleine Vorschau-Kachel (Data-URL) für die Holz-Auswahl: Ausschnitt ca. 80 × 100 mm. */
export function woodPreviewURL(def, size = 128) {
  const full = 256;
  const w = generateWood(def, full);
  const src = toCanvas(w.color, full);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  // Faser senkrecht, Ausschnitt quer 50 %, längs 25 % der Kachel
  ctx.drawImage(src, 0, 0, full * 0.5, full * 0.25, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.9);
}
