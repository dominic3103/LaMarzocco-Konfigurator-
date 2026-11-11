// ---------------------------------------------------------------------------
// Mahlkönig E64 WS (Espresso Home Grinder, Grind by Weight)
//
// Maße in Millimeter, vermessen an der bemaßten Zeichnung der offiziellen
// Ersatzteilliste "Mahlkönig E64 WS" (Version 1.0, S. 2: Seiten-, Front-, Iso-
// und Draufsicht; Höhe 388, Ø 154, Tiefe 230 mit Rückknopf, Auslauf 123 mm über
// der Abstellfläche, Becherhalter 27–42 mm, Stellfläche 180 × 255 mm; bei
// 600 dpi 5,29 px/mm) und nach den Explosionszeichnungen (S. 3–7: Gehäuse,
// Displaygehäuse, Mahlwerk, Bodenplatte mit Wägezelle).
//
// Koordinaten: X = Breite, Y = Höhe (0 = Stellfläche), Z = Tiefe (+Z = Front).
// Z = 0 ist die Achse des runden Korpus (Mahlwerk, Trichter).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, rbox, mergeGeos } from '../model.js';
import { makeCanvas } from '../noise.js';
import { registerDevice } from '../devices.js';
import { DeviceUI } from '../device-ui.js';
import { createBuilder, filletShape, plateZ, plateY, latheY, latheZ, logoFactory, WOOD_U, WOOD_V } from '../parts.js';

const ID = 'e64';
const S = (k) => `${ID}:${k}`;
const R = 77; // Korpusradius (Ø 154)
const FLAT = 38.8; // abgeflachte Front (Gehäusefrontteil)
const TILT = Math.atan(0.2752); // Neigung der Bedienfront (oben zurück)
/** Lage der Bedienfront: z bei Höhe y */
const faceZ = (y) => 104 - (y - 189.3) * 0.2752;

// Kopf (Displaygehäuse) je Höhe: Vorderkante zf, halbe Frontbreite wf, halbe Breite an der
// flachen Front wb (nur Flügel über der Gabelsäule), Eckenradius rc.
const HEAD = [
  [149.5, 56, 34, 36.7, 4],
  [152, 55.2, 42, 50, 6],
  [155, 54.5, 48, 58, 8],
  [158, 53.7, 54, 62, 8],
  [162, 52.5, 58, 64, 8],
  [166, 51, 61, 65, 8],
  [172, 48.5, 62, 65.5, 8],
  [176, 61.6, 60, 65.5, 8],
  [180, 74.7, 57, 65.5, 8],
  [185, 91, 53, 65.5, 7],
  [189.3, 104, 50, 65.5, 6],
  [194, faceZ(194), 49.5, 65.5, 5],
  [251.8, faceZ(251.8), 48.5, 65.5, 5],
  [256.6, 85.5, 48.5, 65.5, 5],
];
function headAt(y) {
  if (y < HEAD[0][0]) return null;
  for (let i = 1; i < HEAD.length; i++) {
    if (y <= HEAD[i][0] + 1e-9) {
      const a = HEAD[i - 1];
      const b = HEAD[i];
      const t = (y - a[0]) / (b[0] - a[0]);
      return { zf: a[1] + (b[1] - a[1]) * t, wf: a[2] + (b[2] - a[2]) * t, wb: a[3] + (b[3] - a[3]) * t, rc: a[4] + (b[4] - a[4]) * t };
    }
  }
  const l = HEAD[HEAD.length - 1];
  return { zf: l[1], wf: l[2], wb: l[3], rc: l[4] };
}

// ---- Geometrie-Hilfen -----------------------------------------------------

/** Abstand eines Punktes zu einem konvexen Polygon (0 innen; Polygon gegen den Uhrzeigersinn) */
function distConvex(px, pz, poly) {
  let inside = true;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % poly.length];
    const ex = bx - ax;
    const ez = bz - az;
    if (ex * (pz - az) - ez * (px - ax) < 0) inside = false;
    const t = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / (ex * ex + ez * ez)));
    best = Math.min(best, Math.hypot(px - ax - ex * t, pz - az - ez * t));
  }
  return inside ? 0 : best;
}
/**
 * Kopfgrundriss bei einer Höhe als konvexes Polygon (gegen den Uhrzeigersinn in (x, z)), um rc
 * nach innen versetzt. Die Seiten laufen tangential in den Zylinder (Draufsicht der Zeichnung);
 * liegt die Vorderkante noch im Zylinder (Flügel über der Säule), enden sie an der flachen Front.
 */
