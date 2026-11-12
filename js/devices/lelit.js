// ---------------------------------------------------------------------------
// Lelit Bianca (PL162T, Dualboiler mit Flow-Control-Paddel) und Lelit MaraX3
// (PL62X3, Zweikreiser mit LELIT58-Gruppe und Pagaia-Flow-Control)
//
// Maße in Millimeter.
// Bianca: maßstäbliche Front- und Seitenansicht im offiziellen technischen
//   Datenblatt (Quick-Start-Leaflet PL162T; bei 600 dpi 2,389 px/mm; Höhe
//   400 mm und Tiefe 585 mm mit Tank wie in den Herstellerangaben), dazu die
//   Produktansicht der Bedienungsanleitung und die Werksbilder auf lelit.com.
// MaraX3: orthografische Seiten- und Frontansicht der Werks-Renderings
//   (Maßstab über die Höhe 385 mm laut technischem Datenblatt; Gehäuse
//   rund 220 mm breit), Werksbilder auf lelit.com.
//
// Koordinaten: X = Breite, Y = Höhe (0 = Stellfläche), Z = Tiefe (+Z = Front).
// Z = 0 ist die Vorderkante des Gehäuses (Frontblech).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, rbox, extrudeZ, polyhedron, woodBoxUV, woodCylUV } from '../model.js';
import { makeSlotFieldTexture } from '../textures.js';
import { GAUGE_DIALS, NEEDLES } from '../data.js';
import { makeCanvas } from '../noise.js';
import { registerDevice } from '../devices.js';
import { DeviceUI } from '../device-ui.js';
import { createBuilder, filletShape, plateZ, plateY, latheY, latheZ, buildGauge, logoFactory, tubeAlong } from '../parts.js';

