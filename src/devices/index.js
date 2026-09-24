import Laptop, { laptopMeta } from './Laptop.jsx'
import MacBook, { macbookMeta } from './MacBook.jsx'
import Phone, { phoneMeta } from './Phone.jsx'

/**
 * Device registry. A device entry is `{ ...meta, Component }`.
 *
 * A device component accepts `{ rootRef, lidRef, texture, screenMatRef,
 * material, screen, aspectScale }` and a meta carries `screenAspect`, whether
 * it `hasLid`, and a default camera `frame` used when you switch to it.
 * `aspectScale` stretches the display's height axis so Adapt can match the
 * source's aspect ratio — for a laptop that is the lid length and the base
 * depth, for a phone it is simply the body height.
 */
export const DEVICES = {
  macbook: { ...macbookMeta, Component: MacBook, hasLid: true },
  laptop: { ...laptopMeta, Component: Laptop, hasLid: true },
}

export const DEVICE_LIST = Object.values(DEVICES)

/**
 * The phone is built and works (see Phone.jsx) but is held back from the
 * picker until it has had a proper design pass. Re-expose it by moving the
 * entry below into DEVICES:
 *   phone: { ...phoneMeta, Component: Phone },
 */
export const PHONE_PREVIEW = { ...phoneMeta, Component: Phone }

export const COMING_SOON = [
  { id: 'phone', label: 'Phone' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'monitor', label: 'Desktop monitor' },
]
