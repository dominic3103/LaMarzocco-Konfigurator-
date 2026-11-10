// ---------------------------------------------------------------------------
// Montage-Animation "Konfiguration abschließen"
//
// Ablauf: Die konfigurierten Bauteile verschwinden, sichtbar bleibt der Rohbau
// (Rahmen, Kessel, Pumpe, Leitungen). Danach fliegen die Teile in ihren gewählten
// Farben und Hölzern von außerhalb des Bildes heran und rasten ein. Zum Schluss
// fährt die Kamera einmal um die fertige Maschine.
//
// Alle Versätze sind in Millimetern im Modell-Koordinatensystem angegeben
// (X = Breite, Y = Höhe, Z = Tiefe, +Z = Front).
// ---------------------------------------------------------------------------
import * as THREE from 'three';

/**
 * Montageschritte in Reihenfolge.
 *  from:  Richtung, aus der das Teil anfliegt   dist: Flugstrecke (mm)
 *  gap:   Abstand zum Start des vorigen Schritts (s)   dur: Flugdauer (s)
 *  spin:  Drehung während des Anflugs (Achse, Winkel)  heavy: Kamera ruckelt beim Einrasten
 *  perSide: Teile einzeln von links/rechts            pop: an Ort und Stelle einploppen
 */
export const STAGES = [
  { id: 'base', from: [0, -1, 0.35], dist: 650, gap: 0, dur: 0.95, heavy: true },
  { id: 'drip', from: [0, -0.25, 1], dist: 950, gap: 0.55, dur: 0.85 },
  { id: 'lower', from: [-1, 0.15, 0.35], dist: 1050, gap: 0.55, dur: 1.0, heavy: true },
  { id: 'gauges', from: [0, 0, 1], dist: 800, gap: 0.6, dur: 0.6, spin: [[0, 0, 1], Math.PI * 2] },
  { id: 'upper', from: [0.15, 1, -0.25], dist: 1050, gap: 0.25, dur: 1.05, heavy: true },
  { id: 'head', from: [0.25, 0.35, 1], dist: 1100, gap: 0.7, dur: 0.95, heavy: true },
  { id: 'groupcap', from: [0, -1, 0.55], dist: 900, gap: 0.6, dur: 0.7, spin: [[0, 1, 0], Math.PI] },
  { id: 'wand', from: [1, 0.2, 0.45], dist: 1000, gap: 0.3, dur: 0.85 },
  { id: 'portafilter', from: [-0.1, -0.3, 1], dist: 1000, gap: 0.4, dur: 0.95, spin: [[0, 1, 0], -0.9] },
  { id: 'paddle', from: [0.2, 0.5, 1], dist: 1000, gap: 0.5, dur: 0.75 },
  { id: 'knobs', from: [0, 0.1, 1], dist: 1000, gap: 0.25, dur: 0.85, spin: [[0, 0, 1], Math.PI * 3] },
  { id: 'panels', perSide: true, dist: 1100, gap: 0.55, dur: 0.95, heavy: true },
  { id: 'tray', from: [0, 1, 0], dist: 650, gap: 0.6, dur: 0.6 },
  { id: 'rail', from: [-0.2, 1, 0.35], dist: 850, gap: 0.35, dur: 0.95, spin: [[0, 1, 0], 0.7] },
  { id: 'screws', pop: true, gap: 0.65, dur: 0.32, stagger: 0.035 },
  { id: 'logo', pop: true, gap: 0.5, dur: 0.5 },
];

const BUILD_CAM = { az0: -64, az1: -30, el0: 26, el1: 17, d0: 1.78, d1: 1.52 };
const REVEAL = { dur: 4.4, el: 14, dist: 1.46 };
const TARGET = new THREE.Vector3(0, 0.185, 0);

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t, s = 1.15) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

export class AssemblyShow {
  /**
   * @param {import('./viewer.js').Viewer} viewer
   * @param {{root: THREE.Group, skeleton: THREE.Group}} model
   * @param {{onStage?: Function, onProgress?: Function, onDone?: Function}} hooks
   */
  constructor(viewer, model, hooks = {}) {
    this.viewer = viewer;
    this.model = model;
    this.hooks = hooks;
    this.items = [];
    this.timeline = [];
    this.running = false;
    this.ticker = null;
    this.distScale = 1;
  }

