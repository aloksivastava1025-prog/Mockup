import React from 'react'
import { useStudio } from '../store/useStudio.js'
import { Panel, Slider, Toggle } from './controls.jsx'
import { pickImage } from './pickImage.js'

/**
 * The sponsor grid's controls.
 *
 * Picking a slot is done in the scene, not here — you are looking at the
 * floor when you decide which position you want, and a list of nine
 * indistinguishable rows cannot tell you which one is front-left. This panel
 * is what a slot needs *after* it is picked: artwork, a link, and the three
 * numbers that are miserable to set by dragging.
 */
export default function SlotsPanel() {
  const slots = useStudio((s) => s.floorSlots)
  const selectedId = useStudio((s) => s.selectedSlot)
  const visible = useStudio((s) => s.slotsVisible)
  const setVisible = useStudio((s) => s.setSlotsVisible)
  const updateSlot = useStudio((s) => s.updateSlot)
  const removeSlot = useStudio((s) => s.removeSlot)
  const addSlot = useStudio((s) => s.addSlot)
  const selectSlot = useStudio((s) => s.selectSlot)

  const slot = slots.find((s) => s.id === selectedId)
  const filled = slots.filter((s) => s.image || s.label).length

  const upload = async () => {
    const data = await pickImage()
    if (data) updateSlot(slot.id, { image: data })
  }

  return (
    <Panel title="Sponsor slots" defaultOpen={false}>
      <Toggle label="Show slots" value={visible} onChange={setVisible} />
      <p className="hint">
        {filled} of {slots.length} taken. Click a slot on the floor to fill it — an empty one asks
        for an image straight away. Editor only: none of this reaches a render.
      </p>

      <div className="field stacked">
        <div className="seg wrap">
          {slots.map((s, i) => (
            <button
              key={s.id}
              className={selectedId === s.id ? 'on' : ''}
              title={s.label || (s.image ? 'Image' : 'Empty')}
              onClick={() => selectSlot(selectedId === s.id ? null : s.id)}
            >
              {s.image ? '●' : s.label ? '◐' : i + 1}
            </button>
          ))}
        </div>
      </div>

      {!slot ? (
        <p className="hint">Nothing selected. Click a slot in the scene, or a number above.</p>
      ) : (
        <div className="subgroup">
          <div className="field">
            <label>Artwork</label>
            <div className="seg">
              <button onClick={upload}>{slot.image ? 'Replace' : 'Upload'}</button>
              {slot.image && <button onClick={() => updateSlot(slot.id, { image: null })}>Clear</button>}
            </div>
          </div>
          <div className="field">
            <label>Name</label>
            <div className="control">
              <input
                type="text"
                placeholder="Shown when there is no image"
                value={slot.label}
                onChange={(e) => updateSlot(slot.id, { label: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>Link</label>
            <div className="control">
              <input
                type="text"
                placeholder="https://"
                value={slot.url}
                onChange={(e) => updateSlot(slot.id, { url: e.target.value })}
              />
            </div>
          </div>
          <Slider
            label="Size"
            value={slot.size}
            min={0.06}
            max={1.2}
            step={0.01}
            onChange={(v) => updateSlot(slot.id, { size: v })}
          />
          <Slider
            label="Across"
            value={slot.x}
            min={-3}
            max={3}
            step={0.01}
            onChange={(v) => updateSlot(slot.id, { x: v })}
          />
          <Slider
            label="Depth"
            value={slot.z}
            min={-3}
            max={3}
            step={0.01}
            onChange={(v) => updateSlot(slot.id, { z: v })}
          />
          <Slider
            label="Turn"
            value={slot.rot ?? 0}
            min={-180}
            max={180}
            step={1}
            unit="°"
            precision={0}
            onChange={(v) => updateSlot(slot.id, { rot: v })}
          />
          <p className="hint">
            Depth is towards the camera. A slot straight in front of the device ends up under the
            lens in most shots — the flanks and the space behind are where floor is actually in
            frame.
          </p>
          <div className="field">
            <label />
            <button className="btn ghost sm" onClick={() => removeSlot(slot.id)}>
              remove slot
            </button>
          </div>
        </div>
      )}

      <div className="field">
        <label />
        <button className="btn ghost sm" onClick={addSlot}>
          + add slot
        </button>
      </div>
    </Panel>
  )
}
