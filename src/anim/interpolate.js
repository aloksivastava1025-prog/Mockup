import { ANIMATED_GROUPS } from './groups.js'

/**
 * Catmull-Rom through four control points.
 *
 * Easing each segment independently makes the motion stop dead at every
 * keyframe — velocity hits zero on both sides of it — which is why an eight
 * keyframe move read as eight separate nudges rather than one glide. A spline
 * passes through the same poses but carries its velocity across them.
 *
 * Equal values on both sides of a segment are treated as a deliberate hold and
 * left flat, otherwise neighbouring motion would bulge through a static beat.
 */
function catmull(p0, p1, p2, p3, t) {
  if (typeof p1 === 'number' && typeof p2 === 'number') {
    if (p1 === p2) return p1
    const a = typeof p0 === 'number' ? p0 : p1
    const b = typeof p3 === 'number' ? p3 : p2
    const t2 = t * t
    const t3 = t2 * t
    return (
      0.5 *
      (2 * p1 + (-a + p2) * t + (2 * a - 5 * p1 + 4 * p2 - b) * t2 + (-a + 3 * p1 - 3 * p2 + b) * t3)
    )
  }
  if (Array.isArray(p1) && Array.isArray(p2)) {
    return p1.map((v, i) => catmull(p0?.[i], v, p2[i] ?? v, p3?.[i], t))
  }
  if (p1 && typeof p1 === 'object' && p2 && typeof p2 === 'object') {
    const out = {}
    for (const k of Object.keys(p1)) out[k] = catmull(p0?.[k], p1[k], p2[k], p3?.[k], t)
    return out
  }
  return t < 0.5 ? p1 : p2
}

export function lerpStates(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => lerpStates(v, b[i] ?? v, t))
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    const out = {}
    for (const k of Object.keys(a)) out[k] = lerpStates(a[k], b[k], t)
    return out
  }
  // strings, booleans and anything else snap at the midpoint of the segment
  return t < 0.5 ? a : b
}

/**
 * Returns the animated groups at time `time`. Falls back to `live` when there
 * are fewer than two keyframes, so the scene always has something to render.
 */
export function sampleAt(keyframes, time, live) {
  if (!keyframes || keyframes.length === 0) return live
  if (keyframes.length === 1) return keyframes[0].state
  if (time <= keyframes[0].time) return keyframes[0].state
  const last = keyframes[keyframes.length - 1]
  if (time >= last.time) return last.state

  let i = 0
  while (i < keyframes.length - 1 && keyframes[i + 1].time <= time) i++
  const a = keyframes[i]
  const b = keyframes[i + 1]
  const span = b.time - a.time
  const u = span <= 1e-6 ? 0 : (time - a.time) / span

  // A recorded take already contains the operator's own acceleration, and its
  // simplification assumed linear prediction, so those play back straight.
  if (a.ease === 'linear') {
    const out = {}
    for (const g of ANIMATED_GROUPS) out[g] = lerpStates(a.state[g], b.state[g], u)
    return out
  }

  // Authored keyframes ride a spline through their neighbours so the motion
  // keeps its speed across each pose instead of stopping on it.
  const p0 = keyframes[i - 1] ?? a
  const p3 = keyframes[i + 2] ?? b
  const out = {}
  for (const g of ANIMATED_GROUPS) {
    out[g] = catmull(p0.state[g], a.state[g], b.state[g], p3.state[g], u)
  }
  return out
}
