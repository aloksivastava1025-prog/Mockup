import React, { useRef, useState } from 'react'
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

  const scrub = (e) => {
    const rect = trackRef.current.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setPlaying(false)
    setPlayhead(pct * duration)
  }

  const ticks = []
  const step = duration <= 4 ? 0.5 : duration <= 12 ? 1 : 2
  for (let t = 0; t <= duration + 1e-6; t += step) ticks.push(t)

  return (
    <div className="timeline">
      <div className="row">
        <button className="btn" onClick={() => setPlaying(!isPlaying)}>
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

        <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Duration
          <input
            type="number"
            min={0.5}
            max={60}
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
        {keyframes.map((k) => (
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
        Pose the scene, then hit <span className="kbd">+ Keyframe</span> to pin it at the playhead. Two or more
        keyframes animate; everything between them is eased automatically.
      </p>
    </div>
  )
}
