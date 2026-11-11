// ---------------------------------------------------------------------------
// La Marzocco Linea Micra
//
// Maße in Millimeter, vermessen an der offiziellen Werkszeichnung LM0028856
// (A3, Maßstab 1:5: Breite 290, Höhe 338, Tiefe 432/472 mm) und an Schnitten
// durch das zugehörige 3D-CAD-Modell von La Marzocco (nur als Messreferenz).
// Aufbau und Innenleben nach dem Ersatzteilkatalog "Linea Micra V1.0"
// (Carrozzeria, Bacinella, Gruppo caffè, Caldaia vapore, Impianto idraulico).
//
// Koordinaten: X = Breite (rechts = Dampflanze), Y = Höhe (0 = Stellfläche),
//              Z = Tiefe (+Z = Front). Z = 0 ist die Frontplatte.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, rbox, profileExtrudeX, extrudeZ, woodBoxUV, woodCylUV, mergeGeos } from '../model.js';
import { makeSlotFieldTexture, makePlateTexture } from '../textures.js';
import { GAUGE_DIALS, NEEDLES } from '../data.js';
import { registerDevice } from '../devices.js';
import { DeviceUI } from '../device-ui.js';
import { createBuilder, filletShape, circleHole, plateZ, plateY, latheY, latheZ, sheetSweep, buildGauge, screwSet, logoFactory, tubeAlong, flipWinding, WOOD_V } from '../parts.js';

const ID = 'micra';
const S = (k) => `${ID}:${k}`;

/** Hauptmaße (aus Zeichnung und CAD-Schnitten) */
const M = {
  halfW: 143.5, // Oberkorpus außen (Breite 287 + Frontplatte 289)
  top: 336.6,
  rimIn: 127, // Innenkante des oberen Rands
  rimRear: -274.4,
  trayY: 322.9, // Tassenablage
  lipBot: 314.6,
  headHalfW: 119.5,
  headBot: 225.6,
  headTop: 321.6,
  headFront: 118.5,
  baseHalfW: 114.3,
  baseBot: 17,
  baseTop: 77,
  baseRear: -251,
  dripHalfW: 127.5,
  dripFront: 140.7,
  dripBack: 2.7,
  dripBot: 17.9,
  grateTop: 78.9,
  groupZ: 57.5,
};
/** Unterkante des Oberkorpus (steigt nach hinten um 15,4 mm) */
const yBot = (z) => 208.9 + 15.4 * Math.min(1, Math.max(0, -z / 275.5));
/** Rückwand des Oberkorpus (lehnt sich nach hinten) */
const zrU = (y) => -275.6 - 0.1384 * (y - 225.3);
/** Unterkorpus: Seitenwände verjüngen sich nach unten, Rückwand lehnt nach hinten */
const hwL = (y) => 104.6 + (y - 77.4) * 0.1765;
const zrL = (y) => -242.3 - 0.1404 * (y - 78.5);

const STAGES = [
  { id: 'sk-base', src: 'skeleton', from: [0, 1, 0], dist: 420, gap: 0, dur: 0.75, drop: true },
  { id: 'sk-frame', src: 'skeleton', from: [0, 0.15, 1], dist: 800, gap: 0.5, dur: 0.75 },
  { id: 'sk-tank', src: 'skeleton', from: [0, 1, 0], dist: 700, gap: 0.4, dur: 0.75 },
  { id: 'sk-pump', src: 'skeleton', from: [-1, 0.1, 0], dist: 900, gap: 0.4, dur: 0.85, spin: [[1, 0, 0], Math.PI * 2] },
  { id: 'sk-steam', src: 'skeleton', from: [1, 0.55, 0], dist: 1000, gap: 0.45, dur: 0.95, heavy: true },
  { id: 'sk-brew', src: 'skeleton', from: [0, 1, 0.3], dist: 900, gap: 0.5, dur: 0.85 },
  { id: 'sk-valves', src: 'skeleton', pop: true, gap: 0.35, dur: 0.35, stagger: 0.12 },
  { id: 'sk-pcb', src: 'skeleton', from: [0, 0, -1], dist: 800, gap: 0.3, dur: 0.6, stagger: 0.07 },
  { id: 'sk-pipes', src: 'skeleton', grow: true, gap: 0.4, dur: 0.65, stagger: 0.26 },
  { id: 'sk-wires', src: 'skeleton', grow: true, gap: 0.3, dur: 0.6, stagger: 0.2 },
  { id: 'base', from: [0, -1, 0.35], dist: 650, gap: 0.45, after: true, dur: 0.9, heavy: true },
  { id: 'feet', from: [0, -1, 0], dist: 400, gap: 0.3, dur: 0.6, stagger: 0.08 },
  { id: 'lower', from: [-1, 0.15, 0.35], dist: 1000, gap: 0.4, dur: 0.95, heavy: true },
  { id: 'front', from: [0, 0.1, 1], dist: 900, gap: 0.45, dur: 0.8 },
  { id: 'gauges', from: [0, 0, 1], dist: 700, gap: 0.45, dur: 0.6, spin: [[0, 0, 1], Math.PI * 2] },
  { id: 'upper', from: [0.15, 1, -0.25], dist: 1000, gap: 0.3, dur: 1.0, heavy: true },
  { id: 'head', from: [0.25, 0.35, 1], dist: 1000, gap: 0.55, dur: 0.9, heavy: true },
  { id: 'group', from: [0, -1, 0.55], dist: 800, gap: 0.45, dur: 0.65, spin: [[0, 1, 0], Math.PI] },
  { id: 'wand', from: [1, 0.2, 0.45], dist: 900, gap: 0.25, dur: 0.8 },
  { id: 'portafilter', from: [-0.1, -0.3, 1], dist: 900, gap: 0.35, dur: 0.9, spin: [[0, 1, 0], -0.9] },
  { id: 'frame', from: [0, 0.3, 1], dist: 900, gap: 0.4, dur: 0.7 },
  { id: 'paddle', from: [0.2, 0.5, 1], dist: 900, gap: 0.3, dur: 0.7 },
  { id: 'knobs', from: [0, 0.1, 1], dist: 900, gap: 0.2, dur: 0.8, spin: [[0, 0, 1], Math.PI * 3] },
  { id: 'drip', from: [0, -0.25, 1], dist: 900, gap: 0.4, dur: 0.8 },
  { id: 'tray', from: [0, 1, 0], dist: 600, gap: 0.45, dur: 0.55 },
  { id: 'panels', perSide: true, dist: 1000, gap: 0.45, dur: 0.9, heavy: true },
  { id: 'rail', from: [-0.2, 1, 0.35], dist: 800, gap: 0.3, dur: 0.9, spin: [[0, 1, 0], 0.7] },
  { id: 'screws', pop: true, gap: 0.5, dur: 0.3, stagger: 0.03 },
  { id: 'logo', pop: true, gap: 0.4, dur: 0.5 },
];
const isInner = (id) => id.startsWith('sk-');

