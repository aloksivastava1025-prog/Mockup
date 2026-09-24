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
 */
const shot = (time, o, fade = 0) => {
  const el = o.el * DEG
  const az = o.az * DEG
  return kf(time, {
    device: { position: [0, 0, 0], rotation: [0, o.ry, 0], lidAngle: o.lid, scale: 1 },
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
}

const SHOT_DEFAULTS = {
  ry: 0, lid: 102, az: 0, el: 16, d: 0.8, fov: 30, ty: 0.115,
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

export const PRESETS = [
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

  useStudio.setState({
    keyframes,
    playhead: 0,
    previewLive: false,
    ...(look
      ? {
          lighting: { ...s.lighting, ...look.lighting },
          material: { ...s.material, ...look.material },
          background: { ...s.background, ...look.background },
        }
      : {}),
  })
}
