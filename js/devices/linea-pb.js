// ---------------------------------------------------------------------------
// La Marzocco Linea PB und Linea PB X (2, 3 oder 4 Gruppen, Ausführung AV)
//
// Maße in Millimeter, vermessen an den offiziellen Werkszeichnungen "LINEA PB"
// (A3, Maßstab 1:10: 2 Gruppen 710 × 590 × 533 mm; 950 / 1190 mm mit 3 / 4
// Gruppen) und an Schnitten durch die 3D-CAD-Modelle von La Marzocco (nur als
// Messreferenz; Teilenummern wie im Ersatzteilkatalog V3.8, z. B. C.1.153
// Frontblende, C.1.161 Reling, C.1.164 Tassenablage, C.1.157 Tropfblech,
// C.3.007 Beine, F.1.034 Dampfknopf). Die PB X hat dasselbe Gehäuse; außen
// unterscheiden sich Manometer und Schriftzug (Katalog S. 66–80 "X Version").
//
// Koordinaten: X = Breite, Y = Höhe (0 = Stellfläche), Z = Tiefe (+Z = Front).
// Z = 0 liegt knapp vor dem Spritzschutz hinter den Gruppen.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, rbox, profileExtrudeX, woodCylUV, extrudeZ } from '../model.js';
import { makeSlotFieldTexture, makePlateTexture } from '../textures.js';
import { GAUGE_DIALS, NEEDLES } from '../data.js';
import { makeCanvas } from '../noise.js';
import { registerDevice } from '../devices.js';
import { DeviceUI } from '../device-ui.js';
import { createBuilder, filletShape, plateZ, plateY, latheY, latheZ, sheetSweep, buildGauge, screwSet, logoFactory, tubeAlong, WOOD_V } from '../parts.js';

const WIDTH = { 2: 710, 3: 950, 4: 1190 };
const groupXs = (n) => ({ 2: [-120, 120], 3: [-240, 0, 240], 4: [-360, -120, 120, 360] })[n];
const GZ = 76.8; // Gruppenachse

const STAGES = [
  { id: 'sk-base', src: 'skeleton', from: [0, 1, 0], dist: 450, gap: 0, dur: 0.75, drop: true },
  { id: 'sk-boiler', src: 'skeleton', from: [0, 1, 0], dist: 1000, gap: 0.5, dur: 1.0, heavy: true },
  { id: 'sk-pump', src: 'skeleton', from: [1, 0.1, 0], dist: 900, gap: 0.4, dur: 0.85, spin: [[1, 0, 0], Math.PI * 2] },
  { id: 'sk-groups', src: 'skeleton', from: [0, 1, 0.4], dist: 900, gap: 0.45, dur: 0.8, stagger: 0.15 },
  { id: 'sk-pcb', src: 'skeleton', from: [0, 0, -1], dist: 800, gap: 0.3, dur: 0.6 },
  { id: 'sk-pipes', src: 'skeleton', grow: true, gap: 0.4, dur: 0.65, stagger: 0.2 },
  { id: 'legs', from: [0, -1, 0], dist: 600, gap: 0.45, after: true, dur: 0.8, heavy: true },
  { id: 'base', from: [0, -1, 0.3], dist: 700, gap: 0.4, dur: 0.85, heavy: true },
  { id: 'lower', from: [0, 0.2, -1], dist: 900, gap: 0.4, dur: 0.9 },
  { id: 'splash', from: [0, 0, 1], dist: 800, gap: 0.35, dur: 0.7 },
  { id: 'upper', from: [0, 1, -0.2], dist: 1000, gap: 0.4, dur: 1.0, heavy: true },
  { id: 'front', from: [0, 0.2, 1], dist: 900, gap: 0.4, dur: 0.85 },
  { id: 'gauges', from: [0, 0, 1], dist: 700, gap: 0.35, dur: 0.6, spin: [[0, 0, 1], Math.PI * 2] },
  { id: 'keys', pop: true, gap: 0.3, dur: 0.3, stagger: 0.04 },
  { id: 'groups', from: [0, -1, 0.4], dist: 800, gap: 0.4, dur: 0.75, stagger: 0.15, spin: [[0, 1, 0], Math.PI] },
  { id: 'wands', from: [0, 1, 0.4], dist: 900, gap: 0.35, dur: 0.8, stagger: 0.15 },
  { id: 'knobs', from: [0, 0, 1], dist: 800, gap: 0.3, dur: 0.7, spin: [[0, 0, 1], Math.PI * 2] },
  { id: 'portafilter', from: [-0.1, -0.3, 1], dist: 900, gap: 0.35, dur: 0.85, stagger: 0.15, spin: [[0, 1, 0], -0.9] },
  { id: 'drip', from: [0, -0.25, 1], dist: 900, gap: 0.4, dur: 0.8 },
  { id: 'tray', from: [0, 1, 0], dist: 600, gap: 0.45, dur: 0.6 },
  { id: 'guards', from: [0, 1, 0], dist: 700, gap: 0.35, dur: 0.75 },
  { id: 'trim', pop: true, gap: 0.35, dur: 0.35 },
  { id: 'logo', pop: true, gap: 0.4, dur: 0.5 },
];
const isInner = (id) => id.startsWith('sk-');

