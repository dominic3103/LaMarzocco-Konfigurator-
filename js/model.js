// ---------------------------------------------------------------------------
// Prozedurales 3D-Modell der Linea Mini R
// Maße in Millimeter – aus den Maßzeichnungen des offiziellen Ersatzteilkatalogs
// (Linea Mini R Parts Catalog V1.0, Seite 4: Front-, Seiten- und Rückansicht)
// sowie den Referenzfotos.
//
// Koordinaten: X = Breite (rechts = Dampflanzenseite), Y = Höhe (0 = Stellfläche),
//              Z = Tiefe (+Z = Front). Z = 0 ist die Frontebene des Korpus.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  makeCupTrayTexture,
  makeDripGrateTexture,
  makeGaugeTexture,
  gaugeAngle,
  makeLogoTexture,
  makeDisplayTexture,
  makePlateTexture,
} from './textures.js';
import { needleById } from './data.js';

// Wichtige Maße (aus den Werkszeichnungen, Maßstab 1,709 px/mm vermessen)
const M = {
  halfW: 178.5, // halbe Gesamtbreite (357 mm)
  slabT: 27, // Stärke der Seitenwangen (Front-Flansch)
  inner: 151.5, // Innenkante der Seitenwangen
  top: 377.5, // Oberkante Reling (378 mm)
  tray: 368, // Höhe Tassenablage
  slabBotFront: 235,
  slabBotRear: 255,
  rearTop: -342, // Oberkorpus ragt hinten über die Standfläche hinaus
  rearBot: -324,
  headBot: 250,
  headTop: 364,
  headFront: 130,
  headHalfW: 151,
  baseTop: 93.6,
  footH: 25.8,
  baseRear: -297,
  baseFront: 4,
  baseHalfW: 145.5,
  dripFront: 166,
  dripHalfW: 161.5,
  dripLipBot: 82.5,
  groupZ: 66.5,
};

/** UVs per Box-Projektion: einheitliche Texeldichte auf allen Flächen. */
function boxProjectUV(geom, scaleMM = 60) {
  if (!geom.attributes.normal) geom.computeVertexNormals();
  const pos = geom.attributes.position;
  const nor = geom.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    let u;
    let v;
    if (nx >= ny && nx >= nz) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else if (ny >= nz) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u / scaleMM;
    uv[i * 2 + 1] = v / scaleMM;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geom;
}

/** Skaliert vorhandene UVs (z. B. von Extrude-Geometrien in mm). */
function scaleUV(geom, s, offset = [0, 0]) {
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s + offset[0], uv.getY(i) * s + offset[1]);
  uv.needsUpdate = true;
  return geom;
}

function rbox(w, h, d, r = 3, seg = 3) {
  return new RoundedBoxGeometry(w, h, d, seg, r);
}

/** Erzeugt ein Profil in der Z/Y-Ebene und extrudiert es entlang X. */
function profileExtrudeX(points, depth, bevel = 0) {
  // Shape-Koordinaten: sx = -Z, sy = Y. Nach Drehung um Y (+90°): Welt-X = Extrusion.
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(-z, y)));
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geom.translate(0, 0, bevel);
  geom.rotateY(Math.PI / 2);
  return geom;
}

/** Shape (in XY) entlang +Z extrudieren und an z=0 ausrichten. */
function extrudeZ(shape, depth, bevel = 0, bevelSeg = 3, curveSegments = 24) {
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: bevelSeg,
    curveSegments,
  });
  geom.computeBoundingBox();
  geom.translate(0, 0, -geom.boundingBox.min.z);
  return geom;
}

