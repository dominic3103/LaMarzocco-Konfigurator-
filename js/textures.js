// ---------------------------------------------------------------------------
// Prozedurale Texturen: Holzmaserung, Lack-Effekte, Gitter, Manometer, Schriftzug
// Alle Texturen werden zur Laufzeit per Canvas erzeugt – keine Bilddateien nötig.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

// ---------- kachelbares Gradient-Noise (periodisch, damit Texturen nahtlos sind) ----------
function createNoise(seed = 1) {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed * 9301 + 49297;
  for (let i = 255; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256);
  const gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = (i / 256) * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

  /** Gradient-Noise mit Periode px/py (Ganzzahlen ≤ 256). Ergebnis ca. [-1, 1]. */
  function noise(x, y, px, py) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const x0 = ((xi % px) + px) % px;
    const y0 = ((yi % py) + py) % py;
    const x1 = (x0 + 1) % px;
    const y1 = (y0 + 1) % py;
    const h00 = perm[perm[x0] + y0];
    const h10 = perm[perm[x1] + y0];
    const h01 = perm[perm[x0] + y1];
    const h11 = perm[perm[x1] + y1];
    const n00 = gx[h00] * xf + gy[h00] * yf;
    const n10 = gx[h10] * (xf - 1) + gy[h10] * yf;
    const n01 = gx[h01] * xf + gy[h01] * (yf - 1);
    const n11 = gx[h11] * (xf - 1) + gy[h11] * (yf - 1);
    const u = fade(xf);
    const v = fade(yf);
    const a = n00 + (n10 - n00) * u;
    const b = n01 + (n11 - n01) * u;
    return (a + (b - a) * v) * 1.4;
  }
  /** Fraktales Noise; (u,v) in [0,1), fx/fy = Grundfrequenz (ganzzahlig). */
  function fbm(u, v, fx, fy, oct = 4) {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    let f = 1;
    for (let i = 0; i < oct; i++) {
      sum += amp * noise(u * fx * f, v * fy * f, fx * f, fy * f);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  }
  return { noise, fbm };
}

/** Abstand zum nächsten Zellpunkt (periodisches Worley-Noise), Zellgröße = 1. */
function cellDist(x, y, period, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let best = 9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i;
      const cy = yi + j;
      const px = ((cx % period) + period) % period;
      const py = ((cy % period) + period) % period;
      let h = Math.imul(px * 73856093 + py * 19349663 + seed * 83492791, 0x9e3779b1);
      h ^= h >>> 15;
      const rx = ((h & 0xffff) / 0xffff) * 0.8 + 0.1;
      const ry = (((h >>> 16) & 0xffff) / 0xffff) * 0.8 + 0.1;
      const dx = cx + rx - x;
      const dy = cy + ry - y;
      const dd = dx * dx + dy * dy;
      if (dd < best) best = dd;
    }
  }
  return Math.sqrt(best);
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ---------------------------------------------------------------------------
// Holz
// ---------------------------------------------------------------------------

/**
 * Berechnet die Maserung. Gibt Canvas für Farbe und Relief (bump) zurück.
 * Die Maserung läuft entlang der V-Achse (Längsrichtung der Teile).
 */
