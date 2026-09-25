import { poseForRect, poseForWhole } from '../scene/focus.js'
import { useStudio } from '../store/useStudio.js'

const DEG = Math.PI / 180

/**
 * Builds a whole film, not a camera move.
 *
 * The difference matters. A move goes from A to B; a film has a shape — it
 * establishes, it looks at things, it changes pace, and it lands. Everything
 * here is in service of that: the shot sizes alternate, the device turns
 * against the camera so the parallax reads, and there is always one fast beat
 * among the slow ones, because a piece at one speed reads as a screensaver
 * however pretty each frame is.
 *
 * Every pose is authored as orbit + distance around the device rather than as
 * raw XYZ, which is the only way to reason about "low three-quarter" or
 * "profile" without solving triangles by hand. Content close-ups come from the
 * focus solver, so they frame real regions of the page rather than a guess.
 */

/** Camera placed on a sphere around the device: the only sane way to say "low, off to the left". */
const orbit = (az, el, d, fov, ty) => ({
  position: [
    +(d * Math.cos(el * DEG) * Math.sin(az * DEG)).toFixed(4),
    +(ty + d * Math.sin(el * DEG)).toFixed(4),
    +(d * Math.cos(el * DEG) * Math.cos(az * DEG)).toFixed(4),
  ],
  target: [0, ty, 0],
  fov,
})

const STYLES = {
  cinematic: {
    label: 'Cinematic',
    // Slow, wide, one hard whip. Heavy shutter because everything is moving.
    open: 3.0, travel: 2.0, hold: 2.2, whip: 0.55, close: 3.0,
    render: { blurSamples: 8, depth: 0.32 },
    lookMargin: 1.55,
    wide: { az: 38, el: 11, d: 1.05, fov: 32 },
    drift: { az: 27, el: 15, d: 0.92, fov: 31 },
    relief: [
      { az: -78, el: 7, d: 0.72, fov: 30 },   // hard profile
      { az: 16, el: 42, d: 0.86, fov: 33 },   // looking down on the deck
    ],
    hero: { az: -26, el: 20, d: 1.08, fov: 32 },
    float: 0.06,
    yaw: 14,
  },
  tour: {
    label: 'Product tour',
    // The content is the point; the camera stays out of its way.
    open: 2.2, travel: 1.5, hold: 2.6, whip: 0.9, close: 2.2,
    render: { blurSamples: 4, depth: 0.18 },
    lookMargin: 1.18,
    wide: { az: 24, el: 14, d: 0.95, fov: 32 },
    drift: { az: 14, el: 15, d: 0.84, fov: 31 },
    relief: [
      { az: -22, el: 16, d: 0.70, fov: 30 },
      { az: 22, el: 22, d: 0.74, fov: 31 },
    ],
    hero: { az: -14, el: 17, d: 0.98, fov: 31 },
    float: 0.0,
    yaw: 8,
  },
  snappy: {
    label: 'Snappy',
    // Short holds and long throws between them, which is what makes a social
    // cut feel quick. Blur is not optional at this speed.
    open: 1.4, travel: 0.7, hold: 1.1, whip: 0.32, close: 1.6,
    render: { blurSamples: 8, depth: 0.12 },
    lookMargin: 1.3,
    wide: { az: 52, el: 8, d: 1.00, fov: 34 },
    drift: { az: 20, el: 18, d: 0.80, fov: 32 },
    relief: [
      { az: -95, el: 12, d: 0.66, fov: 31 },
      { az: 70, el: 34, d: 0.70, fov: 33 },
    ],
    hero: { az: -8, el: 16, d: 0.92, fov: 31 },
    float: 0.1,
    yaw: 26,
  },
}

export const FILM_STYLES = Object.entries(STYLES).map(([id, s]) => ({ id, label: s.label }))

/**
 * Lays out the beats, then scales them to the length asked for.
 *
 * Written at natural durations first and rescaled afterwards rather than
 * dividing the target up front: the ratio between a hold and a whip is what
 * gives a style its feel, and it has to survive being asked for ten seconds
 * or forty.
 */
function beatPlan(style, areaCount) {
  const S = STYLES[style] ?? STYLES.cinematic
  const beats = [{ kind: 'open', dur: S.open }]
  const n = Math.max(1, areaCount)
  for (let i = 0; i < n; i++) {
    beats.push({ kind: 'travel', dur: S.travel, area: i })
    beats.push({ kind: 'hold', dur: S.hold, area: i })
    // A fast throw to a contrasting angle between looks. Skipped after the
    // last one, where the close already provides the change.
    if (i < n - 1) beats.push({ kind: 'relief', dur: S.whip, relief: i % S.relief.length })
  }
  beats.push({ kind: 'close', dur: S.close })
  return { S, beats }
}

