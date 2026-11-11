// ---------------------------------------------------------------------------
// La Marzocco GS3 (AV und MP)
//
// Maße in Millimeter, vermessen an den offiziellen Werkszeichnungen GS3-AV und
// GS3-MP (A3, Maßstab 1:10: Breite 410, Tiefe 530, Höhe 441 mm mit Manometer
// der MP) und an Schnitten durch die zugehörigen 3D-CAD-Modelle von La Marzocco
// (nur als Messreferenz; Teilenummern wie im Ersatzteilkatalog V3.4, z. B.
// C.1.045 Rückwand, C.1.047 Tassenablage, F.1.009 Seitenteil, F.1.079 MP-Kappe).
// Siebträger nach Katalog S. 70 (im CAD nicht enthalten).
//
// Koordinaten: X = Breite (rechts = Heißwasser), Y = Höhe (0 = Stellfläche),
//              Z = Tiefe (+Z = Front). Gruppenachse bei z = 325,5.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, rbox, profileExtrudeX, woodBoxUV, mergeGeos } from '../model.js';
import { makeSlotFieldTexture, makePlateTexture } from '../textures.js';
import { GAUGE_DIALS, NEEDLES } from '../data.js';
import { makeCanvas } from '../noise.js';
import { registerDevice } from '../devices.js';
import { DeviceUI } from '../device-ui.js';
import { createBuilder, filletShape, plateZ, plateY, latheY, latheZ, buildGauge, screwSet, tubeAlong, flipWinding, WOOD_V } from '../parts.js';

const ID = 'gs3';
const S = (k) => `${ID}:${k}`;
const GZ = 325.5; // Gruppenachse
const V3 = THREE.Vector3;

const STAGES = [
  { id: 'sk-base', src: 'skeleton', from: [0, 1, 0], dist: 420, gap: 0, dur: 0.75, drop: true },
  { id: 'sk-frame', src: 'skeleton', from: [0, 0.15, -1], dist: 800, gap: 0.5, dur: 0.75 },
  { id: 'sk-tank', src: 'skeleton', from: [0, 1, 0], dist: 700, gap: 0.4, dur: 0.75 },
  { id: 'sk-pump', src: 'skeleton', from: [1, 0.1, 0], dist: 900, gap: 0.4, dur: 0.85, spin: [[1, 0, 0], Math.PI * 2] },
  { id: 'sk-steam', src: 'skeleton', from: [-1, 0.55, 0], dist: 1000, gap: 0.45, dur: 0.95, heavy: true },
  { id: 'sk-brew', src: 'skeleton', from: [0.6, 1, 0], dist: 900, gap: 0.5, dur: 0.85, heavy: true },
  { id: 'sk-valves', src: 'skeleton', pop: true, gap: 0.35, dur: 0.35, stagger: 0.12 },
  { id: 'sk-pcb', src: 'skeleton', from: [0, 0, -1], dist: 800, gap: 0.3, dur: 0.6, stagger: 0.07 },
  { id: 'sk-pipes', src: 'skeleton', grow: true, gap: 0.4, dur: 0.65, stagger: 0.26 },
  { id: 'sk-wires', src: 'skeleton', grow: true, gap: 0.3, dur: 0.6, stagger: 0.2 },
  { id: 'base', from: [0, -1, 0.35], dist: 650, gap: 0.45, after: true, dur: 0.9, heavy: true },
  { id: 'feet', from: [0, -1, 0], dist: 400, gap: 0.3, dur: 0.6, stagger: 0.08 },
  { id: 'body', from: [0, 0.6, -1], dist: 1100, gap: 0.4, dur: 1.0, heavy: true },
  { id: 'gauges', from: [0, 0.7, 0.7], dist: 700, gap: 0.45, dur: 0.6, spin: [[0, 0.7, 0.7], Math.PI * 2] },
  { id: 'keys', pop: true, gap: 0.35, dur: 0.3, stagger: 0.06 },
  { id: 'sides', perSide: true, dist: 1000, gap: 0.45, dur: 0.9, heavy: true },
  { id: 'neck', from: [0, 0.2, 1], dist: 900, gap: 0.45, dur: 0.8 },
  { id: 'group', from: [0, 1, 0], dist: 800, gap: 0.35, dur: 0.85, spin: [[0, 1, 0], Math.PI] },
  { id: 'top', from: [0, 1, 0], dist: 600, gap: 0.35, dur: 0.6, drop: true },
  { id: 'paddle', from: [0.4, 0.4, 1], dist: 800, gap: 0.3, dur: 0.6 },
  { id: 'wands', from: [0, 1, 0.4], dist: 900, gap: 0.35, dur: 0.8, stagger: 0.15 },
  { id: 'knob', from: [0, 0, 1], dist: 700, gap: 0.3, dur: 0.6, spin: [[0, 0, 1], Math.PI * 2] },
  { id: 'portafilter', from: [-0.1, -0.3, 1], dist: 900, gap: 0.35, dur: 0.9, spin: [[0, 1, 0], -0.9] },
  { id: 'drip', from: [0, -0.25, 1], dist: 900, gap: 0.4, dur: 0.8 },
  { id: 'tray', from: [0, 1, 0], dist: 600, gap: 0.45, dur: 0.55 },
  { id: 'screws', pop: true, gap: 0.45, dur: 0.3, stagger: 0.03 },
  { id: 'logo', pop: true, gap: 0.4, dur: 0.5 },
];
const isInner = (id) => id.startsWith('sk-');

/** Seitenteil F.1.009 (CAD-Schnitt): Kontur in (z, y) */
const SIDE = [
  [265.6, 90],
  [266, 232.5],
  [182.6, 316.6],
  [86.5, 335.7],
  [47.5, 325.1],
  [-75, 315],
  [-81.3, 310],
  [-130.2, 177],
  [-130, 160],
  [-82.1, 108],
  [-59, 86.5],
  [257.7, 84.1],
];
const SIDE_R = [5, 3, 8, 12, 14, 4, 4, 9, 12, 6, 6, 5];

