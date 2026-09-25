import * as THREE from 'three'
import { studioApi } from './studioApi.js'

/**
 * Focus areas: pick a region of the screen content, get a camera that frames it.
 *
 * The region is stored in the source's own coordinates — 0..1 across the
 * screenshot or recording, y measured from the top the way an image is read —
 * rather than in world space. That way it survives everything: moving the
 * device, swapping the device for a different one, Adapt reshaping the
 * display. "The pricing table" stays the pricing table.
 */

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _c = new THREE.Vector3()
const _n = new THREE.Vector3()
const _up = new THREE.Vector3()
const _right = new THREE.Vector3()

/** The display quad of the hero device, or null before the scene is up. */
export function screenMesh() {
  const scene = studioApi.scene
  if (!scene) return null
  let found = null
  scene.traverse((o) => {
    if (!found && o.isMesh && o.userData?.screenSurface) found = o
  })
  return found
}

/**
 * Camera pose that frames `rect` of the screen.
 *
 * Solved rather than eyeballed: the quad's own world matrix gives the region's
 * centre and its half-extents along the screen's right and up axes, and the
 * distance is whatever puts both of those inside the frustum. Both axes have
 * to be checked — fitting only the height lets a wide region run off the sides,
 * which is the failure you would not notice until the export.
 */
export function poseForRect(rect, { fov = 28, aspect = 16 / 9, margin = 1.06 } = {}) {
  const mesh = screenMesh()
  if (!mesh) return null

  const geo = mesh.geometry
  if (!geo.boundingBox) geo.computeBoundingBox()
  const bb = geo.boundingBox
  const localW = bb.max.x - bb.min.x
  const localH = bb.max.y - bb.min.y

  // Rect is top-down; the quad's local Y runs bottom-up.
  const cx = bb.min.x + (rect.x + rect.w / 2) * localW
  const cy = bb.max.y - (rect.y + rect.h / 2) * localH

  mesh.updateWorldMatrix(true, false)
  _m.copy(mesh.matrixWorld)
  _c.set(cx, cy, 0).applyMatrix4(_m)

  // Screen axes in world space, including whatever scale the device carries.
  _right.setFromMatrixColumn(_m, 0)
  _up.setFromMatrixColumn(_m, 1)
  _n.crossVectors(_right, _up).normalize()

  const halfW = (rect.w * localW * _right.length()) / 2
  const halfH = (rect.h * localH * _up.length()) / 2

  const tan = Math.tan((fov * Math.PI) / 360)
  const distH = halfH / tan
  const distW = halfW / (tan * aspect)
  const dist = Math.max(distH, distW) * margin

  _p.copy(_c).addScaledVector(_n, dist)
  // The normal can point either way out of the quad; take the side the camera
  // is already on, so generating a move never puts it behind the display.
  const cam = studioApi.camera
  if (cam && _p.distanceTo(cam.position) > _c.clone().addScaledVector(_n, -dist).distanceTo(cam.position)) {
    _p.copy(_c).addScaledVector(_n, -dist)
  }

  return {
    position: [+_p.x.toFixed(4), +_p.y.toFixed(4), +_p.z.toFixed(4)],
    target: [+_c.x.toFixed(4), +_c.y.toFixed(4), +_c.z.toFixed(4)],
    fov,
  }
}

/** A pose that frames the whole display — the shot a move opens and closes on. */
export function poseForWhole(opts) {
  return poseForRect({ x: 0, y: 0, w: 1, h: 1 }, { fov: 32, margin: 1.35, ...opts })
}