export function generateWoodCanvases(def, size = 512) {
  const W = size;
  const H = size;
  const color = makeCanvas(W, H);
  const bump = makeCanvas(W, H);
  const cctx = color.getContext('2d');
  const bctx = bump.getContext('2d');
  const cimg = cctx.createImageData(W, H);
  const bimg = bctx.createImageData(W, H);
  const cd = cimg.data;
  const bd = bimg.data;
  const N = createNoise(def.seed || 7);
  const L = hexToRgb(def.light);
  const M = hexToRgb(def.mid);
  const D = hexToRgb(def.dark);
  const TAU = Math.PI * 2;
  const freq = def.freq || 12;
  const warp = def.warp ?? 0.08;
  const contrast = def.contrast ?? 0.5;
  const sharp = def.sharp ?? 2.5;
  const pores = def.pores ?? 0.5;

  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      let t = 0; // 0 = hell, 1 = dunkel
      let relief = 0;

      switch (def.style) {
        case 'olive': {
          // cremiger Grund, fließende dunkle Adern in Gruppen, feine Nadelstreifen
          const w1 = N.fbm(u, v, 2, 2, 4);
          const w2 = N.fbm(u, v, 8, 4, 2);
          const xx = u + 0.13 * w1 + 0.025 * w2;
          const phase = xx * 6 + 0.9 * N.fbm(u, v, 3, 1, 2);
          const ring = 0.5 + 0.5 * Math.sin(TAU * phase);
          const mask = smoothstep(-0.15, 0.35, N.fbm(u, v, 2, 2, 3));
          const vein = smoothstep(0.82, 0.99, ring) * (0.35 + 0.75 * mask);
          const pin = Math.pow(0.5 + 0.5 * Math.sin(TAU * (xx * 23 + 0.6 * w2)), 28) * 0.28;
          const zone = (0.5 + 0.5 * N.fbm(u, v, 2, 1, 3)) * 0.26;
          const fine = N.noise(u * 128, v * 8, 128, 8) * 0.04;
          t = 0.05 + zone + vein * 0.95 + pin * (0.4 + mask) + fine;
          relief = vein * 0.7 + pin * 0.3;
          break;
        }
        case 'burl': {
          // Wurzelmaser: feine Wirbel + gruppierte "Augen" (zelluläres Noise)
          const qx = N.fbm(u, v, 4, 4, 3);
          const qy = N.fbm(u, v, 5, 5, 3);
          const r = N.fbm(u + 0.22 * qx, v + 0.22 * qy, 6, 6, 4);
          const swirl = 0.5 + 0.5 * Math.sin(TAU * r * 5);
          const cluster = smoothstep(-0.1, 0.3, N.fbm(u, v, 3, 3, 2));
          const d = cellDist(u * 30, v * 30, 30, def.seed || 1);
          const eyes = (1 - smoothstep(0.07, 0.15, d)) * cluster;
          const halo = (1 - smoothstep(0.15, 0.32, d)) * smoothstep(0.1, 0.17, d) * cluster;
          const tone = N.fbm(u, v, 2, 2, 3) * 0.3;
          const fine = N.noise(u * 96, v * 96, 96, 96) * 0.05;
          t = 0.28 + Math.pow(swirl, 2) * 0.26 + eyes * 0.7 - halo * 0.12 + tone + fine;
          relief = swirl * 0.25 + eyes * 0.6;
          break;
        }
        case 'zebra': {
          const w1 = N.fbm(u, v, 3, 1, 3);
          const w2 = N.fbm(u, v, 10, 2, 2);
          const xx = u + w1 * warp + w2 * warp * 0.3;
          const phase = xx * freq + 0.85 * N.fbm(u, v, Math.round(freq / 2), 1, 2);
          const ring = 0.5 + 0.5 * Math.sin(TAU * phase);
          const band = smoothstep(0.38, 0.66, ring);
          const fine = Math.pow(0.5 + 0.5 * Math.sin(TAU * (xx * freq * 5 + w2)), 6);
          const tone = N.fbm(u, v, 2, 2, 2) * 0.14;
          t = 0.08 + band * contrast * 0.82 + fine * 0.1 * band + tone;
          relief = band * 0.5;
          break;
        }
        case 'solid': {
          t = 0.5 + N.noise(u * 64, v * 64, 64, 64) * 0.04;
          relief = 0.5;
          break;
        }
        default: {
          // straight / oak: unregelmäßige Jahresringe, Poren, Ton-Variation
          const w1 = N.fbm(u, v, 3, 1, 3);
          const w2 = N.fbm(u, v, 12, 2, 2);
          const xx = u + w1 * warp + w2 * warp * 0.25;
          const phase = xx * freq + 0.7 * N.fbm(u, v, Math.max(2, Math.round(freq / 2)), 1, 2);
          const ring = 0.5 + 0.5 * Math.sin(TAU * phase);
          const band = Math.pow(ring, sharp);
          const tone = N.fbm(u, v, 3, 1, 3) * 0.28;
          const fine = N.noise(u * 160, v * 6, 160, 6) * 0.07;
          t = 0.18 + band * contrast + tone + fine;
          const pn = N.noise(u * 256, v * 20, 256, 20);
          if (pn > 0.35) t += (pn - 0.35) * 0.3 * pores;
          relief = band * 0.5 + Math.max(0, pn - 0.35) * 0.6;
          if (def.style === 'oak') {
            const ray = N.noise(u * 40, v * 90, 40, 90);
            if (ray > 0.45) t -= (ray - 0.45) * 0.45;
          }
        }
      }

      t = clamp01(t);
      let r;
      let g;
      let b;
      if (t < 0.5) {
        const k = t * 2;
        r = L[0] + (M[0] - L[0]) * k;
        g = L[1] + (M[1] - L[1]) * k;
        b = L[2] + (M[2] - L[2]) * k;
      } else {
        const k = (t - 0.5) * 2;
        r = M[0] + (D[0] - M[0]) * k;
        g = M[1] + (D[1] - M[1]) * k;
        b = M[2] + (D[2] - M[2]) * k;
      }
      const i = (y * W + x) * 4;
      cd[i] = r;
      cd[i + 1] = g;
      cd[i + 2] = b;
      cd[i + 3] = 255;
      const bv = 255 * (1 - clamp01(relief));
      bd[i] = bv;
      bd[i + 1] = bv;
      bd[i + 2] = bv;
      bd[i + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  bctx.putImageData(bimg, 0, 0);
  return { color, bump };
}

const woodCache = new Map();

/** Holztexturen (Farbe + Relief) für eine Holzart, gecacht. */
export function getWoodTextures(def) {
  if (woodCache.has(def.id)) return woodCache.get(def.id);
  const { color, bump } = generateWoodCanvases(def, 512);
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  const entry = { map, bumpMap };
  woodCache.set(def.id, entry);
  return entry;
}

/** Kleine Vorschau-Kachel (Data-URL) für die Holz-Auswahl. */
export function woodPreviewURL(def, size = 112) {
  const { color } = generateWoodCanvases(def, size);
  return color.toDataURL('image/jpeg', 0.9);
}

// ---------------------------------------------------------------------------
// Lack-Effekte
// ---------------------------------------------------------------------------
let flakeTex = null;
/** Normal-Map mit feinen Metallic-Flakes (Glitzern unter dem Klarlack). */
export function getFlakeNormalMap() {
  if (flakeTex) return flakeTex;
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  let seed = 1234567;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < S * S; i++) {
    const nx = (rnd() - 0.5) * 0.9;
    const ny = (rnd() - 0.5) * 0.9;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    img.data[i * 4] = (nx * 0.5 + 0.5) * 255;
    img.data[i * 4 + 1] = (ny * 0.5 + 0.5) * 255;
    img.data[i * 4 + 2] = (nz * 0.5 + 0.5) * 255;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  flakeTex = new THREE.CanvasTexture(c);
  flakeTex.wrapS = flakeTex.wrapT = THREE.RepeatWrapping;
  flakeTex.repeat.set(4, 4);
  return flakeTex;
}

let structureTex = null;
/** Relief für Struktur-Pulverbeschichtung. */
export function getStructureBumpMap() {
  if (structureTex) return structureTex;
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const N = createNoise(99);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const n = N.fbm(u, v, 48, 48, 3) * 0.7 + N.noise(u * 128, v * 128, 128, 128) * 0.3;
      const val = clamp01(0.5 + n * 0.8) * 255;
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  structureTex = new THREE.CanvasTexture(c);
  structureTex.wrapS = structureTex.wrapT = THREE.RepeatWrapping;
  structureTex.repeat.set(1.5, 1.5);
  return structureTex;
}

// ---------------------------------------------------------------------------
// Gitter (Tassenablage oben + Tropfschale)
// ---------------------------------------------------------------------------
function finishTexture(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Tassenablage: zwei geschlitzte Felder links/rechts, glatter Mittelsteg. */
export function makeCupTrayTexture(widthMM, depthMM) {
  const pxPerMM = 4;
  const W = Math.round(widthMM * pxPerMM);
  const H = Math.round(depthMM * pxPerMM);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  // feiner Schliff
  ctx.globalAlpha = 0.06;
  for (let x = 0; x < W; x += 2) {
    ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
    ctx.fillRect(x, 0, 1, H);
  }
  ctx.globalAlpha = 1;
  const margin = 14 * pxPerMM;
  const fieldW = widthMM * 0.33 * pxPerMM;
  const slotW = 2.2 * pxPerMM;
  const pitch = 5.5 * pxPerMM;
  ctx.fillStyle = '#1c1c1c';
  const drawField = (x0) => {
    for (let x = x0 + pitch * 0.5; x < x0 + fieldW - pitch * 0.4; x += pitch) {
      roundRect(ctx, x, margin, slotW, H - margin * 2, slotW / 2);
      ctx.fill();
    }
  };
  drawField(10 * pxPerMM);
  drawField(W - fieldW - 10 * pxPerMM);
  // Einfüll-Bohrung im Mittelsteg (hinten)
  ctx.beginPath();
  ctx.arc(W / 2, H * 0.12, 3 * pxPerMM, 0, Math.PI * 2);
  ctx.fill();
  return finishTexture(c);
}

/** Tropfschalen-Gitter: quer laufende Schlitze. */
export function makeDripGrateTexture(widthMM, depthMM) {
  const pxPerMM = 4;
  const W = Math.round(widthMM * pxPerMM);
  const H = Math.round(depthMM * pxPerMM);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#151515';
  const margin = 9 * pxPerMM;
  const slotH = 3.2 * pxPerMM;
  const pitch = 6.5 * pxPerMM;
  for (let y = margin * 0.9; y < H - margin * 0.9 - slotH; y += pitch) {
    roundRect(ctx, margin, y, W * 0.62 - margin, slotH, slotH / 2);
    ctx.fill();
    roundRect(ctx, W * 0.64, y, W * 0.36 - margin, slotH, slotH / 2);
    ctx.fill();
  }
  return finishTexture(c);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Manometer-Zifferblatt
// ---------------------------------------------------------------------------
/**
 * @param {{max:number, step:number, label:number, value:number, unit:string}} spec
 * @param {'white'|'black'} dial
 */
export function makeGaugeTexture(spec, dial = 'white') {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const face = dial === 'black' ? '#141414' : '#f5f3ee';
  const ink = dial === 'black' ? '#e9e4d8' : '#1a1a1a';
  const accent = dial === 'black' ? '#d9a441' : '#c0201c';
  const cx = S / 2;
  const cy = S / 2;
  ctx.fillStyle = face;
  ctx.fillRect(0, 0, S, S);
  const a0 = Math.PI * 0.75; // 0 bar unten links
  const sweep = Math.PI * 1.5;
  const angle = (val) => a0 + (val / spec.max) * sweep;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'butt';
  for (let val = 0; val <= spec.max + 1e-6; val += spec.step) {
    const major = Math.abs(val / spec.label - Math.round(val / spec.label)) < 1e-6;
    const a = angle(val);
    const r1 = S * 0.44;
    const r2 = major ? S * 0.36 : S * 0.40;
    ctx.lineWidth = major ? 7 : 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = ink;
      ctx.font = '600 50px "Inter", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const rt = S * 0.27;
      ctx.fillText(String(Math.round(val * 10) / 10), cx + Math.cos(a) * rt, cy + Math.sin(a) * rt);
    }
  }
  // Optimalbereich
  if (spec.zone) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, S * 0.455, angle(spec.zone[0]), angle(spec.zone[1]));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = ink;
  ctx.font = '500 34px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(spec.unit, cx, cy + S * 0.2);
  // Zeiger
  const a = angle(spec.value);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(a) * S * 0.07, cy - Math.sin(a) * S * 0.07);
  ctx.lineTo(cx + Math.cos(a) * S * 0.38, cy + Math.sin(a) * S * 0.38);
  ctx.stroke();
  ctx.fillStyle = dial === 'black' ? '#2a2a2a' : '#222';
  ctx.beginPath();
  ctx.arc(cx, cy, S * 0.045, 0, Math.PI * 2);
  ctx.fill();
  return finishTexture(c);
}

