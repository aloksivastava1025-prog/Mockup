import { create } from 'zustand'
import { samplesToKeyframes } from '../anim/record.js'

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
    scroll: 0, // 0 = top of a tall screenshot, 1 = bottom
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
    keyBacklight: 0.5,
  },
  background: {
    mode: 'gradient', // 'gradient' | 'color' | 'image' | 'transparent'
    colorTop: '#dedede',
    colorBottom: '#cfcfcf',
    color: '#d6d6d6',
    groundVisible: true,
    surface: 'studio', // see scene/surfaces.js
    props: false, // desk dressing; gives wide and aerial framings a sense of place
    groundColor: '#d4d4d4',
  },
}

const clone = (v) => JSON.parse(JSON.stringify(v))

/** The parts of the store that make up a saved project / an undo step. */
export const DOC_KEYS = [
  'device',
  'camera',
  'screen',
  'post',
  'lighting',
  'material',
  'background',
  'locationId',
  'deviceId',
  'adaptScreen',
  'keyframes',
  'duration',
]

const snapshot = (s) => Object.fromEntries(DOC_KEYS.map((k) => [k, clone(s[k])]))

// Dragging a slider fires continuously; without coalescing, one drag would cost
// hundreds of undo steps. Edits to the same field inside this window collapse
// into the single step that precedes the whole drag.
const COALESCE_MS = 700
let lastEditKey = null
let lastEditAt = 0

function historyPatch(s, key) {
  const now = Date.now()
  const sameEdit = key !== null && key === lastEditKey && now - lastEditAt < COALESCE_MS
  lastEditKey = key
  lastEditAt = now
  if (sameEdit) return {}
  return { past: [...s.past, snapshot(s)].slice(-60), future: [] }
}

