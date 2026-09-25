const DEG = Math.PI / 180

/**
 * A library of camera moves, written relative to wherever the camera already is.
 *
 * The point is that you frame the shot by hand and then ask for a move, rather
 * than typing coordinates. So nothing here is absolute: every waypoint is a
 * delta on the current position — swing this far round, come this much closer,
 * tighten the lens by this much. Frame a low three-quarter and ask for an
 * orbit, and you get a low three-quarter orbit.
 *
 * Moves come in two families, and the difference is what a real crew would
 * mean by the words. Orbital moves (`az`, `el`, `d`) swing the camera around
 * the thing it is aimed at, so the subject stays put in frame. Translations
 * (`pan`, `lift`, `slide`) move the camera through the room: `pan` and `lift`
 * carry the aim along with them, so the framing slides; `slide` moves the
 * camera and leaves the aim alone, which is what makes parallax.
 */

/** Current camera expressed as orbit around its own aim point. */
export function orbitOf(position, target) {
  const dx = position[0] - target[0]
  const dy = position[1] - target[1]
  const dz = position[2] - target[2]
  const d = Math.hypot(dx, dy, dz) || 0.001
  return {
    az: Math.atan2(dx, dz) / DEG,
    el: Math.asin(Math.max(-1, Math.min(1, dy / d))) / DEG,
    d,
  }
}

/**
 * Waypoints are `u` (0..1 through the move) plus deltas. Anything omitted
 * holds. `d` is a multiplier on the starting distance, so a move reads the
 * same whether you are 30cm from a phone or 3m from a display.
 */
export const MOVES = {
  dollyIn: { label: 'Dolly in', group: 'push', keys: [{ u: 0 }, { u: 1, d: 0.6 }] },
  dollyOut: { label: 'Dolly out', group: 'push', keys: [{ u: 0 }, { u: 1, d: 1.7 }] },
  slowZoom: { label: 'Slow zoom', group: 'push', keys: [{ u: 0 }, { u: 1, fov: -9 }] },
  fovPunch: {
    label: 'FOV punch',
    group: 'push',
    // Out and back inside a second: the lens flinches and recovers.
    keys: [{ u: 0 }, { u: 0.18, fov: 11 }, { u: 0.5, fov: -2 }, { u: 1 }],
  },

  /**
   * The vertigo shot. The camera retreats while the lens tightens by exactly
   * enough to hold the subject the same size, so the subject sits still and
   * the room stretches out behind it.
   *
   * Flagged rather than written as fov deltas because the right amount of
   * tightening depends on the focal length you started at — a 20mm and a 70mm
   * need completely different numbers to cancel the same retreat, and a fixed
   * delta would be wrong for every framing but one.
   */
  dollyZoom: {
    label: 'Dolly zoom',
    group: 'push',
    vertigo: true,
    keys: [{ u: 0 }, { u: 1, d: 1.75 }],
  },

  orbit: { label: 'Orbit', group: 'around', keys: [{ u: 0 }, { u: 1, az: 75 }] },
  arc: {
    label: 'Arc',
    group: 'around',
    // Rises as it comes round, which is what separates an arc from a flat orbit.
    keys: [{ u: 0 }, { u: 0.5, az: 30, el: 9 }, { u: 1, az: 62, el: 5 }],
  },
  pushOrbit: { label: 'Push + orbit', group: 'around', keys: [{ u: 0 }, { u: 1, az: 45, d: 0.65 }] },
  pullOrbit: { label: 'Pull + orbit', group: 'around', keys: [{ u: 0 }, { u: 1, az: 50, d: 1.6 }] },
  whipPan: {
    label: 'Whip pan',
    group: 'around',
    // Two frames at the far angle so the spline reaches it instead of leaning
    // toward it and turning back; the arrival is the whole point of a whip.
    keys: [{ u: 0 }, { u: 0.55, az: 95 }, { u: 0.7, az: 95 }, { u: 1, az: 80 }],
  },

  craneUp: { label: 'Crane up', group: 'lift', keys: [{ u: 0 }, { u: 1, el: 24 }] },
  craneDown: { label: 'Crane down', group: 'lift', keys: [{ u: 0 }, { u: 1, el: -16 }] },
  pedestalUp: { label: 'Pedestal up', group: 'lift', keys: [{ u: 0 }, { u: 1, lift: 0.14 }] },
  pedestalDown: { label: 'Pedestal down', group: 'lift', keys: [{ u: 0 }, { u: 1, lift: -0.1 }] },

  // One truck, not a left and a right: the direction control already decides
  // the side, and a move called "Truck left" set to go right is a lie.
  truck: { label: 'Truck', group: 'across', keys: [{ u: 0 }, { u: 1, pan: 0.22 }] },
  parallax: {
    label: 'Parallax',
    group: 'across',
    // Camera slides, aim stays nailed to the subject. That mismatch is the
    // effect: the subject holds still while the room slides behind it.
    keys: [{ u: 0, slide: -0.16 }, { u: 1, slide: 0.16 }],
  },
}

