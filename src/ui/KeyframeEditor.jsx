import React, { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStudio } from '../store/useStudio.js'
import { Slider } from './controls.jsx'
import { EASE_LIST } from '../anim/interpolate.js'
import { orbitOf, placeOrbit } from '../anim/cameraMoves.js'

/**
 * Everything about one keyframe, in a card over the timeline.
 *
 * Rendered into `document.body` rather than inside the track. The timeline
 * clips its overflow so the row of preset buttons can scroll, and a popup
 * anchored inside it got its top sliced off — which is what it was doing.
 *
 * The camera is edited as an orbit rather than as xyz, because "closer" and
 * "higher" are the two things anyone actually wants from a keyframe, and both
 * are three coupled numbers in cartesian. Aim stays where it is, so the
 * subject does not slide out of frame while you adjust.
 */
const W = 244

export default function KeyframeEditor({ kf, trackRef, duration, onClose }) {
  const moveKeyframe = useStudio((s) => s.moveKeyframe)
  const restampKeyframe = useStudio((s) => s.restampKeyframe)
  const removeKeyframe = useStudio((s) => s.removeKeyframe)
  const setKeyframeEase = useStudio((s) => s.setKeyframeEase)
  const setKeyframeCamera = useStudio((s) => s.setKeyframeCamera)
  const setKeyframeSpeed = useStudio((s) => s.setKeyframeSpeed)
  const keyframes = useStudio((s) => s.keyframes)
  const [box, setBox] = useState(null)

  useLayoutEffect(() => {
    const place = () => {
      const r = trackRef.current?.getBoundingClientRect()
      if (!r) return
      const x = r.left + (kf.time / duration) * r.width
      setBox({
        left: Math.max(8, Math.min(window.innerWidth - W - 8, x - W / 2)),
        bottom: window.innerHeight - r.top + 10,
        // The card grows upward from the track, and the track is already near
        // the bottom of the window. On a short screen it would run off the top
        // with the ease control out of reach, so the sliders scroll instead.
        maxHeight: Math.max(180, r.top - 18),
      })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [kf.time, duration, trackRef])

  if (!box) return null

  // The segment this keyframe owns: the gap to whichever keyframe is next.
  const sorted = [...keyframes].sort((a, b) => a.time - b.time)
  const idx = sorted.findIndex((k) => k.id === kf.id)
  const nextKf = idx >= 0 ? sorted[idx + 1] : null
  const span = nextKf ? +(nextKf.time - kf.time).toFixed(2) : 0
  const speed = kf.speed ?? 1

  const cam = kf.state.camera
  const orbit = orbitOf(cam.position, cam.target)
  // Only the axis being dragged changes; the other two are read straight back
  // out of the pose, so a round trip through the sliders is a no-op.
  const reorbit = (patch) => {
    const next = { ...orbit, ...patch }
    setKeyframeCamera(kf.id, {
      position: placeOrbit(cam.target, next).map((v) => +v.toFixed(4)),
    })
  }

  return createPortal(
    <div
      className="kf-pop"
      style={{ left: box.left, bottom: box.bottom, width: W, maxHeight: box.maxHeight }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="kf-pop-head">
        <span className="kf-pop-title">Keyframe</span>
        <input
          type="number"
          step={0.05}
          min={0}
          max={duration}
          value={kf.time}
          onChange={(e) => moveKeyframe(kf.id, parseFloat(e.target.value) || 0)}
        />
        <span className="unit">s</span>
        <button className="kf-pop-x" title="Close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="kf-pop-body">
        <div className="field">
          <label>Ease out</label>
          <div className="control">
            <select
              className="select"
              title="How the move leaving this keyframe is timed"
              value={kf.ease ?? 'spline'}
              onChange={(e) => setKeyframeEase(kf.id, e.target.value)}
            >
              {EASE_LIST.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {nextKf && span > 0.01 && (
          <>
            <Slider
              label="Speed"
              value={speed}
              min={0.25}
              max={4}
              step={0.05}
              unit="×"
              onChange={(v) => setKeyframeSpeed(kf.id, v)}
            />
            <p className="hint">
              This stretches the {span}s up to the next keyframe and slides everything after it
              along. Under 1 is slow motion; easing changes the feel inside a segment, this changes
              how long the segment is.
            </p>
          </>
        )}
        <Slider
          label="Zoom"
          value={cam.fov}
          min={10}
          max={90}
          step={0.5}
          precision={1}
          unit="°"
          onChange={(v) => setKeyframeCamera(kf.id, { fov: v })}
        />
        <Slider
          label="Distance"
          value={orbit.d}
          min={0.15}
          max={4}
          step={0.01}
          onChange={(v) => reorbit({ d: v })}
        />
        <Slider
          label="Height"
          value={orbit.el}
          min={-20}
          max={85}
          step={0.5}
          precision={1}
          unit="°"
          onChange={(v) => reorbit({ el: v })}
        />
        <Slider
          label="Turn"
          value={orbit.az}
          min={-180}
          max={180}
          step={0.5}
          precision={1}
          unit="°"
          onChange={(v) => reorbit({ az: v })}
        />
        <p className="hint">
          Zoom is the lens; Distance walks the camera in and out. Tight lens from far away flattens
          the device, wide lens up close exaggerates it — the two are not the same shot.
        </p>
      </div>

      <div className="kf-pop-foot">
        <button title="Save the scene as it looks now into this keyframe" onClick={() => restampKeyframe(kf.id)}>
          Restamp
        </button>
        <button
          className="danger"
          title="Delete this keyframe"
          onClick={() => {
            removeKeyframe(kf.id)
            onClose()
          }}
        >
          Delete
        </button>
      </div>
    </div>,
    document.body,
  )
}
