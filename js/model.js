// ---------------------------------------------------------------------------
// Prozedurales 3D-Modell der Linea Mini R (Maße in Millimeter, nach Fotos)
//
// Koordinaten: X = Breite (rechts = Dampflanzenseite), Y = Höhe (0 = Stellfläche),
//              Z = Tiefe (+Z = Front). Z = 0 ist die Frontebene des Korpus.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  makeCupTrayTexture,
  makeDripGrateTexture,
  makeGaugeTexture,
  makeLogoTexture,
  makeDisplayTexture,
  makePlateTexture,
} from './textures.js';

// Wichtige Maße
const M = {
  halfW: 178.5, // halbe Gesamtbreite (357 mm)
  slabT: 19, // Stärke der Seitenwangen
  inner: 159.5, // Innenkante der Seitenwangen
  top: 377, // Oberkante Reling
  tray: 368, // Höhe Tassenablage
  slabBotFront: 236,
  slabBotRear: 254,
  rearTop: -301,
  rearBot: -270,
  headBot: 250,
  headTop: 362,
  headFront: 114,
  headHalfW: 157,
  baseTop: 101,
  footH: 34,
  baseRear: -254,
  baseFront: 5,
  dripFront: 151,
};

/** UVs per Box-Projektion: einheitliche Texeldichte auf allen Flächen. */
function boxProjectUV(geom, scaleMM = 60) {
  if (!geom.attributes.normal) geom.computeVertexNormals();
  const pos = geom.attributes.position;
  const nor = geom.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    let u;
    let v;
    if (nx >= ny && nx >= nz) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else if (ny >= nz) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u / scaleMM;
    uv[i * 2 + 1] = v / scaleMM;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geom;
}

/** Skaliert vorhandene UVs (z. B. von Extrude-Geometrien in mm). */
function scaleUV(geom, s, offset = [0, 0]) {
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s + offset[0], uv.getY(i) * s + offset[1]);
  uv.needsUpdate = true;
  return geom;
}

function rbox(w, h, d, r = 3, seg = 3) {
  return new RoundedBoxGeometry(w, h, d, seg, r);
}

/** Erzeugt ein Profil in der Z/Y-Ebene und extrudiert es entlang X. */
function profileExtrudeX(points, depth, bevel = 0) {
  // Shape-Koordinaten: sx = -Z, sy = Y. Nach Drehung um Y (+90°): Welt-X = Extrusion.
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(-z, y)));
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geom.translate(0, 0, bevel);
  geom.rotateY(Math.PI / 2);
  return geom;
}

/** Shape (in XY) entlang +Z extrudieren und an z=0 ausrichten. */
function extrudeZ(shape, depth, bevel = 0, bevelSeg = 3, curveSegments = 24) {
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: bevelSeg,
    curveSegments,
  });
  geom.computeBoundingBox();
  geom.translate(0, 0, -geom.boundingBox.min.z);
  return geom;
}

