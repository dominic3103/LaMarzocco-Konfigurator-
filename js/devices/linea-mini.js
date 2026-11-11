// ---------------------------------------------------------------------------
// La Marzocco Linea Mini (klassische Ausführung, vor der Linea Mini R)
//
// Maße in Millimeter, vermessen an der offiziellen Werkszeichnung "LINEA MINI"
// (A3, Maßstab 1:5, 02/2015: Breite 357, Höhe 377, Tiefe 453/530 mm) und an
// Schnitten durch das zugehörige 3D-CAD-Modell von La Marzocco (nur als
// Messreferenz; Teilenummern wie im Ersatzteilkatalog V1.6, z. B. C.1.188
// Frontrahmen, C.1.189 Korpus, C.1.194 Tassenablage, F.1.055 Drehknopf).
// Siebträger nach Katalog S. 38 (im CAD nicht enthalten).
//
// Koordinaten: X = Breite (rechts = Dampflanze), Y = Höhe (0 = Stellfläche),
//              Z = Tiefe (+Z = Front). Z = 0 ist die Vorderseite des Frontrahmens.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, rbox, profileExtrudeX, extrudeZ, woodBoxUV, woodCylUV, mergeGeos } from '../model.js';
import { makeSlotFieldTexture, makePlateTexture } from '../textures.js';
import { GAUGE_DIALS, NEEDLES } from '../data.js';
import { makeCanvas } from '../noise.js';
import { registerDevice } from '../devices.js';
import { DeviceUI } from '../device-ui.js';
import { createBuilder, filletShape, plateZ, plateY, latheY, latheZ, sheetSweep, buildGauge, screwSet, logoFactory, tubeAlong, flipWinding, WOOD_V } from '../parts.js';

const ID = 'mini';
const S = (k) => `${ID}:${k}`;

const M = {
  halfW: 177.5, // Korpus außen (Frontrahmen 357)
  top: 376.1,
  bot: 234.5, // Unterkante Oberkorpus (waagerecht)
  rear: -323.5,
  rimIn: 159.5,
  rimRear: -305.8,
  lipBot: 352.9,
  headHalfW: 151.5,
  headBot: 248.6,
  headTop: 360.5,
  headFront: 128.9,
  baseHalfW: 145,
  baseBot: 25,
  baseTop: 93,
  baseRear: -289.8,
  dripHalfW: 159.8,
  dripFront: 160.4,
  dripBack: 2,
  dripBot: 19.2,
  groupZ: 65,
};
/** Unterkorpus: Seiten verjüngen sich nach unten, Rückwand lehnt nach hinten (CAD C.1.188 base) */
const hwL = (y) => 134 + 0.178 * (y - 94.8);
const zrL = (y) => -278.8 - 0.177 * (y - 94.8);

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
const PANEL_T = 6;

/** Lilie (Giglio) von La Marzocco als Maske für die Knopfkappen */
function makeGiglioMask() {
  const N = 256;
  const c = makeCanvas(N, N);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, N, N);
  g.fillStyle = '#fff';
  g.translate(N / 2, N / 2);
  g.scale(N / 100, N / 100);
  const petal = (sx) => {
    g.beginPath();
    g.moveTo(sx * 3, -2);
    g.bezierCurveTo(sx * 18, -8, sx * 30, -24, sx * 20, -34);
    g.bezierCurveTo(sx * 30, -20, sx * 26, 2, sx * 8, 6);
    g.closePath();
    g.fill();
  };
  // Mittelblatt
  g.beginPath();
  g.moveTo(0, -40);
  g.bezierCurveTo(9, -28, 9, -10, 4, 2);
  g.lineTo(-4, 2);
  g.bezierCurveTo(-9, -10, -9, -28, 0, -40);
  g.fill();
  petal(1);
  petal(-1);
  // Band und Fuß
  g.fillRect(-14, 3, 28, 6);
  g.beginPath();
  g.moveTo(-3, 9);
  g.lineTo(3, 9);
  g.bezierCurveTo(4, 22, 14, 28, 18, 34);
  g.bezierCurveTo(10, 32, 4, 28, 0, 22);
  g.bezierCurveTo(-4, 28, -10, 32, -18, 34);
  g.bezierCurveTo(-14, 28, -4, 22, -3, 9);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

