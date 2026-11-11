// AR-Ansicht: stellt die aktuelle Konfiguration in Originalgröße in den Raum.
//  - iPhone/iPad: USDZ-Datei für AR Quick Look
//  - Android (Chrome): WebXR über <model-viewer>
//  - sonst: QR-Code zum Wechsel aufs Handy bzw. 3D-Dateien zum Speichern
import * as THREE from 'three';
import { plainWoodCanvas } from './wood.js';

const ARTIFACT = document.querySelector('.app')?.dataset.mode === 'artifact';
const MODEL_VIEWER_URL = ARTIFACT
  ? 'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js'
  : new URL('../vendor/model-viewer/model-viewer.min.js', import.meta.url).href;
const QR_URL = new URL('../vendor/qrcode/qrcode.js', import.meta.url).href;
const FILE_NAME = 'Linea-Mini-R';

// ---------------------------------------------------------------- Export-Szene

const isIdentity = (t) => t.rotation === 0 && t.repeat.x === 1 && t.repeat.y === 1 && t.offset.x === 0 && t.offset.y === 0;

function canvasOf(image) {
  const c = document.createElement('canvas');
  c.width = image.width;
  c.height = image.height;
  c.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0);
  return c;
}

/**
 * Schriftzug: Farbe (bzw. Holzmaserung samt Textur-Ausrichtung) und Maske in eine Textur mit
 * Alphakanal schreiben – AR-Formate kennen keine getrennte Alpha-Maske.
 */
function bakeMasked(m, ctx) {
  const mask = canvasOf(m.alphaMap.image);
  const W = mask.width;
  const H = mask.height;
  const md = mask.getContext('2d').getImageData(0, 0, W, H).data;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d');
  const img = octx.createImageData(W, H);
  const od = img.data;
  let sd = null;
  let SW = 0;
  let SH = 0;
  let e = null;
  if (m.map) {
    const s = plainWoodCanvas(m.map) || canvasOf(m.map.image);
    SW = s.width;
    SH = s.height;
    sd = s.getContext('2d').getImageData(0, 0, SW, SH).data;
    m.map.updateMatrix();
    e = m.map.matrix.elements;
  }
  for (let y = 0; y < H; y++) {
    const v = 1 - (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let r = 255;
      let g = 255;
      let b = 255;
      if (sd) {
        const u = (x + 0.5) / W;
        const uu = e[0] * u + e[3] * v + e[6];
        const vv = e[1] * u + e[4] * v + e[7];
        const fx = uu - Math.floor(uu);
        const fy = vv - Math.floor(vv);
        const j = (Math.min(SH - 1, ((1 - fy) * SH) | 0) * SW + Math.min(SW - 1, (fx * SW) | 0)) * 4;
        r = sd[j];
        g = sd[j + 1];
        b = sd[j + 2];
      }
      od[i] = r;
      od[i + 1] = g;
      od[i + 2] = b;
      od[i + 3] = md[i];
    }
  }
  octx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  ctx.disposables.push(tex);
  return tex;
}

/** Holz: Farbe ohne die Korrektur, die nur für die eigene Darstellung gilt */
function plainWood(texture, ctx) {
  const canvas = plainWoodCanvas(texture);
  if (!canvas) return null;
  if (!ctx.woods.has(canvas)) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    ctx.disposables.push(t);
    ctx.woods.set(canvas, t);
  }
  return ctx.woods.get(canvas);
}

/**
 * Material für den Export vereinfachen: Farbe, Metall, Rauheit, Klarlack und Texturen ohne
 * Verschiebung/Drehung. Feine Struktur-Karten (Pulverlack, Holzporen) entfallen – auf Armlänge
 * sind sie nicht zu sehen, und AR Quick Look stellt sie nicht verlässlich dar.
 */
