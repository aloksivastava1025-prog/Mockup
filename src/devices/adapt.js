import { DEFAULT_DEVICE, DEVICES } from './index.js'

/** Fallback tolerance for a device that does not declare its own. */
export const ADAPT_MIN = 0.6
export const ADAPT_MAX = 1.7

/**
 * Whether Adapt can reshape this device to this footage, and by how much.
 *
 * One place, used by both the scene and the panel. They used to work it out
 * separately, which is how the panel came to promise "fills it exactly, no
 * crop or bars" while the scene was quietly letterboxing — the single worst
 * kind of bug, because the interface tells you the opposite of what you can
 * see.
 */
export function adaptFor(deviceId, source, adaptScreen) {
  const device = DEVICES[deviceId] ?? DEFAULT_DEVICE
  const [lo, hi] = device.adaptRange ?? [ADAPT_MIN, ADAPT_MAX]
  const sourceAspect = source?.width && source?.height ? source.width / source.height : null
  if (!sourceAspect) return { applies: false, reason: 'no-source', wanted: 1, lo, hi, scale: 1 }

  const wanted = device.screenAspect / sourceAspect
  // All or nothing: a clamped-but-applied scale deforms the body without ever
  // matching the footage, which is the worst of both.
  const applies = !!adaptScreen && wanted >= lo && wanted <= hi
  return {
    applies,
    reason: !adaptScreen ? 'off' : applies ? 'ok' : wanted < lo ? 'too-wide' : 'too-tall',
    wanted,
    lo,
    hi,
    scale: applies ? wanted : 1,
    effectiveAspect: applies ? sourceAspect : device.screenAspect,
  }
}
