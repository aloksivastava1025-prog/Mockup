import * as THREE from 'three'

/**
 * Painted backdrops for a location.
 *
 * A gradient can only say "it is dark"; it cannot say *where* you are. These
 * draw an actual view — a window, a sky, a silhouette — so a scene has a place
 * behind it without shipping photographs or asking the user to supply one.
 *
 * Drawn wide and shallow and tagged `cover`, so the frame loop fits them the
 * same way it fits a user's own backdrop image: aspect preserved, cropped to
 * the output shape. A gradient is a 4x256 strip that is *meant* to stretch;
 * these are not.
 */
const W = 1600
const H = 900

const rand = (() => {
  let seed = 76543211
  return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
})()

/**
 * Night through a window: a cold sky going lighter toward the horizon, thin
 * cloud, a ridge line, and the window's own frame in front of all of it.
 *
 * Everything is kept very dark on purpose. The desk is the only lit thing in
 * the reference for this location, and a backdrop that competes with it turns
 * a night shot into an evening one.
 */
function windowNight() {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')

  // --- sky ---
  const sky = g.createLinearGradient(0, 0, 0, H * 0.78)
  sky.addColorStop(0, '#080d16')
  sky.addColorStop(0.42, '#16202f')
  sky.addColorStop(0.78, '#31404f')
  sky.addColorStop(1, '#4a5768')
  g.fillStyle = sky
  g.fillRect(0, 0, W, H)

  // --- cloud, as flattened blurred blobs rather than anything shaped ---
  g.save()
  g.filter = 'blur(26px)'
  for (let i = 0; i < 26; i++) {
    const y = H * (0.16 + rand() * 0.42)
    const w = 160 + rand() * 520
    const h = 14 + rand() * 46
    g.globalAlpha = 0.08 + rand() * 0.14
    g.fillStyle = rand() > 0.35 ? '#8290a8' : '#2a3240'
    g.beginPath()
    g.ellipse(rand() * W, y, w, h, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
  g.globalAlpha = 1

  // --- ridge line, low and almost black ---
  const ridge = (baseY, colour, jag) => {
    g.fillStyle = colour
    g.beginPath()
    g.moveTo(0, H)
    let y = baseY
    g.lineTo(0, y)
    for (let x = 0; x <= W; x += 24) {
      y += (rand() - 0.5) * jag
      y = Math.max(baseY - jag * 3, Math.min(baseY + jag * 2, y))
      g.lineTo(x, y)
    }
    g.lineTo(W, H)
    g.closePath()
    g.fill()
  }
  ridge(H * 0.60, '#111823', 16)
  ridge(H * 0.68, '#080c12', 10)

  // --- the window itself, in front of the view ---
  // Mullions are drawn on an exact division so they stay evenly spaced
  // whatever the output aspect crops away.
  const BARS = 4
  g.fillStyle = '#04050700'
  for (let i = 1; i < BARS; i++) {
    const x = (i * W) / BARS
    g.fillStyle = 'rgba(6,8,11,0.96)'
    g.fillRect(x - 4, 0, 8, H)
    // A hair of sky catching the inner edge of each bar, which is what stops
    // them reading as holes cut in the image.
    g.fillStyle = 'rgba(150,165,190,0.10)'
    g.fillRect(x + 4, 0, 1.5, H)
  }
  // head and sill
  g.fillStyle = 'rgba(6,8,11,0.96)'
  g.fillRect(0, 0, W, H * 0.05)
  g.fillRect(0, H * 0.72, W, H * 0.28)

  // --- vignette: the reference is black at the edges and that is most of
  //     what makes it read as night rather than as dusk ---
  const vig = g.createRadialGradient(W / 2, H * 0.45, H * 0.15, W / 2, H * 0.45, W * 0.72)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(0.62, 'rgba(0,0,0,0.18)')
  vig.addColorStop(1, 'rgba(0,0,0,0.72)')
  g.fillStyle = vig
  g.fillRect(0, 0, W, H)

  return c
}

const BUILDERS = { 'window-night': windowNight }

export const BACKDROPS = {
  'window-night': { label: 'Night window' },
}

const cache = new Map()

export function backdropTexture(kind) {
  const build = BUILDERS[kind]
  if (!build) return null
  if (!cache.has(kind)) {
    const tex = new THREE.CanvasTexture(build())
    tex.colorSpace = THREE.SRGBColorSpace
    // Fitted by the frame loop like a user's own image, not stretched.
    tex.userData.cover = true
    cache.set(kind, tex)
  }
  return cache.get(kind)
}
