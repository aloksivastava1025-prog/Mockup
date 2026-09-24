import React, { useState } from 'react'

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
export function Slider({ label, value, min, max, step = 0.01, unit = '', onChange, precision = 2 }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="field">
      <label>{label}</label>
      <div className="control">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          style={{ '--pct': `${pct}%` }}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        <span className="readout">
          {Number(value).toFixed(precision)}
          {unit}
        </span>
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