function headPoly(h) {
  const L = Math.hypot(h.wf, h.zf);
  let bx;
  let bz;
  if (L > R + 0.5) {
    const th = Math.atan2(h.zf, h.wf) - Math.acos(R / L);
    bx = Math.cos(th) * R * 0.999;
    bz = Math.sin(th) * R * 0.999;
  } else {
    bx = h.wb;
    bz = FLAT - 1;
  }
  const poly = [
    [-bx * 0.5, -20],
    [bx * 0.5, -20],
    [bx, bz],
    [h.wf, h.zf],
    [-h.wf, h.zf],
    [-bx, bz],
  ];
  const n = poly.length;
  const lines = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    const ex = q[0] - p[0];
    const ez = q[1] - p[1];
    const l = Math.hypot(ex, ez);
    return { px: p[0] - (ez / l) * h.rc, pz: p[1] + (ex / l) * h.rc, ex, ez };
  });
  return lines.map((Ln, i) => {
    const M = lines[(i + n - 1) % n];
    const den = M.ex * Ln.ez - M.ez * Ln.ex;
    const t = ((Ln.px - M.px) * Ln.ez - (Ln.pz - M.pz) * Ln.ex) / den;
    return [M.px + M.ex * t, M.pz + M.ez * t];
  });
}
/** Grundriss bei Höhe y als N Punkte [x, z] (Winkel 0 = vorn, dann nach +X) */
function outlineAt(y, N = 144, inset = 0) {
  const h = headAt(y);
  const poly = h ? headPoly(h) : null;
  const pts = [];
  for (let k = 0; k < N; k++) {
    const phi = (k / N) * Math.PI * 2;
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    let r = R;
    if (c > 1e-6) r = Math.min(R, FLAT / c);
    if (poly) {
      // Strahl gegen gerundetes Trapez (Bisektion auf dem Abstand)
      let lo = 0;
      let hi = 160;
      for (let it = 0; it < 34; it++) {
        const m = (lo + hi) / 2;
        if (distConvex(s * m, c * m, poly) < h.rc) lo = m;
        else hi = m;
      }
      r = Math.max(r, lo);
    }
    r -= inset;
    pts.push([s * r, c * r]);
  }
  return pts;
}

