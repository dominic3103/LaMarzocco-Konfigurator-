// ---------------------------------------------------------------------------
// Bentwood H75 (Grind-by-Weight-Espressomühle, 75 mm Blind Burrs)
//
// Maße in Millimeter. Grundlage: Herstellerangaben (bentwoodcoffee.ch:
// 170 × 302 × 444 mm mit 600-g-Trichter, 13,5 kg, 2,4"-Saphirglasdisplay,
// verstellbarer Siebträgerhalter) und die Werksfotos der Farbvarianten
// (Schwarz/Walnuss, Schwarz, Weiß). Eine bemaßte Zeichnung veröffentlicht
// Bentwood nicht; Gehäuse (170 × 200 × 262 mm), Display, Auslauf, Halter und
// Trichter sind über die Herstellermaße aus den Fotos abgeleitet. Der
// Siebträgerhalter ist an Front- und Dreiviertelansichten von beiden Seiten
// (mit und ohne Siebträger) nachgemessen.
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

/** Flächen umdrehen (nach einer Spiegelung mit scale(-1, 1, 1)) */
function flipFaces(g) {
  const out = g.index ? g.toNonIndexed() : g;
  const p = out.attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    for (const name of Object.keys(out.attributes)) {
      const a = out.attributes[name];
      for (let c = 0; c < a.itemSize; c++) {
        const t = a.array[(i + 1) * a.itemSize + c];
        a.array[(i + 1) * a.itemSize + c] = a.array[(i + 2) * a.itemSize + c];
        a.array[(i + 2) * a.itemSize + c] = t;
      }
    }
  }
  out.computeVertexNormals();
  return out;
}

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
    g.position.set(FX, 227, HD + 6);
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
    // Auslaufgehäuse direkt unter dem Display: leicht erhaben, oben gerade, unten rund,
    // mit hochovaler Öffnung (Werksfotos: ca. 40 × 67 mm, Öffnung ca. 32 × 52 mm)
    const HT = 199;
    const HBOT = 132;
    const hw = 20;
    const hs = new THREE.Shape();
    hs.moveTo(FX - hw, HT - 3);
    hs.lineTo(FX - hw, HBOT + hw);
    hs.absarc(FX, HBOT + hw, hw, Math.PI, Math.PI * 2, false);
    hs.lineTo(FX + hw, HT - 3);
    hs.quadraticCurveTo(FX + hw, HT, FX + hw - 3, HT);
    hs.lineTo(FX - hw + 3, HT);
    hs.quadraticCurveTo(FX - hw, HT, FX - hw, HT - 3);
    const hole = new THREE.Path();
    hole.absellipse(FX, 166, 16, 26, 0, Math.PI * 2, true);
    hs.holes.push(hole);
    B.add(boxProjectUV(plateZ(hs, HD - 1, 5, 0.9, 48)), bodyMat, S('body.main'));
    // dunkler Schacht hinter der Öffnung
    const shaft = B.plain(new THREE.CylinderGeometry(16, 16, 10, 40, 1, true), F.darkGap);
    shaft.scale.set(1, 1, 26 / 16);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(FX, 166, HD - 1);
    shaft.material = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9, side: THREE.DoubleSide });
    const back = B.plain(new THREE.CircleGeometry(1, 40), F.darkGap);
    back.scale.set(16, 26, 1);
    back.position.set(FX, 166, HD - 5.5);
    // Rohr Ø 29 mm, 50° nach vorn unten (füllt die 52 mm hohe Öffnung), Mündung schräg nach vorn-unten offen
    const ang = (50 * Math.PI) / 180;
    const d = new THREE.Vector3(0, -Math.sin(ang), Math.cos(ang));
    const P0 = new THREE.Vector3(FX, 166, HD + 4); // Achse durch die Mitte der Öffnung
    const M = P0.clone().addScaledVector(d, 27); // Mitte der Mündung
    const L = 60;
    const A = M.clone().addScaledVector(d, -L);
    const prof = [];
    for (let k = 0; k <= 30; k++) prof.push([14.5, (L * 1.4 * k) / 30]);
    for (let k = 30; k >= 0; k--) prof.push([13.6, (L * 1.4 * k) / 30]);
    const g = latheY(prof, 56);
    // Achse +Y -> d, dann an der Mündungsebene schräg abschneiden
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
    g.translate(A.x, A.y, A.z);
    const n = new THREE.Vector3(0, -Math.sin(0.21), Math.cos(0.21)); // Mündungsebene: nach vorn, 12° nach unten
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const over = v.clone().sub(M).dot(n);
      if (over > 0) {
        v.addScaledVector(d, -over / d.dot(n));
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
    g.computeVertexNormals();
    B.add(g, mat('metal.spout'), S('metal.spout'));
  }

  // =========================================================================
  // Verstellbarer Siebträgerhalter
  // =========================================================================
  B.stage('fork');
  {
    // Höhenverstellbarer Siebträgerhalter nach den Werksfotos (Front, Dreiviertel links/rechts,
    // mit und ohne Siebträger), Maße über die Gerätebreite 170 mm aus der Frontansicht:
    // - gefräster Block 100 × 78,5 mm, 27 mm hoch, mit Trichterkegel (oben Ø 87, unten Ø 62);
    //   vorn bleiben nur 5,8 mm starke Außenwände stehen, dazwischen ist die Front bis auf eine
    //   5 mm hohe Lippe ausgeschnitten (Frontfoto: Kegelfläche reicht bis an die Wände)
    // - je Seite ein Flachband (3,8 × 12 mm) in einer Nut der Wange, mit Langloch und Schraube,
    //   unten nach innen abgekantet
    // - U-förmige Auflage (3 mm) mit zwei nach vorn ausgestellten Zinken, Gummi auf dem Steg
    const fm = mat('metal.fork');
    const add = (g) => B.add(boxProjectUV(g), fm, S('metal.fork'));
    const yT = 122; // Oberkante Block (Frontfoto: rund 11 mm unter der Mündung des Auslaufs)
    const yEb = yT - 27; // Unterkante Wangen
    const yCb = yT - 21.5; // Unterkante Mittelteil (Lippe)
    const yLt = yT - 16.5; // Oberkante Lippe = Unterkante Kegel
    const D = 78.5; // Tiefe ab Front
    const ZC = 45.5; // Trichterachse ab Front
    const EI = 44.2; // Innenseite der vorderen Außenwände
    const X0 = 45.6; // Nut für das Flachband
    const WO = 50; // Außenseite
    const rTop = 43.5;
    const rBot = 31;
    const rAt = (y) => rBot + ((rTop - rBot) * (y - yLt)) / (yT - yLt);
    const BAR = { z0: 64, z1: 76, t: 3.8 };
    // Grundriss-Koordinaten (x relativ zu FX, z relativ zur Front) -> Shape für plateY
    const shp = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(FX + x, HD + z)));
    const rectXZ = (x0, z0, x1, z1) => shp([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
    // (a) Wangen unterhalb des Mittelteils
    // (unten 16,5 mm breit, Frontfoto)
    for (const sx of [-1, 1]) add(plateY(rectXZ(sx > 0 ? 33.5 : -X0, 0, sx > 0 ? X0 : -33.5, D), yEb, yCb - yEb + 0.02, 0));
    // (b) Lippe mit Bohrung (Ø 62): hinten volles Material, vorn ein schmaler Ring um die
    //     Öffnung, an den Wänden je ein Absatz (Fotos: dünne gebogene Kante mit Stufen)
    {
      const RL = rBot + 3;
      const xs = 33.5;
      const ze = ZC + Math.sqrt(RL * RL - xs * xs);
      const pts = [[-X0, 0], [X0, 0], [X0, D], [xs, D], [xs, ze]];
      const te = Math.asin(xs / RL);
      for (let k = 0; k <= 48; k++) {
        const a = te - (2 * te * k) / 48;
        pts.push([RL * Math.sin(a), Math.min(D, ZC + RL * Math.cos(a))]);
      }
      pts.push([-xs, ze], [-xs, D], [-X0, D]);
      const sh = shp(pts);
      const hole = new THREE.Path();
      hole.absarc(FX, HD + ZC, rBot, 0, Math.PI * 2, true);
      sh.holes.push(hole);
      add(plateY(sh, yCb, yLt - yCb, 0, 64));
    }
    // (c) Kegelbereich in dünnen Lagen: Rechteck minus Kreis minus Frontausschnitt
    const layer = (r) => {
      const pts = [[-X0, 0], [X0, 0], [X0, D], [EI, D]];
      const arc = (a0, a1, n = 48) => {
        for (let k = 0; k <= n; k++) {
          const a = a0 + ((a1 - a0) * k) / n;
          pts.push([r * Math.sin(a), ZC + r * Math.cos(a)]);
        }
      };
      if (r > EI) {
        const t = Math.asin(EI / r);
        arc(t, Math.PI * 2 - t);
      } else {
        pts.push([EI, ZC]);
        arc(Math.PI / 2, Math.PI * 1.5);
        pts.push([-EI, ZC]);
      }
      pts.push([-EI, D], [-X0, D]);
      return shp(pts);
    };
    const NL = 17;
    for (let i = 0; i < NL; i++) {
      const y0 = yLt + ((yT - yLt) * i) / NL;
      const y1 = yLt + ((yT - yLt) * (i + 1)) / NL;
      add(plateY(layer(rAt(y1)), y0, y1 - y0 + 0.02, 0, 64));
    }
    // glatte Kegelfläche innen (deckt die Lagen ab), nur wo Material ist
    {
      const prof = [];
      for (let k = 0; k <= 18; k++) {
        const y = yT - ((yT - yLt) * k) / 18;
        prof.push([rAt(y), y]);
      }
      const cone = latheY(prof, 128).toNonIndexed();
      const p = cone.attributes.position;
      const keep = [];
      for (let i = 0; i < p.count; i += 3) {
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (let k = 0; k < 3; k++) {
          cx += p.getX(i + k) / 3;
          cy += p.getY(i + k) / 3;
          cz += p.getZ(i + k) / 3;
        }
        if (Math.abs(cx) < EI - 0.2 && cz > 0.3 && cy > yLt + 0.1) continue; // Frontausschnitt
        for (let k = 0; k < 3; k++) keep.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k));
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
      g.computeVertexNormals();
      g.translate(FX, 0, HD + ZC);
      add(g);
    }
    // (d) Außenhaut der Wangen vor und hinter der Nut
    for (const sx of [-1, 1]) {
      const xa = sx > 0 ? X0 : -WO;
      const xb = sx > 0 ? WO : -X0;
      add(plateY(rectXZ(xa, 0, xb, BAR.z0 - 0.4), yEb, yT - yEb, 0.5));
      add(plateY(rectXZ(xa, BAR.z1 + 0.4, xb, D), yEb, yT - yEb, 0.5));
    }
    // Flachbänder: senkrecht in der Nut, unten mit Radius nach innen abgekantet
    const yF = yT - 66; // Oberkante der Auflage
    for (const sx of [-1, 1]) {
      const xo = WO - 0.6;
      const xi = xo - BAR.t;
      const ri = 3;
      const ro = ri + BAR.t;
      const sh = new THREE.Shape();
      sh.moveTo(xo, yT - 3);
      sh.lineTo(xo, yF + ro);
      sh.absarc(xo - ro, yF + ro, ro, 0, -Math.PI / 2, true);
      sh.lineTo(EI, yF);
      sh.lineTo(EI, yF + BAR.t);
      sh.lineTo(xi - ri, yF + BAR.t);
      sh.absarc(xi - ri, yF + BAR.t + ri, ri, -Math.PI / 2, 0, false);
      sh.lineTo(xi, yT - 3);
      sh.closePath();
      const g = plateZ(sh, HD + BAR.z0, BAR.z1 - BAR.z0, 0.4, 12);
      if (sx < 0) g.scale(-1, 1, 1);
      const m = add(g);
      m.position.x = FX;
      if (sx < 0) m.geometry = flipFaces(m.geometry);
      // Langloch und Schraube auf der Außenseite
      const slot = B.plain(new THREE.PlaneGeometry(10, 3.2), F.darkGap);
      slot.rotation.set(0, (sx * Math.PI) / 2, Math.PI / 2);
      slot.position.set(FX + sx * (xo + 0.05), yT - 18, HD + (BAR.z0 + BAR.z1) / 2);
      const head = B.plain(latheY([[0, 0], [3.4, 0], [3.4, 1.1], [2.6, 1.8], [0, 1.9]], 24), F.chrome);
      head.rotation.z = -sx * (Math.PI / 2);
      head.position.set(FX + sx * xo, yT - 20, HD + (BAR.z0 + BAR.z1) / 2);
      const hex = B.plain(new THREE.CircleGeometry(1.3, 6), F.darkGap);
      hex.rotation.y = (sx * Math.PI) / 2;
      hex.position.set(FX + sx * (xo + 1.95), yT - 20, HD + (BAR.z0 + BAR.z1) / 2);
    }
    // U-förmige Auflage mit zwei Zinken, Gummi auf dem Steg
    {
      const sh = filletShape(
        [
          [FX - 47, HD + 52],
          [FX + 47, HD + 52],
          [FX + 52, HD + 112],
          [FX + 25.4, HD + 112],
          [FX + 26, HD + 74],
          [FX - 26, HD + 74],
          [FX - 25.4, HD + 112],
          [FX - 52, HD + 112],
        ],
        [4, 4, 4, 3, 3, 3, 3, 4],
        4,
      );
      add(plateY(sh, yF - 3, 3, 0.6, 24));
      const pad = new THREE.Shape();
      pad.moveTo(FX - 25.5, HD + 53);
      pad.lineTo(FX + 25.5, HD + 53);
      pad.lineTo(FX + 25.5, HD + 74);
      pad.quadraticCurveTo(FX, HD + 92, FX - 25.5, HD + 74); // Vorderkante nach vorn gewölbt
      pad.closePath();
      B.plain(plateY(pad, yF - 0.5, 3.4, 0.9, 24), new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.85 }));
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
