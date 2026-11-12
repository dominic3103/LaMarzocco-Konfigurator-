// ---------------------------------------------------------------------------
// Niche Zero (63 mm Kegelmahlwerk) und Niche Duo (83 mm Flachmahlscheiben)
//
// Maße in Millimeter. Grundlage: die orthografische Seitenansicht der Niche Duo
// auf der Titelseite der offiziellen Bedienungsanleitung "Niche Duo 83F"
// (N685, bei 300 dpi 3,752 px/mm; Höhe 355 und Tiefe 231 mm stimmen mit den
// Herstellerangaben 135 × 230 × 355 mm überein), die beschrifteten Ansichten
// der Anleitungen von Duo und Zero und die Werksfotos. Die Niche Zero
// (122 × 211 × 311 mm laut Hersteller) hat dieselbe Formensprache; ihre
// Kontur ist die Duo-Kontur, auf die Zero-Maße umgerechnet.
//
// Koordinaten: X = Breite, Y = Höhe (0 = Stellfläche), Z = Tiefe (+Z = Front).
// Intern wird in Duo-Maßen mit u = Abstand von der Sockelvorderkante gerechnet.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { boxProjectUV, woodCylUV } from '../model.js';
import { makeCanvas } from '../noise.js';
import { registerDevice } from '../devices.js';
import { DeviceUI } from '../device-ui.js';
import { createBuilder, latheY, logoFactory, WOOD_U, WOOD_V } from '../parts.js';

const U0 = 112; // z = U0 - u (Mahlwerksachse etwa bei z = 0)
const SLOPE = 0.27; // Neigung von Lünette, Mahlgradring und Deckel (vorn tiefer)

// Kontur der Duo-Seitenansicht: [h, u]
const REAR = [
  [40, 231], [60, 230.4], [80, 229.3], [100, 228.1], [120, 226.7], [140, 224.8], [160, 222.4], [180, 219.5], [200, 215.9], [220, 211.8],
  [240, 207.4], [260, 202.8], [280, 196.7], [300, 189.4], [320, 180.6], [330, 175.4], [340, 169.1], [348, 164.8],
];
const FRONT = [
  [40, 138], [57, 132], [80, 123.5], [100, 116.7], [120, 109.7], [140, 101.9], [160, 93.4], [170, 89], [180, 84], [190, 77], [200, 64],
  [205, 55], [211, 49], [220, 44.1], [230, 41.6], [240, 37.8], [250, 35.3], [260, 33.6], [270, 33.2], [300, 33.2], [310, 33.3], [320, 35],
  [330, 40],
];
const WIDTH = [
  [40, 55], [100, 56.5], [160, 59.5], [200, 64.5], [225, 67.5], [330, 67.5],
];
const lerpTab = (tab, h) => {
  if (h <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    if (h <= tab[i][0]) {
      const t = (h - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0]);
      return tab[i - 1][1] + (tab[i][1] - tab[i - 1][1]) * t;
    }
  }
  return tab[tab.length - 1][1];
};
/** Querschnitt (Superellipse) bei Höhe h in Duo-Maßen: Punkte [x, u] */
function section(h, n = 2.6, N = 96, inset = 0) {
  const uf = lerpTab(FRONT, h) + inset;
  const ur = lerpTab(REAR, h) - inset;
  const w = lerpTab(WIDTH, h) - inset;
  return superellipse((uf + ur) / 2, (ur - uf) / 2, w, n, N);
}
/** Schräger Ring: y = t + s·(u − 33); Vorder-/Hinterkante passend zur Kontur in der jeweiligen Höhe */
function slantSection(t, sl, inset = 0, n = 2.6, N = 96) {
  let uf = lerpTab(FRONT, t);
  let ur = lerpTab(REAR, t);
  for (let it = 0; it < 6; it++) {
    uf = lerpTab(FRONT, t + sl * (uf - 33));
    ur = lerpTab(REAR, t + sl * (ur - 33));
  }
  uf += inset;
  ur -= inset;
  const w = lerpTab(WIDTH, t + sl * ((uf + ur) / 2 - 33)) - inset;
  return superellipse((uf + ur) / 2, (ur - uf) / 2, w, n, N).map(([x, u]) => [x, t + sl * (u - 33), u]);
}
function superellipse(uc, a, b, n, N) {
  const pts = [];
  for (let k = 0; k < N; k++) {
    const t = (k / N) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    // t = 0 vorn (u klein), dann zur +X-Seite
    pts.push([b * Math.sign(s) * Math.abs(s) ** (2 / n), uc - a * Math.sign(c) * Math.abs(c) ** (2 / n)]);
  }
  return pts;
}