// zwei Holzumrandungen (magnetisch): mit leicht abgesetzter Kante
const PANEL_T = 6;

function buildMicra(mm) {
  const B = createBuilder('LineaMicra', mm);
  const { root, F } = B;
  const mat = (k, extra) => mm.get(S(k), extra);
  const body = mat('body.main');
  const headMat = mat('body.head');
  const trayMat = mat('body.tray');
  const baseMat = mat('body.base');

  // =========================================================================
  // Sockel (lackiert, laut Katalog Pos. 9) mit Netzschalter links hinten
  // =========================================================================
  B.stage('base');
  {
    const h = M.baseTop - M.baseBot;
    const d = M.dripBack - M.baseRear;
    B.add(boxProjectUV(rbox(M.baseHalfW * 2, h, d, 4.5, 4)), baseMat, S('body.base')).position.set(0, M.baseBot + h / 2, (M.dripBack + M.baseRear) / 2);
    // Netzschalter (Wippe) an der linken Seite hinten
    const sx = -M.baseHalfW;
    B.plain(rbox(3.2, 25, 51, 1, 2), F.blackPlastic).position.set(sx - 1.2, 47, -201);
    const rocker = B.plain(rbox(3, 19, 43, 1.4, 2), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.3 }));
    rocker.position.set(sx - 2.4, 47, -201);
    rocker.rotation.y = -0.05;
    const o = B.plain(new THREE.TorusGeometry(2.3, 0.55, 8, 24), F.white);
    o.rotation.y = Math.PI / 2;
    o.position.set(sx - 4.1, 47, -191);
    const i = B.plain(new THREE.BoxGeometry(0.6, 1.1, 5.5), F.white);
    i.position.set(sx - 4.1, 47, -211);
    // Typenschild rechts
    const plate = B.plain(new THREE.PlaneGeometry(61, 34), new THREE.MeshStandardMaterial({ map: makePlateTexture('LINEA MICRA'), metalness: 0.6, roughness: 0.35 }));
    plate.rotation.y = Math.PI / 2;
    plate.position.set(M.baseHalfW + 0.3, 49, -54.5);
    // Kabel hinten
    const cable = B.plain(tubeAlong([[-60, 30, M.baseRear], [-60, 28, M.baseRear - 18], [-58, 6, M.baseRear - 40], [-52, 3, M.baseRear - 90]], 3.2, 40, 10), F.rubber);
    cable.castShadow = false;
  }
  // Füße: Ø 28 × 16 (Pos. 10), lackier- oder veredelbar
  B.stage('feet');
  {
    const feetMat = mat('metal.feet');
    // Gummifuß: unten Ø 28, nach oben eingezogen (Foto Seitenansicht)
    const g = latheY([
      [0, 0.5],
      [13.4, 0.5],
      [14, 1.6],
      [13.7, 4],
      [11.4, 8.5],
      [9.6, 13],
      [9.2, 17],
      [0, 17],
    ], 40);
    const pad = new THREE.CylinderGeometry(13, 13, 1, 32);
    for (const [x, z] of [
      [-100, 64.5],
      [100, 64.5],
      [-100, -232.5],
      [100, -232.5],
    ]) {
      const foot = B.group();
      foot.position.set(x, 0, z);
      B.add(g, feetMat, S('metal.feet'), foot);
      B.plain(pad, F.rubber, foot).position.y = 0.5;
    }
  }

  // =========================================================================
  // Unterkorpus (Seitenwände + Rückwand, trapezförmig)
  // =========================================================================
  B.stage('lower');
  B.add(
    sheetSweep(
      [
        { hw: hwL(77.4), zr: zrL(77.4), y: 77.4 },
        { hw: hwL(225), zr: zrL(225), y: 225 },
      ],
      { zFront: -0.5, t: 1.2, r: 5 },
    ),
    body,
    S('body.main'),
  );

  // =========================================================================
  // Frontplatte (Pos. 5): unten trapezförmig, oben seitliche Wangen bis zur Oberkante
  // =========================================================================
  B.stage('front');
  {
    const pts = [
      [-108.6, 92],
      [108.6, 92],
      [128.5, 204.7],
      [131, 206.6],
      [142.1, 206.7],
      [144.4, 209.1],
      [144.5, 334.6],
      [141.5, 337.6],
      [122.5, 337.6],
      [119.5, 334.6],
      [119.5, 313.9],
      [-119.5, 313.9],
      [-119.5, 334.6],
      [-122.5, 337.6],
      [-141.5, 337.6],
      [-144.5, 334.6],
      [-144.4, 209.1],
      [-142.1, 206.7],
      [-131, 206.6],
      [-128.5, 204.7],
    ];
    const sh = filletShape(pts, [2, 2, 3, 1.5, 1.5, 2, 0, 2.5, 2.5, 0, 0, 0, 0, 2.5, 2.5, 0, 2, 1.5, 1.5, 3], 3);
    sh.holes.push(circleHole(-82.5, 148.6, 22.3), circleHole(82.5, 148.6, 22.3));
    B.add(boxProjectUV(plateZ(sh, -0.5, 2, 0.45, 48)), body, S('body.main'));
    // unten nach vorn abgekantet (Lasche über der Tropfschale)
    const lip = new THREE.Shape();
    lip.moveTo(-106, 0);
    lip.lineTo(106, 0);
    lip.lineTo(106, 15);
    lip.lineTo(-106, 15);
    lip.closePath();
    const lg = plateZ(lip, 0, 2, 0.4);
    lg.rotateX(-0.27);
    lg.translate(0, 80.8, 1.8);
    B.add(boxProjectUV(lg), body, S('body.main'));
  }

  // =========================================================================
  // Manometer (bündig in der Frontplatte): links Brühdruck 0–18 bar, rechts Dampf 0–3 bar
  // =========================================================================
  B.stage('gauges');
  const gaugeProfile = [
    [22.2, -1],
    [22.2, 6.0],
    [21.7, 6.9],
    [20.6, 7.3],
    [18.6, 7.0],
    [17.7, 6.1],
    [17.4, 3.4],
  ];
  const gauges = [
    buildGauge(B, { slot: S('metal.gauges'), x: -82.5, y: 148.6, z: -6.5, R: 22.2, bezel: 4.8, faceZ: 1.0, profile: gaugeProfile, spec: { id: 'micra-brew', max: 18, step: 1, label: 3, value: 9, unit: 'bar', zone: [8, 10] } }),
    buildGauge(B, { slot: S('metal.gauges'), x: 82.5, y: 148.6, z: -6.5, R: 22.2, bezel: 4.8, faceZ: 1.0, profile: gaugeProfile, spec: { id: 'micra-steam', max: 3, step: 0.25, label: 0.5, value: 1.6, unit: 'bar', zone: [1.5, 2] } }),
  ];
  // dunkles Gehäuse hinter der Öffnung (Blick in die Bohrung)
  for (const x of [-82.5, 82.5]) {
    const c = new THREE.CylinderGeometry(22, 22, 12, 40, 1, true);
    c.rotateX(Math.PI / 2);
    const m = B.plain(c, F.gaugeCase);
    m.position.set(x, 148.6, -6);
    m.material = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.6, side: THREE.BackSide });
  }

  // =========================================================================
  // Oberkorpus (Pos. 4): Seitenwände, schräge Rückwand, oberer Rand mit Vertiefung
  // =========================================================================
  B.stage('upper');
  {
    const yb = (dz) => (z) => yBot(z) + dz;
    const rows = [
      { hw: 132.4, zr: (y) => zrU(y) + 11.1, y: yb(0), r: 1.5 },
      { hw: 142, zr: (y) => zrU(y) + 1.5, y: yb(0), r: 2 },
      { hw: 143.06, zr: (y) => zrU(y) + 0.44, y: yb(0.44), r: 2.6 },
      { hw: M.halfW, zr: zrU, y: yb(1.5), r: 3 },
      { hw: M.halfW, zr: zrU, y: M.top - 1.6 },
      { hw: 143.0, zr: (y) => zrU(y) + 0.5, y: M.top - 0.45, r: 2.6 },
      { hw: 141.9, zr: (y) => zrU(y) + 1.6, y: M.top, r: 2 },
      { hw: 128.6, zr: M.rimRear - 1.6, y: M.top, r: 2 },
      { hw: 127.45, zr: M.rimRear - 0.45, y: M.top - 0.45, r: 1.7 },
      { hw: M.rimIn, zr: M.rimRear, y: M.top - 1.6, r: 1.5 },
      { hw: M.rimIn, zr: M.rimRear, y: M.lipBot, r: 1.5 },
    ];
    B.add(sheetSweep(rows, { zFront: -1, t: 1.0, r: 3 }), body, S('body.main'));
    // Auflage der Tassenablage hinten (Pos. 8, innen)
    B.plain(rbox(250, 1.2, 40, 0.5, 1), F.frame).position.set(0, 313.9, -254);
  }

  // =========================================================================
  // Tassenablage (Pos. 6): zwei Schlitzfelder links/rechts, 28 Schlitze je Feld
  // =========================================================================
  B.stage('tray');
  {
    const W = 251.8;
    const D = 271.2;
    const fields = [
      { x: 125.9 - 106.1, y: 33.5, w: 66.7, h: 205.1, pitch: 7.5, slot: 2.5, dir: 'rows' },
      { x: 125.9 + 39.4, y: 33.5, w: 66.7, h: 205.1, pitch: 7.5, slot: 2.5, dir: 'rows' },
    ];
    const cupMat = mat('metal.cup', { map: makeSlotFieldTexture(W, D, fields, { brushed: 'x' }), alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide });
    const g = new THREE.PlaneGeometry(W, D);
    g.rotateX(-Math.PI / 2);
    const plate = B.add(g, cupMat, S('metal.cup'));
    plate.position.set(0, M.trayY, -1.2 - D / 2);
    // Abkantungen (vorn nach unten, seitlich)
    const lipG = boxProjectUV(rbox(W, 8, 1, 0.4, 1));
    B.add(lipG, mat('metal.cup'), S('metal.cup')).position.set(0, M.trayY - 4, -1.0);
    // darunter: Deckel des Wassertanks (dunkel) – die Schlitze wirken tief
    const inner = B.plain(new THREE.BoxGeometry(W - 4, 1, D - 6), F.trayInner);
    inner.position.set(0, M.trayY - 9, -1.2 - D / 2);
    inner.receiveShadow = true;
  }

  // =========================================================================
  // Kopfteil (Pos. 2 + Abdeckung Pos. 3)
  // =========================================================================
  B.stage('head');
  {
    const h = M.headTop - M.headBot;
    const sh = filletShape(
      [
        [-M.headHalfW, 1.5],
        [M.headHalfW, 1.5],
        [M.headHalfW, M.headFront],
        [-M.headHalfW, M.headFront],
      ],
      [0, 0, 1.6, 1.6],
      3,
    );
    // geschlossener Kasten (Unterseite + Rückseite liegen verdeckt)
    const box = plateY(sh, M.headBot, h, 0.5);
    B.add(boxProjectUV(box), headMat, S('body.head'));
    // Abdeckung oben (2 mm, schließt bündig ab)
    const top = plateY(
      filletShape(
        [
          [-M.headHalfW, 0.5],
          [M.headHalfW, 0.5],
          [M.headHalfW, M.headFront],
          [-M.headHalfW, M.headFront],
        ],
        [0, 0, 1.4, 1.4],
        3,
      ),
      M.headTop,
      2,
      0.5,
    );
    B.add(boxProjectUV(top), headMat, S('body.head'));
    // Bedienfeld-Öffnung um die Paddle-Blende (dunkle Fuge)
    const gap = B.plain(rbox(128, 22, 0.6, 3, 2), F.darkGap);
    gap.position.set(0, 270.6, M.headFront + 0.05);
  }

  // =========================================================================
  // Brühgruppe: Abdeckscheibe unter dem Kopfteil, Ring mit Bajonett, Dichtung
  // =========================================================================
  B.stage('group');
  const groupMat = mat('metal.group');
  {
    const g = latheY([
      [0, 197.5],
      [33, 197.5],
      [36, 198.5],
      [41, 199.5],
      [41.5, 203],
      [41.5, 206.5],
      [46, 207.5],
      [53.5, 212],
      [54.9, 214],
      [54.9, 218.2],
      [54, 219.2],
      [0, 219.2],
    ], 72);
    B.add(g, groupMat, S('metal.group')).position.set(0, 0, M.groupZ);
    const gasket = B.plain(new THREE.CylinderGeometry(33, 33, 1.5, 48), F.gasket);
    gasket.position.set(0, 197.2, M.groupZ);
    // Halteschrauben der Gruppe (unter dem Kopfteil sichtbar)
    for (const [x, z] of [
      [-42.2, 33],
      [42.2, 33],
      [0, 106],
    ]) {
      const c = B.plain(new THREE.CylinderGeometry(6.5, 6.5, 6.4, 6), F.steel);
      c.position.set(x, 222.4, z);
    }
  }

  // =========================================================================
  // Dampflanze (rechts) und Heißwasserauslass (links)
  // =========================================================================
  B.stage('wand');
  const wandMat = mat('metal.wand');
  {
    const pts = [
      [90, 226, 88.6],
      [90, 210, 88.4],
      [90, 199, 89.6],
      [90, 192, 96],
      [90, 186, 112],
      [90, 180, 132],
      [90, 174, 148],
      [90, 168, 158],
      [90, 160, 162.2],
      [90, 140, 161.8],
      [90, 120, 160.4],
      [90, 113.5, 160.1],
    ];
    B.add(tubeAlong(pts, 6, 140, 28), wandMat, S('metal.wand'));
    B.add(new THREE.CylinderGeometry(8.5, 8.5, 5, 6), wandMat, S('metal.wand')).position.set(90, M.headBot - 2.5, 88.6);
    // Düse
    const tip = latheY([
      [0, 97.4],
      [4.2, 97.4],
      [5.4, 98.6],
      [5.6, 104],
      [6.5, 105],
      [6.5, 112.4],
      [5.6, 113.6],
      [0, 113.6],
    ], 32);
    const t = B.add(tip, wandMat, S('metal.wand'));
    t.position.set(90, 0, 157.6 + 2.5);
    t.position.z = 160.1;
    t.rotation.x = -0.02;
    const ring = B.plain(new THREE.TorusGeometry(6.2, 0.6, 8, 32), F.darkGap);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(90, 104.6, 160.1);
  }
  {
    const hw = latheY([
      [0, 214.6],
      [11.6, 214.6],
      [11.6, 226],
      [0, 226],
    ], 40);
    B.add(hw, wandMat, S('metal.wand')).position.set(-90, 0, 89.2);
    const noz = latheY([
      [0, 200],
      [6.5, 200],
      [8.8, 202],
      [8.8, 214.7],
      [0, 214.7],
    ], 32);
    B.add(noz, wandMat, S('metal.wand')).position.set(-90, 0, 89.2);
    const hole = B.plain(new THREE.CircleGeometry(2.6, 20), F.darkGap);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(-90, 199.9, 89.2);
  }

  // =========================================================================
  // Siebträger (zweiteilig: Metallkopf + Griff), Achse der Gruppe bei z = 57,5
  // =========================================================================
  B.stage('portafilter');
  const pfMat = mat('metal.portafilter');
  const handleVariants = {};
  {
    const pf = B.group();
    pf.position.set(0, 0, M.groupZ);
    // Siebträgerkopf mit Bajonett-Nasen
    B.add(
      latheY([
        [0, 175.5],
        [26, 175.5],
        [31, 178],
        [32.4, 182],
        [32.4, 193],
        [33.4, 194],
        [33.4, 197],
        [27, 197],
      ], 64),
      pfMat,
      S('metal.portafilter'),
      pf,
    );
    for (const sx of [-1, 1]) B.add(rbox(9, 6, 17, 2, 2), pfMat, S('metal.portafilter'), pf).position.set(sx * 36.5, 193.5, 0);
    // Doppelauslauf
    B.add(latheY([[0, 165], [9, 165], [10, 168], [13, 176], [0, 176]], 32), pfMat, S('metal.portafilter'), pf).position.z = 14;
    for (const sx of [-1, 1]) {
      const sp = B.add(new THREE.CylinderGeometry(3, 3.6, 13, 20), pfMat, S('metal.portafilter'), pf);
      sp.position.set(sx * 9, 160, 14);
      sp.rotation.z = sx * 0.55;
      const mouth = B.plain(new THREE.CircleGeometry(2.4, 16), F.darkGap, pf);
      mouth.rotation.x = Math.PI / 2;
      mouth.position.set(sx * 12.4, 154.4, 14);
    }
    // Hals und Griff (Achse fällt leicht nach hinten ab)
    // Griffachse laut CAD-Schnitten: y = 183,2 bei z = 130, fällt um 0,1 rad nach hinten ab
    const handle = B.group(pf);
    handle.position.set(0, 190.6, 0);
    handle.rotation.x = 0.1026;
    const neck = latheZ([
      [0, 26],
      [9.5, 26],
      [9.5, 34],
      [8.6, 50],
      [9.6, 58],
      [0, 58],
    ], 32);
    B.add(neck, pfMat, S('metal.portafilter'), handle);
    const handleMat = mat('wood.handle');
    const L = 136;
    // Radien laut CAD (Griff LM0002249): Bund vorn, Taille, dickste Stelle bei 76 mm
    const hprof = [
      [0, 0],
      [13.6, 0],
      [14.4, 2],
      [13.2, 10],
      [12.8, 18],
      [13.6, 32],
      [14, 50],
      [15.6, 66],
      [16.4, 76],
      [16.2, 90],
      [15.2, 106],
      [14.5, 116],
      [13.2, 124],
      [11.6, 130],
      [8.4, 134],
      [4, 135.8],
      [0, 136],
    ];
    const rbprof = [
      [0, 0],
      [11.4, 0],
      [12, 4],
      [17, 122],
      [17, 128],
      [13.4, 135.4],
      [0, 136],
    ];
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
    void L;
    handleVariants.round = makeHandle(48, false);
    handleVariants.facet = makeHandle(8, true);
    handleVariants.facet.visible = false;
  }

  // =========================================================================
  // Paddle-Blende (Pos. 3 auf S. 8, "Brühgruppenabdeckung" bei rb.crafts) und Paddle (Pos. 2)
  // =========================================================================
  B.stage('frame');
  const frameMat = mat('wood.frame');
  {
    // seitliche Lappen mit Symbolen (Wasser / Ein)
    const tabs = plateZ(filletShape([[-62, 261.6], [62, 261.6], [62, 279.6], [-62, 279.6]], 5, 4), M.headFront, 5, 1.2);
    B.add(woodBoxUV(tabs, 0, [0.4, 0.1]), frameMat, S('wood.frame'));
    // Mittelteil: Pyramidenstumpf (hinten 94 × 39 mm, vorn 25 × 21,5 mm, 23 mm tief)
    const back = [
      [-47, 252],
      [47, 252],
      [47, 290],
      [-47, 290],
    ];
    const front = [
      [-12.4, 259.8],
      [12.4, 259.8],
      [12.4, 281.2],
      [-12.4, 281.2],
    ];
    const mid = [
      [-33.9, 255.4],
      [33.9, 255.4],
      [33.9, 285.6],
      [-33.9, 285.6],
    ];
    const zs = [M.headFront, 133.2, 141.5];
    const loops = [back, mid, front];
    const verts = [];
    const quads = [];
    loops.forEach((lp, k) => lp.forEach(([x, y]) => verts.push([x, y, zs[k]])));
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < 4; i++) {
        const a = k * 4 + i;
        const b = k * 4 + ((i + 1) % 4);
        quads.push([a, b, b + 4, a + 4]);
      }
    }
    quads.push([8, 9, 10, 11]);
    const pos = [];
    const tri = (a, b, c) => pos.push(...verts[a], ...verts[b], ...verts[c]);
    for (const [a, b, c, d] of quads) {
      tri(a, b, c);
      tri(a, c, d);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.computeVertexNormals();
    B.add(woodBoxUV(fg, 0, [0.62, 0.3]), frameMat, S('wood.frame'));
    // Symbole auf den Lappen
    const iconMat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.5 });
    const drop = B.plain(new THREE.CircleGeometry(2.6, 20), iconMat);
    drop.position.set(-54, 270.6, M.headFront + 5.05);
    const pw = B.plain(new THREE.RingGeometry(2.2, 3.1, 24, 1, 0.6, Math.PI * 2 - 1.2), iconMat);
    pw.rotation.z = Math.PI / 2;
    pw.position.set(54, 270.6, M.headFront + 5.05);
  }
  B.stage('paddle');
  {
    const lever = profileExtrudeX(
      [
        [128.5, 291.5],
        [131, 298.5],
        [145, 300],
        [176.4, 291.6],
        [180, 286.4],
        [176.3, 255.4],
        [174.4, 253.4],
        [170.2, 253],
        [170.1, 264],
        [145.1, 264],
        [145.1, 287],
        [135.2, 288.7],
      ],
      19.2,
      1.6,
    );
    B.add(woodBoxUV(lever, 1, [0.71, 0.12]), mat('wood.paddle'), S('wood.paddle')).position.x = -13.4;
  }

  // =========================================================================
  // Drehknöpfe (Heißwasser links, Dampf rechts) mit Kappe
  // =========================================================================
  B.stage('knobs');
  const knobMat = mat('wood.knobs');
  const capMat = mat('metal.caps');
  const knobVariants = { lobe: [], round: [] };
  {
    const ring = (R, fn, n = 192) => {
      const sh = new THREE.Shape();
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = fn(a, R);
        if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      return sh;
    };
    // Original: acht Griffmulden, hinten ein glatter Kragen (Chrom)
    const lobes = ring(20.6, (a, R) => R - 2.4 * Math.pow(0.5 - 0.5 * Math.cos(a * 8), 1.6));
    const grip = woodCylUV(extrudeZ(lobes, 25, 2.2, 3, 4), [0.13, 0.31]);
    const collar = latheZ([
      [15, 120.2],
      [21.1, 120.2],
      [21.1, 135.5],
      [20.2, 137.5],
      [15, 137.5],
    ], 48);
    // rb.crafts: glatter Holzzylinder mit Fase
    const cyl = woodCylUV(extrudeZ(ring(21.1, (a, R) => R, 96), 43.6, 1.8, 3, 4), [0.13, 0.31]);
    for (const x of [-90, 90]) {
      const y = 270.6;
      const c = B.plain(collar, F.chrome);
      c.position.set(x, y, 0);
      knobVariants.lobe.push(c);
      const k = B.add(grip, knobMat, S('wood.knobs'));
      k.position.set(x, y, 138.2);
      knobVariants.lobe.push(k);
      const r = B.add(cyl, knobMat, S('wood.knobs'));
      r.position.set(x, y, 120.4);
      r.visible = false;
      knobVariants.round.push(r);
      // Kappe mit Prägung (leicht gewölbt)
      const capG = latheZ([
        [13.7, 0],
        [13.7, 1.6],
        [13.2, 2.2],
        [11.5, 2.4],
        [11, 2.1],
        [8, 2.6],
        [0, 2.9],
      ], 64);
      B.add(capG, capMat, S('metal.caps')).position.set(x, y, 167.6);
      const mark = B.plain(new THREE.BoxGeometry(1.4, 7, 0.5), F.darkGap);
      mark.position.set(x, y + 6.5, 170.45);
    }
  }

  // =========================================================================
  // Tropfschale: Abdeckung in Gehäusefarbe (Pos. 1), Rahmen mit Stabgitter (Pos. 5),
  // roter Schwimmer, Schriftzug
  // =========================================================================
  B.stage('drip');
  const grateMat = mat('metal.grates');
  {
    const h = 76.4 - M.dripBot;
    const d = M.dripFront - M.dripBack;
    B.add(boxProjectUV(rbox(M.dripHalfW * 2, h, d, 3, 3)), trayMat, S('body.tray')).position.set(0, M.dripBot + h / 2, (M.dripFront + M.dripBack) / 2);
    // Rahmen: oben 3 mm, außen umlaufende Schürze bis 68,9
    const outer = filletShape([[-129, 1], [129, 1], [129, 142], [-129, 142]], 3, 3);
    const hole = new THREE.Path();
    hole.moveTo(-117, 12.8);
    hole.lineTo(-117, 131.2);
    hole.lineTo(117, 131.2);
    hole.lineTo(117, 12.8);
    hole.closePath();
    outer.holes.push(hole);
    B.add(boxProjectUV(plateY(outer, 76.0, 2.9, 0.5)), grateMat, S('metal.grates'));
    const skirt = filletShape([[-129, 1], [129, 1], [129, 142], [-129, 142]], 3, 3);
    skirt.holes.push(
      (() => {
        const p = new THREE.Path();
        p.moveTo(-128, 2);
        p.lineTo(-128, 141);
        p.lineTo(128, 141);
        p.lineTo(128, 2);
        p.closePath();
        return p;
      })(),
    );
    B.add(boxProjectUV(plateY(skirt, 68.9, 7.5, 0.3)), grateMat, S('metal.grates'));
    // Stäbe quer (Ø 2 mm, Teilung 8 mm), zwei Längsträger darunter
    const rods = [];
    for (let z = 17.5; z <= 122; z += 8) {
      const c = new THREE.CylinderGeometry(1, 1, 233, 10);
      c.rotateZ(Math.PI / 2);
      c.translate(0, 75.6, z + 0.5);
      rods.push(c.toNonIndexed());
    }
    for (const x of [0, -114.6, 114.6]) {
      const b = new THREE.BoxGeometry(3.8, 3.8, 118);
      b.translate(x, 72.7, 71.5);
      rods.push(b.toNonIndexed());
    }
    const rg = mergeGeos(...rods.map((g) => boxProjectUV(g)));
    B.add(rg, grateMat, S('metal.grates'));
    // Innenraum der Schale (dunkel)
    const inner = B.plain(new THREE.BoxGeometry(232, 1, 116), F.trayInner);
    inner.position.set(0, 50, 72);
    inner.receiveShadow = true;
    // roter Schwimmer (Füllstandsanzeige), ragt durch das Gitter
    const red = new THREE.MeshStandardMaterial({ color: 0xc8231c, roughness: 0.45 });
    // liegt unter dem Gitter und ist durch die Stäbe zu sehen
    for (const x of [-24, 24]) B.plain(rbox(11, 9, 10, 1.5, 2), red).position.set(x, 69.5, 109.5);
  }

  // =========================================================================
  // Holzumrandungen (rb.crafts, magnetisch): oben Seiten + Rückwand, unten Seiten + Rückwand
  // =========================================================================
  B.stage('panels');
  const woodUpper = mat('wood.upper');
  const woodLower = mat('wood.lower');
  const panelUpper = B.group();
  const panelLower = B.group();
  {
    const T = PANEL_T;
    // Seitenteil oben: Kontur der Seitenwand, um T nach außen
    for (const sx of [-1, 1]) {
      const prof = [
        [-0.2, yBot(0) + 0.3],
        [-0.2, M.top],
        [zrU(M.top) - 0.5, M.top],
        [zrU(yBot(-275)) - 0.5, yBot(-275) + 0.3],
      ];
      const g = profileExtrudeX(prof, T, 1.2);
      woodBoxUV(g, 2, [0.27, 0.08]);
      const m = B.add(g, woodUpper, S('wood.upper'), panelUpper);
      m.position.x = sx > 0 ? M.halfW + 0.2 : -M.halfW - 0.2 - T;
    }
    // Rückteil oben: schräge Platte über die ganze Breite
    {
      const y0 = yBot(-275) + 0.3;
      const y1 = M.top;
      const w = (M.halfW + 0.2 + T) * 2;
      const len = Math.hypot(y1 - y0, zrU(y1) - zrU(y0));
      const g = boxProjectUV(rbox(w, len, T, 1.2, 2));
      woodBoxUV(g, 0, [0.5, 0.2]);
      const m = B.add(g, woodUpper, S('wood.upper'), panelUpper);
      const ang = Math.atan2(zrU(y0) - zrU(y1), y1 - y0);
      m.rotation.x = -ang;
      const yc = (y0 + y1) / 2;
      m.position.set(0, yc, zrU(yc) - 0.6 - T / 2);
    }
    // Seitenteile unten: auf den schrägen Seitenwänden
    const lowerSide = (sx) => {
      const y0 = M.baseTop + 2;
      const prof = [
        [1.4, y0],
        [1.4, yBot(0) - 0.6],
        [-262.5, yBot(-262.5) - 0.6],
        [zrL(y0) - 0.6, y0],
      ];
      // Platte in der YZ-Ebene erzeugen und auf die schräge Wand legen
      const g = profileExtrudeX(prof, T, 1.2);
      woodBoxUV(g, 2, [0.61, 0.33]);
      // Neigung der Wand: x = hwL(y) -> Drehung um Z
      const ang = Math.atan(0.1765);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        // x in [0, T] -> Abstand von der Wand; Punkt auf der Wand bei Höhe y
        const nx = Math.cos(ang);
        const ny = -Math.sin(ang);
        const wx = hwL(y) + 0.4;
        pos.setXYZ(i, sx * (wx + x * nx), y + x * ny * 1, pos.getZ(i));
      }
      if (sx < 0) flipWinding(g);
      pos.needsUpdate = true;
      g.computeVertexNormals();
      return B.add(g, woodLower, S('wood.lower'), panelLower);
    };
    lowerSide(1);
    lowerSide(-1);
    // Rückteil unten: Trapez auf der schrägen Rückwand
    {
      const y0 = M.baseTop + 2;
      const y1 = yBot(-262) - 0.6;
      const shp = new THREE.Shape();
      const hw0 = hwL(y0) + 0.4 + T;
      const hw1 = hwL(y1) + 0.4 + T;
      const len = Math.hypot(y1 - y0, zrL(y1) - zrL(y0));
      shp.moveTo(-hw0, 0);
      shp.lineTo(hw0, 0);
      shp.lineTo(hw1, len);
      shp.lineTo(-hw1, len);
      shp.closePath();
      const g = plateZ(shp, -T, T, 1.2, 4);
      woodBoxUV(g, 0, [0.15, 0.4]);
      const m = B.add(g, woodLower, S('wood.lower'), panelLower);
      const ang = Math.atan2(zrL(y0) - zrL(y1), y1 - y0);
      m.rotation.x = -ang;
      m.position.set(0, y0, zrL(y0) - 0.5);
    }
  }

  // =========================================================================
  // Cup Rail (rb.crafts): Rahmen aus hochkant stehendem Flachstahl auf vier Füßen
  // =========================================================================
  B.stage('rail');
  const railMat = mat('metal.rail');
  const rail = B.group();
  {
    const y = M.top + 13;
    const zf = -10;
    const zr = zrU(M.top) + 9;
    const bar = (len, ax) => boxProjectUV(rbox(ax === 'x' ? len : 3, 10, ax === 'z' ? len : 3, 1.2, 2));
    for (const sx of [-1, 1]) {
      B.add(bar(zf - zr, 'z'), railMat, S('metal.rail'), rail).position.set(sx * 135.2, y, (zf + zr) / 2);
      for (const z of [zf - 6, zr + 6]) {
        const leg = B.add(boxProjectUV(rbox(3, 14, 10, 1, 2)), railMat, S('metal.rail'), rail);
        leg.position.set(sx * 135.2, M.top + 5, z);
      }
    }
    B.add(bar(270.4 + 3, 'x'), railMat, S('metal.rail'), rail).position.set(0, y, zr);
  }

  // =========================================================================
  // Schrauben (Positionen laut CAD) und Schriftzüge
  // =========================================================================
  B.stage('screws');
  {
    const screw = screwSet(B, S('metal.screws'));
    for (const sx of [-1, 1]) {
      screw(sx * 132, 222.3, 1.4);
      screw(sx * 132, 322.3, 1.4);
      screw(sx * 98.5, 191.6, 1.4);
      screw(sx * 83, 102.6, 1.4);
      screw(sx * 109.5, M.headTop + 2, 21, [0, 1, 0]);
      screw(sx * 109.5, M.headTop + 2, 98, [0, 1, 0]);
    }
  }
  B.stage('logo');
  const makeLogo = logoFactory(B, S('metal.logo'), 96, 12);
  const frontLogo = makeLogo();
  frontLogo.position.set(66, 44, M.dripFront);
  const rearLogo = makeLogo(4);
  {
    const y = 280;
    rearLogo.position.set(75.5, y, zrU(y) - 0.4);
    rearLogo.rotation.y = Math.PI;
    rearLogo.rotation.x = -Math.atan(0.1384);
  }

  // =========================================================================
  // Rohbau (nur in der Montage): nach den Explosionszeichnungen vereinfacht
  // =========================================================================
  {
    B.sk('sk-base');
    // Bodenwanne mit Prägung (Pos. 11, S. 10)
    B.skBox(212, 40, 312, F.white, 0, 42, -86, 6);
    B.sk('sk-frame');
    // Frontrahmen mit Öffnungen (Pos. 5, S. 8) und Längsträger
    {
      const sh = new THREE.Shape();
      sh.moveTo(-116, 84);
      sh.lineTo(116, 84);
      sh.lineTo(116, 300);
      sh.lineTo(-116, 300);
      sh.closePath();
      sh.holes.push(circleHole(-82.5, 148.6, 24), circleHole(82.5, 148.6, 24), circleHole(0, 200, 30), circleHole(-75, 297.6 - 30, 12), circleHole(75, 297.6 - 30, 12));
      B.skMesh(new THREE.ExtrudeGeometry(sh, { depth: 2, bevelEnabled: false, curveSegments: 24 }), F.frame).position.z = -14;
      for (const sx of [-1, 1]) B.skBox(4, 40, 230, F.frame, sx * 104, 98, -128);
    }
    B.sk('sk-tank');
    // Wassertank unter der Tassenablage (Pos. 6, S. 10)
    B.skBox(206, 58, 196, F.tank, 0, 280, -150, 8);
    B.sk('sk-pump');
    // Rotationspumpe mit Motor
    B.skCyl(32, 104, F.motor, -48, 120, -150, 'z');
    B.skCyl(20, 34, F.brass, -48, 120, -84, 'z');
    B.sk('sk-steam');
    // Dampfkessel mit Isolierung und Spannbändern (S. 26)
    B.skCyl(52, 150, F.steel, 52, 170, -150, 'y', 48);
    for (const y of [130, 210]) B.skCyl(53, 8, F.motor, 52, y, -150, 'y', 48);
    B.skCyl(14, 18, F.brass, 52, 254, -150);
    B.sk('sk-brew');
    // Brühkessel mit integrierter Gruppe (S. 22) im Kopfteil
    B.skCyl(38, 76, F.steel, 0, 262, M.groupZ, 'y', 48);
    B.skBox(96, 30, 50, F.motor, 0, 246, 8, 3);
    B.sk('sk-valves');
    B.skBox(22, 26, 22, F.motor, 40, 205, -40, 2);
    B.skCyl(7, 18, F.brass, 40, 188, -40);
    B.skCyl(9, 24, F.brass, 90, 232, 60);
    B.skCyl(9, 24, F.brass, -90, 232, 60);
    B.sk('sk-pcb');
    B.skBox(140, 90, 2, F.pcb, 0, 150, -238, 1);
    B.skBox(46, 30, 26, F.frame, -30, 130, -226, 2);
    B.sk('sk-pipes');
    B.pipe([[-48, 150, -100], [-30, 190, -60], [0, 230, -10], [0, 240, 30]], 3.2, F.copper);
    B.pipe([[-48, 150, -100], [10, 120, -120], [40, 110, -140]], 3, F.copper);
    B.pipe([[52, 254, -150], [70, 262, -60], [90, 240, 20], [90, 232, 60]], 3.4, F.copper);
    B.pipe([[30, 250, -150], [-40, 262, -60], [-90, 240, 20], [-90, 232, 60]], 3, F.copper);
    B.pipe([[-82.5, 140, -30], [-60, 132, -80], [-40, 134, -130]], 1.3, F.copper, false);
    B.pipe([[82.5, 140, -30], [60, 150, -90], [52, 200, -120]], 1.3, F.copper, false);
    B.sk('sk-wires');
    B.pipe([[0, 190, -236], [-20, 240, -200], [-40, 270, -60], [0, 250, 20]], 2.4, F.motor, false);
    B.pipe([[-30, 115, -226], [-48, 92, -200], [-48, 100, -170]], 2.4, F.motor, false);
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
      const up = config.slots[S('wood.upper')]?.id !== 'none';
      const low = config.slots[S('wood.lower')]?.id !== 'none';
      panelUpper.visible = up;
      panelLower.visible = low;
      rearLogo.visible = !up;
      rail.visible = o.rail === 'on';
      const kn = o.knobs === 'round' ? 'round' : 'lobe';
      for (const [k, list] of Object.entries(knobVariants)) list.forEach((m) => (m.visible = k === kn));
      handleVariants.round.visible = o.handle !== 'facet';
      handleVariants.facet.visible = o.handle === 'facet';
      for (const g of gauges) g.set({ dial: o.dial, needle: o.needle });
    },
  };
}

