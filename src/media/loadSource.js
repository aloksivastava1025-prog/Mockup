/**
 * Screen sources: a screen recording, or a still screenshot.
 *
 * Both resolve to the same shape so the compositor, timeline and exporter never
 * branch on media type beyond seeking. A tall full-page screenshot is scrolled
 * through over the timeline rather than squashed onto the display.
 */

const VIDEO_RE = /^video\//
const IMAGE_RE = /^image\//

export function isSupported(file) {
  return VIDEO_RE.test(file.type) || IMAGE_RE.test(file.type)
}

function loadVideo(file, url) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video')
    el.src = url
    el.muted = true
    el.loop = true
    el.playsInline = true
    el.preload = 'auto'
    el.crossOrigin = 'anonymous'
    // Resolve once a frame is actually decoded rather than at metadata: it
    // avoids an opening seek, which otherwise delays the first play by the
    // length of that seek plus the buffering it forces.
    el.onloadeddata = () => {
      resolve({
        kind: 'video',
        el,
        url,
        name: file.name,
        duration: el.duration,
        width: el.videoWidth,
        height: el.videoHeight,
      })
    }
    el.onerror = () => reject(new Error(`Could not decode "${file.name}". Try an MP4 (H.264) or WebM.`))
  })
}

function loadImage(file, url) {
  return new Promise((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () =>
      resolve({
        kind: 'image',
        el,
        url,
        name: file.name,
        duration: null,
        width: el.naturalWidth,
        height: el.naturalHeight,
      })
    el.onerror = () => reject(new Error(`Could not read "${file.name}". Try a PNG, JPG or WebP.`))
    el.src = url
  })
}

export function loadSource(file) {
  const url = URL.createObjectURL(file)
  if (IMAGE_RE.test(file.type)) return loadImage(file, url)
  if (VIDEO_RE.test(file.type)) return loadVideo(file, url)
  URL.revokeObjectURL(url)
  return Promise.reject(new Error('Unsupported file. Drop a video or an image.'))
}

/**
 * A screenshot much taller than the device display should scroll rather than
 * reshape it — nobody wants a laptop stretched to a 1:4 page grab.
 */
export const SCROLLS = (source, screenAspect) =>
  !!source && source.height / source.width > 1 / screenAspect * 1.15