/** ovaler Schriftzug der Seitenteile ("LA MARZOCCO – HANDMADE IN FLORENCE") */
function makeOvalLogo() {
  const W = 512;
  const H = 232;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#1b1c1f';
  g.beginPath();
  g.ellipse(W / 2, H / 2, W / 2 - 4, H / 2 - 4, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#d8d9dc';
  g.lineWidth = 6;
  g.beginPath();
  g.ellipse(W / 2, H / 2, W / 2 - 16, H / 2 - 16, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#e6e7ea';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 46px "Times New Roman", Georgia, serif';
  g.fillText('LA·MARZOCCO', W / 2, 70);
  g.font = '600 24px "Helvetica Neue", Arial, sans-serif';
  g.fillText('HANDMADE IN FLORENCE', W / 2, 176);
  // Globus mit Längen- und Breitengraden
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(W / 2, 122, 64, 26, 0, 0, Math.PI * 2);
  g.stroke();
  for (const k of [-0.5, 0, 0.5]) {
    g.beginPath();
    g.ellipse(W / 2, 122, 64 * Math.cos(k * 1.2), 26, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(W / 2 - 64, 122);
  g.lineTo(W / 2 + 64, 122);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Display des Tastenfelds (blaues LCD im Oval) */
function makeDisplay() {
  const W = 400;
  const H = 96;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#0d0f12';
  g.beginPath();
  g.ellipse(W / 2, H / 2, W / 2 - 2, H / 2 - 2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2e5fd6';
  g.fillRect(96, 26, 208, 44);
  g.fillStyle = '#dce6ff';
  g.font = '600 18px "Courier New", monospace';
  g.textAlign = 'center';
  g.fillText('203.5F  9 6 15:35', W / 2, 44);
  g.fillText('LA MARZOCCO GS/3', W / 2, 62);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildGS3(mm) {
  const B = createBuilder('GS3', mm);
  const { root, F } = B;
  const mat = (k, extra) => mm.get(S(k), extra);
  const body = mat('body.main');
  const sideMat = mat('body.side');
  const baseMat = mat('body.base');
  const trayMat = mat('body.tray');

  // =========================================================================
  // Sockel (C.1.038) und Füße (CL-41)
  // =========================================================================
  B.stage('base');
  {
    B.add(boxProjectUV(rbox(346, 66, 298, 3, 3)), baseMat, S('body.base')).position.set(0, 59, -51.7 + 149);
    // Netzschalter rechts hinten, Typenschild
    B.plain(rbox(4, 25, 51, 1, 2), F.blackPlastic).position.set(174.5, 60, -20);
    const plate = B.plain(new THREE.PlaneGeometry(64, 36), new THREE.MeshStandardMaterial({ map: makePlateTexture('GS3'), metalness: 0.6, roughness: 0.35 }));
    plate.rotation.y = -Math.PI / 2;
    plate.position.set(-173.3, 58, 90);
    B.plain(tubeAlong([[60, 40, -51.7], [60, 38, -70], [62, 6, -92], [70, 3, -140]], 3.2, 40, 10), F.rubber).castShadow = false;
  }
  B.stage('feet');
  {
    const feetMat = mat('metal.feet');
    const g = latheY([[0, 0.5], [17, 0.5], [17.5, 1.8], [15, 7], [11.5, 15], [10.5, 25], [11, 26], [0, 26]], 44);
    const pad = new THREE.CylinderGeometry(16, 16, 1, 32);
    for (const [x, z] of [
      [-159, 327.3],
      [159, 327.3],
      [-159, -24.7],
      [159, -24.7],
    ]) {
      const foot = B.group();
      foot.position.set(x, 0, z);
      B.add(g, feetMat, S('metal.feet'), foot);
      B.plain(pad, F.rubber, foot).position.y = 0.5;
    }
  }

  // =========================================================================
  // Korpus: Querschnitt (Rückwand C.1.045, Mulde der Tassenablage, schräge
  // Bedienfront C.1.046, senkrechte Front C.1.043) über die Breite gezogen
  // =========================================================================
  B.stage('body');
  {
    const prof = [
      [-52.9, 84],
      [-52.9, 92.4],
      [-64.1, 93.7],
      [-121.2, 150.2],
      [-128.5, 167.2],
      [-127, 176.5],
      [-78.4, 309.8],
      [-76.5, 311],
      [-31.8, 314.9],
      [-29.6, 312.5],
      [-29.6, 289],
      [161.4, 289],
      [161.4, 300.5],
      [168, 301.6],
      [191.5, 301.6],
      [260.3, 231],
      [260.3, 108.2],
      [239.3, 108.2],
      [239.3, 84],
    ];
    const g = profileExtrudeX(prof, 361, 1.5);
    g.translate(-180.5, 0, 0);
    B.add(boxProjectUV(g), body, S('body.main'));
    // Öffnung für den Gruppenhals in der schrägen Front (dunkel)
    const op = B.plain(rbox(100, 70, 2, 6, 2), F.darkGap);
    op.position.set(0, 268, 224);
    op.rotation.x = -Math.PI / 4;
    // Fugen zwischen den Frontblechen
    for (const x of [-62, 62]) {
      const seam = B.plain(new THREE.BoxGeometry(1.2, 74, 0.6), F.darkGap);
      seam.position.set(x, 194, 260.5);
    }
  }
  // Manometer im schrägen Bedienfeld (45°): Dampf- und Brühkessel
  B.stage('gauges');
  const gauges = [];
  {
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 4, 0, 0));
    for (const [x, spec] of [
      [-143.5, { id: 'gs3-steam', max: 3, step: 0.25, label: 0.5, value: 1.3, unit: 'bar', zone: [1, 1.5] }],
      [-85.5, { id: 'gs3-coffee', max: 3, step: 0.25, label: 0.5, value: 1.2, unit: 'bar', zone: [1, 1.5] }],
    ]) {
      const grp = B.group();
      grp.position.set(x, 267.3, 226.8);
      grp.quaternion.copy(tilt);
      gauges.push(buildGauge(B, { slot: S('metal.gauges'), x: 0, y: 0, z: -4, R: 22.4, spec, parent: grp }));
    }
  }
  // Tastenfeld mit Display (rechts im schrägen Bedienfeld)
  B.stage('keys');
  {
    const tilt = new THREE.Euler(-Math.PI / 4, 0, 0);
    const n = new V3(0, Math.SQRT1_2, Math.SQRT1_2);
    const pad = B.plain(rbox(136, 76, 2.4, 6, 2), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5 }));
    pad.position.copy(new V3(111, 262.5, 230).addScaledVector(n, 1));
    pad.rotation.copy(tilt);
    const disp = B.plain(new THREE.PlaneGeometry(96, 23), new THREE.MeshBasicMaterial({ map: makeDisplay(), transparent: true, toneMapped: false }));
    disp.position.copy(new V3(111, 280.9, 211.5).addScaledVector(n, 2.4));
    disp.rotation.copy(tilt);
    const keyMat = mat('metal.keys');
    const keyG = boxProjectUV(rbox(15, 15, 4, 2, 2));
    for (let i = 0; i < 6; i++) {
      const k = B.add(keyG, keyMat, S('metal.keys'));
      const p = new V3(58 + i * 21, 244, 248.5).addScaledVector(n, 3.2);
      k.position.copy(p);
      k.rotation.copy(tilt);
    }
  }

  // =========================================================================
  // Seitenteile (F.1.009): Edelstahl/Lack mit gewölbter Kante und ovalem Schriftzug,
  // alternativ rb.crafts-Platten aus Holz (flach, drei Schrauben)
  // =========================================================================
  B.stage('sides');
  const sideStd = B.group();
  const sideWood = B.group();
  const sideWoodMat = mat('wood.side');
  {
    const shape = (inset = 0) => filletShape(SIDE.map(([z, y]) => [z, y]), SIDE_R.map((r) => r + inset), 4);
    for (const sx of [-1, 1]) {
      // gewölbtes Werks-Seitenteil
      const g = plateZ(shape(), 0, 17.9, 6, 32);
      // Shape (z, y) liegt in XY -> um Y drehen: Shape-x -> Welt-z
      // Shape-x -> Welt-z, Extrusion -> -x; rechts gespiegelt (nach außen)
      g.rotateY(-Math.PI / 2);
      if (sx > 0) {
        g.scale(-1, 1, 1);
        flipWinding(g);
        g.computeVertexNormals();
      }
      g.translate(sx * 181.5, 0, 0);
      B.add(boxProjectUV(g), sideMat, S('body.side'), sideStd);
      // rb.crafts-Holzplatte
      const w = plateZ(shape(), 0, 16, 2.4, 32);
      w.rotateY(-Math.PI / 2);
      if (sx > 0) {
        w.scale(-1, 1, 1);
        flipWinding(w);
        w.computeVertexNormals();
      }
      w.translate(sx * 181.5, 0, 0);
      woodBoxUV(w, 2, [0.33, 0.2]);
      B.add(w, sideWoodMat, S('wood.side'), sideWood);
    }
  }
  // Ovaler Schriftzug und Abdeckkappen auf den Werks-Seitenteilen
  const ovalTex = makeOvalLogo();
  const ovalMat = new THREE.MeshStandardMaterial({ map: ovalTex, metalness: 0.5, roughness: 0.35, transparent: true });
  const logoMat = mat('metal.logo');
  for (const sx of [-1, 1]) {
    const x = sx * 199.5;
    const ring = new THREE.Shape();
    ring.absellipse(0, 0, 64, 30, 0, Math.PI * 2, false);
    const inner = new THREE.Path();
    inner.absellipse(0, 0, 60.5, 26.5, 0, Math.PI * 2, true);
    ring.holes.push(inner);
    const rg = plateZ(ring, 0, 1.6, 0.5, 64);
    rg.rotateY(sx * Math.PI / 2);
    const rm = B.add(boxProjectUV(rg), logoMat, S('metal.logo'), sideStd);
    rm.position.set(x, 207.9, 76.3);
    const pl = B.plain(new THREE.PlaneGeometry(121, 53), ovalMat, sideStd);
    pl.rotation.y = sx * Math.PI / 2;
    pl.position.set(x + sx * 0.4, 207.9, 76.3);
    for (const z of [231, -82]) {
      const cap = latheZ([[19, 0], [19, 1.2], [17, 2.6], [10, 3.4], [0, 3.6]], 40);
      cap.rotateY(sx * Math.PI / 2);
      B.plain(cap, F.steel, sideStd).position.set(x, 191, z);
    }
  }
  // Schrauben auf den Holzplatten (eigener Montageschritt, sichtbar nur mit Holz)
  const woodScrews = [];
  B.stage('screws');
  {
    const screw = screwSet(B, S('metal.screws'), { R: 4.2, H: 2.6 });
    for (const sx of [-1, 1]) {
      for (const [z, y] of [
        [231, 191],
        [-82, 191],
        [80, 312],
      ]) woodScrews.push(screw(sx * 197.6, y, z, [sx, 0, 0]));
    }
  }

  // =========================================================================
  // Gruppenhals: elliptischer Bogen vom Korpus zur freistehenden Brühgruppe
  // =========================================================================
  B.stage('neck');
  const groupMat = mat('metal.group');
  {
    const ell = new THREE.Shape();
    // Querschnitt 68 × 42 mm (breit, flach) laut CAD-Schnitten
    ell.absellipse(0, 0, 34, 21, 0, Math.PI * 2, false);
    const path = new THREE.CatmullRomCurve3(
      [
        [0, 262, 150],
        [0, 262, 182],
        [0, 270, 208],
        [0, 284, 232],
        [0, 292, 256],
        [0, 294, 285],
      ].map((p) => new V3(...p)),
    );
    const g = new THREE.ExtrudeGeometry(ell, { steps: 48, bevelEnabled: false, extrudePath: path, curveSegments: 32 });
    B.add(boxProjectUV(g), groupMat, S('metal.group'));
  }

  // =========================================================================
  // Brühgruppe (Stapel laut CAD): Bajonettring, Gruppenkörper, Kappe, Flansch
  // =========================================================================
  B.stage('group');
  {
    const g = latheY([
      [0, 255.6],
      [40, 255.6],
      [46.8, 256.6],
      [46.8, 263.4],
      [55, 264.4],
      [55, 276.4],
      [53.5, 277.3],
      [43.5, 277.3],
      [43.5, 306.4],
      [55, 306.4],
      [55, 312.8],
      [60, 312.8],
      [60, 334.8],
      [55.3, 334.8],
      [55.3, 346.2],
      [0, 346.2],
    ], 72);
    B.add(g, groupMat, S('metal.group')).position.set(0, 0, GZ);
    // Ohren des Bajonettrings
    for (const sx of [-1, 1]) B.add(boxProjectUV(rbox(14, 11, 26, 3, 2)), groupMat, S('metal.group')).position.set(sx * 58, 270, GZ);
    const gasket = B.plain(new THREE.CylinderGeometry(36, 36, 1.5, 48), F.gasket);
    gasket.position.set(0, 255.2, GZ);
    // Befestigungsschrauben des Bajonettrings (senkrecht, außen am Gruppenkörper)
    for (const [x, z] of [
      [0, 374],
      [-41.9, 301.3],
      [41.9, 301.3],
    ]) {
      B.plain(new THREE.CylinderGeometry(4, 4, 40, 16), F.steel).position.set(x, 298, z);
      B.plain(new THREE.CylinderGeometry(6.5, 6.5, 6, 6), F.steel).position.set(x, 279.5, z);
    }
  }
  // Kappe: MP mit Paddle und Manometer, AV mit flacher Haube; rb.crafts-Holzabdeckung
  B.stage('top');
  const coverMat = mat('wood.cover');
  const mpParts = [];
  const avParts = [];
  const mpWood = [];
  const avWood = [];
  const mpStd = [];
  const avStd = [];
  let topGauge = null;
  {
    // MP-Kappe F.1.079
    const cap = latheY([[0, 346.1], [59.5, 346.1], [59.7, 349], [59.7, 358], [58.6, 362], [52, 366.5], [45, 370], [33, 376], [30.6, 378], [30, 383.1], [0, 383.1]], 72);
    const m1 = B.add(cap, groupMat, S('metal.group'));
    m1.position.set(0, 0, GZ);
    mpStd.push(m1);
    // Holzabdeckung MP: Scheibe mit Bund
    const wd = latheY([[0, 346.2], [59.6, 346.2], [60, 348], [60, 368], [58.5, 371.5], [56, 372.6], [12, 372.6], [12, 383], [0, 383]], 72);
    const uv = wd.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.9 + 0.2, uv.getY(i) * 0.16 + 0.4);
    const w1 = B.add(wd, coverMat, S('wood.cover'));
    w1.position.set(0, 0, GZ);
    mpWood.push(w1);
    // Manometer auf der Gruppe (Brühdruck), Stiel
    B.plain(new THREE.CylinderGeometry(7, 7, 16, 20), F.chrome).position.set(0, 391, GZ);
    const gg = B.group();
    gg.position.set(3, 420, GZ + 4.5);
    const back = B.plain(new THREE.CylinderGeometry(21.5, 21.5, 20, 40), F.chrome, gg);
    back.rotation.x = Math.PI / 2;
    back.position.z = -10;
    topGauge = buildGauge(B, { slot: S('metal.gauges'), x: 0, y: 0, z: 0, R: 21.5, bezel: 4, spec: { id: 'gs3-brew', max: 16, step: 1, label: 4, value: 9, unit: 'bar', zone: [8, 10] }, parent: gg });
    mpParts.push(gg, back);
    // AV-Haube F.1.012
    const av = latheY([[0, 313.9], [60, 313.9], [60, 330], [57, 336], [48, 340], [30, 341.4], [0, 341.4]], 72);
    const a1 = B.add(av, groupMat, S('metal.group'));
    a1.position.set(0, 0, GZ);
    avStd.push(a1);
    const awd = latheY([[0, 313.9], [60, 313.9], [60, 337], [57.5, 341], [54, 342], [0, 342]], 72);
    const auv = awd.attributes.uv;
    for (let i = 0; i < auv.count; i++) auv.setXY(i, auv.getX(i) * 0.9 + 0.2, auv.getY(i) * 0.16 + 0.4);
    const a2 = B.add(awd, coverMat, S('wood.cover'));
    a2.position.set(0, 0, GZ);
    avWood.push(a2);
  }
  // MP-Paddle (C.2.020), nach vorn rechts gestellt
  B.stage('paddle');
  {
    const lever = profileExtrudeX([[0, 334.6], [0, 384], [6, 385.6], [32, 381], [37, 376], [43, 340], [40, 335.5]], 18, 1.6);
    woodBoxUV(lever, 1, [0.71, 0.12]);
    const lv = B.add(lever, mat('wood.paddle'), S('wood.paddle'));
    lv.position.set(23, 0, 384);
    lv.rotation.y = 0.54;
    mpParts.push(lv);
  }

  // =========================================================================
  // Dampflanze links und Heißwasser rechts: Bügel über der Front, Lanze schräg nach vorn
  // =========================================================================
  B.stage('wands');
  const wandMat = mat('metal.wands');
  {
    const steam = [
      [-163.9, 296, 178],
      [-163.9, 330, 178],
      [-163.9, 341, 183],
      [-163.9, 346.5, 196],
      [-163.9, 346.5, 270],
      [-163.9, 344, 286],
      [-163.9, 330, 294],
      [-163.9, 300, 302],
      [-163.9, 241, 320],
      [-163.9, 166, 340],
      [-163.9, 122, 351],
    ];
    B.add(tubeAlong(steam, 5, 160, 20), wandMat, S('metal.wands'));
    // Gummigriff mit Ringen am oberen Ende der Lanze
    const dir = new V3(0, -241 + 300, 320 - 302).normalize();
    for (let k = 0; k < 6; k++) {
      const r = B.plain(new THREE.TorusGeometry(6.2, 1.6, 8, 24), F.rubber);
      const p = new V3(-163.9, 300 - k * 9 * 0.96, 302 + k * 9 * 0.29);
      r.position.copy(p);
      r.quaternion.setFromUnitVectors(new V3(0, 0, 1), dir);
    }
    const tip = latheY([[0, 104], [4.6, 104], [6, 106], [6.3, 116], [5.2, 124], [0, 124]], 24);
    const t = B.add(tip, wandMat, S('metal.wands'));
    t.position.set(-163.9, 0, 352);
    t.rotation.x = -0.27;
    // Heißwasser: Bügel und dicke Düse
    const hw = [
      [164.1, 296, 178],
      [164.1, 330, 178],
      [164.1, 341, 183],
      [164.1, 346.5, 196],
      [164.1, 346.5, 288],
      [164.1, 343, 302],
      [164.1, 330, 308],
      [164.1, 306, 310],
    ];
    B.add(tubeAlong(hw, 5, 120, 20), wandMat, S('metal.wands'));
    const noz = latheY([[0, 272], [9, 272], [11.5, 275], [11.5, 296], [9, 300], [5.5, 300], [5.5, 308], [0, 308]], 32);
    B.add(noz, wandMat, S('metal.wands')).position.set(164.1, 0, 310);
  }
  // Dampfventil-Knopf vorn links (B.1.005)
  B.stage('knob');
  {
    B.plain(latheZ([[9, 260.6], [9, 266], [7, 266], [7, 286], [0, 286]], 32), F.chrome).position.set(-147.2, 166.6, 0);
    const kg = latheZ([[0, 285], [9, 285], [10.5, 290], [10.5, 318], [9.5, 323], [6, 325.2], [0, 325.6]], 40);
    const uv = kg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.31, uv.getY(i) * 0.1 + 0.2);
    B.add(kg, mat('wood.knob'), S('wood.knob')).position.set(-147.2, 166.6, 0);
  }

  // =========================================================================
  // Siebträger (wie La Marzocco Linea, Katalog S. 70)
  // =========================================================================
  B.stage('portafilter');
  const pfMat = mat('metal.portafilter');
  const handleVariants = {};
  {
    const pf = B.group();
    pf.position.set(0, 58.6, GZ);
    B.add(latheY([[0, 175.5], [26, 175.5], [31, 178], [32.4, 182], [32.4, 193], [33.4, 194], [33.4, 197], [27, 197]], 64), pfMat, S('metal.portafilter'), pf);
    for (const sx of [-1, 1]) B.add(rbox(9, 6, 17, 2, 2), pfMat, S('metal.portafilter'), pf).position.set(sx * 36.5, 193.5, 0);
    B.add(latheY([[0, 165], [9, 165], [10, 168], [13, 176], [0, 176]], 32), pfMat, S('metal.portafilter'), pf).position.z = 14;
    for (const sx of [-1, 1]) {
      const sp = B.add(new THREE.CylinderGeometry(3, 3.6, 13, 20), pfMat, S('metal.portafilter'), pf);
      sp.position.set(sx * 9, 160, 14);
      sp.rotation.z = sx * 0.55;
    }
    const handle = B.group(pf);
    handle.position.set(0, 190.6, 0);
    handle.rotation.x = 0.1026;
    B.add(latheZ([[0, 26], [9.5, 26], [9.5, 34], [8.6, 50], [9.6, 58], [0, 58]], 32), pfMat, S('metal.portafilter'), handle);
    const handleMat = mat('wood.handle');
    const hprof = [[0, 0], [13.6, 0], [14.4, 2], [13.2, 10], [12.8, 18], [13.6, 32], [14, 50], [15.6, 66], [16.4, 76], [16.2, 90], [15.2, 106], [14.5, 116], [13.2, 124], [11.6, 130], [8.4, 134], [4, 135.8], [0, 136]];
    const rbprof = [[0, 0], [11.4, 0], [12, 4], [17, 122], [17, 128], [13.4, 135.4], [0, 136]];
    const makeHandle = (segments, flat) => {
      let g = new THREE.LatheGeometry((flat ? rbprof : hprof).map(([r, y]) => new THREE.Vector2(r, y)), segments, Math.PI / segments);
      const uv = g.attributes.uv;
      const hp = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.37, hp.getY(i) / WOOD_V + 0.66);
      if (flat) {
        g = g.toNonIndexed();
        g.computeVertexNormals();
      }
      g.rotateX(Math.PI / 2);
      const m = B.add(g, handleMat, S('wood.handle'), handle);
      m.position.z = 57;
      return m;
    };
    handleVariants.round = makeHandle(48, false);
    handleVariants.facet = makeHandle(8, true);
    handleVariants.facet.visible = false;
  }

  // =========================================================================
  // Tropfschale (F.1.008 / C.1.041) mit Lochblech C.1.042: Querschlitze vorn und
  // hinten, Längsschlitze in der Mitte
  // =========================================================================
  B.stage('drip');
  {
    B.add(boxProjectUV(rbox(355, 79, 152, 3, 3)), trayMat, S('body.tray')).position.set(0, 19.7 + 39.5, 245.3 + 76);
    const W = 344;
    const D = 129.5;
    const x0 = W / 2;
    const z0 = 255.1;
    const fields = [];
    // vordere und hintere Reihe: senkrechte Schlitze 4,5 × 30, Teilung 9
    for (const zs of [262.7, 346.7]) fields.push({ x: x0 - 157.8, y: zs - z0, w: 315.6, h: 30, pitch: 9, slot: 4.5, dir: 'cols' });
    // Mitte: Querschlitze 30 × 4,5 in Spalten
    for (const cx of [-108.8, -74.3, -39.8, 9.7, 44.2, 78.7]) fields.push({ x: x0 + cx, y: 297.9 - z0, w: 30, h: 48, pitch: 9.8, slot: 4.5, dir: 'rows' });
    for (const cx of [-123.8, -5.3, 113.2]) fields.push({ x: x0 + cx, y: 297.9 - z0, w: 10.5, h: 48, pitch: 9.8, slot: 4.5, dir: 'rows' });
    const tex = makeSlotFieldTexture(W, D, fields, { brushed: 'x', pxPerMM: 4 });
    const gm = mat('metal.grates', { map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide });
    const g = new THREE.PlaneGeometry(W, D);
    g.rotateX(-Math.PI / 2);
    B.add(g, gm, S('metal.grates')).position.set(0, 102.6, z0 + D / 2);
    const rim = filletShape([[-179.2, 254.5], [179.2, 254.5], [179.2, 398.5], [-179.2, 398.5]], 3, 3);
    const hole = new THREE.Path();
    hole.moveTo(-172, z0);
    hole.lineTo(-172, z0 + D);
    hole.lineTo(172, z0 + D);
    hole.lineTo(172, z0);
    hole.closePath();
    rim.holes.push(hole);
    B.add(boxProjectUV(plateY(rim, 101.8, 3.9, 1.2)), mat('metal.grates'), S('metal.grates'));
    const inner = B.plain(new THREE.BoxGeometry(340, 1, 128), F.trayInner);
    inner.position.set(0, 60, z0 + D / 2);
    inner.receiveShadow = true;
  }

  // =========================================================================
  // Tassenablage C.1.047: drei Schlitzfelder, 15 Schlitze je Feld
  // =========================================================================
  B.stage('tray');
  {
    const W = 353.2;
    const D = 190.2;
    const fields = [-165.2, -68.2, 73.8].map((x, i) => ({ x: x + W / 2, y: 161.0 - 151.9 - 6, w: [91, 136, 91][i], h: 180, pitch: 12, slot: 6, dir: 'rows' }));
    const tex = makeSlotFieldTexture(W, D, fields, { brushed: 'x', pxPerMM: 4 });
    const cm = mat('metal.cup', { map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide });
    const g = new THREE.PlaneGeometry(W, D);
    g.rotateX(-Math.PI / 2);
    B.add(g, cm, S('metal.cup')).position.set(0, 300, 161 - D / 2);
    const inner = B.plain(new THREE.BoxGeometry(W - 4, 1, D - 4), F.trayInner);
    inner.position.set(0, 290, 161 - D / 2);
  }

  // =========================================================================
  // Schrauben der Frontbleche und Logo GS3 hinten
  // =========================================================================
  B.stage('screws');
  {
    const screw = screwSet(B, S('metal.screws'), { R: 4.2, H: 2.6 });
    for (const x of [-119.5, 119.5]) screw(x, 219.2, 260.3);
  }
  B.stage('logo');
  {
    const c = makeCanvas(256, 96);
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#fff';
    g.font = 'italic 900 78px "Arial Black", Arial, sans-serif';
    g.textBaseline = 'middle';
    g.fillText('GS3', 30, 52);
    const t = new THREE.CanvasTexture(c);
    const lm = mm.get(S('metal.logo'), { alphaMap: t, alphaTest: 0.4, alphaToCoverage: true });
    lm.userData.logo = { w: 120, h: 45 };
    const geo = new THREE.PlaneGeometry(120, 45);
    const grp = B.group();
    for (let i = 0; i < 4; i++) B.add(geo, lm, S('metal.logo'), grp).position.z = 0.25 + i * 0.4;
    // auf der schrägen Rückwand (Neigung laut C.1.045)
    const ang = Math.atan2(309.8 - 176.5, -78.4 + 127);
    grp.position.set(69, 256.6, -98.8);
    grp.rotation.set(0, Math.PI, 0);
    grp.rotateX(-(Math.PI / 2 - ang));
  }

  // =========================================================================
  // Rohbau (nur in der Montage): nach den Explosionszeichnungen vereinfacht
  // =========================================================================
  {
    B.sk('sk-base');
    B.skBox(330, 6, 280, F.frame, 0, 92, 96, 2);
    B.sk('sk-frame');
    for (const sx of [-1, 1]) B.skBox(4, 200, 330, F.frame, sx * 170, 190, 66, 2);
    B.skBox(330, 4, 300, F.frame, 0, 286, 66, 2);
    B.sk('sk-tank');
    B.skBox(300, 110, 120, F.tank, 0, 160, -40, 8);
    B.sk('sk-pump');
    B.skCyl(36, 110, F.motor, 90, 130, 120, 'z');
    B.skCyl(22, 34, F.brass, 90, 130, 190, 'z');
    B.sk('sk-steam');
    B.skCyl(62, 200, F.steel, -90, 190, 110, 'z', 48);
    for (const z of [40, 180]) B.skCyl(63, 8, F.motor, -90, 190, z, 'z', 48);
    B.sk('sk-brew');
    B.skCyl(48, 170, F.steel, 0, 230, 150, 'y', 48);
    B.sk('sk-valves');
    B.skBox(24, 28, 24, F.motor, 60, 200, 210, 2);
    B.skCyl(9, 24, F.brass, -147, 166, 240, 'z');
    B.skCyl(9, 24, F.brass, 164, 290, 178);
    B.sk('sk-pcb');
    B.skBox(140, 100, 2, F.pcb, 60, 180, -110, 1);
    B.sk('sk-pipes');
    B.pipe([[90, 130, 190], [60, 180, 200], [20, 240, 190], [0, 262, 160]], 3.4, F.copper);
    B.pipe([[-90, 252, 110], [-140, 280, 160], [-163.9, 296, 178]], 3.6, F.copper);
    B.pipe([[-60, 252, 110], [80, 290, 150], [164.1, 296, 178]], 3, F.copper);
    B.pipe([[-143.5, 255, 214], [-120, 230, 170], [-90, 240, 150]], 1.3, F.copper, false);
    B.sk('sk-wires');
    B.pipe([[60, 180, -110], [40, 240, 0], [100, 250, 180], [111, 255, 210]], 2.4, F.motor, false);
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
      const o = config.opts?.[ID] || {};
      const mp = o.version !== 'av';
      const wood = config.slots[S('wood.side')]?.id !== 'none';
      sideStd.visible = !wood;
      sideWood.visible = wood;
      for (const w of woodScrews) w.visible = wood;
      const cover = config.slots[S('wood.cover')]?.id !== 'none';
      for (const m of mpParts) m.visible = mp;
      for (const m of mpStd) m.visible = mp && !cover;
      for (const m of mpWood) m.visible = mp && cover;
      for (const m of avStd) m.visible = !mp && !cover;
      for (const m of avWood) m.visible = !mp && cover;
      handleVariants.round.visible = o.handle !== 'facet';
      handleVariants.facet.visible = o.handle === 'facet';
      for (const g of gauges) g.set({ dial: o.dial, needle: o.needle });
      topGauge.set({ dial: o.dial, needle: o.needle });
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
    slots: [
      { key: S('body.main'), label: 'Korpus' },
      { key: S('body.side'), label: 'Seitenteile' },
      { key: S('body.tray'), label: 'Tropfschale' },
      { key: S('body.base'), label: 'Sockel' },
    ],
  },
  [S('wood')]: {
    title: 'Holz',
    allLabel: 'Alle',
    slots: [
      { key: S('wood.handle'), label: 'Siebträgergriff' },
      { key: S('wood.paddle'), label: 'Paddle (MP)' },
      { key: S('wood.knob'), label: 'Dampfknopf' },
      { key: S('wood.cover'), label: 'Holzabdeckung Brühgruppe', panel: true },
      { key: S('wood.side'), label: 'Holz-Seitenteile', panel: true },
    ],
  },
  [S('metal')]: {
    title: 'Metallakzente',
    allLabel: 'Alle',
    slots: [
      { key: S('metal.group'), label: 'Brühgruppe & Hals' },
      { key: S('metal.portafilter'), label: 'Siebträger' },
      { key: S('metal.wands'), label: 'Dampflanze & Heißwasser' },
      { key: S('metal.gauges'), label: 'Manometer-Ringe', options: ['dial', 'needle'] },
      { key: S('metal.keys'), label: 'Tasten' },
      { key: S('metal.cup'), label: 'Tassenablage' },
      { key: S('metal.grates'), label: 'Tropfblech' },
      { key: S('metal.screws'), label: 'Schrauben' },
      { key: S('metal.feet'), label: 'Füße' },
      { key: S('metal.logo'), label: 'Schriftzüge', woodLogo: true },
    ],
  },
};
const SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));
const OPTIONS = [
  { key: 'version', label: 'Ausführung', choices: [{ id: 'mp', name: 'MP (Paddle)' }, { id: 'av', name: 'AV (Tasten)' }] },
  { key: 'handle', label: 'Siebträgergriff', choices: [{ id: 'round', name: 'La Marzocco' }, { id: 'facet', name: 'rb.crafts' }] },
  { key: 'dial', label: 'Manometer', choices: GAUGE_DIALS },
  { key: 'needle', label: 'Zeiger', choices: NEEDLES },
];
const all = (cat, id, finish) => Object.fromEntries(CATEGORIES[S(cat)].slots.map((s) => [s.key, { id, finish }]));
const woods = (id, keys = ['handle', 'paddle', 'knob']) => Object.fromEntries(keys.map((k) => [S(`wood.${k}`), { id, finish: 'oiled' }]));
const NEUTRAL = {
  [S('wood.cover')]: { id: 'none', finish: 'oiled' },
  [S('wood.side')]: { id: 'none', finish: 'oiled' },
};
function preset(name, swatches, slots, opts = {}) {
  return { name, swatches, config: { slots: { ...NEUTRAL, ...slots }, opts: { version: 'mp', handle: 'facet', dial: 'white', needle: 'red', ...opts } } };
}
const GOLD = { id: 'gold', finish: 'gloss' };
const PRESETS = [
  // "Custom GS3 Schwarz Gold Olive" (rb.crafts): schwarzer Body, goldene Details, Olivenholz an
  // Seitenteilen, Abdeckung, Paddle, Griff und Dampfknopf
  preset('Schwarz · Gold · Olive (rb.crafts)', ['#111113', '#e1b866', '#dd9540'], {
    ...all('body', 'RAL9005', 'matte'),
    ...all('metal', 'gold', 'gloss'),
    ...woods('olive'),
    [S('wood.side')]: { id: 'olive', finish: 'oiled' },
    [S('wood.cover')]: { id: 'olive', finish: 'oiled' },
    [S('metal.group')]: { id: 'black', finish: 'matte' },
    [S('metal.cup')]: { id: 'black', finish: 'matte' },
    [S('metal.grates')]: { id: 'black', finish: 'matte' },
    [S('metal.portafilter')]: GOLD,
  }, { dial: 'black', needle: 'gold' }),
  // Holz-Seitenteile und Holzabdeckung Walnuss auf der Edelstahl-GS3
  preset('Edelstahl · Walnuss (rb.crafts)', ['#cfd1d3', '#644434', '#e4e6e9'], {
    ...all('body', '4201E79975L30', 'gloss'),
    [S('body.base')]: { id: 'RAL9005', finish: 'matte' },
    ...all('metal', 'chrome', 'gloss'),
    ...woods('walnut'),
    [S('wood.side')]: { id: 'walnut', finish: 'oiled' },
    [S('wood.cover')]: { id: 'walnut', finish: 'oiled' },
    [S('metal.keys')]: { id: 'steel', finish: 'satin' },
    [S('metal.feet')]: { id: 'black', finish: 'matte' },
  }),
  // Seitenteile in Beton-Optik (Corian) auf schwarzer GS3
  preset('Schwarz · Beton (rb.crafts Corian)', ['#161616', '#b9b6b0', '#644434'], {
    ...all('body', 'RAL9005', 'matte'),
    [S('body.side')]: { id: 'RAL7044', finish: 'texture' },
    ...all('metal', 'black', 'matte'),
    ...woods('walnut', ['handle']),
    ...woods('black', ['paddle', 'knob']),
    [S('metal.group')]: { id: 'dlc', finish: 'matte' },
    [S('metal.wands')]: { id: 'steel', finish: 'satin' },
    [S('metal.portafilter')]: { id: 'dlc', finish: 'matte' },
    [S('metal.logo')]: { id: 'steel', finish: 'satin' },
  }, { dial: 'black', needle: 'white' }),
  // Werksausführungen
  preset('Edelstahl MP (Werk)', ['#cfd1d3', '#111113', '#e4e6e9'], {
    ...all('body', '4201E79975L30', 'gloss'),
    [S('body.base')]: { id: 'RAL9005', finish: 'matte' },
    ...all('metal', 'chrome', 'gloss'),
    ...woods('black'),
    [S('metal.keys')]: { id: 'steel', finish: 'satin' },
    [S('metal.feet')]: { id: 'black', finish: 'matte' },
  }, { handle: 'round' }),
  preset('Edelstahl AV (Werk)', ['#cfd1d3', '#111113', '#e4e6e9'], {
    ...all('body', '4201E79975L30', 'gloss'),
    [S('body.base')]: { id: 'RAL9005', finish: 'matte' },
    ...all('metal', 'chrome', 'gloss'),
    ...woods('black'),
    [S('metal.keys')]: { id: 'steel', finish: 'satin' },
    [S('metal.feet')]: { id: 'black', finish: 'matte' },
  }, { version: 'av', handle: 'round' }),
];