/** Indizierte Mantelfläche aus Ringen gleicher Punktzahl (weiche Normalen innerhalb des Abschnitts) */
function ringLoft(rows, { capTop = false, capBottom = false } = {}) {
  const N = rows[0].length;
  const pos = [];
  const idx = [];
  for (const row of rows) for (const p of row) pos.push(...p);
  for (let r = 0; r < rows.length - 1; r++) {
    for (let k = 0; k < N; k++) {
      const a = r * N + k;
      const b = r * N + ((k + 1) % N);
      const c = (r + 1) * N + ((k + 1) % N);
      const d = (r + 1) * N + k;
      idx.push(a, b, c, a, c, d);
    }
  }
  const cap = (row, up) => {
    const base = pos.length / 3;
    let cx = 0;
    let cz = 0;
    for (const p of row) {
      cx += p[0] / N;
      cz += p[2] / N;
    }
    pos.push(cx, row[0][1], cz);
    for (const p of row) pos.push(...p);
    for (let k = 0; k < N; k++) {
      const a = base + 1 + k;
      const b = base + 1 + ((k + 1) % N);
      if (up) idx.push(base, a, b);
      else idx.push(base, b, a);
    }
  };
  if (capTop) cap(rows[rows.length - 1], true);
  if (capBottom) cap(rows[0], false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const bodyRows = (levels, inset = () => 0) => levels.map((y) => outlineAt(y, 144, inset(y)).map(([x, z]) => [x, y, z]));

/** Dreieck tri[t..t+2] so drehen, dass seine Normale zur erwarteten Richtung zeigt */
function orient(pos, tri, t, exp) {
  const P = (i) => [pos[tri[t + i] * 3], pos[tri[t + i] * 3 + 1], pos[tri[t + i] * 3 + 2]];
  const [a, b, c] = [P(0), P(1), P(2)];
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (n[0] * exp[0] + n[1] * exp[1] + n[2] * exp[2] < 0) {
    const s = tri[t + 1];
    tri[t + 1] = tri[t + 2];
    tri[t + 2] = s;
  }
}
/**
 * Profil entlang einer offenen Bahn ziehen (Gabel): path [{x, z, nx, nz}] mit Normale nach außen,
 * profile [[o, y]] gegen den Uhrzeigersinn (o = Abstand entlang der Normalen). Enden geschlossen.
 */
function sweep(path, profile) {
  const pos = [];
  const idx = [];
  const M = profile.length;
  for (let e = 0; e < M; e++) {
    const [ao, ay] = profile[e];
    const [bo, by] = profile[(e + 1) % M];
    const base = pos.length / 3;
    for (const p of path) {
      pos.push(p.x + p.nx * ao, ay, p.z + p.nz * ao);
      pos.push(p.x + p.nx * bo, by, p.z + p.nz * bo);
    }
    const dO = bo - ao;
    const dY = by - ay;
    for (let i = 0; i < path.length - 1; i++) {
      const p = path[i];
      const a = base + i * 2;
      const tri = [a, a + 1, a + 3, a, a + 3, a + 2];
      const exp = [p.nx * dY, -dO, p.nz * dY];
      orient(pos, tri, 0, exp);
      orient(pos, tri, 3, exp);
      idx.push(...tri);
    }
  }
  for (const [i, j] of [
    [0, 1],
    [path.length - 1, path.length - 2],
  ]) {
    const p = path[i];
    const q = path[j];
    const base = pos.length / 3;
    for (const [o, y] of profile) pos.push(p.x + p.nx * o, y, p.z + p.nz * o);
    for (let k = 1; k < M - 1; k++) {
      const tri = [base, base + k, base + k + 1];
      orient(pos, tri, 0, [p.x - q.x, 0, p.z - q.z]);
      idx.push(...tri);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Tropfenform (Tastensockel): Kreis r mit Ausläufer zum Punkt (tx, ty) */
function teardrop(r, tx, ty) {
  const L = Math.hypot(tx, ty);
  const ph = Math.atan2(ty, tx);
  const d = Math.acos(r / L);
  const sh = new THREE.Shape();
  sh.moveTo(r * Math.cos(ph + d), r * Math.sin(ph + d));
  sh.absarc(0, 0, r, ph + d, ph - d + Math.PI * 2, false);
  sh.quadraticCurveTo(tx, ty, r * Math.cos(ph + d), r * Math.sin(ph + d));
  return sh;
}
/** Rändel-Rippen auf einem Zylinder um +Z (Radius r, Länge len ab z0) */
function knurl(count, r, z0, len, w = 1.4) {
  const geos = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    const g = new THREE.BoxGeometry(w, w, len).toNonIndexed();
    g.rotateZ(a);
    g.translate(Math.cos(a) * r, Math.sin(a) * r, z0 + len / 2);
    geos.push(g);
  }
  return mergeGeos(...geos);
}
const interp = (pts, y) => {
  if (y <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (y <= pts[i][0]) {
      const t = (y - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
      return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
    }
  }
  return pts[pts.length - 1][1];
};

// ---- Texturen ---------------------------------------------------------------

/** Display (Mahlgewicht, Rezept) */
function makeE64Display() {
  const c = makeCanvas(512, 350);
  const g = c.getContext('2d');
  g.fillStyle = '#040506';
  g.fillRect(0, 0, 512, 350);
  g.fillStyle = '#0c0f13';
  g.fillRect(14, 14, 484, 322);
  g.textAlign = 'center';
  g.fillStyle = '#8f9aa4';
  g.font = '500 30px "Helvetica Neue", Arial, sans-serif';
  g.fillText('ESPRESSO  ·  DOUBLE', 256, 72);
  g.fillStyle = '#f4f4f2';
  g.font = '300 118px "Helvetica Neue", Arial, sans-serif';
  g.fillText('18.0', 228, 205);
  g.font = '400 52px "Helvetica Neue", Arial, sans-serif';
  g.fillText('g', 372, 205);
  g.strokeStyle = '#2c3138';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(60, 240);
  g.lineTo(452, 240);
  g.stroke();
  g.fillStyle = '#8f9aa4';
  g.font = '500 30px "Helvetica Neue", Arial, sans-serif';
  g.fillText('GRIND BY WEIGHT', 256, 292);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
/** Krone (Mahlkönig) als Prägung auf dem Schieber (Alpha-Maske) */
function makeCrown() {
  const c = makeCanvas(256, 192);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 192);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.ellipse(128, 150, 70, 18, 0, Math.PI * 0.05, Math.PI * 0.95);
  g.stroke();
  for (let k = -2; k <= 2; k++) {
    const a = k * 0.33;
    const x0 = 128 + Math.sin(a) * 40;
    const x1 = 128 + Math.sin(a) * 96;
    const y1 = 128 - Math.cos(a) * 92;
    g.beginPath();
    g.moveTo(x0, 140);
    g.quadraticCurveTo(128 + Math.sin(a) * 60, 110, x1, y1);
    g.stroke();
    g.beginPath();
    g.arc(x1, y1 - 6, 8, 0, Math.PI * 2);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------------------
// Montage
// ---------------------------------------------------------------------------
const STAGES = [
  { id: 'sk-base', src: 'skeleton', from: [0, 1, 0], dist: 400, gap: 0, dur: 0.7, drop: true },
  { id: 'sk-motor', src: 'skeleton', from: [0, 1, 0], dist: 700, gap: 0.45, dur: 0.8, heavy: true, spin: [[0, 1, 0], Math.PI * 2] },
  { id: 'sk-burrs', src: 'skeleton', from: [0, 1, 0], dist: 600, gap: 0.4, dur: 0.8, stagger: 0.2, spin: [[0, 1, 0], Math.PI * 3] },
  { id: 'sk-pcb', src: 'skeleton', from: [0, 0, 1], dist: 600, gap: 0.35, dur: 0.6, stagger: 0.1 },
  { id: 'base', from: [0, -1, 0.3], dist: 600, gap: 0.45, after: true, dur: 0.8, heavy: true },
  { id: 'housing', from: [0, 0.3, -1], dist: 900, gap: 0.4, dur: 0.95, heavy: true },
  { id: 'face', from: [0, 0, 1], dist: 700, gap: 0.35, dur: 0.75 },
  { id: 'keys', pop: true, gap: 0.3, dur: 0.3, stagger: 0.08 },
  { id: 'top', from: [0, 1, 0], dist: 600, gap: 0.35, dur: 0.6 },
  { id: 'fork', from: [0, -0.2, 1], dist: 700, gap: 0.35, dur: 0.7, stagger: 0.12 },
  { id: 'drip', from: [0, -0.2, 1], dist: 600, gap: 0.3, dur: 0.6 },
  { id: 'collar', from: [0, 1, 0], dist: 500, gap: 0.35, dur: 0.6, spin: [[0, 1, 0], Math.PI] },
  { id: 'hopper', from: [0, 1, 0], dist: 700, gap: 0.4, dur: 0.8 },
  { id: 'lid', from: [0, 1, 0], dist: 500, gap: 0.35, dur: 0.6, drop: true },
  { id: 'logo', pop: true, gap: 0.35, dur: 0.5 },
];
const isInner = (id) => id.startsWith('sk-');

function buildE64(mm) {
  const B = createBuilder('E64WS', mm);
  const { root, F } = B;
  const mat = (k, extra) => mm.get(S(k), extra);
  const bodyMat = mat('body.main');
  const baseMat = mat('body.base');
  const ringMat = mat('metal.ring');
  const forkMat = mat('metal.fork');
  const keyMat = mat('metal.knob');
  const nicheMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.6 });

  // =========================================================================
  // Sockel: Grundplatte (hinten rund, vorn verjüngt zur Abstellfläche), Füße
  // =========================================================================
  B.stage('base');
  {
    const a0 = Math.asin(8 / R);
    const sh = new THREE.Shape();
    sh.moveTo(0, -R);
    sh.absarc(0, 0, R, -Math.PI / 2, a0, false);
    sh.lineTo(57, 118);
    sh.quadraticCurveTo(55.5, 141.3, 35, 141.3);
    sh.lineTo(-35, 141.3);
    sh.quadraticCurveTo(-55.5, 141.3, -57, 118);
    sh.lineTo(-R * Math.cos(a0), 8);
    sh.absarc(0, 0, R, Math.PI - a0, Math.PI * 1.5, false);
    B.add(boxProjectUV(plateY(sh, 2.5, 8, 1.5, 48)), baseMat, S('body.base'));
    B.plain(plateY(filletShape([[-50, 55], [50, 55], [50, 122], [-50, 122]], [2, 2, 14, 14], 4), 0.7, 1.9, 0.4), F.rubber);
    for (const [x, z] of [
      [-50, 43],
      [50, 43],
      [-50, -45],
      [50, -45],
    ]) B.plain(new THREE.CylinderGeometry(9, 9.4, 2.6, 24), F.rubber).position.set(x, 1.3, z);
  }

  // =========================================================================
  // Gehäuse: Zylinder Ø 154, vorn abgeflacht; Displaygehäuse mit Flügel, Kinn und
  // schräger Bedienfront; Gabelsäule; Fugen; Rückseite
  // =========================================================================
  B.stage('housing');
  {
    const sections = [
      [10.5, 149.4],
      [149.4, 149.5],
      [149.5, 152, 155, 158, 162, 166, 172],
      [172, 174, 176, 178, 180, 182.5, 185, 187.3, 189.3],
      [189.3, 191, 194, 205, 220, 235, 245, 250],
    ];
    for (const lv of sections) B.add(boxProjectUV(ringLoft(bodyRows(lv))), bodyMat, S('body.main'));
    // Gabelsäule (Gehäusefrontteil): unten mit Aussparung für die Halteschiene
    const low = filletShape(
      [[-36.7, 36], [36.7, 36], [36.7, 56], [29.3, 56], [29.3, 52.5], [-29.3, 52.5], [-29.3, 56], [-36.7, 56]],
      [0, 0, 1.5, 0.8, 0.8, 0.8, 0.8, 1.5],
      4,
    );
    B.add(boxProjectUV(plateY(low, 10.5, 89, 0.4)), bodyMat, S('body.main'));
    const up = filletShape([[-36.7, 36], [36.7, 36], [36.7, 56], [-36.7, 56]], [0, 0, 1.5, 1.5], 4);
    B.add(boxProjectUV(plateY(up, 99.5, 50.4, 0.4)), bodyMat, S('body.main'));
    // Fugen zwischen Seitenschalen und Frontteil sowie hinten
    const seam = [];
    for (let y = 11; y <= 249.5; y += 2.5) {
      const o = outlineAt(y, 288);
      let x = 66;
      for (let k = 0; k < o.length / 2; k++) {
        const [x0, z0] = o[k];
        const [x1, z1] = o[k + 1];
        if (z0 >= 38.3 && z1 < 38.3) {
          x = x0 + ((x1 - x0) * (38.3 - z0)) / (z1 - z0);
          break;
        }
      }
      seam.push([x + 0.05, y]);
    }
    for (const sx of [1, -1]) {
      const curve = new THREE.CatmullRomCurve3(seam.map(([x, y]) => new THREE.Vector3(sx * x, y, 38.3)));
      B.plain(new THREE.TubeGeometry(curve, 96, 0.45, 6, false), F.darkGap);
    }
    B.plain(new THREE.BoxGeometry(0.9, 239, 0.9), F.darkGap).position.set(0, 130, -R + 0.2);
    // Rückseite: Netzschalter, Rändelrad, Kabelführung
    const rock = B.plain(rbox(15, 24, 5, 1.6, 2), F.blackPlastic);
    rock.position.set(0, 51, -R - 1.2);
    rock.rotation.x = 0.07;
    B.plain(rbox(18.5, 28, 1.6, 0.7, 2), F.blackPlastic).position.set(0, 51, -R - 0.2);
    const wheel = new THREE.Group();
    root.add(wheel);
    B.plain(latheZ([[0, 0], [8, 0], [8, 4.6], [0, 4.6]], 32), F.blackPlastic, wheel);
    B.plain(knurl(18, 8, 0.3, 4, 1.1), F.blackPlastic, wheel);
    B.plain(latheZ([[0, 4.6], [3.6, 4.6], [3.6, 10.4], [3.0, 11], [0, 11]], 24), F.chrome, wheel);
    wheel.rotation.y = Math.PI;
    wheel.position.set(0, 29, -R + 0.5);
    B.plain(rbox(12, 22, 4, 1.5, 2), F.blackPlastic).position.set(0, 105, -R - 1.2);
  }

  // Deckel (Grinder top cover) mit gerundeter Oberkante
  B.stage('top');
  {
    const ins = { 250: 0, 254.8: 0, 255.9: 0.55, 256.6: 1.7 };
    B.add(boxProjectUV(ringLoft(bodyRows([250, 254.8, 255.9, 256.6], (y) => ins[y]), { capTop: true })), mat('body.top'), S('body.top'));
  }

  // =========================================================================
  // Bedienfront: Rahmen mit Display, Tastensockel links, Knopfsockel rechts mit
  // seitlicher Linse; Auslaufnische und Auslauf unter dem Kinn
  // =========================================================================
  B.stage('face');
  const onFace = (x, y) => {
    const g = new THREE.Group();
    root.add(g);
    g.position.set(x, y, faceZ(y));
    g.rotation.x = -TILT;
    return g;
  };
  {
    const yC = (194.1 + 245.1) / 2;
    const dispH = (245.1 - 194.1) / Math.cos(TILT);
    const f = onFace(0, yC);
    const frame = filletShape([[-44, -32], [44, -32], [44, 32], [-44, 32]], 5, 5);
    frame.holes.push(filletShape([[-39.2, -dispH / 2 - 0.6], [39.2, -dispH / 2 - 0.6], [39.2, dispH / 2 + 0.6], [-39.2, dispH / 2 + 0.6]], 2.2, 4));
    B.add(boxProjectUV(plateZ(frame, -1, 2.6, 0.6)), bodyMat, S('body.main'), f);
    const disp = B.plain(new THREE.PlaneGeometry(77.4, dispH), new THREE.MeshBasicMaterial({ map: makeE64Display(), toneMapped: false }), f);
    disp.position.z = 0.5;
    disp.castShadow = false;
    const glass = B.plain(
      new THREE.PlaneGeometry(78.4, dispH + 1.2),
      new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.18, clearcoat: 1, depthWrite: false }),
      f,
    );
    glass.position.z = 0.65;
    glass.castShadow = false;
    for (const y of [234.7, 207.3]) B.add(boxProjectUV(plateZ(teardrop(11, 9, -17), -28, 31.4, 1.6, 32)), bodyMat, S('body.main'), onFace(-49, y));
    B.add(boxProjectUV(plateZ(teardrop(13.5, -2, -21), -28, 31, 1.6, 32)), bodyMat, S('body.main'), onFace(50.7, 220.6));
    const lens = new THREE.SphereGeometry(1, 48, 24);
    lens.scale(7, 16.5, 26);
    const ln = B.add(boxProjectUV(lens), bodyMat, S('body.main'));
    ln.position.set(56.3, 215.5, 67);
    ln.rotation.y = -0.33;
    // Auslaufnische (dunkel) unter dem Kinn, der Fläche folgend
    {
      const NY = 22;
      const NX = 26;
      const pos = [];
      const idx = [];
      for (let i = 0; i <= NY; i++) {
        const y = 151.5 + ((181.8 - 151.5) * i) / NY;
        const hw = y >= 160 ? 32 : 32 * Math.sqrt(Math.max(0.02, 1 - ((160 - y) / 8.5) ** 2));
        const z = headAt(y).zf + 0.35;
        for (let j = 0; j <= NX; j++) pos.push(-hw + (2 * hw * j) / NX, y, z);
      }
      for (let i = 0; i < NY; i++) {
        for (let j = 0; j < NX; j++) {
          const a = i * (NX + 1) + j;
          idx.push(a, a + 1, a + NX + 2, a, a + NX + 2, a + NX + 1);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      B.plain(g, nicheMat);
    }
    // Auslauf: schräger, unten gerundeter Schacht
    {
      const zf = [
        [133.6, 76.8],
        [151.5, 82.4],
        [157.2, 79.6],
        [169.5, 82.4],
        [176, 82.4],
      ];
      const zr = [
        [133.6, 76.8],
        [158.2, 62.6],
        [176, 62.6],
      ];
      const levels = [134.1, 135, 136.3, 138, 140, 142.5, 145.5, 149, 153, 157, 161, 165, 169, 173, 176];
      const n = 2.6;
      const rows = levels.map((y) => {
        const a = y >= 146 ? 12.3 : 12.3 * Math.sqrt(Math.max(0, 1 - ((146 - y) / 12.5) ** 2));
        const f0 = interp(zf, y);
        const r0 = interp(zr, y);
        const zc = (f0 + r0) / 2;
        const d = Math.max(0.4, (f0 - r0) / 2);
        const row = [];
        for (let k = 0; k < 48; k++) {
          const t = (k / 48) * Math.PI * 2;
          const s = Math.sin(t);
          const c = Math.cos(t);
          row.push([a * Math.sign(s) * Math.abs(s) ** (2 / n), y, zc + d * Math.sign(c) * Math.abs(c) ** (2 / n)]);
        }
        return row;
      });
      B.plain(ringLoft(rows, { capBottom: true }), F.blackPlastic);
    }
  }
  // Tasten und Rändelknopf
  B.stage('keys');
  {
    for (const y of [234.7, 207.3]) {
      const g = onFace(-49, y);
      B.plain(latheZ([[9.6, 2.6], [9.6, 3.6], [0, 3.6]], 40), F.darkGap, g);
      B.add(latheZ([[8.9, 3], [8.9, 7.6], [8.3, 8.6], [5, 9.1], [0, 9.25]], 40), keyMat, S('metal.knob'), g);
    }
    const kg = onFace(50.7, 220.6);
    B.add(latheZ([[11.2, 2.6], [11.2, 12.4], [10.6, 13.2], [8.6, 13.2]], 48), keyMat, S('metal.knob'), kg);
    B.add(knurl(24, 11.25, 3.6, 8.2, 1.3), keyMat, S('metal.knob'), kg);
    B.add(latheZ([[8.4, 12.4], [8.4, 16.4], [7.7, 17.5], [4.5, 18.2], [0, 18.35]], 48), keyMat, S('metal.knob'), kg);
  }

  // =========================================================================
  // Gabel (Siebträgerhalter, Hufeisen mit schrägen Innenflanken) und Becherhalter
  // mit Halteschiene (verstellbar 27–42 mm)
  // =========================================================================
  B.stage('fork');
  {
    const cz = 86;
    const r = 28;
    const path = [
      { x: -r, z: 101, nx: -1, nz: 0 },
      { x: -r, z: 93, nx: -1, nz: 0 },
    ];
    for (let k = 0; k <= 36; k++) {
      const t = Math.PI + (k / 36) * Math.PI;
      path.push({ x: r * Math.cos(t), z: cz + r * Math.sin(t), nx: Math.cos(t), nz: Math.sin(t) });
    }
    path.push({ x: r, z: 93, nx: 1, nz: 0 }, { x: r, z: 101, nx: 1, nz: 0 });
    const prof = [
      [0, 99.5],
      [16.8, 99.5],
      [16.8, 117.6],
      [15.6, 118.8],
      [12.8, 118.8],
      [0.6, 106.5],
      [0, 106.5],
    ];
    B.add(boxProjectUV(sweep(path, prof)), forkMat, S('metal.fork'));
    // Becherhalter: sichelförmige Auflage
    const zc = 110;
    const a1 = Math.asin((zc - 96.8) / 40.8);
    const a2 = Math.asin((zc - 100) / 26);
    const xo = 40.8 * Math.cos(a1);
    const xi = 26 * Math.cos(a2);
    const tc = (xo + xi) / 2;
    const tr = (xo - xi) / 2;
    const sh = new THREE.Shape();
    sh.moveTo(-xo, zc);
    sh.absarc(0, 96.8, 40.8, Math.PI - a1, Math.PI * 2 + a1, false);
    sh.absarc(tc, zc, tr, 0, Math.PI, false);
    sh.absarc(0, 100, 26, a2, Math.PI - a2, true);
    sh.absarc(-tc, zc, tr, 0, Math.PI, false);
    B.add(boxProjectUV(plateY(sh, 70.2, 5.7, 1.3, 48)), forkMat, S('metal.fork'));
    // Halteschiene mit Langloch und Schraube
    const br = filletShape([[-12.25, 28], [12.25, 28], [12.25, 94], [-12.25, 94]], 4.5, 5);
    br.holes.push(filletShape([[-8.6, 33], [8.6, 33], [8.6, 89], [-8.6, 89]], 3.2, 5));
    B.add(boxProjectUV(plateZ(br, 55.6, 7, 0.8)), forkMat, S('metal.fork'));
    B.plain(rbox(17.6, 56.4, 2, 0.6, 2), F.blackPlastic).position.set(0, 61, 57);
    B.plain(latheZ([[3.8, 0], [3.8, 1.2], [3.2, 2.2], [0, 2.5]], 24), F.chrome).position.set(-0.75, 66.4, 62.4);
  }
  // Abstellfläche (Tropfschale) mit Rand und Matte
  B.stage('drip');
  {
    const rim = filletShape([[-55, 62], [55, 62], [55, 139.6], [-55, 139.6]], [6, 6, 19, 19], 5);
    rim.holes.push(filletShape([[-50.5, 66.5], [50.5, 66.5], [50.5, 135.1], [-50.5, 135.1]], [3, 3, 15, 15], 5));
    B.add(boxProjectUV(plateY(rim, 10.3, 1.1, 0.35, 32)), baseMat, S('body.base'));
    B.plain(plateY(filletShape([[-42, 74], [42, 74], [42, 127.5], [-42, 127.5]], [3, 3, 10, 10], 4), 10.3, 0.6, 0.2), F.rubber);
  }

  // =========================================================================
  // Trichteraufnahme (Adapterplatte, Schieber mit Krone, Verriegelung), Trichter, Deckel
  // =========================================================================
  B.stage('collar');
  {
    B.add(
      latheY([[0, 256.5], [64, 256.5], [63, 257.3], [60, 258], [56, 259], [51.5, 260], [47.5, 261], [43.5, 262.5], [41, 264], [40, 265.5], [39.9, 267], [0, 267]], 72),
      ringMat,
      S('metal.ring'),
    );
    B.add(latheY([[0, 267], [39.9, 267], [40.1, 270], [41, 278], [41.8, 282], [42.7, 286], [43.9, 290], [44.4, 292.2], [44.8, 293], [0, 293]], 72), ringMat, S('metal.ring'));
    const tab = filletShape([[-20, 0], [20, 0], [15, 36], [-15, 36]], [3, 3, 6, 6], 5);
    const t = B.add(boxProjectUV(plateY(tab, 0, 2.6, 0.8, 24)), ringMat, S('metal.ring'));
    t.position.set(0, 258.4, 30);
    t.rotation.x = 0.05;
    const crown = B.plain(
      new THREE.PlaneGeometry(17, 12.75),
      new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.4, metalness: 0.6, alphaMap: makeCrown(), transparent: true, depthWrite: false }),
    );
    crown.rotation.x = -Math.PI / 2 + 0.05;
    crown.position.set(0, 261.15, 52);
    crown.castShadow = false;
    B.add(rbox(5, 15, 28, 1.5, 2), ringMat, S('metal.ring')).position.set(46.6, 279, 0);
    B.plain(rbox(32, 2.6, 7, 1, 2), F.blackPlastic).position.set(-57, 274, 0);
  }
  B.stage('hopper');
  {
    const prof = [
      [44.8, 293],
      [46, 296],
      [47.5, 300],
      [49.6, 305],
      [51.6, 310],
      [54.1, 315],
      [56.5, 320],
      [59.2, 325],
      [61.8, 330],
      [64.5, 335],
      [66.9, 340],
      [69, 345],
      [70.7, 350],
      [72, 355],
      [73.2, 360],
      [74.3, 368],
      [74.9, 373],
    ];
    const clear = new THREE.MeshPhysicalMaterial({ color: 0x2b2a2a, roughness: 0.06, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
    const h = B.plain(latheY(prof, 80), clear);
    h.castShadow = false;
    h.renderOrder = 2;
  }
  B.stage('lid');
  {
    const g = latheY([[0, 373], [75, 373], [75.3, 375], [75.6, 380], [75.6, 387], [74.6, 388.7], [0, 388.7]], 80);
    const p = g.attributes.position;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      uv[i * 2] = p.getX(i) / WOOD_U + 0.4;
      uv[i * 2 + 1] = p.getZ(i) / WOOD_V + 0.3;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    B.add(g, mat('wood.lid'), S('wood.lid'));
  }
  B.stage('logo');
  {
    const makeLogo = logoFactory(B, S('metal.logo'), 22, 3.1, 'MAHLKÖNIG');
    const l = makeLogo(3);
    l.rotation.y = Math.PI / 2;
    l.position.set(49.1, 279, 0);
  }

  // Innenleben (Explosionszeichnungen S. 3–7): Bodenplatte mit Wägezelle und
  // Netzteil, Motor, Mahlkammer mit 64-mm-Flachmahlscheiben, Steuerung und Display
  {
    B.sk('sk-base');
    B.skBox(128, 4, 150, F.frame, 0, 12.5, 10, 1);
    B.skBox(18, 14, 80, F.steel, 0, 21, 70, 1);
    B.skBox(70, 30, 2, F.pcb, 0, 32, -55, 1);
    B.sk('sk-motor');
    B.skCyl(38, 118, F.motor, 0, 90, -6, 'y', 48);
    B.skCyl(44, 10, F.steel, 0, 154, -6, 'y', 48);
    B.sk('sk-burrs');
    B.skCyl(46, 30, F.steel, 0, 178, 0, 'y', 56);
    B.skCyl(32, 6, F.chrome, 0, 196, 0, 'y', 48);
    B.skCyl(32, 6, F.chrome, 0, 203, 0, 'y', 48);
    B.skCyl(42, 16, F.steel, 0, 214, 0, 'y', 48);
    B.sk('sk-pcb');
    B.skBox(84, 56, 2, F.pcb, 0, 220, 88, 1).rotation.x = -TILT;
    B.skBox(60, 50, 2, F.pcb, -40, 120, 20, 1).rotation.y = Math.PI / 2;
  }

  root.scale.setScalar(0.001);
  return {
    root,
    pickables: B.pickables,
    skeleton: B.skeleton,
    stages: STAGES,
    isInner,
    setBarista() {},
    sync() {},
  };
}

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------
const CATEGORIES = {
  [S('body')]: {
    title: 'Gehäuse',
    allLabel: 'Komplett',
    slots: [
      { key: S('body.main'), label: 'Korpus & Displaygehäuse' },
      { key: S('body.top'), label: 'Deckel' },
      { key: S('body.base'), label: 'Sockel & Abstellfläche' },
    ],
  },
  [S('wood')]: {
    title: 'Holz',
    allLabel: 'Alle',
    slots: [{ key: S('wood.lid'), label: 'Trichterdeckel' }],
  },
  [S('metal')]: {
    title: 'Akzente',
    allLabel: 'Alle',
    slots: [
      { key: S('metal.ring'), label: 'Trichteraufnahme & Schieber' },
      { key: S('metal.fork'), label: 'Gabel & Becherhalter' },
      { key: S('metal.knob'), label: 'Tasten & Rändelknopf' },
      { key: S('metal.logo'), label: 'Schriftzug', woodLogo: true },
    ],
  },
};
const SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));
const black = { id: 'RAL9005', finish: 'matte' };
const white = { id: 'RAL9016', finish: 'satin' };
function preset(name, swatches, body, lid, accents = {}) {
  return {
    name,
    swatches,
    config: {
      slots: {
        [S('body.main')]: body,
        [S('body.top')]: body,
        [S('body.base')]: body,
        [S('wood.lid')]: lid,
        [S('metal.ring')]: { id: 'black', finish: 'matte' },
        [S('metal.fork')]: { id: 'black', finish: 'matte' },
        [S('metal.knob')]: { id: 'black', finish: 'matte' },
        [S('metal.logo')]: { id: 'white', finish: 'matte' },
        ...accents,
      },
      opts: {},
    },
  };
}
const PRESETS = [
  // Holzdeckel von rb.crafts ("Holzdeckel Mahlkönig E64 WS", 250-g-Trichter)
  preset('Schwarz · Walnuss (rb.crafts)', ['#141414', '#644434', '#efefea'], black, { id: 'walnut', finish: 'oiled' }, {
    [S('metal.logo')]: { id: 'wood:walnut', finish: 'matte' },
  }),
  preset('Weiß · Eiche (rb.crafts)', ['#efefea', '#d99c52', '#141414'], white, { id: 'oak', finish: 'oiled' }, {
    [S('body.base')]: black,
    [S('metal.logo')]: { id: 'black', finish: 'matte' },
  }),
  preset('Schwarz · Olive (rb.crafts)', ['#141414', '#dd9540', '#efefea'], black, { id: 'olive', finish: 'oiled' }, {
    [S('metal.knob')]: { id: 'wood:olive', finish: 'oiled' },
  }),
  // Werksausführungen (Ersatzteilliste: Gehäuse schwarz oder weiß)
  preset('Schwarz (Werk)', ['#141414', '#0f0f0f', '#efefea'], black, { id: 'black', finish: 'oiled' }),
  preset('Weiß (Werk)', ['#efefea', '#0f0f0f', '#141414'], white, { id: 'black', finish: 'oiled' }, {
    [S('body.base')]: black,
    [S('metal.logo')]: { id: 'black', finish: 'matte' },
  }),
];

registerDevice({
  id: ID,
  kind: 'grinder',
  brand: 'Mahlkönig',
  name: 'E64 WS',
  full: 'Mahlkönig E64 WS',
  file: 'E64-WS',
  code: 'E64',
  dims: { w: 154, d: 230, h: 388 },
  rootZ: -0.03,
  shadow: { w: 0.3, d: 0.36, z: 0.03 },
  frame: { target: [0, 0.2, 0], scale: 1.0 },
  slots: SLOTS,
  categories: CATEGORIES,
  presets: PRESETS,
  build: (mm) => buildE64(mm),
  UI: DeviceUI,
  roles: {
    body: [S('body.main'), S('body.top'), S('body.base')],
    accent: [S('metal.ring'), S('metal.fork'), S('metal.knob')],
    wood: [S('wood.lid')],
    screws: [],
    logo: [S('metal.logo')],
  },
  stageLabels: {
    'sk-base': ['Bodenplatte, Wägezelle & Netzteil', ''],
    'sk-motor': ['Motor', ''],
    'sk-burrs': ['Mahlkammer & Flachmahlscheiben 64 mm', 'Stahl'],
    'sk-pcb': ['Steuerung & Display', 'Elektronik'],
    base: ['Sockel', S('body.base')],
    housing: ['Gehäuse & Displaygehäuse', S('body.main')],
    face: ['Bedienfront & Auslauf', S('body.main')],
    keys: ['Tasten & Rändelknopf', S('metal.knob')],
    top: ['Deckel', S('body.top')],
    fork: ['Gabel & Becherhalter', S('metal.fork')],
    drip: ['Abstellfläche', S('body.base')],
    collar: ['Trichteraufnahme & Schieber', S('metal.ring')],
    hopper: ['Trichter 250 g', 'Kunststoff'],
    lid: ['Trichterdeckel', S('wood.lid')],
    logo: ['Schriftzug', S('metal.logo')],
  },
});
