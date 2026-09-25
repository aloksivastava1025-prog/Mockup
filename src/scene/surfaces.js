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

/**
 * Dark walnut, semi-gloss — a night desk rather than a daylit one.
 *
 * Built apart from `wood` instead of just darkening it. The lighter desk is a
 * matte board with plank seams; this is one continuous slab, and at this value
 * the grain has to carry almost all of the read, so it is finer, higher in
 * contrast and interrupted by a few broad cathedral streaks. Darkening the
 * other one gives mud.
 */
function makeWalnut() {
  const [c, g] = canvas2d()
  g.fillStyle = '#2a1c12'
  g.fillRect(0, 0, SIZE, SIZE)

  // Broad tonal bands across the slab, so it is not a flat brown field.
  for (let i = 0; i < 14; i++) {
    const y = rand() * SIZE
    const h = 30 + rand() * 120
    g.globalAlpha = 0.16 + rand() * 0.18
    g.fillStyle = rand() > 0.5 ? '#1a1009' : '#3d2a1a'
    g.fillRect(0, y, SIZE, h)
  }

  // Grain runs the full width, so it tiles horizontally for free.
  for (let i = 0; i < 1500; i++) {
    const y = rand() * SIZE
    const h = 0.4 + rand() * 1.8
    g.globalAlpha = 0.05 + rand() * 0.16
    g.fillStyle = rand() > 0.42 ? '#120b06' : '#5b4028'
    g.fillRect(0, y, SIZE, h)
  }

  // A few cathedral streaks: long, shallow arcs that break up the stripes and
  // stop the whole thing reading as corduroy.
  g.lineCap = 'round'
  for (let i = 0; i < 22; i++) {
    const y0 = rand() * SIZE
    const amp = 6 + rand() * 26
    g.globalAlpha = 0.07 + rand() * 0.14
    g.strokeStyle = rand() > 0.5 ? '#0f0904' : '#6a4b2e'
    g.lineWidth = 0.8 + rand() * 3.4
    g.beginPath()
    g.moveTo(0, y0)
    for (let x = 0; x <= SIZE; x += 32) {
      g.lineTo(x, y0 + Math.sin((x / SIZE) * Math.PI * (1 + rand())) * amp)
    }
    g.stroke()
  }
  g.globalAlpha = 1

  speckle(g, 900, 0.03, 1.2)
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

const BUILDERS = { studio: makeStudio, wood: makeWood, walnut: makeWalnut, concrete: makeConcrete, marble: makeMarble }

/**
 * A stone ledge for the device to stand on.
 *
 * The other surfaces are a texture on a flat plane; this one has to be real
 * geometry, because what sells a rock is its silhouette against the backdrop —
 * a photograph of stone painted onto a plane still reads as a floor.
 *
 * Built from a cylinder so the top starts genuinely flat: the sides are pushed
 * around hard to break them up, while the top cap gets only a whisper of
 * displacement. A device has to sit on this without hovering over a dip or
 * sinking into a bump, so the plateau stays a plateau.
 */
let rockGeo = null

export function rockGeometry() {
  if (rockGeo) return rockGeo

  const R_TOP = 1.05
  const R_BOTTOM = 1.35
  const HEIGHT = 0.95
  const geo = new THREE.CylinderGeometry(R_TOP, R_BOTTOM, HEIGHT, 96, 26)
  const pos = geo.attributes.position
  const v = new THREE.Vector3()

  // Cheap deterministic value noise — enough for stone, and stable between
  // reloads so a saved shot renders the same rock.
  const hash = (x, y, z) => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
    return n - Math.floor(n)
  }
  const noise = (x, y, z) => {
    let sum = 0
    let amp = 1
    let f = 1.6
    for (let o = 0; o < 4; o++) {
      sum += (hash(x * f, y * f, z * f) - 0.5) * amp
      amp *= 0.5
      f *= 2.1
    }
    return sum
  }

  /**
   * Stone this size is bedded, not lumpy: it breaks along near-horizontal beds
   * and each bed steps in or out from the one below. Displacing by noise alone
   * gives a potato, so the sides carry a stepped strata term — quantised height
   * bands, each with its own radial offset — with the noise layered on top to
   * keep the bands from reading as a lathe turning.
   */
  const BEDS = 7
  const bedOffset = (y) => {
    const band = Math.floor(((y / HEIGHT) + 0.5) * BEDS)
    return (hash(band * 3.1, band * 7.7, 1.3) - 0.5) * 0.26
  }

  const topY = HEIGHT / 2
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const onTopCap = v.y > topY - 1e-4
    const n = noise(v.x, v.y, v.z)
    const fine = noise(v.x * 5.5, v.y * 5.5, v.z * 5.5)

    if (onTopCap) {
      // The cap stays exactly planar. A cylinder's cap is a single triangle fan,
      // so any vertical displacement there turns into radial spokes under flat
      // shading — and a device needs a level plateau anyway. All the character
      // goes into the rim, where the fan's outer ring is.
      const r = Math.hypot(v.x, v.z)
      if (r > 1e-4) {
        // ragged rim, but only near the edge
        const edge = Math.min(1, r / R_TOP)
        const push = (n * 0.13 + fine * 0.05) * edge * edge
        v.x += (v.x / r) * push
        v.z += (v.z / r) * push
      }
    } else {
      const r = Math.hypot(v.x, v.z)
      if (r > 1e-4) {
        const push = n * 0.16 + fine * 0.06 + bedOffset(v.y)
        v.x += (v.x / r) * push
        v.z += (v.z / r) * push
      }
      v.y += n * 0.07 + fine * 0.02
    }
    pos.setXYZ(i, v.x, v.y, v.z)
  }

  geo.scale(1, 1, 0.82)
  // Sit the plateau on y = 0 so devices stand at the same height as on a plane.
  geo.translate(0, -topY, 0)
  geo.computeVertexNormals()
  rockGeo = geo
  return geo
}

/** Surfaces that are real geometry rather than a texture on a plane. */
export const SURFACE_GEOMETRY = { rock: () => rockGeometry() }

export const SURFACES = {
  studio: { label: 'Studio', color: '#ffffff', roughness: 0.92, metalness: 0, tile: 3 },
  wood: { label: 'Wood', color: '#ffffff', roughness: 0.55, metalness: 0, tile: 0.9 },
  // Semi-gloss on purpose: the reference desk carries a soft reflection of
  // whatever is standing on it, and at matte roughness that disappears.
  // `reflect` turns the plane into a mirror-backed material. Walnut is
  // polished and dark, and on a dark surface the reflection is what tells you
  // the device is standing on it rather than over it.
  walnut: {
    label: 'Walnut', color: '#ffffff', roughness: 0.32, metalness: 0.1, tile: 1.5,
    reflect: { strength: 4, blur: [300, 90], mixBlur: 1.2, mirror: 0.35 },
  },
  concrete: { label: 'Concrete', color: '#ffffff', roughness: 0.85, metalness: 0, tile: 1.4 },
  marble: { label: 'Marble', color: '#ffffff', roughness: 0.28, metalness: 0.05, tile: 1.6 },
  mirror: {
    label: 'Mirror', color: '#0d0f14', roughness: 0.85, metalness: 0.5, tile: 1,
    reflect: { strength: 12, blur: [320, 90], mixBlur: 1, mirror: 0.35 },
  },
  rock: { label: 'Rock', color: '#1d1a18', roughness: 1, metalness: 0.04, tile: 1, geometry: 'rock' },
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
