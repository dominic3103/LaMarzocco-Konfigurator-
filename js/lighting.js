// ---------------------------------------------------------------------------
// Lichtstimmungen: Studio hell, Tageslicht, Dämmerung, Abendlicht, Dunkel
//
// Jede Stimmung setzt Umgebungslicht (Reflexionen), Haupt- und Kantenlicht,
// Himmelslicht, Belichtung, Schattenstärke, Barista-Licht und den Hintergrund.
// Wechsel werden weich überblendet.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const LIGHTINGS = [
  {
    id: 'studio',
    name: 'Studio hell',
    icon: 'sun',
    tone: 'light',
    env: 'room',
    envIntensity: 0.85,
    exposure: 0.92,
    key: { color: '#ffffff', intensity: 1.6, pos: [0.55, 1.25, 0.85] },
    rim: { color: '#fff4e6', intensity: 0.7, pos: [-0.9, 0.7, -0.9] },
    hemi: { sky: '#ffffff', ground: '#8a8076', intensity: 0.35 },
    shadow: 0.2,
    contact: 1,
    barista: 0,
    bg: {
      css: 'radial-gradient(ellipse 70% 60% at 50% 42%, #fdfcfa 0%, #efece7 58%, #e2ddd4 100%)',
      snap: { cx: 0.5, cy: 0.42, stops: [[0, '#fdfcfa'], [0.58, '#efece7'], [1, '#e2ddd4']] },
    },
  },
  {
    id: 'day',
    name: 'Tageslicht',
    icon: 'window',
    tone: 'light',
    env: {
      top: '#b9d0ec',
      mid: '#f1ece4',
      bottom: '#7d746a',
      panels: [
        { color: '#ffffff', intensity: 9, w: 8, h: 6, pos: [12, 4, 6] },
        { color: '#eef3ff', intensity: 2, w: 10, h: 6, pos: [-10, 6, -4] },
      ],
    },
    envIntensity: 1.0,
    exposure: 0.95,
    key: { color: '#fff3e2', intensity: 2.4, pos: [1.3, 0.9, 0.35] },
    rim: { color: '#d9e6ff', intensity: 0.5, pos: [-1, 0.8, -0.6] },
    hemi: { sky: '#dce8ff', ground: '#8f8578', intensity: 0.4 },
    shadow: 0.3,
    contact: 0.9,
    barista: 0,
    bg: {
      css: 'radial-gradient(ellipse 85% 70% at 70% 35%, #fbfaf7 0%, #eceff1 55%, #d4d9dd 100%)',
      snap: { cx: 0.7, cy: 0.35, stops: [[0, '#fbfaf7'], [0.55, '#eceff1'], [1, '#d4d9dd']] },
    },
  },
  {
    id: 'dusk',
    name: 'Dämmerung',
    icon: 'sunset',
    tone: 'dark',
    env: {
      top: '#1c2340',
      mid: '#b8775a',
      bottom: '#1b1512',
      panels: [
        { color: '#ffa468', intensity: 16, w: 3, h: 2, pos: [-14, 1.5, 5] },
        { color: '#7d93ff', intensity: 1.5, w: 8, h: 6, pos: [10, 8, -6] },
      ],
    },
    envIntensity: 0.9,
    exposure: 1.0,
    key: { color: '#ffae7a', intensity: 1.9, pos: [-1.5, 0.32, 0.55] },
    rim: { color: '#7f8cff', intensity: 1.0, pos: [1.0, 0.9, -0.8] },
    hemi: { sky: '#5a6794', ground: '#2a1d18', intensity: 0.55 },
    shadow: 0.38,
    contact: 0.8,
    barista: 0.45,
    bg: {
      css: 'radial-gradient(ellipse 85% 65% at 28% 78%, #e8935c 0%, #a2605a 28%, #4a3f5e 60%, #1b1f33 100%)',
      snap: { cx: 0.28, cy: 0.78, stops: [[0, '#e8935c'], [0.28, '#a2605a'], [0.6, '#4a3f5e'], [1, '#1b1f33']] },
    },
  },
  {
    id: 'evening',
    name: 'Abendlicht',
    icon: 'lamp',
    tone: 'dark',
    env: {
      top: '#22190f',
      mid: '#4a3a2c',
      bottom: '#0e0a07',
      panels: [
        { color: '#ffc995', intensity: 9, w: 4, h: 4, pos: [2, 12, 6] },
        { color: '#ffe0bf', intensity: 3, w: 6, h: 4, pos: [-10, 3, 8] },
      ],
    },
    envIntensity: 0.7,
    exposure: 1.0,
    key: { color: '#ffd8ae', intensity: 1.45, pos: [0.2, 1.4, 0.6] },
    rim: { color: '#ffbb8c', intensity: 0.5, pos: [-0.9, 0.6, -0.8] },
    hemi: { sky: '#5e4a3a', ground: '#140e0a', intensity: 0.25 },
    shadow: 0.45,
    contact: 1,
    barista: 0.8,
    bg: {
      css: 'radial-gradient(ellipse 70% 60% at 50% 40%, #5c4535 0%, #2c2119 60%, #140f0b 100%)',
      snap: { cx: 0.5, cy: 0.4, stops: [[0, '#5c4535'], [0.6, '#2c2119'], [1, '#140f0b']] },
    },
  },
  {
    id: 'dark',
    name: 'Dunkel',
    icon: 'moon',
    tone: 'dark',
    env: {
      top: '#040405',
      mid: '#09090b',
      bottom: '#020202',
      panels: [
        { color: '#ffffff', intensity: 10, w: 1.2, h: 10, pos: [-9, 3, 4] },
        { color: '#ffffff', intensity: 10, w: 1.2, h: 10, pos: [9, 3, -3] },
        { color: '#ffffff', intensity: 3, w: 4, h: 4, pos: [0, 14, 0] },
      ],
    },
    envIntensity: 0.65,
    exposure: 1.05,
    key: { color: '#ffffff', intensity: 0.5, pos: [0.1, 1.6, 0.3] },
    rim: { color: '#cdd6ff', intensity: 1.4, pos: [-1.1, 0.6, -0.9] },
    hemi: { sky: '#2a2a33', ground: '#000000', intensity: 0.08 },
    shadow: 0.55,
    contact: 1.2,
    barista: 1,
    bg: {
      css: 'radial-gradient(ellipse 60% 55% at 50% 45%, #2b2b2f 0%, #121214 60%, #060607 100%)',
      snap: { cx: 0.5, cy: 0.45, stops: [[0, '#2b2b2f'], [0.6, '#121214'], [1, '#060607']] },
    },
  },
];

