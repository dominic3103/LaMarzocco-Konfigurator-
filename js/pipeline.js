// ---------------------------------------------------------------------------
// Render-Pipeline: progressives Rendering für fotorealistische Standbilder
//
// Solange sich etwas bewegt, wird ein einzelnes Bild gezeichnet (hartes
// Hauptlicht, ungeschattetes Himmelslicht). Steht die Szene still, werden
// weitere Bilder gemittelt, jedes mit
//   - leicht versetztem Hauptlicht        -> weiche Schatten wie von einer Softbox
//   - einer zufälligen Himmelsrichtung    -> echte Verschattung in Ecken, unter
//                                            Überhängen und am Boden
//   - Sub-Pixel-Versatz                   -> saubere Kantenglättung
//   - versetzter Blende                   -> leichte Tiefenunschärfe
// Das Ergebnis liegt linear (HDR) in einem Zwischenspeicher und wird erst am
// Ende mit Tone-Mapping und leichtem Überstrahlen (Bloom) ausgegeben.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

/**
 * Himmelslicht-Samples sollen nur diffus beleuchten (sonst entstehen auf
 * polierten Flächen Punktreflexe). Dafür wird der Three.js-Baustein für
 * Richtungslichter einmalig erweitert: jede weitere schattenwerfende
 * Richtungslichtquelle nach dem Hauptlicht zählt als Himmelslicht.
 */