  /** Hochformat (Handy): weiter weg, damit die ganze Maschine ins Bild passt */
  #fitDistance() {
    const a = this.viewer.camera.aspect;
    this.distScale = a < 0.8 ? 1.42 : a < 1.1 ? 1.15 : 1;
  }

  get active() {
    return this.running;
  }

  /** Bauteile einsammeln und Zeitplan berechnen (nur sichtbare Teile der aktuellen Konfiguration). */
  #prepare() {
    this.items = [];
    this.timeline = [];
    const children = this.model.root.children;
    let t = 0.9; // kurzer Moment, in dem nur der Rohbau zu sehen ist
    let first = true;
    for (const st of STAGES) {
      const objs = children.filter((o) => o.userData.stage === st.id && o.visible && (o.isMesh || o.isGroup));
      const parts = [];
      for (const o of objs) {
        if (st.perSide) {
          for (const c of o.children) if (c.visible) parts.push(c);
        } else parts.push(o);
      }
      if (!parts.length) continue;
      if (!first) t += st.gap;
      first = false;
      const start = t;
      parts.forEach((obj, i) => {
        let dir;
        if (st.perSide) {
          obj.geometry.computeBoundingBox();
          const cx = (obj.geometry.boundingBox.min.x + obj.geometry.boundingBox.max.x) / 2 + obj.position.x;
          dir = new THREE.Vector3(Math.sign(cx) || 1, 0.12, 0.18);
        } else {
          dir = new THREE.Vector3(...(st.from || [0, 0, 1]));
        }
        dir.normalize();
        const item = {
          obj,
          stage: st.id,
          start: start + (st.stagger || 0) * i + (st.perSide ? i * 0.08 : 0),
          dur: st.dur,
          pop: !!st.pop,
          heavy: !!st.heavy,
          offset: dir.multiplyScalar(st.dist || 0),
          spin: st.spin ? { axis: new THREE.Vector3(...st.spin[0]).normalize(), angle: st.spin[1] } : null,
          // leichtes Taumeln beim Anflug, je Teil etwas anders
          tumble: st.pop ? null : { axis: new THREE.Vector3(Math.sin(i * 1.7 + 1), Math.cos(i * 2.3), Math.sin(i * 0.9 + 2)).normalize(), angle: 0.35 },
          pos: obj.position.clone(),
          quat: obj.quaternion.clone(),
          scale: obj.scale.clone(),
          landed: false,
        };
        this.items.push(item);
      });
      this.timeline.push({ id: st.id, at: start, done: false });
    }
    const last = this.items.reduce((m, it) => Math.max(m, it.start + it.dur), 0);
    this.buildEnd = last + 0.35;
    this.revealStart = this.buildEnd + 0.25;
    this.total = this.revealStart + REVEAL.dur;
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
      this.#setCamera(BUILD_CAM.az1, REVEAL.el, REVEAL.dist);
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
    this.viewer.setInteractive(true);
    this.viewer.requestRender();
  }

  #finishItems() {
    for (const it of this.items) {
      it.obj.position.copy(it.pos);
      it.obj.quaternion.copy(it.quat);
      it.obj.scale.copy(it.scale);
      it.obj.visible = true;
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
    if (it.pop) {
      const s = Math.max(0.001, easeOutBack(t, 2.2));
      it.obj.scale.copy(it.scale).multiplyScalar(s);
      it.obj.position.copy(it.pos);
      it.obj.quaternion.copy(it.quat);
      if (it.obj.children.length) it.obj.rotateZ((1 - easeOutCubic(t)) * Math.PI);
    } else {
      const k = it.heavy ? easeOutCubic(t) : easeOutBack(t);
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
    dist *= this.distScale;
    cam.position.set(
      TARGET.x + dist * Math.cos(el) * Math.sin(az),
      TARGET.y + dist * Math.sin(el),
      TARGET.z + dist * Math.cos(el) * Math.cos(az),
    );
    if (jitter) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter));
    this.viewer.controls.target.copy(TARGET);
    cam.lookAt(TARGET);
  }

  #update(dt) {
    this.time += dt;
    const time = this.time;
    for (const it of this.items) this.#place(it, time);

    // Fortschritt der Montageschritte melden
    this.timeline.forEach((st, i) => {
      if (!st.done && time >= st.at) {
        st.done = true;
        this.hooks.onStage?.(st.id, i, this.timeline.length);
      }
    });

    // Kamera: langsame Fahrt während der Montage, danach eine Runde um die Maschine
    this.shake = Math.max(0, this.shake - dt * 5);
    if (time < this.revealStart) {
      const p = easeInOutCubic(clamp01(time / this.buildEnd));
      this.#setCamera(
        THREE.MathUtils.lerp(BUILD_CAM.az0, BUILD_CAM.az1, p),
        THREE.MathUtils.lerp(BUILD_CAM.el0, BUILD_CAM.el1, p),
        THREE.MathUtils.lerp(BUILD_CAM.d0, BUILD_CAM.d1, p),
        this.shake * 0.006,
      );
    } else {
      // Rohbau ist jetzt komplett verdeckt
      this.model.skeleton.visible = false;
      const p = easeInOutCubic(clamp01((time - this.revealStart) / REVEAL.dur));
      this.#setCamera(
        BUILD_CAM.az1 + 360 * p,
        THREE.MathUtils.lerp(BUILD_CAM.el1, REVEAL.el, p),
        THREE.MathUtils.lerp(BUILD_CAM.d1, REVEAL.dist, p),
      );
    }
    this.hooks.onProgress?.(clamp01(time / this.total));

    if (time >= this.total) {
      this.viewer.removeTicker(this.ticker);
      this.running = false;
      this.#finishItems();
      this.#setCamera(BUILD_CAM.az1, REVEAL.el, REVEAL.dist);
      this.viewer.syncControls();
      this.hooks.onDone?.();
      return false;
    }
    return true;
  }
}
