/**
 * Bridge between the R3F scene and plain-JS callers (the exporter).
 * Populated by <Rig /> once the canvas is live.
 */
export const studioApi = {
  gl: null,
  scene: null,
  camera: null,
  canvas: null,
  /** applyAt(time, { animated }) — positions everything for a given timeline time. */
  applyAt: null,
  /** renderFrame() — draws one frame with the current state. */
  renderFrame: null,
  /** markScreenDirty() — forces the screen texture to re-upload after a seek. */
  markScreenDirty: null,
  /** setSharpTexture(bool) — enables mipmapping for a final render. */
  setSharpTexture: null,
}