/** Körper aus Polygonen, je Polygon eine Normale (Newell) -> saubere Flächen. */
function polyhedron(faces) {
  const pos = [];
  const nor = [];
  for (const f of faces) {
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const len = Math.hypot(nx, ny, nz) || 1;
    for (let i = 1; i < f.length - 1; i++) {
      pos.push(...f[0], ...f[i], ...f[i + 1]);
      for (let k = 0; k < 3; k++) nor.push(nx / len, ny / len, nz / len);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/**
 * Konvexer Körper mit gerundeten Kanten (wie gekantetes Blech).
 * Flächen bleiben eben, Kanten und Ecken werden mit Radius r verrundet.
 * @param {number[][]} verts  Eckpunkte
 * @param {number[][]} faces  je Fläche die Eckpunkt-Indizes (gegen den Uhrzeigersinn von außen)
 */
function roundedPolyhedron(verts, faces, r = 2, seg = 3) {
  const V = verts.map((v) => new THREE.Vector3(...v));
  // Flächennormalen (Newell) und Ebenenabstand
  const N = faces.map((f) => {
    const n = new THREE.Vector3();
    for (let i = 0; i < f.length; i++) {
      const a = V[f[i]];
      const b = V[f[(i + 1) % f.length]];
      n.x += (a.y - b.y) * (a.z + b.z);
      n.y += (a.z - b.z) * (a.x + b.x);
      n.z += (a.x - b.x) * (a.y + b.y);
    }
    return n.normalize();
  });
  const D = faces.map((f, i) => N[i].dot(V[f[0]]));
  // nach innen versetzte Ecken: Schnitt der drei um r verschobenen Ebenen
  const facesOf = V.map((_, vi) => faces.map((f, fi) => (f.includes(vi) ? fi : -1)).filter((x) => x >= 0));
  const C = V.map((_, vi) => {
    const [a, b, c] = facesOf[vi];
    const m = new THREE.Matrix3().set(N[a].x, N[a].y, N[a].z, N[b].x, N[b].y, N[b].z, N[c].x, N[c].y, N[c].z).invert();
    return new THREE.Vector3(D[a] - r, D[b] - r, D[c] - r).applyMatrix3(m);
  });
  const pos = [];
  const nor = [];
  const tri = (p0, n0, p1, n1, p2, n2) => {
    // Umlaufsinn so wählen, dass die Fläche nach außen zeigt
    const out = new THREE.Vector3().addVectors(n0, n1).add(n2);
    const fn = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0));
    const pts = fn.dot(out) >= 0 ? [p0, n0, p1, n1, p2, n2] : [p0, n0, p2, n2, p1, n1];
    for (let i = 0; i < 6; i += 2) {
      pos.push(pts[i].x, pts[i].y, pts[i].z);
      nor.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    }
  };
  const P = (vi, n) => C[vi].clone().addScaledVector(n, r);
  // ebene Flächen
  faces.forEach((f, fi) => {
    for (let i = 1; i < f.length - 1; i++) tri(P(f[0], N[fi]), N[fi], P(f[i], N[fi]), N[fi], P(f[i + 1], N[fi]), N[fi]);
  });
  // Kanten: Viertelzylinder zwischen zwei Flächen
  const done = new Set();
  faces.forEach((f, fa) => {
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (done.has(key)) continue;
      done.add(key);
      const fb = faces.findIndex((g, gi) => gi !== fa && g.includes(a) && g.includes(b));
      if (fb < 0) continue;
      for (let k = 0; k < seg; k++) {
        const n0 = N[fa].clone().lerp(N[fb], k / seg).normalize();
        const n1 = N[fa].clone().lerp(N[fb], (k + 1) / seg).normalize();
        tri(P(a, n0), n0, P(b, n0), n0, P(b, n1), n1);
        tri(P(a, n0), n0, P(b, n1), n1, P(a, n1), n1);
      }
    }
  });
  // Ecken: Kugeldreieck zwischen den drei Flächennormalen
  V.forEach((_, vi) => {
    const [a, b, c] = facesOf[vi].map((fi) => N[fi]);
    const dir = (i, j) => a.clone().multiplyScalar(seg - i - j).addScaledVector(b, i).addScaledVector(c, j).normalize();
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < seg - i; j++) {
        const n00 = dir(i, j);
        const n10 = dir(i + 1, j);
        const n01 = dir(i, j + 1);
        tri(P(vi, n00), n00, P(vi, n10), n10, P(vi, n01), n01);
        if (i + j < seg - 1) {
          const n11 = dir(i + 1, j + 1);
          tri(P(vi, n10), n10, P(vi, n11), n11, P(vi, n01), n01);
        }
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/**
 * Linsenkopf-Schraube mit Schlitz (Achse +Z, Auflage bei z = 0).
 * Kuppel als Kugelkappe, Schlitz mit Boden und Wänden ausmodelliert.
 */
function slottedScrewHead(R = 4.9, H = 3.3, w = 1.5, depth = 1.6, skirt = 0.5) {
  const pos = [];
  const nor = [];
  const Rs = (R * R + H * H) / (2 * H);
  const hAt = (x, y) => Math.sqrt(Math.max(0, Rs * Rs - x * x - y * y)) - (Rs - H) + skirt;
  const nAt = (x, y) => {
    const z = Math.sqrt(Math.max(1e-6, Rs * Rs - x * x - y * y));
    return [x / Rs, y / Rs, z / Rs];
  };
  const quad = (a, b, c, d, na, nb, nc, nd) => {
    for (const [p, n] of [[a, na], [b, nb], [c, nc], [a, na], [c, nc], [d, nd]]) {
      pos.push(...p);
      nor.push(...n);
    }
  };
  const nx = 20;
  const ny = 9;
  const hw = w / 2;
  for (const side of [1, -1]) {
    // Kuppelhälfte
    for (let j = 0; j < ny; j++) {
      const y0 = hw + (R - hw) * Math.sin((Math.PI / 2) * (j / ny));
      const y1 = hw + (R - hw) * Math.sin((Math.PI / 2) * ((j + 1) / ny));
      const xm0 = Math.sqrt(Math.max(0, R * R - y0 * y0));
      const xm1 = Math.sqrt(Math.max(0, R * R - y1 * y1));
      for (let i = 0; i < nx; i++) {
        const t0 = -1 + (2 * i) / nx;
        const t1 = -1 + (2 * (i + 1)) / nx;
        const A = [t0 * xm0, side * y0];
        const B = [t1 * xm0, side * y0];
        const Cc = [t1 * xm1, side * y1];
        const Dd = [t0 * xm1, side * y1];
        const pt = ([x, y]) => [x, y, hAt(x, y)];
        if (side > 0) quad(pt(A), pt(B), pt(Cc), pt(Dd), nAt(...A), nAt(...B), nAt(...Cc), nAt(...Dd));
        else quad(pt(B), pt(A), pt(Dd), pt(Cc), nAt(...B), nAt(...A), nAt(...Dd), nAt(...Cc));
      }
    }
    // Schlitzwand
    const xm = Math.sqrt(R * R - hw * hw);
    const floor = (x) => Math.min(H - depth + skirt, hAt(x, hw));
    for (let i = 0; i < nx; i++) {
      const x0 = -xm + (2 * xm * i) / nx;
      const x1 = -xm + (2 * xm * (i + 1)) / nx;
      const n = [0, -side, 0];
      const a = [x0, side * hw, floor(x0)];
      const b = [x1, side * hw, floor(x1)];
      const c = [x1, side * hw, hAt(x1, hw)];
      const d = [x0, side * hw, hAt(x0, hw)];
      if (side > 0) quad(b, a, d, c, n, n, n, n);
      else quad(a, b, c, d, n, n, n, n);
    }
  }
  // Schlitzboden
  {
    const xm = Math.sqrt(R * R - hw * hw);
    const floor = (x) => Math.min(H - depth + skirt, hAt(x, hw));
    const n = [0, 0, 1];
    for (let i = 0; i < nx; i++) {
      const x0 = -xm + (2 * xm * i) / nx;
      const x1 = -xm + (2 * xm * (i + 1)) / nx;
      quad([x0, -hw, floor(x0)], [x1, -hw, floor(x1)], [x1, hw, floor(x1)], [x0, hw, floor(x0)], n, n, n, n);
    }
  }
  // Rand (Auflage)
  const ns = 32;
  for (let i = 0; i < ns; i++) {
    const a0 = (i / ns) * Math.PI * 2;
    const a1 = ((i + 1) / ns) * Math.PI * 2;
    const p0 = [Math.cos(a0) * R, Math.sin(a0) * R];
    const p1 = [Math.cos(a1) * R, Math.sin(a1) * R];
    const n0 = [Math.cos(a0), Math.sin(a0), 0];
    const n1 = [Math.cos(a1), Math.sin(a1), 0];
    quad([...p0, 0], [...p1, 0], [...p1, skirt], [...p0, skirt], n0, n1, n1, n0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/** Fügt nicht-indizierte Geometrien (position, normal, uv) zu einer zusammen. */
function mergeGeos(...geos) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const size = name === 'uv' ? 2 : 3;
    const total = geos.reduce((n, g) => n + g.attributes[name].count, 0);
    const arr = new Float32Array(total * size);
    let o = 0;
    for (const g of geos) {
      arr.set(g.attributes[name].array, o);
      o += g.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

// Holz-UVs in echter Größe: eine Texturkachel = 160 mm quer × 400 mm längs zur Faser
const WOOD_U = 160;
const WOOD_V = 400;

/**
 * Holz-UVs für kantige Teile: V läuft entlang der Faserachse (`along`: 0 = X, 1 = Y, 2 = Z),
 * U quer dazu – je Fläche aus der Koordinate, die in der Fläche liegt.
 */
function woodBoxUV(geom, along, offset = [0, 0]) {
  if (!geom.attributes.normal) geom.computeVertexNormals();
  const pos = geom.attributes.position;
  const nor = geom.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const B = (along + 1) % 3;
  const C = (along + 2) % 3;
  const p = [0, 0, 0];
  const n = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    p[0] = pos.getX(i);
    p[1] = pos.getY(i);
    p[2] = pos.getZ(i);
    n[0] = Math.abs(nor.getX(i));
    n[1] = Math.abs(nor.getY(i));
    n[2] = Math.abs(nor.getZ(i));
    let u;
    let v;
    if (n[along] > n[B] && n[along] > n[C]) {
      // Hirnholz (Stirnfläche)
      u = p[B] / WOOD_U;
      v = p[C] / WOOD_V;
    } else {
      v = p[along] / WOOD_V;
      u = (n[B] > n[C] ? p[C] : p[B]) / WOOD_U;
    }
    uv[i * 2] = u + offset[0];
    uv[i * 2 + 1] = v + offset[1];
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geom;
}

/**
 * Holz-UVs für gedrehte Teile (Achse Z): U läuft einmal um den Umfang, V entlang der Achse.
 * Erwartet nicht-indizierte Geometrie (z. B. ExtrudeGeometry).
 */
function woodCylUV(geom, offset = [0, 0]) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 3) {
    const us = [0, 1, 2].map((k) => Math.atan2(pos.getY(i + k), pos.getX(i + k)) / (Math.PI * 2) + 0.5);
    // Dreiecke über der Naht zusammenhalten
    const max = Math.max(...us);
    for (let k = 0; k < 3; k++) {
      const u = max - us[k] > 0.5 ? us[k] + 1 : us[k];
      uv[(i + k) * 2] = u + offset[0];
      uv[(i + k) * 2 + 1] = pos.getZ(i + k) / WOOD_V + offset[1];
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Vertauscht U und V (Maserung um 90° drehen). */
function swapUV(geom) {
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
  uv.needsUpdate = true;
  return geom;
}


// gestanzte Bleche: Schlitze per Alpha ausgeschnitten, werfen Schatten in den Innenraum
const GRATE = { alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide };

export function buildMachine(mm) {
  const root = new THREE.Group();
  root.name = 'LineaMiniR';
  const pickables = [];
  // Montagegruppe je Bauteil (für die Abschluss-Animation "Konfiguration abschließen")
  let stage = 'base';
  const rootAdd = root.add.bind(root);
  root.add = (...objs) => {
    for (const o of objs) if (!o.userData.stage) o.userData.stage = stage;
    return rootAdd(...objs);
  };

  const add = (geom, material, slot, parent = root) => {
    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (slot) {
      mesh.userData.slot = slot;
      pickables.push(mesh);
    }
    parent.add(mesh);
    return mesh;
  };
  const plain = (geom, material, parent = root) => {
    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const body = {
    upper: mm.get('body.upper'),
    head: mm.get('body.head'),
    lower: mm.get('body.lower'),
    base: mm.get('body.base'),
  };
  const F = mm.fixed;
  const trays = {};
  let rearLogo = null;
  const logoTex = makeLogoTexture('LA MARZOCCO');
  // erhabener Schriftzug: mehrere Lagen übereinander ergeben 1,2 mm Materialstärke
  // die Buchstabenform kommt aus einer Maske (alphaMap); so kann der Schriftzug auch aus Holz sein
  const logoMat = mm.get('metal.logo', { alphaMap: logoTex, alphaTest: 0.4, alphaToCoverage: true });
  logoMat.userData.logo = { w: 150, h: 18.75 };
  const logoGeo = new THREE.PlaneGeometry(150, 18.75);
  const makeLogo = () => {
    const grp = new THREE.Group();
    // sechs Lagen = ca. 2,5 mm starke Buchstaben
    for (let i = 0; i < 6; i++) add(logoGeo, logoMat, 'metal.logo', grp).position.z = 0.25 + i * 0.45;
    root.add(grp);
    return grp;
  };

  // Rückseite des Oberkorpus: schräge Ebene von (rearTop, top) nach (rearBot, slabBotRear)
  const rearZAt = (y) => M.rearTop + ((M.top - y) / (M.top - M.slabBotRear)) * (M.rearBot - M.rearTop);

  stage = 'upper';
  // =========================================================================
  // Oberteil: Seitenwangen, Korpus, Reling, Tassenablage
  // =========================================================================
  const slabProfile = [
    [0, M.slabBotFront],
    [0, M.top],
    [M.rearTop, M.top],
    [M.rearBot, M.slabBotRear],
  ];
  for (const side of [-1, 1]) {
    const g = boxProjectUV(profileExtrudeX(slabProfile, M.slabT, 1.4));
    const mesh = add(g, body.upper, 'body.upper');
    mesh.position.x = side < 0 ? -M.halfW : M.inner;
  }
  {
    const coreProfile = [
      [-1, M.slabBotFront + 2],
      [-1, M.tray - 8],
      [rearZAt(M.tray - 8), M.tray - 8],
      [M.rearBot + 1, M.slabBotRear],
    ];
    const g = boxProjectUV(profileExtrudeX(coreProfile, M.inner * 2));
    add(g, body.upper, 'body.upper').position.x = -M.inner;
  }
  {
    // Reling vorne/hinten reicht bis zum abgesenkten Boden der Tassenablage (kein Spalt)
    const railBot = M.tray - 9;
    const g = boxProjectUV(rbox(M.inner * 2, M.top - railBot, 9, 1.5, 2));
    add(g, body.upper, 'body.upper').position.set(0, (M.top + railBot) / 2 - 0.5, -5.5);
    const back = boxProjectUV(
      profileExtrudeX(
        [
          [-328, railBot],
          [-328, M.top - 0.5],
          [M.rearTop + 0.6, M.top - 0.5],
          [rearZAt(railBot) + 0.6, railBot],
        ],
        M.inner * 2,
      ),
    );
    add(back, body.upper, 'body.upper').position.x = -M.inner;
  }
  stage = 'tray';
  {
    // gelochtes Blech über dunklem Innenraum: Schlitze sind echte Öffnungen
    const w = M.inner * 2 - 1;
    const d = 317;
    const zc = -10 - d / 2;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), F.trayInner);
    plate.position.set(0, M.tray - 7.4, zc);
    plate.receiveShadow = true;
    root.add(plate);
    const mat = mm.get('metal.grates', { map: makeCupTrayTexture(w, d), ...GRATE });
    trays.cup = { mat, tex: { slots: mat.userData.baseMap }, make: (st) => makeCupTrayTexture(w, d, st) };
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    add(g, mat, 'metal.grates').position.set(0, M.tray + 0.6, zc);
  }
  stage = 'logo';
  // Schriftzug auf der schrägen Rückwand (laut Rückansicht oben, zur +X-Seite versetzt)
  {
    const yc = 319.5;
    // Normale der Rückwand zeigt nach hinten und leicht nach unten
    const tilt = -Math.atan2(M.rearBot - M.rearTop, M.top - M.slabBotRear);
    rearLogo = makeLogo();
    rearLogo.rotation.set(tilt, Math.PI, 0, 'XYZ');
    rearLogo.position.set(78, yc, rearZAt(yc) - 0.2);
  }

  stage = 'head';
  // =========================================================================
  // Kopfteil (Frontbox mit Paddle, Drehknöpfen und Shot-Timer-Display)
  // =========================================================================
  const headH = M.headTop - M.headBot;
  {
    const g = boxProjectUV(rbox(M.headHalfW * 2, headH, M.headFront, 4, 4));
    add(g, body.head, 'body.head').position.set(0, (M.headTop + M.headBot) / 2, M.headFront / 2);
  }
  {
    const disp = new THREE.Mesh(rbox(32, 22, 2, 0.8, 2), F.displayGlass);
    disp.position.set(0, 344.7, M.headFront + 0.4);
    root.add(disp);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(27, 15),
      new THREE.MeshBasicMaterial({ map: makeDisplayTexture(), transparent: true, opacity: 0.85, toneMapped: false }),
    );
    screen.position.set(0, 344.7, M.headFront + 1.45);
    root.add(screen);
  }

  // Drehknöpfe: Hülse + Holzkörper (Form wählbar) + vertiefte Kappe (ragen ca. 60 mm vor)
  const ringShape = (R, fn, n = 192) => {
    const sh = new THREE.Shape();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = fn(a, R);
      if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return sh;
  };
  const knobShapes = {
    // gewellt: 16 weiche Wellen
    wave: ringShape(22.5, (a, R) => R - 1.2 * (0.5 - 0.5 * Math.cos(a * 16))),
    // gerillt (rb.crafts): zehn runde Längsnuten – nur im hinteren Teil, vorn glatter Zylinder
    groove: ringShape(22.5, (a, R) => {
      const k = (((a / (Math.PI * 2)) * 10) % 1 + 1) % 1;
      const d = Math.abs(k - 0.5) / 0.16;
      return d < 1 ? R - 2.6 * Math.sqrt(1 - d * d) : R;
    }, 480),
    // facettiert: Achteck
    facet: (() => {
      const sh = new THREE.Shape();
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const r = 23.5;
        if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      return sh;
    })(),
  };
  const knobGeos = Object.fromEntries(
    Object.entries(knobShapes).map(([id, sh]) => [id, woodCylUV(extrudeZ(sh, 42, 2.6, 3, 4), [0.13, 0.31])]),
  );
  {
    // rb.crafts-Knopf: genuteter Abschnitt hinten (ca. 28 mm) + glatter Zylinder vorn
    const rear = woodCylUV(extrudeZ(knobShapes.groove, 25, 1.3, 2, 4), [0.13, 0.31]);
    const front = woodCylUV(extrudeZ(ringShape(22.5, (a, R) => R, 96), 15, 2.6, 3, 4), [0.13, 0.31]);
    front.translate(0, 0, 27);
    // V der vorderen Hälfte passend zur Position verschieben (durchgehende Maserung)
    const fuv = front.attributes.uv;
    for (let i = 0; i < fuv.count; i++) fuv.setY(i, fuv.getY(i) + 27 / WOOD_V);
    knobGeos.groove = mergeGeos(rear, front);
  }
  knobGeos.wave.computeBoundingBox();
  const knobLen = knobGeos.wave.boundingBox.max.z;
  const knobMat = mm.get('wood.knobs');
  const capMat = mm.get('metal.caps');
  const knobY = 308;
  const knobZ0 = M.headFront + 11;
  const knobVariants = { wave: [], groove: [], facet: [] };
  for (const x of [-115, 115]) {
    const collarG = new THREE.CylinderGeometry(14.5, 15.5, 12, 40);
    collarG.rotateX(Math.PI / 2);
    stage = 'head';
    plain(collarG, F.blackPlastic).position.set(x, knobY, M.headFront + 6);
    stage = 'knobs';
    for (const [id, g] of Object.entries(knobGeos)) {
      const k = add(g, knobMat, 'wood.knobs');
      k.position.set(x, knobY, knobZ0);
      k.visible = id === 'wave';
      knobVariants[id].push(k);
    }
    // Kappe: leicht gewölbte Linse mit Fase und umlaufender Rille (spiegelt dadurch lebendig)
    const capG = new THREE.LatheGeometry(
      [
        [17, -1.2],
        [17, 0.9],
        [16.5, 1.5],
        [15.6, 1.75],
        [15.1, 1.35],
        [14.5, 1.75],
        [10, 2.25],
        [5, 2.5],
        [0, 2.6],
      ].map(([r, z]) => new THREE.Vector2(r, z)),
      72,
    );
    capG.rotateX(Math.PI / 2);
    add(capG, capMat, 'metal.caps').position.set(x, knobY, knobZ0 + knobLen + 0.2);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(1.6, 11, 0.6), F.darkGap);
    mark.position.set(x, knobY + 8, knobZ0 + knobLen + 2.5);
    root.add(mark);
  }

  stage = 'paddle';
  // Paddle: Holzabdeckung mit Schlitz + Hebel (rechts = Ruhestellung)
  const paddleMat = mm.get('wood.paddle');
  {
    // Brühgruppenabdeckung: langgestrecktes Sechseck mit gekappten Spitzen und breiter Fase
    const s = new THREE.Shape();
    s.moveTo(-60, 317);
    s.lineTo(60, 317);
    s.lineTo(85, 308);
    s.lineTo(85, 292);
    s.lineTo(60, 283);
    s.lineTo(-60, 283);
    s.lineTo(-85, 292);
    s.lineTo(-85, 308);
    s.closePath();
    const g = woodBoxUV(extrudeZ(s, 10, 4.5, 1, 4), 0, [0.42, 0.52]);
    g.computeBoundingBox();
    const front = g.boundingBox.max.z;
    add(g, paddleMat, 'wood.paddle').position.z = M.headFront;
    const slot = new THREE.Mesh(rbox(104, 5, 2, 1.2, 2), F.darkGap);
    slot.position.set(-4, 300, M.headFront + front - 0.4);
    root.add(slot);
    for (const x of [-76, 76]) {
      const stud = new THREE.Mesh(rbox(9, 11, 3, 1.5, 2), F.blackPlastic);
      stud.position.set(x, 300, M.headFront + front - 0.6);
      root.add(stud);
    }
    // Paddle: Winkel aus Holz – oben vom Drehpunkt nach vorn, vorn als Platte nach unten
    const zc = M.headFront + front;
    const hook = profileExtrudeX(
      [
        [zc - 2, 324],
        [zc + 27, 328],
        [zc + 35, 321],
        [zc + 33, 281],
        [zc + 23, 279],
        [zc + 23, 311],
        [zc - 2, 310],
      ],
      40,
      1.6,
    );
    add(woodBoxUV(hook, 1, [0.71, 0.12]), paddleMat, 'wood.paddle').position.x = 28;
  }

  stage = 'head';
  // Barista-Licht: LED-Leiste an der Unterseite des Kopfteils + Spot auf die Tropfschale
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x1c1c1c, toneMapped: false });
  {
    const led = new THREE.Mesh(rbox(120, 1.4, 3.6, 0.6, 1), ledMat);
    led.position.set(0, M.headBot - 0.5, 125.5);
    root.add(led);
  }
  const baristaSpot = new THREE.SpotLight(0xfff0d8, 0, 0, 0.82, 0.85, 2);
  baristaSpot.position.set(0, M.headBot - 3, 124);
  baristaSpot.target.position.set(0, M.baseTop, 110);
  root.add(baristaSpot, baristaSpot.target);

  stage = 'lower';
  // =========================================================================
  // Unterteil (trapezförmig, verjüngt nach unten und hinten)
  // =========================================================================
  {
    const zf = -0.5;
    const bot = M.baseTop;
    const topF = M.headBot;
    const topR = 262;
    const hwB = 135.5;
    const slope = 24 / 140.4; // Verjüngung laut Front-/Rückansicht
    const hwT = hwB + (topF - bot) * slope;
    const hwTR = hwB + (topR - bot) * slope;
    const zRB = -288;
    const zRT = zRB - (topR - bot) * (21 / 149.4);
    const fbl = [-hwB, bot, zf];
    const fbr = [hwB, bot, zf];
    const ftl = [-hwT, topF, zf];
    const ftr = [hwT, topF, zf];
    const rbl = [-hwB, bot, zRB];
    const rbr = [hwB, bot, zRB];
    const rtl = [-hwTR, topR, zRT];
    const rtr = [hwTR, topR, zRT];
    // gekantetes Blech: Kanten mit kleinem Radius statt messerscharf
    const g = roundedPolyhedron(
      [fbl, fbr, ftr, ftl, rbl, rbr, rtr, rtl],
      [
        [0, 1, 2, 3],
        [5, 4, 7, 6],
        [4, 0, 3, 7],
        [1, 5, 6, 2],
        [3, 2, 6, 7],
        [4, 5, 1, 0],
      ],
      2.4,
      4,
    );
    boxProjectUV(g);
    add(g, body.lower, 'body.lower');
  }

  stage = 'gauges';
  // Manometer (zwei gleich große, laut Frontansicht): Ring, Gehäuse, Zifferblatt
  // oder offenes Messwerk ("Naked"), Zeiger als eigenes Teil, Glas
  const gaugeMat = mm.get('metal.gauges');
  const gauges = {};
  const dialTextures = new Map();
  const dialTex = (spec, dial) => {
    const key = `${spec.id}:${dial}`;
    if (!dialTextures.has(key)) dialTextures.set(key, makeGaugeTexture(spec, dial));
    return dialTextures.get(key);
  };
  const makeGauge = (id, x, y, R, spec) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, -0.5);
    root.add(grp);
    const Ri = R - 4.6; // Innenradius
    const pick = (mesh) => {
      mesh.userData.slot = 'metal.gauges';
      mesh.userData.gauge = id;
      pickables.push(mesh);
      return mesh;
    };
    // Ring (Lünette)
    // Profil außen unten beginnend (so zeigen die Flächen nach außen)
    const prof = [
      [R, 0],
      [R, 6.4],
      [R - 0.5, 7.7],
      [R - 1.6, 8.4],
      [Ri + 1.6, 8.5],
      [Ri + 0.5, 7.9],
      [Ri, 7.0],
      [Ri, 2.4],
    ].map(([r, z]) => new THREE.Vector2(r, z));
    const ring = new THREE.LatheGeometry(prof, 72);
    ring.rotateX(Math.PI / 2);
    add(ring, gaugeMat, 'metal.gauges', grp).userData.gauge = id;
    // Gehäuseboden (schwarz)
    const back = plain(new THREE.CircleGeometry(Ri, 48), F.gaugeCase, grp);
    back.position.z = 2.2;
    pick(back);
    // Zifferblatt
    const faceMat = new THREE.MeshStandardMaterial({ map: dialTex(spec, 'white'), roughness: 0.55, alphaTest: 0.5, alphaToCoverage: true });
    const face = plain(new THREE.CircleGeometry(Ri - 0.1, 64), faceMat, grp);
    face.position.z = 5.2;
    face.castShadow = false;
    pick(face);

    // offenes Messwerk (nur bei "Naked" sichtbar)
    const works = new THREE.Group();
    works.visible = false;
    grp.add(works);
    {
      const z0 = 2.3;
      // Rohrfeder (Bourdon-Rohr): C-förmiges Messingrohr am Rand
      const tube = plain(new THREE.TorusGeometry(Ri * 0.84, 1.15, 12, 72, Math.PI * 1.5), F.brassPolished, works);
      tube.rotation.z = Math.PI * 1.36;
      tube.position.z = z0 + 1.6;
      // Anschlussblock unten
      plain(rbox(8.5, 6, 3.6, 0.6, 1), F.brassPolished, works).position.set(0, -Ri * 0.66, z0 + 1.8);
      // Werkplatine: zwei Lappen mit Bohrung
      const sh = new THREE.Shape();
      sh.moveTo(-9.5, 2);
      sh.quadraticCurveTo(-11.5, 2, -11.5, 4.2);
      sh.quadraticCurveTo(-11.5, 7, -8.5, 7);
      sh.lineTo(-4, 5.2);
      sh.lineTo(4, 5.2);
      sh.lineTo(8.5, 7);
      sh.quadraticCurveTo(11.5, 7, 11.5, 4.2);
      sh.quadraticCurveTo(11.5, 2, 9.5, 2);
      sh.lineTo(5.4, -5.5);
      sh.lineTo(-5.4, -5.5);
      sh.closePath();
      for (const hx of [-8.6, 8.6]) {
        const h = new THREE.Path();
        h.absarc(hx, 4.4, 1.3, 0, Math.PI * 2, true);
        sh.holes.push(h);
      }
      const plate = plain(new THREE.ExtrudeGeometry(sh, { depth: 1.1, bevelEnabled: false, curveSegments: 12 }), F.brassPolished, works);
      plate.position.set(0, -1.2, z0 + 2.2);
      // Pfeiler unter der Platine
      for (const px of [-8.6, 8.6]) {
        const post = new THREE.CylinderGeometry(1.5, 1.5, 2.2, 16);
        post.rotateX(Math.PI / 2);
        plain(post, F.brassPolished, works).position.set(px, 3.2, z0 + 1.1);
      }
      // zwei schwarze Schrauben auf der Platine
      for (const px of [-2.6, 2.6]) {
        const sc = new THREE.CylinderGeometry(1.35, 1.35, 0.9, 16);
        sc.rotateX(Math.PI / 2);
        plain(sc, F.blackPlastic, works).position.set(px, -4.2, z0 + 3.7);
      }
      // Zugstange vom Rohrende zum Werk
      const link = plain(new THREE.TorusGeometry(5.4, 0.55, 8, 24, Math.PI * 0.95), F.brassPolished, works);
      link.position.set(8.2, -3.2, z0 + 2.9);
      link.rotation.z = -Math.PI * 0.42;
      // Zahnsegment
      const sector = plain(new THREE.CircleGeometry(4.2, 16, Math.PI * 1.1, Math.PI * 0.55), F.brassPolished, works);
      sector.position.set(0.8, 0.6, z0 + 3.45);
    }

    // Zeiger: schlanke Nadel mit Gegengewicht und Nabe
    const needleMat = new THREE.MeshStandardMaterial({ color: 0xc2231d, roughness: 0.5 });
    const needle = new THREE.Group();
    needle.position.z = 6.1;
    grp.add(needle);
    {
      const L = Ri * 0.84;
      const ns = new THREE.Shape();
      ns.moveTo(-6.5, -0.9);
      ns.lineTo(-6.5, 0.9);
      ns.lineTo(0, 0.85);
      ns.lineTo(L, 0.22);
      ns.lineTo(L, -0.22);
      ns.lineTo(0, -0.85);
      ns.closePath();
      plain(new THREE.ExtrudeGeometry(ns, { depth: 0.45, bevelEnabled: false }), needleMat, needle);
      const hub = new THREE.CylinderGeometry(2.7, 2.9, 1.3, 28);
      hub.rotateX(Math.PI / 2);
      plain(hub, needleMat, needle).position.z = 0.6;
    }
    // Canvas-Winkel (y nach unten) -> mathematischer Winkel
    needle.rotation.z = -gaugeAngle(spec.value, spec.max);

    // Glas
    const glass = new THREE.Mesh(new THREE.CircleGeometry(Ri + 0.3, 64), F.glass);
    glass.position.z = 7.6;
    grp.add(glass);
    pick(glass);
    gauges[id] = { spec, faceMat, works, needleMat, dial: 'white' };
  };
  makeGauge('left', -117.6, 175.6, 22, { id: 'brew', max: 16, step: 1, label: 4, value: 10, unit: 'bar', zone: [8, 10] });
  makeGauge('right', 117.6, 175.6, 22, { id: 'steam', max: 3, step: 0.5, label: 1, value: 1.3, unit: 'bar', zone: [1, 1.5] });

  stage = 'groupcap';
  // =========================================================================
  // Brühgruppen-Kappe, Siebträger (zweiteilig), Heißwasser, Dampflanze
  // =========================================================================
  const gZ = M.groupZ;
  {
    const groupMat = mm.get('metal.group');
    add(new THREE.CylinderGeometry(55, 55, 11.5, 72), groupMat, 'metal.group').position.set(0, M.headBot - 5.75, gZ);
    add(new THREE.CylinderGeometry(46, 47.5, 7.5, 64), groupMat, 'metal.group').position.set(0, 234.75, gZ);
    const gasket = new THREE.Mesh(new THREE.CylinderGeometry(38.5, 38.5, 1.5, 48), F.gasket);
    gasket.position.set(0, 230.4, gZ);
    root.add(gasket);
  }
  stage = 'portafilter';
  const pfMat = mm.get('metal.portafilter');
  const handleVariants = {};
  {
    const pf = new THREE.Group();
    pf.position.set(0, 0, gZ);
    root.add(pf);
    add(new THREE.CylinderGeometry(36.5, 36, 13, 64), pfMat, 'metal.portafilter', pf).position.y = 223.5;
    for (const sx of [-1, 1]) {
      add(rbox(10, 7, 18, 2, 2), pfMat, 'metal.portafilter', pf).position.set(sx * 39, 226, 0);
    }
    const bowl = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 201),
        new THREE.Vector2(18, 201.5),
        new THREE.Vector2(28, 204),
        new THREE.Vector2(33, 210),
        new THREE.Vector2(35, 217),
      ],
      64,
    );
    add(bowl, pfMat, 'metal.portafilter', pf);
    add(new THREE.CylinderGeometry(8, 9, 9, 32), pfMat, 'metal.portafilter', pf).position.y = 197;
    for (const sx of [-1, 1]) {
      const sp = add(new THREE.CylinderGeometry(3, 3.4, 11, 20), pfMat, 'metal.portafilter', pf);
      sp.position.set(sx * 6.5, 188, 0);
      sp.rotation.z = sx * 0.28;
    }
    const handle = new THREE.Group();
    handle.position.set(0, 223, 0);
    handle.rotation.x = -0.07;
    pf.add(handle);
    const neck = new THREE.CylinderGeometry(7.5, 8.5, 22, 32);
    neck.rotateX(Math.PI / 2);
    add(neck, pfMat, 'metal.portafilter', handle).position.z = 45;
    // ergonomischer Griff (ca. 95 mm), Spitze bei Z ≈ 215
    const hprof = [
      [0, 0],
      [9.4, 0],
      [10, 4],
      [11, 15],
      [12.6, 32],
      [13.4, 44],
      [13, 52],
      [14.2, 64],
      [15.4, 76],
      [15.4, 84],
      [13.6, 90],
      [9.6, 94],
      [4, 96],
      [0, 96.4],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const handleMat = mm.get('wood.handle');
    // rb.crafts-Griff: achtkantig, gerade nach hinten dicker werdend, Ende gefast
    const rbprof = [
      [0, 0],
      [9.8, 0],
      [10.4, 3],
      [16.4, 86],
      [16.4, 90],
      [13, 96],
      [0, 96.4],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const makeHandle = (segments, flat) => {
      let g = new THREE.LatheGeometry(flat ? rbprof : hprof, segments, Math.PI / segments);
      const uv = g.attributes.uv;
      // U einmal um den Umfang (nahtlos), V entlang des Griffs in echter Länge
      const hp = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.37, hp.getY(i) / WOOD_V + 0.66);
      if (flat) {
        g = g.toNonIndexed();
        g.computeVertexNormals();
      }
      g.rotateX(Math.PI / 2);
      const mesh = add(g, handleMat, 'wood.handle', handle);
      mesh.position.z = 54;
      return mesh;
    };
    handleVariants.round = makeHandle(48, false);
    handleVariants.facet = makeHandle(8, true);
    handleVariants.facet.visible = false;
  }

  stage = 'wand';
  const wandMat = mm.get('metal.wand');
  {
    add(new THREE.CylinderGeometry(11, 11, 17, 40), wandMat, 'metal.wand').position.set(-98, M.headBot - 8.5, 95);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6, 4, 24), F.darkGap);
    tip.position.set(-98, M.headBot - 19, 95);
    root.add(tip);
  }
  {
    // isolierte Cool-Touch-Dampflanze (Ø 12 mm), Verlauf laut Seitenansicht
    const pts = [
      [97, 250, 89],
      [97, 238, 89.5],
      [97, 226, 93],
      [97, 218, 104],
      [97, 214.5, 122],
      [97, 213, 140],
      [97, 209, 152],
      [97, 200, 159],
      [97, 180, 166],
      [97, 150, 175],
      [97, 134, 179.8],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    add(new THREE.TubeGeometry(curve, 120, 6, 24, false), wandMat, 'metal.wand');
    add(new THREE.SphereGeometry(10, 32, 16), wandMat, 'metal.wand').position.set(97, 247, 89);
    add(new THREE.CylinderGeometry(11, 11, 6, 6), wandMat, 'metal.wand').position.set(97, M.headBot - 2, 89);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6, 16, 24), F.blackPlastic);
    tip.position.set(97, 127, 182);
    tip.rotation.x = -0.29;
    root.add(tip);
  }

  stage = 'base';
  // =========================================================================
  // Basis, Tropfschale, Bodenwanne, Füße, Schalter
  // =========================================================================
  {
    const h = M.baseTop - M.footH;
    const g = boxProjectUV(rbox(M.baseHalfW * 2, h, M.baseFront - M.baseRear, 3, 3));
    add(g, body.base, 'body.base').position.set(0, M.footH + h / 2, (M.baseFront + M.baseRear) / 2);

    stage = 'drip';
    // Tropfschale: Kasten in Gehäusefarbe, oben Edelstahlrahmen mit Gitter
    const dz0 = M.baseFront + 1.5;
    const boxH = M.dripLipBot - M.footH - 0.5;
    const dg = boxProjectUV(rbox(M.dripHalfW * 2 - 3, boxH, M.dripFront - 1.5 - dz0, 3, 3));
    add(dg, body.base, 'body.base').position.set(0, M.footH + 0.5 + boxH / 2, (M.dripFront - 1.5 + dz0) / 2);

    const lipH = M.baseTop - 1.6 - M.dripLipBot;
    const outer = new THREE.Shape();
    outer.moveTo(-M.dripHalfW, -M.dripFront);
    outer.lineTo(M.dripHalfW, -M.dripFront);
    outer.lineTo(M.dripHalfW, -dz0);
    outer.lineTo(-M.dripHalfW, -dz0);
    outer.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-M.dripHalfW + 9, -M.dripFront + 9);
    hole.lineTo(-M.dripHalfW + 9, -dz0 - 8);
    hole.lineTo(M.dripHalfW - 9, -dz0 - 8);
    hole.lineTo(M.dripHalfW - 9, -M.dripFront + 9);
    hole.closePath();
    outer.holes.push(hole);
    const rimG = new THREE.ExtrudeGeometry(outer, {
      depth: lipH - 1.2,
      bevelEnabled: true,
      bevelThickness: 0.6,
      bevelSize: 0.6,
      bevelSegments: 2,
    });
    rimG.rotateX(-Math.PI / 2);
    boxProjectUV(rimG);
    add(rimG, mm.get('metal.grates'), 'metal.grates').position.y = M.dripLipBot + 0.6;
    const gw = M.dripHalfW * 2 - 18;
    const gd = M.dripFront - 9 - (dz0 + 8);
    const gMat = mm.get('metal.grates', { map: makeDripGrateTexture(gw, gd), ...GRATE });
    trays.drip = { mat: gMat, tex: { slots: gMat.userData.baseMap }, make: (st) => makeDripGrateTexture(gw, gd, st) };
    const gg = new THREE.PlaneGeometry(gw, gd);
    gg.rotateX(-Math.PI / 2);
    const grate = add(gg, gMat, 'metal.grates');
    grate.position.set(0, M.dripLipBot + lipH - 2.5, (M.dripFront - 9 + dz0 + 8) / 2);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(gw, 1, gd), F.trayInner);
    inner.position.set(0, M.dripLipBot + 0.7, grate.position.z);
    inner.receiveShadow = true;
    root.add(inner);

    makeLogo().position.set(74, 57, M.dripFront - 1.3);

    stage = 'chassis';
    // Edelstahl-Bodenwanne unter der Basis (in Seiten- und Frontansicht sichtbar)
    const pan = boxProjectUV(rbox(240, M.footH - 5, 191, 2, 2));
    plain(pan, F.steel).position.set(0, 5 + (M.footH - 5) / 2, 2 - 191 / 2);
    // Wasseranschlüsse hinten unten (Rückansicht)
    for (const x of [-67, -86]) {
      const c = new THREE.CylinderGeometry(4.5, 4.5, 9, 20);
      plain(c, F.blackPlastic).position.set(x, M.footH - 6, -282);
    }
  }
  {
    // Füße: konisch (Ø 20 mm oben, Ø 35 mm unten), lackier- oder veredelbar + Gummipuffer
    const feetMat = mm.get('metal.feet');
    const g = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 2),
        new THREE.Vector2(17, 2),
        new THREE.Vector2(17.5, 3.2),
        new THREE.Vector2(14.5, 9),
        new THREE.Vector2(11.2, 17),
        new THREE.Vector2(10, M.footH - 1),
        new THREE.Vector2(10.5, M.footH),
        new THREE.Vector2(0, M.footH),
      ],
      48,
    );
    const pad = new THREE.CylinderGeometry(16, 16, 2, 40);
    for (const [x, z] of [
      [-132, 75.6],
      [132, 75.6],
      [-132, -270.6],
      [132, -270.6],
    ]) {
      // Fuß + Gummipuffer als Einheit (fallen in der Montage-Animation gemeinsam)
      const foot = new THREE.Group();
      foot.position.set(x, 0, z);
      root.add(foot);
      add(g, feetMat, 'metal.feet', foot);
      plain(pad, F.rubber, foot).position.y = 1;
    }
  }
  stage = 'base';
  {
    // Netzschalter rechts an der Basis, hinten
    const sx = M.baseHalfW;
    const housing = new THREE.Mesh(rbox(4, 25, 48, 1, 2), F.blackPlastic);
    housing.position.set(sx + 1, 60, -261);
    root.add(housing);
    const rocker = new THREE.Mesh(rbox(3, 18, 40, 1.4, 2), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.3 }));
    rocker.position.set(sx + 2.3, 60, -261);
    rocker.rotation.y = 0.05;
    root.add(rocker);
    const o = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.55, 8, 24), F.white);
    o.rotation.y = Math.PI / 2;
    o.position.set(sx + 4, 60, -252);
    root.add(o);
    const i = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 5.5), F.white);
    i.position.set(sx + 4, 60, -271);
    root.add(i);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 30),
      new THREE.MeshStandardMaterial({ map: makePlateTexture(), metalness: 0.6, roughness: 0.35 }),
    );
    plate.rotation.y = Math.PI / 2;
    plate.position.set(sx + 0.4, 60, -45);
    root.add(plate);
  }

  stage = 'rail';
  // =========================================================================
  // Cup Rail (Stangenreling auf Pfosten über den Seitenwangen und hinten)
  // =========================================================================
  // Bauform 1: Rundstab auf Pfosten
  const railGroup = new THREE.Group();
  railGroup.visible = false;
  root.add(railGroup);
  // Bauform 2 (rb.crafts): Rahmen aus hochkant stehendem Flachstahl mit schrägen Füßen vorn
  const railFlat = new THREE.Group();
  railFlat.visible = false;
  root.add(railFlat);
  {
    const railMat = mm.get('metal.rail');
    const rx = M.halfW - M.slabT / 2;
    const zA = -27; // vorderes Ende der Seitenstäbe
    const zR = -332;
    const hBar = 9;
    const tBar = 2.6;
    const yBar = M.top + 21;
    const bar = (w, h, d, x, y, z, rotX = 0) => {
      const m = add(rbox(w, h, d, 0.5, 1), railMat, 'metal.rail', railFlat);
      m.position.set(x, y, z);
      m.rotation.x = rotX;
      return m;
    };
    for (const sx of [-1, 1]) {
      bar(tBar, hBar, zA - zR, sx * rx, yBar, (zA + zR) / 2);
      // schräger Fuß vorn + Auflage
      const run = 20;
      const drop = yBar - (M.top + 4);
      bar(tBar, hBar, Math.hypot(run, drop) + 2, sx * rx, yBar - drop / 2, zA + run / 2, Math.atan2(drop, run));
      bar(tBar, 2.6, 9, sx * rx, M.top + 1.3, zA + run + 2);
      // Stütze hinten
      bar(tBar, yBar - M.top, hBar, sx * rx, (yBar + M.top) / 2, zR + 14);
    }
    bar(rx * 2 + tBar, hBar, tBar, 0, yBar, zR);
  }
  {
    const railMat = mm.get('metal.rail');
    const rx = M.halfW - M.slabT / 2;
    const zF = -22;
    const zR = -322;
    const yR = M.top + 15;
    const rodR = 2.8;
    const post = new THREE.CylinderGeometry(3.2, 3.6, 15, 24);
    for (const z of [zF, (zF + zR) / 2, zR]) {
      for (const sx of [-1, 1]) add(post, railMat, 'metal.rail', railGroup).position.set(sx * rx, M.top + 7.5, z);
    }
    const sideRod = new THREE.CylinderGeometry(rodR, rodR, zF - zR, 24);
    sideRod.rotateX(Math.PI / 2);
    for (const sx of [-1, 1]) {
      add(sideRod, railMat, 'metal.rail', railGroup).position.set(sx * rx, yR, (zF + zR) / 2);
      const cap = add(new THREE.SphereGeometry(rodR * 1.05, 20, 12), railMat, 'metal.rail', railGroup);
      cap.position.set(sx * rx, yR, zF);
      const corner = add(new THREE.SphereGeometry(rodR, 20, 12), railMat, 'metal.rail', railGroup);
      corner.position.set(sx * rx, yR, zR);
    }
    const backRod = new THREE.CylinderGeometry(rodR, rodR, rx * 2, 24);
    backRod.rotateZ(Math.PI / 2);
    add(backRod, railMat, 'metal.rail', railGroup).position.set(0, yR, zR);
  }

  stage = 'panels';
  // =========================================================================
  // Holzverkleidungen (optional): Seitenwangen oben, Seitenteile des Unterteils
  // =========================================================================
  const panelUpper = new THREE.Group();
  const panelLower = new THREE.Group();
  panelUpper.visible = false;
  panelLower.visible = false;
  root.add(panelUpper, panelLower);
  {
    const inset = 3;
    const t = 2.6;
    // Seitenwangen: Profil der Wange, leicht eingerückt, Maserung längs
    const prof = [
      [-inset, M.slabBotFront + inset],
      [-inset, M.top - inset],
      [M.rearTop + inset, M.top - inset],
      [M.rearBot + inset * 0.8, M.slabBotRear + inset],
    ];
    const g = woodBoxUV(profileExtrudeX(prof, t, 0.6), 2, [0.05, 0.02]);
    const mat = mm.get('wood.panelUpper');
    for (const sx of [-1, 1]) {
      add(g, mat, 'wood.panelUpper', panelUpper).position.x = sx < 0 ? -M.halfW - t + 0.01 : M.halfW - 0.01;
    }
    // Rückseite der Holzumrandung: Platte auf der schrägen Rückwand, verbindet beide Seiten
    {
      const dz = M.rearBot - M.rearTop;
      const dy = M.slabBotRear - M.top;
      const len = Math.hypot(dz, dy);
      const nz = dy / len; // Normale nach hinten/unten
      const ny = -dz / len;
      const yb = M.slabBotRear + inset;
      const yt = M.top - inset;
      const hw = M.halfW + t;
      const P = (x, y, k) => [x, y + ny * k, rearZAt(y) + nz * k];
      const a0 = P(-hw, yb, 0.05);
      const b0 = P(hw, yb, 0.05);
      const c0 = P(hw, yt, 0.05);
      const d0 = P(-hw, yt, 0.05);
      const a1 = P(-hw, yb, t);
      const b1 = P(hw, yb, t);
      const c1 = P(hw, yt, t);
      const d1 = P(-hw, yt, t);
      const back = polyhedron([
        [b1, a1, d1, c1],
        [a0, b0, c0, d0],
        [a0, a1, b1, b0],
        [d0, c0, c1, d1],
        [a0, d0, d1, a1],
        [b0, b1, c1, c0],
      ]);
      add(woodBoxUV(back, 0, [0.3, 0.55]), mat, 'wood.panelUpper', panelUpper);
    }
    // Unterteil: dünne Platte auf jeder schrägen Seitenfläche
    const matL = mm.get('wood.panelLower');
    const bot = M.baseTop + 4;
    const hwAt = (y) => 135.5 + (y - M.baseTop) * (24 / 140.4);
    const zFront = -inset - 0.5;
    const zRearAt = (y) => -288 - (y - M.baseTop) * (21 / 149.4) + inset;
    // Oberkante folgt der Unterkante des Oberkorpus, die nach hinten ansteigt
    // (235 mm vorn, 255 mm hinten): die ganze sichtbare Seitenfläche des Mittelteils ist bedeckt
    const slabBotAt = (z) => M.slabBotFront + ((M.slabBotRear - M.slabBotFront) * z) / M.rearBot;
    const topF = slabBotAt(zFront) - 1;
    let topR = M.slabBotRear - 1;
    for (let i = 0; i < 6; i++) topR = slabBotAt(zRearAt(topR)) - 1;
    for (const sx of [-1, 1]) {
      const p = (y, z) => [sx * (hwAt(y) + 0.2), y, z];
      const q = (y, z) => [sx * (hwAt(y) + 0.2 + t), y, z];
      const a = p(bot, zFront);
      const b = p(topF, zFront);
      const c = p(topR, zRearAt(topR));
      const d = p(bot, zRearAt(bot));
      const a2 = q(bot, zFront);
      const b2 = q(topF, zFront);
      const c2 = q(topR, zRearAt(topR));
      const d2 = q(bot, zRearAt(bot));
      const faces =
        sx > 0
          ? [[a2, d2, c2, b2], [a, b, c, d], [a, a2, b2, b], [d, c, c2, d2], [b, b2, c2, c], [a, d, d2, a2]]
          : [[a2, b2, c2, d2], [a, d, c, b], [a, b, b2, a2], [d, d2, c2, c], [b, c, c2, b2], [a, a2, d2, d]];
      const gl = woodBoxUV(polyhedron(faces), 2, [sx > 0 ? 0.52 : 0.08, 0.4]);
      add(gl, matL, 'wood.panelLower', panelLower);
    }
  }

  stage = 'screws';
  // =========================================================================
  // Schrauben (Positionen laut Frontansicht; Rückwand ist laut Zeichnung glatt)
  // =========================================================================
  const screwMat = mm.get('metal.screws');
  // ab Werk: Linsenkopf mit Schlitz; alternativ Innensechskant
  const slotHead = slottedScrewHead();
  const hexHead = new THREE.LatheGeometry(
    [
      [4.9, 0],
      [4.9, 0.4],
      [4.7, 1.1],
      [3.9, 2.1],
      [2.4, 2.75],
      [0, 2.9],
    ].map(([r, z]) => new THREE.Vector2(r, z)),
    32,
  );
  hexHead.rotateX(Math.PI / 2);
  const socket = new THREE.CylinderGeometry(1.7, 1.7, 1, 6);
  socket.rotateX(Math.PI / 2);
  const Zaxis = new THREE.Vector3(0, 0, 1);
  const screwVariants = { slot: [], hex: [] };
  let screwNo = 0;
  const addScrew = (x, y, z, normal = [0, 0, 1]) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.quaternion.setFromUnitVectors(Zaxis, new THREE.Vector3(...normal).normalize());
    // jede Schraube steht etwas anders (wie von Hand angezogen)
    grp.rotateZ(((screwNo++ * 2.39996) % Math.PI) - 0.6);
    root.add(grp);
    const slot = add(slotHead, screwMat, 'metal.screws', grp);
    const hex = new THREE.Group();
    hex.visible = false;
    grp.add(hex);
    add(hexHead, screwMat, 'metal.screws', hex);
    const s = new THREE.Mesh(socket, F.darkGap);
    s.position.z = 2.55;
    hex.add(s);
    screwVariants.slot.push(slot);
    screwVariants.hex.push(hex);
  };
  for (const sx of [-1, 1]) {
    addScrew(sx * 165.5, 362, 0.2);
    addScrew(sx * 165.5, 247, 0.2);
    addScrew(sx * 165, M.top + 0.2, -12, [0, 1, 0]);
    addScrew(sx * 165, M.top + 0.2, -330, [0, 1, 0]);
    addScrew(sx * 138, M.headTop + 0.1, 12, [0, 1, 0]);
    addScrew(sx * 138, M.headTop + 0.1, M.headFront - 12, [0, 1, 0]);
    addScrew(sx * 133, 218.3, -0.4);
    addScrew(sx * 117.5, 130.5, -0.4);
  }

  // =========================================================================
  // Rohbau (nur in der Montage-Animation sichtbar): Rahmen, Kessel, Pumpe,
  // Leitungen – vereinfacht nach den Explosionszeichnungen des Ersatzteilkatalogs
  // =========================================================================
  stage = 'skeleton';
  const skeleton = new THREE.Group();
  skeleton.visible = false;
  root.add(skeleton);
  {
    const S = skeleton;
    // Montageschritt je Innenteil (Animation "von 0 an")
    let sk = 'sk-base';
    let pipeNo = 0;
    const skAdd = S.add.bind(S);
    S.add = (...objs) => {
      for (const o of objs) if (!o.userData.stage) o.userData.stage = sk;
      return skAdd(...objs);
    };
    const Y = new THREE.Vector3(0, 1, 0);
    const box = (w, h, d, mat, x, y, z, r = 1) => {
      const m = plain(rbox(w, h, d, r, 1), mat, S);
      m.position.set(x, y, z);
      return m;
    };
    const cylZ = (r, len, mat, x, y, z, seg = 40) => {
      const g = new THREE.CylinderGeometry(r, r, len, seg);
      g.rotateX(Math.PI / 2);
      const m = plain(g, mat, S);
      m.position.set(x, y, z);
      return m;
    };
    const cylX = (r, len, mat, x, y, z, seg = 32) => {
      const g = new THREE.CylinderGeometry(r, r, len, seg);
      g.rotateZ(Math.PI / 2);
      const m = plain(g, mat, S);
      m.position.set(x, y, z);
      return m;
    };
    // Leitung mit Messing-Überwurfmuttern an beiden Enden
    const pipe = (pts, r, mat, nuts = true) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
      const tube = plain(new THREE.TubeGeometry(curve, 64, r, 12, false), mat, S);
      const no = pipeNo++;
      // Leitung "wächst" in der Animation von einem Anschluss zum anderen
      Object.assign(tube.userData, { kind: 'tube', pipe: no, segments: 64, radial: 12 });
      if (!nuts) return;
      for (const t of [0, 1]) {
        const nut = plain(new THREE.CylinderGeometry(r + 2.6, r + 2.6, 9, 6), F.brass, S);
        Object.assign(nut.userData, { kind: 'nut', pipe: no, end: t });
        nut.position.copy(curve.getPointAt(t));
        nut.quaternion.setFromUnitVectors(Y, curve.getTangentAt(t));
      }
    };

    // Bodenrahmen mit Längsträgern (reicht vorne bis unter die Tropfschale)
    box(262, 4, 372, F.frame, 0, M.footH + 2, -98);
    for (const sx of [-1, 1]) box(10, 6, 372, F.frame, sx * 132, M.footH + 1, -98);
    for (const sx of [-1, 1]) box(6, 40, 272, F.frame, sx * 124, M.footH + 24, -142);
    sk = 'sk-front';
    // Frontblech mit Aussparungen (Pos. 8 im Katalog)
    {
      const fs = new THREE.Shape();
      fs.moveTo(-126, 96);
      fs.lineTo(126, 96);
      fs.lineTo(126, 246);
      fs.lineTo(-126, 246);
      fs.closePath();
      const hole = (cx, cy, r) => {
        const h = new THREE.Path();
        h.absarc(cx, cy, r, 0, Math.PI * 2, true);
        fs.holes.push(h);
      };
      const slotHole = (cx, y0, y1, w) => {
        const h = new THREE.Path();
        h.moveTo(cx - w / 2, y0);
        h.lineTo(cx - w / 2, y1);
        h.lineTo(cx + w / 2, y1);
        h.lineTo(cx + w / 2, y0);
        h.closePath();
        fs.holes.push(h);
      };
      hole(0, 212, 20);
      hole(-84, 176, 13);
      hole(84, 176, 13);
      slotHole(-42, 112, 152, 18);
      slotHole(42, 112, 152, 18);
      const fg = new THREE.ExtrudeGeometry(fs, { depth: 2.5, bevelEnabled: false, curveSegments: 24 });
      plain(fg, F.frame, S).position.z = -12.5;
    }
    // Rückstütze, Pfosten und obere Streben
    sk = 'sk-rear';
    box(240, 204, 3, F.frame, 0, 196, -273);
    sk = 'sk-struts';
    for (const sx of [-1, 1]) {
      box(8, 60, 8, F.frame, sx * 116, 272, -16);
      box(8, 8, 258, F.frame, sx * 116, 298, -144);
    }
    box(240, 8, 8, F.frame, 0, 298, -16);
    sk = 'sk-tank';
    // Wassertank (transparent) im Unterbau
    box(220, 50, 190, F.tank, 0, 60, -172, 6);
    sk = 'sk-steam';
    // Dampfkessel, liegend (3 l), mit Kesselböden und Spannbändern
    cylZ(52, 210, F.steel, -34, 212, -150, 48);
    for (const z of [-45, -255]) cylZ(53.5, 4, F.brass, -34, 212, z, 48);
    for (const z of [-110, -190]) {
      const band = plain(new THREE.TorusGeometry(53.5, 2.4, 8, 48), F.frame, S);
      band.position.set(-34, 212, z);
    }
    cylZ(16, 14, F.brass, -34, 212, -262, 24); // Heizelement-Flansch
    sk = 'sk-brew';
    // Brühkessel hinter der Gruppe + Gruppenhals + Brühgruppe
    cylZ(32, 116, F.steel, 56, 300, -64);
    for (const z of [-6, -122]) cylZ(33, 3, F.brass, 56, 300, z);
    pipe(
      [
        [56, 300, -4],
        [40, 292, 24],
        [12, 278, 52],
        [0, 266, 66.5],
      ],
      13,
      F.chrome,
      false,
    );
    {
      const g = plain(new THREE.CylinderGeometry(38, 41, 28, 48), F.chrome, S);
      g.position.set(0, 250, M.groupZ);
    }
    sk = 'sk-pump';
    // Rotationspumpe mit Motor
    cylX(40, 110, F.motor, 30, 136, -205);
    for (const x of [-10, 12, 34, 56, 78]) {
      const rib = plain(new THREE.TorusGeometry(40.5, 1.8, 6, 36), F.motorRib, S);
      rib.rotation.y = Math.PI / 2;
      rib.position.set(x, 136, -205);
    }
    cylX(23, 42, F.brass, 106, 136, -205, 24);
    sk = 'sk-pcb';
    // Elektronik an der Rückstütze
    box(118, 86, 3, F.pcb, -56, 172, -270);
    box(30, 18, 8, F.motor, -84, 190, -266, 1);
    box(22, 22, 6, F.motor, -40, 160, -266, 1);
    box(16, 10, 6, F.brass, -30, 196, -266, 1);
    sk = 'sk-valves';
    // Magnetventile
    box(26, 32, 22, F.motor, -96, 140, -64, 3);
    box(26, 32, 22, F.motor, 70, 236, -150, 3);
    sk = 'sk-head';
    // Halteblech im Kopfteil für die Ventile
    box(250, 3, 142, F.frame, 0, 324, 55);
    for (const sx of [-1, 1]) box(4, 30, 120, F.frame, sx * 123, 310, 62);
    // Ventilschäfte für Dampf/Heißwasser und Paddle-Ventil im Kopfteil
    for (const sx of [-1, 1]) cylZ(7, 32, F.brass, sx * 115, 308, 114, 20);
    box(46, 22, 24, F.brass, 0, 304, 112, 3);
    sk = 'sk-pipes';
    // Kupferleitungen
    pipe([[128, 136, -205], [134, 162, -214], [108, 204, -224], [60, 226, -220], [16, 228, -212]], 4, F.copper);
    pipe([[-20, 262, -60], [30, 276, -12], [97, 282, 40], [97, 270, 80], [97, 254, 89]], 4, F.copper);
    pipe([[-62, 256, -60], [-90, 268, 0], [-98, 264, 60], [-98, 254, 95]], 4, F.copper);
    pipe([[128, 150, -196], [126, 230, -150], [92, 288, -112], [56, 300, -124]], 4, F.copper);
    pipe([[56, 322, -4], [32, 316, 58], [12, 306, 100]], 4, F.copper);
    pipe([[-96, 156, -64], [-70, 190, -90], [-50, 214, -120]], 3.5, F.copper);
    sk = 'sk-wires';
    // Kabelbaum
    pipe([[-56, 215, -268], [-10, 246, -220], [20, 180, -212], [30, 176, -205]], 2.4, F.motor, false);
    pipe([[-20, 130, -268], [-80, 120, -150], [-96, 124, -64]], 2.4, F.motor, false);
  }

  // Gesamt-Skalierung: mm -> m
  root.scale.setScalar(0.001);

  return {
    root,
    pickables,
    skeleton,
    /**
     * Manometer einstellen.
     * @param {'left'|'right'} id
     * @param {{dial: string, needle: string}} cfg  Zifferblatt (white|black|cream|naked) und Zeigerfarbe
     */
    setGauge(id, cfg) {
      const g = gauges[id];
      if (!g) return;
      const naked = cfg.dial === 'naked';
      g.faceMat.map = dialTex(g.spec, cfg.dial);
      g.faceMat.needsUpdate = true;
      g.works.visible = naked;
      const n = needleById(cfg.needle);
      g.needleMat.color.set(n.color);
      g.needleMat.metalness = n.metal ? 1 : 0;
      g.needleMat.roughness = n.metal ? 0.25 : 0.5;
    },
    /** Schraubenköpfe: 'slot' (Schlitz) oder 'hex' (Innensechskant) */
    setScrewHead(type) {
      const hex = type === 'hex';
      screwVariants.slot.forEach((m) => (m.visible = !hex));
      screwVariants.hex.forEach((m) => (m.visible = hex));
    },
    /** Cup Rail ein-/ausblenden */
    /** @param {'flat'|'rod'} style  Flachstahl-Rahmen (rb.crafts) oder Rundstab auf Pfosten */
    setRail(on, style = 'flat') {
      railGroup.visible = !!on && style === 'rod';
      railFlat.visible = !!on && style !== 'rod';
    },
    /** Lochbild von Tropfblech und Tassenablage: 'slots' (Original) oder 'diamond' (rb.crafts) */
    setTrays({ drip, cup }) {
      for (const [tray, style] of [[trays.drip, drip], [trays.cup, cup]]) {
        const st = style === 'diamond' ? 'diamond' : 'slots';
        if (!tray.tex[st]) tray.tex[st] = tray.make(st);
        if (tray.mat.userData.baseMap !== tray.tex[st]) {
          tray.mat.userData.baseMap = tray.tex[st];
          tray.mat.map = tray.tex[st];
          tray.mat.needsUpdate = true;
        }
      }
    },
    /** Holzverkleidungen ein-/ausblenden */
    setPanels({ upper, lower }) {
      panelUpper.visible = !!upper;
      panelLower.visible = !!lower;
      // die Holzumrandung verdeckt die Rückwand – dort sitzt dann kein Schriftzug
      rearLogo.visible = !upper;
    },
    /** Formen der Holzteile */
    setShapes({ knobs, handle }) {
      for (const [id, list] of Object.entries(knobVariants)) list.forEach((m) => (m.visible = id === knobs));
      if (!knobVariants[knobs]) knobVariants.wave.forEach((m) => (m.visible = true));
      handleVariants.round.visible = handle !== 'facet';
      handleVariants.facet.visible = handle === 'facet';
    },
    /** Barista-Licht: 0 = aus, 1 = voll */
    /** Formen, optionale Teile, Manometer und Schrauben aus der Konfiguration übernehmen */
    sync(config) {
      this.setRail(config.rail, config.railStyle);
      this.setTrays(config.tray);
      this.setPanels({
        upper: config.slots['wood.panelUpper'].id !== 'none',
        lower: config.slots['wood.panelLower'].id !== 'none',
      });
      this.setShapes(config.shape);
      this.setGauge('left', config.gauges.left);
      this.setGauge('right', config.gauges.right);
      this.setScrewHead(config.screwHead);
    },
    setBarista(level) {
      baristaSpot.intensity = level * 0.2;
      if (level > 0.01) ledMat.color.setRGB(1.6 * Math.max(0.35, level), 1.5 * Math.max(0.35, level), 1.3 * Math.max(0.35, level));
      else ledMat.color.setHex(0x1c1c1c);
    },
  };
}

// Geometrie-Helfer, auch für das Modell der Mühle (grinder.js)
export { boxProjectUV, scaleUV, rbox, profileExtrudeX, extrudeZ, polyhedron, roundedPolyhedron, slottedScrewHead, mergeGeos, woodBoxUV, woodCylUV, swapUV };
