// ---------------------------------------------------------------------------
// Meraki Espresso Machine (Gen 2): Dualboiler mit Rotationspumpe, eingebauter
// Kegelmühle (TIMEMORE) und zwei Waagen
//
// Maße in Millimeter. Grundlage: Herstellerangaben (merakitech.com: 412 mm hoch,
// 370 mm breit, 370 mm tief), die orthografische Front- und Seitenansicht im
// Produkthandbuch MEM03 ("Specifications & Model Details", bei 600 dpi
// 2,541 px/mm; Breite 370 und Höhe 413 mm passen zu den Herstellerangaben),
// die Explosions- und Dreiviertelansichten ("Features Overview") sowie die
// Werksbilder in Schwarz und Weiß.
// Aus den Zeichnungen: Sockel 370 × 370 mm, 45 mm hoch (gerippt) auf einer
// eingerückten Bodenplatte; Abtropfschale vorn rechts (x −80…185, z 45…185);
// drei Türme bis 318 mm: Mühle Ø 100 mm links, Brühgruppe mit vorn rundem
// Kopf (118 mm breit, bis 178 mm vor der Mitte) in der Mitte, Dampfturm
// Ø 102 mm rechts; dahinter der Wassertank (Stadionform 234 × 87 mm, oben
// klar und gerippt); rundes Display Ø 95 mm, um 33° nach vorn geneigt;
// Dampflanze als Schwanenhals aus dem Dampfturm.
//
// Koordinaten: X = Breite, Y = Höhe (0 = Stellfläche), Z = Tiefe (+Z = Front).
// Z = 0 ist die Mitte des Sockels.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, rbox, mergeGeos, woodCylUV } from '../model.js';
import { makeCanvas } from '../noise.js';
import { registerDevice } from '../devices.js';
import { DeviceUI } from '../device-ui.js';
import { createBuilder, filletShape, plateY, latheY, latheZ, tubeAlong } from '../parts.js';

const ID = 'meraki';
const S = (k) => `${ID}:${k}`;
const HB = 17; // Unterkante Sockel (darunter Bodenplatte)
const HS = 62; // Oberkante Sockel
const HT = 318; // Oberkante der Türme
const RB = 28; // Eckenradius Sockel
const TRAY = { x0: -80, z0: 45 }; // Abtropfschale vorn rechts
const GR = { x: -120, z: -10, r: 50 }; // Mühle
const ST = { x: 119, z: -11, r: 51 }; // Dampfturm
const HEAD = { r: 59, zc: 114, y0: 230, back: -60 }; // Kopf der Brühgruppe (vorn halbrund, bis 173 mm vor die Mitte)
const GZ = 106.5; // Achse der Brühgruppe
const TANK = { x0: -172, x1: 62, z0: -168, z1: -84 };

const STAGES = [
  { id: 'sk-frame', src: 'skeleton', from: [0, 1, 0], dist: 400, gap: 0, dur: 0.7, drop: true },
  { id: 'sk-boiler', src: 'skeleton', from: [0, 1, 0], dist: 700, gap: 0.45, dur: 0.85, heavy: true, stagger: 0.2 },
  { id: 'sk-grinder', src: 'skeleton', from: [0, 1, 0], dist: 600, gap: 0.4, dur: 0.7, spin: [[0, 1, 0], Math.PI * 2] },
  { id: 'sk-pump', src: 'skeleton', from: [-1, 0, 0], dist: 600, gap: 0.35, dur: 0.6 },
  { id: 'sk-pipes', src: 'skeleton', grow: true, gap: 0.3, dur: 0.7, stagger: 0.15 },
  { id: 'base', from: [0, -1, 0.3], dist: 600, gap: 0.45, after: true, dur: 0.8, heavy: true },
  { id: 'tank', from: [0, 0, -1], dist: 600, gap: 0.4, dur: 0.7 },
  { id: 'brew', from: [0, 1, 0], dist: 800, gap: 0.4, dur: 0.85, heavy: true },
  { id: 'steam', from: [1, 0, 0], dist: 700, gap: 0.4, dur: 0.75 },
  { id: 'grinder', from: [-1, 0, 0], dist: 700, gap: 0.4, dur: 0.75 },
  { id: 'hopper', from: [0, 1, 0], dist: 600, gap: 0.35, dur: 0.7 },
  { id: 'group', from: [0, -1, 0.4], dist: 600, gap: 0.35, dur: 0.6 },
  { id: 'wand', from: [0, 1, 0.3], dist: 600, gap: 0.3, dur: 0.6 },
  { id: 'display', pop: true, gap: 0.35, dur: 0.45 },
  { id: 'tray', from: [0, -0.2, 1], dist: 700, gap: 0.35, dur: 0.7 },
  { id: 'scales', pop: true, gap: 0.3, dur: 0.35, stagger: 0.1 },
  { id: 'cup', from: [0, 0, 1], dist: 500, gap: 0.3, dur: 0.5 },
  { id: 'portafilter', from: [0, -0.3, 1], dist: 700, gap: 0.35, dur: 0.7 },
  { id: 'logo', pop: true, gap: 0.35, dur: 0.5 },
];
const isInner = (id) => id.startsWith('sk-');

// ---- Texturen ---------------------------------------------------------------
const texCache = new Map();
function cached(key, make) {
  if (!texCache.has(key)) texCache.set(key, make());
  return texCache.get(key);
}