function buildMini(mm) {
  const B = createBuilder('LineaMini', mm);
  const { root, F } = B;
  const mat = (k, extra) => mm.get(S(k), extra);
  const body = mat('body.main');
  const headMat = mat('body.head');
  const trayMat = mat('body.tray');
  const baseMat = mat('body.base');

  // =========================================================================
  // Sockel (C.1.190) mit Netzschalter links hinten (E.2.046)
  // =========================================================================
  B.stage('base');
  {
    const h = M.baseTop - M.baseBot;
    const d = M.dripBack - M.baseRear;
    B.add(boxProjectUV(rbox(M.baseHalfW * 2, h, d, 3.5, 3)), baseMat, S('body.base')).position.set(0, M.baseBot + h / 2, (M.dripBack + M.baseRear) / 2);
    const sx = -M.baseHalfW;
    B.plain(rbox(4, 25, 51, 1, 2), F.blackPlastic).position.set(sx - 2, 60, -248.8);
    const rocker = B.plain(rbox(3, 19, 43, 1.4, 2), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.3 }));
    rocker.position.set(sx - 3.6, 60, -248.8);
    rocker.rotation.y = -0.05;
    const o = B.plain(new THREE.TorusGeometry(2.3, 0.55, 8, 24), F.white);
    o.rotation.y = Math.PI / 2;
    o.position.set(sx - 5.3, 60, -258.8);
    const i = B.plain(new THREE.BoxGeometry(0.6, 1.1, 5.5), F.white);
    i.position.set(sx - 5.3, 60, -238.8);
    const plate = B.plain(new THREE.PlaneGeometry(64, 36), new THREE.MeshStandardMaterial({ map: makePlateTexture('LINEA MINI'), metalness: 0.6, roughness: 0.35 }));
    plate.rotation.y = Math.PI / 2;
    plate.position.set(M.baseHalfW + 0.3, 59, -150);
    B.plain(tubeAlong([[70, 40, M.baseRear], [70, 38, M.baseRear - 18], [72, 6, M.baseRear - 40], [78, 3, M.baseRear - 90]], 3.2, 40, 10), F.rubber).castShadow = false;
  }
  // Füße CL41: Gummi, unten Ø 35, 25 mm hoch
  B.stage('feet');
  {
    const feetMat = mat('metal.feet');
    const g = latheY([
      [0, 0.5],
      [17, 0.5],
      [17.5, 1.8],
      [15, 7],
      [11.5, 15],
      [10.5, 24],
      [11, 25],
      [0, 25],
    ], 44);
    const pad = new THREE.CylinderGeometry(16, 16, 1, 32);
    for (const [x, z] of [
      [-132, 72],
      [132, 72],
      [-132, -263.3],
      [132, -263.3],
    ]) {
      const foot = B.group();
      foot.position.set(x, 0, z);
      B.add(g, feetMat, S('metal.feet'), foot);
      B.plain(pad, F.rubber, foot).position.y = 0.5;
    }
  }

  // =========================================================================
  // Unterkorpus (Seiten + Rückwand, trapezförmig)
  // =========================================================================
  B.stage('lower');
  B.add(
    sheetSweep(
      [
        { hw: hwL(94.8), zr: zrL(94.8), y: 94.8 },
        { hw: hwL(236), zr: zrL(236), y: 236 },
      ],
      { zFront: -3, t: 1.2, r: 2.5 },
    ),
    body,
    S('body.main'),
  );
  // Spalt zwischen Frontrahmen und Sockel: Blick auf die hintere Tropfwanne (dunkel)
  B.plain(new THREE.BoxGeometry(262, 10, 28), F.trayInner).position.set(0, 98, -12);

  // =========================================================================
  // Frontrahmen (C.1.188): unten trapezförmig, seitlich Wangen bis zur Oberkante
  // =========================================================================
  B.stage('front');
  {
    const half = [
      [133.5, 103.1],
      [131.8, 93.5],
      [134.8, 93],
      [159.2, 231.2],
      [161.1, 232.5],
      [176.9, 232.5],
      [178.5, 234.1],
      [178.5, 375.6],
      [176.5, 377.6],
      [152.7, 377.6],
      [150.7, 375.6],
      [150.7, 351.6],
    ];
    const pts = [...half.map(([x, y]) => [x, y]), ...half.slice().reverse().map(([x, y]) => [-x, y])];
    const rad = [0, 0.6, 0.6, 2, 1, 1.2, 2, 2, 2, 2, 0, 0];
    const sh = filletShape(pts, [...rad, ...rad.slice().reverse()], 3);
    B.add(boxProjectUV(plateZ(sh, -2.9, 2.9, 0.45, 48)), body, S('body.main'));
  }

  // =========================================================================
  // Manometer (stehen 4,4 mm vor): links Dampf 0–3 bar, rechts Brühdruck 0–18 bar
  // =========================================================================
  B.stage('gauges');
  const gauges = [
    buildGauge(B, { slot: S('metal.gauges'), x: -112, y: 168, z: -4.1, R: 22.4, spec: { id: 'mini-steam', max: 3, step: 0.25, label: 0.5, value: 1.4, unit: 'bar', zone: [1, 1.5] } }),
    buildGauge(B, { slot: S('metal.gauges'), x: 112, y: 168, z: -4.1, R: 22.4, spec: { id: 'mini-brew', max: 18, step: 1, label: 3, value: 9, unit: 'bar', zone: [8, 10] } }),
  ];

  // =========================================================================
  // Oberkorpus (C.1.189): senkrechte Seiten und Rückwand, oberer Rand mit Vertiefung
  // =========================================================================
  B.stage('upper');
  {
    const rows = [
      { hw: 160.2, zr: M.rear + 17.2, y: M.bot, r: 1.5 },
      { hw: 176, zr: M.rear + 1.5, y: M.bot, r: 2 },
      { hw: 177.06, zr: M.rear + 0.44, y: M.bot + 0.44, r: 2.6 },
      { hw: M.halfW, zr: M.rear, y: M.bot + 1.5, r: 3 },
      { hw: M.halfW, zr: M.rear, y: M.top - 1.6 },
      { hw: 177.0, zr: M.rear + 0.5, y: M.top - 0.45, r: 2.6 },
      { hw: 175.9, zr: M.rear + 1.6, y: M.top, r: 2 },
      { hw: 161.1, zr: M.rimRear - 1.6, y: M.top, r: 2 },
      { hw: 159.95, zr: M.rimRear - 0.45, y: M.top - 0.45, r: 1.7 },
      { hw: M.rimIn, zr: M.rimRear, y: M.top - 1.6, r: 1.5 },
      { hw: M.rimIn, zr: M.rimRear, y: M.lipBot, r: 1.5 },
    ];
    B.add(sheetSweep(rows, { zFront: -3, t: 1.0, r: 3 }), body, S('body.main'));
    // Netzschalter-Klappe unter der linken Korpuskante (F.1.016)
    B.plain(rbox(7, 8, 45, 1, 2), F.blackPlastic).position.set(-168.8, M.bot - 3.5, -34.3);
  }

  // =========================================================================
  // Tassenablage (C.1.194): Mulde mit erhöhtem Rand, quadratische Löcher 11,5 mm im Kreis
  // =========================================================================
  B.stage('tray');
  {
    const W = 316;
    const D = 300.4;
    const z0 = -4.1;
    // Löcher als Felder je Lochreihe (nur Quadrate innerhalb von R = 112 um die Mitte)
    const fields = [];
    for (let j = 0; j < 14; j++) {
      const zc = -258.25 + 16 * j;
      for (let i = 0; i < 14; i++) {
        const xc = -104.55 + 16 * i;
        if (Math.hypot(xc, zc + 154.25) > 112) continue;
        fields.push({ x: xc - 5.75 + W / 2, y: z0 - (zc + 5.75), w: 11.5, h: 11.5, pitch: 100, slot: 11.5, r: 1, dir: 'rows' });
      }
    }
    const tex = makeSlotFieldTexture(W, D, fields, { brushed: 'x', pxPerMM: 4 });
    const cupMat = mat('metal.cup', { map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide });
    // Mulde: Boden bei 360,4, umlaufend auf 362,7 hochgezogen
    const g = new THREE.PlaneGeometry(W, D, 1, 1);
    g.rotateX(-Math.PI / 2);
    B.add(g, cupMat, S('metal.cup')).position.set(0, 360.4, z0 - D / 2);
    const rim = mat('metal.cup');
    for (const sx of [-1, 1]) {
      const r = boxProjectUV(rbox(17, 2.3, D, 0.6, 1));
      B.add(r, rim, S('metal.cup')).position.set(sx * 150.5, 361.6, z0 - D / 2);
    }
    for (const zz of [z0 - 7, z0 - D + 7]) B.add(boxProjectUV(rbox(W - 34, 2.3, 14, 0.6, 1)), rim, S('metal.cup')).position.set(0, 361.6, zz);
    const inner = B.plain(new THREE.BoxGeometry(W - 6, 1, D - 6), F.trayInner);
    inner.position.set(0, 350, z0 - D / 2);
    inner.receiveShadow = true;
  }

  // =========================================================================
  // Kopfteil (C.1.195 + Abdeckung C.1.193) mit zwei Kontrollleuchten
  // =========================================================================
  B.stage('head');
  {
    const h = M.headTop - M.headBot;
    const sh = filletShape([[-M.headHalfW, 0], [M.headHalfW, 0], [M.headHalfW, M.headFront], [-M.headHalfW, M.headFront]], [0, 0, 1.6, 1.6], 3);
    B.add(boxProjectUV(plateY(sh, M.headBot, h, 0.5)), headMat, S('body.head'));
    const top = plateY(filletShape([[-150.5, -3], [150.5, -3], [150.5, 128], [-150.5, 128]], [0, 0, 1.4, 1.4], 3), M.headTop, 3, 0.6);
    B.add(boxProjectUV(top), headMat, S('body.head'));
    const gap = B.plain(rbox(158, 58, 0.6, 4, 2), F.darkGap);
    gap.position.set(0, 305.1, M.headFront + 0.05);
    // Kontrollleuchten (rot: Heizung, blau: Bereit)
    for (const [y, c] of [
      [318.5, 0xd2261e],
      [293.6, 0x2f6fe0],
    ]) {
      B.plain(latheZ([[5, 0], [5, 2.2], [0, 2.2]], 24), F.chrome).position.set(-83.5, y, M.headFront);
      const led = B.plain(new THREE.SphereGeometry(3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.2 }));
      led.rotation.x = Math.PI / 2;
      led.position.set(-83.5, y, M.headFront + 2.2);
    }
    // Barista-Leuchten unter dem Kopfteil
    for (const x of [-64, 64]) {
      const lens = B.plain(new THREE.CylinderGeometry(4.5, 4.5, 2, 20), new THREE.MeshStandardMaterial({ color: 0xf4f1ea, emissive: 0x2a2620, roughness: 0.2 }));
      lens.position.set(x, M.headBot - 1, 91.8);
    }
  }

  // =========================================================================
  // Brühgruppe (A.3.005): Abdeckscheibe Ø 110 unter dem Kopfteil, Ring Ø 94
  // =========================================================================
  B.stage('group');
  const groupMat = mat('metal.group');
  {
    const g = latheY([
      [0, 229.7],
      [40, 229.7],
      [45, 230.4],
      [47, 231.5],
      [47, 239.6],
      [52, 240],
      [55, 241.5],
      [55, 248.8],
      [54, 250.2],
      [0, 250.2],
    ], 72);
    B.add(g, groupMat, S('metal.group')).position.set(0, 0, M.groupZ);
    const gasket = B.plain(new THREE.CylinderGeometry(35, 35, 1.5, 48), F.gasket);
    gasket.position.set(0, 229.4, M.groupZ);
  }

  // =========================================================================
  // Dampflanze rechts (T.2.126, Ø 10, Gummigriff), Heißwasser links mit Luftsprudler
  // =========================================================================
  B.stage('wand');
  const wandMat = mat('metal.wand');
  {
    const pts = [
      [99.1, 249, 72.2],
      [99.1, 242, 72.6],
      [99.1, 234, 80],
      [99.1, 226, 95],
      [99.1, 217, 112],
      [99.1, 209, 120.6],
      [99.1, 198, 122.6],
      [99.1, 160, 122.6],
      [99.1, 118, 122.6],
    ];
    B.add(tubeAlong(pts, 5, 120, 24), wandMat, S('metal.wand'));
    B.add(new THREE.CylinderGeometry(8, 8, 6, 6), wandMat, S('metal.wand')).position.set(99.1, M.headBot - 3, 72.2);
    const grip = latheY([[5.2, 163.8], [6, 165], [6, 197.5], [5.2, 198.8]], 24);
    const gm = B.plain(grip, F.rubber);
    gm.position.set(99.1, 0, 122.6);
    for (let k = 0; k < 4; k++) {
      const r = B.plain(new THREE.TorusGeometry(6, 0.7, 6, 24), F.rubber);
      r.rotation.x = Math.PI / 2;
      r.position.set(99.1, 169 + k * 8, 122.6);
    }
    const tip = latheY([[0, 99.8], [4.5, 99.8], [6, 101.5], [6.5, 108], [6.5, 117.5], [5.2, 118.8], [0, 118.8]], 32);
    B.add(tip, wandMat, S('metal.wand')).position.set(99.1, 0, 122.6);
  }
  {
    const hw = latheY([[0, 213.8], [10.5, 213.8], [11.8, 215.5], [11.8, 243], [10, 244.3], [8.5, 244.3], [8.5, 248.6], [0, 248.6]], 40);
    B.add(hw, wandMat, S('metal.wand')).position.set(-99.1, 0, 88.8);
    const mesh = B.plain(new THREE.CircleGeometry(9.5, 28), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(-99.1, 213.7, 88.8);
  }

  // =========================================================================
  // Siebträger (Katalog S. 38): Metallkopf mit Doppelauslauf, Griff wählbar
  // =========================================================================
  B.stage('portafilter');
  const pfMat = mat('metal.portafilter');
  const handleVariants = {};
  {
    const pf = B.group();
    pf.position.set(0, 32.2, M.groupZ);
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
  // Brühgruppenabdeckung (Paddle-Blende): La Marzocco = Pyramidenstumpf mit Lamellen,
  // rb.crafts = gewölbter Holzblock mit Schlitz
  // =========================================================================
  B.stage('frame');
  const frameMat = mat('wood.frame');
  const frameVariants = { lm: [], rb: [] };
  {
    // La Marzocco (CAD-Teil 107)
    const tabs = plateZ(filletShape([[-77, 288], [77, 288], [77, 322], [-77, 322]], 5, 4), M.headFront - 3, 9.3, 1.2);
    frameVariants.lm.push(B.add(woodBoxUV(tabs, 0, [0.4, 0.1]), frameMat, S('wood.frame')));
    const loops = [
      [[-59.5, 277.1], [59.5, 277.1], [59.5, 333.1], [-59.5, 333.1]],
      [[-49.6, 282.8], [49.6, 282.8], [49.6, 329.5], [-49.6, 329.5]],
      [[-16.9, 287.5], [16.9, 287.5], [16.9, 325.7], [-16.9, 325.7]],
    ];
    const zs = [M.headFront, 152.3, 163.9];
    const verts = [];
    loops.forEach((lp, k) => lp.forEach(([x, y]) => verts.push([x, y, zs[k]])));
    const pos = [];
    const tri = (a, b, c) => pos.push(...verts[a], ...verts[b], ...verts[c]);
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < 4; i++) {
        const a = k * 4 + i;
        const b = k * 4 + ((i + 1) % 4);
        tri(a, b, b + 4);
        tri(a, b + 4, a + 4);
      }
    }
    tri(8, 9, 10);
    tri(8, 10, 11);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.computeVertexNormals();
    frameVariants.lm.push(B.add(woodBoxUV(fg, 0, [0.62, 0.3]), frameMat, S('wood.frame')));
    // Lamellen (Fugen) auf den Schrägen
    for (const y of [296, 305.5, 315]) {
      const fin = B.plain(new THREE.BoxGeometry(98, 0.8, 22), F.darkGap);
      fin.position.set(0, y, 146);
      frameVariants.lm.push(fin);
    }
    // rb.crafts: flacher Rücken, gewölbte Front, waagerechter Schlitz für das Paddle
    const s = new THREE.Shape();
    s.moveTo(-80, 0);
    s.lineTo(80, 0);
    s.quadraticCurveTo(82, 14, 72, 30);
    s.quadraticCurveTo(0, 46, -72, 30);
    s.quadraticCurveTo(-82, 14, -80, 0);
    const g = extrudeZ(s, 38, 2.5, 2, 24);
    // Grundriss (x, z) aufrichten: Shape-y -> +z (Front gewölbt), Extrusion -> Höhe
    g.rotateX(Math.PI / 2);
    g.computeBoundingBox();
    g.translate(0, 286 - g.boundingBox.min.y, M.headFront - g.boundingBox.min.z);
    woodBoxUV(g, 0, [0.31, 0.62]);
    const rbFrame = B.add(g, frameMat, S('wood.frame'));
    rbFrame.visible = false;
    frameVariants.rb.push(rbFrame);
    const slot = B.plain(rbox(110, 4, 2, 1.2, 2), F.darkGap);
    slot.position.set(0, 307.5, M.headFront + 38.6);
    slot.visible = false;
    frameVariants.rb.push(slot);
  }
  B.stage('paddle');
  const paddleVariants = { lm: [], rb: [] };
  {
    const pm = mat('wood.paddle');
    // La Marzocco: Hebel (C.2.036), nach rechts gestellt
    const lever = profileExtrudeX(
      [
        [0, 292],
        [0, 339.5],
        [6, 341],
        [30, 336.5],
        [35, 332],
        [41, 297],
        [38, 292.5],
      ],
      17,
      1.6,
    );
    woodBoxUV(lever, 1, [0.71, 0.12]);
    // Achse laut CAD-Grundriss (y = 315): hinten (42 | 161) nach vorn (63,6 | 197,6)
    const lv = B.add(lever, pm, S('wood.paddle'));
    lv.position.set(34.7, 0, 165.3);
    lv.rotation.y = 0.533;
    paddleVariants.lm.push(lv);
    // rb.crafts: Winkel aus Holz (Platte oben, Front nach unten)
    const hook = profileExtrudeX(
      [
        [0, 314],
        [30, 318],
        [38, 311],
        [36, 278],
        [26, 276],
        [26, 302],
        [0, 301],
      ],
      38,
      1.6,
    );
    woodBoxUV(hook, 1, [0.71, 0.12]);
    const hk = B.add(hook, pm, S('wood.paddle'));
    hk.position.set(30, 0, M.headFront + 38);
    hk.visible = false;
    paddleVariants.rb.push(hk);
  }

  // =========================================================================
  // Drehknöpfe F.1.055 (Ø 45) mit Kappe F.1.053 und Lilie
  // =========================================================================
  B.stage('knobs');
  const knobMat = mat('wood.knobs');
  const capMat = mat('metal.caps');
  const knobVariants = { lobe: [], groove: [] };
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
    const lobes = ring(22.5, (a, R) => R - 2.6 * Math.pow(0.5 - 0.5 * Math.cos(a * 8), 1.6));
    // Knopf bis z = 183,4, vorn kräftig gerundet; die Kappe sitzt in der Rundung
    const lm = woodCylUV(extrudeZ(lobes, 42, 4.5, 4, 4), [0.13, 0.31]);
    // rb.crafts: hinten genuteter Zylinder, vorn gewellter Ring um die Kappe
    const grooves = ring(22.5, (a, R) => {
      const k = (((a / (Math.PI * 2)) * 8) % 1 + 1) % 1;
      const d = Math.abs(k - 0.5) / 0.14;
      return d < 1 ? R - 2.4 * Math.sqrt(1 - d * d) : R;
    }, 480);
    const rear = woodCylUV(extrudeZ(grooves, 28, 1.3, 2, 4), [0.13, 0.31]);
    const front = woodCylUV(extrudeZ(ring(21.5, (a, R) => R - 1.4 * (0.5 - 0.5 * Math.cos(a * 12))), 10, 1.6, 3, 4), [0.13, 0.31]);
    front.translate(0, 0, 30.6);
    const fuv = front.attributes.uv;
    for (let i = 0; i < fuv.count; i++) fuv.setY(i, fuv.getY(i) + 30.6 / WOOD_V);
    const rb = mergeGeos(rear, front);
    const giglio = new THREE.MeshStandardMaterial({ color: 0x8e8e8e, metalness: 0.6, roughness: 0.35, alphaMap: makeGiglioMask(), transparent: true, depthWrite: false });
    for (const x of [-121.1, 121.1]) {
      const y = 306.1;
      const a = B.add(lm, knobMat, S('wood.knobs'));
      a.position.set(x, y, 131.4);
      knobVariants.lobe.push(a);
      const b = B.add(rb, knobMat, S('wood.knobs'));
      b.position.set(x, y, 131.4);
      b.visible = false;
      knobVariants.groove.push(b);
      const capG = latheZ([[14.6, 0], [14.6, 6.2], [14.1, 7.6], [11, 8.6], [6, 9.3], [0, 9.6]], 64);
      B.add(capG, capMat, S('metal.caps')).position.set(x, y, 174.9);
      const decal = B.plain(new THREE.PlaneGeometry(19, 19), giglio);
      decal.position.set(x, y, 184.55);
      decal.castShadow = false;
    }
  }

  // =========================================================================
  // Tropfschale: Abdeckung (C.1.191), Lochblech (C.1.192) mit erhöhtem Rand
  // =========================================================================
  B.stage('drip');
  const grateMat0 = mat('metal.grates');
  {
    // Abdeckung: Oberkante unter dem Lochblech (der Rand des Blechs überdeckt sie)
    const h = 85 - M.dripBot;
    const d = M.dripFront - M.dripBack;
    B.add(boxProjectUV(rbox(M.dripHalfW * 2, h, d, 3.5, 3)), trayMat, S('body.tray')).position.set(0, M.dripBot + h / 2, (M.dripFront + M.dripBack) / 2);
    const W = 297;
    const D = 136.5;
    const fields = [];
    for (let j = 0; j < 8; j++) fields.push({ x: 7, y: 7 + j * 15, w: 285, h: 11.5, pitch: 15, slot: 11.5, r: 1, dir: 'cols' });
    const tex = makeSlotFieldTexture(W, D, fields, { brushed: false, pxPerMM: 4 });
    const gm = mat('metal.grates', { map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide });
    const g = new THREE.PlaneGeometry(W, D);
    g.rotateX(-Math.PI / 2);
    B.add(g, gm, S('metal.grates')).position.set(0, 88, 15.9 + D / 2);
    // Rand: schräg auf 90,8 hochgezogen, außen bis 81,8 heruntergekantet
    const outer = filletShape([[-161.8, 0.2], [161.8, 0.2], [161.8, 162.2], [-161.8, 162.2]], 3, 3);
    const hole = new THREE.Path();
    hole.moveTo(-148.6, 15.9);
    hole.lineTo(-148.6, 152.4);
    hole.lineTo(148.6, 152.4);
    hole.lineTo(148.6, 15.9);
    hole.closePath();
    outer.holes.push(hole);
    B.add(boxProjectUV(plateY(outer, 87.4, 3.4, 1.4)), grateMat0, S('metal.grates'));
    const skirt = filletShape([[-161.8, 0.2], [161.8, 0.2], [161.8, 162.2], [-161.8, 162.2]], 3, 3);
    const sh2 = new THREE.Path();
    sh2.moveTo(-161, 1);
    sh2.lineTo(-161, 161.4);
    sh2.lineTo(161, 161.4);
    sh2.lineTo(161, 1);
    sh2.closePath();
    skirt.holes.push(sh2);
    B.add(boxProjectUV(plateY(skirt, 81.8, 6, 0.3)), grateMat0, S('metal.grates'));
    const inner = B.plain(new THREE.BoxGeometry(294, 1, 134), F.trayInner);
    inner.position.set(0, 60, 84);
    inner.receiveShadow = true;
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
    for (const sx of [-1, 1]) {
      const g = profileExtrudeX([[-0.2, M.bot + 0.3], [-0.2, M.top], [M.rear - 0.5, M.top], [M.rear - 0.5, M.bot + 0.3]], T, 1.2);
      woodBoxUV(g, 2, [0.27, 0.08]);
      B.add(g, woodUpper, S('wood.upper'), panelUpper).position.x = sx > 0 ? M.halfW + 0.2 : -M.halfW - 0.2 - T;
    }
    {
      const w = (M.halfW + 0.2 + T) * 2;
      const hgt = M.top - M.bot - 0.3;
      const g = boxProjectUV(rbox(w, hgt, T, 1.2, 2));
      woodBoxUV(g, 0, [0.5, 0.2]);
      B.add(g, woodUpper, S('wood.upper'), panelUpper).position.set(0, M.bot + 0.3 + hgt / 2, M.rear - 0.6 - T / 2);
    }
    const lowerSide = (sx) => {
      const y0 = M.baseTop + 2;
      const y1 = M.bot - 0.6;
      const g = profileExtrudeX([[-2.6, y0], [-2.6, y1], [zrL(y1) - 0.6, y1], [zrL(y0) - 0.6, y0]], T, 1.2);
      woodBoxUV(g, 2, [0.61, 0.33]);
      const ang = Math.atan(0.178);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        pos.setXYZ(i, sx * (hwL(y) + 0.4 + x * Math.cos(ang)), y - x * Math.sin(ang), pos.getZ(i));
      }
      if (sx < 0) flipWinding(g);
      pos.needsUpdate = true;
      g.computeVertexNormals();
      return B.add(g, woodLower, S('wood.lower'), panelLower);
    };
    lowerSide(1);
    lowerSide(-1);
    {
      const y0 = M.baseTop + 2;
      const y1 = M.bot - 0.6;
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
      m.rotation.x = -Math.atan2(zrL(y0) - zrL(y1), y1 - y0);
      m.position.set(0, y0, zrL(y0) - 0.5);
    }
  }

  // =========================================================================
  // Cup Rail (rb.crafts)
  // =========================================================================
  B.stage('rail');
  const railMat = mat('metal.rail');
  const rail = B.group();
  {
    const y = M.top + 13;
    const zf = -12;
    const zr = M.rear + 9;
    const bar = (len, ax) => boxProjectUV(rbox(ax === 'x' ? len : 3, 10, ax === 'z' ? len : 3, 1.2, 2));
    for (const sx of [-1, 1]) {
      B.add(bar(zf - zr, 'z'), railMat, S('metal.rail'), rail).position.set(sx * 168.5, y, (zf + zr) / 2);
      for (const z of [zf - 6, zr + 6]) B.add(boxProjectUV(rbox(3, 14, 10, 1, 2)), railMat, S('metal.rail'), rail).position.set(sx * 168.5, M.top + 5, z);
    }
    B.add(bar(337 + 3, 'x'), railMat, S('metal.rail'), rail).position.set(0, y, zr);
  }

  // =========================================================================
  // Schrauben (I.1.042, Positionen laut CAD) und Schriftzüge (D.3.011)
  // =========================================================================
  B.stage('screws');
  {
    const screw = screwSet(B, S('metal.screws'));
    for (const sx of [-1, 1]) {
      screw(sx * 165, 362.5, 0);
      screw(sx * 165, 247.6, 0);
      screw(sx * 136.5, 217.5, 0);
      screw(sx * 119.2, 119.1, 0);
      screw(sx * 140, M.headTop + 3, 16.2, [0, 1, 0]);
      screw(sx * 140, M.headTop + 3, 109.5, [0, 1, 0]);
    }
  }
  B.stage('logo');
  const makeLogo = logoFactory(B, S('metal.logo'), 117, 13);
  makeLogo().position.set(86.2, 53.6, M.dripFront);
  const rearLogo = makeLogo(4);
  rearLogo.position.set(91, 305.3, M.rear - 0.2);
  rearLogo.rotation.y = Math.PI;

  // =========================================================================
  // Rohbau (nur in der Montage), vereinfacht nach den Explosionszeichnungen
  // =========================================================================
  {
    B.sk('sk-base');
    B.skBox(276, 70, 185, F.white, 0, 43, -96, 6);
    B.sk('sk-frame');
    {
      const sh = new THREE.Shape();
      sh.moveTo(-140, 100);
      sh.lineTo(140, 100);
      sh.lineTo(140, 340);
      sh.lineTo(-140, 340);
      sh.closePath();
      const hole = (cx, cy, r) => {
        const h = new THREE.Path();
        h.absarc(cx, cy, r, 0, Math.PI * 2, true);
        sh.holes.push(h);
      };
      hole(-112, 168, 24);
      hole(112, 168, 24);
      hole(0, 240, 34);
      B.skMesh(new THREE.ExtrudeGeometry(sh, { depth: 2, bevelEnabled: false, curveSegments: 24 }), F.frame).position.z = -16;
      for (const sx of [-1, 1]) B.skBox(4, 46, 270, F.frame, sx * 130, 118, -150);
    }
    B.sk('sk-tank');
    B.skBox(250, 70, 220, F.tank, 0, 312, -170, 8);
    B.sk('sk-pump');
    B.skCyl(36, 116, F.motor, -60, 140, -170, 'z');
    B.skCyl(22, 36, F.brass, -60, 140, -96, 'z');
    B.sk('sk-steam');
    B.skCyl(62, 160, F.steel, 62, 190, -180, 'y', 48);
    for (const y of [150, 230]) B.skCyl(63, 8, F.motor, 62, y, -180, 'y', 48);
    B.skCyl(14, 18, F.brass, 62, 279, -180);
    B.sk('sk-brew');
    B.skCyl(44, 90, F.steel, 0, 300, M.groupZ, 'y', 48);
    B.skBox(120, 30, 60, F.motor, 0, 270, 10, 3);
    B.sk('sk-valves');
    B.skBox(24, 28, 24, F.motor, 46, 220, -40, 2);
    B.skCyl(9, 24, F.brass, 99, 262, 72);
    B.skCyl(9, 24, F.brass, -99, 262, 88);
    B.sk('sk-pcb');
    B.skBox(160, 100, 2, F.pcb, 0, 170, -272, 1);
    B.skBox(50, 34, 28, F.frame, -40, 140, -258, 2);
    B.sk('sk-pipes');
    B.pipe([[-60, 175, -120], [-40, 220, -60], [0, 260, -10], [0, 270, 30]], 3.4, F.copper);
    B.pipe([[-60, 175, -120], [20, 130, -150], [50, 120, -170]], 3, F.copper);
    B.pipe([[62, 279, -180], [80, 290, -80], [99, 270, 30], [99, 262, 72]], 3.6, F.copper);
    B.pipe([[40, 270, -180], [-50, 290, -80], [-99, 270, 30], [-99, 262, 88]], 3, F.copper);
    B.pipe([[-112, 160, -30], [-80, 150, -90], [-60, 152, -140]], 1.3, F.copper, false);
    B.pipe([[112, 160, -30], [80, 170, -100], [62, 220, -150]], 1.3, F.copper, false);
    B.sk('sk-wires');
    B.pipe([[0, 210, -270], [-20, 260, -220], [-40, 300, -60], [0, 280, 20]], 2.4, F.motor, false);
    B.pipe([[-40, 125, -258], [-60, 105, -230], [-60, 115, -200]], 2.4, F.motor, false);
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
      panelUpper.visible = up;
      panelLower.visible = config.slots[S('wood.lower')]?.id !== 'none';
      rearLogo.visible = !up;
      rail.visible = o.rail === 'on';
      const kn = o.knobs === 'groove' ? 'groove' : 'lobe';
      for (const [k, list] of Object.entries(knobVariants)) list.forEach((m) => (m.visible = k === kn));
      const fr = o.frame === 'rb' ? 'rb' : 'lm';
      for (const [k, list] of Object.entries(frameVariants)) list.forEach((m) => (m.visible = k === fr));
      for (const [k, list] of Object.entries(paddleVariants)) list.forEach((m) => (m.visible = k === fr));
      handleVariants.round.visible = o.handle !== 'facet';
      handleVariants.facet.visible = o.handle === 'facet';
      for (const g of gauges) g.set({ dial: o.dial, needle: o.needle });
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
      { key: S('body.main'), label: 'Korpus & Frontrahmen' },
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
      { key: S('wood.frame'), label: 'Brühgruppenabdeckung' },
      { key: S('wood.handle'), label: 'Siebträgergriff' },
      { key: S('wood.upper'), label: 'Holzumrandung oben', panel: true },
      { key: S('wood.lower'), label: 'Seitenplatten unten', panel: true },
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
      { key: S('metal.grates'), label: 'Tropfblech' },
      { key: S('metal.screws'), label: 'Schrauben' },
      { key: S('metal.feet'), label: 'Füße' },
      { key: S('metal.rail'), label: 'Cup Rail', options: ['rail'] },
      { key: S('metal.logo'), label: 'Schriftzug', woodLogo: true },
    ],
  },
};
const SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));
const OPTIONS = [
  { key: 'knobs', label: 'Drehknöpfe', choices: [{ id: 'lobe', name: 'La Marzocco' }, { id: 'groove', name: 'rb.crafts (gerillt)' }] },
  { key: 'frame', label: 'Brühgruppenabdeckung & Paddle', choices: [{ id: 'lm', name: 'La Marzocco' }, { id: 'rb', name: 'rb.crafts' }] },
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
  [S('metal.rail')]: { id: 'steel', finish: 'satin' },
};
const DLC = { id: 'dlc', finish: 'matte' };
function preset(name, swatches, slots, opts = {}) {
  return {
    name,
    swatches,
    config: { slots: { ...NEUTRAL, ...slots }, opts: { knobs: 'groove', frame: 'rb', handle: 'facet', dial: 'white', needle: 'red', rail: 'off', ...opts } },
  };
}
const PRESETS = [
  // "All Black Linea Mini" (rb.crafts): ultramatt schwarz, DLC an Lanze, Gruppe, Siebträger und
  // Manometer, Walnuss an Bedienelementen und oberer Umrandung, schwarze Edelstahlfüße
  preset('All Black · Walnuss (rb.crafts)', ['#111113', '#644434', '#232427'], {
    ...all('body', 'RAL9005', 'matte'),
    ...all('metal', 'black', 'matte'),
    ...woods('walnut'),
    [S('wood.upper')]: { id: 'walnut', finish: 'oiled' },
    [S('metal.group')]: DLC,
    [S('metal.wand')]: DLC,
    [S('metal.portafilter')]: DLC,
    [S('metal.gauges')]: DLC,
    [S('metal.caps')]: { id: 'steel', finish: 'satin' },
    [S('metal.cup')]: { id: 'body', finish: 'matte' },
    [S('metal.logo')]: { id: 'wood:walnut', finish: 'oiled' },
  }, { dial: 'black', needle: 'red', rail: 'on' }),
  // Holz-Set Eiche (rb.crafts) auf der Edelstahl-Maschine
  preset('Edelstahl · Eiche (rb.crafts Holz-Set)', ['#cfd1d3', '#d99c52', '#111113'], {
    ...all('body', '4201E79975L30', 'gloss'),
    [S('body.base')]: { id: 'RAL9005', finish: 'matte' },
    ...all('metal', 'chrome', 'gloss'),
    ...woods('oak'),
    [S('metal.caps')]: { id: 'steel', finish: 'satin' },
    [S('metal.grates')]: { id: 'steel', finish: 'satin' },
    [S('metal.feet')]: { id: 'black', finish: 'matte' },
    [S('metal.logo')]: { id: 'red', finish: 'gloss' },
  }),
  // Holz-Set Walnuss mit La-Marzocco-Griff
  preset('Weiß · Walnuss (rb.crafts Holz-Set)', ['#efefea', '#644434', '#e4e6e9'], {
    ...all('body', 'RAL9016', 'gloss'),
    [S('body.base')]: { id: 'RAL9016', finish: 'gloss' },
    ...all('metal', 'chrome', 'gloss'),
    ...woods('walnut'),
    [S('metal.caps')]: { id: 'steel', finish: 'satin' },
    [S('metal.feet')]: { id: 'black', finish: 'matte' },
    [S('metal.logo')]: { id: 'wood:walnut', finish: 'oiled' },
  }, { handle: 'round' }),
  // Werksausführungen
  preset('Edelstahl (Werk)', ['#cfd1d3', '#111113', '#e4e6e9'], {
    ...all('body', '4201E79975L30', 'gloss'),
    [S('body.base')]: { id: 'RAL9005', finish: 'matte' },
    ...all('metal', 'chrome', 'gloss'),
    ...woods('black'),
    [S('metal.caps')]: { id: 'white', finish: 'gloss' },
    [S('metal.grates')]: { id: 'steel', finish: 'satin' },
    [S('metal.feet')]: { id: 'black', finish: 'matte' },
    [S('metal.screws')]: { id: 'steel', finish: 'satin' },
    [S('metal.logo')]: { id: 'red', finish: 'gloss' },
  }, { knobs: 'lobe', frame: 'lm', handle: 'round' }),
  preset('Schwarz (Werk)', ['#161616', '#111113', '#e4e6e9'], {
    ...all('body', 'RAL9005', 'gloss'),
    ...all('metal', 'chrome', 'gloss'),
    ...woods('black'),
    [S('metal.caps')]: { id: 'white', finish: 'gloss' },
    [S('metal.grates')]: { id: 'steel', finish: 'satin' },
    [S('metal.feet')]: { id: 'black', finish: 'matte' },
    [S('metal.screws')]: { id: 'steel', finish: 'satin' },
    [S('metal.logo')]: { id: 'red', finish: 'gloss' },
  }, { knobs: 'lobe', frame: 'lm', handle: 'round' }),
];

