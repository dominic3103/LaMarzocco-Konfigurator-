// ---------------------------------------------------------------------------
// Option-O Lagom P80 (Single-Dose-Mühle, 80 mm Mizen-Flachmahlscheiben)
//
// Maße in Millimeter. Grundlage: Herstellerangaben (option-o.com und
// Sicherheitshandbuch: 24 × 14 × 38 cm (T × B × H), 8,1 kg, Trichter 45 g),
// die nahezu orthografische Seitenansicht der Werksfotos (DSCF0049; Maßstab
// 3,31 px/mm, Höhe 380 und Plattenlänge 236 mm passen zu den Herstellermaßen)
// sowie die Strichzeichnungen der Kurzanleitung (Seiten-, Detailansichten).
// Aus der Seitenansicht: Säule Ø 114 mm, 20° nach vorn geneigt, Oberteil
// 41 mm, Trichter Ø 80 × 56 mm mit Skala, Auslauf Ø 28 mm bis 172 mm Höhe,
// Gabel 106–149 mm, Tasten Auto/Manuell Ø 21 mm auf der rechten Seite,
// Drehzahlknopf links.
//
// Koordinaten: X = Breite, Y = Höhe (0 = Stellfläche), Z = Tiefe (+Z = Front).
// Intern u = Abstand von der Vorderkante der Bodenplatte: z = 120 − u.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, woodBoxUV } from '../model.js';
import { makeCanvas } from '../noise.js';
import { registerDevice } from '../devices.js';
import { DeviceUI } from '../device-ui.js';
import { createBuilder, filletShape, plateY, latheY, latheZ } from '../parts.js';

const ID = 'lagom';
const S = (k) => `${ID}:${k}`;
const zOf = (u) => 120 - u;
const PH = 10; // Plattenhöhe
const TILT = (20 * Math.PI) / 180;
const R = 57; // Säulenradius
const B0 = new THREE.Vector3(0, PH, zOf(174.3)); // Achse auf der Plattenoberseite
const AX = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT));
const E2 = new THREE.Vector3(0, -Math.sin(TILT), Math.cos(TILT)); // senkrecht zur Achse, nach vorn
const L_TOP = 322.8; // Oberkante Säule entlang der Achse
const L_SEAM = L_TOP - 41;
const at = (t) => B0.clone().addScaledVector(AX, t);

const STAGES = [
  { id: 'sk-motor', src: 'skeleton', from: [0, 1, 0], dist: 600, gap: 0, dur: 0.8, heavy: true, spin: [[0, 1, 0], Math.PI * 2] },
  { id: 'sk-burrs', src: 'skeleton', from: [0, 1, 0], dist: 600, gap: 0.4, dur: 0.8, stagger: 0.2, spin: [[0, 1, 0], Math.PI * 3] },
  { id: 'sk-pcb', src: 'skeleton', from: [0, 0, -1], dist: 500, gap: 0.35, dur: 0.6 },
  { id: 'base', from: [0, -1, 0.3], dist: 600, gap: 0.45, after: true, dur: 0.8, heavy: true },
  { id: 'column', from: [0, 1, -0.4], dist: 900, gap: 0.4, dur: 0.95, heavy: true },
  { id: 'top', from: [0, 1, 0], dist: 600, gap: 0.35, dur: 0.7 },
  { id: 'funnel', from: [0, 1, 0], dist: 600, gap: 0.35, dur: 0.7, spin: [[0, 1, 0], Math.PI] },
  { id: 'chute', from: [0, -0.3, 1], dist: 500, gap: 0.3, dur: 0.5 },
  { id: 'fork', from: [0, -0.2, 1], dist: 700, gap: 0.35, dur: 0.7 },
  { id: 'controls', pop: true, gap: 0.3, dur: 0.35, stagger: 0.1 },
  { id: 'cable', grow: false, from: [0, 0, -1], dist: 400, gap: 0.3, dur: 0.5 },
];
const isInner = (id) => id.startsWith('sk-');