/** Display (LCD) der Frontblende */
function makeLCD() {
  const c = makeCanvas(256, 80);
  const g = c.getContext('2d');
  g.fillStyle = '#0a0b0e';
  g.fillRect(0, 0, 256, 80);
  g.fillStyle = '#e8eefc';
  g.font = '600 22px "Courier New", monospace';
  g.textAlign = 'center';
  g.fillText('93.5° 120°C', 128, 34);
  g.fillText('LINEA PB', 128, 62);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Symbole unter den Tasten (eine/zwei Tassen, Dauerbezug) */
function makeKeyIcons() {
  const c = makeCanvas(256, 64);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.strokeStyle = '#fff';
  g.lineWidth = 4;
  const cup = (x, w) => {
    g.beginPath();
    g.moveTo(x - w, 20);
    g.lineTo(x - w * 0.7, 44);
    g.lineTo(x + w * 0.7, 44);
    g.lineTo(x + w, 20);
    g.stroke();
  };
  cup(42, 12);
  cup(118, 9);
  cup(138, 9);
  g.beginPath();
  for (let a = 0; a < Math.PI * 5; a += 0.2) g.lineTo(214 + Math.cos(a) * a * 1.3, 32 + Math.sin(a) * a * 1.3);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  return t;
}

function makeBuilder(ID, version) {
  const S = (k) => `${ID}:${k}`;
  return function buildPB(mm) {
    const B = createBuilder(version === 'x' ? 'LineaPBX' : 'LineaPB', mm);
    const { root, F } = B;
    const mat = (k, extra) => mm.get(S(k), extra);
    const body = mat('body.main');
    const lowerMat = mat('body.lower');
    const variants = {};
    const lcdTex = makeLCD();
    const iconTex = makeKeyIcons();
    const iconMat = new THREE.MeshBasicMaterial({ color: 0x8a8d92, alphaMap: iconTex, transparent: true, depthWrite: false });
    const gaugeList = [];

    for (const n of [2, 3, 4]) {
      const before = root.children.length;
      const skBefore = B.skeleton.children.length;
      const W = WIDTH[n];
      const H = W / 2;
      const gx = groupXs(n);

      // ---------------- Beine (C.3.007): Bügel mit Bogen, je Seite einer ----------------
      B.stage('legs');
      {
        const prof = [
          [-332.5, 4],
          [-317, 103.6],
          [139.6, 103.6],
          [155.2, 4],
          [105, 4],
          [104, 17],
          [69, 80],
          [-247, 80],
          [-282, 17],
          [-283, 4],
        ];
        for (const sx of [-1, 1]) {
          const g = profileExtrudeX(prof, 45, 2.5);
          B.add(boxProjectUV(g), mat('metal.legs'), S('metal.legs')).position.x = sx * (H - 80.5) - 22.5;
          for (const z of [-308, 130]) B.plain(new THREE.CylinderGeometry(19, 19, 4, 24), F.rubber).position.set(sx * (H - 80.5), 2, z);
        }
      }
      // ---------------- Sockel (C.1.141 / C.1.145) ----------------
      B.stage('base');
      B.add(boxProjectUV(rbox(2 * (H - 43), 103, 342, 3, 3)), body, S('body.main')).position.set(0, 105 + 51.5, -171);
      {
        const plate = B.plain(new THREE.PlaneGeometry(70, 40), new THREE.MeshStandardMaterial({ map: makePlateTexture(version === 'x' ? 'LINEA PB X' : 'LINEA PB'), metalness: 0.6, roughness: 0.35 }));
        plate.rotation.y = Math.PI / 2;
        plate.position.set(H - 42.8, 160, -200);
      }
      // ---------------- Unterteil (schwarze Seiten, schräge Rückwand) ----------------
      B.stage('lower');
      B.add(
        sheetSweep(
          [
            { hw: H - 55, zr: -342, y: 208 },
            { hw: H - 24, zr: -380, y: 374.5 },
          ],
          { zFront: 13, t: 1.5, r: 4 },
        ),
        lowerMat,
        S('body.lower'),
      );
      // ---------------- Spritzschutz hinter den Gruppen (C.1.156) ----------------
      B.stage('splash');
      {
        const g = boxProjectUV(rbox(2 * (H - 29), 176, 2, 1, 2));
        B.add(g, mat('metal.splash'), S('metal.splash')).position.set(0, 198 + 88, 13.3);
        // Netzschalter links, Heißwasser rechts (L120/L121)
        B.plain(rbox(34, 34, 6, 3, 2), F.blackPlastic).position.set(-(H - 118), 319.5, 16);
        B.plain(rbox(14, 22, 4, 2, 2), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.3 })).position.set(-(H - 118), 319.5, 20);
        const hw = latheZ([[34, -3.6], [34, 8], [31, 13], [22, 14.9], [0, 14.9]], 48);
        B.add(hw, mat('metal.wands'), S('metal.wands')).position.set(H - 118, 319.5, 0);
        const spout = latheY([[0, 268], [6, 268], [7.5, 272], [7.5, 300], [0, 300]], 24);
        B.add(spout, mat('metal.wands'), S('metal.wands')).position.set(H - 118, 0, 26);
        B.add(new THREE.CylinderGeometry(5, 5, 20, 16).rotateX(Math.PI / 2), mat('metal.wands'), S('metal.wands')).position.set(H - 118, 300, 20);
      }
      // ---------------- Oberkorpus: Kasten, Seitenteile, Unterseite über den Gruppen ----------------
      B.stage('upper');
      {
        // Kasten bis unter die Tassenablage, darüber vorn die Deckplatte (C.1.142) und hinten die Kante
        B.add(boxProjectUV(rbox(2 * (H - 23), 96, 531.8, 2, 2)), body, S('body.main')).position.set(0, 374 + 48, -383 + 265.9);
        B.add(boxProjectUV(rbox(2 * (H - 23), 15, 139.8, 1.5, 2)), body, S('body.main')).position.set(0, 477.5, 9 + 69.9);
        B.add(boxProjectUV(rbox(2 * (H - 23), 16.5, 29, 1.5, 2)), body, S('body.main')).position.set(0, 478.2, -368.5);
        for (const sx of [-1, 1]) {
          const g = boxProjectUV(rbox(22, 111.8, 486, 3, 3));
          B.add(g, body, S('body.main')).position.set(sx * (H - 11), 374.7 + 55.9, -359 + 243);
        }
        // Mulde der Tassenablage (dunkel)
        B.plain(new THREE.BoxGeometry(2 * (H - 30), 1, 362), F.trayInner).position.set(0, 471, -172.5);
      }
      // ---------------- Frontblende (C.1.153) ----------------
      B.stage('front');
      B.add(boxProjectUV(rbox(2 * (H - 26), 109, 22, 2, 2)), mat('body.front'), S('body.front')).position.set(0, 375.3 + 54.5, 137.8);
      // ---------------- Manometer und Display ----------------
      B.stage('gauges');
      {
        const cx = n % 2 ? 120 : 0;
        const gg = buildGauge(B, { slot: S('metal.gauges'), x: cx, y: 410.3, z: 147.4, R: 32.5, bezel: 5, spec: { id: 'pb-pump', max: 16, step: 1, label: 4, value: 9, unit: 'bar', zone: [8, 10] } });
        gaugeList.push(gg);
        const lcd = B.plain(rbox(107, 40, 4, 3, 2), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.4 }));
        lcd.position.set(cx, 461, 150.2);
        const scr = B.plain(new THREE.PlaneGeometry(64, 20), new THREE.MeshBasicMaterial({ map: lcdTex, toneMapped: false }));
        scr.position.set(cx, 463, 152.3);
      }
      // ---------------- Tastenfelder über jeder Gruppe ----------------
      B.stage('keys');
      {
        const keyMat = mat('metal.keys');
        const kg = latheZ([[10.5, 0], [10.5, 3], [9.6, 4.6], [0, 5]], 32);
        for (const x of gx) {
          for (const dx of [-35, 0, 35]) B.add(kg, keyMat, S('metal.keys')).position.set(x + dx, 455, 148.8);
          const ic = B.plain(new THREE.PlaneGeometry(100, 25), iconMat);
          ic.position.set(x, 426, 149.1);
        }
      }
      // ---------------- Gruppen (L111) ----------------
      B.stage('groups');
      const groupMat = mat('metal.group');
      for (const x of gx) {
        const g = latheY([
          [0, 311],
          [33, 311],
          [38, 313],
          [40, 316],
          [40, 334],
          [36, 336],
          [36, 362],
          [40, 366],
          [40, 375],
          [0, 375],
        ], 64);
        B.add(g, groupMat, S('metal.group')).position.set(x, 0, GZ);
        for (const sx of [-1, 1]) B.add(boxProjectUV(rbox(12, 10, 22, 3, 2)), groupMat, S('metal.group')).position.set(x + sx * 44, 325, GZ);
        const gasket = B.plain(new THREE.CylinderGeometry(33, 33, 1.5, 40), F.gasket);
        gasket.position.set(x, 310.5, GZ);
      }
      // ---------------- Dampflanzen (T.2.001) und Dampfknöpfe (F.1.034) ----------------
      B.stage('wands');
      const wandMat = mat('metal.wands');
      for (const sx of [-1, 1]) {
        const x = sx * (H - 70);
        const pts = [
          [x, 376, 105.6],
          [x, 352, 106],
          [x, 340, 124.8],
          [x, 328, 152],
          [x, 320, 166.8],
          [x, 300, 173.1],
          [x, 260, 177.2],
          [x, 226.5, 180.6],
        ];
        B.add(tubeAlong(pts, 5, 100, 20), wandMat, S('metal.wands'));
        // Gummigriff unter dem Gelenk
        for (let k = 0; k < 5; k++) {
          const r = B.plain(new THREE.TorusGeometry(6.4, 1.5, 8, 24), F.rubber);
          r.rotation.x = Math.PI / 2;
          r.position.set(x, 300 - k * 7, 173.5 + k * 0.7);
        }
        B.add(latheY([[0, 214], [4.6, 214], [6, 216], [6.3, 226], [5.2, 230], [0, 230]], 24), wandMat, S('metal.wands')).position.set(x, 0, 180.8);
        B.add(new THREE.SphereGeometry(9, 20, 14), wandMat, S('metal.wands')).position.set(x, 372, 105.6);
      }
      B.stage('knobs');
      {
        // achtkantiger Knopf, vorn verjüngt
        const oct = new THREE.Shape();
        for (let i = 0; i <= 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
          const r = 28.7;
          if (i === 0) oct.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else oct.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        const kg = woodCylUV(extrudeZ(oct, 40, 5, 3, 1), [0.13, 0.31]);
        for (const sx of [-1, 1]) {
          const x = sx * (H - 70);
          B.add(kg, mat('wood.knobs'), S('wood.knobs')).position.set(x, 434.3, 151);
          B.add(latheZ([[11, 0], [11, 3], [9, 4], [0, 4.4]], 32), mat('metal.caps'), S('metal.caps')).position.set(x, 434.3, 199.6);
        }
      }
      // ---------------- Siebträger, Griffe leicht zur Mitte gedreht ----------------
      B.stage('portafilter');
      {
        const pfMat = mat('metal.portafilter');
        const handleMat = mat('wood.handle');
        const hprof = [[0, 0], [13.6, 0], [14.4, 2], [13.2, 10], [12.8, 18], [13.6, 32], [14, 50], [15.6, 66], [16.4, 76], [16.2, 90], [15.2, 106], [14.5, 116], [13.2, 124], [11.6, 130], [8.4, 134], [4, 135.8], [0, 136]];
        const hg = new THREE.LatheGeometry(hprof.map(([r, y]) => new THREE.Vector2(r, y)), 40);
        const uv = hg.attributes.uv;
        const hp = hg.attributes.position;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.37, hp.getY(i) / WOOD_V + 0.66);
        hg.rotateX(Math.PI / 2);
        for (const x of gx) {
          const pf = B.group();
          pf.position.set(x, 113.5, GZ);
          B.add(latheY([[0, 175.5], [26, 175.5], [31, 178], [32.4, 182], [32.4, 193], [33.4, 194], [33.4, 197], [27, 197]], 48), pfMat, S('metal.portafilter'), pf);
          for (const sx of [-1, 1]) B.add(rbox(9, 6, 17, 2, 2), pfMat, S('metal.portafilter'), pf).position.set(sx * 36.5, 193.5, 0);
          B.add(latheY([[0, 165], [9, 165], [10, 168], [13, 176], [0, 176]], 24), pfMat, S('metal.portafilter'), pf).position.z = 14;
          for (const sx of [-1, 1]) {
            const sp = B.add(new THREE.CylinderGeometry(3, 3.6, 13, 16), pfMat, S('metal.portafilter'), pf);
            sp.position.set(sx * 9, 160, 14);
            sp.rotation.z = sx * 0.55;
          }
          const handle = B.group(pf);
          handle.position.set(0, 190.6, 0);
          handle.rotation.set(0.32, -0.42, 0, 'YXZ');
          B.add(latheZ([[0, 26], [9.5, 26], [9.5, 34], [8.6, 50], [9.6, 58], [0, 58]], 24), pfMat, S('metal.portafilter'), handle);
          B.add(hg, handleMat, S('wood.handle'), handle).position.z = 57;
        }
      }
      // ---------------- Tropfschale (C.1.151) mit Lochblech (C.1.157) ----------------
      B.stage('drip');
      {
        // Schale: Boden und Wände (innen dunkel, damit das Lochblech nicht hell durchscheint)
        B.add(boxProjectUV(rbox(2 * (H - 42), 52, 182, 3, 3)), body, S('body.main')).position.set(0, 105 + 26, 91);
        const walls = filletShape([[-(H - 42), 0], [H - 42, 0], [H - 42, 182], [-(H - 42), 182]], 3, 3);
        walls.holes.push(filletShape([[-(H - 46), 4], [H - 46, 4], [H - 46, 178], [-(H - 46), 178]], 1.5, 2));
        B.add(boxProjectUV(plateY(walls, 154, 39, 0.8)), body, S('body.main'));
        const GW = 2 * (H - 57);
        const GD = 160.2;
        const fields = [];
        // Muster je Einheit: sechs Längsschlitze, zwei Felder Querschlitze (Ablauf)
        const unit = 57 + 34.5 + 34.5;
        const count = Math.floor((GW - 12) / unit);
        const x0 = (GW - count * unit) / 2;
        for (let u = 0; u < count; u++) {
          const ux = x0 + u * unit;
          for (const r of [0, 1, 2, 3]) fields.push({ x: ux, y: 10.6 + r * 36.5, w: 52.5, h: 29.9, pitch: 9.5, slot: 4.5, dir: 'cols' });
          fields.push({ x: ux + 57, y: 12.6, w: 30, h: 138, pitch: 9.5, slot: 4.5, dir: 'rows' });
          fields.push({ x: ux + 91.5, y: 12.6, w: 30, h: 138, pitch: 9.5, slot: 4.5, dir: 'rows' });
        }
        const tex = makeSlotFieldTexture(GW, GD, fields, { brushed: 'x', pxPerMM: 3 });
        const gm = mat('metal.grates', { map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide });
        const g = new THREE.PlaneGeometry(GW, GD);
        g.rotateX(-Math.PI / 2);
        B.add(g, gm, S('metal.grates')).position.set(0, 194.1, 9.1 + GD / 2);
        const rim = filletShape([[-(H - 42), 4], [H - 42, 4], [H - 42, 184.4], [-(H - 42), 184.4]], 3, 3);
        const hole = new THREE.Path();
        hole.moveTo(-GW / 2, 9.1);
        hole.lineTo(-GW / 2, 9.1 + GD);
        hole.lineTo(GW / 2, 9.1 + GD);
        hole.lineTo(GW / 2, 9.1);
        hole.closePath();
        rim.holes.push(hole);
        B.add(boxProjectUV(plateY(rim, 192, 4, 1)), mat('metal.grates'), S('metal.grates'));
        B.plain(new THREE.BoxGeometry(2 * (H - 47), 1, 172), F.trayInner).position.set(0, 158, 91);
      }
      // ---------------- Tassenablage (C.1.164): Lochbleche mit runden Löchern ----------------
      B.stage('tray');
      {
        const TW = 2 * (H - 31);
        const TD = 363;
        const fields = [];
        for (let r = 0; r < 21; r++) fields.push({ x: 22 + (r % 2) * 7.5, y: 22 + r * 15.2, w: TW - 52, h: 9, pitch: 15, slot: 9, dir: 'cols' });
        const tex = makeSlotFieldTexture(TW, TD, fields, { brushed: 'x', pxPerMM: 3 });
        const cm = mat('metal.cup', { map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide });
        const g = new THREE.PlaneGeometry(TW, TD);
        g.rotateX(-Math.PI / 2);
        B.add(g, cm, S('metal.cup')).position.set(0, 481.3, 9 - TD / 2);
        // Mittelfuge zwischen den Blechen
        B.plain(new THREE.BoxGeometry(1.4, 0.6, TD), F.darkGap).position.set(0, 481.6, 9 - TD / 2);
      }
      // ---------------- Reling (C.1.161): Seitenbleche mit Langloch, hohe Rückwand ----------------
      B.stage('guards');
      {
        const gMat = mat('metal.guards');
        const side = filletShape([[-378, 494.5], [146.6, 494.5], [146.6, 495], [127, 511.8], [-378, 511.8]], [1, 1, 1, 14, 1], 4);
        const slot = new THREE.Path();
        slot.moveTo(-309, 501.8);
        slot.lineTo(49, 501.8);
        slot.lineTo(49, 506.9);
        slot.lineTo(-309, 506.9);
        slot.closePath();
        side.holes.push(slot);
        for (const sx of [-1, 1]) {
          const g = plateZ(side, 0, 3.1, 0.6, 12);
          g.rotateY(-Math.PI / 2);
          // Shape-x -> Welt-z, Dicke -> -x; rechts nach außen verschoben
          B.add(boxProjectUV(g), gMat, S('metal.guards')).position.x = sx > 0 ? H - 6.9 + 3.1 : -(H - 9.9);
        }
        const rear = new THREE.Shape();
        rear.moveTo(-(H - 7), 0);
        rear.lineTo(H - 7, 0);
        rear.lineTo(H - 7, 49);
        rear.lineTo(-(H - 7), 49);
        rear.closePath();
        for (const sx of [-1, 1]) {
          const p = new THREE.Path();
          p.moveTo(sx * 30, 26);
          p.lineTo(sx * (H - 60), 26);
          p.lineTo(sx * (H - 60), 31);
          p.lineTo(sx * 30, 31);
          p.closePath();
          if (sx > 0) p.curves.reverse();
          rear.holes.push(p);
        }
        const rg = plateZ(rear, 0, 3, 0.6, 8);
        const rm = B.add(boxProjectUV(rg), gMat, S('metal.guards'));
        rm.position.set(0, 488.3, -378.5);
        rm.rotation.x = -0.17;
      }
      // ---------------- schwarze Kantenleisten vorn am Oberkorpus ----------------
      B.stage('trim');
      for (const sx of [-1, 1]) {
        B.add(boxProjectUV(rbox(25, 112, 24, 2, 2)), mat('metal.trim'), S('metal.trim')).position.set(sx * (H - 12.5), 430.5, 137.8);
      }
      // ---------------- Schriftzug auf der Tropfschale ----------------
      B.stage('logo');
      {
        const makeLogo = logoFactory(B, S('metal.logo'), 150, 16);
        makeLogo().position.set(0, 140, 182);
      }

      // ---------------- Innenleben (vereinfacht nach Katalog) ----------------
      B.sk('sk-base');
      B.skBox(2 * (H - 50), 6, 330, F.frame, 0, 210, -170, 2);
      B.sk('sk-boiler');
      B.skCyl(95, 2 * H - 170, F.copper, 0, 290, -200, 'x', 48);
      B.sk('sk-pump');
      B.skCyl(40, 130, F.motor, -(H - 120), 260, -120, 'z');
      B.sk('sk-groups');
      for (const x of gx) B.skCyl(48, 100, F.steel, x, 330, -30, 'z', 40);
      B.sk('sk-pcb');
      B.skBox(180, 100, 2, F.pcb, 0, 300, -370, 1);
      B.sk('sk-pipes');
      for (const x of gx) B.pipe([[x * 0.6, 290, -150], [x, 330, -80]], 3.4, F.copper);
      B.pipe([[-(H - 120), 260, -55], [-(H - 160), 280, -120], [-(H - 200), 290, -170]], 3, F.copper);

      variants[n] = { parts: root.children.slice(before), sk: B.skeleton.children.slice(skBefore) };
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
        const n = +o.groups || 2;
        for (const [k, v] of Object.entries(variants)) {
          const on = +k === n;
          for (const p of v.parts) p.visible = on;
          for (const p of v.sk) p.visible = on;
        }
        for (const g of gaugeList) g.set({ dial: o.dial, needle: o.needle });
        // Maße für Aufstellung, Kamera und Schatten
        const d = DEVICE_DEFS[ID];
        d.dims.w = WIDTH[n];
        d.shadow.w = (WIDTH[n] + 260) / 1000;
        d.frame.scale = 1.45 + (n - 2) * 0.28;
      },
    };
  };
}

