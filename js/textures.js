// ---------------------------------------------------------------------------
// Prozedurale Texturen: Lack-Effekte, Gitter, Manometer, Schriftzug (Holz: wood.js)
// Alle Texturen werden zur Laufzeit per Canvas erzeugt – keine Bilddateien nötig.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

import { createNoise, clamp01, makeCanvas } from './noise.js';

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

let sparkleTex = null;
let speckleTex = null;
/** Grobe Glitzer-Partikel (IGP-Effectives®/Perleffekt): Normal-Map + Farb-Körnung. */
export function getSparkleMaps() {
  if (sparkleTex) return { normalMap: sparkleTex, map: speckleTex };
  const S = 256;
  const nc = makeCanvas(S, S);
  const cc = makeCanvas(S, S);
  const nimg = nc.getContext('2d').createImageData(S, S);
  const cimg = cc.getContext('2d').createImageData(S, S);
  let seed = 424242;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < S * S; i++) {
    const r = rnd();
    let nx = 0;
    let ny = 0;
    let c = 0.9;
    if (r < 0.12) {
      // Glitzerpartikel: stark gekippte Facette, hell
      nx = (rnd() - 0.5) * 1.5;
      ny = (rnd() - 0.5) * 1.5;
      c = 1;
    } else if (r < 0.2) {
      c = 0.68; // dunkles Korn
    } else {
      nx = (rnd() - 0.5) * 0.12;
      ny = (rnd() - 0.5) * 0.12;
      c = 0.86 + rnd() * 0.06;
    }
    const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
    const len = Math.hypot(nx, ny, nz);
    nimg.data[i * 4] = ((nx / len) * 0.5 + 0.5) * 255;
    nimg.data[i * 4 + 1] = ((ny / len) * 0.5 + 0.5) * 255;
    nimg.data[i * 4 + 2] = ((nz / len) * 0.5 + 0.5) * 255;
    nimg.data[i * 4 + 3] = 255;
    cimg.data[i * 4] = cimg.data[i * 4 + 1] = cimg.data[i * 4 + 2] = c * 255;
    cimg.data[i * 4 + 3] = 255;
  }
  nc.getContext('2d').putImageData(nimg, 0, 0);
  cc.getContext('2d').putImageData(cimg, 0, 0);
  sparkleTex = new THREE.CanvasTexture(nc);
  sparkleTex.wrapS = sparkleTex.wrapT = THREE.RepeatWrapping;
  sparkleTex.repeat.set(1.2, 1.2);
  speckleTex = new THREE.CanvasTexture(cc);
  speckleTex.colorSpace = THREE.SRGBColorSpace;
  speckleTex.wrapS = speckleTex.wrapT = THREE.RepeatWrapping;
  speckleTex.repeat.set(1.2, 1.2);
  return { normalMap: sparkleTex, map: speckleTex };
}

let powderTex = null;
/**
 * Feinstruktur von Pulverlack als Normal-Map (kachelbar, 24 mm Kantenlänge):
 * unregelmäßige, leicht verlaufene Körnung wie bei einer echten Beschichtung.
 */
