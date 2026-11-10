// ---------------------------------------------------------------------------
// 3D-Viewer: Renderer, Licht, Kamera (360°-Orbit), Auswahl per Klick, Ansichten
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeContactShadowTexture } from './textures.js';
import { LightingRig, lightingById } from './lighting.js';

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
  constructor(canvas, container, { lighting = 'studio' } = {}) {
    this.canvas = canvas;
    this.container = container;
    this.listeners = { hover: [], pick: [] };
    this.dirty = true;
    this.tween = null;
    this.highlight = null;

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

    // Boden: weicher Schlagschatten + Kontaktschatten
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.2 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.72),
      new THREE.MeshBasicMaterial({ map: makeContactShadowTexture(), transparent: true, depthWrite: false, toneMapped: false }),
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(0, 0.0006, -0.005);
    scene.add(contact);

    // Lichtstimmungen (Umgebung, Lichter, Belichtung, Schatten, Barista-Licht)
    this.rig = new LightingRig({ renderer, scene, key, rim, hemi, ground, contact });
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

    this.setView('threeQuarter', false);

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

  setModel(model) {
    this.model = model;
    // Modell so verschieben, dass es um seine Mitte rotiert
    model.root.position.z = 0.064;
    this.scene.add(model.root);
    this.rig.model = model;
    model.setBarista(this.rig.baristaLevel ?? 0);
    this.pickables = model.pickables;
    this.dirty = true;
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

  setAutoRotate(on) {
    this.controls.autoRotate = on;
    this.dirty = true;
  }

  /** Kamera weich zu einer Ansicht fahren. */
  setView(name, animate = true) {
    const v = VIEWS[name];
    if (!v) return;
    const az = THREE.MathUtils.degToRad(v.az);
    const el = THREE.MathUtils.degToRad(v.el);
    const to = new THREE.Vector3(
      TARGET.x + v.dist * Math.cos(el) * Math.sin(az),
      TARGET.y + v.dist * Math.sin(el),
      TARGET.z + v.dist * Math.cos(el) * Math.cos(az),
    );
    if (!animate) {
      this.camera.position.copy(to);
      this.controls.target.copy(TARGET);
      this.controls.update();
      this.dirty = true;
      return;
    }
    // Interpolation in Kugelkoordinaten -> echte Kamerafahrt um die Maschine
    const from = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(TARGET));
    const target = new THREE.Spherical().setFromVector3(to.clone().sub(TARGET));
    let dTheta = target.theta - from.theta;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;
    this.tween = { from, dTheta, target, t: 0, duration: 1.1 };
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
    this.camera.aspect = w / h;
    // Auf schmalen Displays etwas mehr Abstand, damit die Maschine ganz sichtbar bleibt
    this.camera.fov = w / h < 0.8 ? 38 : h < 520 ? 34 : 30;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** Aktuelle Ansicht als PNG (mit Hintergrund) erzeugen. */
  snapshot() {
    this.#render();
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
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) return;
      const hit = this.#pick(e);
      this.listeners.pick.forEach((fn) => fn(hit ? hit.object.userData.slot : null, e));
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
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
    const shown = (o) => {
      for (let n = o; n; n = n.parent) if (!n.visible) return false;
      return true;
    };
    const hits = this.raycaster.intersectObjects(this.pickables, false).filter((h) => shown(h.object));
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
      this.camera.position.setFromSpherical(s).add(TARGET);
      this.controls.target.copy(TARGET);
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

    const changed = this.controls.update(dt);
    if (changed || this.dirty || this.controls.autoRotate) {
      this.#render();
      this.dirty = false;
    }
  }

  #render() {
    this.renderer.render(this.scene, this.camera);
  }
}
