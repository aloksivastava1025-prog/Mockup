import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import * as THREE from 'three'
import { studioApi } from '../scene/studioApi.js'
import { useStudio } from '../store/useStudio.js'

/**
 * Output framings. Social formats matter as much as 16:9 here — a mockup that
 * cannot be posted as a Reel or an Instagram feed image is half a tool.
 */
export const ASPECTS = {
  '16:9': { label: 'Landscape', sizes: { S: [1280, 720], M: [1920, 1080], L: [2560, 1440] } },
  '9:16': { label: 'Story', sizes: { S: [720, 1280], M: [1080, 1920], L: [1440, 2560] } },
  '1:1': { label: 'Square', sizes: { S: [720, 720], M: [1080, 1080], L: [1440, 1440] } },
  '4:5': { label: 'Portrait', sizes: { S: [864, 1080], M: [1080, 1350], L: [1440, 1800] } },
}

export const SIZE_LABELS = { S: 'Small', M: 'Medium', L: 'Large' }

export const aspectRatio = (key) => {
  const [w, h] = (ASPECTS[key] ?? ASPECTS['16:9']).sizes.M
  return w / h
}

const even = (n) => (n % 2 === 0 ? n : n - 1)

export function dimensionsFor(aspect = '16:9', size = 'M', draft = false) {
  const table = (ASPECTS[aspect] ?? ASPECTS['16:9']).sizes
  const [w, h] = table[size] ?? table.M
  // Draft renders at the smallest tier of the same shape, so framing matches.
  const [dw, dh] = draft ? table.S : [w, h]
  return [even(dw), even(dh)]
}

function seek(video, time) {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.001) return resolve()
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

const supportsWebCodecs = () => typeof window !== 'undefined' && 'VideoEncoder' in window

/**
 * Whether this browser can produce a real MP4.
 *
 * Without WebCodecs the export falls back to recording the canvas in real time
 * as WebM, which is slower, not frame-accurate and not what most people can
 * drop into an editor. Worth saying before someone waits out a render, not
 * after.
 */
export const canEncodeMp4 = () => supportsWebCodecs()

/**
 * The AVC level has to match the frame size.
 *
 * `avc1.640028` is High@L4.0, which tops out at 8192 macroblocks: 1920x1080
 * fits with 32 to spare, 2560x1440 does not. Configure it anyway and the
 * encoder does not refuse up front — it errors asynchronously and every
 * subsequent encode() throws on a closed codec, so the whole Large export
 * dies a few frames in. Walk up the levels and take the first this browser
 * will actually configure.
 */
const AVC_CODECS = ['avc1.640028', 'avc1.640032', 'avc1.640033', 'avc1.640034']

async function pickAvcCodec(config) {
  for (const codec of AVC_CODECS) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({ ...config, codec })
      if (supported) return codec
    } catch {
      // Malformed for this browser; try the next level up.
    }
  }
  return null
}

/** Swaps the renderer to an offscreen size and restores it afterwards. */
function withRenderSize(width, height, fn) {
  const { gl, camera, canvas } = studioApi
  const prevW = canvas.width
  const prevH = canvas.height
  const prevRatio = gl.getPixelRatio()
  const prevAspect = camera.aspect

  gl.setPixelRatio(1)
  gl.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()

  const restore = () => {
    gl.setPixelRatio(prevRatio)
    gl.setSize(prevW / prevRatio, prevH / prevRatio, false)
    camera.aspect = prevAspect
    camera.updateProjectionMatrix()
  }
  return fn(restore)
}

/** Moves the recording to `time`. A seek costs a decode, so call it sparingly. */
async function seekSourceTo(time) {
  const source = useStudio.getState().source
  if (source?.kind === 'video' && source.el.duration) {
    await seek(source.el, time % source.el.duration)
    studioApi.markScreenDirty?.()
  }
}

const _focus = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()

