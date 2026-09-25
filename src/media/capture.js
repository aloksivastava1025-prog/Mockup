/**
 * Recording a website straight from the browser, for people who do not already
 * have footage.
 *
 * Pasting a URL and rendering the live site inside this page is not possible,
 * and it is worth being plain about why rather than half-building it: almost
 * every site sends X-Frame-Options or frame-ancestors and simply refuses to
 * load in an iframe, and even the ones that load cannot be drawn to a canvas —
 * a cross-origin frame has no pixels the host page is allowed to read. That is
 * a deliberate part of the web's security model, not a gap to work around.
 *
 * What does work, with no server and no extension, is the screen-capture API:
 * the user picks a tab and the browser hands us its pixels. So the URL field
 * opens the site, and the picker points us at it.
 *
 * The capture is recorded to a file rather than used as a live stream. A live
 * MediaStream has no duration and cannot be seeked, and the exporter seeks to
 * every frame — pointed at a stream it would hang on the first one. Recording
 * first turns it into an ordinary clip that scrubs and exports like any other.
 */

export const canCaptureTab = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia

/** MP4 if the browser will write it, since that is what the rest of the app prefers. */
function pickMime() {
  const wanted = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
  for (const m of wanted) if (MediaRecorder.isTypeSupported(m)) return m
  return ''
}

/**
 * Opens `url` in a tab of its own so there is something to point the picker at.
 * Returns the window handle, which may be null if a popup blocker ate it —
 * worth reporting, because otherwise the picker offers nothing useful.
 */
export function openSite(url) {
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
  return { win: window.open(href, '_blank', 'noopener'), href }
}

/**
 * Records a chosen tab for `seconds` and resolves with a File.
 *
 * `onTick` gets the seconds remaining, so the caller can show a countdown —
 * without one the user has no idea whether anything is happening, and a silent
 * ten second wait reads as a hang.
 */
export async function captureTab({ seconds = 10, onTick } = {}) {
  if (!canCaptureTab()) throw new Error('This browser cannot capture a tab.')

  let stream
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
      // Offer the other tabs first, and keep this one out of the list: picking
      // the studio itself would record the studio recording itself.
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'exclude',
    })
  } catch (e) {
    if (e?.name === 'NotAllowedError') throw new Error('Capture cancelled.')
    throw e
  }

  const track = stream.getVideoTracks()[0]
  const { width = 1280, height = 720 } = track.getSettings?.() ?? {}

  const mime = pickMime()
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 12_000_000 })
  const chunks = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)

  const done = new Promise((resolve) => (rec.onstop = resolve))
  rec.start(200)

  // Stop early if the user ends the share from the browser's own banner.
  let stoppedEarly = false
  track.addEventListener('ended', () => {
    stoppedEarly = true
    if (rec.state !== 'inactive') rec.stop()
  })

  const started = performance.now()
  await new Promise((resolve) => {
    const tick = () => {
      const left = seconds - (performance.now() - started) / 1000
      if (stoppedEarly || left <= 0) return resolve()
      onTick?.(Math.ceil(left))
      setTimeout(tick, 200)
    }
    tick()
  })

  if (rec.state !== 'inactive') rec.stop()
  await done
  stream.getTracks().forEach((t) => t.stop())

  if (!chunks.length) throw new Error('Nothing was recorded. Try again and pick a tab.')
  const type = mime || 'video/webm'
  const ext = type.includes('mp4') ? 'mp4' : 'webm'
  const blob = new Blob(chunks, { type })
  return Object.assign(new File([blob], `capture.${ext}`, { type }), { captureWidth: width, captureHeight: height })
}