/** Indizierte Mantelfläche aus Ringen gleicher Punktzahl, Ringe gegen den Uhrzeigersinn von oben */
function ringLoft(rows, { capTop = false, capBottom = false } = {}) {
  const N = rows[0].length;
  const pos = [];
  const idx = [];
  for (const row of rows) for (const p of row) pos.push(...p);
  for (let r = 0; r < rows.length - 1; r++) {
    for (let k = 0; k < N; k++) {
      const a = r * N + k;
      const b = r * N + ((k + 1) % N);
      const c = (r + 1) * N + ((k + 1) % N);
      const d = (r + 1) * N + k;
      idx.push(a, b, c, a, c, d);
    }
  }
  const cap = (row, up) => {
    const base = pos.length / 3;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const p of row) {
      cx += p[0] / N;
      cy += p[1] / N;
      cz += p[2] / N;
    }
    pos.push(cx, cy, cz);
    for (const p of row) pos.push(...p);
    for (let k = 0; k < N; k++) {
      const a = base + 1 + k;
      const b = base + 1 + ((k + 1) % N);
      if (up) idx.push(base, a, b);
      else idx.push(base, b, a);
    }
  };
  if (capTop) cap(rows[rows.length - 1], true);
  if (capBottom) cap(rows[0], false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Skalenring (weiße Striche und Schrift auf transparentem Grund) als Alpha-Maske, U läuft einmal herum */
function makeDialMask(label) {
  const W = 2048;
  const H = 64;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  // Skala über die vordere Hälfte (U 0.25 … 0.75 entspricht vorne)
  for (let i = 0; i <= 50; i++) {
    const x = W * (0.28 + (i / 50) * 0.44);
    g.fillRect(x - 1.5, 6, 3, i % 5 === 0 ? 22 : 12);
  }
  g.font = '600 20px Arial, sans-serif';
  g.textAlign = 'center';
  for (let i = 0; i <= 5; i++) g.fillText(String(i * 10), W * (0.28 + (i / 5) * 0.44), 52);
  g.font = '700 18px Arial, sans-serif';
  g.fillText(label[0], W * 0.37, 52);
  g.fillText(label[1], W * 0.63, 52);
  return new THREE.CanvasTexture(c);
}

function makeNicheBuilder(V) {
  const ID = V.id;
  const S = (k) => `${ID}:${k}`;
  const sx = V.w / 135;
  const su = V.d / 231;
  const sh = V.h / 355;
  /** Duo-Punkt (x, h, u) -> Modell (x, y, z) */
  const P = (x, h, u) => [x * sx, h * sh, (U0 - u) * su];

  return function build(mm) {
    const B = createBuilder(V.file, mm);
    const { root, F } = B;
    const mat = (k, extra) => mm.get(S(k), extra);
    const bodyMat = mat('body.main');

    const rowsAt = (hs, opts = {}) =>
      hs.map((h) => section(h, opts.n ?? 2.6, 96, opts.inset?.(h) ?? 0).map(([x, u]) => P(x, opts.slant ? h + SLOPE * (u - 33) : h, u)));

    // =======================================================================
    // Sockel (Base cover) mit gerundeter Kante, Holzplatte und Holzfüße
    // =======================================================================
    B.stage('base');
    {
      const lv = [
        [2, 9.5, 222.5, 57],
        [6, 5.5, 225.5, 60],
        [12, 3, 227.8, 61.5],
        [20, 1.4, 229.4, 62.3],
        [32, 0.8, 230.4, 62.5],
        [44, 0.9, 230.9, 62.5],
        [50, 1.6, 231, 62.2],
        [53.5, 3.6, 230.4, 61.4],
        [56, 8.5, 229, 59.5],
      ];
      const rows = lv.map(([h, uf, ur, w]) => superellipse((uf + ur) / 2, (ur - uf) / 2, w, 3.2, 96).map(([x, u]) => P(x, h, u)));
      B.add(boxProjectUV(ringLoft(rows, { capTop: true, capBottom: true })), mat('body.base'), S('body.base'));
    }
    B.stage('feet');
    {
      const cone = latheY([[0, 0], [17, 0], [17.5, 1.2], [8, 30], [4.5, 35], [0, 36]], 32);
      for (const [x, u] of [
        [-1, 44],
        [1, 44],
        [-1, 187.5],
        [1, 187.5],
      ]) {
        const g = woodCylUV(cone.clone().rotateX(-Math.PI / 2), [0.1 + u / 900, 0.3]).rotateX(Math.PI / 2);
        const f = B.add(g, mat('wood.feet'), S('wood.feet'));
        const [px, , pz] = P(x * 55, 0, u);
        f.position.set(px, 0, pz);
        f.scale.set(sx, sh, su);
        f.rotation.z = -x * 0.22;
      }
    }
    B.stage('tray');
    {
      const rows = [56, 57, 69, 70.6].map((h, i) => {
        const ins = [0, 0, 0, 1.4][i];
        return superellipse(56, 44.4 - ins, 44.4 - ins, 2, 96).map(([x, u]) => P(x, h, u));
      });
      const g = ringLoft(rows, { capTop: true, capBottom: true });
      const p = g.attributes.position;
      const uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        uv[i * 2] = p.getX(i) / WOOD_U + 0.31;
        uv[i * 2 + 1] = p.getZ(i) / WOOD_V + 0.12;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      B.add(g, mat('wood.tray'), S('wood.tray'));
    }

    // =======================================================================
    // Gehäuse (Motorgehäuse und Kopf), Lünette, Mahlgradring
    // =======================================================================
    B.stage('body');
    {
      const low = [55, 60, 80, 100, 120, 140, 160, 170, 180, 190, 200, 205, 211, 220, 230, 240, 250];
      B.add(boxProjectUV(ringLoft(rowsAt(low))), bodyMat, S('body.main'));
      // Übergang in den schrägen Abschluss (Neigung wächst bis zur Lünette)
      const tr = [
        [250, 0],
        [262, 0.06],
        [274, 0.12],
        [286, 0.2],
        [296, 0.25],
        [304, SLOPE],
      ];
      B.add(boxProjectUV(ringLoft(tr.map(([t, sl]) => slantSection(t, sl).map(([x, h, u]) => P(x, h, u))))), bodyMat, S('body.main'));
    }
    B.stage('ring');
    {
      const band = (t0, t1, inset0 = 0, inset1 = 0) => [t0, t1].map((t, i) => slantSection(t, SLOPE, i ? inset1 : inset0).map(([x, h, u]) => P(x, h, u)));
      // Lünette (Bezel ring)
      B.add(boxProjectUV(ringLoft(band(304, 309, 0, 0.4))), mat('metal.ring'), S('metal.ring'));
      // Zeiger-Lasche vorn an der Lünette
      {
        const a = new THREE.Vector3(...P(0, 304.5, 36));
        const b = new THREE.Vector3(...P(0, 298, 19));
        const tab = B.add(new THREE.BoxGeometry(8 * sx, 2.4, a.distanceTo(b) + 4), mat('metal.ring'), S('metal.ring'));
        tab.position.copy(a).add(b).multiplyScalar(0.5);
        tab.lookAt(b);
      }
      // Mahlgradring mit Skala
      const dial = ringLoft(band(309, 317, 0.6, 0.6));
      const p = dial.attributes.position;
      const uv = new Float32Array(p.count * 2);
      const N = 96;
      for (let i = 0; i < p.count; i++) {
        const k = i % N;
        const row = Math.floor(i / N);
        uv[i * 2] = (k / N + 0.5) % 1;
        uv[i * 2 + 1] = row ? 1 : 0;
      }
      dial.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      B.add(dial, mat('metal.dial'), S('metal.dial'));
      const ink = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5, alphaMap: makeDialMask(V.dialLabel), transparent: true, depthWrite: false });
      const ov = B.plain(ringLoft(band(309.4, 316.6, 0.25, 0.25)), ink);
      ov.geometry.setAttribute('uv', dial.attributes.uv.clone());
      ov.castShadow = false;
      // obere Fläche (Deckelauflage) und Trichter
      const seat = ringLoft([slantSection(317, SLOPE, 0.6), slantSection(317, SLOPE, 3)].map((r) => r.map(([x, h, u]) => P(x, h, u))));
      B.add(seat, mat('metal.dial'), S('metal.dial'));
    }
    B.stage('funnel');
    {
      const uc = 112;
      const [cx, cy, cz] = P(0, 317 + SLOPE * (uc - 33) - 1, uc);
      const f = latheY([[16, -70], [20, -66], [26, -40], [42, -14], [55, -2], [58, 0], [0.01, 0.01]], 64);
      const fm = B.add(f, mat('metal.funnel'), S('metal.funnel'));
      fm.position.set(cx, cy, cz);
      fm.rotation.x = Math.atan(SLOPE);
      fm.scale.set(sx, sh, su);
      const burr = B.plain(new THREE.CylinderGeometry(V.burr / 2 - 8, V.burr / 2 - 8, 6, 32), F.steel);
      burr.position.set(cx, cy - 66 * sh, cz + 18);
      burr.rotation.x = Math.atan(SLOPE);
    }
    // Deckel (klar) mit Magnetverschluss
    B.stage('lid');
    {
      const lv = [
        [0, 3],
        [3, 3.4],
        [7, 7],
        [10, 14],
        [12, 24],
        [12.6, 38],
      ];
      const rows = lv.map(([d, ins]) => slantSection(317, SLOPE, ins).map(([x, h, u]) => P(x, h + d, u)));
      const clear = new THREE.MeshPhysicalMaterial({ color: 0x9aa0a4, roughness: 0.05, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
      const lid = B.plain(ringLoft(rows, { capTop: true }), clear);
      lid.castShadow = false;
      lid.renderOrder = 2;
      const [lx, ly, lz] = P(0, 317 + SLOPE * (40 - 33) + 4, 40);
      const latch = B.add(new THREE.SphereGeometry(3.2, 20, 12), mat('metal.funnel'), S('metal.funnel'));
      latch.position.set(lx, ly, lz);
    }

    // =======================================================================
    // Auslauf, Mahlbecher, Schalter, Logo
    // =======================================================================
    B.stage('chute');
    {
      const shp = new THREE.Shape();
      shp.moveTo(-11, -12);
      shp.lineTo(11, -12);
      shp.quadraticCurveTo(13, -12, 13, -9);
      shp.lineTo(13, 9);
      shp.quadraticCurveTo(13, 12, 10, 12);
      shp.lineTo(-10, 12);
      shp.quadraticCurveTo(-13, 12, -13, 9);
      shp.lineTo(-13, -9);
      shp.quadraticCurveTo(-13, -12, -11, -12);
      const g = new THREE.ExtrudeGeometry(shp, { depth: 40, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 2 });
      g.rotateX(Math.PI / 2);
      const m = B.plain(g, F.blackPlastic);
      const [cx, cy, cz] = P(0, 203, 60);
      m.position.set(cx, cy, cz);
      m.rotation.x = -0.12;
      m.scale.set(sx, sh, su);
      const mouth = B.plain(new THREE.PlaneGeometry(20 * sx, 18 * su).rotateX(-Math.PI / 2), F.darkGap);
      const [mx, my, mz] = P(0, 161.5, 62);
      mouth.position.set(mx, my, mz);
    }
    B.stage('cup');
    {
      const cupProf = [[0, 0], [26.5, 0], [27.5, 1.5], [28, 96], [29.2, 98], [29.2, 101], [28, 103], [28.4, 108], [28.4, 110], [26.8, 110], [26.8, 4], [0, 4]];
      const cup = B.add(latheY(cupProf, 56), mat('metal.cup'), S('metal.cup'));
      const [cx, cy, cz] = P(0, 70.6, 56);
      cup.position.set(cx, cy, cz);
      cup.scale.set(sx, sh, su);
    }
    B.stage('details');
    {
      // Kippschalter und Kontrollleuchte rechts
      const [tx, ty, tz] = P(0, 242.4, 122.7);
      const side = section(242.4, 2.6, 96).reduce((m, [x]) => Math.max(m, x), 0) * sx;
      const ring = new THREE.CylinderGeometry(6.5, 6.5, 2, 24);
      ring.rotateZ(Math.PI / 2);
      B.plain(ring, F.chrome).position.set(side - 0.2, ty, tz);
      const tog = new THREE.CylinderGeometry(1.6, 2.4, 11, 12);
      tog.rotateZ(Math.PI / 2 + 0.35);
      B.plain(tog, F.chrome).position.set(side + 5, ty + 1.5, tz);
      const led = new THREE.SphereGeometry(2.2, 12, 8);
      B.plain(led, new THREE.MeshStandardMaterial({ color: 0x9fdc6a, emissive: 0x3a7a20, roughness: 0.3 })).position.set(side - 0.6, ty - 16 * sh, tz - 4 * su);
      // Kabel hinten
      const [rx, ry, rz] = P(30, 60, 229);
      const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(rx, ry, rz), new THREE.Vector3(rx + 4, ry - 22, rz - 12), new THREE.Vector3(rx + 10, 2.6, rz - 20)]);
      B.plain(new THREE.TubeGeometry(cable, 40, 2.6, 10, false), F.blackPlastic);
    }
    B.stage('logo');
    {
      const [lx, ly, lz] = P(0, V.logoH, 33);
      const ringG = new THREE.TorusGeometry(21.5 * sx, 1.6, 12, 56);
      const r = B.add(ringG, mat('metal.logo'), S('metal.logo'));
      r.position.set(lx, ly, lz + 1.2);
      const disk = B.plain(new THREE.CylinderGeometry(21 * sx, 21 * sx, 2.4, 48).rotateX(Math.PI / 2), F.blackPlastic);
      disk.position.set(lx, ly, lz);
      const mk = logoFactory(B, S('metal.logo'), 72 * sx, 9 * sx, 'NICHE'); // Textmaske 8:1, Schrift ca. 30 mm breit
      const l = mk(2);
      l.position.set(lx, ly, lz + 1.2);
    }

    // Innenleben: Motor, Mahlwerk, Steuerplatine
    {
      const [mx, , mz] = P(0, 0, 175);
      B.sk('sk-motor');
      B.skCyl(36 * sx, 140 * sh, F.motor, mx, 125 * sh, mz, 'y', 40);
      B.sk('sk-burrs');
      const [bx, by, bz] = P(0, 270, 112);
      B.skCyl((V.burr / 2) * sx, 10, F.steel, bx, by, bz, 'y', 48);
      B.skCyl((V.burr / 2) * sx, 10, F.steel, bx, by + 12, bz, 'y', 48);
      B.sk('sk-pcb');
      const [px, py, pz] = P(0, 90, 200);
      B.skBox(60 * sx, 50 * sh, 2, F.pcb, px, py, pz, 1);
    }

    root.scale.setScalar(0.001);
    return {
      root,
      pickables: B.pickables,
      skeleton: B.skeleton,
      stages: STAGES,
      isInner: (id) => id.startsWith('sk-'),
      setBarista() {},
      sync() {},
    };
  };
}