export const lightingById = (id) => LIGHTINGS.find((l) => l.id === id) || LIGHTINGS[0];

/** Einfache Umgebung: Himmel mit Farbverlauf + leuchtende Flächen (Softboxen, Sonne, Fenster). */
function gradientEnvScene({ top, mid, bottom, panels }) {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(20, 48, 24);
  const pos = geo.attributes.position;
  const cTop = new THREE.Color(top);
  const cMid = new THREE.Color(mid);
  const cBot = new THREE.Color(bottom);
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 20;
    if (h >= 0) c.copy(cMid).lerp(cTop, Math.pow(h, 0.6));
    else c.copy(cMid).lerp(cBot, Math.pow(-h, 0.5));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  for (const p of panels) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(p.w, p.h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(p.intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...p.pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  }
  return scene;
}

const ease = (t) => (t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));

export class LightingRig {
  /**
   * @param {{renderer, scene, key, rim, hemi, ground, contact, model?}} parts
   */
  constructor(parts) {
    Object.assign(this, parts);
    this.pmrem = new THREE.PMREMGenerator(parts.renderer);
    this.envCache = new Map();
    this.current = null;
    this.tween = null;
    this.baristaOverride = null; // null = wie Lichtstimmung, sonst 0..1
    this.state = this.#capture();
  }

