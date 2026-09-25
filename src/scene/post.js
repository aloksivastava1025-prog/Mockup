import * as THREE from 'three'

/**
 * A single full-frame pass for the optical effects.
 *
 * One pass, not a chain of them: every effect here is a function of the same
 * sampled pixel, so they fold into one shader and cost one draw. A chain would
 * mean a render target and a full-screen fill per effect, for no gain.
 *
 * Order matters and follows a real lens. The UV is distorted first, because
 * barrel distortion happens in the glass before anything else; the channels
 * are then split along that distorted ray, since chromatic aberration is the
 * same glass failing to focus the colours together; bloom is light spilling on
 * the sensor, so it is added after; vignette is the barrel cutting the corners
 * of the image that reaches it; and grain is the sensor itself, last.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform vec2 uTexel;
  uniform float uFisheye;
  uniform float uChroma;
  uniform float uBloom;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uTime;

  uniform float uExposure;

  /**
   * ACES filmic, matching three's own. Three applies tone mapping and colour
   * conversion only on the final draw to the canvas, never when rendering into
   * a target — so the target holds raw untone-mapped HDR and the pass has to do
   * both itself. Skipping this shifted every frame: darks down, highlights
   * clipped to white, measurably 7/255 off a direct render.
   */
  vec3 acesFilmic(vec3 color) {
    const mat3 inMat = mat3(
      0.59719, 0.07600, 0.02840,
      0.35458, 0.90834, 0.13383,
      0.04823, 0.01566, 0.83777
    );
    const mat3 outMat = mat3(
       1.60475, -0.10208, -0.00327,
      -0.53108,  1.10813, -0.07276,
      -0.07367, -0.00605,  1.07602
    );
    color *= uExposure / 0.6;
    color = inMat * color;
    vec3 a = color * (color + 0.0245786) - 0.000090537;
    vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
    color = a / b;
    color = outMat * color;
    return clamp(color, 0.0, 1.0);
  }

  // Linear to sRGB. A raw ShaderMaterial gets no colour-space conversion from
  // three, so the encode is ours to do as well.
  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 c = vUv - 0.5;
    float r2 = dot(c, c);

    // Barrel/pincushion. Rescaled by the same factor at the corner so the
    // frame stays filled instead of pulling the edges in and showing black.
    vec2 uv = vUv;
    if (abs(uFisheye) > 0.0001) {
      float k = uFisheye * 0.9;
      float corner = 0.5;
      vec2 d = c * (1.0 + k * r2) / (1.0 + k * corner * corner);
      uv = d + 0.5;
    }

    vec3 col;
    if (uChroma > 0.0001) {
      vec2 off = (uv - 0.5) * uChroma * 0.02;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;
    } else {
      col = texture2D(tDiffuse, uv).rgb;
    }

    if (uBloom > 0.0001) {
      // Threshold, then a wide cross of taps. Cheap, and at this radius the
      // shape of the kernel is invisible next to the fact that it glows.
      vec3 sum = vec3(0.0);
      float w = 0.0;
      for (int i = -6; i <= 6; i++) {
        float fi = float(i);
        vec2 o = vec2(fi, 0.0) * uTexel * 5.0;
        vec2 o2 = vec2(0.0, fi) * uTexel * 5.0;
        float g = exp(-fi * fi / 18.0);
        // Thresholded in linear HDR, where a highlight can sit well above 1
        // and actually has something to bloom with.
        sum += max(texture2D(tDiffuse, uv + o).rgb - 1.0, 0.0) * g;
        sum += max(texture2D(tDiffuse, uv + o2).rgb - 1.0, 0.0) * g;
        w += g * 2.0;
      }
      col += (sum / w) * uBloom * 3.0;
    }

    if (uVignette > 0.0001) {
      float v = smoothstep(0.85, 0.15, r2 * 2.0);
      col *= mix(1.0, v, uVignette);
    }

    if (uGrain > 0.0001) {
      float n = hash(vUv * vec2(1920.0, 1080.0) + uTime) - 0.5;
      col += n * uGrain * 0.18;
    }

    gl_FragColor = vec4(toSRGB(acesFilmic(col)), 1.0);
  }
`

/** Effects the pass can apply, in the order they are offered. */
export const EFFECTS = {
  bloom: { label: 'Bloom', uniform: 'uBloom', max: 1, initial: 0.4 },
  vignette: { label: 'Vignette', uniform: 'uVignette', max: 1, initial: 0.5 },
  chroma: { label: 'Chromatic abb.', uniform: 'uChroma', max: 1, initial: 0.3 },
  fisheye: { label: 'Fish eye', uniform: 'uFisheye', max: 1, min: -1, initial: 0.35 },
  grain: { label: 'Grain', uniform: 'uGrain', max: 1, initial: 0.3 },
}

export const EFFECT_LIST = Object.entries(EFFECTS).map(([id, e]) => ({ id, label: e.label }))

export function makePostPass() {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: 4, // keep the multisampling the direct-to-canvas path was getting
  })
  const uniforms = {
    tDiffuse: { value: target.texture },
    uTexel: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
    uFisheye: { value: 0 },
    uChroma: { value: 0 },
    uBloom: { value: 0 },
    uVignette: { value: 0 },
    uGrain: { value: 0 },
    uTime: { value: 0 },
    uExposure: { value: 1 },
  }
  const quadScene = new THREE.Scene()
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false }),
  )
  quad.frustumCulled = false
  quadScene.add(quad)

  /** Collapses the stack into uniform values; disabled rows contribute nothing. */
  const gather = (effects) => {
    const out = {}
    let any = false
    for (const e of effects ?? []) {
      const def = EFFECTS[e.type]
      if (!def || e.on === false || !e.amount) continue
      out[def.uniform] = (out[def.uniform] ?? 0) + e.amount
      any = true
    }
    return any ? out : null
  }

  return {
    render(gl, scene, camera, effects) {
      const active = gather(effects)
      if (!active) {
        // Nothing on: go straight to the canvas, exactly as before. Routing an
        // untouched frame through a target would cost a copy and risk shifting
        // the colour for no reason at all.
        gl.setRenderTarget(null)
        gl.render(scene, camera)
        return
      }

      const w = gl.domElement.width
      const h = gl.domElement.height
      if (target.width !== w || target.height !== h) target.setSize(w, h)
      uniforms.uTexel.value.set(1 / w, 1 / h)
      for (const def of Object.values(EFFECTS)) uniforms[def.uniform].value = active[def.uniform] ?? 0
      uniforms.uTime.value = performance.now() * 0.001
      uniforms.uExposure.value = gl.toneMappingExposure

      // Tone mapping has to belong to exactly one of us. Three's own pass is
      // switched off for the scene render, so the target holds plain linear
      // light and the shader below is the only thing that maps it. Leaving
      // both on double-maps, and measured that lifted the display from 27 to
      // 79 — mid greys turning to fog.
      const prevToneMapping = gl.toneMapping
      gl.toneMapping = THREE.NoToneMapping
      gl.setRenderTarget(target)
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)
      gl.toneMapping = prevToneMapping
      gl.render(quadScene, quadCam)
    },
    dispose() {
      target.dispose()
      quad.geometry.dispose()
      quad.material.dispose()
    },
  }
}
