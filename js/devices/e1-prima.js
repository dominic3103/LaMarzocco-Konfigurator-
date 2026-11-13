// ---------------------------------------------------------------------------
// Victoria Arduino Eagle One Prima (E1 Prima / E1 Prima EXP)
//
// Maße in Millimeter, vermessen an den maßstäblichen technischen Zeichnungen
// im offiziellen Prospekt "E1 Prima EXP" (S. 20: Front-, Seiten- und
// Unteransicht, gerendert mit 600 dpi; Maßstab 2,285 px/mm, passend zu den
// Herstellerangaben Breite 411, Tiefe 510, Höhe 379 mm, Gruppenhöhe 95 mm,
// Tassenwärmer 330 × 280 mm) und an den Werksfotos.
//
// Koordinaten: X = Breite (links = Dampflanze), Y = Höhe (0 = Stellfläche),
// Z = Tiefe (+Z = Front). Z = 0 ist die Vorderkante der Haube.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, rbox, profileExtrudeX, woodBoxUV, mergeGeos } from '../model.js';
import { makeSlotFieldTexture, makePlateTexture } from '../textures.js';
import { makeCanvas } from '../noise.js';
import { registerDevice } from '../devices.js';
import { DeviceUI } from '../device-ui.js';
import { createBuilder, filletShape, plateZ, plateY, latheY, latheZ, logoFactory, tubeAlong, buildGauge, WOOD_V } from '../parts.js';

const ID = 'e1';
const S = (k) => `${ID}:${k}`;
const GZ = 60; // Gruppenachse (z)
/** Rückwand: lehnt nach hinten (oben z = −328, unten z = −368) */
const zr = (y) => -367.6 + 0.124 * (y - 50);

const STAGES = [
  { id: 'sk-base', src: 'skeleton', from: [0, 1, 0], dist: 420, gap: 0, dur: 0.7, drop: true },
  { id: 'sk-boiler', src: 'skeleton', from: [-1, 0.5, 0], dist: 900, gap: 0.45, dur: 0.9, heavy: true },
  { id: 'sk-neo', src: 'skeleton', from: [0, 1, 0.3], dist: 800, gap: 0.4, dur: 0.8 },
  { id: 'sk-pump', src: 'skeleton', from: [1, 0.1, 0], dist: 800, gap: 0.35, dur: 0.75, spin: [[1, 0, 0], Math.PI * 2] },
  { id: 'sk-pcb', src: 'skeleton', from: [0, 0, -1], dist: 700, gap: 0.3, dur: 0.6 },
  { id: 'sk-pipes', src: 'skeleton', grow: true, gap: 0.35, dur: 0.6, stagger: 0.2 },
  { id: 'feet', from: [0, -1, 0], dist: 400, gap: 0.45, after: true, dur: 0.6, stagger: 0.08 },
  { id: 'front', from: [0, 0.1, 1], dist: 900, gap: 0.4, dur: 0.85, heavy: true },
  { id: 'hood', from: [0, 1, -0.4], dist: 1100, gap: 0.45, dur: 1.0, heavy: true },
  { id: 'rear', from: [0, 0.2, -1], dist: 800, gap: 0.35, dur: 0.7 },
  { id: 'cover', from: [0, 1, 0.5], dist: 800, gap: 0.4, dur: 0.8 },
  { id: 'levers', from: [0, 0.3, 1], dist: 700, gap: 0.35, dur: 0.6, stagger: 0.1 },
  { id: 'wands', from: [0, 0.5, 1], dist: 800, gap: 0.35, dur: 0.75, stagger: 0.15 },
  { id: 'portafilter', from: [-0.1, -0.3, 1], dist: 900, gap: 0.35, dur: 0.85, spin: [[0, 1, 0], -0.9] },
  { id: 'drip', from: [0, -0.2, 1], dist: 800, gap: 0.35, dur: 0.75 },
  { id: 'tray', from: [0, 1, 0], dist: 600, gap: 0.4, dur: 0.6 },
  { id: 'logo', pop: true, gap: 0.4, dur: 0.5 },
];
const isInner = (id) => id.startsWith('sk-');

/** Haube im Frontumriss: rechte Hälfte von oben Mitte bis unten innen (x, y) */
const HOOD = [
  [0, 370.7],
  [168, 370.7],
  [177.3, 362],
  [192.6, 111.6],
  [204, 88],
  [201, 66],
  [188, 52],
  [168, 45.5],
  [150, 44],
];

