// ---------------------------------------------------------------------------
// La Marzocco Pico (Mühle, konische Mahlscheiben)
//
// Maße in Millimeter, vermessen an der maßstäblichen Zeichnung im offiziellen
// Ersatzteilkatalog "Pico V1.0", S. 4 (Front-, Seiten-, Rück- und Draufsicht;
// Höhe 400, Breite 155, Tiefe 285–290 mm, Fußabstand 110 mm; einheitlicher
// Maßstab 2,8625 px/mm bei 500 dpi). Aufbau nach den Explosionszeichnungen
// (S. 6: Gehäuse, S. 8: Elektrik, S. 10: Mahlwerk) und den Werksfotos.
//
// Koordinaten: X = Breite, Y = Höhe (0 = Stellfläche), Z = Tiefe (+Z = Front).
// Z = 0 ist die Vorderseite der Säule, die Mahlwerksachse liegt bei z = 56,5.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, rbox, profileExtrudeX, woodBoxUV } from '../model.js';
import { makeCanvas } from '../noise.js';
import { registerDevice } from '../devices.js';
import { DeviceUI } from '../device-ui.js';
import { createBuilder, filletShape, plateZ, plateY, latheY, logoFactory, WOOD_U, WOOD_V } from '../parts.js';
import { resolveMetal, resolveBody } from '../data.js';

const ID = 'pico';
const S = (k) => `${ID}:${k}`;
const AX = 56.5; // Mahlwerksachse (z)

const STAGES = [
  { id: 'sk-base', src: 'skeleton', from: [0, 1, 0], dist: 400, gap: 0, dur: 0.7, drop: true },
  { id: 'sk-motor', src: 'skeleton', from: [0, 1, 0], dist: 700, gap: 0.45, dur: 0.8, heavy: true, spin: [[0, 1, 0], Math.PI * 2] },
  { id: 'sk-drive', src: 'skeleton', from: [0, 1, 0], dist: 600, gap: 0.4, dur: 0.7 },
  { id: 'sk-burrs', src: 'skeleton', from: [0, 1, 0], dist: 600, gap: 0.4, dur: 0.8, stagger: 0.2, spin: [[0, 1, 0], Math.PI * 3] },
  { id: 'sk-pcb', src: 'skeleton', from: [0, 0, -1], dist: 700, gap: 0.35, dur: 0.6, stagger: 0.08 },
  { id: 'sk-wires', src: 'skeleton', grow: true, gap: 0.3, dur: 0.6, stagger: 0.2 },
  { id: 'base', from: [0, -1, 0.3], dist: 600, gap: 0.45, after: true, dur: 0.85, heavy: true },
  { id: 'feet', from: [0, -1, 0], dist: 350, gap: 0.3, dur: 0.5, stagger: 0.07 },
  { id: 'case', from: [0, 0.2, -1], dist: 900, gap: 0.4, dur: 0.9, heavy: true },
  { id: 'head', from: [0, 1, 0.3], dist: 900, gap: 0.45, dur: 0.95, heavy: true },
  { id: 'front', from: [0, 0, 1], dist: 800, gap: 0.35, dur: 0.7 },
  { id: 'keys', pop: true, gap: 0.3, dur: 0.3, stagger: 0.08 },
  { id: 'dial', from: [0, -1, 0.3], dist: 700, gap: 0.4, dur: 0.8, spin: [[0, 1, 0], Math.PI * 2] },
  { id: 'chamber', from: [0, 1, 0], dist: 600, gap: 0.35, dur: 0.6 },
  { id: 'fork', from: [0, -0.2, 1], dist: 800, gap: 0.35, dur: 0.7 },
  { id: 'drip', from: [0, -0.2, 1], dist: 800, gap: 0.3, dur: 0.6 },
  { id: 'hopper', from: [0, 1, 0], dist: 700, gap: 0.45, dur: 0.8 },
  { id: 'lid', from: [0, 1, 0], dist: 500, gap: 0.35, dur: 0.6, drop: true },
  { id: 'logo', pop: true, gap: 0.4, dur: 0.5 },
];
const isInner = (id) => id.startsWith('sk-');