/** Bildschirm des runden Touch-Displays (kupferbrauner Hintergrund wie in den Werksbildern) */
function makeScreen(mode) {
  return cached(`screen:${mode}`, () => {
    const N = 512;
    const c = makeCanvas(N, N);
    const g = c.getContext('2d');
    const bg = g.createRadialGradient(N * 0.42, N * 0.38, 20, N / 2, N / 2, N * 0.55);
    bg.addColorStop(0, '#b4693d');
    bg.addColorStop(0.65, '#8e4a26');
    bg.addColorStop(1, '#5e2f17');
    g.fillStyle = bg;
    g.fillRect(0, 0, N, N);
    g.strokeStyle = 'rgba(255,240,228,0.92)';
    g.fillStyle = 'rgba(255,240,228,0.95)';
    g.lineWidth = 5;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const ring = (x, y, r) => {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.stroke();
    };
    if (mode === 'home') {
      const R = 72;
      const P = [
        [256, 150, 'Grinder'],
        [168, 300, 'Brew'],
        [344, 300, 'Steam'],
      ];
      for (const [x, y] of P) ring(x, y, R);
      g.font = '500 26px "Helvetica Neue", Arial, sans-serif';
      g.fillText('Grinder', 256, 56);
      g.save();
      g.translate(70, 300);
      g.rotate(-Math.PI / 2);
      g.fillText('Brew', 0, 0);
      g.restore();
      g.save();
      g.translate(442, 300);
      g.rotate(Math.PI / 2);
      g.fillText('Steam', 0, 0);
      g.restore();
      // Bohnen
      for (const [dx, dy, a] of [
        [-16, 6, -0.5],
        [14, -10, 0.4],
        [6, 20, 0.1],
      ]) {
        g.save();
        g.translate(256 + dx, 150 + dy);
        g.rotate(a);
        g.beginPath();
        g.ellipse(0, 0, 13, 18, 0, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(0, -14);
        g.quadraticCurveTo(5, 0, 0, 14);
        g.stroke();
        g.restore();
      }
      // Tasse
      g.beginPath();
      g.roundRect(140, 284, 46, 34, [0, 0, 12, 12]);
      g.stroke();
      g.beginPath();
      g.arc(192, 298, 9, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      g.beginPath();
      g.moveTo(130, 330);
      g.lineTo(204, 330);
      g.stroke();
      // Dampf
      g.beginPath();
      g.arc(344, 296, 22, Math.PI * 0.8, Math.PI * 2.2);
      g.stroke();
      for (const dx of [-10, 0, 10]) {
        g.beginPath();
        g.moveTo(344 + dx, 320);
        g.quadraticCurveTo(350 + dx, 330, 344 + dx, 342);
        g.stroke();
      }
      g.font = '500 30px "Helvetica Neue", Arial, sans-serif';
      g.fillText('08:00 AM', 256, 420);
    } else {
      // Mahlen bzw. Bezug: großer Wert mit Fortschrittsring
      const val = mode === 'grind' ? '18.0' : '36';
      g.lineWidth = 10;
      g.strokeStyle = 'rgba(255,240,228,0.25)';
      ring(256, 256, 190);
      g.strokeStyle = 'rgba(255,240,228,0.95)';
      g.beginPath();
      g.arc(256, 256, 190, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (mode === 'grind' ? 0.82 : 0.62));
      g.stroke();
      g.font = '300 150px "Helvetica Neue", Arial, sans-serif';
      g.fillText(val, 240, 262);
      g.font = '400 52px "Helvetica Neue", Arial, sans-serif';
      g.fillText('g', mode === 'grind' ? 396 : 352, 290);
      g.font = '500 30px "Helvetica Neue", Arial, sans-serif';
      g.fillText(mode === 'grind' ? 'Dose' : '28 s', 256, 120);
      g.fillText(mode === 'grind' ? 'Grind size 26' : '93 °C', 256, 392);
    }
    // Glanz
    const gl = g.createLinearGradient(0, 0, N, N);
    gl.addColorStop(0, 'rgba(255,255,255,0.10)');
    gl.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, N, N);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

/** Schriftzug "Meraki" mit vier LED-Punkten darüber (Alpha-Maske) */
function makeLogo() {
  return cached('logo', () => {
    const c = makeCanvas(512, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '500 96px "Helvetica Neue", Arial, sans-serif';
    g.fillText('Meraki', 256, 176);
    return new THREE.CanvasTexture(c);
  });
}

/** Skala am Mahlgradring (Striche und Zahlen, Alpha-Maske, einmal herum) */
function makeDial() {
  return cached('dial', () => {
    const W = 2048;
    const H = 64;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '500 20px Arial, sans-serif';
    // Skala nur über das vordere Drittel (Werksbild): 45 Stufen
    for (let k = 0; k <= 45; k++) {
      const x = W * 0.36 + (W * 0.28 * k) / 45;
      const long = k % 5 === 0;
      g.fillRect(x - 1.5, long ? 6 : 10, 3, long ? 22 : 14);
      if (long && k % 10 === 0) g.fillText(String(k), x, 46);
    }
    g.fillText('MAX', W * 0.36 - 40, 18);
    return new THREE.CanvasTexture(c);
  });
}

/** feines Gitter auf der Ausgabewaage */
function makeMesh() {
  return cached('mesh', () => {
    const N = 256;
    const c = makeCanvas(N, N);
    const g = c.getContext('2d');
    g.fillStyle = '#2b2c2e';
    g.fillRect(0, 0, N, N);
    g.fillStyle = '#121314';
    for (let y = 0; y < N; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < N; x += 8) {
      g.beginPath();
      g.arc(x + 2, y + 2, 2.2, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** waagerechte Rippen des klaren Tanks (Alpha-Maske, eine Rippe je Periode) */
function makeRibs() {
  return cached('ribs', () => {
    const c = makeCanvas(4, 32);
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, 4, 32);
    g.fillStyle = '#fff';
    g.fillRect(0, 2, 4, 2);
    g.fillStyle = '#555';
    g.fillRect(0, 4, 4, 2);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** Kaffeebohnen im Trichter */
function makeBeans() {
  return cached('beans', () => {
    const N = 256;
    const c = makeCanvas(N, N);
    const g = c.getContext('2d');
    g.fillStyle = '#2a170d';
    g.fillRect(0, 0, N, N);
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * N;
      const y = rnd() * N;
      const a = rnd() * Math.PI;
      const l = 0.75 + rnd() * 0.5;
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.fillStyle = `hsl(${20 + rnd() * 8}, ${45 + rnd() * 15}%, ${16 + rnd() * 14}%)`;
      g.beginPath();
      g.ellipse(0, 0, 9 * l, 6 * l, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(10,5,2,0.8)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(-8 * l, 0);
      g.quadraticCurveTo(0, 2.5, 8 * l, 0);
      g.stroke();
      g.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

// ---- Formen -----------------------------------------------------------------
/** Rechteck mit (je Ecke) gerundeten Ecken im Grundriss (x, z) */
function roundRect(x0, z0, x1, z1, r) {
  const rs = Array.isArray(r) ? r : [r, r, r, r];
  return filletShape([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], rs, 8);
}
/** Stadionform im Grundriss: Halbkreise an beiden Enden (Längsachse X) */
function stadium(x0, x1, z0, z1) {
  const r = (z1 - z0) / 2;
  const zc = (z0 + z1) / 2;
  const sh = new THREE.Shape();
  sh.moveTo(x0 + r, z0);
  sh.lineTo(x1 - r, z0);
  sh.absarc(x1 - r, zc, r, -Math.PI / 2, Math.PI / 2, false);
  sh.lineTo(x0 + r, z1);
  sh.absarc(x0 + r, zc, r, Math.PI / 2, Math.PI * 1.5, false);
  return sh;
}
/** Grundriss des Kopfes: Rechteck nach hinten, vorn ein Halbkreis */
function headShape(zBack, inset = 0) {
  const r = HEAD.r - inset;
  const sh = new THREE.Shape();
  sh.moveTo(-r, zBack + inset);
  sh.lineTo(r, zBack + inset);
  sh.lineTo(r, HEAD.zc);
  sh.absarc(0, HEAD.zc, r, 0, Math.PI, false);
  sh.closePath();
  return sh;
}

function buildMeraki(mm) {
  const B = createBuilder('Meraki', mm);
  const { root, F } = B;
  const mat = (k, extra) => mm.get(S(k), extra);
  const bodyMat = mat('body.main');
  const baseMat = mat('body.base');
  const groupMat = mat('metal.group');
  const trayMat = mat('metal.tray');

  // =========================================================================
  // Sockel: gerippte Seiten (Rippen 3,5 mm) auf eingerückter Bodenplatte;
  // vorn rechts die herausnehmbare Abtropfschale mit Gitter
  // =========================================================================
  B.stage('base');
  // gerippte Seiten: runde Wellen (Teilung 7,5 mm) wie in den Werksbildern
  const ribbed = (shape, slot, material, y0 = HB, y1 = HS, pitch = 7.5) => {
    const n = Math.round((y1 - y0) / pitch);
    const h = (y1 - y0) / n;
    const geos = [];
    for (let i = 0; i < n; i++) geos.push(plateY(shape, y0 + i * h, h, 2.2, 40).toNonIndexed());
    const g = boxProjectUV(mergeGeos(...geos));
    g.computeBoundingSphere();
    return B.add(g, material, slot);
  };
  const alu = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 1, roughness: 0.28 });
  {
    // fester Teil hinten (unter Tank und Türmen)
    ribbed(roundRect(-185, -185, 185, TRAY.z0 - 0.5, [RB, RB, 1, 1]), S('body.base'), baseMat);
    // Deckfläche zwischen den Türmen
    B.add(boxProjectUV(plateY(roundRect(-183, -183, 183, TRAY.z0 - 1, [RB - 2, RB - 2, 1, 1]), HS - 1, 1.2, 0.4, 24)), baseMat, S('body.base'));
    // Bodenplatte (eingerückt) und Gummifüße
    B.add(boxProjectUV(plateY(roundRect(-167, -167, 167, 167, 16), 3, HB - 3 + 0.5, 1.2, 32)), baseMat, S('body.base'));
    for (const [x, z] of [
      [-140, -140],
      [140, -140],
      [-140, 140],
      [140, 140],
    ]) B.plain(new THREE.CylinderGeometry(12, 12, 3, 24), F.rubber).position.set(x, 1.5, z);
    // Netzkabel hinten rechts (Seitenansicht: Höhe 34 mm)
    B.plain(latheZ([[0, 0], [7, 0], [7, 4], [5.5, 6], [4, 14], [0, 14]], 24).rotateY(Math.PI), F.blackPlastic).position.set(150, 34, -185);
    B.plain(tubeAlong([[150, 34, -197], [150, 31, -214], [150, 14, -230], [150, 3, -246]], 3, 40, 10), F.blackPlastic);
  }
  B.stage('tray');
  {
    // Abtropfschale: vorderer Streifen über die ganze Breite (Seitenansicht: Fuge bei z 45)
    const shape = roundRect(-185, TRAY.z0, 185, 185, [1, 1, RB, RB]);
    ribbed(shape, S('body.base'), baseMat, HB, HS - 2.5);
    // polierter Aluminiumrand oben mit Öffnung fürs Gitter
    const frame = roundRect(-185, TRAY.z0, 185, 185, [1, 1, RB, RB]);
    const m0 = 6;
    const hole = roundRect(-185 + m0, TRAY.z0 + 4, 185 - m0, 185 - m0, [0.5, 0.5, RB - m0, RB - m0]);
    frame.holes.push(new THREE.Path(hole.getPoints(8).reverse()));
    B.plain(boxProjectUV(plateY(frame, HS - 2.5, 2.5, 1, 40)), alu);
    // dunkler Boden der Schale
    B.plain(new THREE.BoxGeometry(370 - 2 * m0, 1, 185 - TRAY.z0 - m0 - 4), F.trayInner).position.set(0, HS - 10, (TRAY.z0 + 4 + 185 - m0) / 2);
    // Gitterstäbe von vorn nach hinten (Teilung 6 mm), an den Ecken gerundet
    const bars = [];
    const x0 = -185 + m0 + 2;
    const x1 = 185 - m0 - 2;
    const rc = RB - m0;
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 58) {
      const ax = Math.abs(x);
      const cx = 185 - m0 - rc;
      const zEnd = ax > cx ? 185 - m0 - rc + Math.sqrt(Math.max(0, rc * rc - (ax - cx) ** 2)) : 185 - m0;
      const len = zEnd - (TRAY.z0 + 4) - 1;
      if (len < 3) continue;
      const g = new THREE.BoxGeometry(2.8, 3.4, len).toNonIndexed();
      g.translate(x, HS - 2.2, TRAY.z0 + 4.5 + len / 2);
      bars.push(g);
    }
    B.add(boxProjectUV(mergeGeos(...bars)), trayMat, S('metal.tray'));
    // zwei orange Leuchtpunkte vorn (Waage aktiv)
    const led = new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff5a10, emissiveIntensity: 1.2, roughness: 0.4 });
    for (const x of [-24, 24]) B.plain(new THREE.BoxGeometry(2, 0.6, 3), led).position.set(x, HS - 3.5, 168);
  }

  // =========================================================================
  // Wassertank hinten links: unten in Gehäusefarbe, oben klar und gerippt
  // =========================================================================
  B.stage('tank');
  {
    const T = TANK;
    const sh = stadium(T.x0, T.x1, T.z0, T.z1);
    B.add(boxProjectUV(plateY(sh, HS, 168 - HS, 1.2, 48)), bodyMat, S('body.main'));
    const clear = new THREE.MeshPhysicalMaterial({ color: 0xe8eef1, roughness: 0.04, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
    const cg = plateY(stadium(T.x0 + 0.3, T.x1 - 0.3, T.z0 + 0.3, T.z1 - 0.3), 168, 310 - 168, 0.8, 64);
    const tankClear = B.plain(cg, clear);
    tankClear.renderOrder = 2;
    // Rippen: helle Linien auf der Außenseite
    const ribs = makeRibs().clone();
    ribs.needsUpdate = true;
    ribs.repeat.set(1, 1 / 3.2);
    const ribMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f7, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.6, alphaMap: ribs, depthWrite: false });
    const rg = plateY(stadium(T.x0, T.x1, T.z0, T.z1), 170, 136, 0, 64);
    const rm = B.plain(rg, ribMat);
    rm.renderOrder = 3;
    rm.castShadow = false;
    // Wasser (leicht bläulich) bis etwa 285 mm
    const water = new THREE.MeshPhysicalMaterial({ color: 0x46545b, roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false });
    const wm = B.plain(plateY(stadium(T.x0 + 3, T.x1 - 3, T.z0 + 3, T.z1 - 3), 168, 117, 0, 48), water);
    wm.renderOrder = 1;
    wm.castShadow = false;
    // Deckel
    B.add(boxProjectUV(plateY(sh, 310, HT - 310, 1.6, 48)), bodyMat, S('body.main'));
  }

  // =========================================================================
  // Brühgruppe: Säule unter dem Kopf, Kopf vorn halbrund mit Rillendeckel
  // =========================================================================
  B.stage('brew');
  {
    // Säule (x ±50) vom Tank bis 79 mm vor die Mitte
    B.add(boxProjectUV(plateY(roundRect(-50, HEAD.back, 50, 79, [2, 2, 12, 12]), HS - 1, HEAD.y0 - HS + 3, 1.5, 24)), bodyMat, S('body.main'));
    // Kopf: Rechteck nach hinten bis zum Tank, vorn Halbkreis (Ø 118)
    B.add(boxProjectUV(plateY(headShape(HEAD.back), HEAD.y0, 300 - HEAD.y0, 2, 64)), bodyMat, S('body.main'));
    // Deckelrand (leicht überstehend) mit kleinen Laschen links und rechts
    B.add(boxProjectUV(plateY(headShape(HEAD.back, -1.2), 300, HT - 300, 1.4, 64)), bodyMat, S('body.main'));
    // Bezugshebel vorn links am Deckelrand (D.2) mit Schlitz und Markierung, kleine Lasche rechts
    {
      const a = (-42 * Math.PI) / 180;
      const lever = B.add(boxProjectUV(rbox(7, 22, 9, 2, 2)), bodyMat, S('body.main'));
      lever.position.set(Math.sin(a) * (HEAD.r + 3.5), HT - 13, HEAD.zc + Math.cos(a) * (HEAD.r + 3.5));
      lever.rotation.y = a;
      const slot = new THREE.CylinderGeometry(HEAD.r + 0.35, HEAD.r + 0.35, 0.8, 48, 1, true, -0.62, 1.1);
      B.plain(slot, new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.5 })).position.set(0, 304, HEAD.zc);
      const tab = B.add(boxProjectUV(rbox(5, 20, 14, 1.5, 2)), bodyMat, S('body.main'));
      tab.position.set(HEAD.r + 1.5, HT - 11, HEAD.zc - 30);
    }
    // gerillte runde Deckfläche über der Gruppe und Symbol auf dem hinteren Teil
    const groove = latheY(
      Array.from({ length: 23 }, (_, i) => [i * 2.2, HT + (i % 2 ? 0.25 : 0.55)]).concat([[49.5, HT + 0.4], [50.5, HT]]),
      96,
    );
    B.add(groove, bodyMat, S('body.main')).position.set(0, 0, HEAD.zc);
    const ico = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.6, transparent: true, opacity: 0.55 });
    for (const r of [4, 8, 12]) {
      const ring = new THREE.RingGeometry(r - 0.5, r + 0.5, 48);
      ring.rotateX(-Math.PI / 2);
      B.plain(ring, ico).position.set(0, HT + 0.05, 10);
    }
  }

  // =========================================================================
  // Dampfturm rechts mit Deckel und seitlicher Lasche
  // =========================================================================
  B.stage('steam');
  {
    B.add(latheY([[0, HS - 1], [ST.r, HS - 1], [ST.r, 300], [0, 300]], 96), bodyMat, S('body.main')).position.set(ST.x, 0, ST.z);
    B.add(latheY([[0, 300], [ST.r + 0.8, 300], [ST.r + 0.8, HT - 1.5], [ST.r - 0.6, HT], [0, HT]], 96), bodyMat, S('body.main')).position.set(ST.x, 0, ST.z);
    B.plain(latheY([[ST.r + 0.05, 299.6], [ST.r + 0.05, 300.4]], 96), F.darkGap).position.set(ST.x, 0, ST.z);
    const tab = B.add(boxProjectUV(rbox(10, 21, 14, 2, 2)), bodyMat, S('body.main'));
    tab.position.set(ST.x + ST.r + 2, HT - 10.5, ST.z + 6);
  }

  // =========================================================================
  // Mühle links: Körper, Mahlgradring mit Skala, Bohnenbehälter, Deckel
  // =========================================================================
  B.stage('grinder');
  {
    B.add(latheY([[0, HS - 1], [GR.r, HS - 1], [GR.r, 250], [0, 250]], 96), bodyMat, S('body.main')).position.set(GR.x, 0, GR.z);
    // Mahlgradring (drehbar) mit Skala vorn
    B.add(latheY([[0, 250], [GR.r + 0.6, 250], [GR.r + 0.6, 262], [0, 262]], 96), bodyMat, S('body.main')).position.set(GR.x, 0, GR.z);
    const scale = new THREE.CylinderGeometry(GR.r + 0.75, GR.r + 0.75, 10, 128, 1, true);
    const sm = B.plain(scale, new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5, transparent: true, alphaMap: makeDial(), depthWrite: false }));
    sm.position.set(GR.x, 256, GR.z);
    sm.rotation.y = -Math.PI / 2;
    sm.castShadow = false;
    // Hebel für den Mahlgrad (C.2): kleine Lasche vorn rechts am Ring
    {
      const a = (28 * Math.PI) / 180;
      const lv = B.add(boxProjectUV(rbox(7, 16, 9, 2, 2)), bodyMat, S('body.main'));
      lv.position.set(GR.x + Math.sin(a) * (GR.r + 3), 250, GR.z + Math.cos(a) * (GR.r + 3));
      lv.rotation.y = a;
    }
    // Auslauf vorn (schwarz): kurzer Schacht aus dem Körper bis über den Trichter
    B.plain(boxProjectUV(rbox(32, 15, 30, 5, 3)), F.blackPlastic).position.set(GR.x, 224, GR.z + GR.r + 8);
    B.plain(latheY([[0, 214], [17.5, 214], [17.5, 218], [16, 220], [0, 220]], 40), F.blackPlastic).position.set(GR.x, 0, 64);
  }
  B.stage('hopper');
  const beans = [];
  {
    const smoke = new THREE.MeshPhysicalMaterial({ color: 0x3a3a3c, roughness: 0.06, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
    const hm = B.plain(latheY([[GR.r - 1, 262], [GR.r - 1, 306], [GR.r - 3.5, 306], [GR.r - 3.5, 264]], 96), smoke);
    hm.position.set(GR.x, 0, GR.z);
    hm.renderOrder = 2;
    // Bohnen (Option)
    const bt = makeBeans().clone();
    bt.needsUpdate = true;
    bt.repeat.set(3, 1);
    const bm = B.plain(latheY([[0, 280], [20, 279], [36, 274], [GR.r - 4, 266], [GR.r - 4, 262], [0, 262]], 64), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.6 }));
    bm.position.set(GR.x, 0, GR.z);
    beans.push(bm);
    // Deckel
    B.add(latheY([[0, 306], [GR.r, 306], [GR.r, HT - 2], [GR.r - 2, HT], [0, HT]], 96), bodyMat, S('body.main')).position.set(GR.x, 0, GR.z);
  }

  // =========================================================================
  // Brühgruppe und Siebträger (58 mm) mit Holzgriff
  // =========================================================================
  B.stage('group');
  {
    // Gruppenring Ø 94 mm (Frontzeichnung 210…230 mm)
    B.add(latheY([[0, 212], [44, 212], [48, 214], [49, 217], [49, 228.5], [48, HEAD.y0 + 0.5], [0, HEAD.y0 + 0.5]], 72), groupMat, S('metal.group')).position.z = GZ;
  }
  B.stage('wand');
  {
    // Schwanenhals aus dem Dampfturm: senkrecht nach oben, Bogen nach vorn,
    // dann leicht nach vorn geneigt hinab bis zur Düse (Seitenansicht)
    const P = [
      [-12, HT + 2],
      [-12, 345],
      [-6, 368],
      [10, 381],
      [34, 385],
      [57, 379],
      [74, 366],
      [83, 348],
      [93, 285],
      [106, 200],
      [116, 140],
    ].map(([z, y]) => [ST.x, y, z]);
    B.add(tubeAlong(P, 6.4, 160, 18), groupMat, S('metal.group'));
    B.add(latheY([[0, HT], [8.5, HT], [8.5, HT + 4], [7, HT + 6], [0, HT + 6]], 32), groupMat, S('metal.group')).position.set(ST.x, 0, -12);
    // Düse
    const dir = new THREE.Vector3(0, 140 - 200, 116 - 106).normalize();
    const tip = B.add(latheY([[0, 0], [7.2, 0], [10, 5], [10, 22], [8.5, 26], [3, 29], [2, 32], [0, 32]], 32), groupMat, S('metal.group'));
    tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    tip.position.set(ST.x, 140, 116);
  }

  // =========================================================================
  // rundes Touch-Display auf dem Kopf (Ø 95 mm, um 33° nach vorn geneigt)
  // =========================================================================
  B.stage('display');
  const screenMat = new THREE.MeshBasicMaterial({ map: makeScreen('home'), toneMapped: false });
  {
    const tilt = (33.5 * Math.PI) / 180;
    const dg = new THREE.Group();
    dg.position.set(0, 367, 125.5);
    dg.rotation.x = -tilt;
    root.add(dg);
    B.plain(latheZ([[0, -12], [38, -12], [44, -10], [47.2, -6], [47.5, -1.2], [46.5, 0], [0, 0]], 96), F.blackPlastic, dg);
    const scr = B.plain(new THREE.CircleGeometry(42, 96), screenMat, dg);
    scr.position.z = 0.15;
    scr.castShadow = false;
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.08, transparent: true, opacity: 0.12, clearcoat: 0.35, specularIntensity: 0.4, depthWrite: false });
    const gl = B.plain(new THREE.CircleGeometry(46.5, 96), glassMat, dg);
    gl.position.z = 0.4;
    gl.castShadow = false;
    // Kegelfuß auf dem Kopf
    B.plain(latheY([[0, HT], [17, HT], [12, HT + 22], [0, HT + 24]], 48), F.blackPlastic).position.set(0, 0, 108);
  }

  // =========================================================================
  // Waagen: Ausgabewaage unter der Gruppe, Dosierwaage unter der Mühle
  // =========================================================================
  B.stage('scales');
  {
    const meshMat = new THREE.MeshStandardMaterial({ map: makeMesh(), roughness: 0.55, metalness: 0.3 });
    B.plain(latheY([[0, HS - 0.5], [53, HS - 0.5], [55, HS + 1.5], [55, HS + 10.5], [54, HS + 12], [50, HS + 12.4], [0, HS + 12.4]], 96), F.blackPlastic).position.z = GZ;
    const top = B.plain(new THREE.CircleGeometry(49.5, 96).rotateX(-Math.PI / 2), meshMat);
    top.position.set(0, HS + 12.5, GZ);
    B.plain(latheY([[49.4, HS + 12.4], [51.5, HS + 12.2], [53.2, HS + 11.2], [53.6, HS + 10.2]], 96), alu).position.z = GZ;
    B.plain(latheY([[0, HS - 0.5], [38, HS - 0.5], [39, HS + 1], [39, HS + 6], [37.5, HS + 7.2], [0, HS + 7.2]], 96), F.blackPlastic).position.set(GR.x, 0, 64);
  }
  // Dosierbecher mit Edelstahlring und Einfülltrichter (verchromt)
  B.stage('cup');
  {
    B.add(latheY([[0, HS + 8], [28, HS + 8], [30, 120], [30, 148], [0, 148]], 64), bodyMat, S('body.main')).position.set(GR.x, 0, 64);
    B.add(latheY([[29, 148], [35, 149], [35, 153], [33, 154.5], [27, 154.5], [27, 120]], 64), groupMat, S('metal.group')).position.set(GR.x, 0, 64);
    B.add(latheY([[17, 154], [19, 155], [19, 214], [17.5, 215.5], [15.5, 215.5], [15.5, 156]], 48), groupMat, S('metal.group')).position.set(GR.x, 0, 64);
  }
  B.stage('portafilter');
  {
    // Siebträger: Korb Ø 70 mm (190…209 mm) mit Ohren, Doppelauslauf darunter
    B.add(latheY([[0, 189], [30, 189], [34, 192], [36.5, 199], [36.5, 212.5], [0, 212.5]], 64), groupMat, S('metal.group')).position.z = GZ;
    for (const sx of [-1, 1]) {
      const ear = B.add(boxProjectUV(rbox(9, 5, 13, 1.5, 2)), groupMat, S('metal.group'));
      ear.position.set(sx * 39, 209, GZ);
    }
    B.add(latheY([[0, 178], [9, 178], [12, 182], [14, 189.5], [0, 189.5]], 24), groupMat, S('metal.group')).position.z = GZ;
    for (const sx of [-1, 1]) {
      const s = B.add(latheY([[0, 0], [3.4, 0], [4.2, 7], [4.2, 11], [0, 11]], 16), groupMat, S('metal.group'));
      s.position.set(sx * 7, 170, GZ);
      s.rotation.z = sx * 0.3;
    }
    // Griff: Hals verchromt, dann Holz (Seitenansicht: bis 296 mm vor die Mitte, leicht abfallend)
    const pf = new THREE.Group();
    pf.position.set(0, 192, GZ + 33);
    pf.rotation.x = 0.06;
    root.add(pf);
    B.add(latheZ([[0, 0], [8, 0], [8, 14], [7, 18], [7, 28], [0, 28]], 24), groupMat, S('metal.group'), pf);
    const L = 296 - GZ - 33;
    const hp = [[0, 28], [10.5, 28], [11.5, 34], [12.5, L * 0.5], [15, L - 10], [16, L - 4], [14.5, L - 1], [8, L], [0, L]];
    B.add(woodCylUV(latheZ(hp, 40), [0.3, 0.12]), mat('wood.handle'), S('wood.handle'), pf);
  }

  // =========================================================================
  // Schriftzug "Meraki" mit LED-Punkten vorn am Kopf
  // =========================================================================
  B.stage('logo');
  {
    const w = 36;
    const theta = w / (HEAD.r + 0.25);
    const g = new THREE.CylinderGeometry(HEAD.r + 0.25, HEAD.r + 0.25, 18, 24, 1, true, -theta / 2, theta);
    const lm = mat('metal.logo', { alphaMap: makeLogo(), alphaTest: 0.4, alphaToCoverage: true });
    const lg = B.add(g, lm, S('metal.logo'));
    lg.position.set(0, 247, HEAD.zc);
    lg.castShadow = false;
    const dot = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.4 });
    for (const [i, x] of [-6.6, -2.2, 2.2, 6.6].entries()) {
      const d = B.plain(new THREE.CylinderGeometry(i === 3 ? 0.8 : 0.9, i === 3 ? 0.8 : 0.9, 0.6, 12).rotateX(Math.PI / 2), dot);
      const zf = HEAD.zc + Math.sqrt(HEAD.r * HEAD.r - x * x) + 0.2;
      d.position.set(x, 257, zf);
    }
  }

  // =========================================================================
  // Innenleben: Rahmen, Kaffee- und Dampfkessel, Mühlenmotor, Rotationspumpe
  // =========================================================================
  {
    B.sk('sk-frame');
    B.skBox(330, 4, 330, F.frame, 0, HS + 4, -10, 1);
    B.sk('sk-boiler');
    B.skCyl(30, 120, F.copper, 0, 290, -10, 'z', 40); // Kaffeekessel 350 ml
    B.skCyl(36, 150, F.copper, ST.x, 190, ST.z, 'y', 40); // Dampfkessel 550 ml
    B.sk('sk-grinder');
    B.skCyl(32, 90, F.motor, GR.x, 150, GR.z, 'y', 40);
    B.skCyl(19, 18, F.steel || F.motor, GR.x, 215, GR.z, 'y', 32); // Kegelmahlwerk 37 mm
    B.sk('sk-pump');
    B.skCyl(26, 100, F.motor, 30, 110, -60, 'x', 32);
    B.skBox(70, 40, 2, F.pcb, -40, 120, -70, 1);
    B.sk('sk-pipes');
    B.pipe([[30, 110, -110], [10, 200, -60], [0, 270, -40], [0, 290, 30]], 4, F.copper);
    B.pipe([[ST.x, 260, ST.z], [ST.x, 300, ST.z - 20], [ST.x, 316, -12]], 4, F.copper);
    B.pipe([[0, 260, -10], [0, 240, 60], [0, 232, GZ]], 4, F.copper);
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
      screenMat.map = makeScreen(o.screen || 'home');
      screenMat.needsUpdate = true;
      for (const m of beans) m.visible = (o.beans || 'yes') === 'yes';
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
      { key: S('body.main'), label: 'Türme, Tank & Dosierbecher' },
      { key: S('body.base'), label: 'Sockel & Abtropfschale' },
    ],
  },
  [S('wood')]: {
    title: 'Holz',
    allLabel: 'Alle',
    slots: [{ key: S('wood.handle'), label: 'Siebträgergriff' }],
  },
  [S('metal')]: {
    title: 'Akzente',
    allLabel: 'Alle',
    slots: [
      { key: S('metal.group'), label: 'Brühgruppe, Siebträger, Dampflanze & Trichter' },
      { key: S('metal.tray'), label: 'Abtropfgitter' },
      { key: S('metal.logo'), label: 'Schriftzug', woodLogo: true },
    ],
  },
};
const SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));
const OPTIONS = [
  {
    key: 'screen',
    label: 'Display',
    choices: [
      { id: 'home', name: 'Startseite' },
      { id: 'grind', name: 'Mahlen' },
      { id: 'brew', name: 'Bezug' },
    ],
  },
  {
    key: 'beans',
    label: 'Bohnenbehälter',
    choices: [
      { id: 'yes', name: 'Mit Bohnen' },
      { id: 'no', name: 'Leer' },
    ],
  },
];
const BLACK = { id: 'RAL9005', finish: 'matte' };
const WHITE = { id: 'RAL9016', finish: 'matte' };
const m = (id, finish = 'gloss') => ({ id, finish });
function preset(name, swatches, body, wood, accents = {}) {
  return {
    name,
    swatches,
    config: {
      slots: {
        [S('body.main')]: body,
        [S('body.base')]: body,
        [S('wood.handle')]: { id: wood, finish: 'oiled' },
        [S('metal.group')]: m('chrome'),
        [S('metal.tray')]: body.id === BLACK.id ? m('black', 'matte') : m('steel', 'satin'),
        [S('metal.logo')]: body.id === BLACK.id ? m('white', 'matte') : m('black', 'matte'),
        ...accents,
      },
      opts: { screen: 'home', beans: 'yes' },
    },
  };
}
const PRESETS = [
  preset('Schwarz · Walnuss (Werk)', ['#111113', '#644434', '#e4e6e9'], BLACK, 'walnut'),
  preset('Weiß · Walnuss (Werk)', ['#f1f0ea', '#644434', '#cfd1d3'], WHITE, 'walnut'),
  preset('Anthrazit · Eiche', ['#383e42', '#d99c52', '#55585d'], { id: 'RAL7016', finish: 'matte' }, 'oak', {
    [S('metal.group')]: m('gunmetal', 'satin'),
    [S('metal.tray')]: m('black', 'matte'),
    [S('metal.logo')]: m('wood:oak', 'oiled'),
  }),
  preset('Salbei · Ahorn', ['#8ba27c', '#e6d2ae', '#e4e6e9'], { id: 'RAL6021', finish: 'matte' }, 'maple', {
    [S('body.base')]: WHITE,
    [S('metal.logo')]: m('white', 'matte'),
  }),
];

