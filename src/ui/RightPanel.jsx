import React, { useRef, useState } from 'react'
import { useStudio } from '../store/useStudio.js'
import { ColorField, Panel, Segmented, Select, Slider, Toggle } from './controls.jsx'
import { ASPECTS, canEncodeMp4, dimensionsFor, downloadBlob, exportImage, exportVideo, SIZE_LABELS } from '../export/exportVideo.js'
import { LOCATIONS, applyLocation } from '../scene/locations.js'
import { SURFACES } from '../scene/surfaces.js'

export default function RightPanel({ onCollapse }) {
  const lighting = useStudio((s) => s.lighting)
  const material = useStudio((s) => s.material)
  const background = useStudio((s) => s.background)
  const update = useStudio((s) => s.update)
  const exporting = useStudio((s) => s.exporting)
  const hasSource = useStudio((s) => !!s.source)
  const locationId = useStudio((s) => s.locationId)
  const backdrop = useStudio((s) => s.backdrop)
  const setBackdrop = useStudio((s) => s.setBackdrop)
  const backdropRef = useRef(null)

  const loadBackdrop = (file) => {
    if (!file) return
    const prev = useStudio.getState().backdrop
    if (prev?.url) URL.revokeObjectURL(prev.url)
    const url = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () => {
      setBackdrop({ el, url, name: file.name })
      useStudio.getState().update('background', { mode: 'image' })
    }
    el.onerror = () => setError(`Could not read "${file.name}".`)
    el.src = url
  }

  const [fps, setFps] = useState(30)
  const [aspect, setAspect] = useState('16:9')
  const [size, setSize] = useState('M')
  const [draft, setDraft] = useState(false)
  // Shutter samples per frame. Off by default: it multiplies render time, and
  // a still composition has nothing to blur.
  const [blurSamples, setBlurSamples] = useState(1)
  // Aperture, 0 = pinhole. Also off by default: it needs the same sample
  // budget as full motion blur.
  const [depth, setDepth] = useState(0)
  const [transparent, setTransparent] = useState(false)
  // Screen recordings are full of small text, which is where a low bitrate
  // shows first — default to the higher setting rather than the smaller file.
  const [bitrateMbps, setBitrateMbps] = useState(14)
  const [error, setError] = useState(null)
  const [lastMode, setLastMode] = useState(null)
  const [batch, setBatch] = useState(null)

  const dims = dimensionsFor(aspect, size, draft)

  const runExport = async () => {
    setError(null)
    try {
      const { blob, filename, mode } = await exportVideo({ fps, aspect, size, bitrateMbps, draft, blurSamples, depth })
      setLastMode(mode)
      downloadBlob(blob, filename)
    } catch (e) {
      console.error(e)
      setError(e.message || String(e))
    }
  }

  /**
   * Every framing in one pass. Rendered one after another rather than in
   * parallel: they all drive the same renderer and the same video element, so
   * overlapping them would have two exports fighting over one camera.
   */
  const runAllFormats = async () => {
    setError(null)
    const all = Object.keys(ASPECTS)
    try {
      for (let i = 0; i < all.length; i++) {
        setBatch({ done: i, total: all.length, aspect: all[i] })
        const { blob, filename, mode } = await exportVideo({
          fps, size, bitrateMbps, draft, blurSamples, depth, aspect: all[i],
        })
        setLastMode(mode)
        downloadBlob(blob, filename.replace(/(\.\w+)$/, `-${all[i].replace(':', 'x')}$1`))
      }
    } catch (e) {
      console.error(e)
      setError(e.message || String(e))
    } finally {
      setBatch(null)
    }
  }

  const runImage = async () => {
    setError(null)
    try {
      const { blob, filename } = await exportImage({ aspect, size, transparent, depth })
      downloadBlob(blob, filename)
    } catch (e) {
      console.error(e)
      setError(e.message || String(e))
    }
  }

  return (
    <aside className="sidebar right">
      <div className="panel-bar right">
        <button onClick={onCollapse} title="Collapse this panel">
          ▶
        </button>
      </div>
      <Panel title="Lighting">
        <Slider label="Key" value={lighting.keyIntensity} min={0} max={8} step={0.05} onChange={(v) => update('lighting', { keyIntensity: v })} />
        <Slider label="Direction" value={lighting.keyAzimuth} min={-180} max={180} step={1} unit="°" precision={0} onChange={(v) => update('lighting', { keyAzimuth: v })} />
        <Slider label="Height" value={lighting.keyElevation} min={5} max={88} step={1} unit="°" precision={0} onChange={(v) => update('lighting', { keyElevation: v })} />
        <Slider label="Fill" value={lighting.fillIntensity} min={0} max={4} step={0.05} onChange={(v) => update('lighting', { fillIntensity: v })} />
        <Slider label="Rim" value={lighting.rimIntensity} min={0} max={6} step={0.05} onChange={(v) => update('lighting', { rimIntensity: v })} />
        <Slider label="Ambient" value={lighting.ambient} min={0} max={2} step={0.01} onChange={(v) => update('lighting', { ambient: v })} />
        <Segmented
          label="Env"
          value={lighting.envPreset}
          options={[
            { value: 'studio', label: 'Studio' },
            { value: 'softbox', label: 'Soft' },
            { value: 'warm', label: 'Warm' },
            { value: 'none', label: 'None' },
          ]}
          onChange={(v) => update('lighting', { envPreset: v })}
        />
        <Slider label="Reflection" value={lighting.envIntensity} min={0} max={3} step={0.05} onChange={(v) => update('lighting', { envIntensity: v })} />
        <Toggle label="Shadows" value={lighting.shadows} onChange={(v) => update('lighting', { shadows: v })} />
        {lighting.shadows && (
          <>
            <Slider label="Opacity" value={lighting.shadowOpacity} min={0} max={1} step={0.01} onChange={(v) => update('lighting', { shadowOpacity: v })} />
            <Slider label="Softness" value={lighting.shadowBlur} min={0} max={8} step={0.1} onChange={(v) => update('lighting', { shadowBlur: v })} />
          </>
        )}
      </Panel>

      <Panel title="Materials" defaultOpen={false}>
        <ColorField label="Body" value={material.bodyColor} onChange={(v) => update('material', { bodyColor: v })} />
        <Slider label="Roughness" value={material.bodyRoughness} min={0} max={1} step={0.01} onChange={(v) => update('material', { bodyRoughness: v })} />
        <Slider label="Metalness" value={material.bodyMetalness} min={0} max={1} step={0.01} onChange={(v) => update('material', { bodyMetalness: v })} />
        <ColorField label="Bezel" value={material.bezelColor} onChange={(v) => update('material', { bezelColor: v })} />
        <Slider label="Backlight" value={material.keyBacklight ?? 0.5} min={0} max={2} step={0.02} onChange={(v) => update('material', { keyBacklight: v })} />
        <Slider label="Glass" value={material.screenReflectivity} min={0} max={0.6} step={0.005} onChange={(v) => update('material', { screenReflectivity: v })} />
      </Panel>

      <Panel title="Location">
        <Select
          label="Preset"
          value={locationId}
          options={Object.entries(LOCATIONS).map(([id, l]) => ({ value: id, label: l.label }))}
          onChange={(id) => applyLocation(id, useStudio)}
        />
        <p className="hint">Sets the surface, backdrop and light together. Tune any of them below.</p>
        <Toggle label="Props" value={!!background.props} onChange={(v) => update('background', { props: v })} />
        <Toggle label="Floor" value={background.groundVisible} onChange={(v) => update('background', { groundVisible: v })} />
        {background.groundVisible && (
          <Select
            label="Surface"
            value={background.surface ?? 'studio'}
            options={Object.entries(SURFACES).map(([k, v]) => ({ value: k, label: v.label }))}
            onChange={(v) => update('background', { surface: v })}
          />
        )}
      </Panel>

      <Panel title="Background" defaultOpen={false}>
        <Segmented
          value={background.mode}
          options={[
            { value: 'gradient', label: 'Gradient' },
            { value: 'color', label: 'Solid' },
            { value: 'scene', label: 'Room' },
            { value: 'image', label: 'Image' },
            { value: 'transparent', label: 'None' },
          ]}
          onChange={(v) => update('background', { mode: v })}
        />
        {background.mode === 'image' && (
          <>
            <input
              ref={backdropRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => loadBackdrop(e.target.files?.[0])}
            />
            <button className="btn wide" onClick={() => backdropRef.current?.click()}>
              {backdrop ? 'Replace backdrop' : 'Choose backdrop image'}
            </button>
            <p className="hint">
              {backdrop
                ? `${backdrop.name} — kept at its own aspect whatever you export to. Place the device over it with Position, Tilt and Float; turn the Floor off so it sits on your image rather than on a surface.`
                : 'Your own image behind the device.'}
            </p>
          </>
        )}
        {background.mode === 'gradient' && (
          <>
            <ColorField label="Top" value={background.colorTop} onChange={(v) => update('background', { colorTop: v })} />
            <ColorField label="Bottom" value={background.colorBottom} onChange={(v) => update('background', { colorBottom: v })} />
          </>
        )}
        {background.mode === 'color' && (
          <ColorField label="Colour" value={background.color} onChange={(v) => update('background', { color: v })} />
        )}
        {background.groundVisible && (
          <ColorField
            label="Floor tint"
            value={background.groundColor ?? '#d4d4d4'}
            onChange={(v) => update('background', { groundColor: v })}
          />
        )}
      </Panel>

      <Panel title="Export">
        <Segmented
          label="Format"
          value={aspect}
          options={Object.keys(ASPECTS).map((k) => ({ value: k, label: k }))}
          onChange={setAspect}
        />
        <p className="hint">{ASPECTS[aspect].label} · {dims[0]}×{dims[1]}</p>
        <Segmented
          label="Size"
          value={size}
          options={Object.keys(SIZE_LABELS).map((k) => ({ value: k, label: SIZE_LABELS[k] }))}
          onChange={setSize}
        />
        <Segmented
          label="Rate"
          value={fps}
          options={[
            { value: 24, label: '24' },
            { value: 30, label: '30' },
            { value: 60, label: '60' },
          ]}
          onChange={setFps}
        />
        <Segmented
          label="Quality"
          value={bitrateMbps}
          options={[
            { value: 8, label: 'Standard' },
            { value: 14, label: 'High' },
            { value: 24, label: 'Max' },
          ]}
          onChange={setBitrateMbps}
        />
        <Segmented
          label="Blur"
          value={blurSamples}
          options={[
            { value: 1, label: 'Off' },
            { value: 4, label: 'Light' },
            { value: 8, label: 'Full' },
          ]}
          onChange={setBlurSamples}
        />
        <p className="hint">
          {blurSamples > 1
            ? `Motion blur — ${blurSamples} samples across a 180° shutter, so fast moves read as filmed rather than as stop-motion. Roughly ${blurSamples}x slower to render, and off in Draft.`
            : 'No motion blur. Every frame is an instant, which is what makes quick moves look like stop-motion.'}
        </p>
        <Slider label="Depth" value={depth} min={0} max={1} step={0.02} precision={2} onChange={setDepth} />
        <p className="hint">
          {depth > 0
            ? 'Aperture. Whatever the camera is aimed at stays sharp and the rest falls off, the way a lens behaves. Uses at least 8 samples, so it costs the same as full blur.'
            : 'Pinhole — everything sharp at every distance. Open the aperture for a photographic falloff.'}
        </p>
        <Toggle label="Draft" value={draft} onChange={setDraft} />
        <p className="hint">
          {draft
            ? 'Small, 24fps, no mipmaps, no blur — roughly 3x faster for checking timing.'
            : 'Full resolution and sharpening. Slower; use Draft to check timing first.'}
        </p>

        <button className="btn primary wide" disabled={!!exporting || !hasSource} onClick={runExport}>
          {exporting ? `${exporting.phase}… ${Math.round(exporting.progress * 100)}%` : draft ? 'Export draft' : 'Export video'}
        </button>
        <button className="btn wide" disabled={!!exporting || !hasSource} onClick={runAllFormats}>
          Export all 4 formats
        </button>
        <p className="hint">
          {batch
            ? `Rendering ${batch.done + 1} of ${batch.total} — ${batch.aspect}.`
            : 'Landscape, story, square and portrait in one go — the set a launch post usually needs.'}
        </p>

        <Toggle label="Cutout" value={transparent} onChange={setTransparent} />
        <button className="btn wide" disabled={!!exporting || !hasSource} onClick={runImage}>
          Export PNG (this frame)
        </button>
        <p className="hint">
          {transparent
            ? 'PNG with a transparent background — drops the floor and backdrop.'
            : 'PNG of the current playhead at full resolution.'}
        </p>

        {exporting && (
          <div className="progress">
            <i style={{ width: `${exporting.progress * 100}%` }} />
          </div>
        )}
        {!hasSource && <p className="hint">Add a recording or screenshot first.</p>}
        {!canEncodeMp4() && (
          <p className="hint" style={{ color: 'var(--danger)' }}>
            This browser has no WebCodecs, so exports are captured in real time as WebM rather than
            encoded as MP4 — slower, and not frame-accurate. Chrome or Edge will give you an MP4.
          </p>
        )}
        {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
        {lastMode === 'realtime-webm' && (
          <p className="hint">
            WebCodecs is unavailable in this browser, so the clip was captured in real time as WebM.
          </p>
        )}
        <p className="hint">
          Renders the timeline frame by frame at full resolution — playback speed in the viewport does not affect
          the result. Video is exported without audio.
        </p>
      </Panel>
    </aside>
  )
}
