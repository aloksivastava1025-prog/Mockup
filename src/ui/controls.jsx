import React, { useEffect, useRef, useState } from 'react'

export function Panel({ title, children, defaultOpen = true, right }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="panel">
      <header onClick={() => setOpen((o) => !o)}>
        <span className={`chev ${open ? 'open' : ''}`}>▶</span>
        {title}
        {right && (
          <span className="head-actions" onClick={(e) => e.stopPropagation()}>
            {right}
          </span>
        )}
      </header>
      {open && <div className="body">{children}</div>}
    </section>
  )
}

/** label · slider · right-aligned value readout, all on one row */
/**
 * A slider whose track is the whole row: label on the left, fill growing from
 * the left edge, value in its own pill on the right. No thumb — at this size a
 * knob is a small target and the fill already says where the value sits.
 *
 * It is still a real `input[type=range]`, laid transparently over the pill, so
 * the arrow keys, Home/End, tab order and screen-reader semantics all come for
 * free. Painting a div and listening for pointer events would have thrown all
 * of that away.
 */
export function Slider({ label, value, min, max, step = 0.01, unit = '', onChange, precision = 2 }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  const rowRef = useRef(null)

  // Wheel-to-adjust, which is the only comfortable way to land on an exact
  // value in a range this wide. Registered by hand rather than with onWheel
  // because React attaches wheel listeners passively, and a passive listener
  // cannot stop the panel scrolling underneath.
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const dir = e.deltaY > 0 ? -1 : 1
      const coarse = e.shiftKey ? 10 : 1
      const next = Math.min(max, Math.max(min, value + dir * step * coarse))
      if (next !== value) onChange(+next.toFixed(6))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [value, min, max, step, onChange])

  return (
    <div className="slider-row" ref={rowRef}>
      <div className="slider-track" style={{ '--pct': `${pct}%` }}>
        <span className="slider-label">{label}</span>
        <span className="slider-hint">drag · scroll</span>
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
      </div>
      <div className="slider-value">
        {Number(value).toFixed(precision)}
        {unit}
      </div>
    </div>
  )
}

/** numeric field carrying a leading glyph, e.g. `X 0` */
function NumberField({ glyph, value, step, onChange }) {
  return (
    <div className="num">
      {glyph && <span className="glyph">{glyph}</span>}
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  )
}

/**
 * One axis per row with the group label only on the first, matching the
 * reference inspector (`Position / X 0 / Y 12`). Three side-by-side fields
 * clip badly once the panel narrows.
 */
export function Vec3({ label, value, step = 0.01, onChange }) {
  return (
    <div className="vec-rows">
      {['X', 'Y', 'Z'].map((axis, i) => (
        <div className="field" key={axis}>
          <label>{i === 0 ? label : ''}</label>
          <NumberField glyph={axis} step={step} value={value[i]} onChange={(v) => onChange(i, v)} />
        </div>
      ))}
    </div>
  )
}

export function ColorField({ label, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="color-row">
        <span className="swatch" style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        </span>
        <span className="hex">{value.replace('#', '')}</span>
      </div>
    </div>
  )
}

export function Segmented({ label, value, options, onChange }) {
  // Three or more choices cannot share a row with the label without the
  // option text clipping, so those drop the control onto its own line.
  const stacked = !label || options.length > 2
  return (
    <div className={`field ${stacked ? 'stacked' : ''}`}>
      {label && <label>{label}</label>}
      <div className="seg">
        {options.map((o) => (
          <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * A dropdown, for lists a segmented control cannot hold.
 *
 * Segments divide the row evenly, so past about four options every label is
 * clipped to a letter and an ellipsis and the control stops telling you
 * anything. A select keeps the full names and costs one click.
 */
export function Select({ label, value, options, onChange }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="control">
        <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function Toggle({ label, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="seg">
        <button className={value ? 'on' : ''} onClick={() => onChange(true)}>
          On
        </button>
        <button className={!value ? 'on' : ''} onClick={() => onChange(false)}>
          Off
        </button>
      </div>
    </div>
  )
}
