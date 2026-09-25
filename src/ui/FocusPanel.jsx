import React, { useEffect, useRef, useState } from 'react'
import { useStudio } from '../store/useStudio.js'
import { Panel, Slider } from './controls.jsx'
import { buildFocusMove } from '../anim/focusMove.js'
import { aspectRatio } from '../export/exportVideo.js'

/**
 * Pick the parts of the page worth looking at, get a camera move that visits
 * them.
 *
 * Areas are drawn on a flat thumbnail of the source rather than on the device
 * in the viewport. The screen in the viewport is small, tilted and in
 * perspective, so an axis-aligned rectangle dragged across it does not mean
 * what it looks like it means — and the region being chosen belongs to the
 * page, not to the 3D scene. On the thumbnail the drag is exactly the crop.
 */
export default function FocusPanel() {
  const source = useStudio((s) => s.source)
  const focus = useStudio((s) => s.focus)
  const playhead = useStudio((s) => s.playhead)
  const addFocusArea = useStudio((s) => s.addFocusArea)
  const removeFocusArea = useStudio((s) => s.removeFocusArea)
  const clearFocusAreas = useStudio((s) => s.clearFocusAreas)
  const updateFocus = useStudio((s) => s.updateFocus)

  const boxRef = useRef(null)
  const canvasRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [error, setError] = useState(null)

  // Keep the thumbnail showing the frame that is on the device right now.
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !source?.el) return
    const w = 220
    const h = Math.max(1, Math.round(w / (source.width / source.height)))
    c.width = w
    c.height = h
    try {
      c.getContext('2d').drawImage(source.el, 0, 0, w, h)
    } catch {
      // A video that has not produced a frame yet throws; the next pass gets it.
    }
  }, [source, playhead])

  if (!source) {
    return (
      <Panel title="Focus">
        <p className="hint">Add a recording or screenshot first.</p>
      </Panel>
    )
  }

  const norm = (e) => {
    const r = boxRef.current.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    }
  }

  const rectOf = (d) => ({
    x: Math.min(d.a.x, d.b.x),
    y: Math.min(d.a.y, d.b.y),
    w: Math.abs(d.b.x - d.a.x),
    h: Math.abs(d.b.y - d.a.y),
  })

  const onDown = (e) => {
    e.preventDefault()
    boxRef.current.setPointerCapture(e.pointerId)
    const p = norm(e)
    setDrag({ a: p, b: p })
  }
  const onMove = (e) => drag && setDrag((d) => ({ ...d, b: norm(e) }))
  const onUp = () => {
    if (!drag) return
    const r = rectOf(drag)
    setDrag(null)
    // A click rather than a drag; too small to frame and almost certainly a slip.
    if (r.w < 0.04 || r.h < 0.04) return
    addFocusArea(r)
  }

  const build = () => {
    setError(null)
    const move = buildFocusMove(focus, aspectRatio('16:9'))
    if (!move) {
      setError('Could not read the display. Give the scene a moment and try again.')
      return
    }
    useStudio.getState().commit()
    useStudio.getState().setDuration(move.duration)
    useStudio.setState({ keyframes: move.keyframes, playhead: 0, previewLive: false })
  }

  const live = drag ? rectOf(drag) : null
  const pct = (v) => `${v * 100}%`

  return (
    <Panel title="Focus">
      <div
        ref={boxRef}
        className="focus-box"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <canvas ref={canvasRef} />
        {focus.areas.map((a, i) => (
          <div key={a.id} className="focus-rect" style={{ left: pct(a.x), top: pct(a.y), width: pct(a.w), height: pct(a.h) }}>
            <span>{i + 1}</span>
          </div>
        ))}
        {live && (
          <div className="focus-rect live" style={{ left: pct(live.x), top: pct(live.y), width: pct(live.w), height: pct(live.h) }} />
        )}
      </div>
      <p className="hint">
        {focus.areas.length
          ? `${focus.areas.length} area${focus.areas.length > 1 ? 's' : ''}. The camera opens wide, visits each in order, then pulls back out.`
          : 'Drag a box over the part of the page the camera should go to. Drag again for the next one.'}
      </p>

      {focus.areas.map((a, i) => (
        <div key={a.id} className="field">
          <label>Area {i + 1}</label>
          <button className="btn ghost sm" onClick={() => removeFocusArea(a.id)}>
            remove
          </button>
        </div>
      ))}

      {focus.areas.length > 0 && (
        <>
          <Slider label="Open" value={focus.open} min={0} max={4} step={0.1} precision={1} unit="s" onChange={(v) => updateFocus({ open: v }, 'open')} />
          <Slider label="Travel" value={focus.travel} min={0.3} max={5} step={0.1} precision={1} unit="s" onChange={(v) => updateFocus({ travel: v }, 'travel')} />
          <Slider label="Hold" value={focus.hold} min={0.2} max={6} step={0.1} precision={1} unit="s" onChange={(v) => updateFocus({ hold: v }, 'hold')} />
          <button className="btn primary wide" onClick={build}>
            Build camera move
          </button>
          <button className="btn wide" onClick={clearFocusAreas}>
            Clear areas
          </button>
        </>
      )}
      {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
    </Panel>
  )
}
