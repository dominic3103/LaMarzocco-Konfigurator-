// ---------------------------------------------------------------------------
// Bentwood H75 (Grind-by-Weight-Espressomühle, 75 mm Blind Burrs)
//
// Maße in Millimeter. Grundlage: Herstellerangaben (bentwoodcoffee.ch:
// 170 × 302 × 444 mm mit 600-g-Trichter, 13,5 kg, 2,4"-Saphirglasdisplay,
// verstellbarer Siebträgerhalter) und die Werksfotos der Farbvarianten
// (Schwarz/Walnuss, Schwarz, Weiß). Eine bemaßte Zeichnung veröffentlicht
// Bentwood nicht; Gehäuse (170 × 200 × 262 mm), Display, Auslauf, Halter und
// Trichter sind über die Herstellermaße aus den Fotos abgeleitet.
//
// Koordinaten: X = Breite, Y = Höhe (0 = Stellfläche), Z = Tiefe (+Z = Front).
// Z = 0 ist die Mitte des Gehäuses (Trichterachse).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, rbox, woodBoxUV } from '../model.js';
import { makeCanvas } from '../noise.js';
import { registerDevice } from '../devices.js';
import { DeviceUI } from '../device-ui.js';
import { createBuilder, filletShape, plateZ, plateY, latheY, latheZ, tubeAlong } from '../parts.js';

const ID = 'bentwood';
const S = (k) => `${ID}:${k}`;
const HW = 85; // halbe Breite inkl. Seitenteile
const HD = 100; // halbe Gehäusetiefe
const H0 = 8; // Unterkante Gehäuse (Füße)
const H1 = 268; // Oberkante Gehäuse
const SIDE = 11; // Stärke der Seitenteile
const FX = -6; // Mitte von Display, Auslauf und Halter (leicht links)

const STAGES = [
  { id: 'sk-frame', src: 'skeleton', from: [0, 1, 0], dist: 400, gap: 0, dur: 0.7, drop: true },
  { id: 'sk-scale', src: 'skeleton', from: [0, 0, 1], dist: 500, gap: 0.35, dur: 0.6 },
  { id: 'sk-motor', src: 'skeleton', from: [0, 1, 0], dist: 700, gap: 0.45, dur: 0.85, heavy: true, spin: [[0, 0, 1], Math.PI * 2] },
  { id: 'sk-burrs', src: 'skeleton', from: [0, 0, 1], dist: 600, gap: 0.4, dur: 0.8, stagger: 0.2, spin: [[0, 0, 1], Math.PI * 3] },
  { id: 'sk-pcb', src: 'skeleton', from: [0, 0, -1], dist: 600, gap: 0.35, dur: 0.6 },
  { id: 'body', from: [0, -1, 0.3], dist: 700, gap: 0.45, after: true, dur: 0.9, heavy: true },
  { id: 'sides', from: [1, 0, 0], dist: 700, gap: 0.4, dur: 0.75, perSide: true },
  { id: 'display', from: [0, 0, 1], dist: 600, gap: 0.35, dur: 0.6 },
  { id: 'spout', from: [0, -0.3, 1], dist: 600, gap: 0.3, dur: 0.6 },
  { id: 'fork', from: [0, -0.2, 1], dist: 700, gap: 0.35, dur: 0.7 },
  { id: 'tray', from: [0, -0.2, 1], dist: 700, gap: 0.3, dur: 0.6 },
  { id: 'collar', from: [0, 1, 0], dist: 500, gap: 0.35, dur: 0.6, spin: [[0, 1, 0], Math.PI] },
  { id: 'hopper', from: [0, 1, 0], dist: 700, gap: 0.4, dur: 0.8 },
  { id: 'lid', from: [0, 1, 0], dist: 500, gap: 0.35, dur: 0.6, drop: true },
  { id: 'logo', pop: true, gap: 0.35, dur: 0.5 },
];
const isInner = (id) => id.startsWith('sk-');

