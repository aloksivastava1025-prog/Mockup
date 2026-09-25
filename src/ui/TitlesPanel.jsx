import React from 'react'
import { useStudio } from '../store/useStudio.js'
import { ColorField, Panel, Segmented, Slider } from './controls.jsx'

/**
 * Text over the shot.
 *
 * Titles are not keyframed. A caption appears, sits there and leaves, so it
 * carries an in-point and a duration; putting it on the timeline as an
 * interpolated value would mean four keyframes to say "show this for three
 * seconds", and every one of them would have to be moved to retime it.
 */
export default function TitlesPanel() {
  const titles = useStudio((s) => s.titles)
  const duration = useStudio((s) => s.duration)
  const addTitle = useStudio((s) => s.addTitle)
  const updateTitle = useStudio((s) => s.updateTitle)
  const removeTitle = useStudio((s) => s.removeTitle)
  const setPlayhead = useStudio((s) => s.setPlayhead)

  return (
    <Panel title="Text" defaultOpen={false}>
      <button className="btn wide" onClick={addTitle}>
        Add text
      </button>
      {titles.length === 0 && (
        <p className="hint">
          Headlines and captions over the shot. They render into the export, not just the preview.
        </p>
      )}

      {titles.map((t, i) => (
        <div key={t.id} className="subgroup">
          <div className="field">
            <label>Text {i + 1}</label>
            <button className="btn ghost sm" onClick={() => removeTitle(t.id)}>
              remove
            </button>
          </div>
          <div className="field stacked">
            <input
              className="text-input"
              value={t.text}
              placeholder="Your headline"
              onChange={(e) => updateTitle(t.id, { text: e.target.value }, 'text')}
            />
          </div>
          <Segmented
            label="Style"
            value={t.anim}
            options={[
              { value: 'fade', label: 'Fade' },
              { value: 'rise', label: 'Rise' },
              { value: 'wipe', label: 'Wipe' },
            ]}
            onChange={(v) => updateTitle(t.id, { anim: v })}
          />
          <Slider label="In" value={t.in} min={0} max={Math.max(1, duration)} step={0.1} precision={1} unit="s" onChange={(v) => { updateTitle(t.id, { in: v }, 'in'); setPlayhead(Math.min(duration, v + 0.6)) }} />
          <Slider label="Hold" value={t.dur} min={0.4} max={Math.max(1, duration)} step={0.1} precision={1} unit="s" onChange={(v) => updateTitle(t.id, { dur: v }, 'dur')} />
          <Slider label="Size" value={t.size} min={0.02} max={0.2} step={0.005} precision={3} onChange={(v) => updateTitle(t.id, { size: v }, 'size')} />
          <Slider label="Across" value={t.x} min={0} max={1} step={0.01} precision={2} onChange={(v) => updateTitle(t.id, { x: v }, 'x')} />
          <Slider label="Down" value={t.y} min={0} max={1} step={0.01} precision={2} onChange={(v) => updateTitle(t.id, { y: v }, 'y')} />
          <ColorField label="Colour" value={t.color} onChange={(v) => updateTitle(t.id, { color: v })} />
        </div>
      ))}
    </Panel>
  )
}