/** Mahlgradskala auf dem Trichter (Alpha-Maske, U einmal herum) */
function makeScale() {
  const W = 2048;
  const H = 96;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  for (let i = 0; i <= 160; i++) {
    const x = (i / 160) * W * 0.62 + W * 0.19;
    const big = i % 10 === 0;
    const mid = i % 5 === 0;
    g.fillRect(x - 2, H - (big ? 46 : mid ? 34 : 24), 4, big ? 46 : mid ? 34 : 24);
    if (big) {
      g.font = '600 30px Arial, sans-serif';
      g.textAlign = 'center';
      g.fillText(String((i / 10) % 10), x, 30);
    }
  }
  return new THREE.CanvasTexture(c);
}

/** Säule: geneigter Zylinder, unten waagerecht auf der Platte abgeschnitten */
function columnGeometry(tEnd, N = 96) {
  const pos = [];
  const idx = [];
  const rows = 4;
  for (let r = 0; r <= rows; r++) {
    for (let k = 0; k < N; k++) {
      const th = (k / N) * Math.PI * 2;
      const t0 = R * Math.sin(th) * Math.tan(TILT); // Schnitt mit y = PH
      const t = t0 + ((tEnd - t0) * r) / rows;
      const p = B0.clone().addScaledVector(AX, t).addScaledVector(new THREE.Vector3(1, 0, 0), R * Math.cos(th)).addScaledVector(E2, R * Math.sin(th));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < N; k++) {
      const a = r * N + k;
      const b = r * N + ((k + 1) % N);
      const c = (r + 1) * N + ((k + 1) % N);
      const d = (r + 1) * N + k;
      idx.push(a, c, b, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Teil entlang der Säulenachse: Lathe-Profil [[r, t]] in Achsrichtung */
function onAxis(B, geom, mat, slot) {
  const m = slot ? B.add(geom, mat, slot) : B.plain(geom, mat);
  m.position.copy(B0);
  m.rotation.x = TILT;
  return m;
}
/** Punkt auf der Säulenoberfläche (Winkel th: 0 = +X, π/2 = vorn) in Höhe h */
function surfaceAt(th, h, r = R) {
  // Achspunkt in Höhe h, dann radial (näherungsweise; die Säule ist nur 20° geneigt)
  const t = (h - PH - r * Math.sin(th) * E2.y) / AX.y;
  const n = new THREE.Vector3(Math.cos(th), 0, 0).addScaledVector(E2, Math.sin(th));
  return { p: at(t).addScaledVector(n, r), n };
}

function buildLagom(mm) {
  const B = createBuilder('LagomP80', mm);
  const { root, F } = B;
  const mat = (k, extra) => mm.get(S(k), extra);
  const bodyMat = mat('body.main');
  const topMat = mat('metal.top');
  const forkMat = mat('metal.fork');

  // =========================================================================
  // Bodenplatte (Aluminium oder Holz) mit Gummifüßen
  // =========================================================================
  B.stage('base');
  const plateStd = [];
  const plateWood = [];
  {
    const sh = filletShape([[-70, -120], [70, -120], [70, 120], [-70, 120]], 58, 10);
    const g = plateY(sh, 1.2, PH - 1.2, 1.4, 48);
    const s = B.add(boxProjectUV(g.clone()), bodyMat, S('body.main'));
    plateStd.push(s);
    const w = B.add(woodBoxUV(g.clone(), 2, [0.3, 0.1]), mat('wood.plate'), S('wood.plate'));
    plateWood.push(w);
    for (const [x, z] of [
      [-46, 86],
      [46, 86],
      [-46, -88],
      [46, -88],
    ]) B.plain(new THREE.CylinderGeometry(7, 7, 1.2, 16), F.rubber).position.set(x, 0.6, z);
  }

  // =========================================================================
  // Säule (Motorgehäuse) und Oberteil mit Mahlkammer
  // =========================================================================
  B.stage('column');
  {
    B.add(boxProjectUV(columnGeometry(L_SEAM - 0.7)), bodyMat, S('body.main'));
    onAxis(B, latheY([[R - 0.8, L_SEAM - 1], [R - 0.8, L_SEAM + 1]], 96), F.darkGap);
  }
  B.stage('top');
  {
    onAxis(B, latheY([[R, L_SEAM + 0.7], [R, L_TOP - 1.6], [R - 0.5, L_TOP - 0.5], [R - 1.8, L_TOP], [41.5, L_TOP], [41, L_TOP - 1], [0.01, L_TOP - 1]], 96), topMat, S('metal.top'));
    // Markierung für die Skala vorn auf dem Deckel
    const mark = onAxis(B, new THREE.BoxGeometry(1.4, 0.4, 7), F.darkGap);
    mark.position.copy(at(L_TOP + 0.2)).addScaledVector(E2, 48);
  }
  // Trichter (drehbar, mit Skala)
  B.stage('funnel');
  const inkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, alphaMap: makeScale(), transparent: true, depthWrite: false });
  {
    const prof = [
      [40, L_TOP - 1],
      [40, L_TOP + 54.6],
      [39.4, L_TOP + 56],
      [37.2, L_TOP + 56],
      [36.6, L_TOP + 55],
      [36.6, L_TOP + 30],
      [30, L_TOP + 16],
      [18, L_TOP + 6],
      [11, L_TOP + 4],
    ];
    onAxis(B, latheY(prof, 96), topMat, S('metal.top'));
    // dunkler Einlauf
    onAxis(B, latheY([[11.5, L_TOP + 4.2], [6, L_TOP + 1], [0.01, L_TOP]], 32), F.darkGap);
    // Skala unten am Trichter
    const band = new THREE.CylinderGeometry(40.25, 40.25, 11, 128, 1, true);
    band.translate(0, L_TOP + 6.5, 0);
    band.rotateY(Math.PI / 2);
    const sc = onAxis(B, band, inkMat);
    sc.castShadow = false;
  }

  // =========================================================================
  // Auslauf (mit Klopfmechanismus) und Siebträgergabel
  // =========================================================================
  B.stage('chute');
  {
    const a = new THREE.Vector3(0, 252, zOf(44));
    const b = new THREE.Vector3(0, 172, zOf(31));
    const dir = b.clone().sub(a);
    const len = dir.length();
    const g = latheY([[14, 0], [14, len - 1.2], [13.2, len], [11.5, len], [11.5, len - 6], [0.01, len - 8]], 48);
    g.rotateX(Math.PI);
    g.translate(0, 0, 0);
    const m = B.add(g, forkMat, S('metal.fork'));
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
    const hole = B.plain(new THREE.CircleGeometry(11.4, 32), F.darkGap);
    hole.position.copy(b).addScaledVector(dir.clone().normalize(), -5.5);
    hole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize().negate());
  }
  B.stage('fork');
  {
    const cz = zOf(28);
    const ro = 31;
    const ri = 24.5;
    const open = (21 * Math.PI) / 180; // halbe Öffnung vorn
    // Grundriss in (x, z): Winkel ab +Z gemessen; Shape-Koordinaten (x, z)
    const arc = (r, a0, a1, n = 40) => {
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const a = a0 + ((a1 - a0) * k) / n;
        pts.push([Math.sin(a) * r, cz + Math.cos(a) * r]);
      }
      return pts;
    };
    const uShape = (r1, r2, a0, a1) => {
      const sh = new THREE.Shape();
      const outer = arc(r1, a0, a1);
      const inner = arc(r2, a1, a0);
      sh.moveTo(...outer[0]);
      for (const p of outer.slice(1)) sh.lineTo(...p);
      for (const p of inner) sh.lineTo(...p);
      sh.closePath();
      return sh;
    };
    // untere Auflage (U, vorn offen)
    B.add(boxProjectUV(plateY(uShape(ro, ri, open, Math.PI * 2 - open), 106, 8, 1.2, 64)), forkMat, S('metal.fork'));
    // mittlere Lippe (hält die Ohren des Siebträgers)
    B.add(boxProjectUV(plateY(uShape(ro - 1, ri + 1, open + 0.22, Math.PI * 2 - open - 0.22), 126, 5, 1, 64)), forkMat, S('metal.fork'));
    // hinterer Steg und obere Lippe
    B.add(boxProjectUV(plateY(uShape(ro, ro - 4, Math.PI * 0.72, Math.PI * 1.28), 106, 43, 1, 32)), forkMat, S('metal.fork'));
    B.add(boxProjectUV(plateY(uShape(ro, ri + 2, Math.PI * 0.62, Math.PI * 1.38), 143, 6, 1, 48)), forkMat, S('metal.fork'));
    // Anschläge vorn an den Armen
    for (const sx of [-1, 1]) {
      const a = sx > 0 ? open : Math.PI * 2 - open;
      const r = (ro + ri) / 2;
      const st = B.add(new THREE.CylinderGeometry(3.4, 3.4, 9, 16), forkMat, S('metal.fork'));
      st.position.set(Math.sin(a) * r, 118, cz + Math.cos(a) * r);
    }
    // Halter zur Säule
    const rod = latheZ([[0.01, 0], [8.5, 0], [8.5, 30], [0.01, 30]], 32);
    B.add(rod, forkMat, S('metal.fork')).position.set(0, 125, zOf(80));
  }

  // =========================================================================
  // Tasten (Auto, Manuell) rechts, Drehzahlknopf links, Kabel
  // =========================================================================
  B.stage('controls');
  {
    for (const [h, ring] of [
      [59.5, true],
      [33.5, false],
    ]) {
      const { p, n } = surfaceAt(0, h);
      const g = new THREE.Group();
      g.position.copy(p);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      root.add(g);
      B.add(latheZ([[0.01, -2], [10.6, -2], [10.6, 1.6], [10, 2.4], [0.01, 2.4]], 40), mat('metal.buttons'), S('metal.buttons'), g);
      B.add(latheZ([[0.01, 2.2], [8, 2.2], [8, 3], [7.4, 3.6], [0.01, 3.8]], 40), mat('metal.buttons'), S('metal.buttons'), g);
      if (ring) {
        const led = B.plain(new THREE.TorusGeometry(8.6, 0.45, 8, 40), new THREE.MeshStandardMaterial({ color: 0xdfe8ef, emissive: 0x6a8aa8, roughness: 0.3 }), g);
        led.position.z = 2.5;
      }
    }
    const { p, n } = surfaceAt(Math.PI, 46);
    const g = new THREE.Group();
    g.position.copy(p);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    root.add(g);
    B.add(latheZ([[0.01, -2], [11, -2], [11, 12], [10, 14], [0.01, 14.4]], 48), mat('metal.knob'), S('metal.knob'), g);
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      const rib = B.add(new THREE.BoxGeometry(1, 1, 10), mat('metal.knob'), S('metal.knob'), g);
      rib.position.set(Math.cos(a) * 11, Math.sin(a) * 11, 6);
      rib.rotation.z = a;
    }
  }
  B.stage('cable');
  {
    const pts = [new THREE.Vector3(18, 16, zOf(222)), new THREE.Vector3(22, 14, zOf(240)), new THREE.Vector3(30, 11.5, zOf(262)), new THREE.Vector3(36, 3, zOf(300))];
    B.plain(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 2.8, 10, false), F.blackPlastic);
  }

  // Innenleben: bürstenloser Motor (500 W), Mahlscheiben 80 mm mit Vorbrecher, Steuerung
  {
    B.sk('sk-motor');
    const mo = B.skCyl(42, 150, F.motor, 0, 0, 0, 'y', 40);
    mo.position.copy(at(110));
    mo.rotation.x = TILT;
    B.sk('sk-burrs');
    for (const t of [L_SEAM + 6, L_SEAM + 16]) {
      const bu = B.skCyl(40, 8, F.steel, 0, 0, 0, 'y', 48);
      bu.position.copy(at(t));
      bu.rotation.x = TILT;
    }
    B.sk('sk-pcb');
    const pcb = B.skBox(70, 90, 2, F.pcb, 0, 0, 0, 1);
    pcb.position.copy(at(60)).addScaledVector(E2, -30);
    pcb.rotation.x = TILT;
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
      const w = config.slots[S('wood.plate')]?.id !== 'none';
      for (const m of plateWood) m.visible = w;
      for (const m of plateStd) m.visible = !w;
      // Skala hell auf dunklem, dunkel auf hellem Trichter
      const c = topMat.color;
      const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      inkMat.color.set(lum < 0.25 ? 0xf2f2f2 : 0x1a1a1a);
    },
  };
}

