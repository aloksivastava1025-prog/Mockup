import { create } from 'zustand'

// Groups listed here are the ones a keyframe snapshots and the animator interpolates.
export const ANIMATED_GROUPS = ['device', 'camera', 'screen', 'post']

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
    fit: 'contain', // show the whole recording; bars fill any aspect mismatch
    letterbox: '#000000',
    brightness: 1.05,
    glow: 0.25,
  },
  // Screen-space dip-to-colour used for transitions between shots.
  post: {
    fade: 0,
    fadeColor: '#000000',
  },
  lighting: {
    keyIntensity: 2.1,
    keyAzimuth: 31, // degrees around Y
    keyElevation: 54, // degrees above horizon
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
    mode: 'gradient', // 'gradient' | 'color' | 'transparent'
    colorTop: '#dedede',
    colorBottom: '#cfcfcf',
    color: '#d6d6d6',
    groundVisible: true,
    groundStyle: 'matte', // 'matte' | 'reflective'
    groundColor: '#d4d4d4',
  },
}

const clone = (v) => JSON.parse(JSON.stringify(v))

export const useStudio = create((set, get) => ({
  ...clone(defaults),

  deviceId: 'macbook',
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
