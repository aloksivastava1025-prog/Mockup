import Laptop, { laptopMeta } from './Laptop.jsx'

/**
 * Device registry. A device entry is `{ ...meta, Component, hasLid }`.
 * Adding a phone/tablet/monitor later means dropping a component here that
 * accepts the same props (rootRef, lidRef, videoEl, material, screen) — the
 * scene, controls, animator and exporter need no changes.
 */
export const DEVICES = {
  laptop: { ...laptopMeta, Component: Laptop, hasLid: true },
}

export const DEVICE_LIST = Object.values(DEVICES)

export const COMING_SOON = [
  { id: 'phone', label: 'Phone' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'monitor', label: 'Desktop monitor' },
]
