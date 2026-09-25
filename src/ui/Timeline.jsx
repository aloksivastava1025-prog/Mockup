import React, { useEffect, useRef, useState } from 'react'
import { useStudio } from '../store/useStudio.js'
import { PRESETS, applyPreset } from '../anim/presets.js'
import { EASE_LIST } from '../anim/interpolate.js'

export default function Timeline() {
  const trackRef = useRef(null)
  const [selected, setSelected] = useState(null)

  const keyframes = useStudio((s) => s.keyframes)
  const duration = useStudio((s) => s.duration)
  const playhead = useStudio((s) => s.playhead)
  const isPlaying = useStudio((s) => s.isPlaying)
  const setPlaying = useStudio((s) => s.setPlaying)
  const setPlayhead = useStudio((s) => s.setPlayhead)
  const setDuration = useStudio((s) => s.setDuration)
  const addKeyframe = useStudio((s) => s.addKeyframe)
  const removeKeyframe = useStudio((s) => s.removeKeyframe)
  const clearKeyframes = useStudio((s) => s.clearKeyframes)
  const applyKeyframe = useStudio((s) => s.applyKeyframe)
  const moveKeyframe = useStudio((s) => s.moveKeyframe)
  const restampKeyframe = useStudio((s) => s.restampKeyframe)
  const setKeyframeEase = useStudio((s) => s.setKeyframeEase)
  const dragRef = useRef(null)
  const recording = useStudio((s) => s.recording)
  const startRecording = useStudio((s) => s.startRecording)
  const stopRecording = useStudio((s) => s.stopRecording)
  const [recSeconds, setRecSeconds] = useState(0)
  const [recResult, setRecResult] = useState(null)

  // Elapsed readout. The samples themselves are collected by the render loop.
  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setRecSeconds((performance.now() - recording.startedAt) / 1000), 100)
    return () => clearInterval(id)
  }, [recording])

  const toggleRecord = () => {
    if (recording) {
      const n = stopRecording()
      setRecResult(n ? `${n} keyframes captured` : 'Take was too short')
      return
    }
    setRecResult(null)
    setRecSeconds(0)
    // Start the footage from the top so the take lines up with what exports.
    const src = useStudio.getState().source
    if (src?.kind === 'video') {
      src.el.currentTime = 0
      src.el.play().catch(() => {})
    }
    startRecording()
  }

  const scrub = (e) => {
    const rect = trackRef.current.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setPlaying(false)
    setPlayhead(pct * duration)
  }

  // A recorded take can hold hundreds of keyframes; drawing a diamond for each
  // would bury the track. Thin them out for display only.
  const MAX_MARKERS = 120
  const stride = Math.ceil(keyframes.length / MAX_MARKERS)
  const markers = stride > 1 ? keyframes.filter((_, i) => i % stride === 0) : keyframes

  const ticks = []
  const step = duration <= 4 ? 0.5 : duration <= 12 ? 1 : duration <= 30 ? 2 : duration <= 90 ? 10 : 15
  for (let t = 0; t <= duration + 1e-6; t += step) ticks.push(+t.toFixed(2))

  return (
    <div className="timeline">
      <div className="row">
        <button className={`btn ${recording ? 'danger' : ''}`} onClick={toggleRecord} title="Record a live take">
          {recording ? `■ Stop ${recSeconds.toFixed(1)}s` : '● Record'}
        </button>
        <button className="btn" disabled={!!recording} onClick={() => setPlaying(!isPlaying)}>
          {isPlaying ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button className="btn" onClick={() => { setPlaying(false); setPlayhead(0) }}>
          ↺ Start
        </button>
        <button className="btn primary" onClick={() => addKeyframe()}>
          + Keyframe
        </button>
        <button
          className="btn danger"
          disabled={!selected}
          onClick={() => {
            removeKeyframe(selected)
            setSelected(null)
          }}
        >
          Delete
        </button>
        <button className="btn ghost" onClick={() => { clearKeyframes(); setSelected(null) }}>
          Clear
        </button>

        <span className="spacer" />

        <span className="hint">Presets:</span>
        {PRESETS.map((p) => (
          <button key={p.id} className="btn sm" onClick={() => applyPreset(p.id)}>
            {p.label}
          </button>
        ))}

        <span className="spacer" />

        <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Length
          <input
            type="number"
            min={0.5}
            max={300}
            step={0.5}
            value={duration}
            style={{ width: 66 }}
            onChange={(e) => setDuration(parseFloat(e.target.value) || 1)}
          />
          s
        </label>
        <span className="badge">{playhead.toFixed(2)}s</span>
      </div>

      <div className="track" ref={trackRef} onClick={scrub}>
        <div className="ticks">
          {ticks.map((t) => (
            <div className="tick" key={t} style={{ left: `${(t / duration) * 100}%` }}>
              <span>{t}s</span>
            </div>
          ))}
        </div>
        {markers.map((k) => (
          <div
            key={k.id}
            className={`kf ${selected === k.id ? 'sel' : ''}`}
            style={{ left: `${(k.time / duration) * 100}%` }}
            title={`${k.time.toFixed(2)}s — drag to retime, click to open`}
            onPointerDown={(e) => {
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
              // Remember where the press landed. Whether this turns out to be
              // a click or a drag is decided on release, by how far it moved —
              // otherwise selecting a keyframe would nudge it every time.
              dragRef.current = { id: k.id, startX: e.clientX, moved: false }
            }}
            onPointerMove={(e) => {
              const d = dragRef.current
              if (!d || d.id !== k.id) return
              if (!d.moved && Math.abs(e.clientX - d.startX) < 3) return
              d.moved = true
              const rect = trackRef.current.getBoundingClientRect()
              const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
              moveKeyframe(k.id, pct * duration)
            }}
            onPointerUp={(e) => {
              e.stopPropagation()
              const d = dragRef.current
              dragRef.current = null
              if (d && !d.moved) {
                setSelected(selected === k.id ? null : k.id)
                applyKeyframe(k.id)
              }
            }}
          >
            {selected === k.id && (
              <div className="kf-pop" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  max={duration}
                  value={k.time}
                  onChange={(e) => moveKeyframe(k.id, parseFloat(e.target.value) || 0)}
                />
                <span className="unit">s</span>
                <select
                  className="kf-ease"
                  title="How the move leaving this keyframe is timed"
                  value={k.ease ?? 'spline'}
                  onChange={(e) => setKeyframeEase(k.id, e.target.value)}
                >
                  {EASE_LIST.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button title="Save the scene as it looks now into this keyframe" onClick={() => restampKeyframe(k.id)}>
                  Restamp
                </button>
                <button
                  className="danger"
                  title="Delete this keyframe"
                  onClick={() => {
                    removeKeyframe(k.id)
                    setSelected(null)
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
        <div className="playhead" style={{ left: `${(playhead / duration) * 100}%` }} />
      </div>

      <p className="hint">
        {recording ? (
          'Recording — orbit the camera, open the lid, drag any control. It is all captured.'
        ) : recResult ? (
          `${recResult} — press Play to watch it back.`
        ) : (
          <>
            Hit <span className="kbd">● Record</span> and perform the shot, or pose the scene and press{' '}
            <span className="kbd">+ Keyframe</span> to place one by hand. Drag a marker to retime it;
            click it to open its time, restamp or delete.
          </>
        )}
      </p>
    </div>
  )
}