function convertMaterial(m, ctx) {
  if (ctx.mats.has(m.uuid)) return ctx.mats.get(m.uuid);
  let out = null;
  if (m.blending === THREE.NormalBlending) {
    if (m.isMeshBasicMaterial) {
      // Display: leuchtet selbst
      out = new THREE.MeshStandardMaterial({ color: m.map ? 0x000000 : m.color.getHex(), roughness: 0.35, metalness: 0 });
      if (m.map && isIdentity(m.map)) {
        out.emissive.set(0xffffff);
        out.emissiveMap = m.map;
        out.emissiveIntensity = 0.9;
      }
    } else if (m.isMeshStandardMaterial) {
      const clearcoat = m.isMeshPhysicalMaterial ? m.clearcoat : 0;
      out = clearcoat > 0 ? new THREE.MeshPhysicalMaterial({ clearcoat, clearcoatRoughness: m.clearcoatRoughness }) : new THREE.MeshStandardMaterial();
      out.color.copy(m.color);
      out.metalness = m.metalness;
      // Glanzkarte des Holzes durch ihren Mittelwert ersetzen
      out.roughness = m.roughnessMap ? Math.min(1, m.roughness * 0.62) : m.roughness;
      // Bauteil-Materialien: Grundwert statt einer gerade laufenden Hervorhebung
      if (m.userData.emissiveBase !== undefined) out.emissive.setHex(m.userData.emissiveBase);
      else out.emissive.copy(m.emissive);
      out.emissiveIntensity = m.emissiveIntensity;
      if (m.alphaMap) {
        out.map = bakeMasked(m, ctx);
        if (m.map) out.color.set(0xffffff);
        out.alphaTest = 0.5;
      } else if (m.map && isIdentity(m.map)) {
        out.map = plainWood(m.map, ctx) || m.map;
        out.alphaTest = m.alphaTest;
      }
    }
    if (out) {
      out.name = m.name || '';
      ctx.disposables.push(out);
    }
  }
  ctx.mats.set(m.uuid, out);
  return out;
}

/** Normalen auf Länge 1 bringen, falls ein Bauteil sie anders mitbringt (AR-Formate verlangen das). */
function unitNormals(geo, ctx) {
  const key = `n:${geo.uuid}`;
  if (ctx.geos.has(key)) return ctx.geos.get(key);
  const nor = geo.attributes.normal;
  let out = geo;
  for (let i = 0; i < nor.count; i++) {
    const l = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i));
    if (Math.abs(l - 1) > 0.0004) {
      out = geo.clone();
      const a = out.attributes.normal.clone();
      for (let j = 0; j < a.count; j++) {
        const x = a.getX(j);
        const y = a.getY(j);
        const z = a.getZ(j);
        const len = Math.hypot(x, y, z);
        if (len > 1e-6) a.setXYZ(j, x / len, y / len, z / len);
        else a.setXYZ(j, 0, 1, 0); // entartetes Dreieck
      }
      out.setAttribute('normal', a);
      ctx.disposables.push(out);
      break;
    }
  }
  ctx.geos.set(key, out);
  return out;
}

/** Beidseitig sichtbare Bleche: Rückseiten als eigene Dreiecke (USDZ kennt keine beidseitigen Materialien). */
function doubleSided(geo, ctx) {
  if (ctx.geos.has(geo.uuid)) return ctx.geos.get(geo.uuid);
  const src = geo.index ? geo.toNonIndexed() : geo;
  const pos = src.attributes.position;
  const nor = src.attributes.normal;
  const uv = src.attributes.uv;
  const n = pos.count;
  const P = new Float32Array(n * 6);
  const N = new Float32Array(n * 6);
  const U = uv ? new Float32Array(n * 4) : null;
  const put = (dst, srcIdx, sign) => {
    P[dst * 3] = pos.getX(srcIdx);
    P[dst * 3 + 1] = pos.getY(srcIdx);
    P[dst * 3 + 2] = pos.getZ(srcIdx);
    N[dst * 3] = sign * nor.getX(srcIdx);
    N[dst * 3 + 1] = sign * nor.getY(srcIdx);
    N[dst * 3 + 2] = sign * nor.getZ(srcIdx);
    if (U) {
      U[dst * 2] = uv.getX(srcIdx);
      U[dst * 2 + 1] = uv.getY(srcIdx);
    }
  };
  for (let i = 0; i < n; i += 3) {
    put(i, i, 1);
    put(i + 1, i + 1, 1);
    put(i + 2, i + 2, 1);
    // Rückseite: umgekehrte Drehrichtung, Normalen gespiegelt
    put(n + i, i, -1);
    put(n + i + 1, i + 2, -1);
    put(n + i + 2, i + 1, -1);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  if (U) out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  if (src !== geo) src.dispose();
  ctx.disposables.push(out);
  ctx.geos.set(geo.uuid, out);
  return out;
}

/**
 * Baut aus den sichtbaren Teilen der Maschine eine eigenständige Szene in Metern:
 * mittig über dem Ursprung, Füße auf Höhe 0, Front nach +Z.
 */
export function buildARScene(input) {
  // ein Gerät (relativ zu seiner Wurzel, Maße in mm) oder mehrere Geräte in ihrer Aufstellung (Welt, m)
  const world = Array.isArray(input);
  const roots = world ? input : [input];
  const ctx = { mats: new Map(), geos: new Map(), woods: new Map(), disposables: [] };
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  group.name = 'Konfiguration';
  scene.add(group);
  let meshes = 0;
  let triangles = 0;
  for (const root of roots) {
  root.updateWorldMatrix(true, true);
  const inv = world ? new THREE.Matrix4() : new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverseVisible((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const src = o.material;
    if (src.side === THREE.BackSide) return;
    const mat = convertMaterial(src, ctx);
    if (!mat) return;
    if (!o.geometry.attributes.position || !o.geometry.attributes.normal) return;
    const base = unitNormals(o.geometry, ctx);
    const geo = src.side === THREE.DoubleSide ? doubleSided(base, ctx) : base;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = o.userData.slot || o.name || '';
    mesh.matrix.multiplyMatrices(inv, o.matrixWorld);
    mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    group.add(mesh);
    meshes++;
    triangles += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  });
  }
  // Modellmaße sind Millimeter (Weltkoordinaten sind schon in Metern)
  if (!world) group.scale.setScalar(0.001);
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  group.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  scene.updateMatrixWorld(true);
  const size = box.getSize(new THREE.Vector3());
  scene.userData = { meshes, triangles: Math.round(triangles), size: size.toArray().map((v) => +v.toFixed(4)), materials: [...ctx.mats.values()].filter(Boolean).length };
  scene.userData.dispose = () => ctx.disposables.forEach((d) => d.dispose());
  return scene;
}

export async function exportUSDZ(scene) {
  const { USDZExporter } = await import('three/addons/exporters/USDZExporter.js');
  const data = await new USDZExporter().parseAsync(scene, {
    quickLookCompatible: true,
    maxTextureSize: 1024,
    ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: 'horizontal' } },
  });
  return new Blob([data], { type: 'model/vnd.usdz+zip' });
}

