import * as THREE from 'three'

/**
 * Feeds the device display.
 *
 * Two paths, because they have very different costs:
 *
 * 1. Direct — the source is bound straight to the GPU as a VideoTexture (or a
 *    plain Texture for a still). The browser uploads video frames through its
 *    own fast path, at the source's full resolution. Usable whenever the frame
 *    needs no reshaping: the display already matches the source's aspect ratio
 *    (Adapt) and there is no zoom, offset or scroll.
 *
 * 2. Composited — the frame is drawn onto a 2D canvas first. Needed for
 *    letterboxing, cropping, panning and scrolling a tall screenshot. UV
 *    offsets cannot do this: pushing coordinates outside [0,1] makes clamping
 *    smear the outermost row of pixels across the bars.
 *
 * Compositing a ~2MP canvas and re-uploading it every frame is expensive, so
 * the direct path carries the common case and the canvas only wakes up when
 * the framing actually calls for it.
 */
export function createScreenSource(source, screenAspect, maxAnisotropy = 1) {
  const el = source.el
  const isVideo = source.kind === 'video'

  // The source's own aspect matches the display, so an unmodified frame fills
  // it exactly — nothing to composite.
  const srcAspect = source.width / source.height
  const fitsExactly = Math.abs(srcAspect - screenAspect) < 0.002

  // ---- direct ----
  const direct = isVideo ? new THREE.VideoTexture(el) : new THREE.Texture(el)
  direct.colorSpace = THREE.SRGBColorSpace
  direct.minFilter = THREE.LinearMipmapLinearFilter
  direct.magFilter = THREE.LinearFilter
  direct.generateMipmaps = true
  direct.anisotropy = maxAnisotropy
  if (!isVideo) direct.needsUpdate = true

  // ---- composited ----
  const canvas = document.createElement('canvas')
  const fullW = Math.round(Math.min(2560, Math.max(1280, source.width || 1920)))
  canvas.width = fullW
  canvas.height = Math.round(fullW / screenAspect)
  const ctx = canvas.getContext('2d', { alpha: false })
  ctx.imageSmoothingQuality = 'high'

  const composited = new THREE.CanvasTexture(canvas)
  composited.colorSpace = THREE.SRGBColorSpace
  composited.minFilter = THREE.LinearMipmapLinearFilter
  composited.magFilter = THREE.LinearFilter
  composited.generateMipmaps = true
  composited.anisotropy = maxAnisotropy

  let active = direct
  let last = null
  let lastSig = null
  let sharp = true

  const isIdentity = (screen) =>
    fitsExactly &&
    (screen.scale ?? 1) === 1 &&
    (screen.offsetX ?? 0) === 0 &&
    (screen.offsetY ?? 0) === 0

  const composite = (screen, force) => {
    // Redrawing and re-uploading is wasted work when neither the source frame
    // nor the framing has moved — which for a still is nearly always.
    const frameId = isVideo ? el.currentTime : 'still'
    const sig = `${frameId}|${screen.fit}|${screen.scale}|${screen.offsetX}|${screen.offsetY}|${screen.scroll}|${screen.letterbox}|${canvas.width}`
    if (!force && sig === lastSig) return
    lastSig = sig

    const W = canvas.width
    const H = canvas.height

    ctx.fillStyle = screen.letterbox ?? '#000000'
    ctx.fillRect(0, 0, W, H)

    const sw = isVideo ? el.videoWidth : el.naturalWidth
    const sh = isVideo ? el.videoHeight : el.naturalHeight
    if (!sw || !sh) return
    if (isVideo && el.readyState < 2) return

    const a = sw / sh
    const canvasAspect = W / H

    // A source far taller than the display is a page to scroll, not a frame to
    // letterbox — `contain` would shrink it to a narrow central strip.
    const scrollsVertically = a < canvasAspect * 0.85
    const fit = scrollsVertically && screen.fit === 'contain' ? 'cover' : screen.fit

    let dw
    let dh
    if (fit === 'stretch') {
      dw = W
      dh = H
    } else if (fit === 'cover') {
      if (a > canvasAspect) {
        dh = H
        dw = H * a
      } else {
        dw = W
        dh = W / a
      }
    } else {
      if (a > canvasAspect) {
        dw = W
        dh = W / a
      } else {
        dh = H
        dw = H * a
      }
    }

    const s = Math.max(0.05, screen.scale ?? 1)
    dw *= s
    dh *= s

    const dx = (W - dw) / 2 + (screen.offsetX ?? 0) * W
    let dy = (H - dh) / 2 - (screen.offsetY ?? 0) * H

    // Scroll only bites when the source overflows the display vertically,
    // which is exactly the full-page-screenshot case.
    const overflow = dh - H
    if (overflow > 1) dy = -overflow * THREE.MathUtils.clamp(screen.scroll ?? 0, 0, 1)

    try {
      ctx.drawImage(el, dx, dy, dw, dh)
    } catch {
      // a frame can be momentarily undecodable mid-seek; the next draw recovers
    }
    composited.needsUpdate = true
  }

  const draw = (screen, force = false) => {
    last = screen
    const wantDirect = isIdentity(screen)
    active = wantDirect ? direct : composited
    if (!wantDirect) composite(screen, force)
    // A still needs one upload. A playing video uploads itself through the
    // browser's frame callbacks, but a forced redraw means the exporter just
    // seeked a paused element — push that frame rather than race the callback.
    else if (!isVideo || force) direct.needsUpdate = true
  }

  /**
   * Mipmaps, which is what stops small UI text crawling and breaking up as a
   * 1920-wide recording is minified onto a display a few hundred pixels
   * across. On by default, including in the preview.
   *
   * They used to be off while composing, on the assumption that rebuilding
   * the chain for every video frame was too slow. Measured, forcing a fresh
   * upload on every single render: 3.60ms a frame without, 4.41ms with. That
   * is 0.81ms against a 16.7ms budget at 60fps — nothing, and it was costing
   * every preview its legibility. Draft renders still turn it off, where
   * speed is the entire point and nobody is reading the screen.
   */
  const setSharp = (on) => {
    if (sharp === on) return
    sharp = on
    for (const t of [direct, composited]) {
      t.generateMipmaps = on
      t.minFilter = on ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
      t.needsUpdate = true
    }
    lastSig = null
    if (last) draw(last, true)
  }

  return {
    get texture() {
      return active
    },
    draw,
    setSharp,
    redraw: () => last && draw(last, true),
    dispose: () => {
      direct.dispose()
      composited.dispose()
    },
  }
}