// ---------------------------------------------------------------------------
// Konfiguration: Bauteile, Optionen, Editionen
// ---------------------------------------------------------------------------
const CATEGORIES = {
  [S('body')]: {
    title: 'Gehäuse',
    allLabel: 'Komplett',
    slots: [
      { key: S('body.main'), label: 'Korpus & Frontplatte' },
      { key: S('body.head'), label: 'Kopfteil' },
      { key: S('body.tray'), label: 'Tropfschale' },
      { key: S('body.base'), label: 'Sockel' },
    ],
  },
  [S('wood')]: {
    title: 'Holz',
    allLabel: 'Alle',
    slots: [
      { key: S('wood.knobs'), label: 'Drehknöpfe' },
      { key: S('wood.paddle'), label: 'Paddle' },
      { key: S('wood.frame'), label: 'Brühgruppenabdeckung (Paddle-Blende)' },
      { key: S('wood.handle'), label: 'Siebträgergriff' },
      { key: S('wood.upper'), label: 'Holzumrandung oben', panel: true },
      { key: S('wood.lower'), label: 'Holzumrandung unten', panel: true },
    ],
  },
  [S('metal')]: {
    title: 'Metallakzente',
    allLabel: 'Alle',
    slots: [
      { key: S('metal.group'), label: 'Brühgruppe' },
      { key: S('metal.portafilter'), label: 'Siebträger' },
      { key: S('metal.wand'), label: 'Dampflanze & Heißwasser' },
      { key: S('metal.caps'), label: 'Knopfkappen' },
      { key: S('metal.gauges'), label: 'Manometer-Ringe', options: ['dial', 'needle'] },
      { key: S('metal.cup'), label: 'Tassenablage' },
      { key: S('metal.grates'), label: 'Tropfgitter' },
      { key: S('metal.screws'), label: 'Schrauben' },
      { key: S('metal.feet'), label: 'Füße' },
      { key: S('metal.rail'), label: 'Cup Rail', options: ['rail'] },
      { key: S('metal.logo'), label: 'Schriftzug', woodLogo: true },
    ],
  },
};
const SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));

