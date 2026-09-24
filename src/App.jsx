import React, { useCallback, useEffect, useRef, useState } from 'react'
import Studio from './scene/Studio.jsx'
import LeftPanel from './ui/LeftPanel.jsx'
import RightPanel from './ui/RightPanel.jsx'
import Timeline from './ui/Timeline.jsx'
import { useStudio } from './store/useStudio.js'
import { isSupported, loadSource } from './media/loadSource.js'
import { downloadProject, openProjectFile, readAutosave, startAutosave } from './project/project.js'

const isProjectFile = (file) => file.name.endsWith('.json')

export default function App() {
  const source = useStudio((s) => s.source)
  const setSource = useStudio((s) => s.setSource)
  const setDuration = useStudio((s) => s.setDuration)
  const exporting = useStudio((s) => s.exporting)
  const setPlaying = useStudio((s) => s.setPlaying)

  const inputRef = useRef(null)
  const projectRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [restorable, setRestorable] = useState(null)
  const panels = useStudio((s) => s.panels)
  const togglePanel = useStudio((s) => s.togglePanel)
  const toggleBothPanels = useStudio((s) => s.toggleBothPanels)

  const SIDE = { left: 'clamp(186px, 19vw, 248px)', right: 'clamp(206px, 22vw, 248px)', rail: '22px' }
  const gridTemplateColumns = `${panels.left ? SIDE.left : SIDE.rail} minmax(0, 1fr) ${
    panels.right ? SIDE.right : SIDE.rail
  }`

  const accept = useCallback(
    async (file) => {
      if (!file) return
      setError(null)
      try {
        if (isProjectFile(file)) {
          await openProjectFile(file)
          setRestorable(null)
          return
        }
        if (!isSupported(file)) {
          setError('Drop a video (MP4/WebM) or an image (PNG/JPG).')
          return
        }
        const prev = useStudio.getState().source
        if (prev?.url) URL.revokeObjectURL(prev.url)
        const next = await loadSource(file)
        setSource(next)
        // Start immediately rather than waiting for the render loop to notice.
        if (next.kind === 'video' && useStudio.getState().autoplay) next.el.play().catch(() => {})

        // A portrait source on a landscape display must fill the width and
        // scroll, the way a long page actually reads. Fitting it by height
        // instead leaves a narrow strip marooned between two black bars.
        if (next.height > next.width) {
          useStudio.getState().update('screen', { fit: 'cover', scroll: 0 })
        }
        // Match the timeline to the whole recording, so Play plays all of it.
        if (next.kind === 'video' && Number.isFinite(next.duration) && next.duration > 0) {
          setDuration(Math.min(300, Math.max(2, Math.round(next.duration * 2) / 2)))
        }
      } catch (e) {
        setError(e.message)
      }
    },
    [setSource, setDuration],
  )

  // Offer to restore the last session rather than silently overwriting it.
  useEffect(() => {
    const saved = readAutosave()
    if (saved) setRestorable(saved)
    return startAutosave()
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) useStudio.getState().redo()
        else useStudio.getState().undo()
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        downloadProject()
        return
      }
      if (typing) return
      // Tab hides both panels, the way every editor does it
      if (e.key === 'Tab') {
        e.preventDefault()
        useStudio.getState().toggleBothPanels()
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying(!useStudio.getState().isPlaying)
      }
      if (e.key === 'k') useStudio.getState().addKeyframe()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPlaying])

  const bothOpen = panels.left && panels.right

  return (
    <div className="app" style={{ gridTemplateColumns }}>
      <header className="topbar">
        <div className="brand">
          Mockup <span>Studio</span>
        </div>
        <span className="badge">{source ? source.name : 'no footage loaded'}</span>
        <span className="spacer" />
        {error && <span className="hint" style={{ color: 'var(--danger)' }}>{error}</span>}

        <input
          ref={projectRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => accept(e.target.files?.[0])}
        />
        <button className="btn" onClick={() => projectRef.current?.click()}>
          Open
        </button>
        <button className="btn" onClick={downloadProject} title="Save project (Ctrl+S)">
          Save
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="video/*,image/*"
          hidden
          onChange={(e) => accept(e.target.files?.[0])}
        />
        <button className="btn primary" onClick={() => inputRef.current?.click()}>
          {source ? 'Replace' : 'Add media'}
        </button>

        <button
          className="btn"
          onClick={toggleBothPanels}
          title={`${bothOpen ? 'Hide' : 'Show'} both panels (Tab)`}
        >
          {bothOpen ? '⇤ ⇥' : '⇥ ⇤'}
        </button>
      </header>

      {panels.left ? (
        <LeftPanel onCollapse={() => togglePanel('left')} />
      ) : (
        <aside className="rail left">
          <button onClick={() => togglePanel('left')} title="Show left panel">
            ▶
          </button>
        </aside>
      )}

      <main
        className="stage"
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          accept(e.dataTransfer.files?.[0])
        }}
      >
        <Studio />

        {(!source || dragging) && (
          <div className={`dropzone ${dragging ? 'active' : ''}`}>
            <strong style={{ fontSize: 14 }}>Drop a recording or a screenshot</strong>
            <span className="hint">
              MP4 / WebM / PNG / JPG — a tall page screenshot can scroll on the display
            </span>
            <button className="btn primary" style={{ pointerEvents: 'auto' }} onClick={() => inputRef.current?.click()}>
              Choose file
            </button>
            {restorable && (
              <button
                className="btn"
                style={{ pointerEvents: 'auto' }}
                onClick={() => {
                  useStudio.getState().loadProject(restorable)
                  setRestorable(null)
                }}
              >
                Restore last session
              </button>
            )}
          </div>
        )}

        {exporting && (
          <div className="overlay">
            <strong>
              {exporting.phase === 'draft' ? 'Draft render' : 'Rendering'} {Math.round(exporting.progress * 100)}%
            </strong>
            <div className="progress" style={{ width: 240 }}>
              <i style={{ width: `${exporting.progress * 100}%` }} />
            </div>
            <span className="hint">{exporting.phase} — keep this tab in the foreground</span>
          </div>
        )}
      </main>

      {panels.right ? (
        <RightPanel onCollapse={() => togglePanel('right')} />
      ) : (
        <aside className="rail right">
          <button onClick={() => togglePanel('right')} title="Show right panel">
            ◀
          </button>
        </aside>
      )}
      <Timeline />
    </div>
  )
}
