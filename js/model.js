// ---------------------------------------------------------------------------
// Prozedurales 3D-Modell der Linea Mini R
// Maße in Millimeter – aus den Maßzeichnungen des offiziellen Ersatzteilkatalogs
// (Linea Mini R Parts Catalog V1.0, Seite 4: Front-, Seiten- und Rückansicht)
// sowie den Referenzfotos.
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

// Wichtige Maße (aus den Werkszeichnungen, Maßstab 1,709 px/mm vermessen)
const M = {
  halfW: 178.5, // halbe Gesamtbreite (357 mm)
  slabT: 27, // Stärke der Seitenwangen (Front-Flansch)
  inner: 151.5, // Innenkante der Seitenwangen
  top: 377.5, // Oberkante Reling (378 mm)
  tray: 368, // Höhe Tassenablage
  slabBotFront: 235,
  slabBotRear: 255,
  rearTop: -342, // Oberkorpus ragt hinten über die Standfläche hinaus
  rearBot: -324,
  headBot: 250,
  headTop: 364,
  headFront: 130,
  headHalfW: 151,
  baseTop: 93.6,
  footH: 25.8,
  baseRear: -297,
  baseFront: 4,
  baseHalfW: 145.5,
  dripFront: 166,
  dripHalfW: 161.5,
  dripLipBot: 82.5,
  groupZ: 66.5,
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
  // Montagegruppe je Bauteil (für die Abschluss-Animation "Konfiguration abschließen")
  let stage = 'base';
  const rootAdd = root.add.bind(root);
  root.add = (...objs) => {
    for (const o of objs) if (!o.userData.stage) o.userData.stage = stage;
    return rootAdd(...objs);
  };

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
  const plain = (geom, material, parent = root) => {
    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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
  const logoTex = makeLogoTexture('LA MARZOCCO');

  // Rückseite des Oberkorpus: schräge Ebene von (rearTop, top) nach (rearBot, slabBotRear)
  const rearZAt = (y) => M.rearTop + ((M.top - y) / (M.top - M.slabBotRear)) * (M.rearBot - M.rearTop);

  stage = 'upper';
  // =========================================================================
  // Oberteil: Seitenwangen, Korpus, Reling, Tassenablage
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
  {
    const coreProfile = [
      [-1, M.slabBotFront + 2],
      [-1, M.tray],
      [rearZAt(M.tray), M.tray],
      [M.rearBot + 1, M.slabBotRear],
    ];
    const g = boxProjectUV(profileExtrudeX(coreProfile, M.inner * 2));
    add(g, body.upper, 'body.upper').position.x = -M.inner;
  }
  {
    const g = boxProjectUV(rbox(M.inner * 2, M.top - M.tray, 9, 1.5, 2));
    add(g, body.upper, 'body.upper').position.set(0, (M.top + M.tray) / 2 - 0.5, -5.5);
    const back = boxProjectUV(
      profileExtrudeX(
        [
          [-328, M.tray - 1],
          [-328, M.top - 0.5],
          [M.rearTop + 0.6, M.top - 0.5],
          [rearZAt(M.tray - 1), M.tray - 1],
        ],
        M.inner * 2,
      ),
    );
    add(back, body.upper, 'body.upper').position.x = -M.inner;
  }
  stage = 'tray';
  {
    const w = 287;
    const d = 316;
    const zc = -10 - d / 2;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), F.trayInner);
    plate.position.set(0, M.tray + 0.3, zc);
    root.add(plate);
    const mat = mm.get('metal.grates', { map: makeCupTrayTexture(w, d) });
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    add(g, mat, 'metal.grates').position.set(0, M.tray + 1, zc);
  }
  stage = 'logo';
  // Schriftzug auf der schrägen Rückwand (laut Rückansicht oben, zur +X-Seite versetzt)
  {
    const yc = 319.5;
    // Normale der Rückwand zeigt nach hinten und leicht nach unten
    const tilt = -Math.atan2(M.rearBot - M.rearTop, M.top - M.slabBotRear);
    const logoMat = mm.get('metal.logo', { map: logoTex, transparent: true, alphaTest: 0.35 });
    const logo = add(new THREE.PlaneGeometry(126, 15.75), logoMat, 'metal.logo');
    logo.rotation.set(tilt, Math.PI, 0, 'XYZ');
    logo.position.set(78, yc, rearZAt(yc) - 0.35);
  }

  stage = 'head';
  // =========================================================================
  // Kopfteil (Frontbox mit Paddle, Drehknöpfen und Shot-Timer-Display)
  // =========================================================================
  const headH = M.headTop - M.headBot;
  {
    const g = boxProjectUV(rbox(M.headHalfW * 2, headH, M.headFront, 4, 4));
    add(g, body.head, 'body.head').position.set(0, (M.headTop + M.headBot) / 2, M.headFront / 2);
  }
  {
    const disp = new THREE.Mesh(rbox(32, 22, 2, 0.8, 2), F.displayGlass);
    disp.position.set(0, 344.7, M.headFront + 0.4);
    root.add(disp);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(27, 15),
      new THREE.MeshBasicMaterial({ map: makeDisplayTexture(), transparent: true, opacity: 0.85, toneMapped: false }),
    );
    screen.position.set(0, 344.7, M.headFront + 1.45);
    root.add(screen);
  }

  // Drehknöpfe: Hülse + Holzkörper (Form wählbar) + vertiefte Kappe (ragen ca. 60 mm vor)
  const ringShape = (R, fn, n = 192) => {
    const sh = new THREE.Shape();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = fn(a, R);
      if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return sh;
  };
  const knobShapes = {
    // gewellt: 16 weiche Wellen
    wave: ringShape(22.5, (a, R) => R - 1.2 * (0.5 - 0.5 * Math.cos(a * 16))),
    // gerillt: Zylinder mit 6 schmalen Längsnuten (wie die rb.crafts Eichen-Knöpfe)
    groove: ringShape(22.5, (a, R) => {
      const k = (((a / (Math.PI * 2)) * 6) % 1 + 1) % 1;
      return k > 0.44 && k < 0.56 ? R - 2.2 : R;
    }, 360),
    // facettiert: Achteck (rb.crafts Nussbaum)
    facet: (() => {
      const sh = new THREE.Shape();
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const r = 23.5;
        if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      return sh;
    })(),
  };
  const knobGeos = Object.fromEntries(
    Object.entries(knobShapes).map(([id, sh]) => [id, scaleUV(extrudeZ(sh, 42, 2.6, 3, 4), 1 / 80, [0.5, 0.5])]),
  );
  knobGeos.wave.computeBoundingBox();
  const knobLen = knobGeos.wave.boundingBox.max.z;
  const knobMat = mm.get('wood.knobs');
  const capMat = mm.get('metal.caps');
  const knobY = 308;
  const knobZ0 = M.headFront + 11;
  const knobVariants = { wave: [], groove: [], facet: [] };
  for (const x of [-115, 115]) {
    const collarG = new THREE.CylinderGeometry(14.5, 15.5, 12, 40);
    collarG.rotateX(Math.PI / 2);
    stage = 'head';
    plain(collarG, F.blackPlastic).position.set(x, knobY, M.headFront + 6);
    stage = 'knobs';
    for (const [id, g] of Object.entries(knobGeos)) {
      const k = add(g, knobMat, 'wood.knobs');
      k.position.set(x, knobY, knobZ0);
      k.visible = id === 'wave';
      knobVariants[id].push(k);
    }
    const capG = new THREE.CylinderGeometry(17, 17, 2.4, 64);
    capG.rotateX(Math.PI / 2);
    add(capG, capMat, 'metal.caps').position.set(x, knobY, knobZ0 + knobLen + 0.2);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(1.6, 11, 0.6), F.darkGap);
    mark.position.set(x, knobY + 8, knobZ0 + knobLen + 1.5);
    root.add(mark);
  }

  stage = 'paddle';
  // Paddle: Holzabdeckung mit Schlitz + Hebel (rechts = Ruhestellung)
  const paddleMat = mm.get('wood.paddle');
  {
    const s = new THREE.Shape();
    s.moveTo(-66, 314);
    s.lineTo(66, 314);
    s.quadraticCurveTo(84, 314, 84, 300);
    s.quadraticCurveTo(84, 286, 66, 286);
    s.quadraticCurveTo(0, 273, -66, 286);
    s.quadraticCurveTo(-84, 286, -84, 300);
    s.quadraticCurveTo(-84, 314, -66, 314);
    const g = swapUV(scaleUV(extrudeZ(s, 13, 3, 3, 16), 1 / 110, [0.3, -2.4]));
    g.computeBoundingBox();
    const front = g.boundingBox.max.z;
    add(g, paddleMat, 'wood.paddle').position.z = M.headFront;
    const slot = new THREE.Mesh(rbox(106, 5, 2, 1.2, 2), F.darkGap);
    slot.position.set(-6, 300, M.headFront + front - 0.4);
    root.add(slot);
    for (const x of [-76, 76]) {
      const stud = new THREE.Mesh(rbox(9, 11, 3, 1.5, 2), F.blackPlastic);
      stud.position.set(x, 301, M.headFront + front - 0.6);
      root.add(stud);
    }
    const lever = boxProjectUV(rbox(41, 56, 34, 6, 4), 70);
    const lv = add(lever, paddleMat, 'wood.paddle');
    lv.position.set(47.5, 312, M.headFront + front + 13);
    lv.rotation.x = -0.08;
  }

  stage = 'head';
  // Barista-Licht: LED-Leiste an der Unterseite des Kopfteils + Spot auf die Tropfschale
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x1c1c1c, toneMapped: false });
  {
    const led = new THREE.Mesh(rbox(120, 1.4, 3.6, 0.6, 1), ledMat);
    led.position.set(0, M.headBot - 0.5, 125.5);
    root.add(led);
  }
  const baristaSpot = new THREE.SpotLight(0xfff0d8, 0, 0, 0.82, 0.85, 2);
  baristaSpot.position.set(0, M.headBot - 3, 124);
  baristaSpot.target.position.set(0, M.baseTop, 110);
  root.add(baristaSpot, baristaSpot.target);

  stage = 'lower';
  // =========================================================================
  // Unterteil (trapezförmig, verjüngt nach unten und hinten)
  // =========================================================================
  {
    const zf = -0.5;
    const bot = M.baseTop;
    const topF = M.headBot;
    const topR = 262;
    const hwB = 135.5;
    const slope = 24 / 140.4; // Verjüngung laut Front-/Rückansicht
    const hwT = hwB + (topF - bot) * slope;
    const hwTR = hwB + (topR - bot) * slope;
    const zRB = -288;
    const zRT = zRB - (topR - bot) * (21 / 149.4);
    const fbl = [-hwB, bot, zf];
    const fbr = [hwB, bot, zf];
    const ftl = [-hwT, topF, zf];
    const ftr = [hwT, topF, zf];
    const rbl = [-hwB, bot, zRB];
    const rbr = [hwB, bot, zRB];
    const rtl = [-hwTR, topR, zRT];
    const rtr = [hwTR, topR, zRT];
    const g = polyhedron([
      [fbl, fbr, ftr, ftl],
      [rbr, rbl, rtl, rtr],
      [rbl, fbl, ftl, rtl],
      [fbr, rbr, rtr, ftr],
      [ftl, ftr, rtr, rtl],
      [rbl, rbr, fbr, fbl],
    ]);
    boxProjectUV(g);
    add(g, body.lower, 'body.lower');
  }

  stage = 'gauges';
  // Manometer (zwei gleich große, laut Frontansicht)
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
  makeGauge(-117.6, 175.6, 22, { max: 16, step: 1, label: 2, value: 9, unit: 'bar', zone: [8, 10] });
  makeGauge(117.6, 175.6, 22, { max: 3, step: 0.25, label: 1, value: 1.3, unit: 'bar', zone: [1, 1.5] });

  stage = 'groupcap';
  // =========================================================================
  // Brühgruppen-Kappe, Siebträger (zweiteilig), Heißwasser, Dampflanze
  // =========================================================================
  const gZ = M.groupZ;
  {
    const groupMat = mm.get('metal.group');
    add(new THREE.CylinderGeometry(55, 55, 11.5, 72), groupMat, 'metal.group').position.set(0, M.headBot - 5.75, gZ);
    add(new THREE.CylinderGeometry(46, 47.5, 7.5, 64), groupMat, 'metal.group').position.set(0, 234.75, gZ);
    const gasket = new THREE.Mesh(new THREE.CylinderGeometry(38.5, 38.5, 1.5, 48), F.gasket);
    gasket.position.set(0, 230.4, gZ);
    root.add(gasket);
  }
  stage = 'portafilter';
  const pfMat = mm.get('metal.portafilter');
  const handleVariants = {};
  {
    const pf = new THREE.Group();
    pf.position.set(0, 0, gZ);
    root.add(pf);
    add(new THREE.CylinderGeometry(36.5, 36, 13, 64), pfMat, 'metal.portafilter', pf).position.y = 223.5;
    for (const sx of [-1, 1]) {
      add(rbox(10, 7, 18, 2, 2), pfMat, 'metal.portafilter', pf).position.set(sx * 39, 226, 0);
    }
    const bowl = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 201),
        new THREE.Vector2(18, 201.5),
        new THREE.Vector2(28, 204),
        new THREE.Vector2(33, 210),
        new THREE.Vector2(35, 217),
      ],
      64,
    );
    add(bowl, pfMat, 'metal.portafilter', pf);
    add(new THREE.CylinderGeometry(8, 9, 9, 32), pfMat, 'metal.portafilter', pf).position.y = 197;
    for (const sx of [-1, 1]) {
      const sp = add(new THREE.CylinderGeometry(3, 3.4, 11, 20), pfMat, 'metal.portafilter', pf);
      sp.position.set(sx * 6.5, 188, 0);
      sp.rotation.z = sx * 0.28;
    }
    const handle = new THREE.Group();
    handle.position.set(0, 223, 0);
    handle.rotation.x = -0.07;
    pf.add(handle);
    const neck = new THREE.CylinderGeometry(7.5, 8.5, 22, 32);
    neck.rotateX(Math.PI / 2);
    add(neck, pfMat, 'metal.portafilter', handle).position.z = 45;
    // ergonomischer Griff (ca. 95 mm), Spitze bei Z ≈ 215
    const hprof = [
      [0, 0],
      [9.4, 0],
      [10, 4],
      [11, 15],
      [12.6, 32],
      [13.4, 44],
      [13, 52],
      [14.2, 64],
      [15.4, 76],
      [15.4, 84],
      [13.6, 90],
      [9.6, 94],
      [4, 96],
      [0, 96.4],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const handleMat = mm.get('wood.handle');
    const makeHandle = (segments, flat) => {
      let g = new THREE.LatheGeometry(hprof, segments, Math.PI / segments);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.1, uv.getY(i) * 1.4 + 0.2);
      if (flat) {
        g = g.toNonIndexed();
        g.computeVertexNormals();
      }
      g.rotateX(Math.PI / 2);
      const mesh = add(g, handleMat, 'wood.handle', handle);
      mesh.position.z = 54;
      return mesh;
    };
    handleVariants.round = makeHandle(48, false);
    handleVariants.facet = makeHandle(8, true);
    handleVariants.facet.visible = false;
  }

  stage = 'wand';
  const wandMat = mm.get('metal.wand');
  {
    add(new THREE.CylinderGeometry(11, 11, 17, 40), wandMat, 'metal.wand').position.set(-98, M.headBot - 8.5, 95);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6, 4, 24), F.darkGap);
    tip.position.set(-98, M.headBot - 19, 95);
    root.add(tip);
  }
  {
    // isolierte Cool-Touch-Dampflanze (Ø 12 mm), Verlauf laut Seitenansicht
    const pts = [
      [97, 250, 89],
      [97, 238, 89.5],
      [97, 226, 93],
      [97, 218, 104],
      [97, 214.5, 122],
      [97, 213, 140],
      [97, 209, 152],
      [97, 200, 159],
      [97, 180, 166],
      [97, 150, 175],
      [97, 134, 179.8],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    add(new THREE.TubeGeometry(curve, 120, 6, 24, false), wandMat, 'metal.wand');
    add(new THREE.SphereGeometry(10, 32, 16), wandMat, 'metal.wand').position.set(97, 247, 89);
    add(new THREE.CylinderGeometry(11, 11, 6, 6), wandMat, 'metal.wand').position.set(97, M.headBot - 2, 89);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6, 16, 24), F.blackPlastic);
    tip.position.set(97, 127, 182);
    tip.rotation.x = -0.29;
    root.add(tip);
  }

  stage = 'base';
  // =========================================================================
  // Basis, Tropfschale, Bodenwanne, Füße, Schalter
  // =========================================================================
  {
    const h = M.baseTop - M.footH;
    const g = boxProjectUV(rbox(M.baseHalfW * 2, h, M.baseFront - M.baseRear, 3, 3));
    add(g, body.base, 'body.base').position.set(0, M.footH + h / 2, (M.baseFront + M.baseRear) / 2);

    stage = 'drip';
    // Tropfschale: Kasten in Gehäusefarbe, oben Edelstahlrahmen mit Gitter
    const dz0 = M.baseFront + 1.5;
    const boxH = M.dripLipBot - M.footH - 0.5;
    const dg = boxProjectUV(rbox(M.dripHalfW * 2 - 3, boxH, M.dripFront - 1.5 - dz0, 3, 3));
    add(dg, body.base, 'body.base').position.set(0, M.footH + 0.5 + boxH / 2, (M.dripFront - 1.5 + dz0) / 2);

    const lipH = M.baseTop - 1.6 - M.dripLipBot;
    const outer = new THREE.Shape();
    outer.moveTo(-M.dripHalfW, -M.dripFront);
    outer.lineTo(M.dripHalfW, -M.dripFront);
    outer.lineTo(M.dripHalfW, -dz0);
    outer.lineTo(-M.dripHalfW, -dz0);
    outer.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-M.dripHalfW + 9, -M.dripFront + 9);
    hole.lineTo(-M.dripHalfW + 9, -dz0 - 8);
    hole.lineTo(M.dripHalfW - 9, -dz0 - 8);
    hole.lineTo(M.dripHalfW - 9, -M.dripFront + 9);
    hole.closePath();
    outer.holes.push(hole);
    const rimG = new THREE.ExtrudeGeometry(outer, {
      depth: lipH - 1.2,
      bevelEnabled: true,
      bevelThickness: 0.6,
      bevelSize: 0.6,
      bevelSegments: 2,
    });
    rimG.rotateX(-Math.PI / 2);
    boxProjectUV(rimG);
    add(rimG, mm.get('metal.grates'), 'metal.grates').position.y = M.dripLipBot + 0.6;
    const gw = M.dripHalfW * 2 - 18;
    const gd = M.dripFront - 9 - (dz0 + 8);
    const gMat = mm.get('metal.grates', { map: makeDripGrateTexture(gw, gd) });
    const gg = new THREE.PlaneGeometry(gw, gd);
    gg.rotateX(-Math.PI / 2);
    const grate = add(gg, gMat, 'metal.grates');
    grate.position.set(0, M.dripLipBot + lipH - 2.5, (M.dripFront - 9 + dz0 + 8) / 2);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(gw, 1, gd), F.trayInner);
    inner.position.set(0, M.dripLipBot - 4, grate.position.z);
    root.add(inner);

    const logoMat = mm.get('metal.logo', { map: logoTex, transparent: true, alphaTest: 0.35 });
    add(new THREE.PlaneGeometry(126, 15.75), logoMat, 'metal.logo').position.set(81, 57, M.dripFront - 1.15);

    stage = 'chassis';
    // Edelstahl-Bodenwanne unter der Basis (in Seiten- und Frontansicht sichtbar)
    const pan = boxProjectUV(rbox(240, M.footH - 5, 191, 2, 2));
    plain(pan, F.steel).position.set(0, 5 + (M.footH - 5) / 2, 2 - 191 / 2);
    // Wasseranschlüsse hinten unten (Rückansicht)
    for (const x of [-67, -86]) {
      const c = new THREE.CylinderGeometry(4.5, 4.5, 9, 20);
      plain(c, F.blackPlastic).position.set(x, M.footH - 6, -282);
    }
  }
  {
    // Füße: konisch (Ø 20 mm oben, Ø 35 mm unten), lackier- oder veredelbar + Gummipuffer
    const feetMat = mm.get('metal.feet');
    const g = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 2),
        new THREE.Vector2(17, 2),
        new THREE.Vector2(17.5, 3.2),
        new THREE.Vector2(14.5, 9),
        new THREE.Vector2(11.2, 17),
        new THREE.Vector2(10, M.footH - 1),
        new THREE.Vector2(10.5, M.footH),
        new THREE.Vector2(0, M.footH),
      ],
      48,
    );
    const pad = new THREE.CylinderGeometry(16, 16, 2, 40);
    for (const [x, z] of [
      [-132, 75.6],
      [132, 75.6],
      [-132, -270.6],
      [132, -270.6],
    ]) {
      add(g, feetMat, 'metal.feet').position.set(x, 0, z);
      plain(pad, F.rubber).position.set(x, 1, z);
    }
  }
  stage = 'base';
  {
    // Netzschalter rechts an der Basis, hinten
    const sx = M.baseHalfW;
    const housing = new THREE.Mesh(rbox(4, 25, 48, 1, 2), F.blackPlastic);
    housing.position.set(sx + 1, 60, -261);
    root.add(housing);
    const rocker = new THREE.Mesh(rbox(3, 18, 40, 1.4, 2), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.3 }));
    rocker.position.set(sx + 2.3, 60, -261);
    rocker.rotation.y = 0.05;
    root.add(rocker);
    const o = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.55, 8, 24), F.white);
    o.rotation.y = Math.PI / 2;
    o.position.set(sx + 4, 60, -252);
    root.add(o);
    const i = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 5.5), F.white);
    i.position.set(sx + 4, 60, -271);
    root.add(i);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 30),
      new THREE.MeshStandardMaterial({ map: makePlateTexture(), metalness: 0.6, roughness: 0.35 }),
    );
    plate.rotation.y = Math.PI / 2;
    plate.position.set(sx + 0.4, 60, -45);
    root.add(plate);
  }

  stage = 'rail';
  // =========================================================================
  // Cup Rail (Stangenreling auf Pfosten über den Seitenwangen und hinten)
  // =========================================================================
  const railGroup = new THREE.Group();
  railGroup.visible = false;
  root.add(railGroup);
  {
    const railMat = mm.get('metal.rail');
    const rx = M.halfW - M.slabT / 2;
    const zF = -22;
    const zR = -322;
    const yR = M.top + 15;
    const rodR = 2.8;
    const post = new THREE.CylinderGeometry(3.2, 3.6, 15, 24);
    for (const z of [zF, (zF + zR) / 2, zR]) {
      for (const sx of [-1, 1]) add(post, railMat, 'metal.rail', railGroup).position.set(sx * rx, M.top + 7.5, z);
    }
    const sideRod = new THREE.CylinderGeometry(rodR, rodR, zF - zR, 24);
    sideRod.rotateX(Math.PI / 2);
    for (const sx of [-1, 1]) {
      add(sideRod, railMat, 'metal.rail', railGroup).position.set(sx * rx, yR, (zF + zR) / 2);
      const cap = add(new THREE.SphereGeometry(rodR * 1.05, 20, 12), railMat, 'metal.rail', railGroup);
      cap.position.set(sx * rx, yR, zF);
      const corner = add(new THREE.SphereGeometry(rodR, 20, 12), railMat, 'metal.rail', railGroup);
      corner.position.set(sx * rx, yR, zR);
    }
    const backRod = new THREE.CylinderGeometry(rodR, rodR, rx * 2, 24);
    backRod.rotateZ(Math.PI / 2);
    add(backRod, railMat, 'metal.rail', railGroup).position.set(0, yR, zR);
  }

  stage = 'panels';
  // =========================================================================
  // Holzverkleidungen (optional): Seitenwangen oben, Seitenteile des Unterteils
  // =========================================================================
  const panelUpper = new THREE.Group();
  const panelLower = new THREE.Group();
  panelUpper.visible = false;
  panelLower.visible = false;
  root.add(panelUpper, panelLower);
  {
    const inset = 3;
    const t = 2.6;
    // Seitenwangen: Profil der Wange, leicht eingerückt, Maserung längs
    const prof = [
      [-inset, M.slabBotFront + inset],
      [-inset, M.top - inset],
      [M.rearTop + inset, M.top - inset],
      [M.rearBot + inset * 0.8, M.slabBotRear + inset],
    ];
    const g = swapUV(boxProjectUV(profileExtrudeX(prof, t, 0.6), 150));
    const mat = mm.get('wood.panelUpper');
    for (const sx of [-1, 1]) {
      add(g, mat, 'wood.panelUpper', panelUpper).position.x = sx < 0 ? -M.halfW - t + 0.01 : M.halfW - 0.01;
    }
    // Unterteil: dünne Platte auf jeder schrägen Seitenfläche
    const matL = mm.get('wood.panelLower');
    const bot = M.baseTop + 4;
    const top = M.slabBotFront - 1;
    const hwAt = (y) => 135.5 + (y - M.baseTop) * (24 / 140.4);
    const zFront = -inset - 0.5;
    const zRearAt = (y) => -288 - (y - M.baseTop) * (21 / 149.4) + inset;
    for (const sx of [-1, 1]) {
      const p = (y, z) => [sx * (hwAt(y) + 0.2), y, z];
      const q = (y, z) => [sx * (hwAt(y) + 0.2 + t), y, z];
      const a = p(bot, zFront);
      const b = p(top, zFront);
      const c = p(top, zRearAt(top));
      const d = p(bot, zRearAt(bot));
      const a2 = q(bot, zFront);
      const b2 = q(top, zFront);
      const c2 = q(top, zRearAt(top));
      const d2 = q(bot, zRearAt(bot));
      const faces =
        sx > 0
          ? [[a2, d2, c2, b2], [a, b, c, d], [a, a2, b2, b], [d, c, c2, d2], [b, b2, c2, c], [a, d, d2, a2]]
          : [[a2, b2, c2, d2], [a, d, c, b], [a, b, b2, a2], [d, d2, c2, c], [b, c, c2, b2], [a, a2, d2, d]];
      const gl = swapUV(boxProjectUV(polyhedron(faces), 150));
      add(gl, matL, 'wood.panelLower', panelLower);
    }
  }

  stage = 'screws';
  // =========================================================================
  // Schrauben (Positionen laut Frontansicht; Rückwand ist laut Zeichnung glatt)
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
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.quaternion.setFromUnitVectors(Zaxis, new THREE.Vector3(...normal).normalize());
    root.add(grp);
    add(screwHead, screwMat, 'metal.screws', grp);
    const s = new THREE.Mesh(socket, F.darkGap);
    s.position.z = 2.05;
    grp.add(s);
  };
  for (const sx of [-1, 1]) {
    addScrew(sx * 165.5, 362, 0.2);
    addScrew(sx * 165.5, 247, 0.2);
    addScrew(sx * 165, M.top + 0.2, -12, [0, 1, 0]);
    addScrew(sx * 165, M.top + 0.2, -330, [0, 1, 0]);
    addScrew(sx * 138, M.headTop + 0.1, 12, [0, 1, 0]);
    addScrew(sx * 138, M.headTop + 0.1, M.headFront - 12, [0, 1, 0]);
    addScrew(sx * 133, 218.3, -0.4);
    addScrew(sx * 117.5, 130.5, -0.4);
  }

  // =========================================================================
  // Rohbau (nur in der Montage-Animation sichtbar): Rahmen, Kessel, Pumpe,
  // Leitungen – vereinfacht nach den Explosionszeichnungen des Ersatzteilkatalogs
  // =========================================================================
  stage = 'skeleton';
  const skeleton = new THREE.Group();
  skeleton.visible = false;
  root.add(skeleton);
  {
    const S = skeleton;
    const Y = new THREE.Vector3(0, 1, 0);
    const box = (w, h, d, mat, x, y, z, r = 1) => {
      const m = plain(rbox(w, h, d, r, 1), mat, S);
      m.position.set(x, y, z);
      return m;
    };
    const cylZ = (r, len, mat, x, y, z, seg = 40) => {
      const g = new THREE.CylinderGeometry(r, r, len, seg);
      g.rotateX(Math.PI / 2);
      const m = plain(g, mat, S);
      m.position.set(x, y, z);
      return m;
    };
    const cylX = (r, len, mat, x, y, z, seg = 32) => {
      const g = new THREE.CylinderGeometry(r, r, len, seg);
      g.rotateZ(Math.PI / 2);
      const m = plain(g, mat, S);
      m.position.set(x, y, z);
      return m;
    };
    // Leitung mit Messing-Überwurfmuttern an beiden Enden
    const pipe = (pts, r, mat, nuts = true) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
      plain(new THREE.TubeGeometry(curve, 64, r, 12, false), mat, S);
      if (!nuts) return;
      for (const t of [0, 1]) {
        const nut = plain(new THREE.CylinderGeometry(r + 2.6, r + 2.6, 9, 6), F.brass, S);
        nut.position.copy(curve.getPointAt(t));
        nut.quaternion.setFromUnitVectors(Y, curve.getTangentAt(t));
      }
    };

    // Bodenrahmen mit Längsträgern (reicht vorne bis unter die Tropfschale)
    box(262, 4, 372, F.frame, 0, M.footH + 2, -98);
    for (const sx of [-1, 1]) box(10, 6, 372, F.frame, sx * 132, M.footH + 1, -98);
    for (const sx of [-1, 1]) box(6, 40, 272, F.frame, sx * 124, M.footH + 24, -142);
    // Frontblech mit Aussparungen (Pos. 8 im Katalog)
    {
      const fs = new THREE.Shape();
      fs.moveTo(-126, 96);
      fs.lineTo(126, 96);
      fs.lineTo(126, 246);
      fs.lineTo(-126, 246);
      fs.closePath();
      const hole = (cx, cy, r) => {
        const h = new THREE.Path();
        h.absarc(cx, cy, r, 0, Math.PI * 2, true);
        fs.holes.push(h);
      };
      const slotHole = (cx, y0, y1, w) => {
        const h = new THREE.Path();
        h.moveTo(cx - w / 2, y0);
        h.lineTo(cx - w / 2, y1);
        h.lineTo(cx + w / 2, y1);
        h.lineTo(cx + w / 2, y0);
        h.closePath();
        fs.holes.push(h);
      };
      hole(0, 212, 20);
      hole(-84, 176, 13);
      hole(84, 176, 13);
      slotHole(-42, 112, 152, 18);
      slotHole(42, 112, 152, 18);
      const fg = new THREE.ExtrudeGeometry(fs, { depth: 2.5, bevelEnabled: false, curveSegments: 24 });
      plain(fg, F.frame, S).position.z = -12.5;
    }
    // Rückstütze, Pfosten und obere Streben
    box(240, 204, 3, F.frame, 0, 196, -273);
    for (const sx of [-1, 1]) {
      box(8, 60, 8, F.frame, sx * 116, 272, -16);
      box(8, 8, 258, F.frame, sx * 116, 298, -144);
    }
    box(240, 8, 8, F.frame, 0, 298, -16);
    // Wassertank (transparent) im Unterbau
    box(220, 50, 190, F.tank, 0, 60, -172, 6);
    // Dampfkessel, liegend (3 l), mit Kesselböden und Spannbändern
    cylZ(52, 210, F.steel, -34, 212, -150, 48);
    for (const z of [-45, -255]) cylZ(53.5, 4, F.brass, -34, 212, z, 48);
    for (const z of [-110, -190]) {
      const band = plain(new THREE.TorusGeometry(53.5, 2.4, 8, 48), F.frame, S);
      band.position.set(-34, 212, z);
    }
    cylZ(16, 14, F.brass, -34, 212, -262, 24); // Heizelement-Flansch
    // Brühkessel hinter der Gruppe + Gruppenhals + Brühgruppe
    cylZ(32, 116, F.steel, 56, 300, -64);
    for (const z of [-6, -122]) cylZ(33, 3, F.brass, 56, 300, z);
    pipe(
      [
        [56, 300, -4],
        [40, 292, 24],
        [12, 278, 52],
        [0, 266, 66.5],
      ],
      13,
      F.chrome,
      false,
    );
    {
      const g = plain(new THREE.CylinderGeometry(38, 41, 28, 48), F.chrome, S);
      g.position.set(0, 250, M.groupZ);
    }
    // Rotationspumpe mit Motor
    cylX(40, 110, F.motor, 30, 136, -205);
    for (const x of [-10, 12, 34, 56, 78]) {
      const rib = plain(new THREE.TorusGeometry(40.5, 1.8, 6, 36), F.motorRib, S);
      rib.rotation.y = Math.PI / 2;
      rib.position.set(x, 136, -205);
    }
    cylX(23, 42, F.brass, 106, 136, -205, 24);
    // Elektronik an der Rückstütze
    box(118, 86, 3, F.pcb, -56, 172, -270);
    box(30, 18, 8, F.motor, -84, 190, -266, 1);
    box(22, 22, 6, F.motor, -40, 160, -266, 1);
    box(16, 10, 6, F.brass, -30, 196, -266, 1);
    // Magnetventile
    box(26, 32, 22, F.motor, -96, 140, -64, 3);
    box(26, 32, 22, F.motor, 70, 236, -150, 3);
    // Halteblech im Kopfteil für die Ventile
    box(250, 3, 142, F.frame, 0, 324, 55);
    for (const sx of [-1, 1]) box(4, 30, 120, F.frame, sx * 123, 310, 62);
    // Ventilschäfte für Dampf/Heißwasser und Paddle-Ventil im Kopfteil
    for (const sx of [-1, 1]) cylZ(7, 32, F.brass, sx * 115, 308, 114, 20);
    box(46, 22, 24, F.brass, 0, 304, 112, 3);
    // Kupferleitungen
    pipe([[128, 136, -205], [134, 162, -214], [108, 204, -224], [60, 226, -220], [16, 228, -212]], 4, F.copper);
    pipe([[-20, 262, -60], [30, 276, -12], [97, 282, 40], [97, 270, 80], [97, 254, 89]], 4, F.copper);
    pipe([[-62, 256, -60], [-90, 268, 0], [-98, 264, 60], [-98, 254, 95]], 4, F.copper);
    pipe([[128, 150, -196], [126, 230, -150], [92, 288, -112], [56, 300, -124]], 4, F.copper);
    pipe([[56, 322, -4], [32, 316, 58], [12, 306, 100]], 4, F.copper);
    pipe([[-96, 156, -64], [-70, 190, -90], [-50, 214, -120]], 3.5, F.copper);
    // Kabelbaum
    pipe([[-56, 215, -268], [-10, 246, -220], [20, 180, -212], [30, 176, -205]], 2.4, F.motor, false);
    pipe([[-20, 130, -268], [-80, 120, -150], [-96, 124, -64]], 2.4, F.motor, false);
  }

  // Gesamt-Skalierung: mm -> m
  root.scale.setScalar(0.001);

  return {
    root,
    pickables,
    skeleton,
    setDial(dial) {
      for (const g of gauges) {
        const old = g.faceMat.map;
        g.faceMat.map = makeGaugeTexture(g.spec, dial);
        g.faceMat.needsUpdate = true;
        old?.dispose();
      }
    },
    /** Cup Rail ein-/ausblenden */
    setRail(on) {
      railGroup.visible = !!on;
    },
    /** Holzverkleidungen ein-/ausblenden */
    setPanels({ upper, lower }) {
      panelUpper.visible = !!upper;
      panelLower.visible = !!lower;
    },
    /** Formen der Holzteile */
    setShapes({ knobs, handle }) {
      for (const [id, list] of Object.entries(knobVariants)) list.forEach((m) => (m.visible = id === knobs));
      if (!knobVariants[knobs]) knobVariants.wave.forEach((m) => (m.visible = true));
      handleVariants.round.visible = handle !== 'facet';
      handleVariants.facet.visible = handle === 'facet';
    },
    /** Barista-Licht: 0 = aus, 1 = voll */
    setBarista(level) {
      baristaSpot.intensity = level * 0.2;
      if (level > 0.01) ledMat.color.setRGB(1.6 * Math.max(0.35, level), 1.5 * Math.max(0.35, level), 1.3 * Math.max(0.35, level));
      else ledMat.color.setHex(0x1c1c1c);
    },
  };
}
