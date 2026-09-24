import * as THREE from 'three'

/**
 * The display texture is composited on a 2D canvas rather than fitted with UV
 * offsets on the video texture directly.
 *
 * UV fitting can only ever crop (`cover`); asking it to letterbox pushes the
 * coordinates outside [0,1], where clamping smears the outermost row of pixels
 * across the bars. Compositing lets `contain` draw real letterbox bars, so a
 * recording that is wider than the device screen is shown whole.
 */
export function createScreenCompositor(videoEl, screenAspect) {
  const canvas = document.createElement('canvas')
  const vw = videoEl.videoWidth || 1920
  const width = Math.round(Math.min(2560, Math.max(1280, vw)))
  canvas.width = width
  canvas.height = Math.round(width / screenAspect)

  const ctx = canvas.getContext('2d', { alpha: false })
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false

  let last = null

  const draw = (screen) => {
    last = screen
    const W = canvas.width
    const H = canvas.height

    ctx.fillStyle = screen.letterbox ?? '#000000'
    ctx.fillRect(0, 0, W, H)

    const sw = videoEl.videoWidth
    const sh = videoEl.videoHeight
    if (!sw || !sh || videoEl.readyState < 2) return

    const videoAspect = sw / sh
    const canvasAspect = W / H

    let dw
    let dh
    if (screen.fit === 'stretch') {
      dw = W
      dh = H
    } else if (screen.fit === 'cover') {
      if (videoAspect > canvasAspect) {
        dh = H
        dw = H * videoAspect
      } else {
        dw = W
        dh = W / videoAspect
      }
    } else {
      // contain — the whole frame is visible, bars fill the remainder
      if (videoAspect > canvasAspect) {
        dw = W
        dh = W / videoAspect
      } else {
        dh = H
        dw = H * videoAspect
      }
    }

    const s = Math.max(0.05, screen.scale ?? 1)
    dw *= s
    dh *= s

    const dx = (W - dw) / 2 + (screen.offsetX ?? 0) * W
    const dy = (H - dh) / 2 - (screen.offsetY ?? 0) * H

    try {
      ctx.drawImage(videoEl, dx, dy, dw, dh)
    } catch {
      // a frame can be momentarily undecodable mid-seek; the next draw recovers
    }
    texture.needsUpdate = true
  }

  return {
    texture,
    draw,
    redraw: () => last && draw(last),
    dispose: () => texture.dispose(),
  }
}
