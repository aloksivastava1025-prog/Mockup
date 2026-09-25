/**
 * Procedural camera shake.
 *
 * A layer on top of whatever the timeline says, not keyframes. Handheld motion
 * is dense and irregular — faking it with keyframes means dozens of them, and
 * they then fight every retime and every ease you set on the real move.
 *
 * Built from summed sine waves at unrelated frequencies rather than random
 * numbers. Random is wrong twice over: it jitters rather than drifts, because
 * each frame is independent of the last, and it is different on every render,
 * so a re-export of the same shot does not match the one before it. Sines are
 * smooth, and they give the same answer for the same time, forever.
 */

/** Two waves an irrational ratio apart never line up, so the loop never shows. */
const wave = (t, seed) =>
  Math.sin(t * 2.17 + seed) * 0.6 +
  Math.sin(t * 3.73 + seed * 2.3) * 0.3 +
  Math.sin(t * 7.31 + seed * 5.1) * 0.1

/**
 * Offsets for the camera at `time`, in world units and degrees.
 *
 * `amount` scales the lot; `speed` is how hurried the operator is. Position
 * moves less than aim does, which is how a real hand behaves — the body is
 * fairly still and the wrist is not.
 */
export function shakeAt(time, { amount = 0, speed = 1 } = {}) {
  if (!amount) return null
  const t = time * speed
  const a = amount
  return {
    // Across, up, and a little in and out.
    pos: [wave(t, 0) * 0.012 * a, wave(t, 11.3) * 0.009 * a, wave(t, 23.7) * 0.005 * a],
    // Aim wanders further than the body does.
    aim: [wave(t, 41.2) * 0.020 * a, wave(t, 57.9) * 0.016 * a, 0],
    // A slow breath on the lens, far below the frequency of the rest.
    fov: Math.sin(t * 0.83 + 3.1) * 0.35 * a,
  }
}
