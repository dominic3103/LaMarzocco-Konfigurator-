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
import { boxProjectUV, rbox, extrudeZ, woodBoxUV, woodCylUV } from '../model.js';
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
    gz: 54, // Achse der Brühgruppe
    group: 'e61',
    portaH: 236,
    handleEnd: 280,
    spoutH: 130,
    knobs: { x: 114, h: 340, z: 80, shape: 'star' },
    steam: { side: -1, tip: [-157, 140, 92] },
    water: { tip: [159, 180, 92] },
    lever: true,
    gauge: { x: 73, h: 165, r: 32, dual: true },
    groupGauge: { h: 331, r: 17 },
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
    water: { tip: [72, 188, 66], grip: true, short: true },
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
      const bw = V.id === 'bianca' ? 34 : 46;
      const badge = B.plain(new THREE.PlaneGeometry(bw, bw * 0.3125), new THREE.MeshStandardMaterial({ map: makeBadge(V.id === 'bianca' ? 'lelit' : 'marax3'), transparent: true, roughness: 0.4, metalness: 0.1 }));
      if (V.id === 'bianca') badge.position.set(-50, 116, 0.6);
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
      // Halsstück von der Front zur Gruppe
      const neck = latheZ([[0, 0], [22, 0], [22, GZ], [0, GZ]], 40);
      B.add(neck, groupMat, S('metal.group')).position.set(0, V.portaH + 44, 0);
      if (V.group === 'e61') {
        // Glocke, Kamin mit Manometer, Abdeckung
        B.add(latheY([[0, V.portaH - 3], [37, V.portaH - 3], [40, V.portaH], [41, V.portaH + 6], [41, V.portaH + 30], [38, V.portaH + 34], [26, V.portaH + 38], [0, V.portaH + 38]], 64), groupMat, S('metal.group')).position.z = GZ;
        // Verteilerkasten (Front: 94 mm breit)
        B.add(boxProjectUV(rbox(94, 32, 54, 5, 3)), groupMat, S('metal.group')).position.set(0, 262, GZ - 4);
        // Kamin
        B.add(latheY([[0, 278], [19, 278], [19, 342], [21, 346], [21, 352], [0, 352]], 40), groupMat, S('metal.group')).position.z = GZ - 8;
        // Haube (trapezförmige Abdeckung über der Gruppe)
        const hood = new THREE.Shape();
        hood.moveTo(-40, 0);
        hood.lineTo(40, 0);
        hood.lineTo(24, 64);
        hood.lineTo(-24, 64);
        hood.closePath();
        const hg = B.add(boxProjectUV(plateZ(hood, -14, 14, 2)), groupMat, S('metal.group'));
        hg.position.set(0, 290, GZ - 30);
        // Kappe
        B.add(latheY([[0, 352], [16, 352], [17, 360], [14, 366], [0, 368]], 32), groupMat, S('metal.group')).position.z = GZ - 8;
      } else {
        // LELIT58: hohe, abgerundete Haube über einem breiten Kragen
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
      // Gruppenmanometer (Bianca, Kaffeedruck)
      if (V.groupGauge) {
        const gg = buildGauge(B, { slot: S('metal.gauge'), x: 0, y: V.groupGauge.h, z: GZ + 12, R: V.groupGauge.r, bezel: 3, spec: { id: 'lelit-group', max: 16, step: 1, label: 4, value: 9, unit: 'bar', zone: [8, 10] } });
        V._groupGauge = gg;
      }
      // Flow-Control-Paddel (Bianca) auf der Gruppe
      if (V.paddle) {
        const pg = new THREE.Group();
        pg.position.set(14, 372, GZ - 10);
        pg.rotation.z = -0.32;
        root.add(pg);
        const head = woodBoxUV(rbox(64, 26, 30, 8, 3), 0, [0.12, 0.4]);
        B.add(head, mat('wood.paddle'), S('wood.paddle'), pg).position.set(18, 0, 0);
        B.add(new THREE.CylinderGeometry(5, 5, 20, 16).rotateZ(Math.PI / 2), groupMat, S('metal.group'), pg).position.set(-14, 0, 0);
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
      B.add(latheY([[0, -26], [8, -26], [9, -20], [9, 0], [0, 0]], 24), groupMat, S('metal.group')).position.set(sx * K.x, K.h, K.z - 22);
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
          const cap = B.add(latheZ([[0, 0], [11, 0], [11, 1.2], [10, 2.2], [0, 2.4]], 32), groupMat, S('metal.group'));
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
      const st = V.steam;
      const x0 = st.side * K.x;
      const [tx, th, tzz] = st.tip;
      const pts = [
        [x0, K.h - 26, K.z - 22],
        [x0, K.h - 50, K.z - 20],
        [x0 + st.side * 6, K.h - 80, K.z - 12],
        [(x0 + tx) / 2, (K.h - 80 + th) / 2 + 20, (K.z + tzz) / 2],
        [tx, th + 30, tzz],
        [tx, th + 6, tzz],
      ];
      B.add(tubeAlong(pts, 4.8, 120, 20), groupMat, S('metal.group'));
      B.add(latheY([[0, 0], [5.6, 0], [7, 4], [7, 12], [0, 12]], 20), groupMat, S('metal.group')).position.set(tx, th - 6, tzz);
      // Heißwasser aus dem rechten Ventil: Bianca lange Lanze nach außen, MaraX3 kurzer Auslauf mit Holzgriff
      const w = V.water;
      const xw = K.x;
      const [wx, wh, wz] = w.tip;
      const wpts = w.short
        ? [
            [xw, K.h - 26, K.z - 22],
            [xw - 4, K.h - 50, K.z - 18],
            [wx, wh + 40, wz - 4],
            [wx, wh + 6, wz],
          ]
        : [
            [xw, K.h - 26, K.z - 22],
            [xw, K.h - 50, K.z - 20],
            [xw + 6, K.h - 80, K.z - 12],
            [(xw + wx) / 2, (K.h - 80 + wh) / 2 + 20, (K.z + wz) / 2],
            [wx, wh + 30, wz],
            [wx, wh + 6, wz],
          ];
      B.add(tubeAlong(wpts, w.short ? 4.4 : 4.6, 100, 18), groupMat, S('metal.group'));
      B.add(latheY([[0, 0], [5, 0], [6.4, 4], [6.4, 10], [0, 10]], 20), groupMat, S('metal.group')).position.set(wx, wh - 4, wz);
      if (w.grip) {
        const grip = woodCylUV(latheY([[0, 0], [7, 0], [8, 6], [8, 34], [7, 40], [0, 40]], 24).rotateX(-Math.PI / 2), [0.3, 0.1]).rotateX(Math.PI / 2);
        B.add(grip, mat('wood.handle'), S('wood.handle')).position.set(wx, wh + 8, wz - 1);
      }
    }
    // E61-Hebel rechts an der Gruppe (Bianca)
    if (V.lever) {
      B.add(boxProjectUV(rbox(26, 22, 22, 3, 2)), groupMat, S('metal.group')).position.set(58, 262, GZ - 4);
      B.add(tubeAlong([[62, 256, GZ + 6], [64, 230, GZ + 10], [66, 205, GZ + 12]], 4, 30, 14), groupMat, S('metal.group'));
      const ball = new THREE.SphereGeometry(8, 24, 16);
      ball.scale(1, 1.3, 1);
      B.add(woodCylUV(ball, [0.2, 0.3]), mat('wood.paddle'), S('wood.paddle')).position.set(66, 200, GZ + 12);
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
      B.add(latheY([[0, V.spoutH + 14], [8, V.spoutH + 14], [11, V.spoutH + 22], [15, H0 - 32], [0, H0 - 32]], 24), groupMat, S('metal.group')).position.z = GZ;
      for (const sx of [-1, 1]) {
        const s = B.add(latheY([[0, 0], [3.6, 0], [4.4, 7], [4.4, 14], [0, 14]], 16), groupMat, S('metal.group'));
        s.position.set(sx * 8, V.spoutH, GZ);
        s.rotation.z = sx * 0.3;
      }
      const pf = new THREE.Group();
      pf.position.set(0, H0 - 6, GZ + 36);
      pf.rotation.x = -0.07; // Griff leicht ansteigend wie in den Ansichten
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