const OPTIONS = [
  { key: 'knobs', label: 'Drehknöpfe', choices: [{ id: 'lobe', name: 'La Marzocco' }, { id: 'round', name: 'rb.crafts (Zylinder)' }] },
  { key: 'handle', label: 'Siebträgergriff', choices: [{ id: 'round', name: 'La Marzocco' }, { id: 'facet', name: 'rb.crafts' }] },
  { key: 'dial', label: 'Manometer', choices: GAUGE_DIALS },
  { key: 'needle', label: 'Zeiger', choices: NEEDLES },
  { key: 'rail', label: 'Cup Rail', choices: [{ id: 'off', name: 'Ohne' }, { id: 'on', name: 'Mit' }] },
];

const all = (cat, id, finish) => Object.fromEntries(CATEGORIES[S(cat)].slots.map((s) => [s.key, { id, finish }]));
const woods = (id, keys = ['knobs', 'paddle', 'frame', 'handle']) => Object.fromEntries(keys.map((k) => [S(`wood.${k}`), { id, finish: 'oiled' }]));
const NEUTRAL = {
  [S('wood.upper')]: { id: 'none', finish: 'oiled' },
  [S('wood.lower')]: { id: 'none', finish: 'oiled' },
  [S('metal.cup')]: { id: 'steel', finish: 'satin' },
  [S('metal.rail')]: { id: 'black', finish: 'matte' },
};
const DLC = { id: 'dlc', finish: 'matte' };
function preset(name, swatches, slots, opts = {}) {
  return {
    name,
    swatches,
    config: {
      slots: { ...NEUTRAL, ...slots },
      opts: { knobs: 'round', handle: 'facet', dial: 'white', needle: 'red', rail: 'off', ...opts },
    },
  };
}
const PRESETS = [
  // "Custom Linea Micra All Black": tiefmatt schwarz, Walnuss an Bedienelementen und unterer Umrandung,
  // DLC an Gruppe, Lanze und Siebträger, Naked-Manometer, schwarze Edelstahlfüße
  preset('All Black · Walnuss (rb.crafts)', ['#141414', '#644434', '#232427'], {
    ...all('body', 'RAL9005', 'matte'),
    ...all('metal', 'black', 'matte'),
    ...woods('walnut'),
    [S('wood.lower')]: { id: 'walnut', finish: 'oiled' },
    [S('metal.group')]: DLC,
    [S('metal.wand')]: DLC,
    [S('metal.portafilter')]: DLC,
    [S('metal.gauges')]: DLC,
    [S('metal.cup')]: { id: 'body', finish: 'matte' },
    [S('metal.logo')]: { id: 'wood:walnut', finish: 'oiled' },
  }, { dial: 'naked', needle: 'red' }),
  // "Custom Linea Micra Eiche Elfenbein": elfenbeinfarben, Eiche, schwarze DLC-Details, Reling
  preset('Elfenbein · Eiche (rb.crafts)', ['#e5d8bd', '#d99c52', '#232427'], {
    ...all('body', 'RAL1015', 'satin'),
    ...all('metal', 'black', 'matte'),
    ...woods('oak'),
    [S('metal.group')]: DLC,
    [S('metal.wand')]: DLC,
    [S('metal.portafilter')]: DLC,
    [S('metal.gauges')]: DLC,
    [S('metal.cup')]: { id: 'body', finish: 'satin' },
    [S('metal.screws')]: { id: 'body', finish: 'satin' },
    [S('metal.logo')]: { id: 'wood:oak', finish: 'oiled' },
  }, { dial: 'naked', rail: 'on' }),
  // "Custom Linea Micra Special Bronze mit Walnuss": Bronze, schwarze Knöpfe/Lanze/Manometer,
  // Walnuss an Griff, Blende, Schriftzug und oberer Umrandung
  preset('Special Bronze · Walnuss (rb.crafts)', ['#8c7d64', '#644434', '#161616'], {
    ...all('body', '4201E13212L3F', 'texture'),
    ...all('metal', 'black', 'matte'),
    ...woods('black', ['knobs', 'paddle']),
    ...woods('walnut', ['frame', 'handle']),
    [S('wood.upper')]: { id: 'walnut', finish: 'oiled' },
    [S('metal.group')]: DLC,
    [S('metal.cup')]: { id: 'body', finish: 'texture' },
    [S('metal.logo')]: { id: 'wood:walnut', finish: 'oiled' },
  }, { dial: 'naked', rail: 'on' }),
  // Werksausführungen
  preset('Edelstahl (Werk)', ['#c6c2c3', '#111113', '#e4e6e9'], {
    ...all('body', '4201E79975L30', 'satin'),
    [S('body.base')]: { id: 'RAL9005', finish: 'matte' },
    ...all('metal', 'chrome', 'gloss'),
    ...woods('black'),
    [S('metal.cup')]: { id: 'steel', finish: 'satin' },
    [S('metal.grates')]: { id: 'steel', finish: 'gloss' },
    [S('metal.screws')]: { id: 'steel', finish: 'satin' },
    [S('metal.feet')]: { id: 'black', finish: 'matte' },
    [S('metal.logo')]: { id: 'red', finish: 'gloss' },
  }, { knobs: 'lobe', handle: 'round' }),
  preset('Weiß (Werk)', ['#efefea', '#111113', '#e4e6e9'], {
    ...all('body', 'RAL9016', 'gloss'),
    [S('body.base')]: { id: 'RAL9005', finish: 'matte' },
    ...all('metal', 'chrome', 'gloss'),
    ...woods('black'),
    [S('metal.cup')]: { id: 'steel', finish: 'satin' },
    [S('metal.grates')]: { id: 'steel', finish: 'gloss' },
    [S('metal.screws')]: { id: 'steel', finish: 'satin' },
    [S('metal.feet')]: { id: 'black', finish: 'matte' },
    [S('metal.logo')]: { id: 'red', finish: 'gloss' },
  }, { knobs: 'lobe', handle: 'round' }),
];