/** Kopf (Haube): Seitenkontur (z, y) laut Seitenansicht */
const HEAD = [
  [125.8, 262],
  [118.8, 278.4],
  [-150.5, 263.2],
  [-154.8, 258],
  [-154.8, 212],
  [-150, 207.9],
  [100, 195],
  [115.3, 196],
  [125.8, 214],
];
const HEAD_R = [6, 4, 3, 2, 2, 3, 6, 10, 12];
/** halbe Breite des Kopfes in Abhängigkeit der Höhe (unten 153,7, oben 118,8 mm) */
const headHW = (y) => 76.85 - 0.204 * (y - 195.6);

/** Deckel/Trichterrand: Ei-Form (vorn rund, hinten gerade Kante) in (x, z) */
function eggOutline(scale = 1, n = 72) {
  const R = 68 * scale;
  const zc = 132 * scale + (1 - scale) * 25 - R; // Mittelpunkt des vorderen Bogens
  const zr = -82 * scale + (1 - scale) * 25;
  const hwR = 26.2 * scale;
  const pts = [];
  // vorderer Halbkreis (von rechts über vorne nach links)
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI * 0.12 + (i / n) * Math.PI * 1.24;
    pts.push([Math.cos(a) * R, zc + Math.sin(a) * R]);
  }
  // Tangenten zur hinteren Kante
  pts.push([-hwR - 6, zr + 2], [-hwR, zr], [hwR, zr], [hwR + 6, zr + 2]);
  return pts;
}