const DEVICE_DEFS = {};

function define(ID, version) {
  const S = (k) => `${ID}:${k}`;
  const CATEGORIES = {
    [S('body')]: {
      title: 'Gehäuse',
      allLabel: 'Komplett',
      slots: [
        { key: S('body.main'), label: 'Korpus, Sockel & Tropfschale' },
        { key: S('body.front'), label: 'Frontblende' },
        { key: S('body.lower'), label: 'Seitenteile unten' },
      ],
    },
    [S('wood')]: {
      title: 'Holz',
      allLabel: 'Alle',
      slots: [
        { key: S('wood.handle'), label: 'Siebträgergriffe' },
        { key: S('wood.knobs'), label: 'Dampfknöpfe' },
      ],
    },
    [S('metal')]: {
      title: 'Metallakzente',
      allLabel: 'Alle',
      slots: [
        { key: S('metal.group'), label: 'Brühgruppen' },
        { key: S('metal.portafilter'), label: 'Siebträger' },
        { key: S('metal.wands'), label: 'Dampflanzen & Heißwasser' },
        { key: S('metal.caps'), label: 'Knopfkappen' },
        { key: S('metal.gauges'), label: 'Manometer-Ring', options: ['dial', 'needle'] },
        { key: S('metal.keys'), label: 'Tasten' },
        { key: S('metal.splash'), label: 'Spritzschutz' },
        { key: S('metal.cup'), label: 'Tassenablage' },
        { key: S('metal.guards'), label: 'Reling' },
        { key: S('metal.grates'), label: 'Tropfblech' },
        { key: S('metal.trim'), label: 'Kantenleisten' },
        { key: S('metal.legs'), label: 'Beine' },
        { key: S('metal.logo'), label: 'Schriftzug', woodLogo: true },
      ],
    },
  };
  const SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));
  const OPTIONS = [
    { key: 'groups', label: 'Gruppen', choices: [{ id: '2', name: '2 Gruppen' }, { id: '3', name: '3 Gruppen' }, { id: '4', name: '4 Gruppen' }], layout: true },
    { key: 'dial', label: 'Manometer', choices: GAUGE_DIALS },
    { key: 'needle', label: 'Zeiger', choices: NEEDLES },
  ];
  const all = (cat, id, finish) => Object.fromEntries(CATEGORIES[S(cat)].slots.map((s) => [s.key, { id, finish }]));
  const factoryDial = version === 'x' ? 'white' : 'red';
  const factoryNeedle = version === 'x' ? 'black' : 'white';
  const factoryLogo = version === 'x' ? { id: 'steel', finish: 'satin' } : { id: 'red', finish: 'gloss' };
  const steel = (slots) => ({
    ...all('body', '4201E79975L30', 'gloss'),
    [S('body.lower')]: { id: 'RAL9005', finish: 'matte' },
    ...all('metal', 'chrome', 'gloss'),
    [S('metal.splash')]: { id: 'steel', finish: 'gloss' },
    [S('metal.cup')]: { id: 'steel', finish: 'satin' },
    [S('metal.guards')]: { id: 'steel', finish: 'satin' },
    [S('metal.grates')]: { id: 'steel', finish: 'satin' },
    [S('metal.keys')]: { id: 'steel', finish: 'satin' },
    [S('metal.trim')]: { id: 'black', finish: 'matte' },
    [S('metal.legs')]: { id: 'black', finish: 'matte' },
    [S('metal.logo')]: factoryLogo,
    [S('wood.handle')]: { id: 'black', finish: 'oiled' },
    [S('wood.knobs')]: { id: 'black', finish: 'oiled' },
    ...slots,
  });
  const preset = (name, swatches, slots, opts = {}) => ({ name, swatches, config: { slots, opts: { groups: '2', dial: factoryDial, needle: factoryNeedle, ...opts } } });
  const PRESETS = [
    preset(version === 'x' ? 'Edelstahl (Werk, PB X)' : 'Edelstahl (Werk)', ['#cfd1d3', '#111113', version === 'x' ? '#f1eee6' : '#c1261d'], steel({})),
    preset('Schwarz · Walnuss', ['#141414', '#644434', '#cfd1d3'], steel({
      ...all('body', 'RAL9005', 'matte'),
      [S('wood.handle')]: { id: 'walnut', finish: 'oiled' },
      [S('wood.knobs')]: { id: 'walnut', finish: 'oiled' },
      [S('metal.logo')]: { id: 'wood:walnut', finish: 'oiled' },
      [S('metal.group')]: { id: 'dlc', finish: 'matte' },
      [S('metal.portafilter')]: { id: 'dlc', finish: 'matte' },
    }), { dial: 'black', needle: 'red' }),
    preset('Weiß · Eiche', ['#efefea', '#d99c52', '#cfd1d3'], steel({
      ...all('body', 'RAL9016', 'gloss'),
      [S('wood.handle')]: { id: 'oak', finish: 'oiled' },
      [S('wood.knobs')]: { id: 'oak', finish: 'oiled' },
      [S('metal.logo')]: { id: 'wood:oak', finish: 'oiled' },
    }), { dial: 'white', needle: 'black' }),
    preset('Kieferngrün · Gold · Olive', ['#2d5546', '#e1b866', '#dd9540'], steel({
      ...all('body', 'RAL6028', 'matte'),
      ...Object.fromEntries(['group', 'portafilter', 'wands', 'caps', 'gauges', 'keys', 'logo'].map((k) => [S(`metal.${k}`), { id: 'gold', finish: 'gloss' }])),
      [S('wood.handle')]: { id: 'olive', finish: 'oiled' },
      [S('wood.knobs')]: { id: 'olive', finish: 'oiled' },
    }), { dial: 'cream', needle: 'gold' }),
    preset('Edelstahl · 3 Gruppen', ['#cfd1d3', '#111113', '#cfd1d3'], steel({}), { groups: '3' }),
  ];
  const name = version === 'x' ? 'Linea PB X' : 'Linea PB';
  const def = {
    id: ID,
    kind: 'machine',
    brand: 'La Marzocco',
    name,
    full: `La Marzocco ${name}`,
    file: name.replace(/ /g, '-'),
    code: version === 'x' ? 'LPX' : 'LPB',
    dims: { w: 710, d: 590, h: 537 },
    rootZ: 0.1,
    shadow: { w: 0.97, d: 0.72, z: -0.1 },
    frame: { target: [0, 0.27, 0], scale: 1.45 },
    slots: SLOTS,
    categories: CATEGORIES,
    presets: PRESETS,
    options: OPTIONS,
    optionsTitle: 'Ausstattung',
    build: makeBuilder(ID, version),
    UI: DeviceUI,
    roles: {
      body: [S('body.main'), S('body.front')],
      accent: [S('metal.group'), S('metal.portafilter'), S('metal.wands'), S('metal.caps'), S('metal.gauges'), S('metal.keys'), S('metal.legs'), S('metal.guards')],
      wood: [S('wood.handle'), S('wood.knobs')],
      screws: [],
      logo: [S('metal.logo')],
    },
    stageLabels: {
      'sk-base': ['Rahmen', 'Edelstahl'],
      'sk-boiler': ['Dampfkessel', 'Kupfer'],
      'sk-pump': ['Rotationspumpe', 'Motor'],
      'sk-groups': ['Brühkessel je Gruppe', 'Edelstahl'],
      'sk-pcb': ['Steuerung', 'Elektronik'],
      'sk-pipes': ['Leitungen', 'Kupfer'],
      legs: ['Beine', S('metal.legs')],
      base: ['Sockel', S('body.main')],
      lower: ['Seitenteile unten', S('body.lower')],
      splash: ['Spritzschutz', S('metal.splash')],
      upper: ['Oberkorpus', S('body.main')],
      front: ['Frontblende', S('body.front')],
      gauges: ['Manometer & Display', S('metal.gauges')],
      keys: ['Tasten', S('metal.keys')],
      groups: ['Brühgruppen', S('metal.group')],
      wands: ['Dampflanzen & Heißwasser', S('metal.wands')],
      knobs: ['Dampfknöpfe', [S('wood.knobs'), S('metal.caps')]],
      portafilter: ['Siebträger', [S('metal.portafilter'), S('wood.handle')]],
      drip: ['Tropfschale', [S('body.main'), S('metal.grates')]],
      tray: ['Tassenablage', S('metal.cup')],
      guards: ['Reling', S('metal.guards')],
      trim: ['Kantenleisten', S('metal.trim')],
      logo: ['Schriftzug', S('metal.logo')],
    },
  };
  DEVICE_DEFS[ID] = def;
  registerDevice(def);
}

define('pb', 'pb');
define('pbx', 'x');
