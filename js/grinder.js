// ---------------------------------------------------------------------------
// Prozedurales 3D-Modell der Mühle Weber Workshops EG-1 (aktuelle Ausführung)
//
// Maße in Millimeter. Grundlage: Herstellerangaben (D235 × W245 × H456 mm) und
// die maßstäblichen Produktansichten von Weber Workshops (links, vorne, hinten),
// vermessen mit Millimeterraster (siehe README). Details nach den Produktfotos.
//
// Koordinaten wie bei der Maschine: X = Breite (rechts), Y = Höhe (0 = Stellfläche),
// Z = Tiefe (+Z = Front). Der Sockel steht mittig um den Ursprung.
//
// Der Korpus ist um 45° geneigt: Motor hinten oben, Mahlwerk vorne unten. Seine
// Teile werden in einem eigenen Koordinatensystem gebaut (t = Länge entlang der
// Achse, 0 = Rückseite; Y' = quer, +Y' zeigt zum Trichter).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, rbox, profileExtrudeX, extrudeZ, woodBoxUV } from './model.js';
import { makeCanvas } from './noise.js';

/** Hauptmaße (mm) */
export const EG1 = {
  width: 245,
  depth: 235,
  height: 456,
  baseLow: 20, // untere Stufe des Sockels
  baseTop: 38, // obere Stufe (hinten)
  // Korpusachse: Mitte der Rückseite und Neigung
  axis: { y: 420.5, z: -115, tilt: Math.PI / 4 },
  cupZ: 78,
  funnelZ: 64,
};

const V3 = THREE.Vector3;
const BODY_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(EG1.axis.tilt, 0, 0));
const BODY_P = new V3(0, EG1.axis.y, EG1.axis.z);
/** Punkt im Korpus-System (x, Y', t) -> Modellkoordinaten */
const bodyPoint = (x, y, t) => new V3(x, y, t).applyQuaternion(BODY_Q).add(BODY_P);

/**
 * Montageschritte der Mühle (gleiche Felder wie bei der Maschine, siehe assembly.js).
 * Innenleben: Platine, Motor, Antrieb, Mahlscheiben, Kabel – dann die konfigurierten Teile.
 */
export const GRINDER_STAGES = [
  { id: 'gbase', from: [0, 1, 0], dist: 420, gap: 0, dur: 0.75, drop: true },
  { id: 'gsk-pcb', src: 'skeleton', from: [0, 0.2, -1], dist: 700, gap: 0.5, dur: 0.6, stagger: 0.08 },
  { id: 'gblock', from: [0, 0.1, -1], dist: 800, gap: 0.45, dur: 0.75, heavy: true },
  { id: 'gcolumn', from: [0, 1, 0], dist: 700, gap: 0.45, dur: 0.8, heavy: true },
  { id: 'gsk-motor', src: 'skeleton', from: [-0.2, 0.8, -1], dist: 900, gap: 0.45, dur: 0.85, spin: [[0, 0, 1], Math.PI * 2] },
  { id: 'gsk-drive', src: 'skeleton', from: [0, -0.4, 1], dist: 900, gap: 0.4, dur: 0.75 },
  { id: 'gsk-burrs', src: 'skeleton', from: [0, -0.5, 1], dist: 800, gap: 0.4, dur: 0.85, stagger: 0.2, spin: [[0, 0, 1], Math.PI * 3] },
  { id: 'gsk-wires', src: 'skeleton', grow: true, gap: 0.35, dur: 0.7, stagger: 0.25 },
  { id: 'ghousing', from: [0, 0.75, -1], dist: 1000, gap: 0.45, after: true, dur: 0.95, heavy: true },
  { id: 'grails', perSide: true, dist: 900, gap: 0.45, dur: 0.85 },
  { id: 'gdial', from: [0, -0.6, 1], dist: 900, gap: 0.45, dur: 0.75, spin: [[0, 0, 1], Math.PI * 2] },
  { id: 'gchamber', from: [0, -0.5, 1], dist: 950, gap: 0.3, dur: 0.75, heavy: true },
  { id: 'gfront', from: [0, -0.2, 1], dist: 900, gap: 0.35, dur: 0.65 },
  { id: 'gfunnel', from: [0, 1, 0], dist: 700, gap: 0.45, dur: 0.8, spin: [[0, 1, 0], Math.PI] },
  { id: 'glid', from: [0, 1, 0], dist: 500, gap: 0.3, dur: 0.6 },
  { id: 'gplatform', from: [0, -0.2, 1], dist: 800, gap: 0.4, dur: 0.7 },
  { id: 'gcup', from: [0, 1, 0], dist: 500, gap: 0.35, dur: 0.75, drop: true },
  { id: 'gknob', pop: true, gap: 0.35, dur: 0.4 },
  { id: 'gscrews', pop: true, gap: 0.4, dur: 0.3, stagger: 0.03 },
  { id: 'glogo', pop: true, gap: 0.35, dur: 0.5 },
];
export const isGrinderInner = (id) => id.startsWith('gsk-');

