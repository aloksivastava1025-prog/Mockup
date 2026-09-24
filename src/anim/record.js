import { ANIMATED_GROUPS } from '../store/useStudio.js'
import { lerpStates } from './interpolate.js'

/**
 * Turns a dense stream of samples captured while the user performs into a
 * keyframe track.
 *
 * The naive reduction — drop a sample if it barely differs from the one before
 * it — only removes stillness. It cannot touch movement, so a smooth ten
 * second orbit sampled at 30Hz survives as three hundred keyframes even though
 * five would reproduce it exactly. That is unusable to edit.
 *
 * So instead of comparing neighbours, ask the question that actually matters:
 * *if this sample were removed, would interpolating across the gap still land
 * on it?* If yes the sample carries no information. That is Ramer–Douglas–
 * Peucker, generalised from a 2D polyline to every animated field at once, and
 * it collapses smooth motion to its turning points.
 *
 * It is only correct because recorded segments interpolate linearly (see
 * sampleAt) — the prediction used here has to be the one playback will use.
 */

// Per-field sensitivity, in the field's own units. Distances are metres, so a
// couple of millimetres of camera travel is already imperceptible; angles are
// degrees. Error is measured as a multiple of these, so one field's tolerance
// is directly comparable to another's.
const TOLERANCE = {
  'device.position': 0.002,
  'device.rotation': 0.3,
  'device.lidAngle': 0.3,
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

/**
 * How far `sample` sits from `predicted`, as a multiple of each field's
 * tolerance. Anything above 1 is visible. A non-numeric field that disagrees
 * (a fit mode, a colour) can never be interpolated back, so it pins the sample.
 */
function deviation(sample, predicted) {
  let worst = 0
  for (const group of ANIMATED_GROUPS) {
    const actual = sample[group]
    const guess = predicted[group]
    if (!actual || !guess) continue
    for (const key of Object.keys(actual)) {
      const tol = TOLERANCE[`${group}.${key}`] ?? DEFAULT_TOLERANCE
      const a = actual[key]
      const p = guess[key]
      if (typeof a === 'number') {
        worst = Math.max(worst, Math.abs(a - p) / tol)
      } else if (Array.isArray(a)) {
        for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - p[i]) / tol)
      } else if (a !== p) {
        return Infinity
      }
    }
  }
  return worst
}

/**
 * @param quality multiplies the tolerances — below 1 keeps more keyframes and
 *   tracks the take more tightly, above 1 keeps fewer and smooths it out.
 */
export function simplify(samples, quality = 1) {
  const n = samples.length
  if (n <= 2) return samples.slice()

  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1

  const stack = [[0, n - 1]]
  while (stack.length) {
    const [lo, hi] = stack.pop()
    if (hi - lo < 2) continue

    const a = samples[lo]
    const b = samples[hi]
    const span = b.time - a.time

    let worst = 0
    let index = -1
    for (let i = lo + 1; i < hi; i++) {
      const u = span <= 1e-9 ? 0 : (samples[i].time - a.time) / span
      const predicted = lerpStates(a.state, b.state, u)
      const error = deviation(samples[i].state, predicted)
      if (error > worst) {
        worst = error
        index = i
      }
    }

    if (index >= 0 && worst > quality) {
      keep[index] = 1
      stack.push([lo, index], [index, hi])
    }
  }

  return samples.filter((_, i) => keep[i])
}

export function samplesToKeyframes(samples, quality = 1) {
  return simplify(samples, quality).map((s, i) => ({
    id: `rec_${i}_${Math.random().toString(36).slice(2, 7)}`,
    time: +s.time.toFixed(3),
    state: s.state,
    // A take plays back linearly; easing it again would stop the motion dead
    // at every keyframe, and would also invalidate the maths above.
    ease: 'linear',
  }))
}
