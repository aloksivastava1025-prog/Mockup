/**
 * Shots: a whole composed look, saved so it can be re-used in one click.
 *
 * A Location answers "where is this thing sitting" — surface, backdrop,
 * light. A Shot answers "how is it being photographed", which is a different
 * and larger set: where the camera is, what lens it is on, how far the lid is
 * open, what the chassis is made of, and which grade is running. Getting one
 * of these right takes an hour of measuring and nudging; getting it back
 * should take a click.
 *
 * A shot may set any of `deviceId`, `camera`, `device`, `material`,
 * `lighting`, `background`, `screen`, `effects` and `adaptScreen`. Anything
 * it leaves out is left alone, so a shot can be a full look or only a
 * camera. Some looks only exist on one body — a billboard shot is not a
 * laptop shot with different numbers — so a shot is allowed to switch the
 * device as well.
 *
 * What a shot deliberately cannot carry is the backdrop photograph itself.
 * That is a file on someone's disk, the same reason a saved project does not
 * embed it. So a shot that expects a photo ships a gradient that stands in
 * for it, plus the `imageX/imageY/imageZoom` placement already dialled in —
 * attach a picture and it lands in the right place instead of needing the
 * whole alignment done again.
 */

export const SHOTS = {
  heroDeadOn: {
    label: 'Hero — dead on',
    hint: 'Close, low and wide, straight down the centre line. Attach a backdrop photo for the full look.',
    /*
     * Solved rather than eyeballed: fitted by least squares to four
     * measurements off a reference photograph — the lid's top edge, the
     * hinge, the base's front edge and the lid's width at the hinge. The
     * camera really is this close; 22cm on a 71.5-degree lens is what
     * stretches the trackpad toward the viewer and lets the base take more
     * of the frame than the screen does.
     */
    camera: { position: [0, 0.0912, 0.2221], target: [0, 0.0688, 0], fov: 71.5 },
    device: {
      position: [0, 0, 0],
      rotation: [0, 0, 0], // dead-on; the whole point is the symmetry
      lidAngle: 123.8,
      scale: 1,
    },
    /*
     * Off, and this matters more than it looks. Adapt reshapes the chassis
     * along its depth to match the footage's aspect, and at 16:9 it squashes
     * a MacBook to about 0.6 of its real depth. The camera above was solved
     * against true proportions, so with Adapt on the shot simply will not
     * reproduce.
     */
    adaptScreen: false,
    material: {
      bodyColor: '#303032',
      bodyRoughness: 0.46,
      bodyMetalness: 0.34,
      bezelColor: '#0a0a0c',
      /*
       * Low on purpose. This value drives a flat white plane across the
       * whole display, not a highlight in one corner, so anything much above
       * 0.05 reads as fog over the footage rather than glass in front of it.
       */
      screenReflectivity: 0.03,
      keyBacklight: 0.04,
    },
    lighting: {
      keyIntensity: 1.45,
      keyAzimuth: 0,
      keyElevation: 46,
      fillIntensity: 0.34,
      rimIntensity: 1.45,
      ambient: 0.18,
      hemi: 0.26,
      exposure: 1.0,
      envPreset: 'studio',
      envIntensity: 0.4,
      shadows: true,
      shadowOpacity: 0.55,
      shadowBlur: 2.8,
    },
    background: {
      // Stands in for the photograph. Switch to Image and attach one and the
      // placement below is already correct.
      mode: 'gradient',
      colorTop: '#67676a',
      colorBottom: '#3a3a3c',
      groundVisible: false,
      imageX: 0,
      imageY: 0.11,
      imageZoom: 1.3,
    },
    screen: { brightness: 1.0, glow: 0.28 },
    effects: [
      { id: 'shot_hero_v', type: 'vignette', amount: 0.34, on: true },
      { id: 'shot_hero_c', type: 'contrast', amount: 0.14, on: true },
      { id: 'shot_hero_b', type: 'bloom', amount: 0.07, on: true },
      { id: 'shot_hero_g', type: 'grain', amount: 0.07, on: true },
    ],
  },

  billboardWall: {
    label: 'Billboard — on a wall',
    hint: 'A hoarding seen square-on, sized and placed for a street photograph. Attach your wall shot as the backdrop.',
    deviceId: 'billboard',
    /*
     * Solved, not nudged. The board is 3.4m across; to land it at 46% of a
     * 16:9 frame, centred at (0.60, 0.33) — right of the frame and above
     * where a pavement usually sits — the camera has to be eight metres back
     * on a 28-degree lens.
     *
     * It looks straight down -Z and the board is unrotated, so the edges stay
     * parallel. To put the board off-centre the camera slides sideways *with*
     * its aim point rather than the board turning: a hoarding photographed
     * square-on has no keystone, and neither should this.
     */
    camera: { position: [-0.7077, 0.2389, 7.9832], target: [-0.7077, 0.2389, 0], fov: 28 },
    device: { position: [0, 0, 0], rotation: [0, 0, 0], lidAngle: 0, scale: 1 },
    adaptScreen: true,
    material: {
      bodyColor: '#1a1a1c',
      bodyRoughness: 0.55,
      bodyMetalness: 0.2,
      bezelColor: '#0a0a0c',
      screenReflectivity: 0.02,
      keyBacklight: 0,
    },
    lighting: {
      keyIntensity: 0.85,
      keyAzimuth: -20,
      keyElevation: 38,
      fillIntensity: 0.5,
      rimIntensity: 0.25,
      ambient: 0.4,
      hemi: 0.45,
      exposure: 1.0,
      envPreset: 'soft',
      envIntensity: 0.5,
      // Off: the contact shadow lands on the ground plane, which would draw
      // a shadow under something that is bolted to a wall.
      shadows: false,
      shadowOpacity: 0.4,
      shadowBlur: 2.5,
    },
    background: {
      mode: 'gradient',
      colorTop: '#9a9a9c',
      colorBottom: '#6e6e70',
      groundVisible: false,
      imageX: 0,
      imageY: 0,
      imageZoom: 1,
    },
    screen: { brightness: 1.0, glow: 0 },
    effects: [
      // The plate is already graded. The job is to match it, not to add a
      // second look on top of it.
      { id: 'shot_bb_g', type: 'grain', amount: 0.05, on: true },
      { id: 'shot_bb_c', type: 'contrast', amount: 0.04, on: true },
    ],
  },
}

/**
 * Apply a shot. Only the groups it mentions are touched, and the whole thing
 * lands in one commit so it is a single undo.
 */
export function applyShot(id, store) {
  const shot = SHOTS[id]
  if (!shot) return
  const s = store.getState()
  store.getState().commit()

  const next = { previewLive: true }
  if (shot.camera) next.camera = { ...s.camera, ...shot.camera }
  if (shot.device) next.device = { ...s.device, ...shot.device }
  if (shot.material) next.material = { ...s.material, ...shot.material }
  if (shot.lighting) next.lighting = { ...s.lighting, ...shot.lighting }
  if (shot.background) next.background = { ...s.background, ...shot.background }
  if (shot.screen) next.screen = { ...s.screen, ...shot.screen }
  if (shot.effects) next.effects = shot.effects.map((e) => ({ ...e }))
  if (shot.adaptScreen !== undefined) next.adaptScreen = shot.adaptScreen
  if (shot.deviceId) next.deviceId = shot.deviceId

  store.setState(next)
}
