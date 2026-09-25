import { LOCATIONS } from '../scene/locations.js'
import { useStudio } from '../store/useStudio.js'

const snap = (over = {}) => {
  const s = useStudio.getState()
  const base = { device: s.device, camera: s.camera, screen: s.screen }
  return {
    device: { ...base.device, ...(over.device ?? {}) },
    camera: { ...base.camera, ...(over.camera ?? {}) },
    screen: { ...base.screen, ...(over.screen ?? {}) },
  }
}

const kf = (time, state) => ({
  id: `kf_${time}_${Math.random().toString(36).slice(2, 7)}`,
  time,
  state,
})

const DEG = Math.PI / 180

/**
 * A shot is framed by orbiting the camera around a target: azimuth/elevation in
 * degrees and distance in metres. Far easier to reason about than raw XYZ.
 *
 * `fy` floats the device off the surface and `rz` rolls it (the Tilt control);
 * both default to nothing, so every shot written before they existed is
 * unchanged. Note that `ty` — the height the camera looks at — is authored
 * separately rather than derived from `fy`: a rising device usually wants the
 * camera to lag or lead it slightly, and tying the two together removes exactly
 * the control that makes the lift read.
 *
 * `lin` plays the segment that *starts* at this shot straight instead of on a
 * spline. Authored motion normally wants the spline, but an impact does not:
 * a Catmull-Rom arriving at the ground carries its velocity through the
 * keyframe and dips the device below the surface before coming back, and the
 * one thing a landing must do is stop dead.
 */
const shot = (time, o, fade = 0) => {
  const el = o.el * DEG
  const az = o.az * DEG
  const key = kf(time, {
    device: {
      position: [0, o.fy ?? 0, 0],
      rotation: [o.rx ?? 0, o.ry, o.rz ?? 0],
      lidAngle: o.lid,
      scale: o.sc ?? 1,
    },
    camera: {
      position: [
        +(o.d * Math.cos(el) * Math.sin(az)).toFixed(4),
        +(o.ty + o.d * Math.sin(el)).toFixed(4),
        +(o.d * Math.cos(el) * Math.cos(az)).toFixed(4),
      ],
      target: [0, o.ty, 0],
      fov: o.fov,
    },
    screen: {
      scale: o.zoom ?? 1,
      offsetX: o.ox ?? 0,
      offsetY: o.oy ?? 0,
      fit: o.fit ?? 'contain',
      letterbox: '#000000',
      brightness: o.b ?? 1.05,
      glow: o.g ?? 0.38,
    },
    post: { fade, fadeColor: '#000000' },
  })
  if (o.lin) key.ease = 'linear'
  return key
}

const SHOT_DEFAULTS = {
  ry: 0, rx: 0, rz: 0, fy: 0, sc: 1,
  lid: 102, az: 0, el: 16, d: 0.8, fov: 30, ty: 0.115,
  zoom: 1, ox: 0, oy: 0, b: 1.05, g: 0.38, fit: 'contain',
}
const norm = (o) => ({ ...SHOT_DEFAULTS, ...o })

const ease = (u) => u * u * (3 - 2 * u)

const lerpShot = (a, b, u) => {
  const t = ease(u)
  const out = {}
  for (const k of Object.keys(a)) {
    out[k] = typeof a[k] === 'number' ? a[k] + (b[k] - a[k]) * t : a[k]
  }
  return out
}

/**
 * Turns a shot list into keyframes, dipping to black across every shot change
 * instead of cutting hard. Each shot gets four keyframes: black at the start,
 * clear just after, clear just before the end, black at the end. The pose swap
 * for the next shot therefore happens while the frame is already dark, and the
 * interior pair keeps the camera move on its intended path.
 */
function buildShots(shots, { fade = 0.55 } = {}) {
  const keys = []
  shots.forEach(({ s, e, from, to }) => {
    const a = norm(from)
    const b = norm(to ?? from)
    const span = e - s
    const f = Math.min(fade, span * 0.25)
    keys.push(shot(s, a, 1))
    keys.push(shot(s + f, lerpShot(a, b, f / span), 0))
    keys.push(shot(e - f, lerpShot(a, b, (span - f) / span), 0))
    keys.push(shot(e, b, 1))
  })
  return keys
}

