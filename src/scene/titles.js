import * as THREE from 'three'

/**
 * Animated text over the shot.
 *
 * Drawn into a 2D canvas and shown on a quad locked to the camera, not as
 * HTML over the viewport. HTML would look right in the preview and then be
 * missing from every export, because the exporter captures the WebGL drawing
 * buffer and nothing else. Same reason the dip-to-black is a quad.
 *
 * The canvas is kept at the drawing buffer's exact size, so text is rendered
 * at output resolution rather than being scaled up from preview size — which
 * is the difference between crisp type and a blurry caption in a 1440p render.
 */

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif`

/** Ease that starts fast and settles, which is how titles are normally cut. */
const outCubic = (u) => 1 - Math.pow(1 - u, 3)
const clamp01 = (v) => Math.max(0, Math.min(1, v))

/**
 * How far through its life a title is at `time`, as
 * `{ shown, enter, exit }` — enter and exit both run 0..1.
 */
function phase(t, time) {
  const IN = 0.45
  const OUT = 0.4
  const start = t.in ?? 0
  const end = start + (t.dur ?? 3)
  if (time < start || time > end) return null
  return {
    enter: clamp01((time - start) / IN),
    exit: clamp01((end - time) / OUT),
  }
}

export function makeTitleLayer() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.premultiplyAlpha = false

  return {
    texture,
    /** Returns true if anything is on screen, so the caller can hide the quad. */
    draw(titles, time, w, h) {
      if (!w || !h) return false
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.clearRect(0, 0, w, h)

      let any = false
      for (const t of titles) {
        const ph = phase(t, time)
        if (!ph) continue
        any = true

        const alpha = outCubic(ph.enter) * outCubic(ph.exit)
        // Size is a share of frame height, so a title holds its proportions
        // whether it is exported at 720p or 1440p or cropped to 9:16.
        const px = Math.round((t.size ?? 0.07) * h)
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.font = `${t.weight ?? 600} ${px}px ${FONT}`
        ctx.textBaseline = 'middle'
        ctx.textAlign = t.align ?? 'center'
        ctx.fillStyle = t.color ?? '#ffffff'

        const x = (t.x ?? 0.5) * w
        let y = (t.y ?? 0.5) * h

        if (t.anim === 'rise') y += (1 - outCubic(ph.enter)) * px * 0.9
        if (t.anim === 'wipe') {
          const m = ctx.measureText(t.text)
          const left = t.align === 'left' ? x : t.align === 'right' ? x - m.width : x - m.width / 2
          ctx.beginPath()
          ctx.rect(left, y - px, m.width * outCubic(ph.enter), px * 2)
          ctx.clip()
        }

        // A soft drop shadow so white type survives a light backdrop without
        // needing the user to pick a colour per shot.
        ctx.shadowColor = 'rgba(0,0,0,0.35)'
        ctx.shadowBlur = px * 0.25
        ctx.shadowOffsetY = px * 0.04
        ctx.fillText(t.text, x, y)
        ctx.restore()
      }

      texture.needsUpdate = true
      return any
    },
    dispose: () => texture.dispose(),
  }
}
