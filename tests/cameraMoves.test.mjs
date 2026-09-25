import assert from 'node:assert/strict'
import { MOVES, orbitOf } from '../src/anim/cameraMoves.js'

const DEG = Math.PI / 180

// The generator reads the live store, which needs a browser. The geometry it
// relies on does not, so that is what is checked here: the round trip from a
// camera to orbit angles and back, which every move is built on top of.
const place = ({ az, el, d, target = [0, 0.12, 0] }) => [
  target[0] + d * Math.cos(el * DEG) * Math.sin(az * DEG),
  target[1] + d * Math.sin(el * DEG),
  target[2] + d * Math.cos(el * DEG) * Math.cos(az * DEG),
]

for (const spec of [
  { az: 0, el: 0, d: 1 },
  { az: 35, el: 18, d: 0.8 },
  { az: -120, el: -12, d: 2.4 },
  { az: 179, el: 60, d: 0.35 },
]) {
  const target = [0, 0.12, 0]
  const pos = place({ ...spec, target })
  const back = orbitOf(pos, target)
  assert.ok(Math.abs(back.d - spec.d) < 1e-6, `distance should survive: ${back.d} vs ${spec.d}`)
  assert.ok(Math.abs(back.el - spec.el) < 1e-6, `elevation should survive: ${back.el} vs ${spec.el}`)
  // Shortest signed angle, so 359 and -1 count as the same heading.
  const azDiff = Math.abs(((back.az - spec.az + 540) % 360) - 180)
  assert.ok(azDiff < 1e-6, `azimuth should survive: ${back.az} vs ${spec.az}`)
}

// Aimed straight down: the azimuth is undefined but nothing may blow up.
const down = orbitOf([0, 1, 0], [0, 0, 0])
assert.ok(Number.isFinite(down.az) && Number.isFinite(down.el), 'a top-down camera must still resolve')
assert.ok(Math.abs(down.el - 90) < 1e-6, 'straight down should read as 90 degrees')

// Every move has to start where the camera already is, or it would jump.
for (const [id, m] of Object.entries(MOVES)) {
  const first = m.keys[0]
  const moved = (first.az ?? 0) || (first.el ?? 0) || (first.pan ?? 0) || (first.lift ?? 0) || ((first.d ?? 1) - 1) || (first.fov ?? 0)
  // Parallax is the one exception: it starts offset so it can cross the middle.
  if (id !== 'parallax') assert.ok(!moved, `${id} should open on the current framing`)
  assert.equal(first.u, 0, `${id} should start at u=0`)
  assert.equal(m.keys[m.keys.length - 1].u, 1, `${id} should finish at u=1`)
}

// A whip needs two frames at its far angle or the spline rounds it off.
const whip = MOVES.whipPan.keys.filter((k) => k.az === 95)
assert.equal(whip.length, 2, 'the whip should hold its far angle for a beat')

console.log(`${Object.keys(MOVES).length} moves, orbit round-trip exact to 1e-6`)
console.log('ok')