/**
 * Poses the scene for `time` and draws it into the current buffer.
 *
 * `lens` offsets the camera across its own aperture. A pinhole renders
 * everything sharp at every distance, which is the other half of why output
 * reads as a render rather than a photograph. Shifting the entrance pupil and
 * re-aiming at the focus point leaves whatever sits at that distance exactly
 * where it was — so it stays sharp — while everything nearer or further moves
 * between samples and averages into a circle of confusion. That is what a lens
 * does, and it costs nothing beyond the samples the shutter already needs.
 *
 * The focus point is the camera's own target, so focus follows the shot
 * without a second control to keep in sync.
 */
function renderPoseAt(time, animated, lens = null) {
  const { scene, gl, camera, applyAt } = studioApi
  const eff = applyAt(time, { animated, driveCamera: true })
  if (lens && (lens.x || lens.y)) {
    _focus.set(...eff.camera.target)
    camera.updateMatrixWorld()
    _right.setFromMatrixColumn(camera.matrixWorld, 0)
    _up.setFromMatrixColumn(camera.matrixWorld, 1)
    camera.position.addScaledVector(_right, lens.x).addScaledVector(_up, lens.y)
    camera.lookAt(_focus)
    camera.updateMatrixWorld()
  }
  scene.updateMatrixWorld(true)
  gl.render(scene, camera)
}

/**
 * Sample positions on the aperture disc, by the golden angle.
 *
 * A random scatter clumps at the counts used here and the clumps show as
 * streaks in the bokeh; the sunflower spiral spreads any number of points
 * evenly, so eight samples give a round highlight rather than a lumpy one.
 */
function aperturePoints(n, radius) {
  const GOLDEN = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: n }, (_, i) => {
    const r = radius * Math.sqrt((i + 0.5) / n)
    const a = i * GOLDEN
    return { x: r * Math.cos(a), y: r * Math.sin(a) }
  })
}

/** Renders the frame at `time` into the current drawing buffer. */
async function drawFrameAt(time, animated) {
  await seekSourceTo(time)
  renderPoseAt(time, animated)
}

/**
 * Shutter accumulation — motion blur.
 *
 * A plain render is a stack of infinitely sharp instants. At speed the subject
 * crosses a visible distance between two of them and the result reads as
 * stop-motion rather than as something filmed; it is the single biggest reason
 * a fast move here looks wrong. A real shutter is open for a slice of each
 * frame and integrates everything that happens while it is, so this samples
 * the pose several times across that slice and averages them.
 *
 * `shutter` is in degrees, the way a camera is marked: 180 is the film
 * standard and means open for half the frame interval. The slice is centred on
 * the frame time rather than starting at it, so the blur does not drag the
 * subject half a frame ahead of where the timeline says it is.
 *
 * Only the 3D pose is re-sampled. The recording on the display is seeked once
 * per output frame, because a video seek costs a decode — eight per frame
 * would multiply an already slow render again, for motion that the source
 * footage has blurred for us already.
 *
 * Accumulation runs on a 2D canvas with 'lighter' and 1/N alpha rather than
 * reading pixels back, which keeps it on the GPU. The cost is that each
 * sample is quantised to 8 bits before it is summed, so the average can be off
 * by up to N/2 of 255 — invisible at the sample counts offered here, and worth
 * it against eight full-frame readbacks.
 */
function makeAccumulator(width, height, { alpha = false } = {}) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d', { alpha, willReadFrequently: false })
  return {
    canvas: c,
    begin(samples) {
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      // 'lighter' adds premultiplied RGBA, so starting from transparent black
      // averages the alpha channel along with the colour — which is what a
      // cutout needs. An opaque accumulator starts from black instead.
      if (alpha) ctx.clearRect(0, 0, width, height)
      else {
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, width, height)
      }
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 1 / samples
    },
    add(source) {
      ctx.drawImage(source, 0, 0, width, height)
    },
    end() {
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    },
  }
}

/**
 * Still export. Renders the current playhead at full resolution and hands back
 * a PNG — the common case for a hero image, and far cheaper than rendering a
 * whole clip just to pull one frame out of it.
 */
