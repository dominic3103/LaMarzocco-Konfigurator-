// ---------------------------------------------------------------------------
// Gemeinsame Bausteine für weitere Geräte (Maschinen und Mühlen)
//
// Baukasten mit Montage-Schritten, Blechschalen (Profil entlang eines
// U-förmigen Grundrisses), Manometer mit Zifferblatt/Naked-Werk, Schrauben,
// erhabenem Schriftzug und Helfern für das Innenleben (Rohre mit Muttern).
// Maße in Millimeter, Koordinaten wie bei der Linea Mini R:
// X = Breite (rechts), Y = Höhe (0 = Stellfläche), Z = Tiefe (+Z = Front).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { rbox, slottedScrewHead, boxProjectUV, mergeGeos } from './model.js';
import { makeGaugeTexture, gaugeAngle, makeLogoTexture, makeStackedLogoTexture } from './textures.js';
import { needleById } from './data.js';

export const WOOD_U = 160;
export const WOOD_V = 400;
const V3 = THREE.Vector3;

/**
 * Baukasten für ein Gerät: Wurzelgruppe, anklickbare Teile, Rohbau (Innenleben),
 * aktueller Montageschritt (wird jedem hinzugefügten Teil mitgegeben).
 */
export function createBuilder(name, mm) {
  const root = new THREE.Group();
  root.name = name;
  const pickables = [];
  let stage = null;
  let sk = null;
  const rootAdd = root.add.bind(root);
  root.add = (...objs) => {
    for (const o of objs) if (!o.userData.stage) o.userData.stage = stage;
    return rootAdd(...objs);
  };
  const skeleton = new THREE.Group();
  skeleton.visible = false;
  const skAdd = skeleton.add.bind(skeleton);
  skeleton.add = (...objs) => {
    for (const o of objs) if (!o.userData.stage) o.userData.stage = sk;
    return skAdd(...objs);
  };
  stage = 'skeleton';
  root.add(skeleton);
  stage = null;
  const F = mm.fixed;
  const mesh = (geom, material, parent) => {
    const m = new THREE.Mesh(geom, material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  let pipeNo = 0;
  const B = {
    root,
    pickables,
    skeleton,
    F,
    mm,
    /** Montageschritt für die folgenden Teile */
    stage(id) {
      stage = id;
    },
    /** Montageschritt für die folgenden Innenteile */
    sk(id) {
      sk = id;
    },
    /** konfigurierbares (anklickbares) Teil */
    add(geom, material, slot, parent = root) {
      const m = mesh(geom, material, parent);
      if (slot) {
        m.userData.slot = slot;
        pickables.push(m);
      }
      return m;
    },
    /** festes Teil (Kunststoff, Gummi, Glas ...) */
    plain(geom, material, parent = root) {
      return mesh(geom, material, parent);
    },
    /** Gruppe als eigenes Montageteil */
    group(parent = root) {
      const g = new THREE.Group();
      parent.add(g);
      return g;
    },
    // ---- Innenleben (nur in der Montage sichtbar) ----
    skBox(w, h, d, mat, x, y, z, r = 1) {
      const m = mesh(rbox(w, h, d, Math.min(r, w / 2.1, h / 2.1, d / 2.1), 1), mat, skeleton);
      m.position.set(x, y, z);
      return m;
    },
    skCyl(r, len, mat, x, y, z, axis = 'y', seg = 40) {
      const g = new THREE.CylinderGeometry(r, r, len, seg);
      if (axis === 'x') g.rotateZ(Math.PI / 2);
      if (axis === 'z') g.rotateX(Math.PI / 2);
      const m = mesh(g, mat, skeleton);
      m.position.set(x, y, z);
      return m;
    },
    skMesh(geom, mat) {
      return mesh(geom, mat, skeleton);
    },
    /** Leitung mit Messing-Überwurfmuttern; wächst in der Animation von Anschluss zu Anschluss */
    pipe(pts, r, mat, nuts = true, parent = skeleton) {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)), false, 'centripetal');
      const tube = mesh(new THREE.TubeGeometry(curve, 64, r, 12, false), mat, parent);
      const no = pipeNo++;
      Object.assign(tube.userData, { kind: 'tube', pipe: no, segments: 64, radial: 12 });
      if (!nuts) return tube;
      const Y = new V3(0, 1, 0);
      for (const t of [0, 1]) {
        const nut = mesh(new THREE.CylinderGeometry(r + 2.6, r + 2.6, 9, 6), F.brass, parent);
        Object.assign(nut.userData, { kind: 'nut', pipe: no, end: t });
        nut.position.copy(curve.getPointAt(t));
        nut.quaternion.setFromUnitVectors(Y, curve.getTangentAt(t));
      }
      return tube;
    },
  };
  return B;
}

