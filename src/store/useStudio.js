import { create } from 'zustand'
import { samplesToKeyframes } from '../anim/record.js'
import { DEFAULT_DEVICE, DEVICE_LIST, DEVICES } from '../devices/index.js'
import stickerCat from '../assets/sticker-cat.jpg'
import { blankSlot, defaultFloorSlots } from '../scene/floorSlots.js'

// Re-exported so existing callers keep one import; the list itself lives in
// anim/groups.js, away from anything that pulls in React.
export { ANIMATED_GROUPS } from '../anim/groups.js'

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
    // Distance haze, set by a location that needs it. See useFog in Studio.jsx.
    fog: null,
  },
  /**
   * Extra devices standing alongside the main one, for a family shot.
   *
   * Posed by hand and never animated. The timeline drives exactly one device,
   * and widening it to a list would mean every keyframe, every preset and
   * every saved project carried a variable-length pose array — for a shot
   * whose whole point is that the group stands still while the camera moves
   * around it. The hero in the middle carries whatever animation there is.
   *
   * Shape: [{ id, deviceId, position:[x,y,z], rotation:[x,y,z], lidAngle, scale }]
   *
   * These live in defaults rather than being declared on their own so that
   * Reset All clears the scene back to a single device.
   */
  companions: [],
  /** Clear space between neighbouring devices in the row, in world units. */
  spacing: 0.05,
  /**
   * Regions of the screen content worth looking at, in the source's own
   * coordinates: 0..1 across, y from the top. A camera move is generated from
   * them rather than the areas being animated themselves.
   */
  focus: { areas: [], style: 'sequence', seconds: 40 },
  /**
   * Text over the shot. Each title carries its own in-point and duration
   * rather than being keyframed, because a caption is a thing that appears
   * and leaves, not a value that is interpolated.
   */
  titles: [],
  /**
   * Render settings. In the document rather than in the export panel's own
   * state, so a saved project remembers how it was meant to be rendered — and
   * so the director can set them when it builds a film.
   */
  render: { blurSamples: 1, depth: 0 },
  /**
   * Handheld shake, layered over the timeline rather than baked into it, so it
   * survives retiming and can be dialled out without touching a keyframe.
   */
  shake: { amount: 0, speed: 1 },
  /**
   * Sponsor marks shown on the palm rest while composing. Deliberately outside
   * the exported document: they are placement for us, not part of the user's
   * shot, and they never reach a rendered frame.
   */
  /**
   * Optical effects, as a stack you add to rather than a fixed set of
   * sliders — most shots want none of them and the two that do want one each.
   */
  effects: [],
}

/**
 * Unique ids for the things the user adds.
 *
 * Date.now() alone is not one. Adding two focus areas in the same millisecond
 * — which a script does trivially, and a fast double-click does too — gave
 * them the same id, and React then treats two rows as one: React warned about
 * it, and removing either deleted both.
 */
let idSeq = 0
const newId = (prefix) => `${prefix}_${Date.now().toString(36)}_${(idSeq++).toString(36)}`

const clone = (v) => JSON.parse(JSON.stringify(v))

/** How far a device reaches either side of its own origin, in world units. */
const halfWidth = (id) => ((DEVICES[id] ?? DEFAULT_DEVICE).width ?? 0.34) / 2

/**
 * Lay the companions out either side of the hero, nearest first.
 *
 * Each one is placed against the edge of what is already on its side rather
 * than at a fixed step, because the bodies differ by nearly 3x across — a
 * fixed step either drops the 32" display through the laptop or leaves the
 * tablet marooned. `gap` is the clear space between neighbours, so the slider
 * means the same thing whatever devices are in the row.
 *
 * Depth and scale are left alone: those are the user's, and re-running the
 * layout should not throw away a companion they pushed back or shrank.
 */