  #envFor(preset) {
    if (this.envCache.has(preset.id)) return this.envCache.get(preset.id);
    const scene = preset.env === 'room' ? new RoomEnvironment() : gradientEnvScene(preset.env);
    const tex = this.pmrem.fromScene(scene, 0.035).texture;
    this.envCache.set(preset.id, tex);
    return tex;
  }

  #capture() {
    return {
      envIntensity: this.scene.environmentIntensity ?? 1,
      exposure: this.renderer.toneMappingExposure,
      keyColor: this.key.color.clone(),
      keyI: this.key.intensity,
      keyPos: this.key.position.clone(),
      rimColor: this.rim.color.clone(),
      rimI: this.rim.intensity,
      rimPos: this.rim.position.clone(),
      sky: this.hemi.color.clone(),
      groundCol: this.hemi.groundColor.clone(),
      hemiI: this.hemi.intensity,
      shadow: this.ground.material.opacity,
      contact: this.contact.material.opacity,
      barista: this.baristaLevel ?? 0,
    };
  }

  #target(p) {
    return {
      envIntensity: p.envIntensity,
      exposure: p.exposure,
      keyColor: new THREE.Color(p.key.color),
      keyI: p.key.intensity,
      keyPos: new THREE.Vector3(...p.key.pos),
      rimColor: new THREE.Color(p.rim.color),
      rimI: p.rim.intensity,
      rimPos: new THREE.Vector3(...p.rim.pos),
      sky: new THREE.Color(p.hemi.sky),
      groundCol: new THREE.Color(p.hemi.ground),
      hemiI: p.hemi.intensity,
      shadow: p.shadow,
      contact: Math.min(1, p.contact),
      barista: this.baristaOverride ?? p.barista,
    };
  }

  /** Lichtstimmung wählen (weich überblendet). */
  set(id, animate = true) {
    const p = lightingById(id);
    this.current = p;
    this.scene.environment = this.#envFor(p);
    const from = this.#capture();
    const to = this.#target(p);
    if (!animate) {
      this.#applyState(to);
      this.tween = null;
      return;
    }
    this.tween = { from, to, t: 0, duration: 0.9 };
  }

  setBaristaOverride(level) {
    this.baristaOverride = level;
    if (!this.current) return;
    const from = this.#capture();
    const to = { ...from, barista: level ?? this.current.barista };
    this.tween = { from, to, t: 0, duration: 0.4 };
  }

  get baristaActive() {
    return (this.baristaOverride ?? this.current?.barista ?? 0) > 0.01;
  }

  #applyState(s) {
    this.scene.environmentIntensity = s.envIntensity;
    this.renderer.toneMappingExposure = s.exposure;
    this.key.color.copy(s.keyColor);
    this.key.intensity = s.keyI;
    this.key.position.copy(s.keyPos);
    this.rim.color.copy(s.rimColor);
    this.rim.intensity = s.rimI;
    this.rim.position.copy(s.rimPos);
    this.hemi.color.copy(s.sky);
    this.hemi.groundColor.copy(s.groundCol);
    this.hemi.intensity = s.hemiI;
    this.ground.material.opacity = s.shadow;
    this.contact.material.opacity = s.contact;
    this.baristaLevel = s.barista;
    this.model?.setBarista(s.barista);
  }

  /** Pro Frame aufrufen; liefert true, solange überblendet wird. */
  update(dt) {
    if (!this.tween) return false;
    const tw = this.tween;
    tw.t += dt / tw.duration;
    const k = ease(Math.min(tw.t, 1));
    const a = tw.from;
    const b = tw.to;
    const L = THREE.MathUtils.lerp;
    this.#applyState({
      envIntensity: L(a.envIntensity, b.envIntensity, k),
      exposure: L(a.exposure, b.exposure, k),
      keyColor: a.keyColor.clone().lerp(b.keyColor, k),
      keyI: L(a.keyI, b.keyI, k),
      keyPos: a.keyPos.clone().lerp(b.keyPos, k),
      rimColor: a.rimColor.clone().lerp(b.rimColor, k),
      rimI: L(a.rimI, b.rimI, k),
      rimPos: a.rimPos.clone().lerp(b.rimPos, k),
      sky: a.sky.clone().lerp(b.sky, k),
      groundCol: a.groundCol.clone().lerp(b.groundCol, k),
      hemiI: L(a.hemiI, b.hemiI, k),
      shadow: L(a.shadow, b.shadow, k),
      contact: L(a.contact, b.contact, k),
      barista: L(a.barista, b.barista, k),
    });
    if (tw.t >= 1) this.tween = null;
    return true;
  }
}
