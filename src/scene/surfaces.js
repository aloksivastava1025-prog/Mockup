import * as THREE from 'three'

/**
 * Procedural surfaces for the device to sit on.
 *
 * Generated on a canvas rather than shipped as image files: a handful of
 * textures would outweigh the whole app, and these only need to read as a
 * material under a small object, not survive close inspection.
 *
 * Everything is drawn to tile seamlessly — a visible seam on a floor is worse
 * than no texture at all. Features that would cross an edge are drawn again,
 * wrapped, on the opposite side.
 */

const SIZE = 1024

const rand = (() => {
  let seed = 20260925
  return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
})()

function canvas2d() {
  const c = document.createElement('canvas')
  c.width = SIZE
  c.height = SIZE
  return [c, c.getContext('2d')]
}

/** Draws `fn` five times so anything near an edge reappears on the far side. */
function wrapped(ctx, fn) {
  for (const [dx, dy] of [
    [0, 0],
    [-SIZE, 0],
    [SIZE, 0],
    [0, -SIZE],
    [0, SIZE],
  ]) {
    ctx.save()
    ctx.translate(dx, dy)
    fn()
    ctx.restore()
  }
}

function speckle(ctx, count, alpha, radius) {
  for (let i = 0; i < count; i++) {
    const x = rand() * SIZE
    const y = rand() * SIZE
    const r = radius * (0.4 + rand())
    ctx.globalAlpha = alpha * (0.3 + rand() * 0.7)
    ctx.fillStyle = rand() > 0.5 ? '#ffffff' : '#000000'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function makeWood() {
  const [c, g] = canvas2d()
  g.fillStyle = '#9b6a3f'
  g.fillRect(0, 0, SIZE, SIZE)

  // Grain runs the full width, so it tiles horizontally for free.
  for (let i = 0; i < 900; i++) {
    const y = rand() * SIZE
    const h = 0.5 + rand() * 2.5
    g.globalAlpha = 0.04 + rand() * 0.10
    g.fillStyle = rand() > 0.45 ? '#5f3d21' : '#c08b57'
    g.fillRect(0, y, SIZE, h)
  }
  g.globalAlpha = 1

  // Plank seams on an exact division of the tile, so they meet across edges.
  const planks = 4
  for (let i = 0; i < planks; i++) {
    const y = (i * SIZE) / planks
    g.fillStyle = 'rgba(40,24,12,0.55)'
    g.fillRect(0, y, SIZE, 2)
    g.fillStyle = 'rgba(255,220,180,0.06)'
    g.fillRect(0, y + 2, SIZE, 2)
  }

  speckle(g, 1200, 0.05, 1.6)
  return c
}

function makeConcrete() {
  const [c, g] = canvas2d()
  g.fillStyle = '#9d9d9e'
  g.fillRect(0, 0, SIZE, SIZE)

  wrapped(g, () => {
    for (let i = 0; i < 26; i++) {
      const x = rand() * SIZE
      const y = rand() * SIZE
      const r = 60 + rand() * 220
      const grd = g.createRadialGradient(x, y, 0, x, y, r)
      const dark = rand() > 0.5
      grd.addColorStop(0, dark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grd
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
  })

  speckle(g, 9000, 0.10, 1.1)
  return c
}

function makeMarble() {
  const [c, g] = canvas2d()
  g.fillStyle = '#efeeec'
  g.fillRect(0, 0, SIZE, SIZE)

  wrapped(g, () => {
    for (let v = 0; v < 18; v++) {
      const y0 = rand() * SIZE
      g.strokeStyle = `rgba(120,122,130,${0.05 + rand() * 0.16})`
      g.lineWidth = 0.6 + rand() * 3.2
      g.beginPath()
      let y = y0
      g.moveTo(-40, y)
      for (let x = -40; x <= SIZE + 40; x += 40) {
        y += (rand() - 0.5) * 46
        g.lineTo(x, y)
      }
      g.stroke()
    }
  })

  speckle(g, 2500, 0.03, 1.3)
  return c
}

/**
 * A seamless sweep. Nearly flat by design, but it exists for a reason: a
 * material that switches to *no* map keeps whatever map it had, so every
 * texture-less surface would inherit the last one chosen. Giving studio its
 * own map means the slot is always filled — and the faint mottling breaks up
 * the banding a perfectly flat grey shows under a soft gradient.
 */
function makeStudio() {
  const [c, g] = canvas2d()
  g.fillStyle = '#d9d9d9'
  g.fillRect(0, 0, SIZE, SIZE)
  wrapped(g, () => {
    for (let i = 0; i < 14; i++) {
      const x = rand() * SIZE
      const y = rand() * SIZE
      const r = 200 + rand() * 320
      const grd = g.createRadialGradient(x, y, 0, x, y, r)
      grd.addColorStop(0, rand() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grd
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
  })
  speckle(g, 2000, 0.02, 1.0)
  return c
}

const BUILDERS = { studio: makeStudio, wood: makeWood, concrete: makeConcrete, marble: makeMarble }

export const SURFACES = {
  studio: { label: 'Studio', color: '#ffffff', roughness: 0.92, metalness: 0, tile: 3 },
  wood: { label: 'Wood', color: '#ffffff', roughness: 0.55, metalness: 0, tile: 0.9 },
  concrete: { label: 'Concrete', color: '#ffffff', roughness: 0.85, metalness: 0, tile: 1.4 },
  marble: { label: 'Marble', color: '#ffffff', roughness: 0.28, metalness: 0.05, tile: 1.6 },
  mirror: { label: 'Mirror', color: '#0d0f14', roughness: 0.85, metalness: 0.5, tile: 1 },
}

const cache = new Map()

/** `tile` is the width in world units that one repeat of the texture covers. */
export function surfaceTexture(kind, planeSize) {
  const build = BUILDERS[kind]
  if (!build) return null

  if (!cache.has(kind)) {
    const tex = new THREE.CanvasTexture(build())
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.anisotropy = 8
    cache.set(kind, tex)
  }
  const tex = cache.get(kind)
  const repeat = planeSize / (SURFACES[kind]?.tile ?? 1)
  tex.repeat.set(repeat, repeat)
  return tex
}
