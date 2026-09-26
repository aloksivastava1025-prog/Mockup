import MacBook, { macbookMeta } from './MacBook.jsx'
import Monitor, { monitorMeta } from './Monitor.jsx'
import Frame, { frameMeta } from './Frame.jsx'
import Phone, { phoneMeta } from './Phone.jsx'
import Tablet, { tabletMeta } from './Tablet.jsx'

/**
 * Device registry. A device entry is `{ ...meta, Component }`.
 *
 * A device component accepts `{ rootRef, lidRef, texture, screenMatRef,
 * material, screen, aspectScale }`. Its meta carries `screenAspect`, whether it
 * `hasLid`, a default camera `frame` used when you switch to it, and an
 * optional `adaptRange` — how far Adapt may stretch that particular body before
 * it stops looking like itself. A laptop takes a lot of reshaping; a tablet
 * almost none.
 *
 * `aspectScale` stretches the display's height axis so Adapt can match the
 * source's aspect ratio — for a laptop that is the lid length and the base
 * depth, for everything else it is simply the body height.
 */
export const DEVICES = {
  macbook: { ...macbookMeta, Component: MacBook, hasLid: true },
  tablet: { ...tabletMeta, Component: Tablet },
  monitor: { ...monitorMeta, Component: Monitor },
  phone: { ...phoneMeta, Component: Phone },
  // Not a device: the footage on its own, for when a body around it would
  // only be a costume.
  frame: { ...frameMeta, Component: Frame },
}

export const DEVICE_LIST = Object.values(DEVICES)

/** Anything a saved project names that no longer exists falls back to this. */
export const DEFAULT_DEVICE = DEVICES.macbook

export const COMING_SOON = []