/** Display: Gewicht, Rezepte, "INSERT" */
function makeDisplay() {
  const c = makeCanvas(400, 300);
  const g = c.getContext('2d');
  g.fillStyle = '#050608';
  g.fillRect(0, 0, 400, 300);
  g.strokeStyle = '#7ec8ff';
  g.fillStyle = '#7ec8ff';
  g.lineWidth = 4;
  for (const [x, y, t] of [
    [60, 70, ''],
    [60, 150, '2'],
    [60, 225, ''],
    [340, 70, ''],
    [340, 150, ''],
    [340, 225, ''],
  ]) {
    g.beginPath();
    g.arc(x, y, 18, 0, Math.PI * 2);
    g.stroke();
    if (t) {
      g.font = '700 22px Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(t, x, y + 1);
    }
  }
  g.fillStyle = '#f4f4f4';
  g.font = '300 92px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillText('9.9', 190, 180);
  g.font = '400 40px Arial, sans-serif';
  g.fillText('g', 275, 180);
  g.font = '700 26px Arial, sans-serif';
  g.fillStyle = '#d8d8d8';
  g.fillText('INSERT', 200, 250);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Bentwood-Logo: gelbes B auf schwarzem Kreis */
function makeBadge() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = '#0a0a0a';
  g.beginPath();
  g.arc(128, 128, 124, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#f2e600';
  g.lineWidth = 14;
  g.beginPath();
  g.moveTo(96, 62);
  g.lineTo(150, 62);
  g.arc(150, 92, 30, -Math.PI / 2, Math.PI / 2);
  g.lineTo(96, 122);
  g.moveTo(96, 122);
  g.lineTo(156, 122);
  g.arc(156, 158, 36, -Math.PI / 2, Math.PI / 2);
  g.lineTo(84, 194);
  g.moveTo(96, 62);
  g.lineTo(96, 170);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildBentwood(mm) {
  const B = createBuilder('BentwoodH75', mm);
  const { root, F } = B;
  const mat = (k, extra) => mm.get(S(k), extra);
  const bodyMat = mat('body.main');

  // =========================================================================
  // Gehäuse: Kasten mit Front, Füße
  // =========================================================================
  B.stage('body');
  {
    const core = filletShape([[-HW + SIDE, -HD], [HW - SIDE, -HD], [HW - SIDE, HD], [-HW + SIDE, HD]], [2, 2, 2.5, 2.5], 3);
    B.add(boxProjectUV(plateY(core, H0, H1 - H0, 1.2)), bodyMat, S('body.main'));
    for (const [x, z] of [
      [-60, -80],
      [60, -80],
      [-60, 80],
      [60, 80],
    ]) B.plain(new THREE.CylinderGeometry(9, 10, H0, 20), F.rubber).position.set(x, H0 / 2, z);
    // Aussparung für den Auslauf
    const rec = B.plain(rbox(40, 72, 4, 8, 3), F.darkGap);
    rec.position.set(FX, 160, HD - 1.4);
  }
  // Seitenteile: Holz oder in Gehäusefarbe
  B.stage('sides');
  const woodSides = [];
  const stdSides = [];
  {
    const h = H1 - H0;
    const gw = woodBoxUV(rbox(SIDE, h, 2 * HD, 1.6, 2), 1, [0.17, 0.29]);
    const gs = boxProjectUV(rbox(SIDE, h, 2 * HD, 1.6, 2));
    for (const sx of [-1, 1]) {
      const w = B.add(gw, mat('wood.sides'), S('wood.sides'));
      w.position.set(sx * (HW - SIDE / 2), H0 + h / 2, 0);
      woodSides.push(w);
      const s = B.add(gs, bodyMat, S('body.main'));
      s.position.copy(w.position);
      stdSides.push(s);
    }
  }

  // =========================================================================
  // Display (geneigt, Saphirglas)
  // =========================================================================
  B.stage('display');
  {
    const g = new THREE.Group();
    g.position.set(FX, 222, HD + 6);
    g.rotation.x = -0.21;
    root.add(g);
    const frame = filletShape([[-45, -29], [45, -29], [45, 29], [-45, 29]], 5, 4);
    B.add(boxProjectUV(plateZ(frame, -8, 10, 1.4)), mat('metal.display'), S('metal.display'), g);
    const glass = B.plain(rbox(82, 51, 1.6, 3, 2), new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, clearcoat: 1 }), g);
    glass.position.z = 2.2;
    const scr = B.plain(new THREE.PlaneGeometry(56, 42), new THREE.MeshBasicMaterial({ map: makeDisplay(), toneMapped: false }), g);
    scr.position.z = 3.05;
    scr.castShadow = false;
  }

  // =========================================================================
  // Auslauf (verchromt, schräg angeschnitten)
  // =========================================================================
  B.stage('spout');
  {
    const g = new THREE.Group();
    g.position.set(FX, 178, HD + 2);
    g.rotation.x = 0.55;
    root.add(g);
    const tube = latheY([[13, -48], [14.5, -48], [14.5, 0], [17, 0], [17, 6], [0.01, 6]], 40);
    tube.rotateX(Math.PI);
    B.add(tube, mat('metal.spout'), S('metal.spout'), g).position.set(0, 0, 12);
    B.add(rbox(30, 18, 14, 4, 2), mat('metal.spout'), S('metal.spout'), g).position.set(0, 0, 4);
  }

  // =========================================================================
  // Verstellbarer Siebträgerhalter
  // =========================================================================
  B.stage('fork');
  {
    const fm = mat('metal.fork');
    // Halteplatte an der Front
    B.add(rbox(104, 14, 6, 2, 2), fm, S('metal.fork')).position.set(FX, 112, HD + 3);
    // Bügel (U, vorne offen) mit schrägen Innenflanken
    const pts = [];
    for (let k = 0; k <= 32; k++) {
      const a = Math.PI + (k / 32) * Math.PI;
      pts.push([FX + Math.cos(a) * 46, 114, HD + 46 + Math.sin(a) * 38]);
    }
    pts.unshift([FX - 46, 114, HD + 74]);
    pts.push([FX + 46, 114, HD + 74]);
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const prof = new THREE.Shape();
    prof.moveTo(-4, -8);
    prof.lineTo(4, -8);
    prof.lineTo(5, 6);
    prof.lineTo(-1, 8);
    prof.lineTo(-4, 6);
    prof.closePath();
    const ring = new THREE.ExtrudeGeometry(prof, { steps: 80, bevelEnabled: false, extrudePath: curve });
    B.add(ring, fm, S('metal.fork'));
    // senkrechte Streben und untere Auflagen
    for (const sx of [-1, 1]) {
      const x = FX + sx * 46;
      B.add(rbox(5, 64, 8, 1.5, 2), fm, S('metal.fork')).position.set(x, 80, HD + 60);
      const arm = B.add(rbox(14, 4, 46, 2, 2), fm, S('metal.fork'));
      arm.position.set(x - sx * 14, 50, HD + 80);
      arm.rotation.y = sx * 0.5;
      B.plain(rbox(16, 3, 26, 1.5, 2), F.rubber).position.set(x - sx * 22, 52.6, HD + 96);
    }
  }

  // =========================================================================
  // Abstellfläche vorn: Holzplatte oder Platte in Gehäusefarbe
  // =========================================================================
  B.stage('tray');
  const woodTray = [];
  const stdTray = [];
  {
    const sh = filletShape([[-76, HD - 30], [76, HD - 30], [76, HD + 102], [-76, HD + 102]], [0, 0, 4, 4], 3);
    const gw = woodBoxUV(plateY(sh, 4, 14, 1.2), 2, [0.4, 0.1]);
    const w = B.add(gw, mat('wood.tray'), S('wood.tray'));
    woodTray.push(w);
    const s = B.add(boxProjectUV(plateY(sh, 4, 14, 1.2)), bodyMat, S('body.main'));
    stdTray.push(s);
    for (const x of [-60, 60]) B.plain(new THREE.CylinderGeometry(6, 6, 4, 16), F.rubber).position.set(x, 2, HD + 90);
  }

  // =========================================================================
  // Trichteraufnahme mit Schieber, Trichter 600 g, Deckel
  // =========================================================================
  B.stage('collar');
  {
    const rm = mat('metal.ring');
    B.add(latheY([[0, H1], [70, H1], [74, H1 + 3], [74, H1 + 20], [71, H1 + 24], [44, H1 + 26], [36, H1 + 34], [33, H1 + 36], [0, H1 + 36]], 72), rm, S('metal.ring'));
    B.add(latheY([[0, H1 + 36], [31, H1 + 36], [31, H1 + 40], [0, H1 + 40]], 48), F.chrome);
    const lever = B.plain(rbox(46, 2.5, 12, 1, 2), F.chrome);
    lever.position.set(52, H1 + 38, 0);
    const knob = B.plain(latheZ([[0, 0], [4, 0], [4, 3], [0, 3.5]], 20), F.chrome);
    knob.position.set(0, H1 + 12, 74);
  }
  B.stage('hopper');
  {
    const prof = [
      [30, H1 + 40],
      [33, H1 + 46],
      [38, H1 + 54],
      [50, H1 + 66],
      [63, H1 + 82],
      [71, H1 + 100],
      [74.5, H1 + 120],
      [75, H1 + 140],
      [74.5, H1 + 160],
      [74, H1 + 164],
    ];
    const clear = new THREE.MeshPhysicalMaterial({ color: 0xd8dde0, roughness: 0.05, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
    const h = B.plain(latheY(prof, 80), clear);
    h.castShadow = false;
    h.renderOrder = 2;
  }
  B.stage('lid');
  {
    B.add(latheY([[0, H1 + 163], [76, H1 + 163], [76.5, H1 + 170], [75, H1 + 174], [60, H1 + 175.5], [0, H1 + 176]], 80), mat('metal.ring'), S('metal.ring'));
  }
  B.stage('logo');
  {
    const b = B.plain(new THREE.CircleGeometry(13, 40), new THREE.MeshStandardMaterial({ map: makeBadge(), transparent: true, roughness: 0.4 }));
    b.position.set(74.2, H1 + 128, 0);
    b.rotation.y = Math.PI / 2;
    b.castShadow = false;
  }

  // Innenleben: Rahmen, Wägezelle, Motor mit waagerechten 75-mm-Mahlscheiben, Steuerung
  {
    B.sk('sk-frame');
    B.skBox(140, 4, 190, F.frame, 0, 14, 0, 1);
    B.sk('sk-scale');
    B.skBox(20, 16, 70, F.steel, FX, 90, 55, 1);
    B.sk('sk-motor');
    B.skCyl(48, 120, F.motor, 0, 200, -30, 'z', 48);
    B.sk('sk-burrs');
    B.skCyl(37.5, 8, F.steel, 0, 200, 40, 'z', 48);
    B.skCyl(37.5, 8, F.steel, 0, 200, 50, 'z', 48);
    B.sk('sk-pcb');
    B.skBox(90, 60, 2, F.pcb, FX, 222, 88, 1);
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
      const ws = config.slots[S('wood.sides')]?.id !== 'none';
      for (const m of woodSides) m.visible = ws;
      for (const m of stdSides) m.visible = !ws;
      const wt = config.slots[S('wood.tray')]?.id !== 'none';
      for (const m of woodTray) m.visible = wt;
      for (const m of stdTray) m.visible = !wt;
    },
  };
}

const CATEGORIES = {
  [S('body')]: {
    title: 'Gehäuse',
    allLabel: 'Komplett',
    slots: [{ key: S('body.main'), label: 'Gehäuse' }],
  },
  [S('wood')]: {
    title: 'Holz',
    allLabel: 'Alle',
    slots: [
      { key: S('wood.sides'), label: 'Holz-Seitenteile', panel: true },
      { key: S('wood.tray'), label: 'Holz-Abstellfläche', panel: true },
    ],
  },
  [S('metal')]: {
    title: 'Akzente',
    allLabel: 'Alle',
    slots: [
      { key: S('metal.fork'), label: 'Siebträgerhalter' },
      { key: S('metal.spout'), label: 'Auslauf' },
      { key: S('metal.display'), label: 'Displayrahmen' },
      { key: S('metal.ring'), label: 'Trichteraufnahme & Deckel' },
    ],
  },
};
const SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));
const BLACK = { id: 'RAL9005', finish: 'matte' };
const WHITE = { id: 'RAL9016', finish: 'matte' };
const w = (id) => ({ id, finish: 'oiled' });
const m = (id, finish = 'gloss') => ({ id, finish });
const preset = (name, swatches, body, sides, tray, accents = {}) => ({
  name,
  swatches,
  config: {
    slots: {
      [S('body.main')]: body,
      [S('wood.sides')]: w(sides),
      [S('wood.tray')]: w(tray),
      [S('metal.fork')]: m('chrome'),
      [S('metal.spout')]: m('chrome'),
      [S('metal.display')]: m('black', 'matte'),
      [S('metal.ring')]: m('black', 'matte'),
      ...accents,
    },
    opts: {},
  },
});
const PRESETS = [
  preset('Schwarz · Walnuss (Werk)', ['#141414', '#644434', '#e4e6e9'], BLACK, 'walnut', 'walnut'),
  preset('Weiß · Eiche (rb.crafts)', ['#efefea', '#d99c52', '#e4e6e9'], WHITE, 'oak', 'oak', { [S('metal.display')]: m('white', 'matte'), [S('metal.ring')]: m('white', 'matte') }),
  preset('Schwarz · Olive (rb.crafts)', ['#141414', '#dd9540', '#e4e6e9'], BLACK, 'olive', 'olive'),
  preset('Schwarz (Werk)', ['#141414', '#0f0f0f', '#e4e6e9'], BLACK, 'none', 'none'),
  preset('Weiß (Werk)', ['#efefea', '#f4f4f0', '#141414'], WHITE, 'none', 'none', { [S('metal.display')]: m('white', 'matte'), [S('metal.ring')]: m('white', 'matte') }),
];