/** Rautenmuster (Fugen) für die rb.crafts-Rückblende */
function makeDiamondMask() {
  const c = makeCanvas(512, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  for (let x = -128; x < 640; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 64, 128);
    g.stroke();
    g.beginPath();
    g.moveTo(x + 64, 0);
    g.lineTo(x, 128);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

/** Display der Gruppenhaube ("Ghost display"): dunkles Glas, weiße Ziffern, drei Tastenmulden */
function makeGhostDisplay() {
  const c = makeCanvas(512, 224);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 224);
  const bg = g.createLinearGradient(0, 0, 0, 224);
  bg.addColorStop(0, '#232528');
  bg.addColorStop(1, '#0c0d0f');
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(4, 4, 504, 216, 60);
  g.fill();
  g.fillStyle = '#f2f4f7';
  g.font = '500 64px "Courier New", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText("'24", 256, 66);
  // drei trapezförmige Tastenmulden mit hellem Rand
  for (const x of [150, 256, 362]) {
    g.fillStyle = '#060607';
    g.strokeStyle = '#8a8d92';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x - 44, 124);
    g.lineTo(x + 44, 124);
    g.lineTo(x + 32, 186);
    g.lineTo(x - 32, 186);
    g.closePath();
    g.fill();
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Schnitte der Gruppenhaube: [y, halbe Breite, Vorderkante z, Eckradius] */
const COVER_ROWS = [
  [262, 57, 99, 12],
  [263.5, 61, 102.5, 15],
  [270, 62.3, 103, 17],
  [300, 62.3, 103, 18],
  [316, 62, 101.5, 20],
  [328, 61, 97, 22],
  [340, 59, 89, 24],
  [349, 56.5, 79, 25],
  [355, 53.5, 68, 25],
  [359, 50, 55, 24],
  [360.8, 46, 42, 22],
  [361.4, 41, 32, 20],
];
/** Fläche, die der Front der Gruppenhaube zwischen y0 und y1 folgt (für das Display) */
function coverPatch(w, y0, y1, lift = 0.5, nx = 24, ny = 16) {
  const at = (y) => {
    const R = COVER_ROWS;
    let i = 0;
    while (i < R.length - 2 && R[i + 1][0] < y) i++;
    const [ya, ha, za, ra] = R[i];
    const [yb, hb, zb, rb] = R[i + 1];
    const t = (y - ya) / (yb - ya);
    return [ha + (hb - ha) * t, za + (zb - za) * t, ra + (rb - ra) * t];
  };
  const pos = [];
  const uv = [];
  for (let j = 0; j <= ny; j++) {
    const y = y0 + ((y1 - y0) * j) / ny;
    const [hw, zf, r] = at(y);
    for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + (w * i) / nx;
      const dx = Math.max(0, Math.abs(x) - (hw - r));
      const z = zf - r + Math.sqrt(Math.max(0, r * r - dx * dx));
      pos.push(x, y, z + lift);
      uv.push(i / nx, j / ny);
    }
  }
  const idx = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      idx.push(a, a + 1, a + nx + 1, a + 1, a + nx + 2, a + nx + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** geschlossener Loft aus vollständig gerundeten Rechtecken: [y, halbe Breite, z hinten, z vorn, Radius] */
function pillLoft(rows, nc = 8) {
  const ring = ([y, hw, z0, z1, r]) => {
    const rr = Math.min(r, hw - 0.2, (z1 - z0) / 2 - 0.2);
    const pts = [];
    const corner = (cx, cz, a0) => {
      for (let k = 0; k <= nc; k++) {
        const a = a0 + (k / nc) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr]);
      }
    };
    corner(hw - rr, z1 - rr, 0);
    corner(-hw + rr, z1 - rr, Math.PI / 2);
    corner(-hw + rr, z0 + rr, Math.PI);
    corner(hw - rr, z0 + rr, Math.PI * 1.5);
    return pts;
  };
  const rings = rows.map(ring);
  const n = rings[0].length;
  const pos = [];
  for (const rg of rings) for (const p of rg) pos.push(...p);
  const idx = [];
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i;
      const b = j * n + ((i + 1) % n);
      idx.push(a, a + n, b, b, a + n, b + n);
    }
  }
  const cap = (rg, j, up) => {
    const c = pos.length / 3;
    pos.push(0, rg[0][1] + (up ? 0.6 : -0.6), rg.reduce((sm, p) => sm + p[2], 0) / n);
    for (let i = 0; i < n; i++) {
      const a = j * n + i;
      const b = j * n + ((i + 1) % n);
      if (up) idx.push(a, c, b);
      else idx.push(a, b, c);
    }
  };
  cap(rings[0], 0, false);
  cap(rings[rings.length - 1], rings.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Gruppenhaube als Loft aus Grundriss-Schnitten: je Höhe ein vorn gerundetes Rechteck
 * (hinten bündig am Frontblech, z = 0). rows: [y, halbe Breite, Vorderkante z, Eckradius]
 */
function coverLoft(rows, nc = 10) {
  const ring = ([y, hw, zf, r]) => {
    const pts = [[-hw, 0]];
    const rr = Math.min(r, hw - 0.5, zf - 0.5);
    for (let k = 0; k <= nc; k++) {
      const a = Math.PI + (k / nc) * (Math.PI / 2);
      pts.push([-hw + rr + Math.cos(a) * rr, zf - rr - Math.sin(a) * rr]);
    }
    for (let k = 0; k <= nc; k++) {
      const a = Math.PI * 1.5 + (k / nc) * (Math.PI / 2);
      pts.push([hw - rr + Math.cos(a) * rr, zf - rr - Math.sin(a) * rr]);
    }
    pts.push([hw, 0]);
    return pts.map(([x, z]) => [x, y, z]);
  };
  const rings = rows.map(ring);
  const n = rings[0].length;
  const pos = [];
  for (const rg of rings) for (const p of rg) pos.push(...p);
  const idx = [];
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  // Deckel oben: Fächer um die Mitte des letzten Schnitts
  const top = rings[rings.length - 1];
  const cy = top[0][1] + 0.4;
  const cz = top.reduce((sum, p) => sum + p[2], 0) / n;
  const ci = pos.length / 3;
  pos.push(0, cy, cz);
  const base = (rings.length - 1) * n;
  for (let i = 0; i < n - 1; i++) idx.push(base + i, base + i + 1, ci);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Schriftzug "Victoria Arduino" (Schreibschrift, Alpha-Maske) */
function makeScript() {
  const c = makeCanvas(512, 96);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'italic 600 54px "Brush Script MT", "Segoe Script", cursive';
  g.fillText('Victoria Arduino', 256, 50);
  return new THREE.CanvasTexture(c);
}

function buildE1(mm) {
  const B = createBuilder('E1Prima', mm);
  const { root, F } = B;
  const mat = (k, extra) => mm.get(S(k), extra);
  const hoodMat = mat('body.main');
  const railParts = [];

  // =========================================================================
  // Füße (Rändelfüße, höhenverstellbar)
  // =========================================================================
  B.stage('feet');
  {
    const knurl = latheY([[0, 0.3], [24, 0.3], [25, 1.5], [25, 20.5], [24, 22], [0, 22]], 48);
    const stem = new THREE.CylinderGeometry(9, 9, 22, 24);
    for (const [x, z] of [
      [-128.5, -301],
      [128.5, -301],
      [-128.5, -82],
      [128.5, -82],
    ]) {
      const f = B.group();
      f.position.set(x, 0, z);
      B.add(knurl, mat('metal.feet'), S('metal.feet'), f);
      B.plain(stem, F.steel, f).position.y = 33;
      for (let k = 0; k < 24; k++) {
        const r = B.plain(new THREE.BoxGeometry(1.2, 17, 1.2), F.darkGap, f);
        const a = (k / 24) * Math.PI * 2;
        r.position.set(Math.cos(a) * 25.1, 11, Math.sin(a) * 25.1);
        r.rotation.y = -a;
      }
    }
  }

  // =========================================================================
  // Front aus Edelstahl (innerhalb der Haube), Trennfuge, Purge-Mulde
  // =========================================================================
  B.stage('front');
  const frontMat = mat('metal.front');
  {
    const inset = HOOD.map(([x, y]) => [Math.max(0, x - 2.5), y > 360 ? y - 2.5 : y < 60 ? y + 4 : y]);
    const pts = [...inset.slice(1).map(([x, y]) => [x, y]), ...inset.slice(1).reverse().map(([x, y]) => [-x, y])];
    const sh = filletShape(pts, 4, 3);
    B.add(boxProjectUV(plateZ(sh, -8, 7.5, 0.5, 32)), frontMat, S('metal.front'));
    // Fuge zwischen oberem und unterem Frontblech
    B.plain(new THREE.BoxGeometry(372, 1.2, 0.6), F.darkGap).position.set(0, 257.3, -0.2);
  }
  // Manometer (Dampfkessel) unten links: Frontzeichnung zeigt Lünette mit Zeiger, Werksbild
  // weißes Zifferblatt mit rotem Zeiger
  const gauge = buildGauge(B, { slot: S('metal.wands'), x: -124, y: 174, z: -0.5, R: 18.5, bezel: 3, spec: { id: 'e1-steam', max: 3, step: 0.5, label: 1, value: 1.3, unit: 'bar', zone: [1, 1.5] } });

  // =========================================================================
  // Haube (Oberteil, Seiten, Rückwand) mit Tassenwärmer
  // =========================================================================
  B.stage('hood');
  {
    // Querschnitt der Haube als Blechring (außen HOOD, innen 2,5 mm versetzt)
    const outer = [...HOOD.slice(1), ...HOOD.slice(1).reverse().map(([x, y]) => [-x, y])];
    const shape = filletShape(outer, [8, 8, 10, 30, 30, 20, 10, 2, 2, 10, 20, 30, 30, 10, 8, 8], 5);
    const innerPts = [...HOOD.slice(1).map(([x, y]) => [x - 2.5, y > 360 ? y - 2.5 : y + (y < 60 ? 2.5 : 0)]), ...HOOD.slice(1).reverse().map(([x, y]) => [-(x - 2.5), y > 360 ? y - 2.5 : y + (y < 60 ? 2.5 : 0)])];
    const hole = new THREE.Path();
    const ish = filletShape(innerPts, 6, 4);
    hole.setFromPoints(ish.getPoints(4));
    shape.holes.push(hole);
    const g = plateZ(shape, -370, 370, 0.6, 24);
    // hintere Kante schräg (Rückwand lehnt nach hinten)
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getZ(i) < -200) p.setZ(i, zr(p.getY(i)) + (p.getZ(i) + 370) * 0.2);
    }
    g.computeVertexNormals();
    B.add(boxProjectUV(g), hoodMat, S('body.main'));
    // Rückwand (oberer Teil), unten die Lichtblende
    const back = new THREE.Shape(outer.filter(([, y]) => y > 108).map(([x, y]) => new THREE.Vector2(x, y)));
    const bg = plateZ(back, -2.5, 2.5, 0.5, 8);
    const bp = bg.attributes.position;
    for (let i = 0; i < bp.count; i++) bp.setZ(i, zr(bp.getY(i)) + 0.5 + bp.getZ(i));
    bg.computeVertexNormals();
    B.add(boxProjectUV(bg), hoodMat, S('body.main'));
    // Tassenwärmer 330 × 280 (vertieftes Edelstahlblech mit Schlitzen)
    const fields = [
      { x: 30, y: 40, w: 90, h: 200, pitch: 12, slot: 4, dir: 'rows' },
      { x: 210, y: 40, w: 90, h: 200, pitch: 12, slot: 4, dir: 'rows' },
    ];
    const tex = makeSlotFieldTexture(330, 280, fields, { brushed: 'x', pxPerMM: 3 });
    const cm = mat('metal.cup', { map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide });
    const cg = new THREE.PlaneGeometry(330, 280);
    cg.rotateX(-Math.PI / 2);
    B.add(cg, cm, S('metal.cup')).position.set(0, 366.5, -30 - 140);
    B.plain(new THREE.BoxGeometry(326, 1, 276), F.trayInner).position.set(0, 360, -170);
    // Tassenreling (Seitenansicht des EXP-Prospekts: Pfosten vorn und hinten); die
    // Werksbilder der aktuellen E1 Prima zeigen die Haube ohne Reling -> Option
    for (const sx of [-1, 1]) {
      for (const z of [-3.5, -319]) railParts.push(B.add(rbox(6, 9, 6, 1.5, 2), mat('metal.cup'), S('metal.cup')));
      railParts.at(-2).position.set(sx * 166, 375, -3.5);
      railParts.at(-1).position.set(sx * 166, 375, -319);
      railParts.push(B.add(boxProjectUV(rbox(4, 3, 318, 1.2, 2)), mat('metal.cup'), S('metal.cup')));
      railParts.at(-1).position.set(sx * 166, 378, -161);
    }
  }
  // Rückblende unten: ab Werk beleuchtet, bei rb.crafts Eiche mit Rautenmuster
  B.stage('rear');
  const rearLight = B.plain(new THREE.BoxGeometry(372, 50, 3), new THREE.MeshStandardMaterial({ color: 0xf4efe4, emissive: 0x6a5a3a, emissiveIntensity: 0.6, roughness: 0.4 }));
  rearLight.position.set(0, 83, zr(83) + 1.6);
  rearLight.rotation.x = Math.atan(0.124);
  const rearWood = B.group();
  {
    const g = boxProjectUV(rbox(372, 50, 6, 1.2, 2));
    woodBoxUV(g, 0, [0.2, 0.4]);
    B.add(g, mat('wood.rear'), S('wood.rear'), rearWood);
    const lines = B.plain(new THREE.PlaneGeometry(370, 48), new THREE.MeshStandardMaterial({ color: 0x2a1a10, alphaMap: makeDiamondMask(), transparent: true, depthWrite: false, roughness: 0.8 }), rearWood);
    lines.rotation.y = Math.PI;
    lines.position.z = -3.1;
    rearWood.position.set(0, 83, zr(83) + 1);
    rearWood.rotation.x = Math.atan(0.124);
    // Licht unter der Holzblende
    const glow = B.plain(new THREE.BoxGeometry(368, 2, 4), new THREE.MeshBasicMaterial({ color: 0xffc070 }), rearWood);
    glow.position.set(0, -25.5, 1);
  }
  // Chevron hinten: erhabene, polierte Klinge über rund 85 % der Rückwandbreite, die Arme
  // laufen zu den Enden spitz aus (Werksbilder: Höhe 40 % unter der Oberkante, also y 265)
  {
    const top = [[-158, 10.5], [-110, 8.6], [-60, 6.2], [-17, 4], [0, -13.5], [17, 4], [60, 6.2], [110, 8.6], [158, 10.5]];
    const bot = [[158, 10.5], [110, 6.4], [60, 2.6], [19, 0], [0, -20.5], [-19, 0], [-60, 2.6], [-110, 6.4]];
    const sh = new THREE.Shape([...top, ...bot].map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 2.2, bevelEnabled: true, bevelThickness: 1, bevelSize: 0.6, bevelOffset: -0.6, bevelSegments: 3, curveSegments: 4 });
    const grp = B.group();
    B.add(boxProjectUV(g), mm.get(S('metal.chevron')), S('metal.chevron'), grp);
    grp.position.set(0, 265, zr(265) - 0.2);
    grp.rotation.set(0, Math.PI, 0);
    grp.rotateX(Math.atan(0.124));
  }

  // =========================================================================
  // Gruppenhaube mit Ghost-Display, Brühgruppe darunter
  // =========================================================================
  B.stage('cover');
  {
    // Gruppenhaube: rundlicher Helm (Werksbilder), Maße aus Front- und Seitenzeichnung:
    // 125 mm breit, 262…361 mm hoch, vorn bis 103 mm; die obere Front fällt schräg ab
    // und trägt das Display, alle Kanten großzügig gerundet
    const rows = COVER_ROWS;
    B.add(boxProjectUV(coverLoft(rows, 12)), mat('metal.cover'), S('metal.cover'));
    // Display mit Tasten auf der Schräge (y 337…357), der Wölbung der Haube folgend
    const dt = makeGhostDisplay();
    const disp = B.plain(coverPatch(84, 337, 357.5, 0.45), new THREE.MeshPhysicalMaterial({ map: dt, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, emissive: 0xffffff, emissiveMap: dt, emissiveIntensity: 0.18, transparent: true, alphaTest: 0.5 }));
    disp.castShadow = false;
    // Schriftzug "Victoria Arduino" oben auf der Haube
    const sm = B.plain(new THREE.PlaneGeometry(64, 12), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, transparent: true, alphaMap: makeScript(), depthWrite: false }));
    sm.rotation.x = -Math.PI / 2;
    sm.position.set(0, 361.5, 22);
    sm.castShadow = false;
    // Brühgruppe (Ring) unter der Haube
    B.add(latheY([[0, 249.5], [36, 249.5], [41, 251], [43, 254], [43, 262.5], [0, 262.5]], 64), mat('metal.cover'), S('metal.cover')).position.set(0, 0, GZ);
    B.plain(new THREE.CylinderGeometry(33, 33, 1.5, 40), F.gasket).position.set(0, 249.2, GZ);
  }

  // =========================================================================
  // Hebel (Dampf links, Heißwasser rechts) mit runden Sockeln
  // =========================================================================
  B.stage('levers');
  const leverMat = mat('metal.levers');
  {
    const base = latheZ([[24.75, 0], [24.75, 5], [23.5, 7.5], [16, 8.5], [0, 8.5]], 48);
    const base2 = latheZ([[24, 0], [24, 5], [22.8, 7.5], [10, 8.2], [0, 8.2]], 48);
    // Rändelung am Rand der runden Sockel (Frontzeichnung)
    const knurl = [];
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2;
      const gk = new THREE.BoxGeometry(0.9, 0.9, 4.2).toNonIndexed();
      gk.translate(0, 0, 2.6);
      gk.rotateZ(a);
      gk.translate(Math.cos(a + Math.PI / 2) * 0, 0, 0);
      const m4 = new THREE.Matrix4().makeTranslation(Math.cos(a) * 24.6, Math.sin(a) * 24.6, 0);
      gk.applyMatrix4(m4);
      knurl.push(gk);
    }
    const knurlG = mergeGeos(...knurl);
    for (const sx of [-1, 1]) {
      B.add(base, leverMat, S('metal.levers')).position.set(sx * 124, 334, 0);
      B.add(base2, leverMat, S('metal.levers')).position.set(sx * 124, 288, 0);
      for (const y of [334, 288]) B.plain(knurlG, F.darkGap).position.set(sx * 124, y, 0);
      // Hebel: Paddel mit Rillen, leicht nach vorn geneigt
      // Hebel als gewölbtes Paddel (Werksbilder): unten schmal, oben breit, nach vorn geneigt
      const lv = pillLoft([
        [328, 10.5, 3, 14, 5],
        [335, 13.5, 2.5, 17, 6.5],
        [350, 16, 3, 21, 8],
        [365, 17.5, 5, 24.5, 8.5],
        [376, 18, 7.5, 26, 9],
        [381, 16.5, 9, 26, 8],
        [383.6, 12, 11.5, 24, 5.5],
      ]);
      const m = B.add(boxProjectUV(lv), leverMat, S('metal.levers'));
      m.position.x = sx * 124;
      for (let k = 0; k < 5; k++) {
        const rib = B.plain(new THREE.BoxGeometry(22, 1, 1.2), F.darkGap);
        rib.position.set(sx * 124, 364 + k * 3.6, 24.1 + k * 0.42);
      }
    }
  }

  // =========================================================================
  // Dampflanze (links, Cool Touch) und Heißwasser (rechts)
  // =========================================================================
  B.stage('wands');
  const wandMat = mat('metal.wands');
  {
    const steam = [
      [-124, 288, 8],
      [-124, 293, 40],
      [-124, 314, 62],
      [-124, 340, 84],
      [-124, 350, 102],
      [-124, 341, 117],
      [-124, 322, 123],
      [-124, 290, 128],
      [-124, 230, 134],
      [-124, 162, 140],
    ];
    B.add(tubeAlong(steam, 5, 140, 20), wandMat, S('metal.wands'));
    for (const [y, z] of [
      [323, 123],
      [286, 128.4],
    ]) {
      const k = B.plain(new THREE.CylinderGeometry(7, 7, 14, 24), F.rubber);
      k.position.set(-124, y, z);
      k.rotation.x = -0.1;
    }
    B.add(latheY([[0, 152], [4, 152], [6, 154], [6.3, 160], [5, 164], [0, 164]], 24), wandMat, S('metal.wands')).position.set(-124, 0, 140.6);
    const hw = [
      [124, 288, 8],
      [124, 286, 24],
      [124, 270, 30],
      [124, 246, 30],
    ];
    B.add(tubeAlong(hw, 5, 60, 20), wandMat, S('metal.wands'));
    B.add(latheY([[0, 208], [12.5, 208], [12.5, 214], [9, 236], [6.5, 246], [0, 246]], 32), wandMat, S('metal.wands')).position.set(124, 0, 30);
  }

  // =========================================================================
  // Siebträger (Pure Brew), Griff mit Gummi und Bügel
  // =========================================================================
  B.stage('portafilter');
  {
    const pfMat = mat('metal.portafilter');
    const pf = B.group();
    pf.position.set(0, 0, GZ);
    B.add(latheY([[0, 225], [26, 225], [31, 228], [32.4, 232], [32.4, 245], [33.4, 246], [33.4, 249], [27, 249]], 48), pfMat, S('metal.portafilter'), pf);
    for (const sx of [-1, 1]) B.add(rbox(9, 6, 17, 2, 2), pfMat, S('metal.portafilter'), pf).position.set(sx * 36.5, 245.5, 0);
    B.add(latheY([[0, 206], [7, 206], [12, 214], [17, 225], [0, 225]], 32), pfMat, S('metal.portafilter'), pf).position.z = -14;
    const handle = B.group(pf);
    handle.position.set(0, 236, 0);
    handle.rotation.x = 0.1;
    B.add(latheZ([[0, 40], [10.5, 40], [10.5, 48], [9.5, 70], [10.5, 120], [0, 120]], 32), pfMat, S('metal.portafilter'), handle);
    const gp = latheZ([[0, 118], [17, 118], [20, 130], [21, 160], [19, 172], [0, 174]], 40);
    const uv = gp.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.3, uv.getY(i) * 0.15 + 0.5);
    B.add(gp, mat('wood.handle'), S('wood.handle'), handle);
    const loop = B.add(new THREE.TorusGeometry(16, 3, 10, 32, Math.PI), pfMat, S('metal.portafilter'), handle);
    loop.position.z = 172;
    loop.rotation.z = Math.PI / 2;
    loop.rotation.y = Math.PI / 2;
  }

  // =========================================================================
  // Tropfschale: Front mit großen Rundungen, Lochblech
  // =========================================================================
  B.stage('drip');
  const trayMat = mat('metal.tray');
  {
    const sh = filletShape([[-190, 101], [190, 101], [190, 70], [150, 58], [-150, 58], [-190, 70]], [2, 2, 30, 20, 20, 30], 6);
    const g = plateZ(sh, 0, 140, 3, 24);
    B.add(boxProjectUV(g), trayMat, S('metal.tray'));
    const fields = [];
    for (let r = 0; r < 9; r++) fields.push({ x: 12, y: 10 + r * 13, w: 346, h: 5, pitch: 13, slot: 5, dir: 'rows' });
    const tex = makeSlotFieldTexture(370, 130, fields, { brushed: 'x', pxPerMM: 3 });
    const gm = mat('metal.grates', { map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide });
    const gg = new THREE.PlaneGeometry(370, 130);
    gg.rotateX(-Math.PI / 2);
    B.add(gg, gm, S('metal.grates')).position.set(0, 101.3, 70);
    B.plain(new THREE.BoxGeometry(366, 1, 126), F.trayInner).position.set(0, 80, 70);
  }

  // =========================================================================
  // Schriftzug "E1 PRIMA" (Plakette unten rechts)
  // =========================================================================
  B.stage('logo');
  {
    // erhabene Plakette (110 × 18,4 mm) mit eingravierter Bildmarke "E1" (Umrissbuchstaben)
    // und "PRIMA" wie in Frontzeichnung und Werksbildern; bei rb.crafts aus Holz
    const plate = B.add(boxProjectUV(rbox(109.6, 18.4, 2.6, 2.2, 3)), mat('metal.logo'), S('metal.logo'));
    plate.position.set(121.8, 157, 1.3);
    const c = makeCanvas(1024, 172);
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, 1024, 172);
    g.strokeStyle = '#fff';
    g.fillStyle = '#fff';
    g.lineWidth = 9;
    g.lineJoin = 'round';
    // "E": offenes Rechteck mit Mittelsteg, "1": schmaler Rahmen (geometrische Bildmarke)
    g.beginPath();
    g.moveTo(250, 30);
    g.lineTo(40, 30);
    g.lineTo(40, 142);
    g.lineTo(250, 142);
    g.moveTo(40, 86);
    g.lineTo(200, 86);
    g.stroke();
    g.strokeRect(270, 30, 60, 112);
    g.font = '400 92px "Helvetica Neue", Arial, sans-serif';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    const letters = 'PRIMA';
    let x = 470;
    for (const ch of letters) {
      g.fillText(ch, x, 90);
      x += g.measureText(ch).width + 34;
    }
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    const eng = B.plain(new THREE.PlaneGeometry(103, 17.3), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6, transparent: true, alphaMap: t, depthWrite: false }));
    eng.position.set(121.8, 157, 2.65);
    eng.castShadow = false;
  }

  // =========================================================================
  // Innenleben: Dampfkessel, NEO-Brühmodul, Pumpe, Elektronik
  // =========================================================================
  {
    B.sk('sk-base');
    B.skBox(360, 4, 320, F.frame, 0, 48, -180, 2);
    B.sk('sk-boiler');
    B.skCyl(60, 200, F.steel, -70, 200, -200, 'z', 40);
    B.sk('sk-neo');
    B.skBox(90, 80, 90, F.motor, 0, 290, -40, 6);
    B.sk('sk-pump');
    B.skCyl(28, 80, F.motor, 110, 110, -220, 'z');
    B.sk('sk-pcb');
    B.skBox(160, 90, 2, F.pcb, 60, 200, -330, 1);
    B.sk('sk-pipes');
    B.pipe([[110, 110, -180], [60, 200, -120], [0, 270, -60]], 3, F.copper);
    B.pipe([[-70, 260, -150], [-110, 290, -40], [-124, 288, -10]], 3.4, F.copper);
    B.pipe([[-30, 260, -150], [80, 290, -50], [124, 288, -10]], 3, F.copper);
  }

  root.scale.setScalar(0.001);
  return {
    root,
    pickables: B.pickables,
    skeleton: B.skeleton,
    stages: STAGES,
    isInner,
    setBarista() {},
    sync(config) {
      gauge.set({ dial: 'white', needle: 'red' });
      const o = config.opts?.[ID] || {};
      for (const m of railParts) m.visible = o.rail === 'yes';
      const wood = config.slots[S('wood.rear')]?.id !== 'none';
      rearWood.visible = wood;
      rearLight.visible = !wood;
    },
  };
}

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------
const CATEGORIES = {
  [S('body')]: {
    title: 'Gehäuse',
    allLabel: 'Komplett',
    slots: [{ key: S('body.main'), label: 'Haube (Oberteil, Seiten, Rückwand)' }],
  },
  [S('wood')]: {
    title: 'Holz',
    allLabel: 'Alle',
    slots: [
      { key: S('wood.handle'), label: 'Siebträgergriff' },
      { key: S('wood.rear'), label: 'Rückblende (Rautenmuster)', panel: true },
    ],
  },
  [S('metal')]: {
    title: 'Metallakzente',
    allLabel: 'Alle',
    slots: [
      { key: S('metal.cover'), label: 'Gruppenhaube & Brühgruppe' },
      { key: S('metal.levers'), label: 'Hebel & Sockel' },
      { key: S('metal.wands'), label: 'Dampflanze & Heißwasser' },
      { key: S('metal.portafilter'), label: 'Siebträger' },
      { key: S('metal.front'), label: 'Frontblech' },
      { key: S('metal.tray'), label: 'Tropfschale' },
      { key: S('metal.grates'), label: 'Tropfblech' },
      { key: S('metal.cup'), label: 'Tassenwärmer & Reling' },
      { key: S('metal.feet'), label: 'Füße' },
      { key: S('metal.chevron'), label: 'Chevron hinten' },
      { key: S('metal.logo'), label: 'Plakette E1 Prima', woodLogo: true },
    ],
  },
};
const SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));
const OPTIONS = [
  {
    key: 'rail',
    label: 'Tassenreling',
    choices: [
      { id: 'no', name: 'Ohne (aktuelle Serie)' },
      { id: 'yes', name: 'Mit Reling (EXP)' },
    ],
  },
];
const steelAll = Object.fromEntries(CATEGORIES[S('metal')].slots.map((s) => [s.key, { id: 'steel', finish: 'satin' }]));
function preset(name, swatches, slots) {
  return { name, swatches, config: { slots: { [S('wood.rear')]: { id: 'none', finish: 'oiled' }, ...steelAll, ...slots }, opts: { rail: 'no' } } };
}
const GOLD = { id: 'gold', finish: 'gloss' };
const PRESETS = [
  // "Custom Victoria Arduino Weiß-Gold" (rb.crafts): weiße Haube, goldene Akzente, Eiche
  preset('Weiß · Gold · Eiche (rb.crafts)', ['#efefea', '#e1b866', '#d99c52'], {
    [S('body.main')]: { id: 'RAL9016', finish: 'gloss' },
    [S('metal.cover')]: GOLD,
    [S('metal.levers')]: GOLD,
    [S('metal.wands')]: GOLD,
    [S('metal.portafilter')]: GOLD,
    [S('metal.chevron')]: GOLD,
    [S('metal.feet')]: { id: 'white', finish: 'matte' },
    [S('wood.handle')]: { id: 'oak', finish: 'oiled' },
    [S('wood.rear')]: { id: 'oak', finish: 'oiled' },
    [S('metal.logo')]: { id: 'wood:oak', finish: 'oiled' },
  }),
  preset('Schwarz · Walnuss', ['#141414', '#644434', '#cfd1d3'], {
    [S('body.main')]: { id: 'RAL9005', finish: 'matte' },
    [S('metal.cover')]: { id: 'dlc', finish: 'matte' },
    [S('metal.levers')]: { id: 'dlc', finish: 'matte' },
    [S('metal.feet')]: { id: 'black', finish: 'matte' },
    [S('wood.handle')]: { id: 'walnut', finish: 'oiled' },
    [S('wood.rear')]: { id: 'walnut', finish: 'oiled' },
    [S('metal.logo')]: { id: 'wood:walnut', finish: 'oiled' },
  }),
  preset('Weiß (Werk)', ['#efefea', '#cfd1d3', '#161616'], {
    [S('body.main')]: { id: 'RAL9016', finish: 'gloss' },
    [S('metal.cover')]: { id: 'chrome', finish: 'gloss' },
    [S('metal.feet')]: { id: 'grey', finish: 'matte' },
    [S('wood.handle')]: { id: 'black', finish: 'oiled' },
  }),
  preset('Edelstahl (Werk)', ['#c6c2c3', '#cfd1d3', '#161616'], {
    [S('body.main')]: { id: '4201E79975L30', finish: 'gloss' },
    [S('metal.cover')]: { id: 'chrome', finish: 'gloss' },
    [S('metal.feet')]: { id: 'grey', finish: 'matte' },
    [S('wood.handle')]: { id: 'black', finish: 'oiled' },
  }),
  preset('Schwarz (Werk)', ['#141414', '#cfd1d3', '#161616'], {
    [S('body.main')]: { id: 'RAL9005', finish: 'gloss' },
    [S('metal.cover')]: { id: 'chrome', finish: 'gloss' },
    [S('metal.feet')]: { id: 'grey', finish: 'matte' },
    [S('wood.handle')]: { id: 'black', finish: 'oiled' },
  }),
];

