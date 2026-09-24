import React, { useEffect, useRef, useState } from 'react'
import { useStudio } from '../store/useStudio.js'
import { PRESETS, applyPreset } from '../anim/presets.js'

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
            title={`${k.time.toFixed(2)}s — click to load this pose`}
            onClick={(e) => {
              e.stopPropagation()
              setSelected(k.id)
              applyKeyframe(k.id)
            }}
          />
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
            <span className="kbd">+ Keyframe</span> to place one by hand.
          </>
        )}
      </p>
    </div>
  )
}
