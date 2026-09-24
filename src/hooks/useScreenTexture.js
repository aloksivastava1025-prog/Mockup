import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export function createScreenTexture(videoEl) {
  const t = new THREE.VideoTexture(videoEl)
  t.colorSpace = THREE.SRGBColorSpace
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

/** Applies fit / scale / offset to a video texture's UV transform. */
export function applyScreenUV(texture, videoEl, screenAspect, screen) {
  if (!texture || !videoEl) return
  const vw = videoEl.videoWidth || 16
  const vh = videoEl.videoHeight || 9
  const videoAspect = vw / vh

  let repeatX = 1
  let repeatY = 1
  if (screen.fit === 'cover') {
    if (videoAspect > screenAspect) repeatX = screenAspect / videoAspect
    else repeatY = videoAspect / screenAspect
  } else if (screen.fit === 'contain') {
    if (videoAspect > screenAspect) repeatY = videoAspect / screenAspect
    else repeatX = screenAspect / videoAspect
  }

  const s = Math.max(0.05, screen.scale)
  repeatX /= s
  repeatY /= s

  texture.repeat.set(repeatX, repeatY)
  texture.offset.set((1 - repeatX) / 2 - screen.offsetX, (1 - repeatY) / 2 + screen.offsetY)
}

/** React-side convenience: owns the texture lifecycle for a video element. */
export function useScreenTexture(videoEl) {
  const texture = useMemo(() => (videoEl ? createScreenTexture(videoEl) : null), [videoEl])
  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}