/**
 * Nine-shot product film on a fixed 120s timeline. Every shot change dips
 * through black rather than cutting hard.
 */
const CINEMATIC_120 = () =>
  buildShots([
    // cold open — closed lid, low grazing creep
    { s: 0, e: 14,
      from: { ry: -28, lid: 2, az: 46, el: 6, d: 0.56, fov: 26, ty: 0.02, b: 0.5, g: 0 },
      to:   { ry: -24, lid: 2, az: 39, el: 10, d: 0.48, fov: 26, ty: 0.025, b: 0.5, g: 0 } },
    // the open — lid rises as the camera lifts with it
    { s: 14.05, e: 26,
      from: { ry: -24, lid: 3, az: 39, el: 11, d: 0.52, fov: 27, ty: 0.03, b: 0.6, g: 0.05 },
      to:   { ry: -21, lid: 104, az: 33, el: 22, d: 0.80, fov: 29, ty: 0.10, b: 1.0, g: 0.35 } },
    // settle into a three-quarter hero
    { s: 26.05, e: 38,
      from: { ry: -20, lid: 103, az: 30, el: 24, d: 0.80, fov: 30, ty: 0.11 },
      to:   { ry: -15, lid: 102, az: 23, el: 27, d: 0.84, fov: 30, ty: 0.115 } },
    // front on, slow push in
    { s: 38.05, e: 52,
      from: { ry: 0, lid: 102, az: 0, el: 16, d: 0.80, fov: 30, ty: 0.115 },
      to:   { ry: 0, lid: 102, az: 0, el: 12, d: 0.66, fov: 29, ty: 0.112, zoom: 1.03 } },
    // macro drift across the display
    { s: 52.05, e: 66,
      from: { ry: -4, lid: 100, az: -14, el: 10, d: 0.38, fov: 26, ty: 0.150, zoom: 1.04, ox: -0.03 },
      to:   { ry: -4, lid: 100, az: 10, el: 9, d: 0.46, fov: 26, ty: 0.140, zoom: 1.04, ox: 0.02 } },
    // low three-quarter, orbiting right to centre
    { s: 66.05, e: 82,
      from: { ry: -30, lid: 104, az: 46, el: 8, d: 0.72, fov: 30, ty: 0.09 },
      to:   { ry: -6, lid: 104, az: 26, el: 13, d: 0.76, fov: 30, ty: 0.10 } },
    // high angle descending onto the deck and keyboard
    { s: 82.05, e: 96,
      from: { ry: 8, lid: 100, az: 10, el: 58, d: 0.78, fov: 34, ty: 0.08 },
      to:   { ry: 8, lid: 100, az: 8, el: 30, d: 0.80, fov: 34, ty: 0.10 } },
    // slow drift left across the front
    { s: 96.05, e: 108,
      from: { ry: 16, lid: 104, az: -14, el: 26, d: 0.78, fov: 33, ty: 0.11 },
      to:   { ry: 10, lid: 104, az: -32, el: 20, d: 0.80, fov: 32, ty: 0.11 } },
    // final glide out to a wide hero hold
    { s: 108.05, e: 120,
      from: { ry: 0, lid: 103, az: 6, el: 22, d: 0.80, fov: 34, ty: 0.115 },
      to:   { ry: -3, lid: 103, az: 1, el: 26, d: 1.03, fov: 34, ty: 0.115, b: 1.08, g: 0.45 } },
  ])


/** Bright aluminium product-studio look the cinematic preset is framed against. */
const CINEMATIC_LOOK = {
  lighting: {
    keyIntensity: 2.1,
    keyAzimuth: 31,
    keyElevation: 54,
    fillIntensity: 0.45,
    rimIntensity: 0.35,
    ambient: 0.22,
    hemi: 0.45,
    exposure: 1.0,
    envPreset: 'studio',
    envIntensity: 0.35,
    shadows: true,
    shadowOpacity: 0.35,
    shadowBlur: 2.2,
  },
  material: {
    bodyColor: '#8c8c90',
    bodyRoughness: 0.16,
    bodyMetalness: 0.92,
    bezelColor: '#0a0a0c',
    screenReflectivity: 0.1,
  },
  background: {
    mode: 'gradient',
    colorTop: '#dedede',
    colorBottom: '#cfcfcf',
    groundVisible: true,
    groundStyle: 'matte',
    groundColor: '#d4d4d4',
  },
}