// ---------------------------------------------------------------------------
// Schriftzug, Display, Typenschild, Kontaktschatten
// ---------------------------------------------------------------------------
export function makeLogoTexture(text) {
  const W = 1024;
  const H = 128;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.font = '500 88px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  const spacing = 18;
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  const scale = Math.min(1, (W - 20) / total);
  ctx.save();
  ctx.translate((W - total * scale) / 2, H / 2);
  ctx.scale(scale, 1);
  let x = 0;
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, 4);
    x += widths[i] + spacing;
  });
  ctx.restore();
  const t = finishTexture(c);
  return t;
}

export function makeDisplayTexture() {
  const W = 256;
  const H = 160;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#060606';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '500 64px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('93.5°', W / 2, H / 2 + 4);
  return finishTexture(c);
}

export function makePlateTexture() {
  const W = 256;
  const H = 164;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#e9eaec');
  g.addColorStop(1, '#b9bcc0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.fillStyle = '#222';
  ctx.font = '700 22px Arial, sans-serif';
  ctx.fillText('LINEA MINI R', 18, 36);
  ctx.font = '700 26px Arial, sans-serif';
  ctx.fillText('CE', W - 60, 36);
  ctx.fillRect(14, 48, W - 28, 2);
  ctx.font = '13px Arial, sans-serif';
  const rows = ['Mod. / Type', 'S/N', '230 V ~ 50/60 Hz', '1600 W', 'Made in Italy'];
  rows.forEach((r, i) => {
    ctx.fillText(r, 18, 70 + i * 18);
    ctx.fillRect(130, 64 + i * 18, 90 - (i % 3) * 18, 3);
  });
  return finishTexture(c);
}

export function makeContactShadowTexture() {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.32)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return finishTexture(c, false);
}