export async function exportImage({ aspect = '16:9', size = 'M', transparent = false, depth = 0 } = {}) {
  const { gl, applyAt, canvas, scene } = studioApi
  if (!gl || !applyAt) throw new Error('Scene is not ready yet.')

  const [width, height] = dimensionsFor(aspect, size)
  const state = useStudio.getState()
  const prevBackground = scene.background

  useStudio.getState().setExporting({ phase: 'rendering', progress: 0 })
  studioApi.setSharpTexture?.(true)

  // A cutout drops the backdrop and the floor, leaving the device (and its
  // contact shadow, which composites nicely) on transparency.
  const hidden = []
  if (transparent) {
    scene.background = null
    scene.traverse((o) => {
      if (o.userData?.ground && o.visible) {
        o.visible = false
        hidden.push(o)
      }
    })
  }

  try {
    const blob = await withRenderSize(width, height, async (restore) => {
      const animated = state.keyframes.length >= 2 && !state.previewLive
      const t = state.playhead
      let surface = canvas
      if (depth > 0) {
        // A still has no shutter to sample, so every sample here is a
        // different point on the aperture and nothing else changes.
        const SAMPLES = 16 // a still is rendered once; spend more on smoother bokeh
        const lens = aperturePoints(SAMPLES, depth * 0.04)
        const accum = makeAccumulator(width, height, { alpha: transparent })
        await seekSourceTo(t)
        accum.begin(SAMPLES)
        for (let k = 0; k < SAMPLES; k++) {
          renderPoseAt(t, animated, lens[k])
          accum.add(canvas)
        }
        accum.end()
        surface = accum.canvas
      } else {
        await drawFrameAt(t, animated)
      }
      const out = await new Promise((res) => surface.toBlob(res, 'image/png'))
      restore()
      return out
    })
    return { blob, filename: `mockup-${Date.now()}.png`, width, height }
  } finally {
    scene.background = prevBackground
    hidden.forEach((o) => (o.visible = true))
    studioApi.setSharpTexture?.(true)
    useStudio.getState().setExporting(null)
  }
}

/**
 * Renders the timeline frame by frame and muxes it into an MP4.
 * Falls back to a real-time MediaRecorder WebM capture when WebCodecs is absent.
 */