export const MOVE_GROUPS = [
  { id: 'push', label: 'Push & zoom' },
  { id: 'around', label: 'Around the subject' },
  { id: 'lift', label: 'Up & down' },
  { id: 'across', label: 'Across' },
]

const lerp = (a, b, t) => a + (b - a) * t

/**
 * Turns a move into keyframes starting at `startTime`.
 *
 * `amount` scales every delta, so the same move can be a nudge or a swing.
 * The existing pose is captured for everything the camera does not own, so
 * dropping a move in never disturbs the device, the screen or a fade.
 *
 * `state` is passed in rather than read from the store. This module is pure
 * geometry and is covered by a Node test; reaching for the store would drag
 * the device registry and its .jsx behind it, which the test runner cannot
 * load — a mistake already made once in this codebase.
 */
export function buildMove(
  id,
  state,
  { seconds = 4, amount = 1, startTime = 0, dir = 1, zoom = 1, dist = 1 } = {},
) {
  const move = MOVES[id]
  if (!move) return null

  /**
   * `dir` mirrors the move left/right.
   *
   * Only the sideways deltas flip. Mirroring a crane or a dolly would turn an
   * up into a down and an in into an out, which is a different move with its
   * own name, not the same one the other way round.
   *
   * Positive is the camera's own right: position is target + d·[sin(az), …,
   * cos(az)], so a bigger az walks the camera toward +x, and for a camera
   * looking down -z its right vector is +x.
   */
  const side = dir < 0 ? -1 : 1

  const s = state
  const base = orbitOf(s.camera.position, s.camera.target)
  const fov0 = s.camera.fov
  const tgt = s.camera.target

  // Sideways, level with the horizon — the direction a truck actually moves.
  const right = [Math.cos(base.az * DEG), 0, -Math.sin(base.az * DEG)]

  return move.keys.map((k) => {
    const az = (base.az + (k.az ?? 0) * amount * side) * DEG
    const el = (base.el + (k.el ?? 0) * amount) * DEG
    // `zoom` and `dist` are second multipliers on top of `amount`, so the two
    // halves of a dolly zoom can be dialled against each other. That is the
    // whole move: the lens tightening exactly as fast as the camera retreats.
    // One slider for both can only make it bigger, never balance it.
    const d = base.d * (1 + ((k.d ?? 1) - 1) * amount * dist)
    const pan = (k.pan ?? 0) * amount * side
    const lift = (k.lift ?? 0) * amount
    const slide = (k.slide ?? 0) * amount * side

    const target = [tgt[0] + right[0] * pan, tgt[1] + lift, tgt[2] + right[2] * pan]
    const position = [
      target[0] + d * Math.cos(el) * Math.sin(az) + right[0] * slide,
      target[1] + d * Math.sin(el),
      target[2] + d * Math.cos(el) * Math.cos(az) + right[2] * slide,
    ]

    /**
     * A subject fills the frame when d·tan(fov/2) is constant, so holding it
     * still through a dolly means tan(fov/2) scaling with 1/d.
     *
     * `zoom` is how much of that compensation to apply: 1 locks the subject
     * exactly, 0 leaves a plain dolly with no lens move at all, and past 1 it
     * overshoots and the subject swells or shrinks as the room warps. The
     * effect lives in that balance, so it is worth being able to miss it on
     * purpose.
     */
    let fov = fov0 + (k.fov ?? 0) * amount * zoom
    if (move.vertigo) {
      const half = Math.tan((fov0 / 2) * DEG)
      const locked = (2 * Math.atan(half * (base.d / d))) / DEG
      fov = Math.max(8, Math.min(100, lerp(fov0, locked, zoom)))
    }

    return {
      id: `kf_move_${id}_${k.u}_${Math.random().toString(36).slice(2, 7)}`,
      time: +(startTime + k.u * seconds).toFixed(3),
      state: {
        device: { ...s.device },
        camera: {
          position: position.map((v) => +v.toFixed(4)),
          target: target.map((v) => +v.toFixed(4)),
          fov: +fov.toFixed(2),
        },
        screen: { ...s.screen },
        post: { ...s.post },
      },
    }
  })
}
