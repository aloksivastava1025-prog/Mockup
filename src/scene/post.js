import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

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
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uTemperature;

  /**
   * No tone mapping and no sRGB encode in here. Both belong to the OutputPass
   * at the end of the chain, which is the only thing that knows what the
   * renderer is configured for.
   *
   * Doing them by hand was three attempts of being subtly wrong: darks crushed
   * by 17/255 one way, highlights lifted by 27 the other, and the reflective
   * floor different again because MeshReflectorMaterial renders its own pass
   * and does not get the same treatment. Working in linear and letting three
   * finish the frame is not a shortcut, it is the only version that is right.
   */
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

    // --- grade, before the grain: film grain sits on the finished picture,
    // it is not something the grade acts on ---
    if (abs(uExposure) > 0.0001) col *= pow(2.0, uExposure);
    if (abs(uTemperature) > 0.0001) {
      // Warm pushes red and pulls blue, which is what a white-balance shift
      // does; adjusting all three would just be a tint.
      col.r *= 1.0 + uTemperature * 0.18;
      col.b *= 1.0 - uTemperature * 0.18;
    }
    if (abs(uContrast) > 0.0001) {
      // Pivoted at 0.18, mid grey in linear light. Pivoting at 0.5 instead
      // darkens everything as you add contrast, because 0.5 linear is already
      // a bright value.
      col = (col - 0.18) * (1.0 + uContrast) + 0.18;
    }
    if (abs(uSaturation) > 0.0001) {
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(lum), col, 1.0 + uSaturation);
    }
    col = max(col, vec3(0.0));

    if (uGrain > 0.0001) {
      float n = hash(vUv * vec2(1920.0, 1080.0) + uTime) - 0.5;
      col += n * uGrain * 0.18;
    }

    gl_FragColor = vec4(col, 1.0);
  }
`

/** Effects the pass can apply, in the order they are offered. */
export const EFFECTS = {
  bloom: { label: 'Bloom', uniform: 'uBloom', max: 1, initial: 0.4 },
  vignette: { label: 'Vignette', uniform: 'uVignette', max: 1, initial: 0.5 },
  chroma: { label: 'Chromatic abb.', uniform: 'uChroma', max: 1, initial: 0.3 },
  fisheye: { label: 'Fish eye', uniform: 'uFisheye', max: 1, min: -1, initial: 0.35 },
  grain: { label: 'Grain', uniform: 'uGrain', max: 1, initial: 0.3 },
  exposure: { label: 'Exposure', uniform: 'uExposure', min: -2, max: 2, initial: 0.3 },
  contrast: { label: 'Contrast', uniform: 'uContrast', min: -0.8, max: 1.5, initial: 0.25 },
  saturation: { label: 'Saturation', uniform: 'uSaturation', min: -1, max: 1.5, initial: 0.25 },
  temperature: { label: 'Warmth', uniform: 'uTemperature', min: -1, max: 1, initial: 0.3 },
  // Ambient occlusion is deliberately absent. It was wired up through
  // GTAOPass and shaded the backdrop along with the geometry — the sky is not
  // drawn into the depth buffer, and although the shader discards at depth 1
  // the result still came back dimming the whole frame. Worth doing, needs the
  // background masked properly, and half of it is worse than none.
}

export const EFFECT_LIST = Object.entries(EFFECTS).map(([id, e]) => ({ id, label: e.label }))

export function makePostPass() {
  const uniforms = {
    tDiffuse: { value: null },
    uTexel: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
    uFisheye: { value: 0 },
    uChroma: { value: 0 },
    uBloom: { value: 0 },
    uVignette: { value: 0 },
    uGrain: { value: 0 },
    uTime: { value: 0 },
    uExposure: { value: 0 },
    uContrast: { value: 0 },
    uSaturation: { value: 0 },
    uTemperature: { value: 0 },
  }

  let composer = null
  let effectPass = null
  let bound = null // the renderer/scene/camera the chain was built for

  /**
   * Built lazily and rebuilt if the scene or camera is swapped. The chain is
   * RenderPass -> our effects -> OutputPass; that last one is the piece worth
   * having, because it applies the renderer's tone mapping and colour space at
   * the end, once, which is what three does for a direct render too.
   */
  const build = (gl, scene, camera) => {
    composer?.dispose?.()
    composer = new EffectComposer(gl)
    composer.addPass(new RenderPass(scene, camera))
    // A ShaderMaterial, not a plain shader object. Handed the latter,
    // ShaderPass clones the uniforms — so every value written to ours went to
    // an object the material had never heard of, and the effects silently did
    // nothing. Passing a material keeps the reference.
    effectPass = new ShaderPass(
      new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG }),
    )
    composer.addPass(effectPass)
    composer.addPass(new OutputPass())
    bound = { gl, scene, camera }
  }

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
    return any ? { uniforms: out } : null
  }

  return {
    render(gl, scene, camera, effects) {
      const active = gather(effects)
      if (!active) {
        // Nothing on: straight to the canvas, byte for byte what it always
        // was. No point paying for a chain to change nothing.
        gl.setRenderTarget(null)
        gl.render(scene, camera)
        return
      }

      if (!composer || bound.gl !== gl || bound.scene !== scene || bound.camera !== camera) {
        build(gl, scene, camera)
      }

      const w = gl.domElement.width
      const h = gl.domElement.height
      composer.setPixelRatio(1)
      composer.setSize(w, h)
      uniforms.uTexel.value.set(1 / w, 1 / h)
      for (const def of Object.values(EFFECTS)) {
        if (def.uniform) uniforms[def.uniform].value = active.uniforms[def.uniform] ?? 0
      }
      uniforms.uTime.value = performance.now() * 0.001

      composer.render()
    },
    dispose() {
      composer?.dispose?.()
      composer = null
    },
  }
}
