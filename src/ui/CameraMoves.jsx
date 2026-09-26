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
 *
 * Settings sit above the menu and again below it, and that is deliberate. The
 * ones above are what the next move will be made from; the ones below retune
 * the move already on the timeline. Guessing the numbers before you have seen
 * the move is the hard way round, so the second set is the one that matters.
 */
export default function CameraMoves() {
  const playhead = useStudio((s) => s.playhead)
  const addCameraMove = useStudio((s) => s.addCameraMove)
  const retuneMove = useStudio((s) => s.retuneMove)
  const lastMove = useStudio((s) => s.lastMove)
  const shake = useStudio((s) => s.shake)
  const setShake = useStudio((s) => s.setShake)
  const [open, setOpen] = useState(null)
  const [seconds, setSeconds] = useState(4)
  const [amount, setAmount] = useState(1)
  const [dir, setDir] = useState(1)

  const add = (id) => {
    const state = useStudio.getState()
    // The framing at the moment the move was asked for, kept so every later
    // adjustment is built from the same starting point. Reading the live
    // camera instead would walk the shot across the room one nudge at a time,
    // and reading the move's own first keyframe would be wrong for parallax,
    // which deliberately opens offset.
    const recipe = { id, seconds, amount, dir, zoom: 1, dist: 1, startTime: playhead, from: state.camera }
    const keys = buildMove(id, state, recipe)
    if (keys) addCameraMove(keys, recipe)
  }

  const retune = (patch) => {
    const recipe = { ...lastMove, ...patch }
    const keys = buildMove(recipe.id, { ...useStudio.getState(), camera: recipe.from }, recipe)
    if (keys) retuneMove(keys, recipe)
  }

  const live = lastMove && MOVES[lastMove.id]

  return (
    <>
      <p className="hint">
        Moves start from the framing you have now and are written onto the timeline at the playhead.
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
              {open === g.id && (
                <>
                  {/*
                    These three belong to the move you are about to pick, not
                    to the camera. Sitting above the menu as plain sliders
                    they read as live settings, and people reached for them
                    expecting the move already on the timeline to change. They
                    only appear once a group is open, next to the thing they
                    affect.
                  */}
                  <div className="fx-newmove">
                    <Slider
                      label="Length" value={seconds} min={0.4} max={12} step={0.1}
                      precision={1} unit="s" onChange={setSeconds}
                    />
                    <Slider
                      label="Size" value={amount} min={0.2} max={2.5} step={0.05}
                      precision={2} onChange={setAmount}
                    />
                    <Segmented
                      label="Direction"
                      value={String(dir)}
                      options={[
                        { value: '-1', label: '◀ Left' },
                        { value: '1', label: 'Right ▶' },
                      ]}
                      onChange={(v) => setDir(Number(v))}
                    />
                  </div>
                  {items.map(([id, m]) => (
                    <button key={id} className="fx-item" onClick={() => add(id)}>
                      {m.label}
                    </button>
                  ))}
                </>
              )}
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

      {live && (
        <div className="subgroup">
          {/* Not a field label: that column is sized for one short word and
              clipped this to "On the ti...". It is a section heading. */}
          <div className="fx-placed">
            <span>On the timeline</span>
            <span className="badge">{MOVES[lastMove.id].label}</span>
          </div>
          <Slider
            label="Length"
            value={lastMove.seconds}
            min={0.4}
            max={12}
            step={0.1}
            precision={1}
            unit="s"
            onChange={(v) => retune({ seconds: v })}
          />
          <Slider
            label="Size"
            value={lastMove.amount}
            min={0}
            max={2.5}
            step={0.05}
            onChange={(v) => retune({ amount: v })}
          />
          <Slider
            label="Zoom"
            value={lastMove.zoom}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => retune({ zoom: v })}
          />
          <Slider
            label="Travel"
            value={lastMove.dist}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => retune({ dist: v })}
          />
          <p className="hint">
            {MOVES[lastMove.id].vertigo
              ? 'Zoom 1.00 holds the subject exactly the same size while the camera pulls back — that lock is the effect. Travel is how far it pulls. Drop Zoom to 0 and it is an ordinary dolly.'
              : 'Zoom is the lens, Travel is the distance the camera covers. Size scales both at once; these two set them against each other.'}
          </p>
        </div>
      )}
    </>
  )
}