function patchShaders() {
  const key = 'lights_fragment_begin';
  const src = THREE.ShaderChunk[key];
  if (src.includes('SKY_SAMPLE_DIFFUSE_ONLY')) return;
  const start = src.indexOf('NUM_DIR_LIGHTS > 0');
  const call = /RE_Direct\(\s*directLight\s*,[^;]*;/;
  const tail = src.slice(start);
  const m = tail.match(call);
  if (start < 0 || !m) {
    console.warn('Shader-Erweiterung für das Himmelslicht nicht möglich – Standardbeleuchtung aktiv.');
    return;
  }
  const patched = tail.replace(
    call,
    `// SKY_SAMPLE_DIFFUSE_ONLY
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX > 0 ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		reflectedLight.directDiffuse += saturate( dot( geometryNormal, directLight.direction ) ) * directLight.color * BRDF_Lambert( material.diffuseColor );
		#else
		${m[0]}
		#endif`,
  );
  THREE.ShaderChunk[key] = src.slice(0, start) + patched;

  // Diffuses Umgebungslicht (unverschattet) nur anteilig – der Rest kommt verschattet
  // von Hauptlicht und Himmelslicht. Spiegelungen der Umgebung bleiben voll erhalten.
  const maps = THREE.ShaderChunk.lights_fragment_maps;
  const ibl = /iblIrradiance\s*\+=\s*getIBLIrradiance\(\s*geometryNormal\s*\);/;
  if (ibl.test(maps)) THREE.ShaderChunk.lights_fragment_maps = maps.replace(ibl, 'iblIrradiance += getIBLIrradiance( geometryNormal ) * 0.15;');
}
patchShaders();

/** Boden als Schattenfänger: Hauptlicht- und Himmelsschatten getrennt gewichtet, nach außen ausgeblendet. */
export function makeGroundMaterial() {
  const mat = new THREE.ShadowMaterial({ opacity: 0.8 });
  mat.userData.weights = { value: new THREE.Vector2(0.55, 0) };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uShadowW = mat.userData.weights;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec2 vGroundPos;\nvoid main() {')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n\tvGroundPos = ( modelMatrix * vec4( position, 1.0 ) ).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform vec2 uShadowW;
varying vec2 vGroundPos;
float groundShade() {
	float d = 0.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow dl0 = directionalLightShadows[ 0 ];
	d += uShadowW.x * ( 1.0 - getShadow( directionalShadowMap[ 0 ], dl0.shadowMapSize, dl0.shadowIntensity, dl0.shadowBias, dl0.shadowRadius, vDirectionalShadowCoord[ 0 ] ) );
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 1
	DirectionalLightShadow dl1 = directionalLightShadows[ 1 ];
	d += uShadowW.y * ( 1.0 - getShadow( directionalShadowMap[ 1 ], dl1.shadowMapSize, dl1.shadowIntensity, dl1.shadowBias, dl1.shadowRadius, vDirectionalShadowCoord[ 1 ] ) );
	#endif
	#endif
	float fade = 1.0 - smoothstep( 0.7, 1.3, length( vGroundPos ) );
	return clamp( d, 0.0, 1.0 ) * fade;
}
void main() {`,
      )
      .replace(/opacity\s*\*\s*\(\s*1\.0\s*-\s*getShadowMask\(\)\s*\)/, 'opacity * groundShade()');
  };
  return mat;
}

const FULLSCREEN_VS = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = vec4( position.xy, 0.0, 1.0 );
}`;

// gleichmäßig verteilte Folgen (R2-Sequenz) für Licht-, Blenden- und Pixelversatz
const R2 = (n, k) => {
  const a1 = 0.7548776662466927;
  const a2 = 0.5698402909980532;
  return [(0.5 + a1 * n + k * 0.31) % 1, (0.5 + a2 * n + k * 0.17) % 1];
};
const disk = (n, k) => {
  const [u, v] = R2(n, k);
  const r = Math.sqrt(u);
  const a = v * Math.PI * 2;
  return [r * Math.cos(a), r * Math.sin(a)];
};

export class RenderPipeline {
  /**
   * @param {object} o
   *   renderer, scene, camera, key, sky, hemi, ground, contact
   *   applyView(jx, jy): setzt Bildausschnitt + Sub-Pixel-Versatz (CSS-Pixel)
   *   focusDistance(): Entfernung der Schärfeebene (m)
   *   quality: 'auto' | 'high' | 'low'      samples: Anzahl gemittelter Bilder
   */
  constructor(o) {
    const { quality, samples, ...parts } = o;
    Object.assign(this, parts);
    const r = this.renderer;
    const hdr = r.capabilities.isWebGL2 && (r.extensions.has('EXT_color_buffer_float') || r.extensions.has('EXT_color_buffer_half_float'));
    this.forced = quality === 'high' || quality === 'low';
    this.mode = quality === 'low' || !hdr ? 'low' : 'high';
    this.maxSamples = samples || 64;
    this.n = 0;
    this.cur = 0;
    this.aperture = 0.0035; // Blendenradius in m (Tiefenunschärfe)
    this.keyRadius = 0.3; // Radius der Hauptlicht-Softbox in m
    this.bloom = 0.05;
    this.frameTimes = [];
    this.lastFrameAt = 0;
    this.focus = 1.4;

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false;
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const pass = (fragmentShader, uniforms, extra = {}) =>
      new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VS, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra });

    this.blendMat = pass(
      /* glsl */ `
uniform sampler2D tPrev;
uniform sampler2D tNew;
uniform float w;
varying vec2 vUv;
void main() {
	gl_FragColor = mix( texture2D( tPrev, vUv ), texture2D( tNew, vUv ), w );
}`,
      { tPrev: { value: null }, tNew: { value: null }, w: { value: 1 } },
    );
    this.brightMat = pass(
      /* glsl */ `
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
	vec3 c = texture2D( tDiffuse, vUv ).rgb;
	float l = max( c.r, max( c.g, c.b ) );
	// nur Glanzlichter oberhalb von Weiß, weich einsetzend
	float k = smoothstep( 3.0, 9.0, l );
	gl_FragColor = vec4( min( c, vec3( 12.0 ) ) * k, 1.0 );
}`,
      { tDiffuse: { value: null } },
    );
    this.blurMat = pass(
      /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 dir;
varying vec2 vUv;
void main() {
	vec3 c = texture2D( tDiffuse, vUv ).rgb * 0.227027;
	c += ( texture2D( tDiffuse, vUv + dir * 1.3846 ).rgb + texture2D( tDiffuse, vUv - dir * 1.3846 ).rgb ) * 0.316216;
	c += ( texture2D( tDiffuse, vUv + dir * 3.2308 ).rgb + texture2D( tDiffuse, vUv - dir * 3.2308 ).rgb ) * 0.070270;
	gl_FragColor = vec4( c, 1.0 );
}`,
      { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
    );
    // Ausgabe: Farbe aus vormultipliziertem Alpha zurückrechnen, Tone-Mapping, sRGB, Bloom additiv
    this.outMat = pass(
      /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float bloom;
varying vec2 vUv;
void main() {
	vec4 c = texture2D( tDiffuse, vUv );
	vec3 rgb = c.a > 0.0001 ? c.rgb / c.a : vec3( 0.0 );
	gl_FragColor = vec4( rgb, c.a );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	vec4 glow = vec4( texture2D( tBloom, vUv ).rgb * bloom, 1.0 );
	glow.rgb = glow.rgb / ( 1.0 + glow.rgb );
	glow = linearToOutputTexel( glow );
	gl_FragColor.rgb = gl_FragColor.rgb * gl_FragColor.a + glow.rgb * step( 0.0001, bloom );
}`,
      { tDiffuse: { value: null }, tBloom: { value: null }, bloom: { value: this.bloom } },
      { toneMapped: true },
    );
    this.#syncMode();
  }

  get quality() {
    return this.mode;
  }

  /** true, wenn das Bild vollständig gemittelt ist */
  get converged() {
    return this.mode === 'low' || this.n >= this.maxSamples;
  }

  /** true, wenn das Gerät die hochwertige Darstellung unterstützt */
  get supportsHigh() {
    const r = this.renderer;
    return r.capabilities.isWebGL2 && (r.extensions.has('EXT_color_buffer_float') || r.extensions.has('EXT_color_buffer_half_float'));
  }

  setQuality(mode) {
    if (mode === 'high' && !this.supportsHigh) mode = 'low';
    this.forced = true;
    if (mode === this.mode) return;
    this.mode = mode;
    this.#syncMode();
    this.n = 0;
  }

  #syncMode() {
    const high = this.mode === 'high';
    // im einfachen Modus gibt es kein Himmelslicht-Sample (spart einen Schattendurchlauf)
    if (high && !this.sky.parent) this.scene.add(this.sky, this.sky.target);
    if (!high && this.sky.parent) this.scene.remove(this.sky, this.sky.target);
    if (high && !this.targets && this.size) this.#allocate();
    if (!high) this.#dispose();
  }

  #dispose() {
    if (!this.targets) return;
    for (const t of Object.values(this.targets)) t.dispose();
    this.targets = null;
  }

  #allocate() {
    this.#dispose();
    const { w, h } = this.size;
    const hf = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    const bw = Math.max(2, Math.round(w / 4));
    const bh = Math.max(2, Math.round(h / 4));
    this.targets = {
      sample: new THREE.WebGLRenderTarget(w, h, { ...hf, depthBuffer: true, samples: 4 }),
      a: new THREE.WebGLRenderTarget(w, h, { ...hf, depthBuffer: false }),
      b: new THREE.WebGLRenderTarget(w, h, { ...hf, depthBuffer: false }),
      bloomA: new THREE.WebGLRenderTarget(bw, bh, { ...hf, depthBuffer: false }),
      bloomB: new THREE.WebGLRenderTarget(bw, bh, { ...hf, depthBuffer: false }),
    };
  }

  /** Größe des Zeichenpuffers in Gerätepixeln */
  setSize(w, h) {
    this.size = { w, h };
    if (this.mode === 'high') this.#allocate();
    this.n = 0;
  }

  #pass(material, target) {
    const r = this.renderer;
    this.quad.material = material;
    r.setRenderTarget(target);
    r.render(this.quad, this.quadCam);
  }

  /** Zwischenspeicher mit Tone-Mapping auf den Bildschirm ausgeben */
  present() {
    if (this.mode !== 'high' || !this.targets) return;
    const t = this.targets;
    const acc = this.cur === 0 ? t.a : t.b;
    if (this.bloom > 0) {
      this.brightMat.uniforms.tDiffuse.value = acc.texture;
      this.#pass(this.brightMat, t.bloomA);
      const bw = t.bloomA.width;
      const bh = t.bloomA.height;
      for (const s of [1, 2.2]) {
        this.blurMat.uniforms.tDiffuse.value = t.bloomA.texture;
        this.blurMat.uniforms.dir.value.set(s / bw, 0);
        this.#pass(this.blurMat, t.bloomB);
        this.blurMat.uniforms.tDiffuse.value = t.bloomB.texture;
        this.blurMat.uniforms.dir.value.set(0, s / bh);
        this.#pass(this.blurMat, t.bloomA);
      }
    }
    this.outMat.uniforms.tDiffuse.value = acc.texture;
    this.outMat.uniforms.tBloom.value = t.bloomA.texture;
    this.outMat.uniforms.bloom.value = this.bloom;
    this.#pass(this.outMat, null);
  }

  /**
   * Ein Bild zeichnen.
   * @param {boolean} dirty  Szene/Kamera hat sich geändert -> Mittelung neu beginnen
   * @returns {boolean} true, solange weitere Bilder gemittelt werden sollen
   */
  render(dirty) {
    const r = this.renderer;
    const { scene, camera, key, sky, hemi, ground, contact } = this;
    const weights = ground.material.userData.weights.value;
    // Anteil von Hauptlicht und Himmel an der Bodenbeleuchtung -> Gewichte der Bodenschatten
    const keyDir = key.position.clone().sub(key.target.position).normalize();
    const eKey = key.intensity * Math.max(0.05, keyDir.y);
    const eSky = hemi.intensity * Math.max(hemi.color.r, hemi.color.g, hemi.color.b);
    const fKey = eKey / (eKey + eSky + 1e-4);

    if (this.mode === 'low') {
      if (!dirty) return false;
      weights.set(Math.max(0.35, fKey * 0.8), 0);
      contact.visible = true;
      this.applyView(0, 0);
      r.setRenderTarget(null);
      r.render(scene, camera);
      return false;
    }
    if (!this.targets) return false;
    if (dirty) this.n = 0;
    if (this.n >= this.maxSamples) return false;
    const n = this.n;
    const t = this.targets;

    // --- Lichter und Kamera für dieses Sample ---
    const keyPos = key.position.clone();
    const skyColor = hemi.color.clone();
    const camPos = camera.position.clone();
    if (n === 0) {
      sky.intensity = 0;
      sky.shadow.autoUpdate = false;
      weights.set(fKey, 0);
      contact.visible = true;
      this.applyView(0, 0);
    } else {
      if (n === 1) this.focus = this.focusDistance();
      // Hauptlicht: zufälliger Punkt auf der Softbox-Fläche
      const [kx, ky] = disk(n, 0);
      const side = new THREE.Vector3().crossVectors(keyDir, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(side, keyDir).normalize();
      key.position.addScaledVector(side, kx * this.keyRadius).addScaledVector(up, ky * this.keyRadius);
      // Himmel: gleichmäßig über die obere Halbkugel (ab 9° Höhe)
      const [su, sv] = R2(n, 3);
      const s0 = Math.sin(THREE.MathUtils.degToRad(9));
      const sinEl = s0 + (1 - s0) * su;
      const cosEl = Math.sqrt(1 - sinEl * sinEl);
      const az = sv * Math.PI * 2;
      sky.position.set(Math.cos(az) * cosEl, sinEl, Math.sin(az) * cosEl).multiplyScalar(1.7).add(sky.target.position);
      sky.color.copy(skyColor);
      sky.intensity = 2 * hemi.intensity * (1 - s0);
      sky.shadow.autoUpdate = true;
      hemi.color.setRGB(0, 0, 0); // Himmelsanteil kommt jetzt (verschattet) vom Sample
      // Boden: flach einfallendes Himmelslicht trägt wenig bei (Kosinus-Gewichtung)
      weights.set(fKey, ((1 - fKey) * sinEl) / ((1 + s0) / 2));
      contact.visible = false;
      // Blende + Sub-Pixel-Versatz
      const [lx, ly] = disk(n, 5);
      const [jx, jy] = R2(n, 7);
      const ax = lx * this.aperture;
      const ay = ly * this.aperture;
      camera.updateMatrixWorld();
      const e = camera.matrixWorld.elements;
      camera.position.x += e[0] * ax + e[4] * ay;
      camera.position.y += e[1] * ax + e[5] * ay;
      camera.position.z += e[2] * ax + e[6] * ay;
      const fpx = this.viewHeight() / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const px = this.viewHeight() / this.size.h; // CSS-Pixel je Gerätepixel
      this.applyView((jx - 0.5) * px - (ax / this.focus) * fpx, (jy - 0.5) * px + (ay / this.focus) * fpx);
    }

    r.setRenderTarget(t.sample);
    r.clear();
    r.render(scene, camera);

    // --- Zustand wiederherstellen ---
    key.position.copy(keyPos);
    hemi.color.copy(skyColor);
    camera.position.copy(camPos);
    sky.intensity = 0;
    contact.visible = true;
    this.applyView(0, 0);

    // --- in den Zwischenspeicher mitteln ---
    const prev = this.cur === 0 ? t.a : t.b;
    const next = this.cur === 0 ? t.b : t.a;
    this.blendMat.uniforms.tPrev.value = prev.texture;
    this.blendMat.uniforms.tNew.value = t.sample.texture;
    this.blendMat.uniforms.w.value = 1 / (n + 1);
    this.#pass(this.blendMat, next);
    this.cur = 1 - this.cur;
    this.present();
    this.n++;
    this.#measure(n);
    return this.n < this.maxSamples;
  }

  /** Langsame Geräte erkennen: weniger Samples bzw. einfacher Modus */
  #measure(n) {
    if (this.forced) return;
    const now = performance.now();
    if (n >= 2 && this.lastFrameAt) this.frameTimes.push(now - this.lastFrameAt);
    this.lastFrameAt = n >= 1 ? now : 0;
    if (this.frameTimes.length < 6) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (avg > 160) {
      this.mode = 'low';
      this.#syncMode();
      this.onQualityChange?.('low');
    } else if (avg > 60) this.maxSamples = Math.min(this.maxSamples, 24);
  }
}
