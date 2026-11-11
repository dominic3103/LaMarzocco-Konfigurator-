// ---------------------------------------------------------------------------
// 3D-Viewer: Renderer, Licht, Kamera (360°-Orbit), Auswahl per Klick, Ansichten
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeContactShadowTexture } from './textures.js';
import { LightingRig, lightingById } from './lighting.js';
import { RenderPipeline, makeGroundMaterial } from './pipeline.js';

const TARGET = new THREE.Vector3(0, 0.185, 0);

/** Kamera-Ansichten: Azimut (Grad, 0 = Front), Elevation (Grad), Distanz (m) */
export const VIEWS = {
  front: { label: 'Front', az: 0, el: 6, dist: 1.4 },
  threeQuarter: { label: '3/4', az: -38, el: 20, dist: 1.45 },
  left: { label: 'Links', az: -90, el: 6, dist: 1.45 },
  right: { label: 'Rechts', az: 90, el: 6, dist: 1.45 },
  back: { label: 'Hinten', az: 180, el: 14, dist: 1.45 },
  top: { label: 'Oben', az: -20, el: 70, dist: 1.4 },
};

export class Viewer {
  /**
   * @param {{lighting?: string, quality?: 'auto'|'high'|'low', samples?: number}} options
   */
  constructor(canvas, container, { lighting = 'studio', quality = 'auto', samples = 0 } = {}) {
    this.canvas = canvas;
    this.container = container;
    this.listeners = { hover: [], pick: [] };
    this.dirty = true;
    this.tween = null;
    this.highlight = null;
    // Drehpunkt und Abstandsfaktor der Kamera (Maschine, Mühle oder beide)
    this.focus = { target: TARGET.clone(), scale: 1 };
    this.models = [];

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
    this.camera = camera;

    // Licht
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(0.55, 1.25, 0.85);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -0.7;
    sc.right = 0.7;
    sc.top = 0.7;
    sc.bottom = -0.7;
    sc.near = 0.2;
    sc.far = 4;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.0012;
    key.shadow.radius = 3;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff4e6, 0.7);
    rim.position.set(-0.9, 0.7, -0.9);
    scene.add(rim);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8076, 0.35);
    scene.add(hemi);
    // Himmelslicht-Sample für das progressive Rendering (wird von der Pipeline gesteuert)
    const sky = new THREE.DirectionalLight(0xffffff, 0);
    sky.castShadow = true;
    sky.shadow.mapSize.set(1024, 1024);
    Object.assign(sky.shadow.camera, { left: -0.62, right: 0.62, top: 0.62, bottom: -0.62, near: 0.3, far: 3.4 });
    sky.shadow.bias = -0.0006;
    sky.shadow.normalBias = 0.002;
    sky.target.position.set(0, 0.14, 0);

    // Boden: Schattenfänger (Hauptlicht + Himmel) und einfacher Kontaktschatten für bewegte Bilder
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), makeGroundMaterial());
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    // Kontaktschatten je Gerät; alle teilen ein Material (Deckkraft je Lichtstimmung)
    const contactMat = new THREE.MeshBasicMaterial({ map: makeContactShadowTexture(), transparent: true, depthWrite: false, toneMapped: false });
    const contact = new THREE.Group();
    contact.material = contactMat;
    scene.add(contact);
    this.contactMat = contactMat;
    this.contacts = new Map();
    this.shadowCams = { key: key.shadow.camera, sky: sky.shadow.camera };

    // Lichtstimmungen (Umgebung, Lichter, Belichtung, Schatten, Barista-Licht)
    this.rig = new LightingRig({ renderer, scene, key, rim, hemi, ground, contact });
    this.sky = sky;
    this.rig.set(lighting, false);

    // Steuerung
    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(TARGET);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 0.55;
    controls.maxDistance = 2.2;
    controls.minPolarAngle = THREE.MathUtils.degToRad(4);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(93);
    controls.rotateSpeed = 0.8;
    controls.autoRotateSpeed = 1.1;
    controls.addEventListener('change', () => (this.dirty = true));
    controls.addEventListener('start', () => {
      this.tween = null;
      this.#emitInteraction();
    });
    this.controls = controls;
    this.interactionListeners = [];
    this.tickers = new Set();
    this.interactive = true;
    this.shift = { x: 0, y: 0, tx: 0, ty: 0 };

    this.setView('threeQuarter', false);

    const isPhone = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.pipeline = new RenderPipeline({
      renderer,
      scene,
      camera,
      key,
      sky,
      hemi,
      ground,
      contact,
      quality,
      samples: samples || (isPhone ? 40 : 64),
      applyView: (jx, jy) => this.#applyView(jx, jy),
      focusDistance: () => this.#focusDistance(),
      viewHeight: () => this.container.clientHeight || 1,
      onQualityChange: (q) => {
        this.dirty = true;
        this.onQualityChange?.(q);
      },
    });

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pickables = [];
    this.#setupPointer();

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(container);
    this.resize();

    this.clock = new THREE.Clock();
    renderer.setAnimationLoop(() => this.#tick());
  }

  /** Maschine setzen (sie steuert das Barista-Licht) */
  setModel(model, shadow = { w: 0.62, d: 0.72, z: -0.069 }) {
    this.model = model;
    this.rig.model = model;
    model.setBarista(this.rig.baristaLevel ?? 0);
    this.addModel(model, shadow);
  }

  /** Gerät aus der Szene nehmen (z. B. beim Gerätewechsel) */
  removeModel(model) {
    if (!model) return;
    this.scene.remove(model.root);
    this.models = this.models.filter((m) => m !== model);
    const c = this.contacts.get(model);
    if (c) {
      this.rig.contact.remove(c);
      c.geometry.dispose();
      this.contacts.delete(model);
    }
    if (this.model === model) this.model = null;
    this.pickables = this.models.flatMap((m) => m.pickables);
    this.dirty = true;
  }

  /**
   * Weiteres Gerät in die Szene stellen (z. B. die Mühle).
   * @param {{w:number,d:number,z?:number}} shadow  Größe des Kontaktschattens (m), Versatz in Z
   */
  addModel(model, shadow) {
    this.scene.add(model.root);
    this.models.push(model);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(shadow.w, shadow.d), this.contactMat);
    c.rotation.x = -Math.PI / 2;
    c.userData.dz = shadow.z || 0;
    // Größe folgt der Gerätebeschreibung (z. B. Gruppenzahl der Linea PB)
    c.userData.shadow = shadow;
    c.userData.w0 = shadow.w;
    c.userData.d0 = shadow.d;
    this.rig.contact.add(c);
    this.contacts.set(model, c);
    this.pickables = this.models.flatMap((m) => m.pickables);
    this.syncContacts();
    this.dirty = true;
  }

  /** Kontaktschatten an Position und Sichtbarkeit der Geräte anpassen */
  syncContacts() {
    for (const [m, c] of this.contacts) {
      c.visible = m.root.visible;
      const sh = c.userData.shadow;
      if (sh) c.scale.set(sh.w / c.userData.w0, sh.d / c.userData.d0, 1);
      c.position.set(m.root.position.x, 0.0006, m.root.position.z + c.userData.dz);
    }
    this.dirty = true;
  }

  /**
   * Drehpunkt und Abstand der Kamera wechseln (weich), z. B. Maschine -> beide Geräte.
   * @param {{target: number[], scale: number, maxDistance?: number, shadow?: number}} f
   */
  setFocus(f, animate = true) {
    const oldT = this.focus.target.clone();
    const oldS = this.focus.scale;
    this.focus = { target: new THREE.Vector3(...f.target), scale: f.scale };
    this.controls.maxDistance = f.maxDistance ?? 2.2 * f.scale;
    this.controls.minDistance = 0.55 * Math.min(1, f.scale);
    // Schattenkameras auf den größeren Bereich ausdehnen
    const k = f.shadow ?? 1;
    Object.assign(this.shadowCams.key, { left: -0.7 * k, right: 0.7 * k, top: 0.7 * k, bottom: -0.7 * k });
    Object.assign(this.shadowCams.sky, { left: -0.62 * k, right: 0.62 * k, top: 0.62 * k, bottom: -0.62 * k });
    this.shadowCams.key.updateProjectionMatrix();
    this.shadowCams.sky.updateProjectionMatrix();
    this.sky.target.position.set(this.focus.target.x, 0.14, this.focus.target.z);
    this.sky.target.updateMatrixWorld();
    // aktuelle Blickrichtung behalten, Abstand mitskalieren
    const rel = this.camera.position.clone().sub(oldT);
    const sph = new THREE.Spherical().setFromVector3(rel);
    sph.radius *= f.scale / oldS;
    const to = new THREE.Vector3().setFromSpherical(sph).add(this.focus.target);
    this.#stopDamping();
    if (!animate) {
      this.camera.position.copy(to);
      this.controls.target.copy(this.focus.target);
      this.controls.update();
      this.dirty = true;
      return;
    }
    this.#startTween(oldT, to);
  }

  /** Kamerafahrt vom aktuellen Standpunkt zu `to` (Drehpunkt wandert von fromT zum aktuellen Fokus) */
  #startTween(fromT, to) {
    const T = this.focus.target;
    const from = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(fromT));
    const target = new THREE.Spherical().setFromVector3(to.clone().sub(T));
    let dTheta = target.theta - from.theta;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;
    this.tween = { from, dTheta, target, fromT: fromT.clone(), toT: T.clone(), t: 0, duration: 1.1 };
  }

  on(event, fn) {
    this.listeners[event].push(fn);
  }

  onInteraction(fn) {
    this.interactionListeners.push(fn);
  }

  #emitInteraction() {
    this.interactionListeners.forEach((fn) => fn());
  }

  /** Lichtstimmung wechseln */
  setLighting(id) {
    this.rig.set(id);
    this.dirty = true;
  }

  setBarista(level) {
    this.rig.setBaristaOverride(level);
    this.dirty = true;
  }

  requestRender() {
    this.dirty = true;
  }

  /** Zusätzliche Animation pro Frame (gibt false zurück, wenn sie fertig ist) */
  addTicker(fn) {
    this.tickers.add(fn);
    this.dirty = true;
  }

  removeTicker(fn) {
    this.tickers.delete(fn);
  }

  /** Bildausschnitt verschieben (Pixel), z. B. damit eine Karte die Maschine nicht verdeckt */
  setFrameShift(x, y = 0) {
    this.shift.tx = x;
    this.shift.ty = y;
    this.dirty = true;
  }

  /** Bildausschnitt (Verschiebung + Sub-Pixel-Versatz der Pipeline, CSS-Pixel) setzen */
  #applyView(jx = 0, jy = 0) {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const x = this.shift.x + jx;
    const y = this.shift.y + jy;
    if (Math.abs(x) < 1e-4 && Math.abs(y) < 1e-4) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, x, y, w, h);
    this.camera.updateProjectionMatrix();
  }

  #shown(o) {
    for (let n = o; n; n = n.parent) if (!n.visible) return false;
    return true;
  }

  /** Entfernung der Schärfeebene: die Oberfläche in Bildmitte (Blickrichtung zum Drehpunkt) */
  #focusDistance() {
    const cam = this.camera;
    const dir = this.controls.target.clone().sub(cam.position);
    const dist = dir.length();
    if (!this.models.length) return dist;
    this.raycaster.set(cam.position, dir.normalize());
    const roots = this.models.map((m) => m.root).filter((r) => r.visible);
    const hit = this.raycaster.intersectObjects(roots, true).find((h) => h.object.isMesh && this.#shown(h.object));
    return hit ? Math.max(0.15, hit.distance) : dist;
  }

  /** true, wenn das Bild vollständig berechnet ist (progressives Rendering abgeschlossen) */
  get converged() {
    return !this.dirty && this.pipeline.converged;
  }

  get quality() {
    return this.pipeline.quality;
  }

  /** Darstellung umschalten: 'high' = fotorealistisch (verfeinert im Stillstand), 'low' = schnell */
  setQuality(mode) {
    this.pipeline.setQuality(mode);
    this.dirty = true;
  }

  /** Maus-/Touch-Bedienung sperren (z. B. während der Montage-Animation) */
  setInteractive(on) {
    this.interactive = !!on;
    this.controls.enabled = !!on;
    if (!on) {
      this.tween = null;
      this.setHover(this.hoverMM, null);
      this.listeners.hover.forEach((fn) => fn(null, null));
    }
  }

  /** Steuerung nach einer extern gesetzten Kamera übernehmen, ohne Nachschwingen */
  syncControls() {
    this.#stopDamping();
    this.dirty = true;
  }

  setAutoRotate(on) {
    this.controls.autoRotate = on;
    this.dirty = true;
  }

  /** Kamera weich zu einer Ansicht fahren. */
  setView(name, animate = true) {
    const v = VIEWS[name];
    if (!v) return;
    const T = this.focus.target;
    const d = v.dist * this.focus.scale;
    const az = THREE.MathUtils.degToRad(v.az);
    const el = THREE.MathUtils.degToRad(v.el);
    const to = new THREE.Vector3(T.x + d * Math.cos(el) * Math.sin(az), T.y + d * Math.sin(el), T.z + d * Math.cos(el) * Math.cos(az));
    this.#stopDamping();
    if (!animate) {
      this.camera.position.copy(to);
      this.controls.target.copy(T);
      this.controls.update();
      this.dirty = true;
      return;
    }
    // Interpolation in Kugelkoordinaten -> echte Kamerafahrt um das Gerät
    this.#startTween(this.controls.target.clone(), to);
  }

  /** Restbewegung der gedämpften Steuerung (z. B. nach Auto-Rotation) verwerfen */
  #stopDamping() {
    const pos = this.camera.position.clone();
    this.controls.enableDamping = false;
    this.controls.update();
    this.camera.position.copy(pos);
    this.controls.update();
    this.controls.enableDamping = true;
  }

  /** Kurzes Aufleuchten von Bauteilen (z. B. bei Auswahl). */
  flash(materialManager, slotKeys) {
    this.highlight = { mm: materialManager, keys: slotKeys, t: 0, duration: 0.9 };
    this.dirty = true;
  }

  setHover(materialManager, slotKey) {
    if (this.hoverSlot === slotKey) return;
    this.hoverSlot = slotKey;
    this.hoverMM = materialManager;
    this.dirty = true;
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const buf = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.pipeline.setSize(buf.x, buf.y);
    this.camera.aspect = w / h;
    // Auf schmalen Displays etwas mehr Abstand, damit die Maschine ganz sichtbar bleibt
    this.camera.fov = w / h < 0.8 ? 38 : h < 520 ? 34 : 30;
    this.#applyView();
    this.dirty = true;
  }

  /** Aktuelle Ansicht als PNG (mit Hintergrund) erzeugen. */
  snapshot() {
    // Zeichenpuffer neu füllen (wird nach jedem Bild vom Browser geleert)
    if (this.pipeline.quality === 'high') this.pipeline.present();
    else this.pipeline.render(true);
    const src = this.renderer.domElement;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    const bg = (this.rig.current || lightingById('studio')).bg.snap;
    const cx = out.width * bg.cx;
    const cy = out.height * bg.cy;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(out.width, out.height) * 0.6);
    for (const [o, c] of bg.stops) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    return out.toDataURL('image/png');
  }

  #setupPointer() {
    const el = this.canvas;
    let down = null;
    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', (e) => {
      if (!down || !this.interactive) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) return;
      const hit = this.#pick(e);
      this.listeners.pick.forEach((fn) => fn(hit ? hit.object.userData.slot : null, e, hit ? hit.object.userData : null));
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || e.buttons || !this.interactive) return;
      this.lastPointer = e;
      this.pendingHover = true;
    });
    el.addEventListener('pointerleave', () => {
      this.listeners.hover.forEach((fn) => fn(null, null));
    });
  }

  #pick(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // ausgeblendete Teile (andere Formvariante, Cup Rail aus …) nicht auswählbar
    const hits = this.raycaster.intersectObjects(this.pickables, false).filter((h) => this.#shown(h.object));
    return hits[0] || null;
  }

  #tick() {
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    if (this.tween) {
      const tw = this.tween;
      tw.t += Math.min(rawDt, 0.25) / tw.duration;
      const k = tw.t >= 1 ? 1 : 1 - Math.pow(1 - tw.t, 3);
      const s = new THREE.Spherical(
        THREE.MathUtils.lerp(tw.from.radius, tw.target.radius, k),
        THREE.MathUtils.lerp(tw.from.phi, tw.target.phi, k),
        tw.from.theta + tw.dTheta * k,
      );
      const T = tw.fromT.clone().lerp(tw.toT, k);
      this.camera.position.setFromSpherical(s).add(T);
      this.controls.target.copy(T);
      if (tw.t >= 1) this.tween = null;
      this.dirty = true;
    }

    if (this.pendingHover && this.lastPointer) {
      this.pendingHover = false;
      const hit = this.#pick(this.lastPointer);
      const slot = hit ? hit.object.userData.slot : null;
      this.listeners.hover.forEach((fn) => fn(slot, this.lastPointer));
    }

    // Hervorhebung (Hover + Auswahl-Puls)
    if (this.highlight || this.hoverMM) {
      const mm = (this.highlight && this.highlight.mm) || this.hoverMM;
      mm.clearHighlight();
      if (this.hoverSlot) mm.setHighlight(this.hoverSlot, 0.22);
      if (this.highlight) {
        const h = this.highlight;
        h.t += Math.min(rawDt, 0.25) / h.duration;
        const pulse = Math.sin(Math.min(h.t, 1) * Math.PI);
        mm.setHighlight(h.keys, 0.55 * pulse);
        if (h.t >= 1) this.highlight = null;
        this.dirty = true;
      }
    }

    if (this.rig.update(Math.min(rawDt, 0.25))) this.dirty = true;

    // Bildausschnitt weich verschieben
    const sh = this.shift;
    if (Math.abs(sh.tx - sh.x) > 0.3 || Math.abs(sh.ty - sh.y) > 0.3) {
      const k = 1 - Math.pow(0.002, Math.min(rawDt, 0.1));
      sh.x += (sh.tx - sh.x) * k;
      sh.y += (sh.ty - sh.y) * k;
      if (Math.abs(sh.tx - sh.x) <= 0.3 && Math.abs(sh.ty - sh.y) <= 0.3) {
        sh.x = sh.tx;
        sh.y = sh.ty;
      }
      this.#applyView();
      this.dirty = true;
    }

    // externe Animationen (Montage-Animation): echte Zeit, max. 1/20 s pro Frame
    if (this.tickers.size) {
      const tdt = Math.min(rawDt, 0.05);
      for (const fn of [...this.tickers]) if (fn(tdt) === false) this.tickers.delete(fn);
      this.dirty = true;
    }

    const changed = this.controls.update(dt);
    const dirty = changed || this.dirty || this.controls.autoRotate;
    // bei Stillstand rechnet die Pipeline das Bild Schritt für Schritt feiner
    if (dirty || this.refining) {
      this.refining = this.pipeline.render(dirty);
      this.dirty = false;
    }
  }
}
