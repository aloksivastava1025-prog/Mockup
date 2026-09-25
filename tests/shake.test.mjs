import assert from 'node:assert/strict'
import { shakeAt } from '../src/anim/shake.js'

const OPT = { amount: 1, speed: 1 }

// Off means off, not "very small".
assert.equal(shakeAt(5, { amount: 0 }), null, 'zero amount should produce nothing at all')

// Deterministic: a re-export of the same shot has to match the last one.
const a = shakeAt(7.321, OPT)
const b = shakeAt(7.321, OPT)
assert.deepEqual(a, b, 'the same time must give the same offset')

// Smooth, not jittery. Sampled at 60fps the step between frames should be a
// small fraction of the overall travel — random noise would be the same size
// as the range itself.
let maxStep = 0
let lo = Infinity
let hi = -Infinity
let prev = shakeAt(0, OPT).pos[0]
for (let t = 1 / 60; t < 30; t += 1 / 60) {
  const v = shakeAt(t, OPT).pos[0]
  maxStep = Math.max(maxStep, Math.abs(v - prev))
  lo = Math.min(lo, v)
  hi = Math.max(hi, v)
  prev = v
}
const range = hi - lo
console.log(`x travel ${range.toFixed(4)}, largest one-frame step ${maxStep.toFixed(5)}`)
assert.ok(maxStep < range / 8, 'a frame-to-frame step should be small against the whole travel')

// Bounded, so it can never walk the camera off the subject.
assert.ok(range < 0.05, `x travel should stay small, got ${range.toFixed(4)}`)

// It has to actually move, and scale with amount.
assert.ok(range > 0.005, 'there should be visible travel at amount 1')
const half = shakeAt(3.7, { amount: 0.5, speed: 1 }).pos[0]
const full = shakeAt(3.7, { amount: 1, speed: 1 }).pos[0]
assert.ok(Math.abs(full - half * 2) < 1e-9, 'amount should scale linearly')

// Speed changes the rate, not the size.
let fastMax = 0
let fastPrev = shakeAt(0, { amount: 1, speed: 3 }).pos[0]
for (let t = 1 / 60; t < 10; t += 1 / 60) {
  const v = shakeAt(t, { amount: 1, speed: 3 }).pos[0]
  fastMax = Math.max(fastMax, Math.abs(v - fastPrev))
  fastPrev = v
}
assert.ok(fastMax > maxStep * 2, 'higher speed should move further per frame')

// Aim wanders more than the body, which is how a hand behaves.
let posRange = 0
let aimRange = 0
for (let t = 0; t < 30; t += 0.05) {
  posRange = Math.max(posRange, Math.abs(shakeAt(t, OPT).pos[0]))
  aimRange = Math.max(aimRange, Math.abs(shakeAt(t, OPT).aim[0]))
}
assert.ok(aimRange > posRange, 'the aim should wander further than the position')

console.log('ok')