export function buildFilm({ areas = [], style = 'cinematic', seconds = 20, aspect = 16 / 9 } = {}) {
  const { S, beats } = beatPlan(style, areas.length)

  const wide = poseForWhole({ aspect })
  if (!wide) return null
  // With no areas marked the film still works: it looks at the whole display
  // instead, which is a perfectly good product shot, just a less specific one.
  // Margin, not a tight crop. A close-up that fills the frame edge to edge
  // with white page stops being a shot of a laptop and becomes a screenshot;
  // leaving room for some bezel is what keeps the product in the product shot.
  // A tour wants to read the text, so it sits closer than a cinematic piece.
  const lookOpts = { aspect, margin: S.lookMargin ?? 1.2 }
  const looks = areas.length
    ? areas.map((a) => poseForRect(a, lookOpts))
    : [poseForRect({ x: 0.08, y: 0.06, w: 0.84, h: 0.5 }, lookOpts)]
  if (looks.some((p) => !p)) return null

  const natural = beats.reduce((a, b) => a + b.dur, 0)
  const k = seconds / natural

  const live = useStudio.getState()
  const baseYaw = live.device.rotation[1]
  const key = (t, camera, device, fade = 0) => ({
    id: `kf_${t.toFixed(2)}_${Math.random().toString(36).slice(2, 7)}`,
    time: +t.toFixed(3),
    state: {
      device: { ...live.device, ...device },
      camera,
      screen: { ...live.screen },
      post: { fade, fadeColor: '#000000' },
    },
  })

  // The device turns against the camera and lifts a little through the middle
  // of the piece. On its own the camera orbiting a static object reads as a
  // turntable; counter-motion is what makes it read as a scene.
  const dev = (u, extra = {}) => ({
    rotation: [0, baseYaw + Math.sin(u * Math.PI) * -S.yaw, Math.sin(u * Math.PI) * -S.yaw * 0.25],
    position: [0, +(Math.sin(u * Math.PI) * S.float).toFixed(4), 0],
    ...extra,
  })

  const ty = 0.11
  const keys = []
  let t = 0
  const at = () => t / (natural * k)

  keys.push(key(0, orbit(S.wide.az, S.wide.el, S.wide.d, S.wide.fov, ty), dev(0), 1))

  for (const b of beats) {
    const d = b.dur * k
    if (b.kind === 'open') {
      // Up from black, then a slow drift so the first thing you see is motion.
      keys.push(key(t + d * 0.35, orbit(S.wide.az, S.wide.el, S.wide.d * 0.98, S.wide.fov, ty), dev(at())))
      t += d
      keys.push(key(t, orbit(S.drift.az, S.drift.el, S.drift.d, S.drift.fov, ty), dev(at())))
    } else if (b.kind === 'travel') {
      t += d
      keys.push(key(t, looks[b.area], dev(at())))
    } else if (b.kind === 'hold') {
      t += d
      // Two keyframes at one pose: a single one is a point the spline sails
      // through, a pair is a hold.
      keys.push(key(t, looks[b.area], dev(at())))
    } else if (b.kind === 'relief') {
      // The throw is short on purpose, and a single keyframe at the far angle
      // gets rounded off by the spline before it ever arrives — the camera
      // leans toward the profile and turns back. Two frames a beat apart make
      // it actually reach, and that arrival is the punch in the whole piece.
      const r = S.relief[b.relief]
      t += d
      keys.push(key(t, orbit(r.az, r.el, r.d, r.fov, ty), dev(at())))
      t += d * 0.5
      keys.push(key(t, orbit(r.az, r.el, r.d, r.fov, ty), dev(at())))
    } else if (b.kind === 'close') {
      // Pull out to the hero, easing the lens wider as it goes, then hold dead
      // still for the last beat before the fade.
      keys.push(key(t + d * 0.55, orbit(S.hero.az, S.hero.el, S.hero.d * 0.94, S.hero.fov - 1, ty), dev(at())))
      t += d * 0.8
      keys.push(key(t, orbit(S.hero.az, S.hero.el, S.hero.d, S.hero.fov, ty), dev(1)))
      t = seconds
      keys.push(key(t, orbit(S.hero.az, S.hero.el, S.hero.d, S.hero.fov, ty), dev(1), 1))
    }
  }

  keys.sort((a, b) => a.time - b.time)
  return { keyframes: keys, duration: seconds, render: { ...S.render } }
}