registerDevice({
  id: ID,
  kind: 'machine',
  brand: 'La Marzocco',
  name: 'Linea Mini',
  full: 'La Marzocco Linea Mini',
  file: 'Linea-Mini',
  code: 'LMN',
  dims: { w: 357, d: 453, h: 377 },
  rootZ: 0.07,
  shadow: { w: 0.6, d: 0.66, z: -0.065 },
  frame: { target: [0, 0.185, 0], scale: 1 },
  slots: SLOTS,
  categories: CATEGORIES,
  presets: PRESETS,
  options: OPTIONS,
  optionsTitle: 'Ausstattung',
  build: (mm) => buildMini(mm),
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
    'sk-tank': ['Wassertank 2,5 l', 'Tritan'],
    'sk-pump': ['Rotationspumpe', 'Motor & Messing'],
    'sk-steam': ['Dampfkessel 3,5 l', 'Edelstahl, isoliert'],
    'sk-brew': ['Brühkessel mit Gruppe', 'Edelstahl'],
    'sk-valves': ['Ventile', 'Messing'],
    'sk-pcb': ['Steuerung', 'Elektronik'],
    'sk-pipes': ['Leitungen', 'Kupfer'],
    'sk-wires': ['Kabelbaum', ''],
    base: ['Sockel', S('body.base')],
    feet: ['Füße', S('metal.feet')],
    lower: ['Unterkorpus', S('body.main')],
    front: ['Frontrahmen', S('body.main')],
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
