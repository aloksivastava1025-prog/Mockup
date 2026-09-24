import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
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

/** Renders the frame at `time` into the current drawing buffer. */
async function drawFrameAt(time, animated) {
  const { scene, gl, camera, applyAt, markScreenDirty } = studioApi
  const source = useStudio.getState().source
  if (source?.kind === 'video' && source.el.duration) {
    await seek(source.el, time % source.el.duration)
    markScreenDirty?.()
  }
  applyAt(time, { animated, driveCamera: true })
  scene.updateMatrixWorld(true)
  gl.render(scene, camera)
}

/**
 * Still export. Renders the current playhead at full resolution and hands back
 * a PNG — the common case for a hero image, and far cheaper than rendering a
 * whole clip just to pull one frame out of it.
 */
export async function exportImage({ aspect = '16:9', size = 'M', transparent = false } = {}) {
  const { gl, applyAt, canvas, scene } = studioApi
  if (!gl || !applyAt) throw new Error('Scene is not ready yet.')

  const [width, height] = dimensionsFor(aspect, size)
  const state = useStudio.getState()
  const prevBackground = scene.background

  useStudio.getState().setExporting({ phase: 'rendering', progress: 0 })
  studioApi.setFastTexture?.(false)

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
      await drawFrameAt(state.playhead, state.keyframes.length >= 2 && !state.previewLive)
      const out = await new Promise((res) => canvas.toBlob(res, 'image/png'))
      restore()
      return out
    })
    return { blob, filename: `mockup-${Date.now()}.png`, width, height }
  } finally {
    scene.background = prevBackground
    hidden.forEach((o) => (o.visible = true))
    studioApi.setFastTexture?.(true)
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
  onProgress,
} = {}) {
  const { gl, camera, scene, canvas, applyAt, setFastTexture } = studioApi
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
  // Mipmapping is off in the preview for speed; a final render turns it on.
  setFastTexture?.(draft)

  return withRenderSize(width, height, async (restoreSize) => {
    const restore = () => {
      restoreSize()
      setFastTexture?.(true) // back to the fast preview path
      useStudio.getState().setExporting(null)
      useStudio.getState().setPlayhead(prevPlayhead)
      if (wasPlaying) useStudio.getState().setPlaying(true)
    }

    const animated = state.keyframes.length >= 2
    const drawFrame = (i) => drawFrameAt(i / effFps, animated)

    try {
      if (!supportsWebCodecs()) {
        const blob = await realtimeCapture({ fps: effFps, drawFrame, totalFrames, onProgress })
        restore()
        return { blob, filename: `mockup-${Date.now()}.webm`, mode: 'realtime-webm' }
      }

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'avc', width, height },
        fastStart: 'in-memory',
      })

      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error('[export] encoder error', e),
      })
      encoder.configure({ codec: 'avc1.640028', width, height, bitrate, framerate: effFps })

      const frameDuration = 1_000_000 / effFps
      for (let i = 0; i < totalFrames; i++) {
        await drawFrame(i)

        const frame = new VideoFrame(canvas, {
          timestamp: Math.round(i * frameDuration),
          duration: Math.round(frameDuration),
        })
        encoder.encode(frame, { keyFrame: i % (effFps * 2) === 0 })
        frame.close()

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
