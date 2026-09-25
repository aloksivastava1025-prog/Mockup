import React, { useState } from 'react'
import { useStudio } from '../store/useStudio.js'
import { Segmented, Slider } from './controls.jsx'
import { MOVES, MOVE_GROUPS, buildMove } from '../anim/cameraMoves.js'

/**
 * A move library, so a shot does not have to be typed in coordinates.
 *
 * Every move is relative to how the camera is framed right now, which is the
 * whole point: frame a low three-quarter by hand, ask for an orbit, and you
 * get a low three-quarter orbit. Grouped and collapsed for the same reason the
 * effects menu is — fifteen names in a column is a list to read, not a menu.
 */
export default function CameraMoves() {
  const playhead = useStudio((s) => s.playhead)
  const addCameraMove = useStudio((s) => s.addCameraMove)
  const shake = useStudio((s) => s.shake)
  const setShake = useStudio((s) => s.setShake)
  const [open, setOpen] = useState(null)
  const [seconds, setSeconds] = useState(4)
  const [amount, setAmount] = useState(1)
  const [dir, setDir] = useState(1)

  const add = (id) => {
    const keys = buildMove(id, useStudio.getState(), { seconds, amount, startTime: playhead, dir })
    if (keys) addCameraMove(keys)
  }

  return (
    <>
      <Slider label="Move length" value={seconds} min={0.4} max={12} step={0.1} precision={1} unit="s" onChange={setSeconds} />
      <Slider label="Move size" value={amount} min={0.2} max={2.5} step={0.05} precision={2} onChange={setAmount} />
      <Segmented
        label="Direction"
        value={String(dir)}
        options={[
          { value: '-1', label: '◀ Left' },
          { value: '1', label: 'Right ▶' },
        ]}
        onChange={(v) => setDir(Number(v))}
      />
      <p className="hint">
        Moves start from the framing you have now and are written onto the timeline at the playhead.
        Direction mirrors the sideways ones — an orbit, an arc, a truck. It does nothing to a dolly
        or a crane, where the opposite already has its own name.
      </p>
      <div className="fx-menu" style={{ position: 'static', boxShadow: 'none' }}>
        {MOVE_GROUPS.map((g) => {
          const items = Object.entries(MOVES).filter(([, m]) => m.group === g.id)
          return (
            <div key={g.id} className="fx-group">
              <button
                className={`fx-group-head ${open === g.id ? 'open' : ''}`}
                onClick={() => setOpen(open === g.id ? null : g.id)}
              >
                <span className="chev">▶</span>
                {g.label}
                <span className="count">{items.length}</span>
              </button>
              {open === g.id &&
                items.map(([id, m]) => (
                  <button key={id} className="fx-item" onClick={() => add(id)}>
                    {m.label}
                  </button>
                ))}
            </div>
          )
        })}
        <div className="fx-group">
          <button
            className={`fx-group-head ${open === 'hand' ? 'open' : ''}`}
            onClick={() => setOpen(open === 'hand' ? null : 'hand')}
          >
            <span className="chev">▶</span>
            Handheld
            <span className="count">2</span>
          </button>
          {open === 'hand' && (
            <>
              {/* Not keyframes: handheld is the shake layer, which rides over
                  whatever move is underneath rather than being one itself. */}
              <button className="fx-item" onClick={() => setShake({ amount: 0.6 })}>
                Handheld {shake.amount > 0 ? '(on)' : ''}
              </button>
              <button className="fx-item" onClick={() => setShake({ amount: 1.4, speed: 1.6 })}>
                Heavy shake
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