// ---------------------------------------------------------------------------
// Geometrie-Helfer
// ---------------------------------------------------------------------------

/** Polygon mit abgerundeten Ecken als Shape (Punkte gegen den Uhrzeigersinn) */
function filletShape(points, r, seg = 4) {
  const shape = new THREE.Shape();
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p = new THREE.Vector2(...points[i]);
    const a = new THREE.Vector2(...points[(i + n - 1) % n]);
    const b = new THREE.Vector2(...points[(i + 1) % n]);
    const da = a.clone().sub(p);
    const db = b.clone().sub(p);
    const rr = Math.min(r, da.length() / 2.2, db.length() / 2.2);
    const p0 = p.clone().add(da.normalize().multiplyScalar(rr));
    const p1 = p.clone().add(db.normalize().multiplyScalar(rr));
    if (i === 0) shape.moveTo(p0.x, p0.y);
    else shape.lineTo(p0.x, p0.y);
    // quadratische Bézierkurve durch die Ecke ~ Rundung
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

/** Achteck (Querschnitt des Korpus) mit Fasen und gerundeten Kanten, Breite w, Höhe h */
function octagon(w, h, c, r = 4) {
  const x = w / 2;
  const y = h / 2;
  return filletShape(
    [
      [-x + c, -y],
      [x - c, -y],
      [x, -y + c],
      [x, y - c],
      [x - c, y],
      [-x + c, y],
      [-x, y - c],
      [-x, -y + c],
    ],
    r,
  );
}

/**
 * Körper entlang der Korpusachse: Querschnitt (Funktion des Einzugs), von t0 bis t1, gerundete
 * Stirnkanten. Die Fase von extrudeZ trägt 0,85 × bevel nach außen auf – der Querschnitt wird um
 * diesen Betrag eingezogen, damit die Außenmaße stimmen.
 */
function prism(shapeFn, t0, t1, bevel = 3) {
  const g = extrudeZ(shapeFn(bevel * 0.85), t1 - t0 - bevel * 2, bevel, 3, 6);
  g.translate(0, 0, t0);
  return boxProjectUV(g, 60);
}

/** Drehteil um die Korpusachse: Profil [[r, t], ...] (von hinten nach vorne) */
function latheT(profile, seg = 64) {
  const g = new THREE.LatheGeometry(profile.map(([r, t]) => new THREE.Vector2(r, t)), seg);
  g.rotateX(Math.PI / 2);
  return boxProjectUV(g, 60);
}

/** Senkrechtes Drehteil (Achse Y): Profil [[r, y], ...] von unten nach oben */
function latheY(profile, seg = 64) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  return boxProjectUV(g, 60);
}

