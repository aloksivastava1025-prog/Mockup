import React, { useState } from 'react'
import { useStudio } from '../store/useStudio.js'
import { ColorField, Panel, Segmented, Slider, Toggle } from './controls.jsx'
import { downloadBlob, exportVideo, RESOLUTIONS } from '../export/exportVideo.js'

export default function RightPanel() {
  const lighting = useStudio((s) => s.lighting)
  const material = useStudio((s) => s.material)
  const background = useStudio((s) => s.background)
  const update = useStudio((s) => s.update)
  const exporting = useStudio((s) => s.exporting)
  const hasVideo = useStudio((s) => !!s.video)

  const [fps, setFps] = useState(30)
  const [resolution, setResolution] = useState('1080p')
  const [error, setError] = useState(null)
  const [lastMode, setLastMode] = useState(null)

  const runExport = async () => {
    setError(null)
    try {
      const { blob, filename, mode } = await exportVideo({ fps, resolution })
      setLastMode(mode)
      downloadBlob(blob, filename)
    } catch (e) {
      console.error(e)
      setError(e.message || String(e))
    }
  }

  return (
    <aside className="sidebar right">
      <Panel title="Lighting">
        <Slider label="Key intensity" value={lighting.keyIntensity} min={0} max={8} step={0.05} onChange={(v) => update('lighting', { keyIntensity: v })} />
        <Slider label="Key direction" value={lighting.keyAzimuth} min={-180} max={180} step={1} unit="°" precision={0} onChange={(v) => update('lighting', { keyAzimuth: v })} />
        <Slider label="Key height" value={lighting.keyElevation} min={5} max={88} step={1} unit="°" precision={0} onChange={(v) => update('lighting', { keyElevation: v })} />
        <Slider label="Fill" value={lighting.fillIntensity} min={0} max={4} step={0.05} onChange={(v) => update('lighting', { fillIntensity: v })} />
        <Slider label="Rim" value={lighting.rimIntensity} min={0} max={6} step={0.05} onChange={(v) => update('lighting', { rimIntensity: v })} />
        <Slider label="Ambient" value={lighting.ambient} min={0} max={2} step={0.01} onChange={(v) => update('lighting', { ambient: v })} />
        <Segmented
          label="Environment"
          value={lighting.envPreset}
          options={[
            { value: 'studio', label: 'Studio' },
            { value: 'softbox', label: 'Soft' },
            { value: 'warm', label: 'Warm' },
            { value: 'none', label: 'None' },
          ]}
          onChange={(v) => update('lighting', { envPreset: v })}
        />
        <Slider label="Reflection strength" value={lighting.envIntensity} min={0} max={3} step={0.05} onChange={(v) => update('lighting', { envIntensity: v })} />
        <Toggle label="Shadows" value={lighting.shadows} onChange={(v) => update('lighting', { shadows: v })} />
        {lighting.shadows && (
          <>
            <Slider label="Shadow opacity" value={lighting.shadowOpacity} min={0} max={1} step={0.01} onChange={(v) => update('lighting', { shadowOpacity: v })} />
            <Slider label="Shadow softness" value={lighting.shadowBlur} min={0} max={8} step={0.1} onChange={(v) => update('lighting', { shadowBlur: v })} />
          </>
        )}
      </Panel>

      <Panel title="Materials" defaultOpen={false}>
        <ColorField label="Body" value={material.bodyColor} onChange={(v) => update('material', { bodyColor: v })} />
        <Slider label="Roughness" value={material.bodyRoughness} min={0} max={1} step={0.01} onChange={(v) => update('material', { bodyRoughness: v })} />
        <Slider label="Metalness" value={material.bodyMetalness} min={0} max={1} step={0.01} onChange={(v) => update('material', { bodyMetalness: v })} />
        <ColorField label="Bezel" value={material.bezelColor} onChange={(v) => update('material', { bezelColor: v })} />
        <Slider label="Glass reflection" value={material.screenReflectivity} min={0} max={0.6} step={0.005} onChange={(v) => update('material', { screenReflectivity: v })} />
      </Panel>

      <Panel title="Background" defaultOpen={false}>
        <Segmented
          value={background.mode}
          options={[
            { value: 'gradient', label: 'Gradient' },
            { value: 'color', label: 'Solid' },
            { value: 'transparent', label: 'None' },
          ]}
          onChange={(v) => update('background', { mode: v })}
        />
        {background.mode === 'gradient' && (
          <>
            <ColorField label="Top" value={background.colorTop} onChange={(v) => update('background', { colorTop: v })} />
            <ColorField label="Bottom" value={background.colorBottom} onChange={(v) => update('background', { colorBottom: v })} />
          </>
        )}
        {background.mode === 'color' && (
          <ColorField label="Colour" value={background.color} onChange={(v) => update('background', { color: v })} />
        )}
        <Toggle label="Reflective floor" value={background.groundVisible} onChange={(v) => update('background', { groundVisible: v })} />
      </Panel>

      <Panel title="Export">
        <Segmented
          label="Resolution"
          value={resolution}
          options={Object.keys(RESOLUTIONS).map((k) => ({ value: k, label: k }))}
          onChange={setResolution}
        />
        <Segmented
          label="Frame rate"
          value={fps}
          options={[
            { value: 24, label: '24' },
            { value: 30, label: '30' },
            { value: 60, label: '60' },
          ]}
          onChange={setFps}
        />
        <button className="btn primary" disabled={!!exporting || !hasVideo} onClick={runExport}>
          {exporting ? `${exporting.phase}… ${Math.round(exporting.progress * 100)}%` : 'Export video'}
        </button>
        {exporting && (
          <div className="progress">
            <i style={{ width: `${exporting.progress * 100}%` }} />
          </div>
        )}
        {!hasVideo && <p className="hint">Upload a screen recording first.</p>}
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
