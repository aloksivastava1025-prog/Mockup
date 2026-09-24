import { ANIMATED_GROUPS } from '../store/useStudio.js'

const smoothstep = (t) => t * t * (3 - 2 * t)

function blend(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => blend(v, b[i] ?? v, t))
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    const out = {}
    for (const k of Object.keys(a)) out[k] = blend(a[k], b[k], t)
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
  const t = span <= 1e-6 ? 0 : smoothstep((time - a.time) / span)

  const out = {}
  for (const g of ANIMATED_GROUPS) out[g] = blend(a.state[g], b.state[g], t)
  return out
}
