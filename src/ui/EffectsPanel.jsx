import React, { useState } from 'react'
import { useStudio } from '../store/useStudio.js'
import { Panel } from './controls.jsx'
import { EFFECTS, EFFECT_LIST } from '../scene/post.js'

/**
 * Effects as a stack you build, not a wall of sliders.
 *
 * Most shots use none of these and the ones that do use one or two. A fixed
 * panel of five would put three dead controls in front of everyone forever;
 * a stack shows only what is in play, and the row is the control — a value,
 * an eye to compare with and without, and a minus.
 */
export default function EffectsPanel() {
  const effects = useStudio((s) => s.effects)
  const addEffect = useStudio((s) => s.addEffect)
  const updateEffect = useStudio((s) => s.updateEffect)
  const removeEffect = useStudio((s) => s.removeEffect)
  const [open, setOpen] = useState(false)

  const add = (id) => {
    addEffect(id, EFFECTS[id].initial)
    setOpen(false)
  }

  return (
    <Panel title="Effects" defaultOpen={false}>
      {effects.length === 0 && (
        <p className="hint">Bloom, vignette, chromatic aberration, fish eye and grain. Added ones show up here.</p>
      )}

      {effects.map((e) => {
        const def = EFFECTS[e.type]
        if (!def) return null
        const min = def.min ?? 0
        const pct = ((e.amount - min) / (def.max - min)) * 100
        return (
          <div key={e.id} className={`fx-row ${e.on ? '' : 'muted'}`}>
            <div className="fx-track" style={{ '--pct': `${pct}%` }}>
              <span className="fx-name">{def.label}</span>
              <input
                type="range"
                aria-label={def.label}
                min={min}
                max={def.max}
                step={0.01}
                value={e.amount}
                onChange={(ev) => updateEffect(e.id, { amount: parseFloat(ev.target.value) }, 'amount')}
              />
            </div>
            <span className="fx-value">{e.amount.toFixed(2)}</span>
            <button
              className="fx-btn"
              title={e.on ? 'Mute this effect' : 'Unmute'}
              onClick={() => updateEffect(e.id, { on: !e.on })}
            >
              {e.on ? '◉' : '○'}
            </button>
            <button className="fx-btn" title="Remove" onClick={() => removeEffect(e.id)}>
              −
            </button>
          </div>
        )
      })}

      <div className="fx-add">
        <button className="btn wide" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : '+  Add effect'}
        </button>
        {open && (
          <div className="fx-menu">
            {EFFECT_LIST.map((f) => (
              <button key={f.id} onClick={() => add(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}