const STAGES = [
  { id: 'sk-motor', src: 'skeleton', from: [0, 1, 0], dist: 600, gap: 0, dur: 0.8, heavy: true, spin: [[0, 1, 0], Math.PI * 2] },
  { id: 'sk-burrs', src: 'skeleton', from: [0, 1, 0], dist: 600, gap: 0.4, dur: 0.8, stagger: 0.2, spin: [[0, 1, 0], Math.PI * 3] },
  { id: 'sk-pcb', src: 'skeleton', from: [0, 0, -1], dist: 600, gap: 0.35, dur: 0.6 },
  { id: 'base', from: [0, -1, 0.3], dist: 600, gap: 0.45, after: true, dur: 0.8, heavy: true },
  { id: 'feet', from: [0, -1, 0], dist: 350, gap: 0.3, dur: 0.5, stagger: 0.07 },
  { id: 'body', from: [0, 0.3, -1], dist: 900, gap: 0.4, dur: 0.95, heavy: true },
  { id: 'ring', from: [0, 1, 0], dist: 500, gap: 0.35, dur: 0.6, spin: [[0, 1, 0], Math.PI] },
  { id: 'funnel', from: [0, 1, 0], dist: 500, gap: 0.3, dur: 0.6 },
  { id: 'chute', from: [0, -0.3, 1], dist: 500, gap: 0.3, dur: 0.5 },
  { id: 'tray', from: [0, -0.2, 1], dist: 600, gap: 0.3, dur: 0.6 },
  { id: 'cup', from: [0, 0.2, 1], dist: 600, gap: 0.3, dur: 0.6 },
  { id: 'details', pop: true, gap: 0.3, dur: 0.4 },
  { id: 'lid', from: [0, 1, 0], dist: 500, gap: 0.35, dur: 0.6, drop: true },
  { id: 'logo', pop: true, gap: 0.35, dur: 0.5 },
];