registerDevice({
  id: ID,
  kind: 'machine',
  brand: 'Victoria Arduino',
  name: 'Eagle One Prima',
  full: 'Victoria Arduino Eagle One Prima',
  file: 'E1-Prima',
  code: 'VAE',
  dims: { w: 411, d: 510, h: 379 },
  rootZ: 0.1,
  shadow: { w: 0.6, d: 0.66, z: -0.1 },
  frame: { target: [0, 0.19, 0], scale: 1.05 },
  slots: SLOTS,
  categories: CATEGORIES,
  presets: PRESETS,
  options: OPTIONS,
  optionsTitle: 'Ausstattung',
  build: (mm) => buildE1(mm),
  UI: DeviceUI,
  roles: {
    body: [S('body.main')],
    accent: [S('metal.cover'), S('metal.levers'), S('metal.wands'), S('metal.portafilter'), S('metal.feet'), S('metal.chevron')],
    wood: [S('wood.handle')],
    screws: [],
    logo: [S('metal.logo')],
  },
  stageLabels: {
    'sk-base': ['Bodenblech', 'Stahl'],
    'sk-boiler': ['Dampfkessel', 'Edelstahl, isoliert'],
    'sk-neo': ['NEO-Brühmodul', ''],
    'sk-pump': ['Pumpe', ''],
    'sk-pcb': ['Steuerung', 'Elektronik'],
    'sk-pipes': ['Leitungen', 'Kupfer'],
    feet: ['Füße', S('metal.feet')],
    front: ['Frontblech', S('metal.front')],
    hood: ['Haube', S('body.main')],
    rear: ['Rückblende', [S('wood.rear')]],
    cover: ['Gruppenhaube', S('metal.cover')],
    levers: ['Hebel', S('metal.levers')],
    wands: ['Dampflanze & Heißwasser', S('metal.wands')],
    portafilter: ['Siebträger', [S('metal.portafilter'), S('wood.handle')]],
    drip: ['Tropfschale', [S('metal.tray'), S('metal.grates')]],
    tray: ['Tassenwärmer', S('metal.cup')],
    logo: ['Plakette', S('metal.logo')],
  },
});