const CATEGORIES = {
  [S('body')]: {
    title: 'Gehäuse',
    allLabel: 'Komplett',
    slots: [{ key: S('body.main'), label: 'Säule & Bodenplatte' }],
  },
  [S('wood')]: {
    title: 'Holz',
    allLabel: 'Alle',
    slots: [{ key: S('wood.plate'), label: 'Holz-Bodenplatte', panel: true }],
  },
  [S('metal')]: {
    title: 'Akzente',
    allLabel: 'Alle',
    slots: [
      { key: S('metal.top'), label: 'Oberteil & Trichter' },
      { key: S('metal.fork'), label: 'Auslauf & Gabel' },
      { key: S('metal.knob'), label: 'Drehzahlknopf', woodLogo: true },
      { key: S('metal.buttons'), label: 'Tasten' },
    ],
  },
};
const SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));
const SILVER = { id: 'ALU-SILBER', finish: 'satin' }; // eloxiertes Aluminium (Werk)
const BLACK = { id: 'ALU-SCHWARZ', finish: 'matte' };
const m = (id, finish = 'satin') => ({ id, finish });
const preset = (name, swatches, body, plate, accents = {}) => ({
  name,
  swatches,
  config: {
    slots: {
      [S('body.main')]: body,
      [S('wood.plate')]: { id: plate, finish: 'oiled' },
      [S('metal.top')]: m('body'),
      [S('metal.fork')]: m('body'),
      [S('metal.knob')]: m('body'),
      [S('metal.buttons')]: m('steel', 'gloss'),
      ...accents,
    },
    opts: {},
  },
});
const PRESETS = [
  preset('Silber (Werk)', ['#e8e9eb', '#cfd1d3', '#9a9a9a'], SILVER, 'none'),
  preset('Schwarz (Werk)', ['#141414', '#232427', '#cfd1d3'], BLACK, 'none'),
  preset('Schwarz · Walnuss (rb.crafts)', ['#141414', '#644434', '#cfd1d3'], BLACK, 'walnut', { [S('metal.knob')]: m('wood:walnut', 'oiled') }),
  preset('Silber · Eiche (rb.crafts)', ['#e8e9eb', '#d99c52', '#cfd1d3'], SILVER, 'oak', { [S('metal.knob')]: m('wood:oak', 'oiled') }),
  preset('Schwarz · Gold (rb.crafts)', ['#141414', '#c9a65a', '#141414'], BLACK, 'none', {
    [S('metal.top')]: m('gold', 'satin'),
    [S('metal.knob')]: m('gold', 'satin'),
    [S('metal.buttons')]: m('gold', 'gloss'),
  }),
];

