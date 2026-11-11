// ---------------------------------------------------------------------------
// Rocket Espresso Appartamento (Zweikreiser mit E61-Brühgruppe)
//
// Maße in Millimeter. Grundlage: Herstellerangaben (Rocket Domestic Brochure
// 2023: 274 × 425 × 360 mm inkl. Tassenreling; Appartamento TCA 270 × 448 ×
// 358 mm), die orthografischen Seitenansichten der aktuellen Farbreihe auf
// rocket-espresso.com (Maßstab über die Höhe 360 mm: 1,10 px/mm; Front- und
// Seitenansicht ergeben übereinstimmend 274 mm Breite) und der Ersatzteil-
// katalog "Appartamento" Ed. 10.2016 (Bodywork, Hydraulik, Ventile, Brühgruppe).
// Aus der Seitenansicht: Gehäuse 279 mm tief, Tropfschale 170 mm vor der
// Front, Lochraster 3 × 4 mit Ø 41 mm und 56 mm Teilung, E61-Glocke Ø 82 mm
// 93 mm vor der Front, Siebträgergriff bis 262 mm vor der Front.
//
// Koordinaten: X = Breite, Y = Höhe (0 = Stellfläche), Z = Tiefe (+Z = Front).
// Z = 0 ist die Vorderkante der Seitenteile (Frontblech).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, rbox, extrudeZ, woodBoxUV, woodCylUV } from '../model.js';
import { makeSlotFieldTexture } from '../textures.js';
import { GAUGE_DIALS, NEEDLES } from '../data.js';
import { makeCanvas } from '../noise.js';
import { registerDevice } from '../devices.js';
import { DeviceUI } from '../device-ui.js';
import { createBuilder, filletShape, circleHole, plateZ, plateY, latheY, latheZ, buildGauge, logoFactory, tubeAlong, WOOD_V } from '../parts.js';

const ID = 'rocket';
const S = (k) => `${ID}:${k}`;
const HW = 135; // halbe Gehäusebreite
const ZR = -279; // Rückwand
const HB = 18; // Unterkante Gehäuse
const HT = 335; // Oberkante Seitenteile
const RC = 20; // Eckenradius hinten
const GZ = 93; // Achse der Brühgruppe (vor der Front)
const DOTS_Z = [-191.4, -135.5, -79.5];
const DOTS_Y = [263.6, 208.2, 152.3, 97.7];
const DOT_R = 20.45;

const STAGES = [
  { id: 'sk-frame', src: 'skeleton', from: [0, 1, 0], dist: 400, gap: 0, dur: 0.7, drop: true },
  { id: 'sk-tank', src: 'skeleton', from: [0, 1, 0], dist: 600, gap: 0.4, dur: 0.7 },
  { id: 'sk-boiler', src: 'skeleton', from: [0, 1, 0], dist: 700, gap: 0.45, dur: 0.85, heavy: true },
  { id: 'sk-pump', src: 'skeleton', from: [-1, 0, 0], dist: 600, gap: 0.35, dur: 0.6 },
  { id: 'sk-pipes', src: 'skeleton', grow: true, gap: 0.3, dur: 0.7, stagger: 0.15 },
  { id: 'base', from: [0, -1, 0.3], dist: 600, gap: 0.45, after: true, dur: 0.8, heavy: true },
  { id: 'front', from: [0, 0, 1], dist: 700, gap: 0.4, dur: 0.75 },
  { id: 'group', from: [0, 0.4, 1], dist: 800, gap: 0.4, dur: 0.85, heavy: true },
  { id: 'valves', from: [0, 0, 1], dist: 600, gap: 0.35, dur: 0.6, stagger: 0.1 },
  { id: 'wands', from: [0, -1, 0.4], dist: 600, gap: 0.3, dur: 0.6, stagger: 0.12 },
  { id: 'gauge', from: [0, 0, 1], dist: 500, gap: 0.3, dur: 0.5 },
  { id: 'sides', from: [1, 0, 0], dist: 800, gap: 0.4, dur: 0.85, perSide: true },
  { id: 'inserts', from: [1, 0, 0], dist: 500, gap: 0.3, dur: 0.6, perSide: true },
  { id: 'top', from: [0, 1, 0], dist: 500, gap: 0.35, dur: 0.6 },
  { id: 'rail', from: [0, 1, 0], dist: 500, gap: 0.3, dur: 0.6 },
  { id: 'drip', from: [0, -0.2, 1], dist: 700, gap: 0.35, dur: 0.7 },
  { id: 'knobs', from: [0, 0, 1], dist: 400, gap: 0.3, dur: 0.5, stagger: 0.1, spin: [[0, 0, 1], Math.PI * 2] },
  { id: 'portafilter', from: [0, -0.3, 1], dist: 700, gap: 0.35, dur: 0.7 },
  { id: 'logo', pop: true, gap: 0.35, dur: 0.5 },
];
const isInner = (id) => id.startsWith('sk-');