// ---------------------------------------------------------------------------
// Geometrie
// ---------------------------------------------------------------------------

/** Polygon mit abgerundeten Ecken als Shape (Punkte gegen den Uhrzeigersinn) */
export function filletShape(points, r, seg = 4) {
  const shape = new THREE.Shape();
  const n = points.length;
  const rs = Array.isArray(r) ? r : points.map(() => r);
  for (let i = 0; i < n; i++) {
    const p = new THREE.Vector2(...points[i]);
    const a = new THREE.Vector2(...points[(i + n - 1) % n]);
    const b = new THREE.Vector2(...points[(i + 1) % n]);
    const da = a.clone().sub(p);
    const db = b.clone().sub(p);
    const rr = Math.min(rs[i], da.length() / 2.05, db.length() / 2.05);
    if (rr < 0.01) {
      if (i === 0) shape.moveTo(p.x, p.y);
      else shape.lineTo(p.x, p.y);
      continue;
    }
    const p0 = p.clone().add(da.normalize().multiplyScalar(rr));
    const p1 = p.clone().add(db.normalize().multiplyScalar(rr));
    if (i === 0) shape.moveTo(p0.x, p0.y);
    else shape.lineTo(p0.x, p0.y);
    for (let k = 1; k <= seg; k++) {
      const t = k / seg;
      const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p.x + t * t * p1.x;
      const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p.y + t * t * p1.y;
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  return shape;
}

/** Kreis-Loch für Shapes */
export function circleHole(cx, cy, r) {
  const h = new THREE.Path();
  h.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return h;
}

/** Shape (XY) zwischen z0 und z0 + depth extrudieren, Kanten leicht gerundet */
export function plateZ(shape, z0, depth, bevel = 0.4, curveSegments = 24) {
  const b = Math.min(bevel, depth / 2.2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - 2 * b),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: 2,
    curveSegments,
  });
  g.translate(0, 0, z0 + b);
  return g;
}

/** Shape mit Koordinaten (x, z) in der XZ-Ebene senkrecht zwischen y0 und y0 + h extrudieren */
export function plateY(shape, y0, h, bevel = 0.4, curveSegments = 24) {
  const g = plateZ(shape, 0, h, bevel, curveSegments);
  // Drehung um X (+90°): Shape-y -> Welt-z, Extrusion -> nach unten
  g.rotateX(Math.PI / 2);
  g.translate(0, y0 + h, 0);
  return g;
}