function define(V) {
  const ID = V.id;
  const S = (k) => `${ID}:${k}`;
  const CATEGORIES = {
    [S('body')]: {
      title: 'Gehäuse',
      allLabel: 'Komplett',
      slots: [
        { key: S('body.main'), label: 'Gehäuse' },
        { key: S('body.base'), label: 'Sockel' },
      ],
    },
    [S('wood')]: {
      title: 'Holz',
      allLabel: 'Alle',
      slots: [
        { key: S('wood.tray'), label: 'Holzplatte' },
        { key: S('wood.feet'), label: 'Holzfüße' },
      ],
    },
    [S('metal')]: {
      title: 'Akzente',
      allLabel: 'Alle',
      slots: [
        { key: S('metal.ring'), label: 'Lünette' },
        { key: S('metal.dial'), label: 'Mahlgradring' },
        { key: S('metal.funnel'), label: 'Trichter' },
        { key: S('metal.cup'), label: 'Mahlbecher' },
        { key: S('metal.logo'), label: 'Logo', woodLogo: true },
      ],
    },
  };
  const SLOTS = Object.values(CATEGORIES).flatMap((c) => c.slots.map((s) => s.key));
  const preset = (name, swatches, body, wood, accents = {}) => ({
    name,
    swatches,
    config: {
      slots: {
        [S('body.main')]: body,
        [S('body.base')]: body,
        [S('wood.tray')]: { id: wood, finish: 'oiled' },
        [S('wood.feet')]: { id: wood, finish: 'oiled' },
        [S('metal.ring')]: { id: 'black', finish: 'gloss' },
        [S('metal.dial')]: { id: 'black', finish: 'gloss' },
        [S('metal.funnel')]: { id: 'chrome', finish: 'gloss' },
        [S('metal.cup')]: { id: 'steel', finish: 'satin' },
        [S('metal.logo')]: { id: 'steel', finish: 'gloss' },
        ...accents,
      },
      opts: {},
    },
  });
  const BLACK = { id: 'RAL9005', finish: 'gloss' };
  const WHITE = { id: 'RAL9016', finish: 'gloss' };
  const PRESETS = [
    preset('Weiß · Eiche (Werk)', ['#efefea', '#d99c52', '#141414'], WHITE, 'oak', { [S('metal.ring')]: { id: 'white', finish: 'gloss' } }),
    preset('Schwarz · Walnuss (Werk)', ['#141414', '#644434', '#e4e6e9'], BLACK, 'walnut'),
    preset('Schwarz · Olive (rb.crafts Holz-Set)', ['#141414', '#dd9540', '#e4e6e9'], BLACK, 'olive', { [S('metal.logo')]: { id: 'wood:olive', finish: 'oiled' } }),
    preset('Weiß · Walnuss (rb.crafts Holz-Set)', ['#efefea', '#644434', '#141414'], WHITE, 'walnut', {
      [S('metal.ring')]: { id: 'white', finish: 'gloss' },
      [S('metal.logo')]: { id: 'wood:walnut', finish: 'oiled' },
    }),
  ];
  registerDevice({
    id: ID,
    kind: 'grinder',
    brand: 'Niche',
    name: V.name,
    full: `Niche ${V.name}`,
    file: V.file,
    code: V.code,
    dims: { w: V.w, d: V.d, h: V.h },
    rootZ: 0,
    shadow: { w: 0.24, d: 0.32, z: 0 },
    frame: { target: [0, (V.h / 2) * 0.001, 0], scale: 0.85 },
    slots: SLOTS,
    categories: CATEGORIES,
    presets: PRESETS,
    build: makeNicheBuilder(V),
    UI: DeviceUI,
    roles: {
      body: [S('body.main'), S('body.base')],
      accent: [S('metal.ring'), S('metal.funnel')],
      wood: [S('wood.tray'), S('wood.feet')],
      screws: [],
      logo: [S('metal.logo')],
    },
    stageLabels: {
      'sk-motor': ['Motor', ''],
      'sk-burrs': [V.burrLabel, 'Stahl'],
      'sk-pcb': ['Steuerung', 'Elektronik'],
      base: ['Sockel', S('body.base')],
      feet: ['Holzfüße', S('wood.feet')],
      body: ['Gehäuse', S('body.main')],
      ring: ['Lünette & Mahlgradring', S('metal.dial')],
      funnel: ['Trichter', S('metal.funnel')],
      chute: ['Auslauf', 'Kunststoff'],
      tray: ['Holzplatte', S('wood.tray')],
      cup: ['Mahlbecher', S('metal.cup')],
      details: ['Schalter & Kabel', ''],
      lid: ['Deckel', 'Acryl'],
      logo: ['Logo', S('metal.logo')],
    },
  });
}

define({ id: 'nzero', name: 'Zero', file: 'Niche-Zero', code: 'NZ', w: 122, d: 211, h: 311, burr: 63, burrLabel: 'Kegelmahlwerk 63 mm', dialLabel: ['ESPRESSO', 'FILTER DRIP'], logoH: 255 });
define({ id: 'nduo', name: 'Duo', file: 'Niche-Duo', code: 'ND', w: 135, d: 230, h: 355, burr: 83, burrLabel: 'Flachmahlscheiben 83 mm', dialLabel: ['ESPRESSO', 'FILTER'], logoH: 255 });