/** Typenschild vorn: schwarzes Schild mit R-Logo, "ROCKET ESPRESSO MILANO" und "APPARTAMENTO" */
function makeBadge() {
  const c = makeCanvas(560, 184);
  const g = c.getContext('2d');
  g.fillStyle = '#0b0b0b';
  g.fillRect(0, 0, 560, 184);
  g.strokeStyle = '#d6d6d6';
  g.lineWidth = 4;
  g.strokeRect(10, 10, 540, 164);
  g.fillStyle = '#e8e8e8';
  g.beginPath();
  g.arc(78, 72, 40, 0, Math.PI * 2);
  g.lineWidth = 9;
  g.stroke();
  g.font = '800 54px "Arial Black", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('R', 78, 74);
  g.textAlign = 'left';
  g.font = '800 62px "Arial Black", Arial, sans-serif';
  g.fillText('ROCKET', 132, 62);
  g.font = '600 22px Arial, sans-serif';
  g.fillText('E S P R E S S O   M I L A N O', 136, 106);
  g.font = '500 34px Arial, sans-serif';
  g.fillText('APPARTAMENTO', 40, 150);
  for (const x of [28, 532]) {
    g.beginPath();
    g.arc(x, 92, 7, 0, Math.PI * 2);
    g.fillStyle = '#b8b8b8';
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
/** R-Logo auf der Knopfkappe (Alpha-Maske) */
function makeRMask() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineWidth = 16;
  g.beginPath();
  g.arc(128, 128, 104, 0, Math.PI * 2);
  g.stroke();
  g.font = '900 150px "Arial Black", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('R', 128, 136);
  return new THREE.CanvasTexture(c);
}
/** Symbole neben dem Schalter (Strom, Wasser) */
function makeIcons() {
  const c = makeCanvas(64, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(36, 10);
  g.lineTo(18, 46);
  g.lineTo(32, 46);
  g.lineTo(26, 78);
  g.lineTo(46, 36);
  g.lineTo(32, 36);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(32, 100);
  g.quadraticCurveTo(14, 128, 18, 140);
  g.arc(32, 140, 14, Math.PI, 0, true);
  g.quadraticCurveTo(50, 128, 32, 100);
  g.fill();
  g.font = '700 30px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('I', 32, 196);
  g.fillText('O', 32, 240);
  return new THREE.CanvasTexture(c);
}

/** Sternknopf (8 Rundungen) als Shape */
function starKnob(R0 = 22.5, amp = 2.8, lobes = 8, n = 128) {
  const sh = new THREE.Shape();
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const r = R0 + amp * Math.cos(lobes * a);
    if (k === 0) sh.moveTo(r * Math.cos(a), r * Math.sin(a));
    else sh.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  return sh;
}

function buildRocket(mm) {
  const B = createBuilder('Appartamento', mm);
  const { root, F } = B;
  const mat = (k, extra) => mm.get(S(k), extra);
  const bodyMat = mat('body.main');
  const groupMat = mat('metal.group');
  const trayMat = mat('metal.tray');

  // =========================================================================
  // Unterbau und Füße
  // =========================================================================
  B.stage('base');
  {
    B.plain(rbox(266, 4, 410, 1.5, 2), F.frame).position.set(0, 20, (ZR + 2 + 133) / 2);
    const foot = latheY([[0, 0], [30.5, 0], [32, 1.2], [32, 15.5], [30.5, 17], [26, 18], [0, 18]], 48);
    for (const [x, z] of [
      [-92, 94],
      [92, 94],
      [-92, -236],
      [92, -236],
    ]) B.add(foot, mat('metal.feet'), S('metal.feet')).position.set(x, 0, z);
  }

  // =========================================================================
  // Frontblech mit Typenschild, Schalter und Symbolen
  // =========================================================================
  B.stage('front');
  const frontMat = mat('metal.front');
  {
    const sh = filletShape([[-HW + 1.5, 104], [HW - 1.5, 104], [HW - 1.5, HT - 2], [-HW + 1.5, HT - 2]], 1, 2);
    B.add(boxProjectUV(plateZ(sh, -1.6, 1.6, 0.4)), frontMat, S('metal.front'));
    // dunkle Blende unter dem Frontblech (Tropfschalenschacht)
    B.plain(new THREE.BoxGeometry(2 * HW - 4, 82, 1), F.trayInner).position.set(0, 63, -60);
    const badge = B.plain(rbox(70, 23, 1.6, 0.6, 2), new THREE.MeshStandardMaterial({ map: makeBadge(), roughness: 0.35, metalness: 0.2 }));
    badge.position.set(-55, 136, 0.9);
    const ic = B.plain(new THREE.PlaneGeometry(6, 24), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, alphaMap: makeIcons(), transparent: true, roughness: 0.5 }));
    ic.position.set(-115, 156, 0.15);
    const sw = B.plain(rbox(7, 13, 6, 1.5, 2), F.blackPlastic);
    sw.position.set(-106, 132, 2.5);
    sw.rotation.x = 0.25;
    B.plain(rbox(10, 17, 1.2, 0.6, 2), F.chrome).position.set(-106, 132, 0.6);
  }

  // =========================================================================
  // E61-Brühgruppe: geneigtes Gehäuse, Glocke, Kappe und Hebel
  // =========================================================================
  B.stage('group');
  {
    // Glocke (Brühkopf)
    B.add(latheY([[0, 219.5], [37.5, 219.5], [40.2, 221.5], [41, 225], [41, 246.5], [39.5, 250.5], [35, 252.7], [0, 252.7]], 72), groupMat, S('metal.group')).position.z = GZ;
    // Gehäuse entlang der geneigten Achse (33° nach hinten), im Querschnitt oval (Seitenansicht schmal)
    const TILT = Math.atan2(48, 74);
    const LEN = Math.hypot(48, 74);
    const body = latheY([[0, 0], [33, 0], [34, 5], [33.5, 12], [32, 28], [30.5, 48], [29, 66], [27, 78], [22, 84], [15, 87.5], [0, LEN]], 64);
    body.scale(1, 1, 0.67);
    const b = B.add(body, groupMat, S('metal.group'));
    b.rotation.x = -TILT;
    b.position.set(0, 248, 66);
    // Kappe mit Sechskant und Hebel (zur rechten Seite)
    const ax = new THREE.Vector3(0, Math.cos(TILT), -Math.sin(TILT));
    const top = new THREE.Vector3(0, 248, 66).addScaledVector(ax, LEN - 4);
    const hex = B.add(new THREE.CylinderGeometry(12, 12, 9, 6), groupMat, S('metal.group'));
    hex.position.copy(top).addScaledVector(ax, 4);
    hex.rotation.x = -TILT;
    const cap = B.add(latheY([[0, 0], [8.5, 0], [8.5, 5], [6, 8], [0, 9]], 32), groupMat, S('metal.group'));
    cap.position.copy(top).addScaledVector(ax, 8.5);
    cap.rotation.x = -TILT;
    const piv = top.clone().add(new THREE.Vector3(16, -6, 4));
    B.add(new THREE.CylinderGeometry(7, 7, 8, 24).rotateZ(Math.PI / 2), groupMat, S('metal.group')).position.copy(piv);
    const end = piv.clone().add(new THREE.Vector3(38, 4, 8));
    B.add(tubeAlong([[piv.x + 3, piv.y, piv.z], [piv.x + 18, piv.y + 3, piv.z + 3], [end.x, end.y, end.z]], 3.6, 40, 16), groupMat, S('metal.group'));
    const ball = new THREE.SphereGeometry(10, 32, 24);
    ball.scale(1.15, 1, 1);
    B.add(woodCylUV(ball, [0.2, 0.4]), mat('wood.lever'), S('wood.lever')).position.copy(end);
    // Halter an der Front und Anschlussstück (Expansionsventil) rechts
    B.plain(rbox(60, 44, 20, 4, 2), F.chrome).position.set(0, 296, 8);
    B.add(tubeAlong([[30, 238, GZ - 6], [58, 238, GZ - 14], [78, 236, GZ - 24]], 6.2, 30, 20), groupMat, S('metal.group'));
    const nut = new THREE.CylinderGeometry(8.5, 8.5, 9, 6);
    nut.rotateZ(Math.PI / 2);
    B.plain(nut, F.brass).position.set(80, 236, GZ - 25);
  }

  // =========================================================================
  // Dampf- und Heißwasserventile mit Lanzen
  // =========================================================================
  B.stage('valves');
  for (const sx of [-1, 1]) {
    const x = sx * 90;
    const v = B.add(latheZ([[0, 0], [10, 0], [10, 8], [13.5, 9], [13.5, 18], [10, 19], [9.5, 56], [11.5, 57], [11.5, 60], [0, 60]], 32), groupMat, S('metal.group'));
    v.position.set(x, 302.7, 0);
    B.add(new THREE.SphereGeometry(8.5, 24, 16), groupMat, S('metal.group')).position.set(x, 291, 24);
  }
  B.stage('wands');
  {
    // links: Heißwasserlanze, senkrecht dicht an der Front
    B.add(tubeAlong([[-90, 289, 24], [-91, 262, 23], [-92, 238, 23], [-92, 226, 23]], 5, 40, 20), groupMat, S('metal.group'));
    const hw = B.add(
      latheY([[0, 0], [4, 0], [6, 4], [8.5, 11], [8.5, 33], [10.5, 36], [12, 41], [12, 105], [10, 109], [6, 114], [0, 114]], 32),
      groupMat,
      S('metal.group'),
    );
    hw.position.set(-92, 117, 23);
    const g1 = B.plain(rbox(8, 7, 26, 2.5, 2), F.blackPlastic);
    g1.position.set(-92, 200, 37);
    // rechts: Dampflanze, nach vorn gebogen
    const x0 = 90;
    const x1 = 96;
    const pts = [
      [x0, 289, 24],
      [x0 + 2, 255, 18],
      [x0 + 4, 222, 30],
      [x0 + 5, 203, 56],
      [x1, 185, 78],
      [x1, 160, 87],
      [x1, 106, 90],
    ];
    B.add(tubeAlong(pts, 4.6, 120, 20), groupMat, S('metal.group'));
    const nz = B.add(latheY([[0, 0], [3.2, 0], [4.8, 4], [4.8, 8], [0, 8]], 20), groupMat, S('metal.group'));
    nz.position.set(x1, 98, 90);
    const grip = B.plain(rbox(9, 7, 34, 2.5, 2), F.blackPlastic);
    grip.position.set(x1, 183, 78);
    grip.rotation.x = -0.25;
  }

  // =========================================================================
  // Manometer (Kesseldruck)
  // =========================================================================
  B.stage('gauge');
  const gauge = buildGauge(B, { slot: S('metal.gauge'), x: 65, y: 150, z: 0, R: 28, bezel: 3.6, spec: { id: 'rocket-boiler', max: 3, step: 0.25, label: 0.5, value: 1.2, unit: 'bar', zone: [1, 1.5] } });

  // =========================================================================
  // Gehäuse: Seitenteile mit Lochraster, Rückwand mit gerundeten Ecken, Einlagen
  // =========================================================================
  B.stage('sides');
  {
    const sh = new THREE.Shape();
    sh.moveTo(ZR + RC, HB);
    sh.lineTo(0, HB);
    sh.lineTo(0, HT);
    sh.lineTo(ZR + RC, HT);
    sh.closePath();
    for (const z of DOTS_Z) for (const y of DOTS_Y) sh.holes.push(circleHole(z, y, DOT_R));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelOffset: -0.35, bevelSegments: 2, curveSegments: 48 });
    g.rotateY(-Math.PI / 2);
    boxProjectUV(g);
    for (const x of [HW, -HW + 1.5]) B.add(g, bodyMat, S('body.main')).position.x = x;
    // hintere Ecken und Rückwand
    for (const sx of [-1, 1]) {
      const c = new THREE.Shape();
      const cx = sx * (HW - RC);
      const cz = ZR + RC;
      const a0 = sx > 0 ? -Math.PI / 2 : Math.PI;
      const a1 = sx > 0 ? 0 : Math.PI * 1.5;
      c.moveTo(cx + RC * Math.cos(a0), cz + RC * Math.sin(a0));
      c.absarc(cx, cz, RC, a0, a1, false);
      c.absarc(cx, cz, RC - 1.5, a1, a0, true);
      c.closePath();
      B.add(boxProjectUV(plateY(c, HB, HT - HB, 0, 24)), bodyMat, S('body.main'));
    }
    const rear = filletShape([[-HW + RC, ZR], [HW - RC, ZR], [HW - RC, ZR + 1.5], [-HW + RC, ZR + 1.5]], 0, 1);
    B.add(boxProjectUV(plateY(rear, HB, HT - HB, 0)), bodyMat, S('body.main'));
  }
  B.stage('inserts');
  const woodInserts = [];
  const metalInserts = [];
  {
    const w = 214;
    const h = 236;
    const zc = (DOTS_Z[0] + DOTS_Z[2]) / 2;
    const yc = (DOTS_Y[0] + DOTS_Y[3]) / 2;
    const gm = new THREE.BoxGeometry(1, h, w);
    const gw = woodBoxUV(new THREE.BoxGeometry(2.6, h, w), 1, [0.21, 0.33]);
    for (const sx of [1, -1]) {
      const m = B.add(gm, mat('metal.insert'), S('metal.insert'));
      m.position.set(sx * (HW - 4.6), yc, zc);
      metalInserts.push(m);
      const wd = B.add(gw, mat('wood.insert'), S('wood.insert'));
      wd.position.set(sx * (HW - 3.1), yc, zc);
      woodInserts.push(wd);
    }
  }

  // =========================================================================
  // Tassenablage (gelocht) und Tassenreling
  // =========================================================================
  B.stage('top');
  {
    const W = 2 * HW - 3;
    const D = -ZR - 3;
    const fields = [];
    for (let x = 14; x < W - 14; x += 7.5) fields.push({ x, y: D - 30, w: 4, h: 15, pitch: 7.5, slot: 4, r: 2, dir: 'rows' });
    for (const x0 of [8, W - 20]) for (let x = x0; x < x0 + 12; x += 7) fields.push({ x, y: 30, w: 4, h: D - 70, pitch: 7.5, slot: 4, r: 2, dir: 'rows' });
    const tex = makeSlotFieldTexture(W, D, fields, { brushed: 'y', pxPerMM: 4 });
    const g = new THREE.PlaneGeometry(W, D);
    g.rotateX(-Math.PI / 2);
    B.add(g, mat('metal.tray', { map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide }), S('metal.tray')).position.set(0, HT - 1.5, ZR / 2);
    B.plain(new THREE.BoxGeometry(W - 6, 1, D - 6), F.trayInner).position.set(0, HT - 9, ZR / 2);
  }
  B.stage('rail');
  {
    // Bügel als geschlossene Schleife: unten und oben je ein U, vorn mit Bögen verbunden
    const xr = HW - 4;
    const zf = -7;
    const zb = ZR + 9;
    const yl = 341;
    const yu = 356.8;
    const rr = 10;
    const pts = [];
    const uLoop = (y, dir) => {
      const seq = [];
      seq.push([-xr, y, zf]);
      seq.push([-xr, y, zb + rr]);
      for (let k = 1; k < 6; k++) {
        const a = Math.PI + (k / 6) * (Math.PI / 2);
        seq.push([-xr + rr + rr * Math.cos(a), y, zb + rr + rr * Math.sin(a)]);
      }
      seq.push([-xr + rr, y, zb]);
      seq.push([xr - rr, y, zb]);
      for (let k = 1; k < 6; k++) {
        const a = Math.PI * 1.5 + (k / 6) * (Math.PI / 2);
        seq.push([xr - rr + rr * Math.cos(a), y, zb + rr + rr * Math.sin(a)]);
      }
      seq.push([xr, y, zb + rr]);
      seq.push([xr, y, zf]);
      return dir > 0 ? seq : seq.reverse();
    };
    pts.push(...uLoop(yl, 1));
    const ym = (yl + yu) / 2;
    const rb = (yu - yl) / 2;
    for (let k = 1; k < 6; k++) {
      const a = -Math.PI / 2 + (k / 6) * Math.PI;
      pts.push([xr, ym + rb * Math.sin(a), zf + rb * Math.cos(a)]);
    }
    pts.push(...uLoop(yu, -1));
    for (let k = 1; k < 6; k++) {
      const a = Math.PI / 2 - (k / 6) * Math.PI;
      pts.push([-xr, ym + rb * Math.sin(a), zf + rb * Math.cos(a)]);
    }
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), true, 'centripetal');
    B.add(new THREE.TubeGeometry(curve, 400, 3.1, 14, true), mat('metal.rail'), S('metal.rail'));
    for (const x of [-xr, xr]) for (const z of [zf - 40, zb + 30]) B.add(new THREE.CylinderGeometry(2.4, 2.4, 8, 12), mat('metal.rail'), S('metal.rail')).position.set(x, HT + 3, z);
  }

  // =========================================================================
  // Tropfschale mit Gitter
  // =========================================================================
  B.stage('drip');
  {
    const z0 = -60;
    const z1 = 169.5;
    B.add(boxProjectUV(plateY(filletShape([[-HW + 1, z0], [HW - 1, z0], [HW - 1, z1], [-HW + 1, z1]], [0, 0, 3, 3], 3), 22, 77, 1)), trayMat, S('metal.tray'));
    const rim = filletShape([[-HW + 1, z0], [HW - 1, z0], [HW - 1, z1], [-HW + 1, z1]], [0, 0, 3, 3], 3);
    rim.holes.push(filletShape([[-HW + 6, z0 + 4], [HW - 6, z0 + 4], [HW - 6, z1 - 5], [-HW + 6, z1 - 5]], 1.5, 2));
    B.add(boxProjectUV(plateY(rim, 99, 6, 0.6)), trayMat, S('metal.tray'));
    const W = 2 * HW - 12;
    const D = z1 - z0 - 9;
    const fields = [];
    for (let x = 4; x < W - 6; x += 6.4) fields.push({ x, y: 4, w: 3.8, h: D - 8, pitch: 6.4, slot: 3.8, r: 0.9, dir: 'rows' });
    const tex = makeSlotFieldTexture(W, D, fields, { brushed: 'x', pxPerMM: 4 });
    const g = new THREE.PlaneGeometry(W, D);
    g.rotateX(-Math.PI / 2);
    B.add(g, mat('metal.tray', { map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide }), S('metal.tray')).position.set(0, 102.5, z0 + 4 + D / 2);
    B.plain(new THREE.BoxGeometry(W - 2, 1, D - 2), F.trayInner).position.set(0, 96, z0 + 4 + D / 2);
  }

  // =========================================================================
  // Drehknöpfe (Sternknöpfe, links mit R-Kappe)
  // =========================================================================
  B.stage('knobs');
  {
    const kg = woodCylUV(extrudeZ(starKnob(), 24, 2.4, 3, 4), [0.17, 0.27]);
    const rMask = makeRMask();
    for (const sx of [-1, 1]) {
      const x = sx * 90;
      const k = B.add(kg, mat('wood.knobs'), S('wood.knobs'));
      k.position.set(x, 302.7, 61);
      k.rotation.z = 0.2;
      const cap = B.add(latheZ([[0, 0], [15.5, 0], [15.5, 1.2], [14.6, 2.1], [0, 2.4]], 40), groupMat, S('metal.group'));
      cap.position.set(x, 302.7, 85);
      if (sx < 0) {
        const r = B.plain(new THREE.CircleGeometry(13.5, 40), new THREE.MeshStandardMaterial({ color: 0x111111, alphaMap: rMask, transparent: true, roughness: 0.4 }));
        r.position.set(x, 302.7, 87.5);
        r.castShadow = false;
      }
    }
  }

  // =========================================================================
  // Siebträger
  // =========================================================================
  B.stage('portafilter');
  {
    B.add(latheY([[0, 201.5], [30, 201.5], [34.5, 205], [36.5, 211], [37, 216.5], [39, 217.5], [39, 219.5], [0, 219.5]], 64), groupMat, S('metal.group')).position.z = GZ;
    B.add(latheY([[0, 190], [8, 190], [10, 196], [14, 201.5], [0, 201.5]], 24), groupMat, S('metal.group')).position.z = GZ;
    for (const sx of [-1, 1]) {
      const s = B.add(latheY([[0, 0], [3.6, 0], [4.4, 6], [4.4, 10], [0, 10]], 16), groupMat, S('metal.group'));
      s.position.set(sx * 8, 184, GZ);
      s.rotation.z = sx * 0.35;
    }
    const pf = new THREE.Group();
    pf.position.set(0, 208, GZ + 34);
    pf.rotation.y = -0.14;
    root.add(pf);
    B.add(latheZ([[0, 0], [7.5, 0], [7.5, 12], [6.5, 14], [6.5, 22], [0, 22]], 24), groupMat, S('metal.group'), pf);
    const hp = [[0, 22], [9.2, 22], [10, 26], [10.6, 60], [12.4, 100], [13.6, 122], [13.9, 128], [13, 132], [10, 135], [5, 136.2], [0, 136.5]];
    B.add(woodCylUV(latheZ(hp, 40), [0.3, 0.12]), mat('wood.handle'), S('wood.handle'), pf);
  }

  // =========================================================================
  // Schriftzug hinten: ROCKET senkrecht
  // =========================================================================
  B.stage('logo');
  {
    const letters = 'ROCKET';
    for (let i = 0; i < letters.length; i++) {
      const mk = logoFactory(B, S('metal.logo'), 30, 22, letters[i]);
      const l = mk(3);
      l.rotation.y = Math.PI;
      l.position.set(0, 290 - i * 33, ZR - 0.05);
    }
  }

  // =========================================================================
  // Innenleben (Ersatzteilkatalog): Rahmen, Wassertank 2,5 l, Kessel 1,8 l mit
  // Wärmetauscher, Vibrationspumpe, Thermosiphon und Leitungen
  // =========================================================================
  {
    B.sk('sk-frame');
    B.skBox(4, 300, 270, F.frame, -HW + 8, 170, -140, 1);
    B.skBox(4, 300, 270, F.frame, HW - 8, 170, -140, 1);
    B.skBox(250, 4, 270, F.frame, 0, 26, -140, 1);
    B.sk('sk-tank');
    B.skBox(200, 230, 62, F.tank, 0, 175, -240, 6);
    B.sk('sk-boiler');
    B.skCyl(56, 210, F.copper, 0, 215, -120, 'x', 48);
    B.skCyl(60, 6, F.brass, -105, 215, -120, 'x', 48);
    B.skCyl(60, 6, F.brass, 105, 215, -120, 'x', 48);
    B.sk('sk-pump');
    B.skCyl(21, 105, F.motor, -55, 70, -150, 'z', 32);
    B.skBox(70, 40, 2, F.pcb, 70, 80, -200, 1);
    B.sk('sk-pipes');
    B.pipe([[0, 255, -70], [0, 300, -40], [0, 310, -10], [0, 305, 8]], 4.5, F.copper);
    B.pipe([[0, 185, -70], [0, 230, -30], [0, 262, -2], [0, 262, 10]], 4.5, F.copper);
    B.pipe([[-55, 70, -95], [-40, 120, -60], [-20, 160, -40], [-10, 185, -70]], 3, F.copper);
    B.pipe([[-60, 250, -110], [-80, 285, -40], [-90, 300, -6]], 3.5, F.copper);
    B.pipe([[60, 250, -110], [80, 285, -40], [90, 300, -6]], 3.5, F.copper);
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
      const wood = config.slots[S('wood.insert')]?.id !== 'none';
      for (const m of woodInserts) m.visible = wood;
      for (const m of metalInserts) m.visible = !wood;
      gauge.set({ dial: o.dial || 'black', needle: o.needle || 'red' });
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
    slots: [{ key: S('body.main'), label: 'Seitenteile & Rückwand' }],
  },
  [S('wood')]: {
    title: 'Holz',
    allLabel: 'Alle',
    slots: [
      { key: S('wood.knobs'), label: 'Drehknöpfe' },
      { key: S('wood.handle'), label: 'Siebträgergriff' },
      { key: S('wood.lever'), label: 'Hebelkugel' },
      { key: S('wood.insert'), label: 'Holzeinlagen hinter dem Lochraster', panel: true },
    ],
  },
  [S('metal')]: {
    title: 'Akzente',
    allLabel: 'Alle',
    slots: [
      { key: S('metal.insert'), label: 'Einlagen hinter dem Lochraster' },
      { key: S('metal.front'), label: 'Frontblech' },
      { key: S('metal.group'), label: 'Brühgruppe, Ventile & Lanzen' },
      { key: S('metal.tray'), label: 'Tassenablage & Tropfschale' },
      { key: S('metal.rail'), label: 'Tassenreling' },
      { key: S('metal.gauge'), label: 'Manometer-Ring', options: ['dial', 'needle'] },
      { key: S('metal.feet'), label: 'Füße' },
      { key: S('metal.logo'), label: 'Schriftzug hinten', woodLogo: true },
    ],
  },
};
const SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));
const OPTIONS = [
  { key: 'dial', label: 'Manometer', choices: GAUGE_DIALS },
  { key: 'needle', label: 'Zeiger', choices: NEEDLES },
];
const STEEL = { id: '4201E79975L30', finish: 'satin' };
const BLACK = { id: 'RAL9005', finish: 'matte' };
const WHITE = { id: 'RAL9016', finish: 'satin' };
const m = (id, finish = 'gloss') => ({ id, finish });
function preset(name, swatches, body, insert, wood, accents = {}, opts = {}) {
  const w = (id) => ({ id, finish: 'oiled' });
  return {
    name,
    swatches,
    config: {
      slots: {
        [S('body.main')]: body,
        [S('metal.insert')]: insert,
        [S('wood.knobs')]: w(wood.knobs || 'black'),
        [S('wood.handle')]: w(wood.handle || 'black'),
        [S('wood.lever')]: w(wood.lever || 'black'),
        [S('wood.insert')]: w(wood.insert || 'none'),
        [S('metal.front')]: m('chrome'),
        [S('metal.group')]: m('chrome'),
        [S('metal.tray')]: m('steel', 'satin'),
        [S('metal.rail')]: m('steel', 'satin'),
        [S('metal.gauge')]: m('chrome'),
        [S('metal.feet')]: m('chrome'),
        [S('metal.logo')]: m('steel', 'satin'),
        ...accents,
      },
      opts: { dial: 'black', needle: 'red', ...opts },
    },
  };
}
const PRESETS = [
  preset('Schwarz · Walnuss (rb.crafts)', ['#141414', '#644434', '#e4e6e9'], BLACK, m('black', 'matte'), { knobs: 'walnut', handle: 'walnut', lever: 'walnut', insert: 'walnut' }, {
    [S('metal.rail')]: m('black', 'matte'),
    [S('metal.logo')]: m('wood:walnut', 'oiled'),
  }),
  preset('Weiß · Eiche (rb.crafts)', ['#efefea', '#d99c52', '#e4e6e9'], WHITE, m('white', 'matte'), { knobs: 'oak', handle: 'oak', lever: 'oak', insert: 'oak' }, {
    [S('metal.rail')]: m('white', 'matte'),
    [S('metal.logo')]: m('wood:oak', 'oiled'),
  }),
  preset('Edelstahl · Weiß (Werk)', ['#c6c2c3', '#f2f2ee', '#111111'], STEEL, m('white', 'gloss'), {}),
  preset('Edelstahl · Kupfer (Werk)', ['#c6c2c3', '#c27a4e', '#111111'], STEEL, m('copper', 'satin'), {}),
  preset('Schwarz · Kupfer (Werk)', ['#141414', '#c27a4e', '#e4e6e9'], BLACK, m('copper', 'satin'), {}, { [S('metal.rail')]: m('black', 'matte') }),
];

