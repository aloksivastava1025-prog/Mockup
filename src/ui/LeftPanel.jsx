import React from 'react'
import { useStudio } from '../store/useStudio.js'
import { DEVICE_LIST, COMING_SOON } from '../devices/index.js'
import { Panel, Segmented, Slider, Toggle, Vec3 } from './controls.jsx'

function ResetBtn({ group }) {
  const resetGroup = useStudio((s) => s.resetGroup)
  return (
    <button
      className="btn ghost sm"
      onClick={(e) => {
        e.stopPropagation()
        resetGroup(group)
      }}
    >
      reset
    </button>
  )
}

export default function LeftPanel() {
  const deviceId = useStudio((s) => s.deviceId)
  const setDevice = useStudio((s) => s.setDevice)
  const device = useStudio((s) => s.device)
  const camera = useStudio((s) => s.camera)
  const screen = useStudio((s) => s.screen)
  const update = useStudio((s) => s.update)
  const setAxis = useStudio((s) => s.setAxis)
  const orbitEnabled = useStudio((s) => s.orbitEnabled)
  const setOrbitEnabled = useStudio((s) => s.setOrbitEnabled)
  const adaptScreen = useStudio((s) => s.adaptScreen)
  const setAdaptScreen = useStudio((s) => s.setAdaptScreen)

  return (
    <aside className="sidebar left">
      <Panel title="Device">
        <div className="field stacked">
          <div className="seg">
            {DEVICE_LIST.map((d) => (
              <button key={d.id} className={deviceId === d.id ? 'on' : ''} onClick={() => setDevice(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <p className="hint">Coming soon: {COMING_SOON.map((d) => d.label).join(', ')}.</p>
      </Panel>

      <Panel title="Transform" right={<ResetBtn group="device" />}>
        <Vec3 label="Position" value={device.position} step={0.01} onChange={(i, v) => setAxis('device', 'position', i, v)} />
        <Vec3 label="Rotation" value={device.rotation} step={1} onChange={(i, v) => setAxis('device', 'rotation', i, v)} />
        <Slider
          label="Lid"
          value={device.lidAngle}
          min={0}
          max={130}
          step={0.5}
          unit="°"
          precision={0}
          onChange={(v) => update('device', { lidAngle: v })}
        />
        <Slider label="Scale" value={device.scale} min={0.2} max={4} step={0.01} onChange={(v) => update('device', { scale: v })} />
      </Panel>

      <Panel title="Camera" right={<ResetBtn group="camera" />}>
        <Toggle label="Orbit" value={orbitEnabled} onChange={setOrbitEnabled} />
        <Vec3 label="Position" value={camera.position} step={0.05} onChange={(i, v) => setAxis('camera', 'position', i, v)} />
        <Vec3 label="Look at" value={camera.target} step={0.05} onChange={(i, v) => setAxis('camera', 'target', i, v)} />
        <Slider
          label="Focal"
          value={camera.fov}
          min={10}
          max={90}
          step={0.5}
          unit="°"
          precision={1}
          onChange={(v) => update('camera', { fov: v })}
        />
        <p className="hint">
          Low FOV = telephoto, flatter and more product-like. High FOV = wide angle, more dramatic perspective.
        </p>
      </Panel>

      <Panel title="Screen" right={<ResetBtn group="screen" />} defaultOpen={false}>
        <Toggle label="Adapt" value={adaptScreen} onChange={setAdaptScreen} />
        <p className="hint">
          {adaptScreen
            ? 'Display reshaped to your footage — fills it exactly, no crop or bars.'
            : 'Using the real device aspect. Fit decides how the footage sits inside it.'}
        </p>
        {!adaptScreen && (
        <Segmented
          label="Fit"
          value={screen.fit}
          options={[
            { value: 'cover', label: 'Cover' },
            { value: 'contain', label: 'Contain' },
            { value: 'stretch', label: 'Stretch' },
          ]}
          onChange={(v) => update('screen', { fit: v })}
        />
        )}
        <Slider label="Zoom" value={screen.scale} min={0.3} max={3} step={0.01} onChange={(v) => update('screen', { scale: v })} />
        <Slider label="Offset X" value={screen.offsetX} min={-0.5} max={0.5} step={0.005} onChange={(v) => update('screen', { offsetX: v })} />
        <Slider label="Offset Y" value={screen.offsetY} min={-0.5} max={0.5} step={0.005} onChange={(v) => update('screen', { offsetY: v })} />
        <Slider label="Brightness" value={screen.brightness} min={0.2} max={2} step={0.01} onChange={(v) => update('screen', { brightness: v })} />
        <Slider label="Glow" value={screen.glow} min={0} max={2} step={0.01} onChange={(v) => update('screen', { glow: v })} />
      </Panel>
    </aside>
  )
}
