import assert from 'node:assert/strict'
import { samplesToKeyframes } from '../src/anim/record.js'
import { sampleAt } from '../src/anim/interpolate.js'

const FPS = 30
const DUR = 35
const rnd = (() => {
  let s = 12345
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5)
})()

const lerp = (a, b, u) => a + (b - a) * u
const clamp01 = (u) => Math.min(1, Math.max(0, u))

// A plausible take: holds, a smooth orbit while the lid opens, a push in.
function poseAt(t) {
  const orbit = clamp01((t - 5) / 10)
  const push = clamp01((t - 20) / 10)
  const az = lerp(-40, 25, orbit) * (Math.PI / 180)
  const d = lerp(0.95, 0.62, push)
  const jitter = () => rnd() * 0.0008 // capture noise
  return {
    device: {
      position: [0, 0, 0],
      rotation: [0, lerp(-30, 10, orbit) + rnd() * 0.02, 0],
      lidAngle: lerp(6, 104, clamp01((t - 5) / 6)) + rnd() * 0.02,
      scale: 1,
    },
    camera: {
      position: [d * Math.sin(az) + jitter(), 0.3 + jitter(), d * Math.cos(az) + jitter()],
      target: [0, 0.115, 0],
      fov: 34,
    },
    screen: { scale: 1, offsetX: 0, offsetY: 0, fit: 'cover', letterbox: '#000000', scroll: 0, brightness: 1.05, glow: 0.25 },
    post: { fade: 0, fadeColor: '#000000' },
  }
}

const samples = []
for (let i = 0; i <= DUR * FPS; i++) {
  const time = i / FPS
  samples.push({ time, state: poseAt(time) })
}

// The previous approach: keep a sample if it differs from the last kept one,
// plus a forced keyframe every half second.
function oldDecimate(list) {
  const kept = [list[0]]
  let anchor = list[0]
  for (let i = 1; i < list.length - 1; i++) {
    const s = list[i]
    const a = anchor.state
    const b = s.state
    const moved =
      Math.abs(a.device.lidAngle - b.device.lidAngle) > 0.35 ||
      Math.abs(a.device.rotation[1] - b.device.rotation[1]) > 0.35 ||
      Math.abs(a.camera.position[0] - b.camera.position[0]) > 0.002 ||
      Math.abs(a.camera.position[2] - b.camera.position[2]) > 0.002
    if (moved || s.time - anchor.time >= 0.5) {
      kept.push(s)
      anchor = s
    }
  }
  kept.push(list[list.length - 1])
  return kept
}

// Worst reconstruction error, as a multiple of each field's tolerance.
function maxError(keyframes) {
  let worst = 0
  let at = 0
  for (const s of samples) {
    const got = sampleAt(keyframes, s.time, s.state)
    const e = Math.max(
      Math.abs(got.device.lidAngle - s.state.device.lidAngle) / 0.3,
      Math.abs(got.device.rotation[1] - s.state.device.rotation[1]) / 0.3,
      Math.abs(got.camera.position[0] - s.state.camera.position[0]) / 0.002,
      Math.abs(got.camera.position[1] - s.state.camera.position[1]) / 0.002,
      Math.abs(got.camera.position[2] - s.state.camera.position[2]) / 0.002,
    )
    if (e > worst) {
      worst = e
      at = s.time
    }
  }
  return { worst: +worst.toFixed(2), at: +at.toFixed(2) }
}

const old = oldDecimate(samples)
const kf = samplesToKeyframes(samples)
const err = maxError(kf)

console.log('raw samples    ', samples.length)
console.log('neighbour-diff ', old.length, 'keyframes')
console.log('simplified     ', kf.length, 'keyframes')
console.log('playback error ', err.worst, '(1.0 = just visible)')

// A take has to come out editable by hand.
assert.ok(kf.length < 40, `expected a small track, got ${kf.length} keyframes`)
// ...without visibly departing from what was performed.
assert.ok(err.worst <= 1.05, `reconstruction drifts ${err.worst} tolerances at ${err.at}s`)

// The quality knob must trade count against fidelity, monotonically.
let prev = Infinity
for (const q of [0.5, 1, 2, 4]) {
  const k = samplesToKeyframes(samples, q)
  console.log(`  quality ${q}`.padEnd(16), String(k.length).padStart(3), 'keyframes, err', maxError(k).worst)
  assert.ok(k.length <= prev, 'a looser quality must not keep more keyframes')
  prev = k.length
}

// Recorded segments must interpolate linearly: the operator's own easing is
// already in the samples, and the simplification assumes linear prediction.
const easedErr = maxError(kf.map((k) => ({ ...k, ease: undefined }))).worst
console.log('same track, eased instead of linear:', easedErr)
assert.ok(easedErr > 5 * err.worst, 'expected easing a recorded take to visibly distort it')

console.log('ok')