registerDevice({
  id: ID,
  kind: 'machine',
  brand: 'Meraki Tech',
  name: 'Meraki',
  full: 'Meraki Espresso Machine',
  file: 'Meraki',
  code: 'MEM03',
  dims: { w: 370, d: 370, h: 412 },
  rootZ: 0,
  shadow: { w: 0.46, d: 0.46, z: 0 },
  frame: { target: [0, 0.2, 0], scale: 0.95 },
  slots: SLOTS,
  categories: CATEGORIES,
  presets: PRESETS,
  options: OPTIONS,
  optionsTitle: 'Display & Bohnen',
  build: (mm) => buildMeraki(mm),
  UI: DeviceUI,
  roles: {
    body: [S('body.main'), S('body.base')],
    accent: [S('metal.group'), S('metal.tray')],
    wood: [S('wood.handle')],
    screws: [],
    logo: [S('metal.logo')],
  },
  stageLabels: {
    'sk-frame': ['Rahmen & Bodenblech', 'Stahl verzinkt'],
    'sk-boiler': ['Kaffeekessel 350 ml & Dampfkessel 550 ml', 'Edelstahl'],
    'sk-grinder': ['Kegelmahlwerk 37 mm mit Motor', 'TIMEMORE'],
    'sk-pump': ['Rotationspumpe & Steuerung', ''],
    'sk-pipes': ['Leitungen', 'Kupfer'],
    base: ['Sockel', S('body.base')],
    tank: ['Wassertank', S('body.main')],
    brew: ['Brühturm mit Kopf', S('body.main')],
    steam: ['Dampfturm', S('body.main')],
    grinder: ['Mühle', S('body.main')],
    hopper: ['Bohnenbehälter', ''],
    group: ['Brühgruppe', S('metal.group')],
    wand: ['Dampflanze (Schwanenhals)', S('metal.group')],
    display: ['Touch-Display Ø 95 mm', ''],
    tray: ['Abtropfschale mit Gitter', S('metal.tray')],
    scales: ['Dosier- und Ausgabewaage', ''],
    cup: ['Dosierbecher & Trichter', S('metal.group')],
    portafilter: ['Siebträger 58 mm', S('wood.handle')],
    logo: ['Schriftzug', S('metal.logo')],
  },
});
