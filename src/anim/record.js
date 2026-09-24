import { ANIMATED_GROUPS } from '../store/useStudio.js'

/**
 * Turns a dense stream of samples captured while the user performs into a
 * keyframe track.
 *
 * Sampling at ~30Hz would give a 20 second take 600 keyframes, nearly all of
 * them redundant: while you are dragging one slider nothing else moves, and
 * between moves nothing moves at all. Keep a sample only when something has
 * actually changed by more than the eye can see, and the track collapses to a
 * handful of points that the timeline can still draw and edit.
 */

// Per-field sensitivity, in the field's own units. Distances are metres, so a
// millimetre of camera travel is already imperceptible; angles are degrees.
const TOLERANCE = {
  'device.position': 0.002,
  'device.rotation': 0.35,
  'device.lidAngle': 0.35,
  'device.scale': 0.005,
  'camera.position': 0.002,
  'camera.target': 0.002,
  'camera.fov': 0.15,
  'screen.scale': 0.004,
  'screen.offsetX': 0.002,
  'screen.offsetY': 0.002,
  'screen.scroll': 0.004,
  'screen.brightness': 0.01,
  'screen.glow': 0.01,
  'post.fade': 0.02,
}
const DEFAULT_TOLERANCE = 0.01

/** Longest gap we will leave between kept samples, so easing stays honest. */
const MAX_GAP = 0.5

function exceedsTolerance(a, b) {
  for (const group of ANIMATED_GROUPS) {
    const ga = a[group]
    const gb = b[group]
    if (!ga || !gb) continue
    for (const key of Object.keys(ga)) {
      const tol = TOLERANCE[`${group}.${key}`] ?? DEFAULT_TOLERANCE
      const va = ga[key]
      const vb = gb[key]
      if (typeof va === 'number') {
        if (Math.abs(va - vb) > tol) return true
      } else if (Array.isArray(va)) {
        for (let i = 0; i < va.length; i++) if (Math.abs(va[i] - vb[i]) > tol) return true
      } else if (va !== vb) {
        return true
      }
    }
  }
  return false
}

export function decimate(samples) {
  if (samples.length <= 2) return samples.slice()

  const kept = [samples[0]]
  let anchor = samples[0]

  for (let i = 1; i < samples.length - 1; i++) {
    const s = samples[i]
    if (exceedsTolerance(anchor.state, s.state) || s.time - anchor.time >= MAX_GAP) {
      // Keep the sample *before* the change too, so a move that starts after a
      // pause does not get eased into from the beginning of that pause.
      const prev = samples[i - 1]
      if (prev !== anchor && prev.time > kept[kept.length - 1].time + 1e-3) kept.push(prev)
      kept.push(s)
      anchor = s
    }
  }
  kept.push(samples[samples.length - 1])
  return kept
}

export function samplesToKeyframes(samples) {
  return decimate(samples).map((s, i) => ({
    id: `rec_${i}_${Math.random().toString(36).slice(2, 7)}`,
    time: +s.time.toFixed(3),
    state: s.state,
  }))
}
