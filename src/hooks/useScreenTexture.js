import * as THREE from 'three'

/**
 * The display texture is composited on a 2D canvas rather than fitted with UV
 * offsets on the source texture directly.
 *
 * UV fitting can only ever crop (`cover`); asking it to letterbox pushes the
 * coordinates outside [0,1], where clamping smears the outermost row of pixels
 * across the bars. Compositing lets `contain` draw real letterbox bars, and
 * lets a tall screenshot scroll through the display.
 */
export function createScreenCompositor(source, screenAspect, maxAnisotropy = 1) {
  const el = source.el
  const canvas = document.createElement('canvas')
  const sw = source.width || 1920
  const width = Math.round(Math.min(2560, Math.max(1280, sw)))
  canvas.width = width
  canvas.height = Math.round(width / screenAspect)

  const ctx = canvas.getContext('2d', { alpha: false })
  ctx.imageSmoothingQuality = 'high'

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  // The display is almost always minified — a ~1920px wide source lands on a
  // few hundred pixels of output — so without mipmaps small text turns to mush
  // and shimmers as the camera moves. But regenerating the chain for a ~2MP
  // canvas every frame costs about half the frame budget, so the preview runs
  // without them and the exporter switches them on for the final pass.
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.anisotropy = maxAnisotropy

  let last = null
  let lastSig = null

  /** Mipmapping is worth its cost only for a final render. */
  const setFast = (fast) => {
    texture.generateMipmaps = !fast
    texture.minFilter = fast ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter
    lastSig = null
    texture.needsUpdate = true
  }

  const draw = (screen, force = false) => {
    last = screen

    // Redrawing and re-uploading a multi-megabyte texture every frame is
    // wasted work when neither the source frame nor the framing has moved.
    const frameId = source.kind === 'video' ? el.currentTime : 'still'
    const sig = `${frameId}|${screen.fit}|${screen.scale}|${screen.offsetX}|${screen.offsetY}|${screen.scroll}|${screen.letterbox}`
    if (!force && sig === lastSig) return
    lastSig = sig

    const W = canvas.width
    const H = canvas.height

    ctx.fillStyle = screen.letterbox ?? '#000000'
    ctx.fillRect(0, 0, W, H)

    const srcW = source.kind === 'video' ? el.videoWidth : el.naturalWidth
    const srcH = source.kind === 'video' ? el.videoHeight : el.naturalHeight
    if (!srcW || !srcH) return
    if (source.kind === 'video' && el.readyState < 2) return

    const srcAspect = srcW / srcH
    const canvasAspect = W / H

    let dw
    let dh
    if (screen.fit === 'stretch') {
      dw = W
      dh = H
    } else if (screen.fit === 'cover') {
      if (srcAspect > canvasAspect) {
        dh = H
        dw = H * srcAspect
      } else {
        dw = W
        dh = W / srcAspect
      }
    } else {
      // contain — the whole frame is visible, bars fill the remainder
      if (srcAspect > canvasAspect) {
        dw = W
        dh = W / srcAspect
      } else {
        dh = H
        dw = H * srcAspect
      }
    }

    const s = Math.max(0.05, screen.scale ?? 1)
    dw *= s
    dh *= s

    let dx = (W - dw) / 2 + (screen.offsetX ?? 0) * W
    let dy = (H - dh) / 2 - (screen.offsetY ?? 0) * H

    // Scroll only bites when the source overflows the display vertically, which
    // is exactly the full-page-screenshot case. 0 = top of page, 1 = bottom.
    const overflow = dh - H
    if (overflow > 1) dy = -overflow * THREE.MathUtils.clamp(screen.scroll ?? 0, 0, 1)

    try {
      ctx.drawImage(el, dx, dy, dw, dh)
    } catch {
      // a frame can be momentarily undecodable mid-seek; the next draw recovers
    }
    texture.needsUpdate = true
  }

  return {
    texture,
    draw,
    setFast,
    redraw: () => last && draw(last, true),
    dispose: () => texture.dispose(),
  }
}