/** Concrete floor, black-to-grey backdrop. */
const CONCRETE_LOOK = {
  lighting: {
    keyIntensity: 2.6, keyAzimuth: 24, keyElevation: 52, fillIntensity: 0.45, rimIntensity: 1.1,
    ambient: 0.18, hemi: 0.35, exposure: 1.0, envPreset: 'studio', envIntensity: 0.45,
    shadows: true, shadowOpacity: 0.45, shadowBlur: 2.4,
  },
  material: { bodyColor: '#8c8d92', bodyRoughness: 0.18, bodyMetalness: 0.9, bezelColor: '#0a0a0c', screenReflectivity: 0.1 },
  background: {
    mode: 'gradient',
    colorTop: '#000000',
    colorBottom: '#acaaaa',
    groundVisible: true,
    surface: 'concrete',
    groundColor: '#b6afaf',
    props: true,
  },
}

/**
 * A 37s piece that opens on a drone move: high and almost straight down on the
 * closed machine, then descending and swinging around as it drops, levelling
 * out low before the lid opens. One continuous move throughout — the only cuts
 * are the fade up at the start and the fade out at the end.
 */
const DRONE_REVEAL = () => [
  // --- drone: high, looking down, closed ---
  shot(0,    { ry: -20, lid: 2,   az: 20,  el: 78, d: 2.30, fov: 42, ty: 0.020, b: 0.5, g: 0 }, 1),
  shot(2.5,  { ry: -22, lid: 2,   az: 30,  el: 72, d: 2.00, fov: 42, ty: 0.020, b: 0.5, g: 0 }, 0),
  shot(6,    { ry: -26, lid: 2,   az: 46,  el: 58, d: 1.55, fov: 40, ty: 0.020, b: 0.5, g: 0 }, 0),
  shot(10,   { ry: -28, lid: 2,   az: 58,  el: 38, d: 1.05, fov: 36, ty: 0.025, b: 0.5, g: 0 }, 0),
  // --- levels out low, still shut ---
  shot(13.5, { ry: -26, lid: 3,   az: 52,  el: 16, d: 0.72, fov: 31, ty: 0.030, b: 0.55, g: 0.03 }, 0),
  // --- the open ---
  shot(17,   { ry: -24, lid: 40,  az: 46,  el: 13, d: 0.64, fov: 30, ty: 0.045, b: 0.7, g: 0.12 }, 0),
  shot(20,   { ry: -21, lid: 104, az: 36,  el: 20, d: 0.80, fov: 30, ty: 0.100, b: 1.0, g: 0.35 }, 0),
  // --- push in, narrowing the lens ---
  shot(24,   { ry: -12, lid: 104, az: 14,  el: 22, d: 0.70, fov: 27, ty: 0.115 }, 0),
  shot(27.5, { ry: -4,  lid: 104, az: -4,  el: 18, d: 0.62, fov: 26, ty: 0.118, zoom: 1.04 }, 0),
  // --- release into the orbit ---
  shot(31,   { ry: 4,   lid: 104, az: -20, el: 22, d: 0.76, fov: 30, ty: 0.112 }, 0),
  shot(33.5, { ry: 10,  lid: 104, az: -30, el: 24, d: 0.86, fov: 31, ty: 0.110 }, 0),
  // --- close it, pull away ---
  shot(35.5, { ry: 13,  lid: 50,  az: -24, el: 25, d: 0.92, fov: 32, ty: 0.075, b: 0.8, g: 0.15 }, 0),
  shot(37,   { ry: 14,  lid: 2,   az: -18, el: 24, d: 1.00, fov: 32, ty: 0.045, b: 0.5, g: 0 }, 1),
]

