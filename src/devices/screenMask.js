import * as THREE from 'three'

/**
 * Rounded corners for a display.
 *
 * Every real screen has them and a hard rectangle reads as a render. There is
 * no geometry to round — the display is a single quad — so the corners are cut
 * with an alpha map: white where the screen shows, black where the bezel should
 * come through.
 *
 * Cached per shape, since every device asks for one and several share an aspect.
 */
const cache = new Map()

export function cornerMask(aspect, radiusFraction = 0.02) {
  const key = `${aspect.toFixed(4)}|${radiusFraction}`
  if (cache.has(key)) return cache.get(key)

  const W = 1024
  const H = Math.max(2, Math.round(W / aspect))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')

  g.fillStyle = '#000000'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.roundRect(0, 0, W, H, Math.min(W, H) * radiusFraction * (W / Math.min(W, H)))
  g.fill()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  tex.anisotropy = 4
  cache.set(key, tex)
  return tex
}
