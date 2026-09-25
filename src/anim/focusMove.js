import { poseForRect, poseForWhole } from '../scene/focus.js'
import { useStudio } from '../store/useStudio.js'

/**
 * Turns a list of focus areas into a camera move.
 *
 * Open wide on the whole screen, travel to each area in turn and hold there,
 * then pull back out. The device itself never moves — only the camera — which
 * is what makes this read as someone showing you round a page rather than as
 * the page being waved about.
 *
 * Each hold is two keyframes at the same pose rather than one. A single
 * keyframe would be a point the spline passes through at speed; two identical
 * ones are a hold, and the interpolator treats equal neighbouring values as
 * deliberately flat.
 */
export function buildFocusMove({ areas, hold, travel, open }, aspect = 16 / 9) {
  if (!areas?.length) return null
  const wide = poseForWhole({ aspect })
  if (!wide) return null

  const poses = areas.map((a) => poseForRect(a, { aspect }))
  if (poses.some((p) => !p)) return null

  const live = useStudio.getState()
  const key = (time, camera) => ({
    id: `kf_${time.toFixed(2)}_${Math.random().toString(36).slice(2, 7)}`,
    time: +time.toFixed(3),
    state: {
      device: { ...live.device },
      camera,
      screen: { ...live.screen },
      post: { fade: 0, fadeColor: '#000000' },
    },
  })

  const keys = []
  let t = 0
  keys.push(key(t, wide))
  t += open
  keys.push(key(t, wide)) // let the establishing shot breathe before moving

  for (const p of poses) {
    t += travel
    keys.push(key(t, p))
    t += hold
    keys.push(key(t, p))
  }

  t += travel
  keys.push(key(t, wide))
  return { keyframes: keys, duration: Math.max(2, Math.ceil(t * 2) / 2) }
}