/**
 * 40s product film to a fixed beat sheet. One continuous camera — the only cut
 * is to black on the last frame.
 *
 *   0-4   drone-style extreme wide, moving forward
 *   4-7   accelerate toward the product
 *   7-11  slow three-quarter reveal, still pushing
 *   11-15 low side angle, product rotates
 *   15-19 180 degree orbit
 *   19-23 push toward the display, lid opens during the push
 *   23-27 extreme close-up, then pull back as it rotates
 *   27-31 fast three-quarter / side / front
 *   31-35 slow hero orbit, camera rising
 *   35-38 straight in to the hero composition
 *   38-40 dead still, then cut to black
 */
const HERO_40 = () => [
  shot(0,    { ry: -20, lid: 2,   az: 25,  el: 70, d: 3.20, fov: 45, ty: 0.020, b: 0.5, g: 0 }, 1),
  shot(1.5,  { ry: -21, lid: 2,   az: 27,  el: 65, d: 2.85, fov: 45, ty: 0.020, b: 0.5, g: 0 }, 0),
  shot(4,    { ry: -23, lid: 2,   az: 30,  el: 56, d: 2.35, fov: 44, ty: 0.020, b: 0.5, g: 0 }, 0),
  shot(7,    { ry: -28, lid: 2,   az: 38,  el: 38, d: 1.35, fov: 40, ty: 0.025, b: 0.5, g: 0 }, 0),
  shot(11,   { ry: -34, lid: 2,   az: 46,  el: 22, d: 0.82, fov: 34, ty: 0.045, b: 0.5, g: 0 }, 0),
  shot(15,   { ry: -44, lid: 2,   az: 78,  el: 8,  d: 0.60, fov: 30, ty: 0.032, b: 0.5, g: 0 }, 0),
  // lid stays at exactly 2 through here: equal values either side are held
  // flat, which stops the big opening move from easing backwards into the
  // orbit and cracking the lid before its beat
  shot(19,   { ry: -30, lid: 2,   az: -102, el: 12, d: 0.68, fov: 31, ty: 0.045, b: 0.5, g: 0 }, 0),
  shot(23,   { ry: -18, lid: 104, az: -34, el: 16, d: 0.52, fov: 27, ty: 0.105, b: 1.0, g: 0.35 }, 0),
  shot(25,   { ry: -12, lid: 104, az: -18, el: 13, d: 0.40, fov: 24, ty: 0.116, zoom: 1.05 }, 0),
  shot(27,   { ry: 2,   lid: 104, az: -4,  el: 19, d: 0.74, fov: 31, ty: 0.112 }, 0),
  // fast transitions: three-quarter, side, front
  shot(28.2, { ry: 6,   lid: 104, az: 42,  el: 20, d: 0.72, fov: 31, ty: 0.112 }, 0),
  shot(29.6, { ry: 10,  lid: 104, az: 86,  el: 15, d: 0.70, fov: 31, ty: 0.105 }, 0),
  shot(31,   { ry: 4,   lid: 104, az: 2,   el: 18, d: 0.74, fov: 31, ty: 0.112 }, 0),
  // slow hero orbit, rising
  shot(35,   { ry: -6,  lid: 104, az: -52, el: 30, d: 0.80, fov: 31, ty: 0.115 }, 0),
  // in to the hero, decelerating
  shot(36.8, { ry: -10, lid: 104, az: -32, el: 25, d: 0.66, fov: 29, ty: 0.115 }, 0),
  shot(38,   { ry: -12, lid: 104, az: -22, el: 22, d: 0.60, fov: 28, ty: 0.115 }, 0),
  // dead still
  shot(38.3, { ry: -12, lid: 104, az: -22, el: 22, d: 0.60, fov: 28, ty: 0.115 }, 0),
  shot(39.9, { ry: -12, lid: 104, az: -22, el: 22, d: 0.60, fov: 28, ty: 0.115 }, 0),
  // cut to black
  shot(40,   { ry: -12, lid: 104, az: -22, el: 22, d: 0.60, fov: 28, ty: 0.115 }, 1),
]

