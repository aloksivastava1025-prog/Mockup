import assert from 'node:assert/strict'
import { MOVES, buildMove, orbitOf } from '../src/anim/cameraMoves.js'

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

/**
 * Left and right have to be genuine mirrors of each other, not two moves that
 * happen to both turn. A camera one way and the same camera the other way must
 * sit the same distance out, at the same height, the same angle either side of
 * where it started.
 */
const state = {
  camera: { position: [0, 0.3, 0.9], target: [0, 0.12, 0], fov: 35 },
  device: {},
  screen: {},
  post: {},
}
const start = orbitOf(state.camera.position, state.camera.target)
for (const id of ['orbit', 'arc', 'pushOrbit', 'pullOrbit', 'truck']) {
  const right = buildMove(id, state, { dir: 1 })
  const left = buildMove(id, state, { dir: -1 })
  for (let i = 0; i < right.length; i++) {
    const r = orbitOf(right[i].state.camera.position, right[i].state.camera.target)
    const l = orbitOf(left[i].state.camera.position, left[i].state.camera.target)
    assert.ok(Math.abs(r.d - l.d) < 1e-3, `${id} key ${i}: same distance either way`)
    assert.ok(Math.abs(r.el - l.el) < 1e-3, `${id} key ${i}: same height either way`)
    const swungRight = r.az - start.az
    const swungLeft = l.az - start.az
    assert.ok(
      Math.abs(swungRight + swungLeft) < 1e-2,
      `${id} key ${i}: swings should be equal and opposite, got ${swungRight} and ${swungLeft}`,
    )
  }
}

// Vertical and depth moves are not mirrored — the opposite of a crane up is a
// crane down, which is its own entry in the library.
for (const id of ['craneUp', 'dollyIn']) {
  const a = buildMove(id, state, { dir: 1 })
  const b = buildMove(id, state, { dir: -1 })
  assert.deepEqual(
    a.map((k) => k.state.camera.position),
    b.map((k) => k.state.camera.position),
    `${id} should ignore direction`,
  )
}

console.log(`${Object.keys(MOVES).length} moves, orbit round-trip exact to 1e-6, left/right mirror`)
console.log('ok')