registerDevice({
  id: ID,
  kind: 'grinder',
  brand: 'Bentwood',
  name: 'H75',
  full: 'Bentwood H75',
  file: 'Bentwood-H75',
  code: 'H75',
  dims: { w: 170, d: 302, h: 444 },
  rootZ: -0.05,
  shadow: { w: 0.3, d: 0.42, z: 0.05 },
  frame: { target: [0, 0.22, 0], scale: 1.0 },
  slots: SLOTS,
  categories: CATEGORIES,
  presets: PRESETS,
  build: (mm) => buildBentwood(mm),
  UI: DeviceUI,
  roles: {
    body: [S('body.main')],
    accent: [S('metal.fork'), S('metal.spout')],
    wood: [S('wood.sides'), S('wood.tray')],
    screws: [],
    logo: [],
  },
  stageLabels: {
    'sk-frame': ['Rahmen', ''],
    'sk-scale': ['Wägezelle', ''],
    'sk-motor': ['Motor', ''],
    'sk-burrs': ['Blind Burrs 75 mm', 'Stahl'],
    'sk-pcb': ['Steuerung & Display', 'Elektronik'],
    body: ['Gehäuse', S('body.main')],
    sides: ['Seitenteile', S('wood.sides')],
    display: ['Display', S('metal.display')],
    spout: ['Auslauf', S('metal.spout')],
    fork: ['Siebträgerhalter', S('metal.fork')],
    tray: ['Abstellfläche', S('wood.tray')],
    collar: ['Trichteraufnahme', S('metal.ring')],
    hopper: ['Trichter 600 g', 'Kunststoff'],
    lid: ['Deckel', S('metal.ring')],
    logo: ['Logo', ''],
  },
});