/** The Ridge location, with the body finished for a hero rather than a preview. */
const RIDGE_LOOK = {
  locationId: 'ridge',
  lighting: LOCATIONS.ridge.lighting,
  background: LOCATIONS.ridge.background,
  material: {
    ...LOCATIONS.ridge.material,
    bodyRoughness: 0.2,
    bodyMetalness: 0.88,
    bezelColor: '#0a0a0c',
    screenReflectivity: 0.12,
  },
}

/**
 * 30s liftoff, one unbroken camera move.
 *
 *   0-6   eye level with the stone, lid shut, a slow creep in
 *   6-12  it leaves the ledge; the camera stays low and cranes to follow
 *   12-20 the lid opens as it keeps climbing
 *   20-27 it rolls over as it rises, the camera lifting with it
 *   27-30 dead still, fading out
 *
 * Framed wide throughout. The machine is 0.34 units across, so at these
 * distances it occupies roughly a quarter to a third of the frame and the
 * ledge, the horizon and the sky are all in shot — tight enough to read the
 * display, loose enough that the environment is the other half of the picture.
 *
 * Two values are deliberately repeated rather than interpolated. The lid holds
 * at exactly 2 through every keyframe before its beat, and the float holds at
 * exactly 0 through the opening creep, because a Catmull-Rom tangent reaches
 * backwards across neighbours — without the flat hold the machine cracks its
 * lid, and lifts off the rock, several seconds before it should.
 */
const LIFTOFF_30 = () => [
  // --- ground level, shut ---
  shot(0,     { ry: -26, lid: 2, fy: 0, az: 54, el: 5, d: 0.98, fov: 30, ty: 0.030, b: 0.5, g: 0 }, 1),
  shot(1.8,   { ry: -26, lid: 2, fy: 0, az: 49, el: 5, d: 0.92, fov: 30, ty: 0.030, b: 0.5, g: 0 }, 0),
  shot(4,     { ry: -25, lid: 2, fy: 0, az: 43, el: 6, d: 0.86, fov: 30, ty: 0.032, b: 0.5, g: 0 }, 0),
  shot(6,     { ry: -24, lid: 2, fy: 0, az: 38, el: 8, d: 0.82, fov: 30, ty: 0.034, b: 0.5, g: 0 }, 0),
  // --- liftoff, still shut ---
  // The camera climbs faster than the machine here. Matching its rate would
  // put the eye level with a shut lid, which from the side is a 6mm sliver;
  // staying above it keeps the whole top face in shot as it goes up.
  shot(8.5,   { ry: -23, lid: 2, fy: 0.07, az: 34, el: 11, d: 0.86, fov: 30, ty: 0.075, b: 0.52, g: 0.02 }, 0),
  shot(12,    { ry: -22, lid: 2, fy: 0.18, az: 29, el: 15, d: 0.94, fov: 30, ty: 0.170, b: 0.55, g: 0.04 }, 0),
  // --- the open, on the way up ---
  shot(15,    { ry: -20, lid: 34,  fy: 0.25, az: 24, el: 16, d: 1.00, fov: 30, ty: 0.235, b: 0.72, g: 0.14 }, 0),
  shot(17.5,  { ry: -18, lid: 78,  fy: 0.30, az: 19, el: 16, d: 1.06, fov: 30, ty: 0.285, b: 0.90, g: 0.26 }, 0),
  shot(20,    { ry: -16, lid: 104, fy: 0.34, az: 14, el: 16, d: 1.12, fov: 30, ty: 0.325, b: 1.05, g: 0.38 }, 0),
  // --- it rolls over as it climbs; the camera falls back to show the ledge it
  //     left. Framing the target below the machine puts it in the upper third
  //     with the stone underneath it, which is the point of the whole move.
  shot(23,    { ry: -12, lid: 104, rz: -8,  rx: 3, fy: 0.42, az: 4,   el: 18, d: 1.22, fov: 30, ty: 0.390 }, 0),
  shot(27,    { ry: -6,  lid: 104, rz: -20, rx: 7, fy: 0.52, az: -12, el: 20, d: 1.38, fov: 31, ty: 0.480 }, 0),
  // --- held still while the frame fades out ---
  shot(28.4,  { ry: -4,  lid: 104, rz: -24, rx: 8, fy: 0.55, az: -17, el: 21, d: 1.45, fov: 31, ty: 0.505 }, 0),
  shot(30,    { ry: -4,  lid: 104, rz: -24, rx: 8, fy: 0.55, az: -17, el: 21, d: 1.45, fov: 31, ty: 0.505 }, 1),
]