export function getPowderNormalMap() {
  if (powderTex) return powderTex;
  const S = 512;
  const N = createNoise(321);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      // Körnung in zwei Größen + sanfte Welligkeit (Orangenhaut)
      h[y * S + x] = N.fbm(u, v, 56, 56, 2) * 0.75 + N.noise(u * 120, v * 120, 120, 120) * 0.3 + N.fbm(u, v, 9, 9, 2) * 0.5;
    }
  }
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const k = 2.2;
  for (let y = 0; y < S; y++) {
    const yu = ((y - 1 + S) % S) * S;
    const yd = ((y + 1) % S) * S;
    for (let x = 0; x < S; x++) {
      const nx = (h[y * S + ((x - 1 + S) % S)] - h[y * S + ((x + 1) % S)]) * k;
      const ny = (h[yd + x] - h[yu + x]) * k;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const o = (y * S + x) * 4;
      img.data[o] = (nx * inv * 0.5 + 0.5) * 255;
      img.data[o + 1] = (ny * inv * 0.5 + 0.5) * 255;
      img.data[o + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  powderTex = new THREE.CanvasTexture(c);
  powderTex.wrapS = powderTex.wrapT = THREE.RepeatWrapping;
  powderTex.repeat.set(4.5, 4.5);
  powderTex.anisotropy = 8;
  return powderTex;
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

/** Feiner Längsschliff (gebürstetes Blech) als leichte Helligkeitsstreifen */
function brushed(ctx, W, H, vertical = true) {
  let seed = 4711;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const n = vertical ? W : H;
  for (let i = 0; i < n; i++) {
    const a = 0.02 + rnd() * 0.07;
    ctx.fillStyle = rnd() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
    if (vertical) ctx.fillRect(i, 0, 1, H);
    else ctx.fillRect(0, i, W, 1);
  }
}

/** Schlitze werden ausgestanzt (transparent) – darunter liegt der dunkle Innenraum. */
function punch(ctx, draw) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  draw();
  ctx.restore();
}

/** Rautenfeld (rb.crafts): versetzte Reihen kleiner Rauten in einem Rechteck (Pixel) */
function diamondField(ctx, x0, y0, w, h, size, pitch) {
  const rows = Math.floor(h / (pitch / 2));
  for (let r = 0; r < rows; r++) {
    const y = y0 + pitch / 4 + r * (pitch / 2);
    const off = r % 2 ? pitch / 2 : 0;
    for (let x = x0 + pitch / 2 + off; x < x0 + w - size / 2; x += pitch) {
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x + size / 2, y);
      ctx.lineTo(x, y + size / 2);
      ctx.lineTo(x - size / 2, y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/**
 * Tassenablage. 'slots': zwei geschlitzte Felder links/rechts, glatter Mittelsteg (Original).
 * 'diamond': zwei Lochbänder mit Rauten quer über die Breite (rb.crafts).
 */
export function makeCupTrayTexture(widthMM, depthMM, style = 'slots') {
  const pxPerMM = 5;
  const W = Math.round(widthMM * pxPerMM);
  const H = Math.round(depthMM * pxPerMM);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  brushed(ctx, W, H, true);
  const margin = 14 * pxPerMM;
  const fieldW = widthMM * 0.33 * pxPerMM;
  const slotW = 2.2 * pxPerMM;
  const pitch = 5.5 * pxPerMM;
  if (style === 'diamond') {
    punch(ctx, () => {
      const m = 16 * pxPerMM;
      const band = H * 0.3;
      diamondField(ctx, m, H * 0.12, W - 2 * m, band, 3.4 * pxPerMM, 7 * pxPerMM);
      diamondField(ctx, m, H * 0.58, W - 2 * m, band, 3.4 * pxPerMM, 7 * pxPerMM);
    });
    return finishTexture(c);
  }
  punch(ctx, () => {
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
  });
  return finishTexture(c);
}

/** Tropfblech. 'slots': quer laufende Schlitze (Original), 'diamond': Rautenlochung (rb.crafts). */
export function makeDripGrateTexture(widthMM, depthMM, style = 'slots') {
  const pxPerMM = 5;
  const W = Math.round(widthMM * pxPerMM);
  const H = Math.round(depthMM * pxPerMM);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  brushed(ctx, W, H, false);
  const margin = 9 * pxPerMM;
  const slotH = 3.2 * pxPerMM;
  const pitch = 6.5 * pxPerMM;
  if (style === 'diamond') {
    punch(ctx, () => diamondField(ctx, margin, margin, W - 2 * margin, H - 2 * margin, 4.6 * pxPerMM, 9 * pxPerMM));
    return finishTexture(c);
  }
  punch(ctx, () => {
    for (let y = margin * 0.9; y < H - margin * 0.9 - slotH; y += pitch) {
      roundRect(ctx, margin, y, W * 0.62 - margin, slotH, slotH / 2);
      ctx.fill();
      roundRect(ctx, W * 0.64, y, W * 0.36 - margin, slotH, slotH / 2);
      ctx.fill();
    }
  });
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
// Manometer-Zifferblatt (ohne Zeiger – der ist ein eigenes 3D-Teil)
// ---------------------------------------------------------------------------
const DIAL_STYLES = {
  white: { face: '#f4f2ec', ink: '#1a1a1a', zone: '#c0201c' },
  black: { face: '#141414', ink: '#ece7db', zone: '#d9a441' },
  cream: { face: '#eadfc6', ink: '#3a2a1c', zone: '#a8322a' },
  // offenes Werk: nur ein schwarzer Skalenring, die Mitte ist ausgestanzt
  naked: { face: '#121212', ink: '#f0ece2', zone: '#c0201c', ring: true },
};

/** Winkel auf dem Zifferblatt (Canvas-Koordinaten): 0 unten links, 270° im Uhrzeigersinn */
export const gaugeAngle = (val, max) => Math.PI * 0.75 + (val / max) * Math.PI * 1.5;

/**
 * @param {{max:number, step:number, label:number, unit:string, zone?:number[]}} spec
 * @param {'white'|'black'|'cream'|'naked'} dial
 */
export function makeGaugeTexture(spec, dial = 'white') {
  const S = 1024;
  const st = DIAL_STYLES[dial] || DIAL_STYLES.white;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const cx = S / 2;
  const cy = S / 2;
  ctx.fillStyle = st.face;
  ctx.fillRect(0, 0, S, S);
  if (!st.ring) {
    // ganz leichte Papierstruktur / Vignette
    const g = ctx.createRadialGradient(cx, cy, S * 0.1, cx, cy, S * 0.52);
    g.addColorStop(0, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0.10)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  const angle = (val) => gaugeAngle(val, spec.max);
  const rOut = S * (st.ring ? 0.47 : 0.445);
  ctx.strokeStyle = st.ink;
  ctx.fillStyle = st.ink;
  ctx.lineCap = 'butt';
  // Skalenbogen
  if (!st.ring) {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, rOut, angle(0), angle(spec.max));
    ctx.stroke();
  }
  const fine = spec.step / 2;
  for (let val = 0; val <= spec.max + 1e-6; val += fine) {
    const isStep = Math.abs(val / spec.step - Math.round(val / spec.step)) < 1e-6;
    const major = Math.abs(val / spec.label - Math.round(val / spec.label)) < 1e-6;
    const a = angle(val);
    const len = major ? 0.085 : isStep ? 0.055 : 0.03;
    ctx.lineWidth = major ? 11 : isStep ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut);
    ctx.lineTo(cx + Math.cos(a) * (rOut - S * len), cy + Math.sin(a) * (rOut - S * len));
    ctx.stroke();
    if (major) {
      ctx.font = `600 ${st.ring ? 58 : 84}px "Inter", "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const rt = rOut - S * (st.ring ? 0.135 : 0.165);
      ctx.fillText(String(Math.round(val * 10) / 10), cx + Math.cos(a) * rt, cy + Math.sin(a) * rt);
    }
  }
  // Optimalbereich
  if (spec.zone) {
    ctx.strokeStyle = st.zone;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, rOut + 12, angle(spec.zone[0]), angle(spec.zone[1]));
    ctx.stroke();
  }
  if (st.ring) {
    // nur der obere Skalenbogen bleibt stehen – der Rest gibt den Blick auf das Messwerk frei
    punch(ctx, () => {
      ctx.beginPath();
      ctx.arc(cx, cy, S * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, S * 0.6, -Math.PI * 0.1, Math.PI * 1.1);
      ctx.closePath();
      ctx.fill();
    });
  } else {
    ctx.fillStyle = st.ink;
    ctx.font = '500 56px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.unit, cx, cy + S * 0.2);
    ctx.font = '500 30px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.globalAlpha = 0.75;
    ctx.fillText(spec.title || '', cx, cy - S * 0.17);
    ctx.globalAlpha = 1;
  }
  return finishTexture(c);
}

/** Kleine Vorschau eines Zifferblatts (Data-URL) für die Auswahl */
export function gaugePreviewURL(dial, needleColor = '#c2231d') {
  const S = 96;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const st = DIAL_STYLES[dial] || DIAL_STYLES.white;
  const cx = S / 2;
  ctx.fillStyle = '#1b1b1b';
  ctx.beginPath();
  ctx.arc(cx, cx, S * 0.49, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = st.ring ? '#0c0c0c' : st.face;
  ctx.beginPath();
  ctx.arc(cx, cx, S * 0.4, 0, Math.PI * 2);
  ctx.fill();
  if (st.ring) {
    // angedeutetes Messwerk
    ctx.strokeStyle = '#c9a65a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cx, S * 0.3, Math.PI * 0.7, Math.PI * 2.2);
    ctx.stroke();
    ctx.fillStyle = '#c9a65a';
    ctx.fillRect(cx - 12, cx - 3, 24, 9);
    ctx.fillRect(cx - 6, cx + 14, 12, 9);
  }
  ctx.strokeStyle = st.ink;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
    if (st.ring && a > Math.PI * 2.3) continue;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * S * 0.38, cx + Math.sin(a) * S * 0.38);
    ctx.lineTo(cx + Math.cos(a) * S * 0.31, cx + Math.sin(a) * S * 0.31);
    ctx.stroke();
  }
  ctx.strokeStyle = needleColor;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const a = Math.PI * 1.72;
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(a) * 6, cx - Math.sin(a) * 6);
  ctx.lineTo(cx + Math.cos(a) * S * 0.32, cx + Math.sin(a) * S * 0.32);
  ctx.stroke();
  ctx.fillStyle = needleColor;
  ctx.beginPath();
  ctx.arc(cx, cx, 4.5, 0, Math.PI * 2);
  ctx.fill();
  return c.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// Schriftzug, Display, Typenschild, Kontaktschatten
// ---------------------------------------------------------------------------
/** Schriftzug als Maske: weiß auf schwarz (wird als alphaMap verwendet) */
export function makeLogoTexture(text) {
  const W = 1024;
  const H = 128;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 90px "Inter", "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  const spacing = 14;
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
  return finishTexture(c, false);
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
