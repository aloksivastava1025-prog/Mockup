/**
 * Locations bundle everything about where the device is sitting: the surface,
 * the backdrop behind it and the light falling on it.
 *
 * They are kept together deliberately. A wooden desk under cold studio light
 * looks wrong, and picking the three separately is how you end up there — so
 * the picker sets all three, and the individual controls remain underneath for
 * anyone who wants to pull it apart.
 */
export const LOCATIONS = {
  studio: {
    label: 'Studio',
    background: { mode: 'gradient', colorTop: '#dedede', colorBottom: '#cfcfcf', groundVisible: true, surface: 'studio', groundColor: '#ffffff', props: false },
    lighting: { keyIntensity: 2.1, keyAzimuth: 31, keyElevation: 54, fillIntensity: 0.45, rimIntensity: 0.35, ambient: 0.22, hemi: 0.45, exposure: 1.0, envPreset: 'studio', envIntensity: 0.35, shadowOpacity: 0.35, shadowBlur: 2.2 },
    material: { bodyColor: '#8c8c90' },
  },
  desk: {
    label: 'Desk',
    background: { mode: 'gradient', colorTop: '#d8cfc4', colorBottom: '#bdb0a1', groundVisible: true, surface: 'wood', groundColor: '#ffffff', props: true },
    lighting: { keyIntensity: 2.4, keyAzimuth: 42, keyElevation: 48, fillIntensity: 0.4, rimIntensity: 0.5, ambient: 0.2, hemi: 0.4, exposure: 1.05, envPreset: 'warm', envIntensity: 0.45, shadowOpacity: 0.45, shadowBlur: 1.8 },
    material: { bodyColor: '#8f9094' },
  },
  loft: {
    label: 'Loft',
    background: { mode: 'gradient', colorTop: '#b9bcc0', colorBottom: '#8e9297', groundVisible: true, surface: 'concrete', groundColor: '#ffffff', props: true },
    lighting: { keyIntensity: 2.0, keyAzimuth: 18, keyElevation: 58, fillIntensity: 0.5, rimIntensity: 0.6, ambient: 0.24, hemi: 0.5, exposure: 1.0, envPreset: 'softbox', envIntensity: 0.4, shadowOpacity: 0.4, shadowBlur: 2.6 },
    material: { bodyColor: '#85868a' },
  },
  marble: {
    label: 'Marble',
    background: { mode: 'gradient', colorTop: '#f2f1ef', colorBottom: '#dcdad6', groundVisible: true, surface: 'marble', groundColor: '#ffffff', props: true },
    lighting: { keyIntensity: 2.3, keyAzimuth: 36, keyElevation: 52, fillIntensity: 0.55, rimIntensity: 0.4, ambient: 0.26, hemi: 0.55, exposure: 1.05, envPreset: 'studio', envIntensity: 0.5, shadowOpacity: 0.3, shadowBlur: 2.0 },
    material: { bodyColor: '#9a9a9e' },
  },
  ridge: {
    label: 'Ridge',
    background: { mode: 'gradient', colorTop: '#c2c8bf', colorBottom: '#d4652a', groundVisible: true, surface: 'rock', groundColor: '#1d1a18', props: false },
    // Low sun: a shallow key so the beds cast along the stone, deep ambient so
    // the ledge keeps a silhouette instead of washing out against the sky.
    lighting: { keyIntensity: 2.5, keyAzimuth: 34, keyElevation: 22, fillIntensity: 0.22, rimIntensity: 1.6, ambient: 0.07, hemi: 0.14, exposure: 1.0, envPreset: 'warm', envIntensity: 0.45, shadows: true, shadowOpacity: 0.55, shadowBlur: 2.6 },
    material: { bodyColor: '#c6c3bd' },
  },
  noir: {
    label: 'Noir',
    background: { mode: 'gradient', colorTop: '#1b1f27', colorBottom: '#05070a', groundVisible: true, surface: 'mirror', groundColor: '#0d0f14', props: false },
    lighting: { keyIntensity: 3.0, keyAzimuth: 38, keyElevation: 42, fillIntensity: 0.3, rimIntensity: 2.2, ambient: 0.1, hemi: 0.15, exposure: 1.1, envPreset: 'studio', envIntensity: 0.8, shadowOpacity: 0.6, shadowBlur: 3.0 },
    material: { bodyColor: '#4a4e57' },
  },
  void: {
    label: 'Void',
    background: { mode: 'gradient', colorTop: '#e8e8e8', colorBottom: '#d2d2d2', groundVisible: false, surface: 'studio', groundColor: '#ffffff', props: false },
    lighting: { keyIntensity: 2.2, keyAzimuth: 31, keyElevation: 56, fillIntensity: 0.6, rimIntensity: 0.5, ambient: 0.3, hemi: 0.6, exposure: 1.0, envPreset: 'softbox', envIntensity: 0.45, shadowOpacity: 0.25, shadowBlur: 2.4 },
    material: { bodyColor: '#8c8c90' },
  },
}

export function applyLocation(id, store) {
  const loc = LOCATIONS[id]
  if (!loc) return
  const s = store.getState()
  store.getState().commit()
  store.setState({
    locationId: id,
    background: { ...s.background, ...loc.background },
    lighting: { ...s.lighting, ...loc.lighting },
    material: { ...s.material, ...loc.material },
  })
}