/** Drehteil um die Y-Achse: Profil [[r, y], ...] */
export function latheY(profile, seg = 64) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}
/** Drehteil um die Z-Achse (nach vorne): Profil [[r, z], ...] */
export function latheZ(profile, seg = 64) {
  // Lathe-Achse Y -> Welt +Z (Drehung um X um +90°), Flächen zeigen nach außen wie bei latheY
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/**
 * U-förmiger Grundriss (rechte Seite von vorn nach hinten, Rückwand, linke Seite nach vorn)
 * mit gerundeten hinteren Ecken. Liefert Punkte [x, z] und die Bogenlänge s je Punkt.
 */
function uOutline(hw, zFront, zRear, r, arcSeg) {
  const pts = [];
  const rr = Math.max(0.01, Math.min(r, hw * 0.9, (zFront - zRear) * 0.9));
  pts.push([hw, zFront]);
  pts.push([hw, zRear + rr]);
  for (let k = 1; k < arcSeg; k++) {
    const a = (k / arcSeg) * (Math.PI / 2);
    pts.push([hw - rr + rr * Math.cos(a), zRear + rr - rr * Math.sin(a)]);
  }
  pts.push([hw - rr, zRear]);
  pts.push([-hw + rr, zRear]);
  for (let k = 1; k < arcSeg; k++) {
    const a = (k / arcSeg) * (Math.PI / 2);
    pts.push([-hw + rr - rr * Math.sin(a), zRear + rr - rr * Math.cos(a)]);
  }
  pts.push([-hw, zRear + rr]);
  pts.push([-hw, zFront]);
  return pts;
}

/**
 * Blechschale: ein Querschnittsprofil entlang eines U-Grundrisses gezogen (Seitenwände + Rückwand).
 * rows: Reihen von außen unten nach innen, je {hw, zr, y, r?} – Werte oder Funktionen:
 *   hw(y) halbe Breite, zr(y) Lage der Rückwand, y Zahl oder Funktion y(z).
 * zFront: vordere Kante, t: Blechstärke (nach innen), uv: 'box' | 'wrap' (Furnier um die Ecken)
 */
export function sheetSweep(rows, { zFront = 0, t = 1, r = 3, arcSeg = 6, uv = 'box', uvScale = 60, inward = -1 } = {}) {
  const val = (v, arg) => (typeof v === 'function' ? v(arg) : v);
  const grid = rows.map((row) => {
    const rad = row.r ?? r;
    let yN = typeof row.y === 'number' ? row.y : row.y(zFront);
    // Punkte über die Bogenposition bestimmen und y(z) zweimal nachführen
    let pts = uOutline(val(row.hw, yN), row.zf ?? zFront, val(row.zr, yN), rad, arcSeg).map(([x, z]) => [x, yN, z]);
    if (typeof row.y === 'function') {
      for (let it = 0; it < 2; it++) {
        pts = pts.map(([, , z], i) => {
          const y = row.y(z);
          const o = uOutline(val(row.hw, y), row.zf ?? zFront, val(row.zr, y), rad, arcSeg)[i];
          return [o[0], y, o[1]];
        });
      }
    }
    return pts;
  });
  const R = grid.length;
  const N = grid[0].length;
  // Außenfläche (indiziert: weiche Bögen), Normalen nach außen
  const outer = new THREE.BufferGeometry();
  const pos = new Float32Array(R * N * 3);
  grid.forEach((row, i) => row.forEach((p, j) => pos.set(p, (i * N + j) * 3)));
  outer.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const idx = [];
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      const a = i * N + j;
      const b = a + 1;
      const c = a + N;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  outer.setIndex(idx);
  outer.computeVertexNormals();
  // Ausrichtung prüfen: rechte Seitenwand (j = 0) soll nach +X zeigen
  let iTest = 0;
  grid.forEach((row, i) => {
    if (row[0][0] > grid[iTest][0][0]) iTest = i;
  });
  const n0 = new V3().fromBufferAttribute(outer.attributes.normal, iTest * N);
  if (n0.x * inward > 0) {
    const ix = outer.index;
    for (let k = 0; k < ix.count; k += 3) {
      const tt = ix.getX(k + 1);
      ix.setX(k + 1, ix.getX(k + 2));
      ix.setX(k + 2, tt);
    }
    outer.computeVertexNormals();
  }
  const nor = outer.attributes.normal;
  // Innenfläche: entlang der Normalen um t versetzt, Dreiecke umgedreht
  const ipos = new Float32Array(R * N * 3);
  for (let k = 0; k < R * N; k++) {
    ipos[k * 3] = pos[k * 3] - nor.getX(k) * t;
    ipos[k * 3 + 1] = pos[k * 3 + 1] - nor.getY(k) * t;
    ipos[k * 3 + 2] = pos[k * 3 + 2] - nor.getZ(k) * t;
  }
  const inner = new THREE.BufferGeometry();
  inner.setAttribute('position', new THREE.BufferAttribute(ipos, 3));
  const oi = outer.index.array;
  const iidx = [];
  for (let k = 0; k < oi.length; k += 3) iidx.push(oi[k], oi[k + 2], oi[k + 1]);
  inner.setIndex(iidx);
  inner.computeVertexNormals();
  // Ränder schließen: erste/letzte Reihe und vordere Kanten (erste/letzte Spalte)
  const rim = [];
  const quad = (pa, pb, pc, pd) => rim.push(...pa, ...pb, ...pc, ...pa, ...pc, ...pd);
  const O = (i, j) => grid[i][j];
  const I = (i, j) => [ipos[(i * N + j) * 3], ipos[(i * N + j) * 3 + 1], ipos[(i * N + j) * 3 + 2]];
  const flip = n0.x * inward > 0;
  for (let j = 0; j < N - 1; j++) {
    flip ? quad(O(0, j), I(0, j), I(0, j + 1), O(0, j + 1)) : quad(O(0, j), O(0, j + 1), I(0, j + 1), I(0, j));
    flip ? quad(O(R - 1, j), O(R - 1, j + 1), I(R - 1, j + 1), I(R - 1, j)) : quad(O(R - 1, j), I(R - 1, j), I(R - 1, j + 1), O(R - 1, j + 1));
  }
  for (let i = 0; i < R - 1; i++) {
    flip ? quad(O(i, 0), O(i + 1, 0), I(i + 1, 0), I(i, 0)) : quad(O(i, 0), I(i, 0), I(i + 1, 0), O(i + 1, 0));
    flip ? quad(O(i, N - 1), I(i, N - 1), I(i + 1, N - 1), O(i + 1, N - 1)) : quad(O(i, N - 1), O(i + 1, N - 1), I(i + 1, N - 1), I(i, N - 1));
  }
  const rimG = new THREE.BufferGeometry();
  rimG.setAttribute('position', new THREE.Float32BufferAttribute(rim, 3));
  rimG.computeVertexNormals();
  const parts = [outer.toNonIndexed(), inner.toNonIndexed(), rimG];
  if (uv === 'wrap') {
    // Furnier: U quer (Höhe), V entlang des Grundrisses (Bogenlänge) – Maserung läuft um die Ecken
    const sArr = grid[0].map(() => 0);
    for (let j = 1; j < N; j++) sArr[j] = sArr[j - 1] + Math.hypot(grid[0][j][0] - grid[0][j - 1][0], grid[0][j][2] - grid[0][j - 1][2]);
    for (const g of parts) {
      const p = g.attributes.position;
      const u = new Float32Array(p.count * 2);
      for (let k = 0; k < p.count; k++) {
        // nächste Spalte über den Grundriss suchen (genügt für die Maserung)
        const x = p.getX(k);
        const z = p.getZ(k);
        let best = 0;
        let bd = Infinity;
        for (let j = 0; j < N; j++) {
          const d = (grid[0][j][0] - x) ** 2 + (grid[0][j][2] - z) ** 2;
          if (d < bd) {
            bd = d;
            best = j;
          }
        }
        u[k * 2] = p.getY(k) / WOOD_U + 0.21;
        u[k * 2 + 1] = sArr[best] / WOOD_V + 0.13;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(u, 2));
    }
  } else {
    for (const g of parts) boxProjectUV(g, uvScale);
  }
  const merged = mergeGeos(...parts);
  merged.computeBoundingBox();
  return merged;
}

// ---------------------------------------------------------------------------
// Manometer (wie Linea Mini R): Lünette, Gehäuse, Zifferblatt oder offenes
// Messwerk ("Naked"), Zeiger, Glas. Gruppe zeigt entlang +Z.
// ---------------------------------------------------------------------------
const dialTextures = new Map();
const dialTex = (spec, dial) => {
  const key = `${spec.id}:${spec.max}:${dial}`;
  if (!dialTextures.has(key)) dialTextures.set(key, makeGaugeTexture(spec, dial));
  return dialTextures.get(key);
};

/**
 * @param {object} B Baukasten
 * @param {{slot:string, x:number, y:number, z:number, R:number, spec:object, bezel?:number, parent?:THREE.Object3D}} o
 */
export function buildGauge(B, o) {
  const { F } = B;
  const grp = new THREE.Group();
  grp.position.set(o.x, o.y, o.z);
  (o.parent || B.root).add(grp);
  const R = o.R;
  const Ri = R - (o.bezel ?? 4.6);
  const ringMat = B.mm.get(o.slot);
  const pick = (m) => {
    m.userData.slot = o.slot;
    B.pickables.push(m);
    return m;
  };
  const prof = (o.profile || [
    [R, 0],
    [R, 6.4],
    [R - 0.5, 7.7],
    [R - 1.6, 8.4],
    [Ri + 1.6, 8.5],
    [Ri + 0.5, 7.9],
    [Ri, 7.0],
    [Ri, 2.4],
  ]).map(([r, z]) => new THREE.Vector2(r, z));
  const ring = new THREE.LatheGeometry(prof, 72);
  ring.rotateX(Math.PI / 2);
  B.add(ring, ringMat, o.slot, grp);
  const faceZ = o.faceZ ?? 5.2;
  const back = B.plain(new THREE.CircleGeometry(Ri, 48), F.gaugeCase, grp);
  back.position.z = faceZ - 3;
  pick(back);
  const faceMat = new THREE.MeshStandardMaterial({ map: dialTex(o.spec, 'white'), roughness: 0.55, alphaTest: 0.5, alphaToCoverage: true });
  const face = B.plain(new THREE.CircleGeometry(Ri - 0.1, 64), faceMat, grp);
  face.position.z = faceZ;
  face.castShadow = false;
  pick(face);
  // offenes Messwerk
  const works = new THREE.Group();
  works.visible = false;
  grp.add(works);
  {
    const z0 = faceZ - 2.9;
    const tube = B.plain(new THREE.TorusGeometry(Ri * 0.84, 1.15, 12, 72, Math.PI * 1.5), F.brassPolished, works);
    tube.rotation.z = Math.PI * 1.36;
    tube.position.z = z0 + 1.6;
    B.plain(rbox(8.5, 6, 3.6, 0.6, 1), F.brassPolished, works).position.set(0, -Ri * 0.66, z0 + 1.8);
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
    for (const hx of [-8.6, 8.6]) sh.holes.push(circleHole(hx, 4.4, 1.3));
    const s = Ri / 17.4;
    const plate = B.plain(new THREE.ExtrudeGeometry(sh, { depth: 1.1, bevelEnabled: false, curveSegments: 12 }), F.brassPolished, works);
    plate.position.set(0, -1.2 * s, z0 + 2.2);
    plate.scale.set(s, s, 1);
    for (const px of [-2.6, 2.6]) {
      const sc = new THREE.CylinderGeometry(1.35, 1.35, 0.9, 16);
      sc.rotateX(Math.PI / 2);
      B.plain(sc, F.blackPlastic, works).position.set(px * s, -4.2 * s, z0 + 3.7);
    }
    const sector = B.plain(new THREE.CircleGeometry(4.2 * s, 16, Math.PI * 1.1, Math.PI * 0.55), F.brassPolished, works);
    sector.position.set(0.8, 0.6, z0 + 3.45);
  }
  const needleMat = new THREE.MeshStandardMaterial({ color: 0xc2231d, roughness: 0.5 });
  const needle = new THREE.Group();
  needle.position.z = faceZ + 0.9;
  grp.add(needle);
  {
    const L = Ri * 0.84;
    const ns = new THREE.Shape();
    ns.moveTo(-6.5 * (Ri / 17.4), -0.9);
    ns.lineTo(-6.5 * (Ri / 17.4), 0.9);
    ns.lineTo(0, 0.85);
    ns.lineTo(L, 0.22);
    ns.lineTo(L, -0.22);
    ns.lineTo(0, -0.85);
    ns.closePath();
    B.plain(new THREE.ExtrudeGeometry(ns, { depth: 0.45, bevelEnabled: false }), needleMat, needle);
    const hub = new THREE.CylinderGeometry(2.7, 2.9, 1.3, 28);
    hub.rotateX(Math.PI / 2);
    B.plain(hub, needleMat, needle).position.z = 0.6;
  }
  needle.rotation.z = -gaugeAngle(o.spec.value, o.spec.max);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(Ri + 0.3, 64), F.glass);
  glass.position.z = faceZ + 2.4;
  grp.add(glass);
  pick(glass);
  return {
    grp,
    /** Zifferblatt (white | black | cream | naked) und Zeigerfarbe */
    set({ dial = 'white', needle: nid = 'red' } = {}) {
      faceMat.map = dialTex(o.spec, dial);
      faceMat.needsUpdate = true;
      works.visible = dial === 'naked';
      const n = needleById(nid);
      needleMat.color.set(n.color);
      needleMat.metalness = n.metal ? 1 : 0;
      needleMat.roughness = n.metal ? 0.25 : 0.5;
    },
  };
}

