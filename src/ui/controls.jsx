import React, { useState } from 'react'

export function Panel({ title, children, defaultOpen = true, right }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="panel">
      <header onClick={() => setOpen((o) => !o)}>
        {title}
        {right}
        <span className={`chev ${open ? 'open' : ''}`}>▶</span>
      </header>
      {open && <div className="body">{children}</div>}
    </section>
  )
}

export function Slider({ label, value, min, max, step = 0.01, unit = '', onChange, precision = 2 }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="field">
      <label>
        {label}
        <span className="val">
          {Number(value).toFixed(precision)}
          {unit}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--pct': `${pct}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

export function Vec3({ label, value, step = 0.01, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="vec">
        {['X', 'Y', 'Z'].map((axis, i) => (
          <div className="axis" key={axis}>
            <input
              type="number"
              step={step}
              value={value[i]}
              onChange={(e) => onChange(i, parseFloat(e.target.value) || 0)}
            />
            <span>{axis}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ColorField({ label, value, onChange }) {
  return (
    <div className="field">
      <label>
        {label}
        <span className="val">{value}</span>
      </label>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export function Segmented({ label, value, options, onChange }) {
  return (
    <div className="field">
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
      <label style={{ cursor: 'pointer' }} onClick={() => onChange(!value)}>
        {label}
        <span className="val" style={{ color: value ? 'var(--accent)' : 'var(--muted)' }}>
          {value ? 'On' : 'Off'}
        </span>
      </label>
    </div>
  )
}
