const DEG = Math.PI / 180

/**
 * A ten-shot product sequence, written as a storyboard rather than generated.
 *
 * The generated films were the right shape and still read as "the camera is
 * moving around": every beat was the same kind of beat. A sequence needs an
 * arc — far, reveal, power, orbit, open, screen, throw, orbit, detail, hero —
 * and it needs both performers. The camera is only half of it; the machine
 * turns, lifts, leans and opens on its own beats, against the camera rather
 * than with it, and that counterpoint is most of what makes a shot feel
 * directed instead of orbited.
 *
 * The lid is the spine of the whole thing. It is shut for the first four
 * shots, so the piece has something to reveal; it opens on shot five, timed to
 * land with the camera's arrival; and the screen is only the hero after that.
 * Opening it at the top would throw away the one beat the object can perform.
 *
 * Written at 40 seconds, which is where the rhythm was tuned, and scaled from
 * there. Times are fractions of the whole so the arc survives any length.
 */

/**
 * Each waypoint is a moment, not a shot: the spline draws the shots between
 * them. `cam` is orbit + distance around the device, `dev` is the machine's
 * own pose. Both are absolute, so any waypoint can be read on its own.
 */
const WAYPOINTS = [
  // ── 01 establishing: far, small, still, a slow push. Lots of nothing. ──
  { t: 0.000, cam: { az: 24, el: 12, d: 2.60, fov: 30, ty: 0.10 }, dev: { ry: -20, rx: 0, rz: 0, fy: 0, lid: 2 }, fade: 1 },
  { t: 0.035, cam: { az: 24, el: 12, d: 2.52, fov: 30, ty: 0.10 }, dev: { ry: -20, rx: 0, rz: 0, fy: 0, lid: 2 } },
  { t: 0.112, cam: { az: 23, el: 12, d: 2.05, fov: 30, ty: 0.10 }, dev: { ry: -20, rx: 0, rz: 0, fy: 0, lid: 2 } },

  // ── 02 first reveal: low three-quarter approach, the machine turns in ──
  { t: 0.200, cam: { az: 34, el: 7, d: 1.35, fov: 30, ty: 0.085 }, dev: { ry: -34, rx: 0, rz: 0, fy: 0, lid: 2 } },
  { t: 0.250, cam: { az: 33, el: 7, d: 1.22, fov: 30, ty: 0.085 }, dev: { ry: -38, rx: 0, rz: 0, fy: 0, lid: 2 } },

  // ── 03 scale: camera drops, the machine rises and leans back. Dominant. ──
  { t: 0.330, cam: { az: 30, el: 2, d: 0.95, fov: 28, ty: 0.105 }, dev: { ry: -36, rx: -7, rz: 0, fy: 0.055, lid: 2 } },

  // ── 04 transition: they orbit against each other, slow then quick ──
  { t: 0.390, cam: { az: 8, el: 6, d: 0.92, fov: 29, ty: 0.115 }, dev: { ry: -18, rx: -5, rz: 0, fy: 0.05, lid: 2 } },
  { t: 0.430, cam: { az: -34, el: 10, d: 0.88, fov: 29, ty: 0.115 }, dev: { ry: 12, rx: -3, rz: 0, fy: 0.04, lid: 2 } },

  // ── 05 the open: camera swings to the side as the lid comes up, landing
  //     together. The lid holds at 2 until here so the spline cannot open it
  //     early — an equal value either side of a segment is treated as a hold.
  { t: 0.470, cam: { az: -62, el: 9, d: 0.80, fov: 29, ty: 0.105 }, dev: { ry: 20, rx: 0, rz: 0, fy: 0.02, lid: 2 } },
  { t: 0.530, cam: { az: -44, el: 13, d: 0.74, fov: 29, ty: 0.115 }, dev: { ry: 8, rx: 0, rz: 0, fy: 0, lid: 62 } },
  { t: 0.570, cam: { az: -26, el: 16, d: 0.70, fov: 29, ty: 0.120 }, dev: { ry: -4, rx: 0, rz: 0, fy: 0, lid: 104 } },

  // ── 06 screen hero: push in, the machine stops, the camera rises ──
  { t: 0.650, cam: { az: -10, el: 19, d: 0.52, fov: 27, ty: 0.125 }, dev: { ry: -10, rx: 0, rz: 0, fy: 0, lid: 104 } },
  { t: 0.690, cam: { az: -4, el: 21, d: 0.46, fov: 26, ty: 0.128 }, dev: { ry: -10, rx: 0, rz: 0, fy: 0, lid: 104 } },

  // ── 07 the throw: a hard pull back while the machine spins away. This is
  //     the fast beat the whole arc builds to, and the only one under a second
  //     per unit of distance — it is meant to smear.
  { t: 0.740, cam: { az: 26, el: 17, d: 1.45, fov: 33, ty: 0.115 }, dev: { ry: -52, rx: 4, rz: -6, fy: 0.06, lid: 104 } },

  // ── 08 the long orbit: wide, unhurried, rising, the machine turning on its
  //     own clock. Negative space does the work here.
  { t: 0.800, cam: { az: 76, el: 20, d: 1.42, fov: 33, ty: 0.120 }, dev: { ry: -70, rx: 0, rz: 0, fy: 0.03, lid: 104 } },
  { t: 0.860, cam: { az: 132, el: 27, d: 1.38, fov: 33, ty: 0.130 }, dev: { ry: -92, rx: 0, rz: 0, fy: 0.01, lid: 104 } },

  // ── 09 detail: tight lens grazing the front edge, one small lean. Kept on
  //     the screen side: a long lens on the back of the lid is a rectangle of
  //     unlit aluminium, which on a dark set is simply a black frame.
  { t: 0.905, cam: { az: 34, el: 6, d: 0.40, fov: 24, ty: 0.095 }, dev: { ry: -40, rx: 0, rz: 3, fy: 0, lid: 104 } },
  { t: 0.935, cam: { az: 10, el: 12, d: 0.40, fov: 24, ty: 0.115 }, dev: { ry: -28, rx: 0, rz: 1, fy: 0, lid: 104 } },

  // ── 10 final hero: back to a clean three-quarter, a last slow push, then
  //     everything stops for a beat before the cut.
  { t: 0.965, cam: { az: -22, el: 18, d: 0.98, fov: 31, ty: 0.118 }, dev: { ry: -18, rx: 0, rz: 0, fy: 0, lid: 104 } },
  { t: 0.988, cam: { az: -20, el: 18, d: 0.92, fov: 31, ty: 0.118 }, dev: { ry: -18, rx: 0, rz: 0, fy: 0, lid: 104 } },
  { t: 1.000, cam: { az: -20, el: 18, d: 0.92, fov: 31, ty: 0.118 }, dev: { ry: -18, rx: 0, rz: 0, fy: 0, lid: 104 }, fade: 1 },
]

const orbit = ({ az, el, d, fov, ty }) => ({
  position: [
    +(d * Math.cos(el * DEG) * Math.sin(az * DEG)).toFixed(4),
    +(ty + d * Math.sin(el * DEG)).toFixed(4),
    +(d * Math.cos(el * DEG) * Math.cos(az * DEG)).toFixed(4),
  ],
  target: [0, ty, 0],
  fov,
})

export const SEQUENCE_RENDER = { blurSamples: 8, depth: 0.28 }

export function buildSequence({ seconds = 40, screen } = {}) {
  return WAYPOINTS.map((w) => ({
    id: `kf_${w.t}_${Math.random().toString(36).slice(2, 7)}`,
    time: +(w.t * seconds).toFixed(3),
    state: {
      device: {
        position: [0, w.dev.fy ?? 0, 0],
        rotation: [w.dev.rx ?? 0, w.dev.ry ?? 0, w.dev.rz ?? 0],
        lidAngle: w.dev.lid,
        scale: 1,
      },
      camera: orbit(w.cam),
      screen: { ...screen },
      post: { fade: w.fade ?? 0, fadeColor: '#000000' },
    },
  }))
}