/** Körper aus Polygonen, je Polygon eine Normale (Newell) -> saubere Flächen. */
function polyhedron(faces) {
  const pos = [];
  const nor = [];
  for (const f of faces) {
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const len = Math.hypot(nx, ny, nz) || 1;
    for (let i = 1; i < f.length - 1; i++) {
      pos.push(...f[0], ...f[i], ...f[i + 1]);
      for (let k = 0; k < 3; k++) nor.push(nx / len, ny / len, nz / len);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/** Vertauscht U und V (Maserung um 90° drehen). */
function swapUV(geom) {
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
  uv.needsUpdate = true;
  return geom;
}

export function buildMachine(mm) {
  const root = new THREE.Group();
  root.name = 'LineaMiniR';
  const pickables = [];

  const add = (geom, material, slot, parent = root) => {
    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (slot) {
      mesh.userData.slot = slot;
      pickables.push(mesh);
    }
    parent.add(mesh);
    return mesh;
  };

  const body = {
    upper: mm.get('body.upper'),
    head: mm.get('body.head'),
    lower: mm.get('body.lower'),
    base: mm.get('body.base'),
  };
  const F = mm.fixed;

  // =========================================================================
  // Oberteil: Seitenwangen, Korpus, Reling
  // =========================================================================
  const slabProfile = [
    [0, M.slabBotFront],
    [0, M.top],
    [M.rearTop, M.top],
    [M.rearBot, M.slabBotRear],
  ];
  for (const side of [-1, 1]) {
    const g = boxProjectUV(profileExtrudeX(slabProfile, M.slabT, 1.4));
    const mesh = add(g, body.upper, 'body.upper');
    mesh.position.x = side < 0 ? -M.halfW : M.inner;
  }

  const rearZAt = (y) => M.rearTop + ((M.top - y) / (M.top - M.slabBotRear)) * (M.rearTop * -1 + M.rearBot);
  // Korpus zwischen den Wangen (Front leicht zurückgesetzt, damit nichts flimmert)
  const coreProfile = [
    [-1, M.slabBotFront + 2],
    [-1, M.tray],
    [rearZAt(M.tray), M.tray],
    [M.rearBot + 1, M.slabBotRear],
  ];
  {
    const g = boxProjectUV(profileExtrudeX(coreProfile, M.inner * 2));
    add(g, body.upper, 'body.upper').position.x = -M.inner;
  }
  // Reling vorne und hinten
  {
    const g = boxProjectUV(rbox(M.inner * 2, M.top - M.tray, 9, 1.5, 2));
    add(g, body.upper, 'body.upper').position.set(0, (M.top + M.tray) / 2 - 0.5, -5.5);
    const back = boxProjectUV(
      profileExtrudeX(
        [
          [-288, M.tray - 1],
          [-288, M.top - 0.5],
          [M.rearTop + 0.6, M.top - 0.5],
          [rearZAt(M.tray - 1), M.tray - 1],
        ],
        M.inner * 2,
      ),
    );
    add(back, body.upper, 'body.upper').position.x = -M.inner;
  }
  // Tassenablage (Edelstahl, geschlitzt)
  {
    const w = 302;
    const d = 276;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), F.trayInner);
    plate.position.set(0, M.tray + 0.3, -147.5);
    root.add(plate);
    const mat = mm.get('metal.grates', { map: makeCupTrayTexture(w, d) });
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    const top = add(g, mat, 'metal.grates');
    top.position.set(0, M.tray + 1, -147.5);
  }

  // =========================================================================
  // Kopfteil (Frontbox mit Paddle, Drehknöpfen und Display)
  // =========================================================================
  const headH = M.headTop - M.headBot;
  {
    const g = boxProjectUV(rbox(M.headHalfW * 2, headH, M.headFront, 4, 4));
    add(g, body.head, 'body.head').position.set(0, (M.headTop + M.headBot) / 2, M.headFront / 2);
  }
  // Display (schwarzes Glas mit Temperaturanzeige)
  {
    const disp = new THREE.Mesh(rbox(36, 22, 2, 0.8, 2), F.displayGlass);
    disp.position.set(0, 336, M.headFront + 0.4);
    root.add(disp);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 16),
      new THREE.MeshBasicMaterial({ map: makeDisplayTexture(), transparent: true, opacity: 0.85, toneMapped: false }),
    );
    screen.position.set(0, 336, M.headFront + 1.45);
    root.add(screen);
  }

  // Drehknöpfe (Holzring mit Wellenrand + Kappe)
  const knobShape = (() => {
    const s = new THREE.Shape();
    const R = 21;
    const lobes = 16;
    const n = 192;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = R - 1.1 * (0.5 - 0.5 * Math.cos(a * lobes));
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    return s;
  })();
  const knobDepth = 30;
  const knobGeo = scaleUV(extrudeZ(knobShape, knobDepth, 2.6, 3, 4), 1 / 70, [0.5, 0.5]);
  knobGeo.computeBoundingBox();
  const knobFront = knobGeo.boundingBox.max.z;
  const knobMat = mm.get('wood.knobs');
  const capMat = mm.get('metal.caps');
  for (const x of [-128, 128]) {
    const knob = add(knobGeo, knobMat, 'wood.knobs');
    knob.position.set(x, 302, M.headFront);
    // Kappe
    const capG = new THREE.CylinderGeometry(16.5, 16.5, 2.4, 64);
    capG.rotateX(Math.PI / 2);
    const cap = add(capG, capMat, 'metal.caps');
    cap.position.set(x, 302, M.headFront + knobFront + 0.2);
    // Markierung
    const mark = new THREE.Mesh(new THREE.BoxGeometry(1.6, 11, 0.6), F.darkGap);
    mark.position.set(x, 302 + 8, M.headFront + knobFront + 1.5);
    root.add(mark);
    // Welle/Hülse
    const sleeve = new THREE.CylinderGeometry(11, 11, 4, 32);
    sleeve.rotateX(Math.PI / 2);
    const s = new THREE.Mesh(sleeve, F.blackPlastic);
    s.position.set(x, 302, M.headFront + 1);
    root.add(s);
  }

  // Paddle-Abdeckung (Holz) mit Schlitz und Hebel
  const paddleMat = mm.get('wood.paddle');
  {
    const s = new THREE.Shape();
    s.moveTo(-72, 316);
    s.lineTo(72, 316);
    s.quadraticCurveTo(91, 316, 91, 300);
    s.quadraticCurveTo(91, 284, 72, 284);
    s.quadraticCurveTo(0, 270, -72, 284);
    s.quadraticCurveTo(-91, 284, -91, 300);
    s.quadraticCurveTo(-91, 316, -72, 316);
    const g = swapUV(scaleUV(extrudeZ(s, 13, 3, 3, 16), 1 / 110, [0.3, -2.4]));
    g.computeBoundingBox();
    const front = g.boundingBox.max.z;
    add(g, paddleMat, 'wood.paddle').position.z = M.headFront;
    const slot = new THREE.Mesh(rbox(112, 5, 2, 1.2, 2), F.darkGap);
    slot.position.set(-6, 300, M.headFront + front - 0.4);
    root.add(slot);
    for (const x of [-82, 82]) {
      const stud = new THREE.Mesh(rbox(9, 11, 3, 1.5, 2), F.blackPlastic);
      stud.position.set(x, 302, M.headFront + front - 0.6);
      root.add(stud);
    }
    // Hebel
    const lever = boxProjectUV(rbox(44, 50, 32, 6, 4), 70);
    const lv = add(lever, paddleMat, 'wood.paddle');
    lv.position.set(46, 309, M.headFront + front + 12);
    lv.rotation.x = -0.08;
  }

  // =========================================================================
  // Unterteil (trapezförmig, verjüngt nach unten und hinten)
  // =========================================================================
  {
    const zf = -0.5;
    const bot = M.baseTop;
    const topF = M.headBot;
    const topR = 262;
    const hwB = 137;
    const hwT = 159;
    const zRB = -252;
    const zRT = -270.9;
    const hwTR = hwT + (topR - topF) * ((hwT - hwB) / (topF - bot));
    const fbl = [-hwB, bot, zf];
    const fbr = [hwB, bot, zf];
    const ftl = [-hwT, topF, zf];
    const ftr = [hwT, topF, zf];
    const rbl = [-hwB, bot, zRB];
    const rbr = [hwB, bot, zRB];
    const rtl = [-hwTR, topR, zRT];
    const rtr = [hwTR, topR, zRT];
    const g = polyhedron([
      [fbl, fbr, ftr, ftl], // Front
      [rbr, rbl, rtl, rtr], // Rückseite
      [rbl, fbl, ftl, rtl], // links
      [fbr, rbr, rtr, ftr], // rechts
      [ftl, ftr, rtr, rtl], // oben
      [rbl, rbr, fbr, fbl], // unten
    ]);
    boxProjectUV(g);
    add(g, body.lower, 'body.lower');
  }

  // Manometer
  const gaugeMat = mm.get('metal.gauges');
  const gauges = [];
  const makeGauge = (x, y, R, spec) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, -0.5);
    root.add(grp);
    const prof = [
      new THREE.Vector2(R - 4, 3.2),
      new THREE.Vector2(R - 4, 7.2),
      new THREE.Vector2(R - 2.6, 8.2),
      new THREE.Vector2(R - 0.8, 7.6),
      new THREE.Vector2(R, 6),
      new THREE.Vector2(R, 0),
    ];
    const ring = new THREE.LatheGeometry(prof, 64);
    ring.rotateX(Math.PI / 2);
    add(ring, gaugeMat, 'metal.gauges', grp);
    const faceMat = new THREE.MeshStandardMaterial({ map: makeGaugeTexture(spec, 'white'), roughness: 0.45 });
    const face = new THREE.Mesh(new THREE.CircleGeometry(R - 4, 64), faceMat);
    face.position.z = 3.4;
    grp.add(face);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(R - 4, 64), F.glass);
    glass.position.z = 7.0;
    grp.add(glass);
    gauges.push({ spec, faceMat });
  };
  makeGauge(-117, 176, 23, { max: 16, step: 1, label: 2, value: 9, unit: 'bar', zone: [8, 10] });
  makeGauge(120, 176, 19, { max: 3, step: 0.25, label: 1, value: 1.3, unit: 'bar', zone: [1, 1.5] });

  // =========================================================================
  // Brühgruppe, Siebträger, Heißwasser, Dampflanze
  // =========================================================================
  const groupZ = 55;
  {
    const g = new THREE.CylinderGeometry(40, 43, 18, 64);
    add(g, mm.get('metal.group'), 'metal.group').position.set(0, M.headBot - 9, groupZ);
    const gasket = new THREE.Mesh(new THREE.CylinderGeometry(38.5, 38.5, 2, 48), F.gasket);
    gasket.position.set(0, M.headBot - 19, groupZ);
    root.add(gasket);
  }
  const pfMat = mm.get('metal.portafilter');
  {
    const pf = new THREE.Group();
    pf.position.set(0, 0, groupZ);
    root.add(pf);
    const ringG = new THREE.CylinderGeometry(37.5, 37, 13, 64);
    add(ringG, pfMat, 'metal.portafilter', pf).position.y = 223.5;
    for (const sx of [-1, 1]) {
      const lug = add(rbox(10, 7, 16, 2, 2), pfMat, 'metal.portafilter', pf);
      lug.position.set(sx * 40, 225, 0);
    }
    const bowl = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 199),
        new THREE.Vector2(20, 199.5),
        new THREE.Vector2(29, 202),
        new THREE.Vector2(34, 208),
        new THREE.Vector2(36, 217),
      ],
      64,
    );
    add(bowl, pfMat, 'metal.portafilter', pf);
    const spoutBody = add(new THREE.CylinderGeometry(8, 9, 9, 32), pfMat, 'metal.portafilter', pf);
    spoutBody.position.y = 195;
    for (const sx of [-1, 1]) {
      const sp = add(new THREE.CylinderGeometry(3, 3.4, 11, 20), pfMat, 'metal.portafilter', pf);
      sp.position.set(sx * 6.5, 186, 0);
      sp.rotation.z = sx * 0.28;
    }
    // Hals + Holzgriff
    const handle = new THREE.Group();
    handle.position.set(0, 223, 0);
    handle.rotation.x = -0.07;
    pf.add(handle);
    const neck = new THREE.CylinderGeometry(7.5, 8.5, 22, 32);
    neck.rotateX(Math.PI / 2);
    add(neck, pfMat, 'metal.portafilter', handle).position.z = 44;
    const hprof = [
      [0, 0],
      [9.2, 0],
      [9.8, 3],
      [10.6, 12],
      [12, 26],
      [13.6, 42],
      [14.6, 56],
      [14.6, 62],
      [13.2, 68],
      [9.5, 72],
      [4, 74],
      [0, 74.4],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const hg = new THREE.LatheGeometry(hprof, 48);
    // UV: u = Umfang, v = Länge -> Maserung läuft längs
    {
      const uv = hg.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.1, uv.getY(i) * 1.15 + 0.2);
    }
    hg.rotateX(Math.PI / 2);
    add(hg, mm.get('wood.handle'), 'wood.handle', handle).position.z = 54;
  }

  const wandMat = mm.get('metal.wand');
  // Heißwasserauslauf
  {
    const g = new THREE.CylinderGeometry(6, 6, 22, 32);
    add(g, wandMat, 'metal.wand').position.set(-107, M.headBot - 11, 72);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 3, 24), F.darkGap);
    tip.position.set(-107, M.headBot - 23, 72);
    root.add(tip);
  }
  // Dampflanze
  {
    const pts = [
      [100, 246, 60],
      [100.5, 237, 64],
      [101.5, 224, 79],
      [103, 209, 101],
      [104, 198, 120],
      [105, 188, 132],
      [105.6, 172, 139],
      [106, 152, 141.5],
      [106, 134, 143],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    add(new THREE.TubeGeometry(curve, 96, 4.8, 20, false), wandMat, 'metal.wand');
    const ball = add(new THREE.SphereGeometry(8.5, 32, 16), wandMat, 'metal.wand');
    ball.position.set(100, 247, 60);
    const nut = add(new THREE.CylinderGeometry(9.5, 9.5, 6, 6), wandMat, 'metal.wand');
    nut.position.set(100, M.headBot - 2, 60);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.2, 14, 24), F.blackPlastic);
    tip.position.set(106, 128, 143);
    root.add(tip);
  }

  // =========================================================================
  // Basis, Tropfschale, Füße, Schalter
  // =========================================================================
  {
    const h = M.baseTop - M.footH;
    const g = boxProjectUV(rbox(340, h, M.baseFront - M.baseRear, 3, 3));
    add(g, body.base, 'body.base').position.set(0, M.footH + h / 2, (M.baseFront + M.baseRear) / 2);
    const dz0 = M.baseFront + 1.2;
    const dh = h - 3;
    const dg = boxProjectUV(rbox(340, dh, M.dripFront - dz0, 3, 3));
    add(dg, body.base, 'body.base').position.set(0, M.footH + 0.5 + dh / 2, (M.dripFront + dz0) / 2);

    // Edelstahl-Rahmen
    const rimTop = M.footH + 0.5 + dh;
    const outer = new THREE.Shape();
    outer.moveTo(-170, -M.dripFront);
    outer.lineTo(170, -M.dripFront);
    outer.lineTo(170, -dz0);
    outer.lineTo(-170, -dz0);
    outer.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-161, -M.dripFront + 9);
    hole.lineTo(-161, -dz0 - 8);
    hole.lineTo(161, -dz0 - 8);
    hole.lineTo(161, -M.dripFront + 9);
    hole.closePath();
    outer.holes.push(hole);
    const rimG = new THREE.ExtrudeGeometry(outer, { depth: 2.4, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 2 });
    rimG.rotateX(-Math.PI / 2);
    boxProjectUV(rimG);
    const grateMat = mm.get('metal.grates'); // ohne Textur (Rahmen)
    add(rimG, grateMat, 'metal.grates').position.y = rimTop;
    // Gitter
    const gw = 322;
    const gd = M.dripFront - 9 - (dz0 + 8);
    const gMat = mm.get('metal.grates', { map: makeDripGrateTexture(gw, gd) });
    const gg = new THREE.PlaneGeometry(gw, gd);
    gg.rotateX(-Math.PI / 2);
    const grate = add(gg, gMat, 'metal.grates');
    grate.position.set(0, rimTop + 1.2, (M.dripFront - 9 + dz0 + 8) / 2);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(gw, 1, gd), F.trayInner);
    inner.position.set(0, rimTop - 3, grate.position.z);
    root.add(inner);

    // Schriftzug
    const logoMat = mm.get('metal.logo', { map: makeLogoTexture('LA MARZOCCO'), transparent: true, alphaTest: 0.35 });
    const logo = add(new THREE.PlaneGeometry(132, 16.5), logoMat, 'metal.logo');
    logo.position.set(78, 64, M.dripFront + 0.35);
  }
  // Füße
  {
    const g = new THREE.CylinderGeometry(9.5, 15, M.footH, 40);
    for (const [x, z] of [
      [-138, 69],
      [138, 69],
      [-138, -232],
      [138, -232],
    ]) {
      const f = new THREE.Mesh(g, F.rubber);
      f.position.set(x, M.footH / 2, z);
      f.castShadow = true;
      root.add(f);
    }
  }
  // Netzschalter (rechte Seite der Basis)
  {
    const housing = new THREE.Mesh(rbox(3, 28, 44, 1, 2), F.blackPlastic);
    housing.position.set(170.8, 72, -224);
    root.add(housing);
    const rocker = new THREE.Mesh(rbox(3, 20, 36, 1.4, 2), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.3 }));
    rocker.position.set(171.9, 72, -224);
    rocker.rotation.y = 0.05;
    root.add(rocker);
    const o = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.55, 8, 24), F.white);
    o.rotation.y = Math.PI / 2;
    o.position.set(173.6, 72, -214);
    root.add(o);
    const i = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 5.5), F.white);
    i.position.set(173.6, 72, -234);
    root.add(i);
    // Typenschild
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 33),
      new THREE.MeshStandardMaterial({ map: makePlateTexture(), metalness: 0.6, roughness: 0.35 }),
    );
    plate.rotation.y = Math.PI / 2;
    plate.position.set(170.4, 70, -42);
    root.add(plate);
  }

  // =========================================================================
  // Schrauben
  // =========================================================================
  const screwMat = mm.get('metal.screws');
  const screwHead = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 2.3),
      new THREE.Vector2(2.2, 2.15),
      new THREE.Vector2(3.4, 1.6),
      new THREE.Vector2(4.1, 0.8),
      new THREE.Vector2(4.2, 0),
    ],
    28,
  );
  screwHead.rotateX(Math.PI / 2);
  const socket = new THREE.CylinderGeometry(1.5, 1.5, 0.8, 6);
  socket.rotateX(Math.PI / 2);
  const Zaxis = new THREE.Vector3(0, 0, 1);
  const addScrew = (x, y, z, normal = [0, 0, 1]) => {
    const n = new THREE.Vector3(...normal).normalize();
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.quaternion.setFromUnitVectors(Zaxis, n);
    root.add(grp);
    add(screwHead, screwMat, 'metal.screws', grp);
    const s = new THREE.Mesh(socket, F.darkGap);
    s.position.z = 2.05;
    grp.add(s);
  };
  // Front-Wangen
  for (const sx of [-1, 1]) {
    addScrew(sx * 169, 350, 0.2);
    addScrew(sx * 169, 246, 0.2);
    // Reling oben
    addScrew(sx * 169, M.top + 0.2, -12, [0, 1, 0]);
    addScrew(sx * 169, M.top + 0.2, -286, [0, 1, 0]);
    // Kopfteil oben
    addScrew(sx * 145, M.headTop + 0.1, 12, [0, 1, 0]);
    addScrew(sx * 145, M.headTop + 0.1, 102, [0, 1, 0]);
  }
  // Unterteil Front
  addScrew(-133, 214, -0.4);
  addScrew(133, 214, -0.4);
  addScrew(-119, 134, -0.4);
  addScrew(119, 134, -0.4);
  // Rückwand
  for (const sx of [-1, 1]) {
    addScrew(sx * 120, 360, rearZAt(360) - 0.3, [0, -0.244, -0.97]);
    addScrew(sx * 120, 272, rearZAt(272) - 0.3, [0, -0.244, -0.97]);
  }

  // Gesamt-Skalierung: mm -> m
  root.scale.setScalar(0.001);

  return {
    root,
    pickables,
    setDial(dial) {
      for (const g of gauges) {
        const old = g.faceMat.map;
        g.faceMat.map = makeGaugeTexture(g.spec, dial);
        g.faceMat.needsUpdate = true;
        old?.dispose();
      }
    },
  };
}
