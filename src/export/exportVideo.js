import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { studioApi } from '../scene/studioApi.js'
import { useStudio } from '../store/useStudio.js'

export const RESOLUTIONS = {
  '720p': [1280, 720],
  '1080p': [1920, 1080],
  '1440p': [2560, 1440],
}

const even = (n) => (n % 2 === 0 ? n : n - 1)

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
 * Renders the timeline frame by frame and muxes it into an MP4.
 * Falls back to a real-time MediaRecorder WebM capture when WebCodecs is absent.
 */
export async function exportVideo({ fps = 30, resolution = '1080p', bitrateMbps = 16, onProgress } = {}) {
  const { gl, camera, scene, canvas, applyAt, markScreenDirty } = studioApi
  if (!gl || !applyAt) throw new Error('Scene is not ready yet.')

  const state = useStudio.getState()
  const videoEl = state.video?.el ?? null
  const duration = state.duration
  const totalFrames = Math.max(1, Math.round(duration * fps))

  const [targetW, targetH] = RESOLUTIONS[resolution] ?? RESOLUTIONS['1080p']
  const width = even(targetW)
  const height = even(targetH)

  // Remember viewport settings so the editor looks unchanged afterwards.
  const prevSize = { width: canvas.width, height: canvas.height }
  const prevPixelRatio = gl.getPixelRatio()
  const prevAspect = camera.aspect
  const wasPlaying = state.isPlaying
  const prevPlayhead = state.playhead

  useStudio.getState().setPlaying(false)
  useStudio.getState().setExporting({ phase: 'preparing', progress: 0 })

  if (videoEl) videoEl.pause()
  gl.setPixelRatio(1)
  gl.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()

  const restore = () => {
    gl.setPixelRatio(prevPixelRatio)
    gl.setSize(prevSize.width / prevPixelRatio, prevSize.height / prevPixelRatio, false)
    camera.aspect = prevAspect
    camera.updateProjectionMatrix()
    useStudio.getState().setExporting(null)
    useStudio.getState().setPlayhead(prevPlayhead)
    if (wasPlaying) useStudio.getState().setPlaying(true)
  }

  const drawFrame = async (frameIndex) => {
    const t = frameIndex / fps
    if (videoEl && videoEl.duration) {
      await seek(videoEl, t % videoEl.duration)
      markScreenDirty?.()
    }
    applyAt(t, { animated: state.keyframes.length >= 2, driveCamera: true })
    scene.updateMatrixWorld(true)
    gl.render(scene, camera)
  }

  try {
    if (!supportsWebCodecs()) {
      const blob = await realtimeCapture({ fps, duration, drawFrame, totalFrames, onProgress })
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
    encoder.configure({
      codec: 'avc1.640028',
      width,
      height,
      bitrate: Math.round(bitrateMbps * 1_000_000),
      framerate: fps,
    })

    const frameDuration = 1_000_000 / fps
    for (let i = 0; i < totalFrames; i++) {
      await drawFrame(i)

      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(i * frameDuration),
        duration: Math.round(frameDuration),
      })
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
      frame.close()

      // Keep the encoder queue shallow so memory stays flat on long timelines.
      while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 4))

      const progress = (i + 1) / totalFrames
      useStudio.getState().setExporting({ phase: 'rendering', progress })
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
}

/** Fallback: play the timeline in real time and record the canvas stream. */
async function realtimeCapture({ fps, duration, drawFrame, totalFrames, onProgress }) {
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