registerDevice({
  id: ID,
  kind: 'machine',
  brand: 'La Marzocco',
  name: 'Linea Micra',
  full: 'La Marzocco Linea Micra',
  file: 'Linea-Micra',
  code: 'LMC',
  dims: { w: 290, d: 432, h: 338 },
  rootZ: 0.055,
  shadow: { w: 0.5, d: 0.6, z: -0.055 },
  frame: { target: [0, 0.165, 0], scale: 0.9 },
  slots: SLOTS,
  categories: CATEGORIES,
  presets: PRESETS,
  options: OPTIONS,
  optionsTitle: 'Ausstattung',
  build: (mm) => buildMicra(mm),
  UI: DeviceUI,
  roles: {
    body: [S('body.main'), S('body.head'), S('body.tray'), S('body.base')],
    accent: [S('metal.group'), S('metal.portafilter'), S('metal.wand'), S('metal.caps'), S('metal.gauges'), S('metal.feet'), S('metal.rail'), S('metal.grates')],
    wood: [S('wood.knobs'), S('wood.paddle'), S('wood.frame'), S('wood.handle')],
    screws: [S('metal.screws')],
    logo: [S('metal.logo')],
  },
  stageLabels: {
    'sk-base': ['Bodenwanne', 'Kunststoff'],
    'sk-frame': ['Frontrahmen & Längsträger', 'Edelstahl'],
    'sk-tank': ['Wassertank 1,6 l', 'Tritan'],
    'sk-pump': ['Rotationspumpe', 'Motor & Messing'],
    'sk-steam': ['Dampfkessel 1,6 l', 'Edelstahl, isoliert'],
    'sk-brew': ['Brühkessel mit Gruppe', 'Edelstahl'],
    'sk-valves': ['Ventile', 'Messing'],
    'sk-pcb': ['Steuerung', 'Elektronik'],
    'sk-pipes': ['Leitungen', 'Kupfer'],
    'sk-wires': ['Kabelbaum', ''],
    base: ['Sockel', S('body.base')],
    feet: ['Füße', S('metal.feet')],
    lower: ['Unterkorpus', S('body.main')],
    front: ['Frontplatte', S('body.main')],
    gauges: ['Manometer', S('metal.gauges')],
    upper: ['Oberkorpus', S('body.main')],
    head: ['Kopfteil', S('body.head')],
    group: ['Brühgruppe', S('metal.group')],
    wand: ['Dampflanze & Heißwasser', S('metal.wand')],
    portafilter: ['Siebträger', [S('metal.portafilter'), S('wood.handle')]],
    frame: ['Brühgruppenabdeckung', S('wood.frame')],
    paddle: ['Paddle', S('wood.paddle')],
    knobs: ['Drehknöpfe', [S('wood.knobs'), S('metal.caps')]],
    drip: ['Tropfschale', [S('body.tray'), S('metal.grates')]],
    tray: ['Tassenablage', S('metal.cup')],
    panels: ['Holzumrandung', [S('wood.upper'), S('wood.lower')]],
    rail: ['Cup Rail', S('metal.rail')],
    screws: ['Schrauben', S('metal.screws')],
    logo: ['Schriftzug', S('metal.logo')],
  },
});
