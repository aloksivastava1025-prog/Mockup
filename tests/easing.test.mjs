import assert from 'node:assert/strict'
import { EASES, sampleAt } from '../src/anim/interpolate.js'

/** Two keyframes a second apart, one value moving 0 -> 1. */
const track = (ease) => [
  { id: 'a', time: 0, ease, state: { device: { scale: 0 }, camera: {}, screen: {}, post: {} } },
  { id: 'b', time: 1, state: { device: { scale: 1 }, camera: {}, screen: {}, post: {} } },
]

const at = (ease, t) => sampleAt(track(ease), t, null).device.scale

// Sampled speed either side of the midpoint, which is what "slow in" means.
const speed = (ease, t) => (at(ease, t + 0.01) - at(ease, t - 0.01)) / 0.02

console.log('mode      t=0.25  t=0.50  t=0.75   | start speed  end speed')
for (const id of Object.keys(EASES)) {
  if (!EASES[id].fn) continue
  const row = [0.25, 0.5, 0.75].map((t) => at(id, t).toFixed(3)).join('   ')
  console.log(`${id.padEnd(9)} ${row}   | ${speed(id, 0.06).toFixed(2).padStart(6)}  ${speed(id, 0.94).toFixed(2).padStart(9)}`)
}

// Every mode must actually get from one end to the other.
for (const id of Object.keys(EASES)) {
  if (!EASES[id].fn || id === 'hold') continue
  assert.ok(at(id, 0.001) < 0.02, `${id} should start at the first value`)
  assert.ok(at(id, 0.999) > 0.98, `${id} should arrive at the second`)
}

// Linear is a straight line: equal steps everywhere.
assert.ok(Math.abs(speed('linear', 0.1) - speed('linear', 0.9)) < 0.01, 'linear should not accelerate')

// Slow in starts slower than it finishes; slow out is the mirror of it.
assert.ok(speed('in', 0.06) < speed('in', 0.94) / 5, 'slow in should crawl out of the first key')
assert.ok(speed('out', 0.94) < speed('out', 0.06) / 5, 'slow out should settle into the second')

// Slow both is slow at each end and quickest in the middle.
assert.ok(speed('inout', 0.5) > speed('inout', 0.06) * 3, 'slow both should be fastest at the midpoint')
assert.ok(speed('inout', 0.5) > speed('inout', 0.94) * 3, 'slow both should be fastest at the midpoint')

// Hold sits on the first value until the next keyframe takes over.
assert.equal(at('hold', 0.5), 0, 'hold should not move')
assert.equal(at('hold', 0.99), 0, 'hold should not move')

// The default, with no ease set, still rides the spline.
const spline = sampleAt(track(undefined), 0.5, null).device.scale
assert.ok(spline > 0.4 && spline < 0.6, 'spline should pass through the middle')

console.log('ok')