/** Skala des Mahlgradrings (dunkle Ziffern, transparent) */
function makeDialInk() {
  const W = 2048;
  const H = 128;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 34px "Inter", "Helvetica Neue", Arial, sans-serif';
  const steps = 120;
  for (let i = 0; i < steps; i++) {
    const x = (i / steps) * W;
    const major = i % 5 === 0;
    g.lineWidth = major ? 3 : 2;
    g.beginPath();
    g.moveTo(x, 6);
    g.lineTo(x, major ? 40 : 24);
    g.stroke();
    if (major) g.fillText(String((i / 5) % 24), x, 84);
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Display (vier Ziffern, Symbole) */
function makePicoDisplay() {
  const c = makeCanvas(256, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#050506';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#f2f2f2';
  g.font = '700 54px "Courier New", monospace';
  g.textAlign = 'center';
  g.fillText('12.5', 128, 64);
  g.font = '600 20px Arial, sans-serif';
  g.fillText('1  2  3', 128, 104);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildPico(mm) {
  const B = createBuilder('Pico', mm);
  const { root, F } = B;
  const mat = (k, extra) => mm.get(S(k), extra);
  const headMat = mat('body.main');
  const caseMat = mat('body.case');
  const frontMat = mat('body.front');
  const baseMat = mat('body.base');

  // =========================================================================
  // Bodenrahmen (Pos. 14) und Füße (D15 × 10)
  // =========================================================================
  B.stage('base');
  B.add(boxProjectUV(rbox(141.8, 11, 288, 3, 3)), baseMat, S('body.base')).position.set(0, 16, -6.2);
  B.stage('feet');
  {
    const g = latheY([[0, 0.3], [7.2, 0.3], [7.5, 1.2], [7.5, 9], [6, 10.5], [0, 10.5]], 28);
    for (const [x, z] of [
      [-55, 128],
      [55, 128],
      [-55, -136],
      [55, -136],
    ]) B.add(g, mat('metal.feet'), S('metal.feet')).position.set(x, 0, z);
  }

  // =========================================================================
  // Säule (Unterteil, Pos. 13): vorn senkrecht, hinten leicht geneigt
  // =========================================================================
  B.stage('case');
  {
    const prof = [
      [0, 21.5],
      [0, 200.4],
      [-133, 207],
      [-147.8, 21.5],
    ];
    const g = profileExtrudeX(prof, 138.7, 5);
    g.translate(-69.35, 0, 0);
    B.add(boxProjectUV(g), caseMat, S('body.case'));
    // Netzschalter hinten unten
    const sw = B.plain(rbox(22, 14, 3, 1, 2), F.blackPlastic);
    sw.position.set(0, 42, -146.6);
    sw.rotation.x = 0.08;
  }

  // =========================================================================
  // Kopf (Haube Pos. 11): keilförmig, nach oben schmaler; vorn das schwarze
  // Bedienteil (Pos. 7) mit Display und drei Tasten
  // =========================================================================
  B.stage('head');
  const wedge = (prof, rad, zClip) => {
    const shape = filletShape(prof.map(([z, y]) => [-z, y]), rad, 5);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 153.7 - 6, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelOffset: -3, bevelSegments: 3, curveSegments: 5 });
    g.translate(0, 0, 3);
    g.rotateY(Math.PI / 2);
    g.translate(-76.85, 0, 0);
    // Seiten nach oben einziehen (Trapez im Querschnitt)
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setX(i, (pos.getX(i) * headHW(y)) / 76.85);
    }
    g.computeVertexNormals();
    void zClip;
    return g;
  };
  // Haube: hinterer Teil bis z = 104 (Kontur HEAD laut Seitenansicht, vorn das Bedienteil)
  void HEAD;
  void HEAD_R;
  {
    const back = [
      [104, 276.8],
      [-150.5, 263.2],
      [-154.8, 258],
      [-154.8, 212],
      [-150, 207.9],
      [104, 194.8],
    ];
    B.add(boxProjectUV(wedge(back, [0, 3, 2, 2, 3, 0])), headMat, S('body.main'));
    B.stage('front');
    const front = [
      [125.8, 262],
      [118.8, 278.4],
      [104, 276.8],
      [104, 194.8],
      [115.3, 196],
      [125.8, 214],
    ];
    B.add(boxProjectUV(wedge(front, [6, 4, 0, 0, 10, 12])), frontMat, S('body.front'));
  }
  B.stage('keys');
  {
    const disp = B.plain(new THREE.PlaneGeometry(59, 28), new THREE.MeshBasicMaterial({ map: makePicoDisplay(), toneMapped: false }));
    disp.position.set(0, 262, 126.2);
    const keyMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.35 });
    const markMat = new THREE.MeshStandardMaterial({ color: 0xe9e9e9, roughness: 0.4 });
    for (const x of [-35, 0, 35]) {
      B.plain(rbox(17.5, 23, 6, 2, 2), keyMat).position.set(x, 231.5, 127.5);
      B.plain(new THREE.BoxGeometry(5, 9, 0.6), markMat).position.set(x, 233, 130.6);
    }
  }

  // =========================================================================
  // Mahlgradring (weiß mit Skala) unter dem Kopf, Auslauf
  // =========================================================================
  B.stage('dial');
  const dialInk = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, alphaMap: makeDialInk(), transparent: true, depthWrite: false, roughness: 0.5 });
  {
    const ring = new THREE.CylinderGeometry(53.5, 53.5, 33.9, 72, 1, true);
    B.add(ring, mat('metal.dial'), S('metal.dial')).position.set(0, 177.65, AX);
    B.add(new THREE.CircleGeometry(53.5, 72).rotateX(Math.PI / 2), mat('metal.dial'), S('metal.dial')).position.set(0, 160.8, AX);
    const ink = B.plain(new THREE.CylinderGeometry(53.7, 53.7, 33.9, 72, 1, true), dialInk);
    ink.position.set(0, 177.65, AX);
    ink.rotation.y = Math.PI / 2;
    ink.castShadow = false;
    // Zeiger am Kopf über dem Ring
    const mark = B.plain(new THREE.ConeGeometry(3.5, 6, 3), F.blackPlastic);
    mark.rotation.x = Math.PI;
    mark.position.set(0, 193, AX + 54);
    // Auslauf
    const chute = B.plain(latheY([[0, 152], [9, 152], [11, 158], [12, 161], [0, 161]], 24), F.blackPlastic);
    chute.position.set(0, 0, AX + 6);
  }

  // =========================================================================
  // Mahlkammer (schwarz) mit Trichterhalter (Pos. 10)
  // =========================================================================
  B.stage('chamber');
  {
    B.add(latheY([[0, 274], [52.4, 274], [52.4, 302.2], [0, 302.2]], 64), mat('metal.ring'), S('metal.ring')).position.set(0, 0, AX);
    B.add(latheY([[0, 302.2], [54, 302.2], [54, 307.4], [0, 307.4]], 64), mat('metal.ring'), S('metal.ring')).position.set(0, 0, AX);
    // Verriegelung vorn
    B.plain(rbox(16, 14, 9, 2, 2), F.blackPlastic).position.set(-12, 292, AX + 55);
  }

  // =========================================================================
  // Siebträgergabel (Pos. 6) mit Schutzkappen, Starttaste, Tropfschale (Pos. 1)
  // =========================================================================
  B.stage('fork');
  const forkMat = mat('metal.fork');
  {
    B.add(boxProjectUV(rbox(70, 70, 10, 3, 2)), forkMat, S('metal.fork')).position.set(0, 82, 5);
    for (const sx of [-1, 1]) {
      const arm = profileExtrudeX([[0, 50], [0, 76], [12, 76], [87, 70], [87, 62], [20, 55], [12, 50]], 9, 1.2);
      B.add(boxProjectUV(arm), forkMat, S('metal.fork')).position.x = sx * 34 - 4.5;
      B.plain(rbox(11, 10, 14, 3, 2), F.rubber).position.set(sx * 34, 70, 82);
    }
    const btn = B.plain(new THREE.CylinderGeometry(5.5, 5.5, 4, 24), F.steel);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0, 94, 2);
  }
  B.stage('drip');
  {
    B.add(boxProjectUV(rbox(124, 13, 112, 3, 2)), baseMat, S('body.base')).position.set(0, 28, 78);
    B.plain(new THREE.BoxGeometry(110, 1, 96), F.trayInner).position.set(0, 34.6, 78);
  }

  // =========================================================================
  // Trichter (transparent, Pos. 8): runder Hals, oben Ei-Form; Deckel (Pos. 16)
  // =========================================================================
  B.stage('hopper');
  {
    const N = 96;
    const egg = eggOutline(0.97, N - 5);
    const top = [];
    // gleichmäßig über den Umfang verteilen
    const per = [];
    let L = 0;
    for (let i = 0; i < egg.length; i++) {
      const a = egg[i];
      const b = egg[(i + 1) % egg.length];
      per.push(L);
      L += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    for (let k = 0; k < N; k++) {
      const s = (k / N) * L;
      let i = 0;
      while (i < per.length - 1 && per[i + 1] < s) i++;
      const a = egg[i];
      const b = egg[(i + 1) % egg.length];
      const seg = (i + 1 < per.length ? per[i + 1] : L) - per[i];
      const t = seg > 0 ? (s - per[i]) / seg : 0;
      top.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    const ang = top.map(([x, z]) => Math.atan2(z - AX, x));
    const rows = [
      top.map((p, k) => [52.4 * Math.cos(ang[k]), 307.4, AX + 52.4 * Math.sin(ang[k])]),
      top.map((p, k) => [52.4 * Math.cos(ang[k]), 319.6, AX + 52.4 * Math.sin(ang[k])]),
      top.map(([x, z]) => [x * 0.985, 382, z * 0.985 + 0.4]),
      top.map(([x, z]) => [x, 391, z]),
    ];
    const pos = [];
    for (let r = 0; r < rows.length - 1; r++) {
      for (let k = 0; k < N; k++) {
        const a = rows[r][k];
        const b = rows[r][(k + 1) % N];
        const c = rows[r + 1][(k + 1) % N];
        const d = rows[r + 1][k];
        pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const clear = new THREE.MeshPhysicalMaterial({ color: 0xf2f6f8, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
    const h = B.plain(g, clear);
    h.castShadow = false;
    h.renderOrder = 2;
    // Mittelkegel (Kaffee-Leitkegel)
    const cone = B.plain(latheY([[0, 345], [8, 343], [24, 322], [34, 312], [0, 312]], 48), clear);
    cone.position.set(0, 0, AX);
    cone.renderOrder = 2;
  }
  B.stage('lid');
  {
    const egg = eggOutline(1.0);
    const sh = new THREE.Shape(egg.map(([x, z]) => new THREE.Vector2(x, z)));
    const g = plateY(sh, 391, 8.5, 2.4, 32);
    // Holz-UV: Maserung entlang der Länge (z)
    const p = g.attributes.position;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      uv[i * 2] = p.getX(i) / WOOD_U + 0.4;
      uv[i * 2 + 1] = p.getZ(i) / WOOD_V + 0.3;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    B.add(g, mat('wood.lid'), S('wood.lid'));
  }

  // Schriftzug hinten am Kopf (rot ab Werk)
  B.stage('logo');
  {
    const makeLogo = logoFactory(B, S('metal.logo'), 101, 10.5);
    const l = makeLogo(4);
    l.position.set(0, 238, -154.9);
    l.rotation.y = Math.PI;
  }

  // =========================================================================
  // Innenleben: Motor in der Säule, Riemen, Mahlwerk, Elektronik
  // =========================================================================
  {
    B.sk('sk-base');
    B.skBox(120, 4, 160, F.frame, 0, 24, -70, 1);
    B.sk('sk-motor');
    B.skCyl(36, 110, F.motor, 0, 90, -70, 'y', 40);
    for (let i = 0; i < 5; i++) B.skCyl(36.4, 2, F.motorRib, 0, 50 + i * 20, -70, 'y', 40);
    B.sk('sk-drive');
    B.skCyl(14, 10, F.frame, 0, 150, -70, 'y', 24);
    B.skCyl(28, 10, F.frame, 0, 150, AX - 10, 'y', 40);
    B.skBox(10, 6, 130, F.rubber, 0, 150, -8, 1);
    B.sk('sk-burrs');
    B.skCyl(30, 26, F.steel, 0, 186, AX, 'y', 48);
    B.skCyl(22, 30, F.chrome, 0, 214, AX, 'y', 48);
    B.sk('sk-pcb');
    B.skBox(2, 70, 90, F.pcb, 50, 120, -80, 1);
    B.skBox(90, 2, 60, F.pcb, 0, 250, 100, 1);
    B.sk('sk-wires');
    B.pipe([[50, 120, -80], [40, 200, -40], [20, 250, 60], [0, 251, 100]], 2.2, F.motor, false);
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
      // Skala hell auf dunklem Ring, dunkel auf hellem
      const v = config.slots[S('metal.dial')];
      const m = resolveMetal(v);
      const hex = m.kind === 'body' ? resolveBody(config.slots[S('body.main')]).color : m.color;
      const c = new THREE.Color(hex);
      const lum = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
      dialInk.color.set(lum > 0.35 ? 0x1a1a1a : 0xf2f2f2);
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
      { key: S('body.main'), label: 'Haube' },
      { key: S('body.case'), label: 'Säule' },
      { key: S('body.front'), label: 'Bedienteil' },
      { key: S('body.base'), label: 'Bodenrahmen & Tropfschale' },
    ],
  },
  [S('wood')]: {
    title: 'Holz',
    allLabel: 'Alle',
    slots: [{ key: S('wood.lid'), label: 'Trichterdeckel' }],
  },
  [S('metal')]: {
    title: 'Akzente',
    allLabel: 'Alle',
    slots: [
      { key: S('metal.dial'), label: 'Mahlgradring' },
      { key: S('metal.ring'), label: 'Mahlkammer & Trichterhalter' },
      { key: S('metal.fork'), label: 'Siebträgergabel' },
      { key: S('metal.feet'), label: 'Füße' },
      { key: S('metal.logo'), label: 'Schriftzug', woodLogo: true },
    ],
  },
};
const SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));
function preset(name, swatches, slots) {
  return { name, swatches, config: { slots, opts: {} } };
}
const black = { id: 'RAL9005', finish: 'matte' };
const accents = (dial = 'white', fork = 'black', logo = 'red') => ({
  [S('metal.dial')]: { id: dial, finish: 'matte' },
  [S('metal.ring')]: { id: 'black', finish: 'matte' },
  [S('metal.fork')]: { id: fork, finish: 'matte' },
  [S('metal.feet')]: { id: 'black', finish: 'matte' },
  [S('metal.logo')]: { id: logo, finish: 'gloss' },
});
const PRESETS = [
  // Holzdeckel von rb.crafts auf der schwarzen Pico (passend zur All Black Micra)
  preset('Schwarz · Walnuss (rb.crafts)', ['#141414', '#644434', '#f0eee8'], {
    [S('body.main')]: black,
    [S('body.case')]: black,
    [S('body.front')]: black,
    [S('body.base')]: black,
    [S('wood.lid')]: { id: 'walnut', finish: 'oiled' },
    ...accents('white', 'black', 'wood:walnut'),
  }),
  preset('Weiß · Eiche (rb.crafts)', ['#efefea', '#d99c52', '#141414'], {
    [S('body.main')]: { id: 'RAL9016', finish: 'satin' },
    [S('body.case')]: { id: 'RAL9016', finish: 'satin' },
    [S('body.front')]: black,
    [S('body.base')]: black,
    [S('wood.lid')]: { id: 'oak', finish: 'oiled' },
    ...accents('white', 'black', 'wood:oak'),
  }),
  preset('Elfenbein · Olive (rb.crafts)', ['#e5d8bd', '#dd9540', '#141414'], {
    [S('body.main')]: { id: 'RAL1015', finish: 'satin' },
    [S('body.case')]: { id: 'RAL1015', finish: 'satin' },
    [S('body.front')]: black,
    [S('body.base')]: black,
    [S('wood.lid')]: { id: 'olive', finish: 'oiled' },
    ...accents('white', 'black', 'black'),
  }),
  // Werksausführungen (Schwarz, Weiß und die lackierten Kits Pos. 15)
  preset('Schwarz (Werk)', ['#141414', '#0f0f0f', '#f0eee8'], {
    [S('body.main')]: black,
    [S('body.case')]: black,
    [S('body.front')]: black,
    [S('body.base')]: black,
    [S('wood.lid')]: { id: 'black', finish: 'oiled' },
    ...accents(),
  }),
  preset('Weiß (Werk)', ['#efefea', '#0f0f0f', '#f0eee8'], {
    [S('body.main')]: { id: 'RAL9016', finish: 'gloss' },
    [S('body.case')]: { id: 'RAL9016', finish: 'gloss' },
    [S('body.front')]: black,
    [S('body.base')]: black,
    [S('wood.lid')]: { id: 'black', finish: 'oiled' },
    ...accents(),
  }),
  preset('Pastellblau (Werk-Kit)', ['#7b9fc4', '#0f0f0f', '#f0eee8'], {
    [S('body.main')]: { id: 'RAL5024', finish: 'gloss' },
    [S('body.case')]: { id: 'RAL5024', finish: 'gloss' },
    [S('body.front')]: black,
    [S('body.base')]: black,
    [S('wood.lid')]: { id: 'black', finish: 'oiled' },
    ...accents(),
  }),
];

registerDevice({
  id: ID,
  kind: 'grinder',
  brand: 'La Marzocco',
  name: 'Pico',
  full: 'La Marzocco Pico',
  file: 'Pico',
  code: 'PCO',
  dims: { w: 155, d: 290, h: 400 },
  rootZ: 0.008,
  shadow: { w: 0.3, d: 0.42, z: -0.008 },
  frame: { target: [0, 0.2, 0], scale: 1.0 },
  slots: SLOTS,
  categories: CATEGORIES,
  presets: PRESETS,
  build: (mm) => buildPico(mm),
  UI: DeviceUI,
  roles: {
    body: [S('body.main'), S('body.case'), S('body.front'), S('body.base')],
    accent: [S('metal.ring'), S('metal.fork'), S('metal.feet')],
    wood: [S('wood.lid')],
    screws: [],
    logo: [S('metal.logo')],
  },
  stageLabels: {
    'sk-base': ['Bodenblech', 'Stahl'],
    'sk-motor': ['Motor', ''],
    'sk-drive': ['Zahnriemen & Riemenscheiben', ''],
    'sk-burrs': ['Konische Mahlscheiben', 'Stahl'],
    'sk-pcb': ['Steuerung & Display', 'Elektronik'],
    'sk-wires': ['Kabelbaum', ''],
    base: ['Bodenrahmen', S('body.base')],
    feet: ['Füße', S('metal.feet')],
    case: ['Säule', S('body.case')],
    head: ['Haube', [S('body.main'), S('body.front')]],
    front: ['Bedienteil', S('body.front')],
    keys: ['Display & Tasten', ''],
    dial: ['Mahlgradring', S('metal.dial')],
    chamber: ['Mahlkammer', S('metal.ring')],
    fork: ['Siebträgergabel', S('metal.fork')],
    drip: ['Tropfschale', S('body.base')],
    hopper: ['Trichter', 'Tritan'],
    lid: ['Trichterdeckel', S('wood.lid')],
    logo: ['Schriftzug', S('metal.logo')],
  },
});