/** Skala des Einstellrings: Zahlen 0–9 mit Teilstrichen (weiß auf transparent) */
function makeDialTexture() {
  const W = 2048;
  const H = 128;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 44px "Inter", "Helvetica Neue", Arial, sans-serif';
  const steps = 100;
  for (let i = 0; i < steps; i++) {
    const x = (i / steps) * W + W / steps / 2;
    const major = i % 10 === 0;
    const half = i % 5 === 0;
    ctx.lineWidth = major ? 4 : 2.4;
    const len = major ? 46 : half ? 30 : 20;
    ctx.beginPath();
    ctx.moveTo(x, H - 6);
    ctx.lineTo(x, H - 6 - len);
    ctx.stroke();
    if (major) ctx.fillText(String((10 - i / 10) % 10), x, 34);
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Logo: stilisiertes doppeltes W (Maske, weiß auf schwarz) */
function makeLogoMask() {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#fff';
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  const w = (y, lw, s) => {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(128 - 96 * s, y - 44 * s);
    ctx.lineTo(128 - 48 * s, y + 40 * s);
    ctx.lineTo(128, y - 20 * s);
    ctx.lineTo(128 + 48 * s, y + 40 * s);
    ctx.lineTo(128 + 96 * s, y - 44 * s);
    ctx.stroke();
  };
  w(92, 14, 0.82);
  w(160, 30, 1);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

/** Zahnbild der Mahlscheiben (Innenleben) als Farbtextur */
function makeBurrTexture() {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9ccd0';
  ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  for (let i = 0; i < 72; i++) {
    ctx.rotate((Math.PI * 2) / 72);
    ctx.fillStyle = i % 2 ? '#8d9196' : '#e3e5e8';
    ctx.beginPath();
    ctx.moveTo(60, -3);
    ctx.lineTo(250, -9);
    ctx.lineTo(250, 9);
    ctx.lineTo(60, 3);
    ctx.fill();
  }
  ctx.fillStyle = '#3a3c40';
  ctx.beginPath();
  ctx.arc(0, 0, 58, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
export function buildGrinder(mm) {
  const root = new THREE.Group();
  root.name = 'EG1';
  const pickables = [];
  const F = mm.fixed;
  let stage = 'gbase';
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
  /** Gruppe im Korpus-System (eigener Montageschritt) */
  const bodyGroup = () => {
    const g = new THREE.Group();
    g.position.copy(BODY_P);
    g.quaternion.copy(BODY_Q);
    root.add(g);
    return g;
  };

  const M = {
    housing: mm.get('gbody.housing'),
    stand: mm.get('gbody.stand'),
    base: mm.get('gbody.base'),
    rails: mm.get('gmetal.rails'),
    cap: mm.get('gmetal.cap'),
    dial: mm.get('gmetal.dial'),
    funnel: mm.get('gmetal.funnel'),
    cup: mm.get('gmetal.cup'),
    platform: mm.get('gmetal.platform'),
    knob: mm.get('gmetal.knob'),
    screws: mm.get('gmetal.screws'),
    platen: mm.get('gwood.platen'),
    lid: mm.get('gwood.lid'),
  };

  // =========================================================================
  // Sockel: untere Platte über die ganze Fläche, hinten eine zweite Stufe mit
  // breiter Fase; vorne mittig eine Griffmulde, links Drehzahlknopf + Taste
  // =========================================================================
  stage = 'gbase';
  const HW = EG1.width / 2;
  const HD = EG1.depth / 2;
  {
    const low = profileExtrudeX(
      [
        [-HD, 0],
        [HD, 0],
        [HD, EG1.baseLow - 4],
        [HD - 4, EG1.baseLow],
        [-HD + 3, EG1.baseLow],
        [-HD, EG1.baseLow - 3],
      ],
      EG1.width,
      2.5,
    );
    low.translate(-HW, 0, 0);
    add(boxProjectUV(low, 60), M.base, 'gbody.base');
    const top = profileExtrudeX(
      [
        [-HD, EG1.baseLow - 1],
        [34, EG1.baseLow - 1],
        [16, EG1.baseTop],
        [-HD + 3, EG1.baseTop],
        [-HD, EG1.baseTop - 3],
      ],
      EG1.width - 6,
      2,
    );
    top.translate(-HW + 3, 0, 0);
    add(boxProjectUV(top, 60), M.base, 'gbody.base');
    // Griffmulde: flache Ellipse, deren Normalen zur Mitte zeigen -> wirkt vertieft
    {
      const g = new THREE.CircleGeometry(1, 48);
      g.rotateX(-Math.PI / 2);
      g.scale(64, 1, 15);
      const pos = g.attributes.position;
      const nor = g.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) / 64;
        const z = pos.getZ(i) / 15;
        const n = new V3(x * 0.55, 1, z * 0.9).normalize();
        nor.setXYZ(i, n.x, n.y, n.z);
      }
      boxProjectUV(g, 60);
      g.computeBoundingBox();
      const dish = add(g, M.base, 'gbody.base');
      dish.position.set(4, EG1.baseLow + 0.08, 96);
      dish.castShadow = false;
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 64), F.darkGap);
      rim.rotation.x = -Math.PI / 2;
      rim.scale.set(64, 15, 1);
      rim.position.set(4, EG1.baseLow + 0.1, 96);
      root.add(rim);
    }
    // Stromanschluss und Schalter an der Rückseite
    const inlet = new THREE.Mesh(rbox(24, 14, 3, 1, 1), F.blackPlastic);
    inlet.position.set(70, 11, -HD - 1);
    root.add(inlet);
    const sw = new THREE.Mesh(rbox(12, 15, 3, 1, 1), F.gasket);
    sw.position.set(96, 11, -HD - 1);
    root.add(sw);
    // Gummifüße
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 1.2, 20), F.rubber);
        foot.position.set(sx * (HW - 18), 0.4, sz * (HD - 18));
        root.add(foot);
      }
    }
  }

  // Elektronikblock hinter der Säule
  stage = 'gblock';
  {
    const blk = add(boxProjectUV(rbox(52, 128, 78, 2.5, 2), 60), M.stand, 'gbody.stand');
    blk.position.set(0, EG1.baseTop + 63, -66);
  }

  // =========================================================================
  // Säule: oben von der Unterseite des Korpus abgeschnitten
  // =========================================================================
  stage = 'gcolumn';
  {
    // Unterseite des Korpus (Y' = -44, etwas im Korpus versenkt): y = y0 - (z - z0) - 44·√2
    const topAt = (z) => EG1.axis.y - (z - EG1.axis.z) - 44 * Math.SQRT2;
    const z0 = -76;
    const z1 = 3.5;
    const col = profileExtrudeX(
      [
        [z0, EG1.baseTop - 1],
        [z1, EG1.baseTop - 1],
        [z1, topAt(z1)],
        [z0, topAt(z0)],
      ],
      26,
      1.5,
    );
    col.translate(-13, 0, 0);
    add(boxProjectUV(col, 60), M.stand, 'gbody.stand');
  }

  // =========================================================================
  // Korpus (Motorgehäuse + Mittelteil), Lüftungsschlitze
  // =========================================================================
  stage = 'ghousing';
  {
    const g = bodyGroup();
    add(prism((i) => octagon(106 - 2 * i, 106 - 2 * i, 20 - i, 6), 0, 110, 4), M.housing, 'gbody.housing', g);
    add(prism((i) => octagon(100 - 2 * i, 100 - 2 * i, 17 - i, 5), 108, 230, 4), M.housing, 'gbody.housing', g);
    // Lüftungsschlitze an der Rückseite
    for (let i = 0; i < 9; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(58, 1.8, 1), F.darkGap);
      slot.position.set(0, 10 + i * 4.2, -0.2);
      g.add(slot);
    }
  }

  // Seitenschienen (je Seite einzeln für die Montage)
  stage = 'grails';
  {
    const g = bodyGroup();
    for (const sx of [-1, 1]) {
      // breite Platte direkt am Korpus; der Einstellring läuft innen durch
      const r = add(boxProjectUV(rbox(21, 28, 248, 3, 2), 60), M.rails, 'gmetal.rails', g);
      r.position.set(sx * 61.5, 0, 104 + 124);
    }
  }

  // Einstellring mit Skala + Hals
  stage = 'gdial';
  {
    const g = bodyGroup();
    add(latheT([[0, 226], [31, 226], [32, 228], [32, 240], [0, 240]], 48), F.blackPlastic, null, g);
    add(
      latheT([[0, 240], [55, 240], [58, 241.5], [58, 260.5], [55, 262], [0, 262]], 96),
      M.dial,
      'gmetal.dial',
      g,
    );
    const dialInk = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5, map: makeDialTexture(), alphaTest: 0.45 });
    const dec = new THREE.CylinderGeometry(58.25, 58.25, 15, 128, 1, true, -Math.PI, Math.PI * 2);
    dec.rotateX(-Math.PI / 2);
    const decal = new THREE.Mesh(dec, dialInk);
    decal.position.z = 251;
    decal.receiveShadow = true;
    decal.userData.slot = 'gmetal.dial';
    g.add(decal);
    pickables.push(decal);
    root.userData.dialInk = dialInk;
  }

  // Mahlkammer und Frontkappe mit Logo
  stage = 'gchamber';
  {
    const g = bodyGroup();
    add(latheT([[0, 262], [56, 262], [57, 263], [57, 312], [0, 312]], 96), M.housing, 'gbody.housing', g);
    add(
      latheT(
        [
          [0, 312],
          [57, 312],
          [57, 337],
          [56.4, 340.2],
          [54.6, 342.6],
          [51.6, 344.1],
          [47, 344.6],
          [0, 344.6],
        ],
        96,
      ),
      M.cap,
      'gmetal.cap',
      g,
    );
    // Fuge zwischen Kammer und Kappe
    const seam = new THREE.Mesh(new THREE.TorusGeometry(57.05, 0.45, 6, 96), F.darkGap);
    seam.position.z = 312;
    g.add(seam);
  }
  stage = 'glogo';
  {
    const g = bodyGroup();
    const logoMat = mm.get('gmetal.logo', { alphaMap: makeLogoMask(), alphaTest: 0.4 });
    logoMat.userData.logo = { w: 22, h: 18 };
    const geo = new THREE.CylinderGeometry(57.3, 57.3, 18, 16, 1, true, -0.2, 0.4);
    geo.rotateX(-Math.PI / 2);
    const logo = add(geo, logoMat, 'gmetal.logo', g);
    logo.position.z = 322;
    logo.castShadow = false;
  }

  // Frontblock (verbindet die Schienen), Auslauf
  stage = 'gfront';
  {
    const g = bodyGroup();
    const shape = (i) =>
      filletShape(
        [
          [-62 + i, -31 + i],
          [62 - i, -31 + i],
          [62 - i, 29 - i],
          [-62 + i, 29 - i],
        ],
        9,
      );
    const blk = add(prism(shape, 338, 357, 2.5), M.rails, 'gmetal.rails', g);
    blk.userData.part = 'front';
    // Auslauf: zeigt senkrecht nach unten in den Becher
    const spout = add(boxProjectUV(rbox(34, 22, 26, 4, 2), 60), M.rails, 'gmetal.rails');
    spout.position.set(0, 150, EG1.cupZ + 2);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(9, 24), F.darkGap);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(0, 138.9, EG1.cupZ + 2);
    root.add(hole);
  }

  // =========================================================================
  // Trichter: runde Schale mit Rand, darunter ein Keil bis in den Korpus
  // =========================================================================
  stage = 'gfunnel';
  {
    const g = new THREE.Group();
    g.position.set(0, 0, EG1.funnelZ);
    root.add(g);
    add(
      latheY(
        [
          [17, 368],
          [22, 369],
          [56, 369.5],
          [59, 371],
          [59, 380.5],
          [58, 382],
          [55.5, 382],
          [50, 378],
          [22, 371.5],
          [17, 368],
        ],
        96,
      ),
      M.funnel,
      'gmetal.funnel',
      g,
    );
    const wedge = profileExtrudeX(
      [
        [-34, 369.5],
        [34, 369.5],
        [9, 316],
        [-9, 316],
      ],
      52,
      2,
    );
    wedge.translate(-26, 0, 0);
    add(boxProjectUV(wedge, 60), M.funnel, 'gmetal.funnel', g);
    const throat = new THREE.Mesh(new THREE.CircleGeometry(17, 32), F.darkGap);
    throat.rotation.x = -Math.PI / 2;
    throat.position.y = 368.2;
    g.add(throat);
  }
  // Holzdeckel (optional)
  stage = 'glid';
  const lid = new THREE.Group();
  lid.position.set(0, 0, EG1.funnelZ);
  root.add(lid);
  {
    const geo = latheY([[0, 381], [57.5, 381], [58.5, 383], [58.5, 391], [56, 394], [0, 394.5]], 96);
    woodBoxUV(geo, 2);
    add(geo, M.lid, 'gwood.lid', lid);
  }

  // =========================================================================
  // Becherteller mit Holzauflage, Arm und Halter an der Säule
  // =========================================================================
  stage = 'gplatform';
  {
    const g = new THREE.Group();
    root.add(g);
    add(latheY([[0, 46], [52, 46], [53.5, 47.5], [53.5, 54], [52, 55.5], [0, 55.5]], 96), M.platform, 'gmetal.platform', g).position.z = EG1.cupZ;
    const arm = add(boxProjectUV(rbox(22, 8, 40, 2, 1), 60), M.platform, 'gmetal.platform', g);
    arm.position.set(0, 50.5, 14);
    const holder = add(boxProjectUV(rbox(32, 24, 20, 2, 1), 60), M.platform, 'gmetal.platform', g);
    holder.position.set(0, 64, 12.5);
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 1.6, 6), F.darkGap);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(0, 64, 22.8);
    g.add(screw);
    // Holzauflage (Platen)
    const pg = latheY([[0, 55.4], [45, 55.4], [46, 56.2], [46, 57.6], [45, 58.4], [0, 58.4]], 96);
    woodBoxUV(pg, 2);
    add(pg, M.platen, 'gwood.platen', g).position.z = EG1.cupZ;
  }

  // Becher (Blind Shaker)
  stage = 'gcup';
  {
    const y0 = 58.4;
    const cup = latheY(
      [
        [0, y0 + 0.2],
        [34.5, y0 + 0.2],
        [36.5, y0 + 1.5],
        [37, y0 + 7],
        [35.6, y0 + 10],
        [37.2, y0 + 13],
        [38.5, y0 + 16],
        [38.5, y0 + 67.5],
        [37.6, y0 + 69.5],
        [35.6, y0 + 69.5],
        [35, y0 + 68],
        [35, y0 + 9],
        [0, y0 + 9],
      ],
      96,
    );
    add(cup, M.cup, 'gmetal.cup').position.z = EG1.cupZ;
  }

  // Drehzahlknopf und Taste vorne links
  stage = 'gknob';
  {
    const g = new THREE.Group();
    g.position.set(-90, EG1.baseLow, 70);
    root.add(g);
    // Rändel: viele flache Rillen
    const k = latheY([[0, 0], [11.5, 0], [12, 1], [12, 11], [11, 12.5], [0, 13]], 40);
    add(k, M.knob, 'gmetal.knob', g);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9, 0.9), F.darkGap);
      r.position.set(Math.cos(a) * 12, 6, Math.sin(a) * 12);
      g.add(r);
    }
    const btn = add(latheY([[0, 0], [8.5, 0], [8.5, 2.4], [7.6, 3.2], [0, 3.3]], 40), M.knob, 'gmetal.knob', g);
    btn.position.x = 30;
  }

  // =========================================================================
  // Schrauben (Innensechskant, je Schraube eine eigene Gruppe)
  // =========================================================================
  stage = 'gscrews';
  {
    const head = new THREE.LatheGeometry(
      [
        [3.9, 0],
        [3.9, 0.4],
        [3.6, 1.2],
        [2.6, 2.1],
        [0, 2.4],
      ].map(([r, z]) => new THREE.Vector2(r, z)),
      28,
    );
    head.rotateX(Math.PI / 2);
    const socket = new THREE.CylinderGeometry(1.5, 1.5, 1, 6);
    socket.rotateX(Math.PI / 2);
    const Z = new V3(0, 0, 1);
    let n = 0;
    const screw = (pos, normal, frame = true) => {
      const grp = new THREE.Group();
      const p = frame ? bodyPoint(...pos) : new V3(...pos);
      const nrm = new V3(...normal).normalize();
      if (frame) nrm.applyQuaternion(BODY_Q);
      grp.position.copy(p);
      grp.quaternion.setFromUnitVectors(Z, nrm);
      grp.rotateZ((n++ * 1.7) % Math.PI);
      root.add(grp);
      add(head, M.screws, 'gmetal.screws', grp);
      const s = new THREE.Mesh(socket, F.darkGap);
      s.position.z = 2.05;
      grp.add(s);
    };
    for (const sx of [-1, 1]) {
      // Motorgehäuse
      screw([sx * 53, 0, 22], [sx, 0, 0]);
      screw([sx * 53, 18, 98], [sx, 0, 0]);
      // Seitenschienen
      for (const t of [126, 222, 288, 334]) screw([sx * 72, 0, t], [sx, 0, 0]);
      // Frontblock
      for (const y of [-17, 17]) screw([sx * 47, y, 357], [0, 0, 1]);
    }
  }

  // =========================================================================
  // Innenleben (nur in der Montage-Animation sichtbar)
  // =========================================================================
  const skeleton = new THREE.Group();
  skeleton.visible = false;
  root.add(skeleton);
  {
    let sk = 'gsk-pcb';
    const skAdd = skeleton.add.bind(skeleton);
    skeleton.add = (...objs) => {
      for (const o of objs) if (!o.userData.stage) o.userData.stage = sk;
      return skAdd(...objs);
    };
    const plain = (geom, mat, parent = skeleton) => {
      const m = new THREE.Mesh(geom, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const skBody = () => {
      const g = new THREE.Group();
      g.position.copy(BODY_P);
      g.quaternion.copy(BODY_Q);
      skeleton.add(g);
      return g;
    };
    // Platine und Netzteil im Elektronikblock
    {
      const pcb = plain(new THREE.BoxGeometry(2, 104, 62), F.pcb);
      pcb.position.set(-14, EG1.baseTop + 62, -66);
      const psu = plain(rbox(22, 46, 54, 2, 1), F.frame);
      psu.position.set(8, EG1.baseTop + 32, -66);
      const caps = new THREE.Group();
      caps.position.set(-10, EG1.baseTop + 70, -66);
      skeleton.add(caps);
      for (let i = 0; i < 4; i++) {
        const c = plain(new THREE.CylinderGeometry(4, 4, 12, 16), F.motor, caps);
        c.rotation.z = Math.PI / 2;
        c.position.set(6, -24 + i * 15, (i % 2) * 14 - 7);
      }
    }
    // Motor im Motorgehäuse
    sk = 'gsk-motor';
    {
      const g = skBody();
      plain(latheT([[0, 10], [40, 10], [42, 13], [42, 96], [40, 100], [0, 100]], 48), F.motor, g);
      for (let i = 0; i < 6; i++) {
        const rib = plain(new THREE.TorusGeometry(42.2, 1.2, 6, 48), F.motorRib, g);
        rib.position.z = 24 + i * 12;
      }
      plain(latheT([[0, 100], [14, 100], [14, 112], [0, 112]], 24), F.chrome, g);
    }
    // Antrieb: Welle und unterer Mahlscheibenträger
    sk = 'gsk-drive';
    {
      const g = skBody();
      plain(latheT([[0, 110], [28, 110], [30, 114], [30, 224], [0, 224]], 48), F.frame, g);
      plain(latheT([[0, 224], [8, 224], [8, 240], [0, 240]], 24), F.chrome, g);
    }
    // Mahlscheiben (80 mm) mit Zahnbild
    sk = 'gsk-burrs';
    {
      const burrTex = makeBurrTexture();
      const burrMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: burrTex, metalness: 0.85, roughness: 0.32 });
      for (const t of [240, 249]) {
        const g = skBody();
        const disc = plain(new THREE.CylinderGeometry(40, 40, 7, 64), burrMat, g);
        disc.rotation.x = Math.PI / 2;
        disc.position.z = t + 3.5;
      }
    }
    // Kabel: vom Elektronikblock durch die Säule zum Motor
    sk = 'gsk-wires';
    const Yv = new V3(0, 1, 0);
    const wire = (pts, r, mat) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)), false, 'centripetal');
      const tube = plain(new THREE.TubeGeometry(curve, 64, r, 10, false), mat);
      Object.assign(tube.userData, { kind: 'tube', pipe: tube.id, segments: 64, radial: 10 });
      void Yv;
    };
    wire([[-4, EG1.baseTop + 120, -50], [-4, 200, -40], [-4, 270, -38], [-4, 320, -70], bodyPoint(-4, -30, 60).toArray()], 2.6, F.motor);
    wire([[5, EG1.baseTop + 120, -50], [5, 210, -34], [5, 280, -32], [5, 330, -62], bodyPoint(5, -26, 70).toArray()], 2.2, F.copper);
  }

  // Gesamt-Skalierung: mm -> m
  root.scale.setScalar(0.001);

  return {
    root,
    pickables,
    skeleton,
    stages: GRINDER_STAGES,
    isInner: isGrinderInner,
    /** Trichterdeckel ein-/ausblenden */
    setLid(on) {
      lid.visible = !!on;
    },
    /** Farbe der Skala passend zum Einstellring (hell auf dunkel, dunkel auf hell) */
    setDialInk(hex) {
      const c = new THREE.Color(hex);
      const lum = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
      root.userData.dialInk.color.set(lum > 0.35 ? 0x1a1a1a : 0xf2f2f2);
    },
    setBarista() {},
  };
}