// ---------------------------------------------------------------------------
// Schrauben: Linsenkopf mit Schlitz, jede etwas anders verdreht
// ---------------------------------------------------------------------------
const Zaxis = new V3(0, 0, 1);
export function screwSet(B, slot, { R = 4.9, H = 3.3 } = {}) {
  const head = slottedScrewHead(R, H);
  const mat = B.mm.get(slot);
  let no = 0;
  return (x, y, z, normal = [0, 0, 1], parent = B.root) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.quaternion.setFromUnitVectors(Zaxis, new V3(...normal).normalize());
    grp.rotateZ(((no++ * 2.39996) % Math.PI) - 0.6);
    parent.add(grp);
    B.add(head, mat, slot, grp);
    return grp;
  };
}

// ---------------------------------------------------------------------------
// Erhabener Schriftzug (mehrere Lagen einer Maske; auch aus Holz möglich)
// ---------------------------------------------------------------------------
const logoTextures = new Map();
/** Schriftzug als Maske; { stacked: true } setzt die Buchstaben untereinander (Fläche w × w·n) */
export function logoFactory(B, slot, w, h, text = 'LA MARZOCCO', { stacked = false } = {}) {
  const key = (stacked ? 'v:' : 'h:') + text;
  if (!logoTextures.has(key)) logoTextures.set(key, stacked ? makeStackedLogoTexture(text) : makeLogoTexture(text));
  const mat = B.mm.get(slot, { alphaMap: logoTextures.get(key), alphaTest: 0.4, alphaToCoverage: true });
  mat.userData.logo = { w, h };
  const geo = new THREE.PlaneGeometry(w, h);
  return (layers = 6, parent = B.root) => {
    const grp = new THREE.Group();
    for (let i = 0; i < layers; i++) B.add(geo, mat, slot, grp).position.z = 0.25 + i * 0.4;
    parent.add(grp);
    return grp;
  };
}

/** Dreiecke umdrehen (nach Spiegelung), indiziert oder nicht */
export function flipWinding(g) {
  if (g.index) {
    const idx = g.index;
    for (let k = 0; k < idx.count; k += 3) {
      const t = idx.getX(k + 1);
      idx.setX(k + 1, idx.getX(k + 2));
      idx.setX(k + 2, t);
    }
    idx.needsUpdate = true;
    return g;
  }
  const n = g.attributes.position.count;
  for (const a of Object.values(g.attributes)) {
    const s = a.itemSize;
    for (let k = 0; k < n; k += 3) {
      for (let c = 0; c < s; c++) {
        const i1 = (k + 1) * s + c;
        const i2 = (k + 2) * s + c;
        const t = a.array[i1];
        a.array[i1] = a.array[i2];
        a.array[i2] = t;
      }
    }
    a.needsUpdate = true;
  }
  return g;
}

/** Rohr entlang von Punkten (z. B. Dampflanze) */
export function tubeAlong(pts, r, seg = 120, radial = 24) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)), false, 'centripetal', 0.5);
  return new THREE.TubeGeometry(curve, seg, r, radial, false);
}