// ---- Formen ----------------------------------------------------------------
function starKnob(R0, amp, lobes, n = 144) {
  const sh = new THREE.Shape();
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2 + Math.PI / 2;
    const r = R0 + amp * Math.cos(lobes * (a - Math.PI / 2));
    const p = [r * Math.cos(a), r * Math.sin(a)];
    if (k === 0) sh.moveTo(...p);
    else sh.lineTo(...p);
  }
  return sh;
}
/** abgerundetes Vieleck (MaraX3: fünfeckiger Knopf "new gem shape") */
function roundedPolygon(R, sides, rc, rot = Math.PI / 2) {
  const pts = [];
  for (let k = 0; k < sides; k++) {
    const a = rot + (k / sides) * Math.PI * 2;
    pts.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  return filletShape(pts, rc, 6);
}
function makeDisplayTex(text) {
  const c = makeCanvas(256, 160);
  const g = c.getContext('2d');
  g.fillStyle = '#05070a';
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#e8eef4';
  g.font = '600 74px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Schriftzug mit Symbol auf dem Frontblech (LELIT-Badge rot bzw. MaraX3-Logo) */
function makeBadge(kind) {
  const c = makeCanvas(512, 160);
  const g = c.getContext('2d');
  if (kind === 'lelit') {
    g.fillStyle = '#c4161c';
    g.beginPath();
    g.roundRect(8, 20, 496, 120, 22);
    g.fill();
    g.strokeStyle = '#e9e9e9';
    g.lineWidth = 7;
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = '900 92px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('LELIT', 256, 84);
  } else {
    g.clearRect(0, 0, 512, 160);
    g.fillStyle = '#1a1a1a';
    g.beginPath();
    g.arc(70, 80, 46, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = '800 54px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('L', 70, 84);
    g.fillStyle = '#1a1a1a';
    g.fillRect(132, 34, 5, 92);
    g.font = '500 76px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'left';
    g.fillText('MaraX3', 154, 86);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Polylinie mit gerundeten Ecken (Radius r): gerade Rohrstücke und enge Biegungen */
function bendPath(points, r) {
  const P = points.map((p) => new THREE.Vector3(...p));
  const out = [P[0].toArray()];
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1];
    const b = P[i];
    const c = P[i + 1];
    const d1 = a.clone().sub(b);
    const d2 = c.clone().sub(b);
    const k = Math.min(r, d1.length() * 0.45, d2.length() * 0.45);
    const p1 = b.clone().addScaledVector(d1.normalize(), k);
    const p2 = b.clone().addScaledVector(d2.normalize(), k);
    for (let t = 0; t <= 1.0001; t += 1 / 8) {
      const q = p1.clone().multiplyScalar((1 - t) * (1 - t)).addScaledVector(b, 2 * t * (1 - t)).addScaledVector(p2, t * t);
      out.push(q.toArray());
    }
  }
  out.push(P[P.length - 1].toArray());
  return out;
}

/** kleine gravierte Beschriftung (Alpha-Maske) */
function makeLabel(text) {
  const c = makeCanvas(256, 72);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 72);
  g.fillStyle = '#fff';
  g.font = '600 40px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 38);
  return new THREE.CanvasTexture(c);
}

const STAGES = [
  { id: 'sk-frame', src: 'skeleton', from: [0, 1, 0], dist: 400, gap: 0, dur: 0.7, drop: true },
  { id: 'sk-boiler', src: 'skeleton', from: [0, 1, 0], dist: 700, gap: 0.45, dur: 0.85, heavy: true, stagger: 0.2 },
  { id: 'sk-pump', src: 'skeleton', from: [-1, 0, 0], dist: 600, gap: 0.35, dur: 0.6 },
  { id: 'sk-pipes', src: 'skeleton', grow: true, gap: 0.3, dur: 0.7, stagger: 0.15 },
  { id: 'base', from: [0, -1, 0.3], dist: 600, gap: 0.45, after: true, dur: 0.8, heavy: true },
  { id: 'feet', from: [0, -1, 0], dist: 350, gap: 0.3, dur: 0.5, stagger: 0.07 },
  { id: 'front', from: [0, 0, 1], dist: 700, gap: 0.4, dur: 0.75 },
  { id: 'group', from: [0, 0.4, 1], dist: 800, gap: 0.4, dur: 0.85, heavy: true },
  { id: 'valves', from: [0, 0, 1], dist: 600, gap: 0.35, dur: 0.6, stagger: 0.1 },
  { id: 'wands', from: [0, -1, 0.4], dist: 600, gap: 0.3, dur: 0.6, stagger: 0.12 },
  { id: 'controls', pop: true, gap: 0.3, dur: 0.35, stagger: 0.08 },
  { id: 'sides', from: [1, 0, 0], dist: 800, gap: 0.4, dur: 0.85, perSide: true },
  { id: 'panels', from: [1, 0, 0], dist: 500, gap: 0.3, dur: 0.6, perSide: true },
  { id: 'top', from: [0, 1, 0], dist: 500, gap: 0.35, dur: 0.6 },
  { id: 'tank', from: [0, 0, -1], dist: 600, gap: 0.35, dur: 0.6 },
  { id: 'drip', from: [0, -0.2, 1], dist: 700, gap: 0.35, dur: 0.7 },
  { id: 'knobs', from: [0, 0, 1], dist: 400, gap: 0.3, dur: 0.5, stagger: 0.1, spin: [[0, 0, 1], Math.PI * 2] },
  { id: 'portafilter', from: [0, -0.3, 1], dist: 700, gap: 0.35, dur: 0.7 },
  { id: 'logo', pop: true, gap: 0.35, dur: 0.5 },
];
const isInner = (id) => id.startsWith('sk-');

// ---- Gerätedaten -------------------------------------------------------------
const MODELS = {
  bianca: {
    id: 'bianca',
    name: 'Bianca',
    full: 'Lelit Bianca',
    file: 'Lelit-Bianca',
    code: 'PL162T',
    hw: 145, // halbe Gehäusebreite (290)
    zr: -225.6, // Rückwand
    top: 375,
    bot: 33,
    trayHW: 145,
    tray: [-30, 181, 92], // Abtropfschale: z hinten, z vorn, Oberkante
    rack: { w: 140, z0: 72, z1: 128, h: 20, n: 10 }, // erhöhte Tassenablage (Werksbild Front)
    feet: { x: 120, z: [-192, 153], r: [26, 22.5] },
    frames: [-197, -49], // Seitenblech zwischen Rahmenprofilen
    tank: { z0: -304.6, bot: 71 },
    // Achse der Brühgruppe: Seitenzeichnung (Glocke z 50…148) und Kameraabgleich des
    // Werksbilds (Dreiviertelansicht) ergeben übereinstimmend z ≈ 100
    gz: 100,
    group: 'e61',
    portaH: 236,
    handleEnd: 280,
    spoutH: 196,
    spout: 'fork', // kurzer Doppelauslauf; die hohe Säule dahinter gehört zur Gruppe
    handleTilt: 0.19, // Siebträgergriff ~11° nach vorn abfallend (Werksbilder)
    knobs: { x: 114, h: 340, z: 80, shape: 'star' },
    steam: { side: -1, tip: [-157, 140, 92] },
    water: { tip: [159, 180, 92] },
    // Lanzen (Zeichnung Front + Seite): Auslass am Ventil z = 12, dann Knick nach außen/vorn
    lanceZ: 12,
    steamPath: [[-114, 270, 12], [-138, 243, 56], [-157, 140, 87]],
    waterPath: [[114, 270, 12], [130, 247, 50], [159, 180, 80]],
    lever: true,
    gauge: { x: 73, h: 165, r: 32, dual: true },
    // Gruppenmanometer: Zifferblattmitte (Höhe, Tiefe), Neigung nach oben
    groupGauge: { h: 322, z: 106, r: 18.5, tilt: 0.7 }, // Seitenzeichnung: rund 40° nach oben geneigt
    lcc: { x: -80, h: 167, r: 22 },
    power: { x: -80, h: 219 },
    paddle: true,
    pagaia: false,
    dims: { w: 290, d: 585, h: 400 },
  },
  marax3: {
    id: 'marax3',
    name: 'MaraX3',
    full: 'Lelit MaraX3',
    file: 'Lelit-MaraX3',
    code: 'PL62X3',
    hw: 97,
    zr: -239,
    top: 382,
    bot: 34,
    trayHW: 108.5,
    tray: [-39, 166, 92],
    rack: { w: 125, z0: 48, z1: 92, h: 19, n: 9 }, // erhöhte Tassenablage (Werksansichten)
    feet: { x: 92, z: [-201, 151], r: [16, 16] },
    frames: null,
    strip: [-75, -54],
    tank: null,
    gz: 50,
    group: 'l58',
    portaH: 240,
    handleEnd: 269,
    spoutH: 155,
    knobs: { x: 85.5, h: 348, z: 72, shape: 'gem' },
    steam: { side: -1, tip: [-141, 145, 100] },
    water: { tip: [92, 188, 32], grip: true, short: true },
    // Lanzen (Werksansichten Front + Seite): Dampf mit waagerechtem Knick nach außen,
    // Heißwasser kurz und leicht nach außen geneigt mit Holzgriff
    lanceZ: 22,
    steamPath: [[-85.5, 283, 22], [-104, 260, 42], [-121, 252, 66], [-141, 146, 100]],
    waterPath: [[80, 262, 26], [92, 190, 32]],
    lever: false,
    gauge: { x: -55, h: 251, r: 25, dual: false },
    groupGauge: null,
    lcc: null,
    power: { x: -49, h: 193 },
    paddle: false,
    pagaia: true,
    dims: { w: 220, d: 507, h: 385 },
  },
};

function makeBuilder(V) {
  const ID = V.id;
  const S = (k) => `${ID}:${k}`;
  return function build(mm) {
    const B = createBuilder(V.file, mm);
    const { root, F } = B;
    const mat = (k, extra) => mm.get(S(k), extra);
    const bodyMat = mat('body.main');
    const groupMat = mat('metal.group');
    const HW = V.hw;
    const [tz0, tz1, tTop] = V.tray;

    // =======================================================================
    // Unterbau, Füße
    // =======================================================================
    B.stage('base');
    B.plain(rbox(2 * HW - 8, 4, -V.zr - 10, 1.5, 2), F.frame).position.set(0, V.bot + 2, V.zr / 2);
    B.stage('feet');
    {
      const [r1, r2] = V.feet.r;
      const foot = latheY([[0, 0], [r2, 0], [r2 + 0.8, 1.2], [r1, V.bot - 1.5], [r1 - 1, V.bot], [0, V.bot]], 40);
      const fg = woodCylUV(foot.clone().rotateX(-Math.PI / 2), [0.2, 0.3]).rotateX(Math.PI / 2);
      for (const z of V.feet.z) for (const sx of [-1, 1]) B.add(fg, mat('wood.feet'), S('wood.feet')).position.set(sx * V.feet.x, 0, z);
    }

    // =======================================================================
    // Frontblech mit Bedienelementen
    // =======================================================================
    B.stage('front');
    {
      const sh = filletShape([[-HW + 2, tTop], [HW - 2, tTop], [HW - 2, V.top - 2], [-HW + 2, V.top - 2]], 1.5, 2);
      B.add(boxProjectUV(plateZ(sh, -1.6, 1.6, 0.4)), mat('metal.front'), S('metal.front'));
      // Badge bzw. Logo
      const bw = V.id === 'bianca' ? 44 : 46;
      const badge = B.plain(new THREE.PlaneGeometry(bw, bw * 0.3125), new THREE.MeshStandardMaterial({ map: makeBadge(V.id === 'bianca' ? 'lelit' : 'marax3'), transparent: true, roughness: 0.4, metalness: 0.1 }));
      if (V.id === 'bianca') badge.position.set(-80, 118, 0.6);
      else badge.position.set(-38, 153, 0.25);
    }

    // =======================================================================
    // Gehäuse: Seitenbleche, Rahmen, Rückwand, Tassenablage, Wassertank
    // =======================================================================
    B.stage('sides');
    const sideStd = [];
    {
      const D = -V.zr;
      const sh = new THREE.Shape();
      // Seitenkontur: hinten bis unten, vorn über der Abtropfschale
      sh.moveTo(V.zr, V.bot);
      sh.lineTo(tz0, V.bot);
      sh.lineTo(tz0, tTop);
      sh.lineTo(0, tTop);
      sh.lineTo(0, V.top);
      sh.lineTo(V.zr, V.top);
      sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelOffset: -0.4, bevelSegments: 2 });
      g.rotateY(-Math.PI / 2);
      boxProjectUV(g);
      for (const sx of [1, -1]) {
        const m = B.add(g, bodyMat, S('body.main'));
        m.position.x = sx > 0 ? HW : -HW + 1.4;
        sideStd.push(m);
      }
      // Rahmenprofile (Bianca: Rahmen vorn/hinten, Seitenblech dazwischen)
      if (V.frames) {
        for (const sx of [-1, 1]) {
          for (const [z0, z1] of [
            [V.zr, V.frames[0]],
            [V.frames[1], 0],
          ]) {
            const p = B.add(boxProjectUV(rbox(3, V.top - V.bot - 2, z1 - z0, 1, 2)), mat('metal.frame'), S('metal.frame'));
            p.position.set(sx * (HW + 1.2), (V.top + V.bot) / 2, (z0 + z1) / 2);
          }
        }
      }
      // Zierleiste mit LELIT-Schriftzug (MaraX3)
      if (V.strip) {
        const [z0, z1] = V.strip;
        for (const sx of [-1, 1]) {
          const p = B.add(boxProjectUV(rbox(2.4, 250, z1 - z0, 1.2, 2)), mat('metal.frame'), S('metal.frame'));
          p.position.set(sx * (HW + 1), 218, (z0 + z1) / 2);
        }
      }
      // Rückwand und Deckel
      B.add(boxProjectUV(rbox(2 * HW, V.top - V.bot, 1.6, 0.6, 2)), bodyMat, S('body.main')).position.set(0, (V.top + V.bot) / 2, V.zr + 0.8);
      B.plain(rbox(2 * HW - 6, 2, D - 4, 0.8, 2), F.trayInner).position.set(0, V.top - 10, V.zr / 2);
    }
    // Holz-Seitenteile (optional, wie bei rb.crafts-Umbauten)
    B.stage('panels');
    const woodSides = [];
    {
      const z0 = V.frames ? V.frames[0] : V.zr + 10;
      const z1 = V.frames ? V.frames[1] : (V.strip ? V.strip[0] - 6 : -10);
      const g = woodBoxUV(rbox(5, V.top - V.bot - 26, z1 - z0, 1.6, 2), 1, [0.2, 0.35]);
      for (const sx of [-1, 1]) {
        const w = B.add(g, mat('wood.sides'), S('wood.sides'));
        w.position.set(sx * (HW + 2.6), (V.top + V.bot) / 2, (z0 + z1) / 2);
        woodSides.push(w);
      }
    }
    B.stage('top');
    {
      // geschlossene Tassenablage aus Edelstahl; MaraX3 mit Lüftungsschlitzen vorn
      const W = 2 * HW - 6;
      const D = -V.zr - 6;
      const fields = [];
      if (!V.tank) for (let x = W * 0.3; x < W - 14; x += 5) fields.push({ x, y: 8, w: 2.4, h: 12, pitch: 5, slot: 2.4, r: 1.2, dir: 'rows' });
      const tex = makeSlotFieldTexture(W, D, fields, { brushed: 'y', pxPerMM: 3 });
      const g = boxProjectUV(rbox(W, 2, D, 0.8, 2));
      const tm = mat('metal.tray', { map: tex, alphaTest: 0.5, alphaToCoverage: true });
      const top = B.add(g, tm, S('metal.tray'));
      top.position.set(0, V.top - 0.2, -3 - D / 2);
      // UV der Deckfläche auf die ganze Platte strecken (Schlitze an der Vorderkante)
      const uv = g.attributes.uv;
      const pos = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, pos.getZ(i) / D + 0.5);
      // Tassenreling vorn/seitlich (flacher Rand)
      const rim = filletShape([[-HW, V.zr], [HW, V.zr], [HW, 0], [-HW, 0]], 2, 2);
      rim.holes.push(filletShape([[-HW + 3, V.zr + 3], [HW - 3, V.zr + 3], [HW - 3, -3], [-HW + 3, -3]], 1.5, 2));
      B.add(boxProjectUV(plateY(rim, V.top - 1, 3, 0.6)), bodyMat, S('body.main'));
      if (!V.tank) {
        // MaraX3: Tankdeckel hinten (schwarz)
        B.plain(rbox(70, 2, 26, 1, 2), F.blackPlastic).position.set(-HW + 50, V.top + 0.6, V.zr + 27);
      }
    }
    B.stage('tank');
    if (V.tank) {
      // Bianca: Wassertank hinten (schwenkbar), mit Deckelknopf
      const { z0, bot } = V.tank;
      const shell = B.add(boxProjectUV(rbox(2 * HW - 18, V.top - bot, V.zr - z0, 6, 3)), bodyMat, S('body.main'));
      shell.position.set(0, (V.top + bot) / 2, (V.zr + z0) / 2);
      B.plain(latheY([[0, 0], [4, 0], [4, 12], [3, 14], [0, 14]], 20), F.chrome).position.set(0, V.top, -262);
    }

    // =======================================================================
    // Abtropfschale mit Gitter
    // =======================================================================
    B.stage('drip');
    {
      const TW = V.trayHW;
      B.add(boxProjectUV(plateY(filletShape([[-TW, tz0], [TW, tz0], [TW, tz1], [-TW, tz1]], [0, 0, 3, 3], 3), V.bot, tTop - V.bot - 14, 1)), bodyMat, S('body.main'));
      const wall = filletShape([[-TW, tz0], [TW, tz0], [TW, tz1], [-TW, tz1]], [0, 0, 3, 3], 3);
      wall.holes.push(filletShape([[-TW + 3, tz0 + 3], [TW - 3, tz0 + 3], [TW - 3, tz1 - 3], [-TW + 3, tz1 - 3]], 1.5, 2));
      B.add(boxProjectUV(plateY(wall, tTop - 14, 14, 0.5)), bodyMat, S('body.main'));
      B.plain(new THREE.BoxGeometry(2 * TW - 7, 1, tz1 - tz0 - 7), F.trayInner).position.set(0, tTop - 13, (tz0 + tz1) / 2);
      const W = 2 * TW - 8;
      const D = tz1 - tz0 - 8;
      const fields = [];
      for (let y = 4; y < D - 5; y += 5.5) fields.push({ x: 5, y, w: W - 10, h: 3, pitch: 5.5, slot: 3, r: 1, dir: 'cols' });
      const tex = makeSlotFieldTexture(W, D, fields.map((f) => ({ ...f, dir: 'rows' })), { brushed: 'x', pxPerMM: 4 });
      const g = new THREE.PlaneGeometry(W, D);
      g.rotateX(-Math.PI / 2);
      B.add(g, mat('metal.tray', { map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide }), S('metal.tray')).position.set(0, tTop - 2.5, tz0 + 4 + D / 2);
      // erhöhte Tassenablage: quer laufende Drähte, an den Enden abgerundet nach unten gebogen,
      // zwei Querstege darunter (Werksansichten: ca. 20 mm über dem Gitter)
      const R0 = V.rack;
      const base = tTop - 2.5;
      const hw = R0.w / 2;
      const h = R0.h;
      const rackMat = mat('metal.tray');
      const nW = R0.n;
      for (let i = 0; i < nW; i++) {
        const z = R0.z0 + ((R0.z1 - R0.z0) * i) / (nW - 1);
        const pts = [
          [-hw, base, z],
          [-hw - 1.5, base + h * 0.45, z],
          [-hw + h * 0.12, base + h * 0.9, z],
          [-hw + h * 0.55, base + h, z],
          [hw - h * 0.55, base + h, z],
          [hw - h * 0.12, base + h * 0.9, z],
          [hw + 1.5, base + h * 0.45, z],
          [hw, base, z],
        ];
        B.add(tubeAlong(pts, 1.15, 70, 8), rackMat, S('metal.tray'));
      }
      for (const sx of [-1, 1]) {
        const bar = B.add(new THREE.CylinderGeometry(1.2, 1.2, R0.z1 - R0.z0 + 4, 10).rotateX(Math.PI / 2), rackMat, S('metal.tray'));
        bar.position.set(sx * hw * 0.42, base + h - 2.3, (R0.z0 + R0.z1) / 2);
        for (const z of [R0.z0 + 3, R0.z1 - 3]) {
          const leg = B.add(new THREE.CylinderGeometry(1, 1, h - 2, 8), rackMat, S('metal.tray'));
          leg.position.set(sx * hw * 0.42, base + (h - 2) / 2, z);
        }
      }
    }

    // =======================================================================
    // Brühgruppe: Bianca E61 mit Flow-Control-Paddel, MaraX3 LELIT58
    // =======================================================================
    B.stage('group');
    const GZ = V.gz;
    {
      if (V.group === 'e61') {
        // ---- Bianca V3: E61-Gruppe mit Flow-Control-Paddel ----
        // Aufbau nach den Werksbildern (Front, Dreiviertel, Detail) und der Front-/Seitenzeichnung,
        // Lage und Höhen über eine aus den Gehäusekanten gelöste Fotokamera nachgemessen:
        // flache Glockentrommel vorn (Achse z 100), dahinter der Gruppenkörper mit der hohen
        // Säule nach unten, ein schräg nach hinten oben laufender Hals bis zur Paddelachse
        // (z 38), das Manometer vorn am Hals, links und rechts davon zwei spitze Chromtürme
        // auf einer polierten Rückplatte am Frontblech.
        const gm = (g, parent) => B.add(g, groupMat, S('metal.group'), parent);
        const BB = V.portaH; // Unterkante Glocke / Oberkante Siebträger (236)
        const DT = 277; // Oberkante der Trommel
        // Glocke: unterer Kragen Ø 72, Trommel Ø 100 mit gerundeten Kanten, Deckel bis zum Hals
        gm(
          latheY(
            [[0, BB], [34, BB], [36, BB + 1.5], [36, 247], [44, 248.2], [48, 249.2], [50, 251.5], [50, DT - 4], [49.4, DT - 1.6], [47.8, DT], [45, DT + 1.2], [33, DT + 3.4], [24, DT + 5.6], [21, DT + 6.4], [0, DT + 6.4]],
            112,
          ),
        ).position.z = GZ;
        // Schloss-Symbol vorn auf der Trommel
        const lockTex = (() => {
          const c = makeCanvas(64, 80);
          const g = c.getContext('2d');
          g.fillStyle = '#000';
          g.fillRect(0, 0, 64, 80);
          g.strokeStyle = '#fff';
          g.lineWidth = 7;
          g.beginPath();
          g.arc(32, 30, 14, Math.PI, 0);
          g.stroke();
          g.fillStyle = '#fff';
          g.fillRect(12, 34, 40, 34);
          g.fillStyle = '#000';
          g.fillRect(29, 44, 6, 14);
          return new THREE.CanvasTexture(c);
        })();
        const lock = B.plain(new THREE.PlaneGeometry(7, 8.75), new THREE.MeshStandardMaterial({ color: 0x151515, alphaMap: lockTex, transparent: true, roughness: 0.4 }));
        lock.position.set(0, 261, GZ + 50.15);
        lock.castShadow = false;

        // Gruppenkörper hinter der Glocke (vom Frontblech bis in die Glocke)
        gm(boxProjectUV(rbox(38, 41, GZ - 22, 6, 3))).position.set(0, 263.5, (GZ - 22) / 2);
        // hohe Säule unter dem Gruppenkörper (Frontzeichnung x ±17, Seitenzeichnung z 17…56)
        gm(
          latheY(
            [[0, 131], [5.5, 131], [7.5, 133], [9, 136], [9, 146], [13, 146], [13, 156], [15, 157], [15, 189], [16.2, 190], [17, 191], [17, 224], [18.5, 225.5], [20, 227], [20, 244], [0, 244]],
            40,
          ),
        ).position.set(0, 0, 36);
        // Sechskant an der Säule
        gm(new THREE.CylinderGeometry(17, 17, 9, 6)).position.set(0, 151, 36);

        // schräger Hals: von der Glocke (z 75) nach hinten oben zum Kopfstück (z 45),
        // Seitenzeichnung und Kameraabgleich stimmen überein (rund 25° gegen die Senkrechte)
        const H0 = new THREE.Vector3(0, DT + 3, 75);
        const H1 = new THREE.Vector3(0, 341, 45);
        const hd = H1.clone().sub(H0);
        const HL = hd.length();
        const neck = gm(
          latheY(
            [[0, -6], [21, -6], [21, -3], [18.5, 2], [16.5, 9], [15.4, 18], [14.8, HL - 6], [15.8, HL - 3], [15.8, HL], [0, HL]],
            56,
          ),
        );
        neck.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hd.normalize());
        neck.position.copy(H0);
        // Kopfstück am Frontblech (Seitenzeichnung: z 0…44, Höhe 319…343), darauf die
        // längliche Deckplatte (z 13…56, Höhe 343…352, Breite 38), Sechskantmutter und
        // Ventilspindel unter dem Paddel (Achse senkrecht bei z 35)
        gm(boxProjectUV(rbox(20, 26, 46, 4, 3))).position.set(0, 331, 22); // schmal zwischen den Türmen
        gm(boxProjectUV(rbox(38, 10, 44, 2, 2))).position.set(0, 347.5, 34);
        gm(new THREE.CylinderGeometry(11.5, 11.5, 8, 6)).position.set(0, 356.5, 35);
        gm(latheY([[0, 360], [6, 360], [6, 369], [8, 370], [0, 370]], 24)).position.z = 35;

        // Gruppenmanometer vorn am Hals, nach vorn oben geneigt
        const GG = V.groupGauge;
        const gq = new THREE.Group();
        gq.position.set(0, GG.h, GG.z);
        gq.rotation.x = -GG.tilt;
        root.add(gq);
        const RH = GG.r + 2.6;
        gm(latheZ([[0, -31], [9, -31], [14, -29.5], [RH - 1.5, -24], [RH, -19], [RH, 0.6], [0, 0.6]], 48), gq);
        // Stütze vom Gehäuseboden schräg nach unten in den Hals
        const stem = gm(new THREE.CylinderGeometry(6.5, 7.5, 24, 24).translate(0, -12, 0), gq);
        stem.position.set(0, -RH + 6, -20);
        stem.rotation.x = 0.55;
        V._groupGauge = buildGauge(B, { slot: S('metal.gauge'), x: 0, y: 0, z: 0, R: GG.r, bezel: 2.6, parent: gq, spec: { id: 'lelit-group', max: 12, step: 1, label: 2, value: 9, unit: 'bar', zone: [8, 10] } });
        // Glas des schräg nach oben zeigenden Manometers spiegelt sonst das Oberlicht flächig
        // und verdeckt das Zifferblatt; schwächer spiegelnd wie auf den Werksbildern
        {
          const dim = F.glass.clone();
          dim.clearcoat = 0.3;
          dim.specularIntensity = 0.3;
          dim.envMapIntensity = 0.35;
          V._groupGauge.grp.traverse((o) => { if (o.material === F.glass) o.material = dim; });
        }

        // polierte Rückplatte am Frontblech und zwei spitze Chromtürme (Grundriss: Fünfeck mit
        // flacher Spitze nach vorn, 26 mm breit; Wände bis 312 mm, Spitze vorn auf 343 mm;
        // Flächenbreiten aus der Dreiviertelansicht nachgerechnet)
        gm(boxProjectUV(rbox(68, 44, 3, 1, 2))).position.set(0, 293, 1.5);
        const tower = (cx) => {
          const y0 = 272;
          const yw = 312;
          const ya = 343;
          const w = 13;
          const zb = 2.5;
          const zw = 15;
          const zp = 20;
          const b = [[cx - w, y0, zb], [cx - w, y0, zw], [cx, y0, zp], [cx + w, y0, zw], [cx + w, y0, zb]];
          const t = [[cx - w, yw, zb], [cx - w, yw, zw], [cx + w, yw, zw], [cx + w, yw, zb]];
          const ap = [cx, ya, zp];
          return polyhedron([
            [b[4], b[3], b[2], b[1], b[0]], // Boden
            [b[0], t[0], t[3], b[4]], // Rückseite
            [b[0], b[1], t[1], t[0]], // Außenwand links
            [b[1], b[2], ap, t[1]], // Bugfläche links
            [b[2], b[3], t[2], ap], // Bugfläche rechts
            [b[3], b[4], t[3], t[2]], // Wand rechts
            [t[1], ap, t[0]], // Dach links
            [ap, t[2], t[3]], // Dach rechts
            [t[0], ap, t[3]], // Dach hinten
          ]);
        };
        for (const sx of [-1, 1]) gm(boxProjectUV(tower(sx * 21)));
      } else {
        // LELIT58: Halsstück, hohe abgerundete Haube über einem breiten Kragen
        const neck = latheZ([[0, 0], [22, 0], [22, GZ], [0, GZ]], 40);
        B.add(neck, groupMat, S('metal.group')).position.set(0, V.portaH + 44, 0);
        const housing = latheY([[0, V.portaH + 30], [27, V.portaH + 30], [29, V.portaH + 50], [29, 362], [27, 374], [18, 381], [0, 382]], 64);
        housing.scale(1, 1, 0.82);
        B.add(housing, groupMat, S('metal.group')).position.z = GZ - 6;
        const collar = new THREE.TorusGeometry(40, 9, 20, 72);
        collar.rotateX(Math.PI / 2);
        collar.scale(1.18, 1, 0.92);
        B.add(collar, groupMat, S('metal.group')).position.set(0, V.portaH + 24, GZ);
        B.add(latheY([[0, V.portaH - 3], [38, V.portaH - 3], [41, V.portaH + 3], [41, V.portaH + 18], [30, V.portaH + 24], [0, V.portaH + 24]], 64), groupMat, S('metal.group')).position.z = GZ;
        B.add(latheY([[0, 382], [11, 382], [11, 388], [0, 389]], 6), groupMat, S('metal.group')).position.z = GZ - 6;
      }
      // Flow-Control-Paddel (Bianca): Holzklotz auf senkrechter Achse (z 38), in Ruhestellung nach
      // vorn zeigend; Seitenprofil L-förmig mit Aussparung über Mutter und Spindel
      if (V.paddle) {
        const pts = [];
        const arc = (cz, cy, r, a0, a1, n = 8) => {
          for (let i = 0; i <= n; i++) {
            const a = a0 + ((a1 - a0) * i) / n;
            pts.push([cz + r * Math.cos(a), cy + r * Math.sin(a)]);
          }
        };
        const P = Math.PI;
        // Seitenprofil (z, y) nach dem Werksdetailbild: senkrechte Rückseite, Aussparung über
        // Mutter und Spindel bis z 55, darunter eine schräge Unterkante bis zur Stirn,
        // Stirn leicht gewölbt, Oberkanten gerundet
        arc(31, 390, 7, P, P / 2); // hinten oben
        pts.push([60, 398.2]); // Oberseite leicht gewölbt
        arc(87, 386, 11, P / 2, 0.1); // vorn oben
        pts.push([99.2, 372]);
        arc(87, 350, 12, -0.05, -P / 2); // vorn unten
        pts.push([80, 338], [60.5, 356.2], [57.6, 357.9], [55.9, 359.6], [55.5, 361.5]); // schräge Unterkante, Knick zur Stufe
        arc(52.5, 367, 3, 0, P / 2, 4); // Hohlkehle in der Aussparung
        arc(27, 373, 3, -P / 2, -P, 4); // hinten unten
        const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
        const g = new THREE.ExtrudeGeometry(sh, { depth: 17, bevelEnabled: true, bevelThickness: 4, bevelSize: 4, bevelOffset: -4, bevelSegments: 5, curveSegments: 6 });
        g.translate(0, 0, -8.5);
        g.rotateY(Math.PI / 2);
        const blade = woodBoxUV(g, 2, [0.12, 0.4]);
        B.add(blade, mat('wood.paddle'), S('wood.paddle'));
      }
    }

    // =======================================================================
    // Ventile, Drehknöpfe, Dampf- und Heißwasserlanze
    // =======================================================================
    B.stage('valves');
    const K = V.knobs;
    for (const sx of [-1, 1]) {
      const v = B.add(latheZ([[0, 0], [10, 0], [10, 6], [12.5, 7], [12.5, 18], [9.5, 19], [9, K.z - 2], [0, K.z - 2]], 32), groupMat, S('metal.group'));
      v.position.set(sx * K.x, K.h, 0);
      // Ventilkörper nach unten (Lanzenanschluss)
      B.add(latheY([[0, -26], [8, -26], [9, -20], [9, 0], [0, 0]], 24), groupMat, S('metal.group')).position.set(sx * K.x, K.h, V.lanceZ);
    }
    B.stage('knobs');
    {
      const kg =
        K.shape === 'star'
          ? woodCylUV(extrudeZ(starKnob(26, 4, 6), 22, 2.4, 3, 4), [0.17, 0.27])
          : woodCylUV(extrudeZ(roundedPolygon(32, 5, 7), 26, 2.6, 3, 4), [0.17, 0.27]);
      for (const sx of [-1, 1]) {
        const k = B.add(kg, mat('wood.knobs'), S('wood.knobs'));
        k.position.set(sx * K.x, K.h, K.z - 2);
        if (K.shape === 'star') {
          const cap = B.add(latheZ([[0, 0], [11.5, 0], [11.5, 1], [11, 3], [9.6, 5.2], [7.2, 6.8], [4, 7.7], [0, 8]], 32), groupMat, S('metal.group'));
          cap.position.set(sx * K.x, K.h, K.z + 20.5);
        } else {
          const ball = new THREE.SphereGeometry(16, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2);
          ball.rotateX(Math.PI / 2);
          B.add(ball, mat('metal.balls'), S('metal.balls')).position.set(sx * K.x, K.h, K.z + 22);
        }
      }
    }
    B.stage('wands');
    {
      // Lanzen als gerade Rohrstücke mit engen Biegungen, Verlauf aus Front- und Seitenansicht
      // abgelesen: kurzes senkrechtes Stück unter dem Ventil, Knick nach außen und vorn,
      // dann ein langes, fast senkrechtes gerades Stück bis zur Düse
      const lance = (path, r, radius, grip) => {
        const pts = bendPath(path, radius);
        B.add(tubeAlong(pts, r, 160, 18), groupMat, S('metal.group'));
        // Kugelgelenk oben (Mehrwege-Dampflanze) bzw. Überwurf
        B.add(new THREE.SphereGeometry(r + 2.4, 20, 14), groupMat, S('metal.group')).position.set(...path[0]);
        const [ex, ey, ez] = path[path.length - 1];
        const [px, py, pz] = path[path.length - 2];
        const dir = new THREE.Vector3(ex - px, ey - py, ez - pz).normalize();
        const tip = B.add(latheY([[0, 0], [r + 0.8, 0], [r + 2.2, 4], [r + 2.2, 12], [r + 1.4, 14], [0, 14]], 20), groupMat, S('metal.group'));
        tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
        tip.position.set(ex, ey, ez);
        if (grip) {
          const L = 40;
          const g = woodCylUV(latheY([[0, 0], [r + 2.4, 0], [r + 3.4, 5], [r + 3.4, L - 5], [r + 2.4, L], [0, L]], 24).rotateX(-Math.PI / 2), [0.3, 0.1]).rotateX(Math.PI / 2);
          const gm = B.add(g, mat('wood.handle'), S('wood.handle'));
          gm.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
          gm.position.set(ex - dir.x * (L + 4), ey - dir.y * (L + 4), ez - dir.z * (L + 4));
        }
      };
      const out = (sx) => [sx * K.x, K.h - 26, V.lanceZ];
      lance([out(-1), ...V.steamPath], 4.8, V.id === 'bianca' ? 20 : 17, false);
      lance([out(1), ...V.waterPath], V.water.short ? 4.4 : 4.6, V.water.short ? 8 : 20, !!V.water.grip);
    }
    // Brühhebel rechts an der Gruppe (Bianca): Querrohr aus dem Gruppenkörper, Gelenkblock neben
    // der Glocke, Hebelstange schräg nach unten mit Holzgriff (Frontzeichnung: Block x 66…84,
    // Höhe 237…271; Griff x 73…92, Höhe 160…200; Tiefe aus dem Kameraabgleich z ≈ 60)
    if (V.lever) {
      const gm = (g) => B.add(g, groupMat, S('metal.group'));
      gm(new THREE.CylinderGeometry(6, 6, 50, 24).rotateZ(Math.PI / 2)).position.set(43, 256, 58);
      gm(new THREE.CylinderGeometry(8.5, 8.5, 9, 6).rotateZ(Math.PI / 2)).position.set(58, 256, 58);
      gm(boxProjectUV(rbox(18, 34, 22, 3, 2))).position.set(75, 254, 58);
      const top = [77, 238, 60];
      const mid = [82, 202, 64];
      gm(tubeAlong([top, [79.5, 220, 62], mid], 4, 30, 14));
      const dir = new THREE.Vector3(mid[0] - top[0], mid[1] - top[1], mid[2] - top[2]).normalize();
      const grip = woodCylUV(latheY([[0, 0], [5.5, 0], [7.5, 4], [9.5, 22], [10.2, 32], [9, 39], [5.5, 43], [0, 44]], 28).rotateX(-Math.PI / 2), [0.2, 0.3]).rotateX(Math.PI / 2);
      const gmw = B.add(grip, mat('wood.paddle'), S('wood.paddle'));
      gmw.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      gmw.position.set(...mid);
    }

    // =======================================================================
    // Bedienung: Manometer, LCC-Display, Schalter, Pagaia
    // =======================================================================
    B.stage('controls');
    {
      const G = V.gauge;
      const g = buildGauge(B, { slot: S('metal.gauge'), x: G.x, y: G.h, z: 0, R: G.r, bezel: 3.4, spec: G.dual ? { id: 'lelit-dual', max: 16, step: 1, label: 4, value: 9, unit: 'bar', zone: [8, 10] } : { id: 'lelit-boiler', max: 3, step: 0.25, label: 0.5, value: 1.2, unit: 'bar', zone: [1, 1.5] } });
      V._gauge = g;
      if (V.lcc) {
        const ring = B.add(latheZ([[0, 0], [V.lcc.r, 0], [V.lcc.r, 2.4], [V.lcc.r - 1.2, 3.4], [0, 3.4]], 48), groupMat, S('metal.group'));
        ring.position.set(V.lcc.x, V.lcc.h, 0);
        const d = B.plain(new THREE.PlaneGeometry(22, 14), new THREE.MeshBasicMaterial({ map: makeDisplayTex('93°'), toneMapped: false }));
        d.position.set(V.lcc.x, V.lcc.h + 4, 3.6);
        for (const dx of [-6, 6]) B.plain(new THREE.CylinderGeometry(3, 3, 1.5, 20).rotateX(Math.PI / 2), F.chrome).position.set(V.lcc.x + dx, V.lcc.h - 9, 3.8);
      }
      const p = V.power;
      B.add(latheZ([[0, 0], [8, 0], [8, 3], [7, 4], [0, 4]], 32), groupMat, S('metal.group')).position.set(p.x, p.h, 0);
      const led = B.plain(new THREE.TorusGeometry(5.5, 0.6, 8, 32), new THREE.MeshStandardMaterial({ color: 0xdfe8ef, emissive: 0x5a7a98, roughness: 0.3 }));
      led.position.set(p.x, p.h, 4.2);
      if (V.pagaia) {
        // Pagaia: ovaler Drehregler aus Holz (51 × 33 mm, 12 mm stark) mit zwei runden Aussparungen,
        // auf einem kurzen Stiel seitlich an der linken Gehäusewand (Mitte z −19, Höhe 280)
        const g = new THREE.Group();
        g.position.set(-HW - 1, 280.5, -19.5);
        root.add(g);
        const sh = new THREE.Shape();
        const r = 16.5;
        const half = 25.5 - r;
        sh.moveTo(-r, -half);
        sh.absarc(0, -half, r, Math.PI, Math.PI * 2, false);
        sh.lineTo(r, half);
        sh.absarc(0, half, r, 0, Math.PI, false);
        sh.closePath();
        for (const dy of [-11.5, 11.5]) {
          const hole = new THREE.Path();
          hole.absarc(0, dy, 9.2, 0, Math.PI * 2, true);
          sh.holes.push(hole);
        }
        const plate = new THREE.ExtrudeGeometry(sh, { depth: 12, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelOffset: -1.2, bevelSegments: 3, curveSegments: 40 });
        // Shape (x, y) = (z, Höhe), Extrusion nach außen (−X)
        plate.rotateY(-Math.PI / 2);
        B.add(woodBoxUV(plate, 1, [0.35, 0.2]), mat('wood.paddle'), S('wood.paddle'), g).position.x = -7;
        // Grundplatte und Achse aus Edelstahl, in den Aussparungen sichtbar
        const disc = new THREE.CylinderGeometry(9.4, 9.4, 3, 32).rotateZ(Math.PI / 2);
        for (const dy of [-11.5, 11.5]) B.add(disc, groupMat, S('metal.group'), g).position.set(-15.5, dy, 0);
        B.add(new THREE.CylinderGeometry(4.5, 4.5, 8, 20).rotateZ(Math.PI / 2), groupMat, S('metal.group'), g).position.set(-3, 0, 0);
        // Beschriftung "Pagaia" und Bogen darüber (graviert)
        const lab = B.plain(new THREE.PlaneGeometry(26, 7), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, alphaMap: makeLabel('Pagaia'), transparent: true, roughness: 0.6 }));
        lab.rotation.y = -Math.PI / 2;
        lab.position.set(-HW - 0.15, 318, -19.5);
      }
    }

    // =======================================================================
    // Siebträger (58 mm) mit Holzgriff
    // =======================================================================
    B.stage('portafilter');
    {
      const H0 = V.portaH;
      B.add(latheY([[0, H0 - 32], [29, H0 - 32], [33, H0 - 28], [35, H0 - 20], [36, H0 - 6], [39, H0 - 4], [39, H0 - 1], [0, H0 - 1]], 64), groupMat, S('metal.group')).position.z = GZ;
      if (V.spout === 'fork') {
        // kurzer Doppelauslauf: Nabe unter dem Sieb, zwei nach außen gebogene Ausläufe
        B.add(latheY([[0, H0 - 38], [10, H0 - 38], [13, H0 - 35], [14, H0 - 32], [0, H0 - 32]], 24), groupMat, S('metal.group')).position.z = GZ;
        for (const sx of [-1, 1]) {
          const arm = B.add(tubeAlong([[sx * 7, H0 - 34, GZ], [sx * 16, H0 - 27, GZ], [sx * 22.5, H0 - 30, GZ], [sx * 23.5, H0 - 38, GZ], [sx * 23, V.spoutH + 2, GZ]], 4.6, 32, 16), groupMat, S('metal.group'));
          arm.scale.z = 1.25;
          arm.position.z = -GZ * 0.25;
          B.add(latheY([[0, 0], [3.4, 0], [5.2, 2], [5.2, 6], [0, 6]], 16), groupMat, S('metal.group')).position.set(sx * 23, V.spoutH - 2, GZ);
        }
      } else {
        B.add(latheY([[0, V.spoutH + 14], [8, V.spoutH + 14], [11, V.spoutH + 22], [15, H0 - 32], [0, H0 - 32]], 24), groupMat, S('metal.group')).position.z = GZ;
        for (const sx of [-1, 1]) {
          const s = B.add(latheY([[0, 0], [3.6, 0], [4.4, 7], [4.4, 14], [0, 14]], 16), groupMat, S('metal.group'));
          s.position.set(sx * 8, V.spoutH, GZ);
          s.rotation.z = sx * 0.3;
        }
      }
      const pf = new THREE.Group();
      pf.position.set(0, H0 - 6, GZ + 36);
      pf.rotation.x = V.handleTilt ?? -0.07; // Neigung des Griffs (Bianca: nach vorn abfallend wie in den Werksbildern)
      root.add(pf);
      B.add(latheZ([[0, 0], [7.5, 0], [7.5, 12], [6.5, 14], [6.5, 22], [0, 22]], 24), groupMat, S('metal.group'), pf);
      const L = V.handleEnd - GZ - 36;
      const hp = [[0, 22], [9.4, 22], [10.4, 28], [11, L * 0.45], [13, L * 0.8], [14, L - 8], [12.6, L - 3], [8, L - 0.6], [0, L]];
      B.add(woodCylUV(latheZ(hp, 40), [0.3, 0.12]), mat('wood.handle'), S('wood.handle'), pf);
    }

    // Innenleben: Rahmen, Kessel, Pumpe, Leitungen
    {
      B.sk('sk-frame');
      B.skBox(2 * HW - 20, 4, -V.zr - 20, F.frame, 0, V.bot + 8, V.zr / 2, 1);
      B.sk('sk-boiler');
      if (V.id === 'bianca') {
        B.skCyl(48, 170, F.copper, -40, 260, -110, 'z', 40);
        B.skCyl(36, 120, F.copper, 55, 215, -90, 'z', 40);
      } else {
        B.skCyl(56, 180, F.copper, 0, 250, -115, 'z', 48);
      }
      B.sk('sk-pump');
      B.skCyl(24, 110, F.motor, 0, 90, -130, 'z', 32);
      B.skBox(60, 40, 2, F.pcb, 60, 100, -190, 1);
      B.sk('sk-pipes');
      B.pipe([[0, 250, -40], [0, 290, -20], [0, 300, -2]], 4.5, F.copper);
      B.pipe([[-60, 250, -60], [-K.x, K.h - 20, -10], [-K.x, K.h, -2]], 3.5, F.copper);
      B.pipe([[60, 230, -60], [K.x, K.h - 20, -10], [K.x, K.h, -2]], 3.5, F.copper);
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
        const ws = config.slots[S('wood.sides')]?.id !== 'none';
        for (const m of woodSides) m.visible = ws;
        V._gauge?.set({ dial: o.dial || 'white', needle: o.needle || 'red' });
        V._groupGauge?.set({ dial: o.dial || 'white', needle: o.needle || 'red' });
      },
    };
  };
}

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------
function define(V) {
  const ID = V.id;
  const S = (k) => `${ID}:${k}`;
  const woodSlots = [
    { key: S('wood.knobs'), label: 'Drehknöpfe' },
    { key: S('wood.handle'), label: V.water.grip ? 'Siebträgergriff & Heißwassergriff' : 'Siebträgergriff' },
    { key: S('wood.paddle'), label: V.paddle ? 'Flow-Control-Paddel & Hebelkugel' : 'Pagaia (Flow-Control)' },
    { key: S('wood.feet'), label: 'Füße' },
    { key: S('wood.sides'), label: 'Holz-Seitenteile', panel: true },
  ];
  const metalSlots = [
    { key: S('metal.front'), label: 'Frontblech' },
    ...(V.frames || V.strip ? [{ key: S('metal.frame'), label: V.frames ? 'Rahmenprofile' : 'Zierleisten' }] : []),
    { key: S('metal.group'), label: 'Brühgruppe, Ventile & Lanzen' },
    { key: S('metal.tray'), label: 'Tassenablage & Abtropfgitter' },
    { key: S('metal.gauge'), label: 'Manometer-Ringe', options: ['dial', 'needle'] },
    ...(V.knobs.shape === 'gem' ? [{ key: S('metal.balls'), label: 'Knopfkappen' }] : []),
  ];
  const CATEGORIES = {
    [S('body')]: { title: 'Gehäuse', allLabel: 'Komplett', slots: [{ key: S('body.main'), label: 'Gehäuse & Abtropfschale' }] },
    [S('wood')]: { title: 'Holz', allLabel: 'Alle', slots: woodSlots },
    [S('metal')]: { title: 'Akzente', allLabel: 'Alle', slots: metalSlots },
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
  const w = (id) => ({ id, finish: 'oiled' });
  const preset = (name, swatches, body, wood, accents = {}, opts = {}) => ({
    name,
    swatches,
    config: {
      slots: Object.fromEntries(
        SLOTS.map((k) => {
          const base = {
            [S('body.main')]: body,
            [S('wood.knobs')]: w(wood),
            [S('wood.handle')]: w(wood),
            [S('wood.paddle')]: w(wood),
            [S('wood.feet')]: w(wood),
            [S('wood.sides')]: w('none'),
            [S('metal.front')]: body.id === STEEL.id ? m('steel', 'satin') : body,
            [S('metal.frame')]: m('steel', 'satin'),
            [S('metal.group')]: m('chrome'),
            [S('metal.tray')]: m('steel', 'matte'),
            [S('metal.gauge')]: m('chrome'),
            [S('metal.balls')]: m('white', 'gloss'),
          };
          return [k, { ...base, ...accents }[k]];
        }),
      ),
      opts: { dial: 'white', needle: 'red', ...opts },
    },
  });
  const PRESETS =
    ID === 'bianca'
      ? [
          preset('Edelstahl · Walnuss (Werk)', ['#c6c2c3', '#644434', '#e4e6e9'], STEEL, 'walnut'),
          preset('Schwarz · Walnuss (Werk)', ['#141414', '#644434', '#e4e6e9'], BLACK, 'walnut', { [S('metal.frame')]: m('black', 'matte') }),
          preset('Weiß · Ahorn (Werk)', ['#efefea', '#e6d2ae', '#e4e6e9'], WHITE, 'maple', { [S('metal.frame')]: m('white', 'matte') }),
          preset('Schwarz · Olive (rb.crafts)', ['#141414', '#dd9540', '#c9a65a'], BLACK, 'olive', { [S('metal.frame')]: m('black', 'matte'), [S('metal.group')]: m('gold', 'satin'), [S('wood.sides')]: w('olive') }),
        ]
      : [
          preset('Edelstahl · Schwarz (Werk)', ['#c6c2c3', '#111111', '#f2f2ee'], STEEL, 'black'),
          preset('Weiß · Zebrano (Werk)', ['#efefea', '#cfb07a', '#e4e6e9'], WHITE, 'zebrano', { [S('metal.frame')]: m('steel', 'satin') }),
          preset('Schwarz · Walnuss (rb.crafts)', ['#141414', '#644434', '#e4e6e9'], BLACK, 'walnut', { [S('metal.balls')]: m('black', 'gloss'), [S('metal.frame')]: m('black', 'matte') }),
          preset('Edelstahl · Olive (rb.crafts)', ['#c6c2c3', '#dd9540', '#e4e6e9'], STEEL, 'olive'),
        ];
  registerDevice({
    id: ID,
    kind: 'machine',
    brand: 'Lelit',
    name: V.name,
    full: V.full,
    file: V.file,
    code: V.code,
    dims: V.dims,
    rootZ: 0.055,
    shadow: { w: (V.hw * 2 + 140) * 0.001, d: 0.62, z: -0.06 },
    frame: { target: [0, 0.18, 0], scale: 0.92 },
    slots: SLOTS,
    categories: CATEGORIES,
    presets: PRESETS,
    options: OPTIONS,
    optionsTitle: 'Ausstattung',
    build: makeBuilder(V),
    UI: DeviceUI,
    roles: {
      body: [S('body.main')],
      accent: [S('metal.group'), S('metal.front'), S('metal.tray')],
      wood: [S('wood.knobs'), S('wood.handle'), S('wood.paddle'), S('wood.feet')],
      screws: [],
      logo: [],
    },
    stageLabels: {
      'sk-frame': ['Rahmen', ''],
      'sk-boiler': [ID === 'bianca' ? 'Kaffee- und Dampfkessel' : 'Kessel 1,8 l mit Wärmetauscher', 'Edelstahl'],
      'sk-pump': [ID === 'bianca' ? 'Rotationspumpe & Steuerung' : 'Pumpe & Steuerung', ''],
      'sk-pipes': ['Leitungen', 'Kupfer'],
      base: ['Unterbau', S('body.main')],
      feet: ['Füße', S('wood.feet')],
      front: ['Frontblech', S('metal.front')],
      group: [V.group === 'e61' ? 'E61-Brühgruppe mit Flow-Control' : 'LELIT58-Brühgruppe', S('metal.group')],
      valves: ['Ventile', S('metal.group')],
      wands: ['Dampf- und Heißwasserlanze', S('metal.group')],
      controls: [V.lcc ? 'Manometer, LCC-Display & Schalter' : 'Manometer, Schalter & Pagaia', S('metal.gauge')],
      sides: ['Gehäuse', S('body.main')],
      panels: ['Holz-Seitenteile', S('wood.sides')],
      top: ['Tassenablage', S('metal.tray')],
      tank: ['Wassertank', S('body.main')],
      drip: ['Abtropfschale', S('metal.tray')],
      knobs: ['Drehknöpfe', S('wood.knobs')],
      portafilter: ['Siebträger 58 mm', S('wood.handle')],
      logo: ['Schriftzug', ''],
    },
  });
}

define(MODELS.bianca);
define(MODELS.marax3);