registerDevice({
  id: ID,
  kind: 'grinder',
  brand: 'Option-O',
  name: 'Lagom P80',
  full: 'Option-O Lagom P80',
  file: 'Lagom-P80',
  code: 'P80',
  dims: { w: 140, d: 240, h: 380 },
  rootZ: 0,
  shadow: { w: 0.24, d: 0.36, z: 0 },
  frame: { target: [0, 0.19, 0], scale: 0.9 },
  slots: SLOTS,
  categories: CATEGORIES,
  presets: PRESETS,
  build: (mm) => buildLagom(mm),
  UI: DeviceUI,
  roles: {
    body: [S('body.main')],
    accent: [S('metal.top'), S('metal.fork'), S('metal.knob')],
    wood: [S('wood.plate')],
    screws: [],
    logo: [],
  },
  stageLabels: {
    'sk-motor': ['Bürstenloser Motor 500 W', ''],
    'sk-burrs': ['Mizen-Flachmahlscheiben 80 mm', 'Stahl'],
    'sk-pcb': ['Steuerung', 'Elektronik'],
    base: ['Bodenplatte', S('body.main')],
    column: ['Säule', S('body.main')],
    top: ['Oberteil & Mahlkammer', S('metal.top')],
    funnel: ['Trichter mit Skala', S('metal.top')],
    chute: ['Auslauf', S('metal.fork')],
    fork: ['Siebträgergabel', S('metal.fork')],
    controls: ['Tasten & Drehzahlknopf', S('metal.buttons')],
    cable: ['Kabel', ''],
  },
});
