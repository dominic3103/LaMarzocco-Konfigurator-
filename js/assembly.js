// ---------------------------------------------------------------------------
// Montage-Animation "Konfiguration abschließen"
//
// Die Maschine baut sich von null an selbst zusammen:
//  1. Innenleben: Füße, Bodenrahmen, Bleche und Streben, Wassertank, Pumpe,
//     Dampf- und Brühkessel, Ventile, Elektronik; Kupferleitungen und Kabel
//     wachsen von Anschluss zu Anschluss.
//  2. Konfiguration: Gehäuseteile, Holz und Metallakzente fliegen in den
//     gewählten Farben und Hölzern von außerhalb des Bildes heran und rasten ein.
//  3. Die Kamera fährt einmal um die fertige Maschine.
//
// Alle Versätze sind in Millimetern im Modell-Koordinatensystem angegeben
// (X = Breite, Y = Höhe, Z = Tiefe, +Z = Front).
// ---------------------------------------------------------------------------
import * as THREE from 'three';

/**
 * Montageschritte in Reihenfolge.
 *  src:   'skeleton' = Innenleben (Kinder des Rohbaus), sonst Bauteile der Maschine
 *  from:  Richtung, aus der das Teil anfliegt     dist: Flugstrecke (mm)
 *  gap:   Abstand zum Start des vorigen Schritts (s)   dur: Flugdauer (s)
 *  stagger: Versatz zwischen den Teilen eines Schritts (s)
 *  spin:  Drehung während des Anflugs (Achse, Winkel)  heavy: Kamera ruckelt beim Einrasten
 *  perSide: Teile einzeln von links/rechts            pop: an Ort und Stelle einploppen
 *  drop:  fällt von oben und federt nach
 *  after: startet erst, wenn alle vorigen Teile sitzen (gap zählt ab dann)
 */