registerDevice({
  id: ID,
  kind: 'machine',
  brand: 'Rocket Espresso',
  name: 'Appartamento',
  full: 'Rocket Appartamento',
  file: 'Rocket-Appartamento',
  code: 'RAP',
  dims: { w: 274, d: 425, h: 360 },
  rootZ: 0.055,
  shadow: { w: 0.42, d: 0.6, z: -0.06 },
  frame: { target: [0, 0.175, 0], scale: 0.9 },
  slots: SLOTS,
  categories: CATEGORIES,
  presets: PRESETS,
  options: OPTIONS,
  optionsTitle: 'Ausstattung',
  build: (mm) => buildRocket(mm),
  UI: DeviceUI,
  roles: {
    body: [S('body.main')],
    accent: [S('metal.group'), S('metal.front'), S('metal.rail')],
    wood: [S('wood.knobs'), S('wood.handle'), S('wood.lever')],
    screws: [],
    logo: [S('metal.logo')],
  },
  stageLabels: {
    'sk-frame': ['Rahmen', ''],
    'sk-tank': ['Wassertank 2,5 l', ''],
    'sk-boiler': ['Kessel 1,8 l mit Wärmetauscher', 'Kupfer'],
    'sk-pump': ['Vibrationspumpe & Steuerung', ''],
    'sk-pipes': ['Thermosiphon & Leitungen', 'Kupfer'],
    base: ['Unterbau & Füße', S('metal.feet')],
    front: ['Frontblech', S('metal.front')],
    group: ['E61-Brühgruppe', S('metal.group')],
    valves: ['Ventile', S('metal.group')],
    wands: ['Dampf- und Heißwasserlanze', S('metal.group')],
    gauge: ['Manometer', S('metal.gauge')],
    sides: ['Seitenteile & Rückwand', S('body.main')],
    inserts: ['Einlagen', S('metal.insert')],
    top: ['Tassenablage', S('metal.tray')],
    rail: ['Tassenreling', S('metal.rail')],
    drip: ['Tropfschale', S('metal.tray')],
    knobs: ['Drehknöpfe', S('wood.knobs')],
    portafilter: ['Siebträger', S('wood.handle')],
    logo: ['Schriftzug', S('metal.logo')],
  },
});