export const useStudio = create((set, get) => ({
  ...clone(defaults),

  deviceId: 'macbook',
  locationId: 'studio',

  // Reshape the device display to the footage's aspect ratio. With this on the
  // recording fills the screen exactly — no crop and no letterbox bars. Kept
  // out of the animated groups so presets can never clobber it.
  adaptScreen: true,
  setAdaptScreen: (adaptScreen) => set((s) => ({ ...historyPatch(s, null), adaptScreen })),
  setDevice: (deviceId) => set((s) => ({ ...historyPatch(s, null), deviceId })),

  // Play the recording live on the device while composing, instead of showing
  // the single frame under the playhead. Not part of the document: it only
  // affects the preview, never the export.
  autoplay: true,
  setAutoplay: (autoplay) => set({ autoplay }),

  // The user's own backdrop image. Like the screen source, the element itself
  // is far too large for a project file, so only the mode is saved and the
  // image is re-attached on open.
  backdrop: null, // { el, url, name }
  setBackdrop: (backdrop) => set({ backdrop }),

  // ---- screen source: a recording or a screenshot ----
  source: null, // { kind, el, url, name, duration, width, height }
  setSource: (source) => set({ source }),

  // When true the viewport shows the values in this store ("live" pose). Touching
  // any control switches it on; scrubbing or playing hands control back to the
  // timeline so the keyframed animation is what you see.
  previewLive: true,

  // ---- generic group update ----
  update: (group, patch) =>
    set((s) => ({
      ...historyPatch(s, `${group}.${Object.keys(patch).join(',')}`),
      [group]: { ...s[group], ...patch },
      previewLive: true,
    })),
  setAxis: (group, key, index, value) =>
    set((s) => {
      const next = [...s[group][key]]
      next[index] = value
      return {
        ...historyPatch(s, `${group}.${key}.${index}`),
        [group]: { ...s[group], [key]: next },
        previewLive: true,
      }
    }),
  /**
   * Height off the surface. The camera rises with the device, otherwise
   * floating it just walks the subject out of the top of the frame. Both moves
   * land in one update so a drag stays a single undo step.
   */
  setFloat: (y) =>
    set((s) => {
      const delta = y - s.device.position[1]
      if (!delta) return {}
      return {
        ...historyPatch(s, 'device.float'),
        device: { ...s.device, position: [s.device.position[0], y, s.device.position[2]] },
        camera: {
          ...s.camera,
          position: [s.camera.position[0], s.camera.position[1] + delta, s.camera.position[2]],
          target: [s.camera.target[0], s.camera.target[1] + delta, s.camera.target[2]],
        },
        previewLive: true,
      }
    }),
  resetGroup: (group) => set((s) => ({ ...historyPatch(s, null), [group]: clone(defaults[group]) })),
  resetAll: () => set((s) => ({ ...historyPatch(s, null), ...clone(defaults) })),

  // ---- panel layout ----
  // Pure UI, so deliberately outside DOC_KEYS: collapsing a panel is not an
  // edit and has no business in undo or in a saved project.
  panels: { left: true, right: true },
  togglePanel: (side) => set((s) => ({ panels: { ...s.panels, [side]: !s.panels[side] } })),
  toggleBothPanels: () =>
    set((s) => {
      const open = !(s.panels.left && s.panels.right)
      return { panels: { left: open, right: open } }
    }),

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
      const hist = historyPatch(s, null)
      const t = Math.min(s.duration, Math.max(0, time ?? s.playhead))
      const state = Object.fromEntries(ANIMATED_GROUPS.map((g) => [g, clone(s[g])]))
      const rest = s.keyframes.filter((k) => Math.abs(k.time - t) > 1e-3)
      const next = [...rest, { id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, time: t, state }]
      next.sort((a, b) => a.time - b.time)
      return { ...hist, keyframes: next }
    }),
  removeKeyframe: (id) =>
    set((s) => ({ ...historyPatch(s, null), keyframes: s.keyframes.filter((k) => k.id !== id) })),
  clearKeyframes: () => set((s) => ({ ...historyPatch(s, null), keyframes: [] })),
  applyKeyframe: (id) =>
    set((s) => {
      const kf = s.keyframes.find((k) => k.id === id)
      if (!kf) return {}
      return { ...clone(kf.state), playhead: kf.time, previewLive: true }
    }),

  // ---- live recording ----
  // Capture a performance instead of placing keyframes by hand: everything you
  // touch while this runs is sampled, then reduced to a keyframe track.
  // `samples` is mutated in place by the render loop rather than going through
  // setState, which would re-render the whole editor 30 times a second.
  recording: null, // { startedAt, samples: [] }
  startRecording: () =>
    set((s) => ({
      ...historyPatch(s, null),
      recording: { startedAt: performance.now(), samples: [] },
      keyframes: [],
      playhead: 0,
      isPlaying: false,
      previewLive: true,
    })),
  stopRecording: () => {
    const rec = get().recording
    if (!rec) return 0
    const samples = rec.samples
    const length = samples.length ? samples[samples.length - 1].time : 0
    if (samples.length < 2) {
      set({ recording: null })
      return 0
    }
    const keyframes = samplesToKeyframes(samples)
    set({
      recording: null,
      keyframes,
      duration: Math.max(0.5, +length.toFixed(2)),
      playhead: 0,
      previewLive: false,
    })
    return keyframes.length
  },

  // ---- export ----
  exporting: null, // { progress, phase } | null
  setExporting: (exporting) => set({ exporting }),

  // ---- undo / redo ----
  // Only the document is versioned; the loaded media, playhead and transient
  // export state are not, so undo never yanks the source out from under you.
  past: [],
  future: [],
  commit: () =>
    set((s) => ({
      past: [...s.past, snapshot(s)].slice(-60),
      future: [],
    })),
  undo: () =>
    set((s) => {
      if (!s.past.length) return {}
      const prev = s.past[s.past.length - 1]
      return { ...clone(prev), past: s.past.slice(0, -1), future: [snapshot(s), ...s.future].slice(0, 60) }
    }),
  redo: () =>
    set((s) => {
      if (!s.future.length) return {}
      const next = s.future[0]
      return { ...clone(next), past: [...s.past, snapshot(s)].slice(-60), future: s.future.slice(1) }
    }),

  // ---- project ----
  toProject: () => ({ version: 1, app: 'mockup-studio', ...snapshot(get()), sourceName: get().source?.name ?? null }),
  loadProject: (data) => {
    if (!data || data.app !== 'mockup-studio') throw new Error('Not a Mockup Studio project file.')
    const next = {}
    for (const k of DOC_KEYS) if (data[k] !== undefined) next[k] = clone(data[k])
    set({ ...next, past: [], future: [], playhead: 0, isPlaying: false, previewLive: true })
  },

  getAnimatedSnapshot: () => {
    const s = get()
    return Object.fromEntries(ANIMATED_GROUPS.map((g) => [g, clone(s[g])]))
  },
}))

export { defaults }
