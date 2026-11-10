// ---------------------------------------------------------------------------
// Hilfsfunktionen für prozedurale Texturen: kachelbares Rauschen, Farbwerte
// ---------------------------------------------------------------------------

// ---------- kachelbares Gradient-Noise (periodisch, damit Texturen nahtlos sind) ----------
export function createNoise(seed = 1) {
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
export function cellDist(x, y, period, seed) {
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

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