function arrange(companions, heroId, gap) {
  const edge = { 1: halfWidth(heroId), '-1': halfWidth(heroId) }
  return companions.map((c, i) => {
    const side = i % 2 === 0 ? 1 : -1
    const hw = halfWidth(c.deviceId)
    const x = side * (edge[side] + gap + hw)
    edge[side] += gap + hw * 2
    return {
      ...c,
      position: [+x.toFixed(3), c.position[1], c.position[2]],
      rotation: [c.rotation[0], -20 * side, c.rotation[2]],
    }
  })
}

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
  'companions',
  'spacing',
  'focus',
  'titles',
  'render',
  'shake',
  'effects',
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

  // Not in DOC_KEYS: a saved project should not carry whoever was sponsoring
  // the app on the day it was made.
  sponsors: [
    { id: 'sp1', label: 'Cat', url: 'https://example.com', image: stickerCat },
    { id: 'sp2', label: 'LINEAR', url: 'https://linear.app' },
  ],
  setSponsors: (sponsors) => set({ sponsors }),

  /**
   * The floor grid. Seeded part-filled on purpose: the gaps are the pitch, and
   * a user who has never seen the feature learns what a slot is by seeing one
   * with something in it next to one without.
   */
  floorSlots: defaultFloorSlots().map((sl, i) =>
    i === 0 || i === 1
      ? { ...sl, image: stickerCat, label: 'Cat', url: 'https://example.com' }
      : i === 5
      ? { ...sl, label: 'LINEAR', url: 'https://linear.app' }
      : sl,
  ),
  // Off until asked for. These sit inside the frame the user is composing, and
  // a floor of logos and dashed boxes is the last thing someone judging a
  // camera angle needs to look at.
  slotsVisible: false,
  selectedSlot: null,
  setSlotsVisible: (slotsVisible) => set({ slotsVisible }),
  selectSlot: (selectedSlot) => set({ selectedSlot }),
  updateSlot: (id, patch) =>
    set((s) => ({ floorSlots: s.floorSlots.map((sl) => (sl.id === id ? { ...sl, ...patch } : sl)) })),
  addSlot: () =>
    set((s) => {
      const sl = blankSlot(newId('slot'))
      return { floorSlots: [...s.floorSlots, sl], selectedSlot: sl.id }
    }),
  removeSlot: (id) =>
    set((s) => ({
      floorSlots: s.floorSlots.filter((sl) => sl.id !== id),
      selectedSlot: s.selectedSlot === id ? null : s.selectedSlot,
    })),

  deviceId: 'macbook',
  locationId: 'studio',

  // Reshape the device display to the footage's aspect ratio. With this on the
  // recording fills the screen exactly — no crop and no letterbox bars. Kept
  // out of the animated groups so presets can never clobber it.
  adaptScreen: true,
  setAdaptScreen: (adaptScreen) => set((s) => ({ ...historyPatch(s, null), adaptScreen })),
  // The hero's own width sets where the row starts, so swapping it moves
  // every companion.
  setDevice: (deviceId) =>
    set((s) => ({
      ...historyPatch(s, null),
      deviceId,
      companions: arrange(s.companions, deviceId, s.spacing),
    })),

  setSpacing: (spacing) =>
    set((s) => ({
      ...historyPatch(s, 'scene.spacing'),
      spacing,
      companions: arrange(s.companions, s.deviceId, spacing),
    })),

  addCompanion: (deviceId) =>
    set((s) => {
      const next = [
        ...s.companions,
        {
          id: newId('dev'),
          deviceId,
          position: [0, 0, -0.05],
          rotation: [0, 0, 0],
          lidAngle: 102,
          scale: 1,
        },
      ]
      return { ...historyPatch(s, null), companions: arrange(next, s.deviceId, s.spacing) }
    }),

  /**
   * How many devices stand in the scene, hero included — the control most
   * people actually reach for, rather than adding and removing one at a time.
   * Growing the row picks device types the scene does not already show, so
   * "3" gives a laptop, a tablet and a display instead of three laptops.
   */
  setDeviceCount: (n) =>
    set((s) => {
      const want = Math.max(0, n - 1)
      let list = s.companions.slice(0, want)
      while (list.length < want) {
        const shown = new Set([s.deviceId, ...list.map((c) => c.deviceId)])
        const pick = DEVICE_LIST.find((d) => !shown.has(d.id)) ?? DEVICE_LIST[0]
        list = [
          ...list,
          {
            id: newId('dev'),
            deviceId: pick.id,
            position: [0, 0, -0.05],
            rotation: [0, 0, 0],
            lidAngle: 102,
            scale: 1,
          },
        ]
      }
      return { ...historyPatch(s, null), companions: arrange(list, s.deviceId, s.spacing) }
    }),

  addEffect: (type, initial) =>
    set((s) => ({
      ...historyPatch(s, null),
      effects: [...s.effects, { id: newId('fx'), type, amount: initial, on: true }],
    })),

  updateEffect: (id, patch, key = null) =>
    set((s) => ({
      ...historyPatch(s, key && `fx.${id}.${key}`),
      effects: s.effects.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

  removeEffect: (id) =>
    set((s) => ({ ...historyPatch(s, null), effects: s.effects.filter((e) => e.id !== id) })),

  setShake: (patch, key = null) =>
    set((s) => ({ ...historyPatch(s, key && `shake.${key}`), shake: { ...s.shake, ...patch } })),

  setRender: (patch, key = null) =>
    set((s) => ({ ...historyPatch(s, key && `render.${key}`), render: { ...s.render, ...patch } })),

  addTitle: () =>
    set((s) => ({
      ...historyPatch(s, null),
      titles: [
        ...s.titles,
        {
          id: newId('ttl'),
          text: 'Your headline',
          x: 0.5, y: 0.18, size: 0.075, weight: 600,
          align: 'center', color: '#ffffff', anim: 'rise',
          in: +(s.titles.length * 2).toFixed(1), dur: 3,
        },
      ],
    })),

  updateTitle: (id, patch, key = null) =>
    set((s) => ({
      ...historyPatch(s, key && `title.${id}.${key}`),
      titles: s.titles.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  removeTitle: (id) =>
    set((s) => ({ ...historyPatch(s, null), titles: s.titles.filter((t) => t.id !== id) })),

  addFocusArea: (rect) =>
    set((s) => ({
      ...historyPatch(s, null),
      focus: {
        ...s.focus,
        areas: [...s.focus.areas, { id: newId('fa'), ...rect }],
      },
    })),

  updateFocus: (patch, key = null) =>
    set((s) => ({ ...historyPatch(s, key && `focus.${key}`), focus: { ...s.focus, ...patch } })),

  removeFocusArea: (id) =>
    set((s) => ({
      ...historyPatch(s, null),
      focus: { ...s.focus, areas: s.focus.areas.filter((a) => a.id !== id) },
    })),

  clearFocusAreas: () =>
    set((s) => ({ ...historyPatch(s, null), focus: { ...s.focus, areas: [] } })),

  updateCompanion: (id, patch, key = null) =>
    set((s) => {
      const list = s.companions.map((c) => (c.id === id ? { ...c, ...patch } : c))
      // Swapping a companion for a wider or narrower body invalidates every
      // position beyond it, so the row has to be laid out again.
      const relayout = patch.deviceId !== undefined
      return {
        ...historyPatch(s, key && `companion.${id}.${key}`),
        companions: relayout ? arrange(list, s.deviceId, s.spacing) : list,
      }
    }),

  removeCompanion: (id) =>
    set((s) => ({
      ...historyPatch(s, null),
      companions: arrange(
        s.companions.filter((c) => c.id !== id),
        s.deviceId,
        s.spacing,
      ),
    })),

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
      const next = [...rest, { id: newId('kf'), time: t, state }]
      next.sort((a, b) => a.time - b.time)
      return { ...hist, keyframes: next }
    }),
  /**
   * Retime a keyframe. Coalesced under one history key so a whole drag is one
   * undo step rather than one per pixel, the same way a slider drag is.
   */
  moveKeyframe: (id, time) =>
    set((s) => {
      const t = Math.min(s.duration, Math.max(0, time))
      const next = s.keyframes
        .map((k) => (k.id === id ? { ...k, time: +t.toFixed(3) } : k))
        .sort((a, b) => a.time - b.time)
      return { ...historyPatch(s, `kf.move.${id}`), keyframes: next, playhead: t, previewLive: false }
    }),

  /**
   * Drop a generated camera move onto the timeline at `keys[0].time`.
   *
   * Anything already inside the move's span is replaced rather than merged:
   * two sets of camera keyframes over the same seconds fight each other, and
   * the result is neither move. The timeline grows if the move runs past the
   * end, because silently truncating it is worse than a longer clip.
   */
  addCameraMove: (keys, recipe = null) =>
    set((s) => {
      if (!keys?.length) return {}
      const start = keys[0].time
      const end = keys[keys.length - 1].time
      const kept = s.keyframes.filter((k) => k.time < start - 1e-3 || k.time > end + 1e-3)
      return {
        ...historyPatch(s, null),
        keyframes: [...kept, ...keys].sort((a, b) => a.time - b.time),
        duration: Math.max(s.duration, Math.ceil(end * 2) / 2),
        playhead: start,
        previewLive: false,
        // What the move was made from, so it can be made again with one number
        // changed. Without this the settings are gone the moment the keyframes
        // land, and the only way to adjust a move is to delete it and guess.
        lastMove: recipe ? { ...recipe, keyIds: keys.map((k) => k.id) } : null,
      }
    }),

  /**
   * Rebuild the move that was placed last, in place.
   *
   * Its own keyframes are swapped out by id rather than by time, so a move
   * that got shorter does not leave its old tail sitting on the timeline, and
   * anything the user placed by hand in the meantime is left alone.
   */
  lastMove: null,
  retuneMove: (keys, recipe) =>
    set((s) => {
      if (!keys?.length || !s.lastMove) return {}
      const mine = new Set(s.lastMove.keyIds)
      const kept = s.keyframes.filter((k) => !mine.has(k.id))
      const end = keys[keys.length - 1].time
      return {
        ...historyPatch(s, null),
        keyframes: [...kept, ...keys].sort((a, b) => a.time - b.time),
        duration: Math.max(s.duration, Math.ceil(end * 2) / 2),
        previewLive: false,
        lastMove: { ...recipe, keyIds: keys.map((k) => k.id) },
      }
    }),
  forgetLastMove: () => set({ lastMove: null }),

  /** How the segment leaving this keyframe is timed. */
  setKeyframeEase: (id, ease) =>
    set((s) => ({
      ...historyPatch(s, null),
      keyframes: s.keyframes.map((k) => (k.id === id ? { ...k, ease } : k)),
    })),

  /** Re-record a keyframe from whatever the scene looks like now. */
  restampKeyframe: (id) =>
    set((s) => {
      const state = Object.fromEntries(ANIMATED_GROUPS.map((g) => [g, clone(s[g])]))
      return {
        ...historyPatch(s, null),
        keyframes: s.keyframes.map((k) => (k.id === id ? { ...k, state } : k)),
      }
    }),

  /**
   * Edit the camera recorded in one keyframe.
   *
   * The live camera is moved with it, because the popup only opens after a
   * click on the marker, and that click already put the scene at this pose.
   * Writing to the keyframe alone would mean dragging a slider and watching
   * nothing happen until the playhead came back round.
   */
  setKeyframeCamera: (id, camera) =>
    set((s) => {
      const kf = s.keyframes.find((k) => k.id === id)
      if (!kf) return {}
      const next = { ...kf.state, camera: { ...kf.state.camera, ...camera } }
      return {
        ...historyPatch(s, null),
        keyframes: s.keyframes.map((k) => (k.id === id ? { ...k, state: next } : k)),
        camera: { ...s.camera, ...camera },
        previewLive: true,
      }
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
    // A project saved before companions existed has none. Leaving the key alone
    // would carry whatever is on screen into a file that never had it.
    if (data.companions === undefined) next.companions = []
    set({ ...next, past: [], future: [], playhead: 0, isPlaying: false, previewLive: true })
  },

  getAnimatedSnapshot: () => {
    const s = get()
    return Object.fromEntries(ANIMATED_GROUPS.map((g) => [g, clone(s[g])]))
  },
}))

export { defaults }
