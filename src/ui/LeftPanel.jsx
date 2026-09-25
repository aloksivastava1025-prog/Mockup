import React from 'react'
import { useStudio } from '../store/useStudio.js'
import { DEVICE_LIST, COMING_SOON, DEVICES } from '../devices/index.js'
import { Panel, Segmented, Slider, Toggle, Vec3 } from './controls.jsx'
import FocusPanel from './FocusPanel.jsx'
import TitlesPanel from './TitlesPanel.jsx'

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

export default function LeftPanel({ onCollapse }) {
  const deviceId = useStudio((s) => s.deviceId)
  const setDevice = useStudio((s) => s.setDevice)
  const device = useStudio((s) => s.device)
  const camera = useStudio((s) => s.camera)
  const screen = useStudio((s) => s.screen)
  const update = useStudio((s) => s.update)
  const setAxis = useStudio((s) => s.setAxis)
  const setFloat = useStudio((s) => s.setFloat)
  const orbitEnabled = useStudio((s) => s.orbitEnabled)
  const setOrbitEnabled = useStudio((s) => s.setOrbitEnabled)
  const adaptScreen = useStudio((s) => s.adaptScreen)
  const setAdaptScreen = useStudio((s) => s.setAdaptScreen)
  const source = useStudio((s) => s.source)
  const autoplay = useStudio((s) => s.autoplay)
  const setAutoplay = useStudio((s) => s.setAutoplay)
  const companions = useStudio((s) => s.companions)
  const spacing = useStudio((s) => s.spacing)
  const setSpacing = useStudio((s) => s.setSpacing)
  const setDeviceCount = useStudio((s) => s.setDeviceCount)
  const updateCompanion = useStudio((s) => s.updateCompanion)
  const removeCompanion = useStudio((s) => s.removeCompanion)

  // Devices differ wildly in size; reframe the camera so the new one is not
  // left as a speck or bursting out of frame.
  const pickDevice = (id) => {
    setDevice(id)
    const frame = DEVICES[id]?.frame
    if (!frame) return
    const el = frame.el ?? 18
    const az = -18
    const r = frame.d
    const rad = Math.PI / 180
    update('camera', {
      position: [
        +(r * Math.cos(el * rad) * Math.sin(az * rad)).toFixed(4),
        +(frame.ty + r * Math.sin(el * rad)).toFixed(4),
        +(r * Math.cos(el * rad) * Math.cos(az * rad)).toFixed(4),
      ],
      target: [0, frame.ty, 0],
      fov: frame.fov,
    })
  }

  return (
    <aside className="sidebar left">
      <div className="panel-bar left">
        <button onClick={onCollapse} title="Collapse this panel">
          ◀
        </button>
      </div>
      <Panel title="Device">
        <div className="field stacked">
          <div className="seg">
            {DEVICE_LIST.map((d) => (
              <button key={d.id} className={deviceId === d.id ? 'on' : ''} onClick={() => pickDevice(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        {COMING_SOON.length > 0 && (
          <p className="hint">Coming soon: {COMING_SOON.map((d) => d.label).join(', ')}.</p>
        )}
      </Panel>

      <Panel title="Scene">
        <Segmented
          label="Screens"
          value={String(companions.length + 1)}
          options={['1', '2', '3', '4'].map((n) => ({ value: n, label: n }))}
          onChange={(v) => setDeviceCount(Number(v))}
        />
        {companions.length > 0 && (
          <Slider
            label="Spacing"
            value={spacing}
            min={-0.06}
            max={0.5}
            step={0.005}
            precision={3}
            onChange={setSpacing}
          />
        )}
        {companions.length === 0 ? (
          <p className="hint">
            Stand more devices next to this one for a family shot — same footage on each, fitted to
            its own screen. Extra devices hold still; the timeline animates the main one.
          </p>
        ) : (
          <p className="hint">
            Spacing is the clear gap between neighbours, so it means the same whatever sizes are in
            the row. Nudge any one device below.
          </p>
        )}
        {companions.map((c, i) => (
            <div key={c.id} className="subgroup">
              <div className="field">
                <label>Device {i + 2}</label>
                <button className="btn ghost sm" onClick={() => removeCompanion(c.id)}>
                  remove
                </button>
              </div>
              <div className="field stacked">
                <div className="seg">
                  {DEVICE_LIST.map((d) => (
                    <button
                      key={d.id}
                      className={c.deviceId === d.id ? 'on' : ''}
                      onClick={() => updateCompanion(c.id, { deviceId: d.id })}
                    >
                      {d.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
              <Slider
                label="Across"
                value={c.position[0]}
                min={-1.5}
                max={1.5}
                step={0.01}
                precision={2}
                onChange={(v) =>
                  updateCompanion(c.id, { position: [v, c.position[1], c.position[2]] }, 'x')
                }
              />
              <Slider
                label="Depth"
                value={c.position[2]}
                min={-1.5}
                max={1.5}
                step={0.01}
                precision={2}
                onChange={(v) =>
                  updateCompanion(c.id, { position: [c.position[0], c.position[1], v] }, 'z')
                }
              />
              <Slider
                label="Turn"
                value={c.rotation[1]}
                min={-180}
                max={180}
                step={1}
                unit="°"
                precision={0}
                onChange={(v) =>
                  updateCompanion(c.id, { rotation: [c.rotation[0], v, c.rotation[2]] }, 'ry')
                }
              />
              {DEVICES[c.deviceId]?.hasLid && (
                <Slider
                  label="Lid"
                  value={c.lidAngle}
                  min={0}
                  max={130}
                  step={0.5}
                  unit="°"
                  precision={0}
                  onChange={(v) => updateCompanion(c.id, { lidAngle: v }, 'lid')}
                />
              )}
              <Slider
                label="Scale"
                value={c.scale}
                min={0.2}
                max={3}
                step={0.01}
                precision={2}
                onChange={(v) => updateCompanion(c.id, { scale: v }, 'scale')}
              />
            </div>
        ))}
      </Panel>

      <Panel title="Screen" right={<ResetBtn group="screen" />}>
        <Toggle label="Adapt" value={adaptScreen} onChange={setAdaptScreen} />
        {source?.kind === 'video' && (
          <>
            <Toggle label="Autoplay" value={autoplay} onChange={setAutoplay} />
            <p className="hint">
              {autoplay
                ? 'Recording runs live on the device. Exports are unaffected.'
                : 'Screen shows the frame under the playhead — match this to keyframe precisely.'}
            </p>
          </>
        )}
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
        {source && source.height > source.width && (
          <>
            <Slider
              label="Scroll"
              value={screen.scroll ?? 0}
              min={0}
              max={1}
              step={0.005}
              onChange={(v) => update('screen', { scroll: v })}
            />
            <p className="hint">
              Tall screenshot: 0 is the top of the page, 1 the bottom. Keyframe it to scroll the page.
            </p>
          </>
        )}
        <Slider label="Brightness" value={screen.brightness} min={0.2} max={2} step={0.01} onChange={(v) => update('screen', { brightness: v })} />
        <Slider label="Glow" value={screen.glow} min={0} max={2} step={0.01} onChange={(v) => update('screen', { glow: v })} />
      </Panel>

      <FocusPanel />
      <TitlesPanel />

      <Panel title="Transform" right={<ResetBtn group="device" />}>
        <Vec3
          label="Position"
          value={device.position}
          step={0.01}
          onChange={(i, v) => (i === 1 ? setFloat(v) : setAxis('device', 'position', i, v))}
        />
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
        <Slider
          label="Tilt"
          value={device.rotation[2]}
          min={-60}
          max={60}
          step={0.5}
          unit="°"
          precision={0}
          onChange={(v) => setAxis('device', 'rotation', 2, v)}
        />
        <Slider
          label="Float"
          value={device.position[1]}
          min={0}
          max={0.8}
          step={0.005}
          precision={2}
          onChange={setFloat}
        />
        {device.position[1] > 0.001 && (
          <p className="hint">
            Off the surface, with the camera rising to keep it framed. The contact shadow spreads
            and fades with height — turn the Floor off for a shot against nothing but the backdrop.
          </p>
        )}
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

    </aside>
  )
}