/**
 * 20s drop. The camera sits on the stone and never leaves it.
 *
 *   0-3.4    it hangs high against the sky, nothing else in frame
 *   3.4-5.2  the fall
 *   5.2      impact, a jolt through the lens and two diminishing bounces
 *   6-8.5    settled, still shut
 *   8.5-11.4 the lid whips open past its stop and rocks back
 *   11.4-18  in and around to the hero
 *   18-20    held, fading out
 *
 * The fall is authored on a gravity curve -- each keyframe sits at
 * h(1 - u^2) for its share of the drop -- and every keyframe through the fall,
 * the impact and the bounces is marked `lin`. The spline is wrong for all
 * three: it would ease the machine into the ground rather than accelerate it,
 * carry its speed straight through the landing and sink it below the surface,
 * and round the bounce contacts into a wobble. Straight segments through a
 * curve of poses give the acceleration without any of that.
 *
 * The lid is the opposite case and stays on the spline. Overshooting to 112
 * and settling back through 99 and 106 lets Catmull-Rom damp the whip for
 * free, which is the one place in the piece where a bulge is the point.
 *
 * Nothing shows the ground until the last half second of the fall: the camera
 * starts pitched up at the sky and tilts down as the machine drops into it,
 * so the ledge it is about to hit only arrives in frame just before it does.
 */