export async function exportGLB(scene) {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const data = await new GLTFExporter().parseAsync(scene, { binary: true, maxTextureSize: 1024 });
  return new Blob([data], { type: 'model/gltf-binary' });
}

// ---------------------------------------------------------------- Gerät erkennen

export function detectPlatform() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  let quickLook = false;
  if (ios) {
    // In eingebetteten Web-Ansichten kennen nur einige Browser AR Quick Look
    const embedded = Boolean(window.webkit && window.webkit.messageHandlers);
    quickLook = embedded ? /CriOS\/|EdgiOS\/|FxiOS\/|GSA\/|DuckDuckGo\//.test(ua) : Boolean(document.createElement('a').relList?.supports?.('ar'));
  }
  return { ios, android, quickLook };
}

async function webxrSupported() {
  try {
    return Boolean(navigator.xr && window.XRSession && (await navigator.xr.isSessionSupported('immersive-ar')));
  } catch {
    return false;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Skript nicht ladbar: ${src}`));
    document.head.append(s);
  });
}

// ---------------------------------------------------------------- Dialog

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

export class ARExperience {
  /**
   * @param {object} o
   * @param {() => THREE.Object3D} o.getRoot      Wurzel des Maschinenmodells
   * @param {() => void} o.prepare                 vor dem Export (z. B. Hervorhebungen löschen)
   * @param {() => (string|null)} o.getShareUrl    Link zur aktuellen Konfiguration (oder null)
   */
  constructor({ getRoot, getRoots, getName, prepare, getShareUrl }) {
    this.getRoot = getRoot;
    this.getRoots = getRoots || null;
    this.getName = getName || (() => FILE_NAME);
    this.prepare = prepare || (() => {});
    this.getShareUrl = getShareUrl || (() => null);
    this.urls = [];
    this.opener = null;
    this.run = 0;
    this.#build();
  }

  #build() {
    this.text = el('p', { className: 'ar-text' });
    this.stage = el('div', { className: 'ar-stage' });
    this.actions = el('div', { className: 'ar-actions' });
    this.note = el('p', { className: 'ar-note' });
    this.closeBtn = el('button', { className: 'btn ghost', type: 'button', textContent: 'Schließen' });
    this.closeBtn.addEventListener('click', () => this.close());
    this.overlay = el(
      'div',
      { className: 'ar-overlay', id: 'ar-overlay', hidden: true },
      el(
        'div',
        { className: 'ar-card' },
        el('p', { className: 'ar-eyebrow', textContent: 'Augmented Reality' }),
        el('h2', { className: 'ar-title', id: 'ar-title', textContent: 'In Originalgröße bei dir zuhause' }),
        this.text,
        this.stage,
        this.actions,
        this.note,
        this.closeBtn,
      ),
    );
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-labelledby', 'ar-title');
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay.hidden) this.close();
    });
    document.body.append(this.overlay);
  }

  get isOpen() {
    return !this.overlay.hidden;
  }

  #set({ text = '', stage = [], actions = [], note = '', state }) {
    this.text.textContent = text;
    this.stage.replaceChildren(...stage);
    this.stage.hidden = !stage.length;
    this.actions.replaceChildren(...actions);
    this.actions.hidden = !actions.length;
    this.note.textContent = note;
    this.note.hidden = !note;
    this.overlay.dataset.state = state;
  }

  #busy(text) {
    this.#set({ state: 'busy', text, stage: [el('div', { className: 'ar-spinner' })] });
  }

  #url(blob) {
    const url = URL.createObjectURL(blob);
    this.urls.push(url);
    return url;
  }

  async #export(kind) {
    this.prepare();
    const scene = buildARScene(this.getRoots ? this.getRoots() : this.getRoot());
    try {
      return kind === 'usdz' ? await exportUSDZ(scene) : await exportGLB(scene);
    } finally {
      scene.userData.dispose();
    }
  }

  /** Öffnet den Dialog und bereitet AR für dieses Gerät vor. `force`: 'ios' | 'webxr' | 'none' (zum Testen). */
  async open(opener, force = new URLSearchParams(location.search).get('ar')) {
    this.opener = opener || document.activeElement;
    this.overlay.hidden = false;
    this.closeBtn.focus();
    const run = ++this.run;
    const platform = detectPlatform();
    this.#busy('AR-Modell wird vorbereitet …');
    try {
      const mode = ['ios', 'webxr', 'none'].includes(force) ? force : platform.quickLook ? 'ios' : (await webxrSupported()) ? 'webxr' : 'none';
      this.mode = mode;
      if (mode === 'ios') await this.#quickLook(run);
      else if (mode === 'webxr') await this.#webxr(run);
      else this.#fallback(platform);
    } catch (err) {
      console.error(err);
      if (run !== this.run) return;
      this.#set({
        state: 'error',
        text: 'Das AR-Modell konnte nicht erstellt werden.',
        note: 'Bitte die Seite neu laden und es noch einmal versuchen.',
      });
    }
  }

  close() {
    this.run++;
    this.overlay.hidden = true;
    this.stage.replaceChildren();
    for (const u of this.urls) URL.revokeObjectURL(u);
    this.urls = [];
    this.opener?.focus?.();
  }

  // iPhone / iPad: USDZ in AR Quick Look
  async #quickLook(run) {
    const blob = await this.#export('usdz');
    if (run !== this.run) return;
    const anchor = el('a', { rel: 'ar', href: `${this.#url(blob)}#allowsContentScaling=0`, download: `${this.getName()}.usdz`, hidden: true }, el('img', { alt: '' }));
    const go = el('button', { className: 'btn primary', type: 'button', textContent: 'Jetzt in AR öffnen' });
    go.addEventListener('click', () => anchor.click());
    this.#set({
      state: 'ready',
      text: 'Dein Modell ist bereit. Richte die Kamera auf die Arbeitsplatte oder den Boden und stelle die Maschine in Originalgröße ab.',
      stage: [el('div', { className: 'ar-ready', textContent: 'AR' }), anchor],
      actions: [go],
      note: ARTIFACT ? 'Öffnet sich nichts, ist AR in dieser eingebetteten Ansicht gesperrt. AR läuft, sobald der Konfigurator als eigene Webseite in Safari geöffnet wird.' : 'Tipp: Mit zwei Fingern drehen, mit einem Finger verschieben.',
    });
    go.focus();
    // direkt starten – klappt das ohne erneutes Tippen nicht, bleibt der Knopf
    anchor.click();
  }

  // Android: WebXR über <model-viewer>
  async #webxr(run) {
    const [blob] = await Promise.all([this.#export('glb'), import(/* @vite-ignore */ MODEL_VIEWER_URL)]);
    if (run !== this.run) return;
    const mv = document.createElement('model-viewer');
    for (const [k, v] of Object.entries({
      ar: '',
      'ar-modes': 'webxr',
      'ar-scale': 'fixed',
      'ar-placement': 'floor',
      'camera-controls': '',
      'interaction-prompt': 'none',
      'shadow-intensity': '1',
      exposure: '0.85',
      'camera-orbit': '-35deg 72deg auto',
      loading: 'eager',
      alt: 'Vorschau der konfigurierten Linea Mini R',
    })) {
      mv.setAttribute(k, v);
    }
    mv.className = 'ar-viewer';
    this.#set({ state: 'busy', text: 'AR-Modell wird geladen …', stage: [mv, el('div', { className: 'ar-spinner' })] });
    await new Promise((resolve, reject) => {
      mv.addEventListener('load', resolve, { once: true });
      mv.addEventListener('error', () => reject(new Error('Modell konnte nicht geladen werden')), { once: true });
      mv.src = this.#url(blob);
    });
    if (run !== this.run) return;
    const go = el('button', { className: 'btn primary', type: 'button', textContent: 'Jetzt in AR öffnen' });
    go.addEventListener('click', () => {
      if (mv.canActivateAR) mv.activateAR();
      else this.note.textContent = 'AR lässt sich auf diesem Gerät nicht starten. Benötigt werden Chrome und die „Google Play-Dienste für AR“.';
    });
    mv.addEventListener('ar-status', (e) => {
      if (e.detail.status === 'failed') this.note.textContent = 'AR konnte nicht gestartet werden. Bitte Kamerazugriff erlauben und erneut versuchen.';
    });
    this.#set({
      state: 'ready',
      text: 'Dein Modell ist bereit. Bewege das Handy langsam über die Arbeitsplatte oder den Boden, bis die Maschine erscheint.',
      stage: [mv],
      actions: [go],
      note: 'Die Maschine steht in Originalgröße im Raum. Mit zwei Fingern drehen, mit einem verschieben.',
    });
    go.focus();
  }

  // Rechner oder Browser ohne AR: aufs Handy wechseln bzw. Dateien speichern
  #fallback(platform) {
    const share = this.getShareUrl();
    const online = share && /^https:/.test(share);
    const stage = [];
    const actions = [];
    let text;
    let note = '';
    if (platform.ios) {
      text = 'AR startet auf dem iPhone und iPad in Safari. Öffne den Konfigurator dort und tippe erneut auf „In AR ansehen“.';
    } else if (platform.android) {
      text = 'AR startet auf Android in Chrome. Benötigt werden die „Google Play-Dienste für AR“.';
    } else {
      text = 'AR läuft auf dem Handy oder Tablet: iPhone und iPad mit Safari, Android mit Chrome.';
    }
    if (online && !platform.ios && !platform.android) {
      const qr = el('div', { className: 'ar-qr' });
      stage.push(qr);
      text += ' Scanne den Code mit der Handykamera – deine Konfiguration wird mitgenommen.';
      this.#qr(qr, `${share}${share.includes('#') ? '&' : '#'}ar=1`);
    } else if (!ARTIFACT && !online) {
      note = 'Für den Wechsel aufs Handy muss der Konfigurator online erreichbar sein (https).';
    }
    if (ARTIFACT) {
      note = 'In dieser eingebetteten Ansicht ist AR nicht verfügbar. AR läuft, sobald der Konfigurator als eigene Webseite geöffnet wird.';
    } else {
      actions.push(this.#fileButton('AR-Datei für iPhone (.usdz)', 'usdz'), this.#fileButton('3D-Datei (.glb)', 'glb'));
    }
    this.#set({ state: 'info', text, stage, actions, note });
  }

  #fileButton(label, kind) {
    const btn = el('button', { className: 'btn', type: 'button', textContent: label });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = 'Wird erstellt …';
      try {
        const blob = await this.#export(kind);
        const a = el('a', { href: this.#url(blob), download: `${this.getName()}.${kind}` });
        a.click();
      } catch (err) {
        console.error(err);
        this.note.hidden = false;
        this.note.textContent = 'Die Datei konnte nicht erstellt werden.';
      }
      btn.textContent = old;
      btn.disabled = false;
    });
    return btn;
  }

  async #qr(target, url) {
    try {
      if (!window.qrcode) await loadScript(QR_URL);
      const qr = window.qrcode(0, 'L');
      qr.addData(url);
      qr.make();
      target.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      target.querySelector('svg')?.setAttribute('aria-label', 'QR-Code zum Öffnen auf dem Handy');
    } catch (err) {
      console.error(err);
      target.textContent = url;
    }
  }
}
