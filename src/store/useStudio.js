import { create } from 'zustand'

// Groups listed here are the ones a keyframe snapshots and the animator interpolates.
export const ANIMATED_GROUPS = ['device', 'camera', 'screen']

const defaults = {
  device: {
    position: [0, 0, 0],
    rotation: [0, -18, 0], // degrees
    lidAngle: 102, // degrees from closed
    scale: 1,
  },
  camera: {
    position: [0.20, 0.30, 0.88],
    target: [0, 0.12, 0],
    fov: 34,
  },
  screen: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    fit: 'cover',
    brightness: 1.05,
    glow: 0.25,
  },
  lighting: {
    keyIntensity: 2.6,
    keyAzimuth: 42, // degrees around Y
    keyElevation: 48, // degrees above horizon
    fillIntensity: 0.7,
    rimIntensity: 1.6,
    ambient: 0.35,
    envPreset: 'city',
    envIntensity: 0.9,
    shadows: true,
    shadowOpacity: 0.45,
    shadowBlur: 2.6,
  },
  material: {
    bodyColor: '#b8bcc4',
    bodyRoughness: 0.34,
    bodyMetalness: 0.92,
    bezelColor: '#101114',
    screenReflectivity: 0.18,
  },
  background: {
    mode: 'gradient', // 'gradient' | 'color' | 'transparent'
    colorTop: '#20242e',
    colorBottom: '#0a0b0e',
    color: '#0b0c10',
    groundVisible: true,
  },
}

const clone = (v) => JSON.parse(JSON.stringify(v))

export const useStudio = create((set, get) => ({
  ...clone(defaults),

  deviceId: 'laptop',
  setDevice: (deviceId) => set({ deviceId }),

  // ---- video source ----
  video: null, // { el, url, name, duration }
  setVideo: (video) => set({ video }),

  // When true the viewport shows the values in this store ("live" pose). Touching
  // any control switches it on; scrubbing or playing hands control back to the
  // timeline so the keyframed animation is what you see.
  previewLive: true,

  // ---- generic group update ----
  update: (group, patch) => set((s) => ({ [group]: { ...s[group], ...patch }, previewLive: true })),
  setAxis: (group, key, index, value) =>
    set((s) => {
      const next = [...s[group][key]]
      next[index] = value
      return { [group]: { ...s[group], [key]: next }, previewLive: true }
    }),
  resetGroup: (group) => set({ [group]: clone(defaults[group]) }),
  resetAll: () => set(clone(defaults)),

  // ---- orbit / interaction ----
  orbitEnabled: true,
  setOrbitEnabled: (orbitEnabled) => set({ orbitEnabled }),

  // ---- animation ----
  keyframes: [], // [{ id, time, state: { device, camera, screen } }]
  duration: 6,
  playhead: 0,
  isPlaying: false,
  setDuration: (duration) => set({ duration: Math.max(0.5, duration) }),
  setPlayhead: (playhead) => set({ playhead, previewLive: false }),
  setPlaying: (isPlaying) => set({ isPlaying, previewLive: isPlaying ? false : get().previewLive }),

  addKeyframe: (time) =>
    set((s) => {
      const t = Math.min(s.duration, Math.max(0, time ?? s.playhead))
      const state = Object.fromEntries(ANIMATED_GROUPS.map((g) => [g, clone(s[g])]))
      const rest = s.keyframes.filter((k) => Math.abs(k.time - t) > 1e-3)
      const next = [...rest, { id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, time: t, state }]
      next.sort((a, b) => a.time - b.time)
      return { keyframes: next }
    }),
  removeKeyframe: (id) => set((s) => ({ keyframes: s.keyframes.filter((k) => k.id !== id) })),
  clearKeyframes: () => set({ keyframes: [] }),
  applyKeyframe: (id) =>
    set((s) => {
      const kf = s.keyframes.find((k) => k.id === id)
      if (!kf) return {}
      return { ...clone(kf.state), playhead: kf.time, previewLive: true }
    }),

  // ---- export ----
  exporting: null, // { progress, phase } | null
  setExporting: (exporting) => set({ exporting }),

  getAnimatedSnapshot: () => {
    const s = get()
    return Object.fromEntries(ANIMATED_GROUPS.map((g) => [g, clone(s[g])]))
  },
}))

export { defaults }
