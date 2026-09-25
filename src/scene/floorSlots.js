/**
 * The default sponsor grid on the floor.
 *
 * Fixed positions rather than free placement, because a buyer is buying a
 * position and a position only means something if it is the same one every
 * time. The user can move any of them afterwards — this is the starting grid,
 * not a cage.
 *
 * Angle 0 is deliberately unused: that is the lane the camera stands in, so a
 * mark there lands under the lens or behind it. Everything sits on the flanks
 * and behind, where floor is actually in frame. The outer ring is bigger for
 * the same reason a distant road sign is — to read the same size once it is
 * far away.
 */
const LAYOUT = [
  { a: -80, r: 0.6, s: 0.22 },
  { a: 80, r: 0.6, s: 0.22 },
  { a: -140, r: 0.62, s: 0.22 },
  { a: 140, r: 0.62, s: 0.22 },
  { a: -55, r: 1.05, s: 0.34 },
  { a: 55, r: 1.05, s: 0.34 },
  { a: -110, r: 1.1, s: 0.34 },
  { a: 110, r: 1.1, s: 0.34 },
  { a: 180, r: 1.0, s: 0.34 },
]

/**
 * Stored as plain x/z rather than angle and radius. Polar is the right way to
 * *lay out* a ring and the wrong way to *nudge* one mark: "a bit to the left"
 * is one number in cartesian and two in polar.
 */
export function defaultFloorSlots() {
  return LAYOUT.map(({ a, r, s }, i) => {
    const rad = (a * Math.PI) / 180
    return {
      id: `slot${i + 1}`,
      x: +(Math.sin(rad) * r).toFixed(4),
      z: +(Math.cos(rad) * r).toFixed(4),
      size: s,
      rot: 0,
      image: null,
      label: '',
      url: '',
    }
  })
}

/** A new slot lands in front of the device, where the user is looking. */
export function blankSlot(id) {
  return { id, x: 0.45, z: 0.45, size: 0.3, rot: 0, image: null, label: '', url: '' }
}