export async function exportVideo({
  fps = 30,
  aspect = '16:9',
  size = 'M',
  bitrateMbps = 14,
  draft = false,
  blurSamples = 1,
  shutter = 180,
  depth = 0,
  onProgress,
} = {}) {
  const { gl, camera, scene, canvas, applyAt, setSharpTexture } = studioApi
  if (!gl || !applyAt) throw new Error('Scene is not ready yet.')

  const state = useStudio.getState()
  const source = state.source
  const duration = state.duration
  const effFps = draft ? Math.min(fps, 24) : fps
  const totalFrames = Math.max(1, Math.round(duration * effFps))
  const [width, height] = dimensionsFor(aspect, size, draft)
  const bitrate = Math.round((draft ? 5 : bitrateMbps) * 1_000_000)

  const wasPlaying = state.isPlaying
  const prevPlayhead = state.playhead

  useStudio.getState().setPlaying(false)
  useStudio.getState().setExporting({ phase: 'preparing', progress: 0 })
  if (source?.kind === 'video') source.el.pause()
  // Mipmapping is off in the preview for speed; a real render turns it on.
  setSharpTexture?.(!draft)

  return withRenderSize(width, height, async (restoreSize) => {
    const restore = () => {
      restoreSize()
      setSharpTexture?.(true) // mipmaps are the preview's normal state too
      useStudio.getState().setExporting(null)
      useStudio.getState().setPlayhead(prevPlayhead)
      if (wasPlaying) useStudio.getState().setPlaying(true)
    }

    const animated = state.keyframes.length >= 2
    // Both effects are built out of the same accumulation, so they share the
    // sample budget. Motion blur needs an animation to blur; depth of field
    // does not, and asks for samples of its own when it is the only one on.
    // A draft is for checking timing, so neither runs in one.
    const wantBlur = !draft && animated && blurSamples > 1
    const wantDepth = !draft && depth > 0
    const samples = draft ? 1 : Math.max(wantBlur ? Math.round(blurSamples) : 1, wantDepth ? 8 : 1)
    const shutterSeconds = wantBlur ? (shutter / 360) / effFps : 0
    // The widest pupil worth offering: a laptop is 0.34 across, so 40mm of
    // aperture already throws the far end of a family shot well out of focus.
    const lens = wantDepth ? aperturePoints(samples, depth * 0.04) : null
    const accum = samples > 1 ? makeAccumulator(width, height) : null

    /** Renders output frame `i` and returns the surface holding it. */
    const drawFrame = async (i) => {
      const t = i / effFps
      if (!accum) {
        await drawFrameAt(t, animated)
        return canvas
      }
      await seekSourceTo(t)
      accum.begin(samples)
      for (let k = 0; k < samples; k++) {
        renderPoseAt(
          t + ((k + 0.5) / samples - 0.5) * shutterSeconds,
          animated,
          lens ? lens[k] : null,
        )
        accum.add(canvas)
      }
      accum.end()
      return accum.canvas
    }

    try {
      if (!supportsWebCodecs()) {
        // The fallback records the live WebGL canvas as a stream, so there is
        // nowhere to hand an accumulated frame; it always captures unblurred.
        const blob = await realtimeCapture({ fps: effFps, drawFrame: (i) => drawFrameAt(i / effFps, animated), totalFrames, onProgress })
        restore()
        return { blob, filename: `mockup-${Date.now()}.webm`, mode: 'realtime-webm' }
      }

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'avc', width, height },
        fastStart: 'in-memory',
      })

      const base = { width, height, bitrate, framerate: effFps }
      const codec = await pickAvcCodec(base)
      if (!codec) throw new Error(`This browser cannot encode H.264 at ${width}x${height}. Try a smaller size.`)

      // The encoder reports failures asynchronously. Hold the first one and
      // raise it from the loop, so the export fails with the real reason
      // rather than with "cannot call encode on a closed codec".
      let encoderError = null
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
          encoderError = encoderError ?? e
        },
      })
      encoder.configure({ ...base, codec })

      const frameDuration = 1_000_000 / effFps
      for (let i = 0; i < totalFrames; i++) {
        if (encoderError) throw encoderError
        const surface = await drawFrame(i)

        const frame = new VideoFrame(surface, {
          timestamp: Math.round(i * frameDuration),
          duration: Math.round(frameDuration),
        })
        try {
          encoder.encode(frame, { keyFrame: i % (effFps * 2) === 0 })
        } finally {
          frame.close()
        }

        // Keep the encoder queue shallow so memory stays flat on long timelines.
        while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 4))

        const progress = (i + 1) / totalFrames
        useStudio.getState().setExporting({ phase: draft ? 'draft' : 'rendering', progress })
        onProgress?.(progress)
      }

      useStudio.getState().setExporting({ phase: 'encoding', progress: 1 })
      await encoder.flush()
      encoder.close()
      muxer.finalize()

      const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' })
      restore()
      return { blob, filename: `mockup-${Date.now()}.mp4`, mode: 'webcodecs-mp4' }
    } catch (err) {
      restore()
      throw err
    }
  })
}

/** Fallback: play the timeline in real time and record the canvas stream. */
async function realtimeCapture({ fps, drawFrame, totalFrames, onProgress }) {
  const { canvas } = studioApi
  const stream = canvas.captureStream(fps)
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 })
  const chunks = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const stopped = new Promise((res) => (recorder.onstop = res))
  recorder.start()

  const frameMs = 1000 / fps
  const started = performance.now()
  for (let i = 0; i < totalFrames; i++) {
    await drawFrame(i)
    const progress = (i + 1) / totalFrames
    useStudio.getState().setExporting({ phase: 'recording', progress })
    onProgress?.(progress)
    const due = started + (i + 1) * frameMs
    const wait = due - performance.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  }

  recorder.stop()
  await stopped
  return new Blob(chunks, { type: 'video/webm' })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