registerDevice({
  id: ID,
  kind: 'machine',
  brand: 'La Marzocco',
  name: 'GS3',
  full: 'La Marzocco GS3',
  file: 'GS3',
  code: 'GS3',
  dims: { w: 410, d: 530, h: 441 },
  rootZ: -0.133,
  shadow: { w: 0.64, d: 0.7, z: 0.133 },
  frame: { target: [0, 0.21, 0], scale: 1.12 },
  slots: SLOTS,
  categories: CATEGORIES,
  presets: PRESETS,
  options: OPTIONS,
  optionsTitle: 'Ausstattung',
  build: (mm) => buildGS3(mm),
  UI: DeviceUI,
  roles: {
    body: [S('body.main'), S('body.side'), S('body.tray'), S('body.base')],
    accent: [S('metal.group'), S('metal.portafilter'), S('metal.wands'), S('metal.gauges'), S('metal.keys'), S('metal.feet'), S('metal.grates'), S('metal.cup')],
    wood: [S('wood.handle'), S('wood.paddle'), S('wood.knob')],
    screws: [S('metal.screws')],
    logo: [S('metal.logo')],
  },
  stageLabels: {
    'sk-base': ['Bodenblech', 'Edelstahl'],
    'sk-frame': ['Rahmen', 'Edelstahl'],
    'sk-tank': ['Wassertank 3,5 l', 'Tritan'],
    'sk-pump': ['Rotationspumpe', 'Motor & Messing'],
    'sk-steam': ['Dampfkessel 3,5 l', 'Edelstahl, isoliert'],
    'sk-brew': ['Brühkessel 1,5 l', 'Edelstahl'],
    'sk-valves': ['Ventile', 'Messing'],
    'sk-pcb': ['Steuerung', 'Elektronik'],
    'sk-pipes': ['Leitungen', 'Kupfer'],
    'sk-wires': ['Kabelbaum', ''],
    base: ['Sockel', S('body.base')],
    feet: ['Füße', S('metal.feet')],
    body: ['Korpus', S('body.main')],
    gauges: ['Manometer', S('metal.gauges')],
    keys: ['Tastenfeld', S('metal.keys')],
    sides: ['Seitenteile', [S('body.side'), S('wood.side')]],
    neck: ['Gruppenhals', S('metal.group')],
    group: ['Brühgruppe', S('metal.group')],
    top: ['Kappe', [S('metal.group'), S('wood.cover')]],
    paddle: ['Paddle', S('wood.paddle')],
    wands: ['Dampflanze & Heißwasser', S('metal.wands')],
    knob: ['Dampfknopf', S('wood.knob')],
    portafilter: ['Siebträger', [S('metal.portafilter'), S('wood.handle')]],
    drip: ['Tropfschale', [S('body.tray'), S('metal.grates')]],
    tray: ['Tassenablage', S('metal.cup')],
    screws: ['Schrauben', S('metal.screws')],
    logo: ['Schriftzüge', S('metal.logo')],
  },
});