export const STAGES = [
  // --- Innenleben ---
  { id: 'chassis', from: [0, 1, 0], dist: 420, gap: 0, dur: 0.75, stagger: 0.07, drop: true },
  { id: 'sk-base', src: 'skeleton', from: [0, -1, 0.25], dist: 600, gap: 0.55, dur: 0.8, heavy: true },
  { id: 'sk-front', src: 'skeleton', from: [0, 0.15, 1], dist: 900, gap: 0.5, dur: 0.75 },
  { id: 'sk-rear', src: 'skeleton', from: [0, 0.15, -1], dist: 900, gap: 0.25, dur: 0.75 },
  { id: 'sk-struts', src: 'skeleton', from: [0, 1, 0], dist: 650, gap: 0.4, dur: 0.6, stagger: 0.05 },
  { id: 'sk-tank', src: 'skeleton', from: [0, -0.1, 1], dist: 900, gap: 0.4, dur: 0.75 },
  { id: 'sk-pump', src: 'skeleton', from: [1, 0.1, 0], dist: 900, gap: 0.4, dur: 0.85, spin: [[1, 0, 0], Math.PI * 2] },
  { id: 'sk-steam', src: 'skeleton', from: [-1, 0.55, 0], dist: 1000, gap: 0.45, dur: 0.95, heavy: true },
  { id: 'sk-brew', src: 'skeleton', from: [0.35, 1, 0.15], dist: 900, gap: 0.5, dur: 0.85 },
  { id: 'sk-head', src: 'skeleton', from: [0, 0.3, 1], dist: 900, gap: 0.45, dur: 0.7, stagger: 0.05 },
  { id: 'sk-valves', src: 'skeleton', pop: true, gap: 0.35, dur: 0.35, stagger: 0.12 },
  { id: 'sk-pcb', src: 'skeleton', from: [-0.2, 0, -1], dist: 800, gap: 0.3, dur: 0.6, stagger: 0.07 },
  { id: 'sk-pipes', src: 'skeleton', grow: true, gap: 0.4, dur: 0.65, stagger: 0.26 },
  { id: 'sk-wires', src: 'skeleton', grow: true, gap: 0.3, dur: 0.6, stagger: 0.2 },
  // --- Konfiguration ---
  { id: 'base', from: [0, -1, 0.35], dist: 650, gap: 0.45, after: true, dur: 0.9, heavy: true },
  { id: 'drip', from: [0, -0.25, 1], dist: 950, gap: 0.45, dur: 0.8 },
  { id: 'lower', from: [-1, 0.15, 0.35], dist: 1050, gap: 0.45, dur: 0.95, heavy: true },
  { id: 'gauges', from: [0, 0, 1], dist: 800, gap: 0.5, dur: 0.6, spin: [[0, 0, 1], Math.PI * 2] },
  { id: 'upper', from: [0.15, 1, -0.25], dist: 1050, gap: 0.2, dur: 1.0, heavy: true },
  { id: 'head', from: [0.25, 0.35, 1], dist: 1100, gap: 0.6, dur: 0.9, heavy: true },
  { id: 'groupcap', from: [0, -1, 0.55], dist: 900, gap: 0.5, dur: 0.65, spin: [[0, 1, 0], Math.PI] },
  { id: 'wand', from: [1, 0.2, 0.45], dist: 1000, gap: 0.25, dur: 0.8 },
  { id: 'portafilter', from: [-0.1, -0.3, 1], dist: 1000, gap: 0.35, dur: 0.9, spin: [[0, 1, 0], -0.9] },
  { id: 'paddle', from: [0.2, 0.5, 1], dist: 1000, gap: 0.4, dur: 0.7 },
  { id: 'knobs', from: [0, 0.1, 1], dist: 1000, gap: 0.2, dur: 0.8, spin: [[0, 0, 1], Math.PI * 3] },
  { id: 'panels', perSide: true, dist: 1100, gap: 0.45, dur: 0.9, heavy: true },
  { id: 'tray', from: [0, 1, 0], dist: 650, gap: 0.5, dur: 0.55 },
  { id: 'rail', from: [-0.2, 1, 0.35], dist: 850, gap: 0.3, dur: 0.9, spin: [[0, 1, 0], 0.7] },
  { id: 'screws', pop: true, gap: 0.55, dur: 0.3, stagger: 0.03 },
  { id: 'logo', pop: true, gap: 0.45, dur: 0.5 },
];

/** true, wenn der Schritt zum Innenleben gehört */
export const isInnerStage = (id) => id === 'chassis' || id.startsWith('sk-');