const DROP_20 = () => [
  // --- hanging ---
  shot(0,    { ry: -52, rx: -10, rz: 6, lid: 2, fy: 1.450, az: 44, el: -37, d: 1.90, fov: 34, ty: 1.300, b: 0.5, g: 0 }, 1),
  shot(1.5,  { ry: -50, rx: -10, rz: 6, lid: 2, fy: 1.437, az: 43, el: -36, d: 1.88, fov: 34, ty: 1.280, b: 0.5, g: 0 }, 0),
  shot(3.4,  { ry: -48, rx: -9,  rz: 5, lid: 2, fy: 1.420, az: 42, el: -37, d: 1.80, fov: 34, ty: 1.240, b: 0.5, g: 0, lin: true }, 0),
  // --- the fall, on h(1 - u^2). The camera closes as it comes down, so the
  //     machine grows through the drop instead of staying a speck on impact.
  shot(3.9,  { ry: -44, rx: -8,  rz: 4, lid: 2, fy: 1.310, az: 41, el: -36, d: 1.70, fov: 34, ty: 1.160, b: 0.5, g: 0, lin: true }, 0),
  shot(4.3,  { ry: -40, rx: -6,  rz: 3, lid: 2, fy: 1.065, az: 41, el: -32, d: 1.52, fov: 34, ty: 0.980, b: 0.5, g: 0, lin: true }, 0),
  shot(4.65, { ry: -35, rx: -4,  rz: 2, lid: 2, fy: 0.736, az: 40, el: -24, d: 1.32, fov: 34, ty: 0.720, b: 0.5, g: 0, lin: true }, 0),
  shot(4.9,  { ry: -31, rx: -2,  rz: 1, lid: 2, fy: 0.435, az: 39, el: -13, d: 1.15, fov: 34, ty: 0.460, b: 0.5, g: 0, lin: true }, 0),
  shot(5.08, { ry: -28, rx: -1,  rz: 0, lid: 2, fy: 0.184, az: 39, el: -2,  d: 1.02, fov: 34, ty: 0.240, b: 0.5, g: 0, lin: true }, 0),
  // --- impact: it stops dead, the lens is knocked, then two bounces ---
  shot(5.20, { ry: -26, rx: 0, rz: 0,  lid: 2, fy: 0,     az: 38.0, el: 9.0, d: 0.95, fov: 34, ty: 0.130, b: 0.5, g: 0, lin: true }, 0),
  shot(5.30, { ry: -26, rx: 0, rz: -4, lid: 2, fy: 0.050, az: 39.4, el: 6.8, d: 0.95, fov: 34, ty: 0.104, b: 0.5, g: 0, lin: true }, 0),
  shot(5.42, { ry: -26, rx: 0, rz: 2,  lid: 2, fy: 0,     az: 36.8, el: 10.7, d: 0.94, fov: 34, ty: 0.150, b: 0.5, g: 0, lin: true }, 0),
  shot(5.50, { ry: -26, rx: 0, rz: -1, lid: 2, fy: 0.016, az: 38.6, el: 8.4, d: 0.94, fov: 34, ty: 0.119, b: 0.5, g: 0, lin: true }, 0),
  shot(5.60, { ry: -26, rx: 0, rz: 1,  lid: 2, fy: 0,     az: 37.7, el: 9.5, d: 0.94, fov: 34, ty: 0.136, b: 0.5, g: 0, lin: true }, 0),
  shot(5.70, { ry: -26, rx: 0, rz: 0,  lid: 2, fy: 0.005, az: 38.1, el: 8.9, d: 0.94, fov: 34, ty: 0.128, b: 0.5, g: 0, lin: true }, 0),
  shot(5.80, { ry: -26, rx: 0, rz: 0,  lid: 2, fy: 0,     az: 38.0, el: 9.1, d: 0.94, fov: 34, ty: 0.130, b: 0.5, g: 0, lin: true }, 0),
  // --- settled, still shut. Equal values hold the spline flat. ---
  shot(6.6,  { ry: -26, lid: 2, fy: 0, az: 37, el: 10, d: 0.97, fov: 33, ty: 0.135, b: 0.5, g: 0 }, 0),
  shot(8.5,  { ry: -26, lid: 2, fy: 0, az: 35, el: 12, d: 1.01, fov: 33, ty: 0.140, b: 0.5, g: 0 }, 0),
  // --- the lid whips open and rocks back ---
  shot(9.1,  { ry: -26, lid: 26,  fy: 0, az: 34, el: 12, d: 1.03, fov: 33, ty: 0.145, b: 0.60, g: 0.06 }, 0),
  shot(9.6,  { ry: -26, lid: 74,  fy: 0, az: 33, el: 13, d: 1.05, fov: 32, ty: 0.150, b: 0.85, g: 0.20 }, 0),
  shot(9.95, { ry: -26, lid: 112, fy: 0, az: 32, el: 13, d: 1.06, fov: 32, ty: 0.152, b: 1.00, g: 0.32 }, 0),
  shot(10.4, { ry: -25, lid: 99,  fy: 0, az: 31, el: 14, d: 1.07, fov: 32, ty: 0.155, b: 1.05, g: 0.36 }, 0),
  shot(10.9, { ry: -25, lid: 106, fy: 0, az: 30, el: 14, d: 1.09, fov: 32, ty: 0.158, b: 1.05, g: 0.38 }, 0),
  shot(11.4, { ry: -24, lid: 104, fy: 0, az: 29, el: 15, d: 1.10, fov: 32, ty: 0.160, b: 1.05, g: 0.38 }, 0),
  // --- in and around to the hero ---
  shot(13,   { ry: -23, lid: 104, fy: 0, az: 22, el: 15, d: 1.13, fov: 32, ty: 0.165 }, 0),
  shot(15,   { ry: -21, lid: 104, fy: 0, az: 12, el: 15, d: 1.17, fov: 31, ty: 0.170 }, 0),
  shot(17,   { ry: -19, lid: 104, fy: 0, az: 1,  el: 16, d: 1.20, fov: 31, ty: 0.175 }, 0),
  // --- held while the frame fades out ---
  shot(18,   { ry: -18, lid: 104, fy: 0, az: -4, el: 17, d: 1.21, fov: 31, ty: 0.175 }, 0),
  shot(20,   { ry: -18, lid: 104, fy: 0, az: -4, el: 17, d: 1.21, fov: 31, ty: 0.175 }, 1),
]

