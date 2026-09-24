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

export const PRESETS = [
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
  const duration = useStudio.getState().duration
  const keyframes = preset.build(duration).sort((a, b) => a.time - b.time)
  useStudio.setState({ keyframes, playhead: 0, previewLive: false })
}