const REVEAL = { dur: 3.8, el: 14, dist: 1.46, az: -30 };
const TARGET = new THREE.Vector3(0, 0.185, 0);

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = THREE.MathUtils.lerp;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t, s = 1.15) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
function easeOutBounce(t) {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

export class AssemblyShow {
  /**
   * @param {import('./viewer.js').Viewer} viewer
   * @param {{root: THREE.Group, skeleton: THREE.Group}} model
   * @param {{onStage?: Function, onProgress?: Function, onDone?: Function}} hooks
   * @param {{stages?: object[], isInner?: Function, target?: number[], dist?: number}} opts
   *   eigener Ablaufplan (z. B. für die Mühle), Drehpunkt und Abstandsfaktor der Kamera
   */
  constructor(viewer, model, hooks = {}, opts = {}) {
    this.viewer = viewer;
    this.model = model;
    this.hooks = hooks;
    this.stages = opts.stages || STAGES;
    this.isInner = opts.isInner || isInnerStage;
    this.target = opts.target ? new THREE.Vector3(...opts.target) : TARGET.clone();
    this.dist = opts.dist || 1;
    this.items = [];
    this.timeline = [];
    this.running = false;
    this.ticker = null;
    this.distScale = 1;
  }

  get active() {
    return this.running;
  }

  /** Hochformat (Handy): weiter weg, damit die ganze Maschine ins Bild passt */
  #fitDistance() {
    const a = this.viewer.camera.aspect;
    this.distScale = a < 0.8 ? 1.42 : a < 1.1 ? 1.15 : 1;
  }

  /** Bauteile einsammeln und Zeitplan berechnen (nur sichtbare Teile der aktuellen Konfiguration). */
  #prepare() {
    this.items = [];
    this.timeline = [];
    let t = 0.6; // die Bühne ist kurz leer
    let first = true;
    let innerEnd = 0;
    let outerStart = null;
    for (const st of this.stages) {
      const pool = st.src === 'skeleton' ? this.model.skeleton.children : this.model.root.children;
      const objs = pool.filter((o) => o.userData.stage === st.id && o.visible && (o.isMesh || o.isGroup));
      const parts = [];
      for (const o of objs) {
        if (st.perSide) {
          for (const c of o.children) if (c.visible) parts.push(c);
        } else parts.push(o);
      }
      if (!parts.length) continue;
      if (!first) {
        t = st.after ? this.items.reduce((m, it) => Math.max(m, it.start + it.dur), 0) + st.gap : t + st.gap;
      }
      first = false;
      const start = t;
      if (!this.isInner(st.id) && outerStart === null) outerStart = start;

      if (st.grow) {
        // Leitungen wachsen nacheinander; Muttern ploppen an den Enden ein
        const tubes = parts.filter((p) => p.userData.kind === 'tube');
        tubes.forEach((tube, i) => {
          const ts = start + i * st.stagger;
          this.items.push(this.#item(tube, st, { start: ts, grow: true }));
          for (const nut of parts.filter((p) => p.userData.kind === 'nut' && p.userData.pipe === tube.userData.pipe)) {
            const ns = nut.userData.end === 0 ? ts - 0.12 : ts + st.dur - 0.08;
            this.items.push(this.#item(nut, st, { start: ns, pop: true, dur: 0.28 }));
          }
        });
      } else {
        parts.forEach((obj, i) => {
          // Rohre in normalen Schritten (z. B. Gruppenhals) wachsen ebenfalls
          if (obj.userData.kind === 'tube') {
            this.items.push(this.#item(obj, st, { start: start + 0.25, grow: true }));
            return;
          }
          let dir;
          if (st.perSide) {
            obj.geometry.computeBoundingBox();
            const cx = (obj.geometry.boundingBox.min.x + obj.geometry.boundingBox.max.x) / 2 + obj.position.x;
            // Seitenplatten von links/rechts, die Rückplatte der Holzumrandung von hinten
            dir = Math.abs(cx) < 5 ? new THREE.Vector3(0, 0.15, -1) : new THREE.Vector3(Math.sign(cx), 0.12, 0.18);
          } else dir = new THREE.Vector3(...(st.from || [0, 0, 1]));
          const extra = st.perSide ? i * 0.08 : 0;
          this.items.push(this.#item(obj, st, { start: start + (st.stagger || 0) * i + extra, dir: dir.normalize(), index: i }));
        });
      }
      const stageEnd = this.items.reduce((m, it) => Math.max(m, it.start + it.dur), 0);
      if (this.isInner(st.id)) innerEnd = stageEnd;
      this.timeline.push({ id: st.id, at: start, done: false });
    }
    const last = this.items.reduce((m, it) => Math.max(m, it.start + it.dur), 0);
    this.buildEnd = last + 0.35;
    this.revealStart = this.buildEnd + 0.25;
    this.total = this.revealStart + REVEAL.dur;
    // Kamerafahrt: nah am Innenleben, beim Gehäuse etwas zurück, dann zur Schlussansicht
    const oStart = outerStart ?? this.buildEnd;
    const iEnd = innerEnd || oStart;
    this.camKeys = [
      { t: 0, az: -74, el: 30, d: 1.5 },
      { t: iEnd * 0.55, az: -54, el: 25, d: 1.3 },
      { t: iEnd, az: -38, el: 19, d: 1.34 },
      { t: Math.min(oStart + 1.8, this.buildEnd - 0.5), az: -50, el: 23, d: 1.72 },
      { t: this.buildEnd, az: REVEAL.az, el: 17, d: 1.52 },
    ].sort((a, b) => a.t - b.t);
  }

  #item(obj, st, { start, dir = null, index = 0, pop = false, grow = false, dur = null }) {
    const isPop = pop || !!st.pop;
    return {
      obj,
      stage: st.id,
      start,
      dur: dur ?? st.dur,
      pop: isPop,
      grow,
      drop: !!st.drop,
      heavy: !!st.heavy,
      offset: dir ? dir.multiplyScalar(st.dist || 0) : new THREE.Vector3(),
      spin: st.spin ? { axis: new THREE.Vector3(...st.spin[0]).normalize(), angle: st.spin[1] } : null,
      // leichtes Taumeln beim Anflug, je Teil etwas anders
      tumble:
        isPop || grow || st.drop
          ? null
          : { axis: new THREE.Vector3(Math.sin(index * 1.7 + 1), Math.cos(index * 2.3), Math.sin(index * 0.9 + 2)).normalize(), angle: 0.35 },
      pos: obj.position.clone(),
      quat: obj.quaternion.clone(),
      scale: obj.scale.clone(),
      landed: false,
    };
  }

  /** Animation starten (läuft im Render-Loop des Viewers). */
  play() {
    if (this.running) this.#finishItems();
    this.#fitDistance();
    this.#prepare();
    this.running = true;
    this.time = 0;
    this.shake = 0;
    this.model.skeleton.visible = true;
    // Bodenschatten erst mit den ersten Teilen einblenden
    this.contact = this.viewer.rig?.contact || null;
    this.contactBase = this.contact ? this.contact.material.opacity : 0;
    for (const it of this.items) this.#place(it, 0);
    this.viewer.setInteractive(false);
    this.viewer.syncControls();
    this.ticker = (dt) => this.#update(dt);
    this.viewer.addTicker(this.ticker);
  }

  /** Zu einem Zeitpunkt springen (Sekunden seit Start) – für Vorschaubilder und Tests */
  seek(t) {
    if (!this.running) return;
    this.time = Math.max(0, t);
    this.#update(0);
  }

  /** Sofort zum fertigen Zustand springen. */
  skip() {
    if (!this.running) {
      // auch ohne laufende Animation: Endzustand + Abschluss melden
      this.#fitDistance();
      this.#prepare();
      this.#finishItems();
      this.#setCamera(REVEAL.az, REVEAL.el, REVEAL.dist);
      this.hooks.onProgress?.(1);
      this.hooks.onDone?.();
      return;
    }
    this.time = this.total;
    this.#update(0);
  }

  /** Animation beenden und alles in den Normalzustand bringen. */
  exit() {
    if (this.running) {
      this.viewer.removeTicker(this.ticker);
      this.running = false;
    }
    this.#finishItems();
    this.#restoreContact();
    this.viewer.setInteractive(true);
    this.viewer.requestRender();
  }

  #restoreContact() {
    if (this.contact) this.contact.material.opacity = this.contactBase;
  }

  #finishItems() {
    for (const it of this.items) {
      it.obj.position.copy(it.pos);
      it.obj.quaternion.copy(it.quat);
      it.obj.scale.copy(it.scale);
      it.obj.visible = true;
      if (it.grow) it.obj.geometry.setDrawRange(0, Infinity);
    }
    this.model.skeleton.visible = false;
  }

  /** Teil zum Zeitpunkt t (Sekunden seit Start) platzieren. */
  #place(it, time) {
    const raw = (time - it.start) / it.dur;
    if (raw <= 0) {
      it.obj.visible = false;
      return;
    }
    it.obj.visible = true;
    const t = clamp01(raw);
    if (it.grow) {
      const u = it.obj.userData;
      const seg = Math.max(1, Math.round(easeInOutCubic(t) * u.segments));
      it.obj.geometry.setDrawRange(0, t >= 1 ? Infinity : seg * u.radial * 6);
    } else if (it.pop) {
      const s = Math.max(0.001, easeOutBack(t, 2.2));
      it.obj.scale.copy(it.scale).multiplyScalar(s);
      it.obj.position.copy(it.pos);
      it.obj.quaternion.copy(it.quat);
      if (it.obj.children.length) it.obj.rotateZ((1 - easeOutCubic(t)) * Math.PI);
    } else {
      const k = it.drop ? easeOutBounce(t) : it.heavy ? easeOutCubic(t) : easeOutBack(t);
      it.obj.position.copy(it.pos).addScaledVector(it.offset, 1 - k);
      it.obj.scale.copy(it.scale);
      const r = 1 - easeOutCubic(t);
      it.obj.quaternion.copy(it.quat);
      if (it.tumble) it.obj.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(it.tumble.axis, it.tumble.angle * r));
      if (it.spin) it.obj.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(it.spin.axis, it.spin.angle * r));
    }
    if (t >= 1 && !it.landed) {
      it.landed = true;
      if (it.heavy) this.shake = Math.max(this.shake, 1);
    }
  }

  #setCamera(azDeg, elDeg, dist, jitter = 0) {
    const az = THREE.MathUtils.degToRad(azDeg);
    const el = THREE.MathUtils.degToRad(elDeg);
    const cam = this.viewer.camera;
    dist *= this.distScale * this.dist;
    const T = this.target;
    cam.position.set(T.x + dist * Math.cos(el) * Math.sin(az), T.y + dist * Math.sin(el), T.z + dist * Math.cos(el) * Math.cos(az));
    if (jitter) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter));
    this.viewer.controls.target.copy(T);
    cam.lookAt(T);
  }

  /** Kamera entlang der Stützpunkte (weich interpoliert) */
  #buildCamera(time) {
    const k = this.camKeys;
    let i = 0;
    while (i < k.length - 2 && time > k[i + 1].t) i++;
    const a = k[i];
    const b = k[i + 1];
    const p = easeInOutCubic(clamp01((time - a.t) / Math.max(0.001, b.t - a.t)));
    this.#setCamera(lerp(a.az, b.az, p), lerp(a.el, b.el, p), lerp(a.d, b.d, p), this.shake * 0.006);
  }

  #update(dt) {
    this.time += dt;
    const time = this.time;
    for (const it of this.items) this.#place(it, time);
    if (this.contact) this.contact.material.opacity = this.contactBase * easeOutCubic(clamp01((time - 0.5) / 2.2));

    // Fortschritt der Montageschritte melden
    this.timeline.forEach((st, i) => {
      if (!st.done && time >= st.at) {
        st.done = true;
        this.hooks.onStage?.(st.id, i, this.timeline.length);
      }
    });

    this.shake = Math.max(0, this.shake - dt * 5);
    if (time < this.revealStart) {
      this.#buildCamera(time);
    } else {
      // Innenleben ist jetzt komplett verdeckt
      this.model.skeleton.visible = false;
      const p = easeInOutCubic(clamp01((time - this.revealStart) / REVEAL.dur));
      this.#setCamera(REVEAL.az + 360 * p, lerp(17, REVEAL.el, p), lerp(1.52, REVEAL.dist, p));
    }
    this.hooks.onProgress?.(clamp01(time / this.total));

    if (time >= this.total) {
      this.viewer.removeTicker(this.ticker);
      this.running = false;
      this.#finishItems();
      this.#restoreContact();
      this.#setCamera(REVEAL.az, REVEAL.el, REVEAL.dist);
      this.viewer.syncControls();
      this.hooks.onDone?.();
      return false;
    }
    return true;
  }
}