export const PRESETS = [
  {
    id: 'drop',
    label: 'Drop 20s',
    duration: 20,
    look: RIDGE_LOOK,
    requires: 'macbook',
    build: () => DROP_20(),
  },
  {
    id: 'liftoff',
    label: 'Liftoff 30s',
    duration: 30,
    look: RIDGE_LOOK,
    // The whole piece is the lid opening; on a device without one it is a
    // static hover, so the preset picks the machine it was written for.
    requires: 'macbook',
    build: () => LIFTOFF_30(),
  },
  {
    id: 'hero40',
    label: 'Hero film 40s',
    duration: 40,
    look: CONCRETE_LOOK,
    build: () => HERO_40(),
  },
  {
    id: 'drone',
    label: 'Drone reveal 37s',
    duration: 37,
    look: CONCRETE_LOOK,
    build: () => DRONE_REVEAL(),
  },
  {
    id: 'scroll',
    label: 'Scroll page',
    build: (d) => [
      kf(0, { ...snap({ screen: { scroll: 0 } }), post: { fade: 0, fadeColor: '#000000' } }),
      kf(d, { ...snap({ screen: { scroll: 1 } }), post: { fade: 0, fadeColor: '#000000' } }),
    ],
  },
  {
    id: 'cinematic',
    label: 'Cinematic 2 min',
    duration: 120,
    look: CINEMATIC_LOOK,
    build: () => CINEMATIC_120(),
  },
  {
    id: 'open',
    label: 'Open lid',
    build: (d) => {
      const s = useStudio.getState()
      return [kf(0, snap({ device: { lidAngle: 4 } })), kf(d * 0.75, snap({ device: { lidAngle: s.device.lidAngle } })), kf(d, snap())]
    },
  },
  {
    id: 'orbit',
    label: 'Orbit',
    build: (d) => {
      const s = useStudio.getState()
      const [rx, ry, rz] = s.device.rotation
      return [
        kf(0, snap({ device: { rotation: [rx, ry - 32, rz] } })),
        kf(d, snap({ device: { rotation: [rx, ry + 32, rz] } })),
      ]
    },
  },
  {
    id: 'push',
    label: 'Push in',
    build: (d) => {
      const s = useStudio.getState()
      const [x, y, z] = s.camera.position
      return [kf(0, snap({ camera: { position: [x, y + 0.35, z * 1.55] } })), kf(d, snap({ camera: { position: [x, y, z] } }))]
    },
  },
  {
    id: 'reveal',
    label: 'Hero reveal',
    build: (d) => {
      const s = useStudio.getState()
      const [x, y, z] = s.camera.position
      const [rx, ry, rz] = s.device.rotation
      return [
        kf(0, snap({ device: { lidAngle: 6, rotation: [rx, ry - 40, rz] }, camera: { position: [x + 0.4, y + 0.5, z * 1.7] } })),
        kf(d * 0.6, snap({ device: { lidAngle: s.device.lidAngle, rotation: [rx, ry - 10, rz] } })),
        kf(d, snap({ camera: { position: [x, y, z] } })),
      ]
    },
  },
]

export function applyPreset(id) {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) return

  // A preset with a fixed duration (a full choreography) sets the timeline
  // length itself; the short moves adapt to whatever length is already set.
  const duration = preset.duration ?? useStudio.getState().duration
  if (preset.duration) useStudio.getState().setDuration(preset.duration)

  const keyframes = preset.build(duration).sort((a, b) => a.time - b.time)
  const look = preset.look
  const s = useStudio.getState()

  useStudio.getState().commit()
  if (preset.requires && s.deviceId !== preset.requires) useStudio.getState().setDevice(preset.requires)
  useStudio.setState({
    keyframes,
    playhead: 0,
    previewLive: false,
    ...(look
      ? {
          ...(look.locationId ? { locationId: look.locationId } : {}),
          lighting: { ...s.lighting, ...look.lighting },
          material: { ...s.material, ...look.material },
          background: { ...s.background, ...look.background },
        }
      : {}),
  })
}
