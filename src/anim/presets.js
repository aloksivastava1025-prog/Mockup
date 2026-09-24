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
const shot = (time, o) => {
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
      fit: 'cover',
      brightness: o.b ?? 1.05,
      glow: o.g ?? 0.38,
    },
  })
}

/**
 * Nine-shot product film. Shots are cut by placing two keyframes 0.05s apart,
 * which reads as a hard cut; everything else eases. Fixed 120s timeline.
 */
const CINEMATIC_120 = () => [
  // cold open — closed lid, low grazing creep
  shot(0, { ry: -28, lid: 2, az: 46, el: 6, d: 0.56, fov: 26, ty: 0.02, b: 0.5, g: 0 }),
  shot(12, { ry: -24, lid: 2, az: 40, el: 9, d: 0.46, fov: 26, ty: 0.02, b: 0.5, g: 0 }),
  // the open — camera rises with the lid
  shot(15, { ry: -23, lid: 45, az: 37, el: 14, d: 0.68, fov: 28, ty: 0.06, b: 0.8, g: 0.2 }),
  shot(20, { ry: -22, lid: 104, az: 34, el: 22, d: 0.8, fov: 29, ty: 0.1, b: 1.0, g: 0.35 }),
  shot(27, { ry: -18, lid: 102, az: 28, el: 26, d: 0.82, fov: 30, ty: 0.115 }),
  // cut — hero front, slow push in
  shot(27.05, { ry: 0, lid: 102, az: 0, el: 16, d: 0.8, fov: 30, ty: 0.115 }),
  shot(42, { ry: 0, lid: 102, az: 0, el: 12, d: 0.66, fov: 29, ty: 0.112, zoom: 1.03 }),
  // cut — macro drift across the display
  shot(42.05, { ry: -4, lid: 100, az: -14, el: 10, d: 0.38, fov: 26, ty: 0.15, zoom: 1.04, ox: -0.03 }),
  shot(54, { ry: -4, lid: 100, az: 10, el: 9, d: 0.46, fov: 26, ty: 0.14, zoom: 1.04, ox: 0.02 }),
  // cut — low three-quarter, orbit right to centre
  shot(54.05, { ry: -30, lid: 104, az: 46, el: 8, d: 0.72, fov: 30, ty: 0.09 }),
  shot(74, { ry: -6, lid: 104, az: 26, el: 13, d: 0.76, fov: 30, ty: 0.1 }),
  // cut — high angle descending onto the deck
  shot(74.05, { ry: 8, lid: 100, az: 10, el: 58, d: 0.78, fov: 34, ty: 0.08 }),
  shot(88, { ry: 8, lid: 100, az: 8, el: 30, d: 0.8, fov: 34, ty: 0.1 }),
  // lid breathes shut and reopens while drifting left (no cut)
  shot(96, { ry: 16, lid: 88, az: -20, el: 24, d: 0.78, fov: 33, ty: 0.11 }),
  shot(104, { ry: 10, lid: 104, az: -30, el: 20, d: 0.8, fov: 32, ty: 0.11 }),
  // final glide out to a wide hero hold
  shot(118, { ry: -4, lid: 103, az: 2, el: 26, d: 1.0, fov: 34, ty: 0.115, b: 1.08, g: 0.45 }),
  shot(120, { ry: -3, lid: 103, az: 1, el: 26, d: 1.03, fov: 34, ty: 0.115, b: 1.08, g: 0.45 }),
]

/** Dark studio look the cinematic preset is framed against. */
const CINEMATIC_LOOK = {
  lighting: {
    keyIntensity: 3.0,
    keyAzimuth: 38,
    keyElevation: 42,
    fillIntensity: 0.5,
    rimIntensity: 2.4,
    ambient: 0.2,
    envPreset: 'studio',
    envIntensity: 1.0,
    shadows: true,
    shadowOpacity: 0.55,
    shadowBlur: 3.0,
  },
  material: {
    bodyColor: '#4a4e57',
    bodyRoughness: 0.36,
    bodyMetalness: 0.88,
    bezelColor: '#0a0b0e',
    screenReflectivity: 0.14,
  },
  background: { mode: 'gradient', colorTop: '#171b24', colorBottom: '#040507', groundVisible: true },
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
