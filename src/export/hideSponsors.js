/**
 * Take every sponsor mark out of the scene for the duration of a render.
 *
 * The components already return null while `exporting` is set, and that is not
 * good enough on its own: a zustand write schedules a React render, and this
 * module starts drawing frames in the same tick. Whether the meshes are gone
 * by the first frame would come down to when React happens to flush.
 *
 * A logo that belongs to someone else appearing in a user's marketing video is
 * not a bug you get to be unlucky about, so the scene graph is edited directly
 * here and restored in a finally. The React guard stays as the second lock.
 */
export function hideSponsors(scene) {
  const hidden = []
  scene.traverse((o) => {
    if (o.userData?.sponsor && o.visible) {
      o.visible = false
      hidden.push(o)
    }
  })
  return () => hidden.forEach((o) => (o.visible = true))
}
