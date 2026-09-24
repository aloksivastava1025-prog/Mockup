import React, { useCallback, useEffect, useRef, useState } from 'react'
import Studio from './scene/Studio.jsx'
import LeftPanel from './ui/LeftPanel.jsx'
import RightPanel from './ui/RightPanel.jsx'
import Timeline from './ui/Timeline.jsx'
import { useStudio } from './store/useStudio.js'

function loadVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement('video')
    el.src = url
    el.muted = true
    el.loop = true
    el.playsInline = true
    el.preload = 'auto'
    el.crossOrigin = 'anonymous'
    el.onloadedmetadata = () => {
      // Playback is driven by the timeline, not by the element itself — just
      // prime one decoded frame so the display isn't blank before first play.
      el.currentTime = 0
      resolve({
        el,
        url,
        name: file.name,
        duration: el.duration,
        width: el.videoWidth,
        height: el.videoHeight,
      })
    }
    el.onerror = () => reject(new Error(`Could not decode "${file.name}". Try an MP4 (H.264) or WebM file.`))
  })
}

export default function App() {
  const video = useStudio((s) => s.video)
  const setVideo = useStudio((s) => s.setVideo)
  const setDuration = useStudio((s) => s.setDuration)
  const exporting = useStudio((s) => s.exporting)
  const setPlaying = useStudio((s) => s.setPlaying)

  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)

  const accept = useCallback(
    async (file) => {
      if (!file) return
      if (!file.type.startsWith('video/')) {
        setError('That file is not a video.')
        return
      }
      setError(null)
      try {
        const prev = useStudio.getState().video
        if (prev?.url) URL.revokeObjectURL(prev.url)
        const next = await loadVideo(file)
        setVideo(next)
        if (Number.isFinite(next.duration) && next.duration > 0) {
          setDuration(Math.min(15, Math.max(2, Math.round(next.duration * 2) / 2)))
        }
      } catch (e) {
        setError(e.message)
      }
    },
    [setVideo, setDuration],
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying(!useStudio.getState().isPlaying)
      }
      if (e.key === 'k') useStudio.getState().addKeyframe()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPlaying])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          3D Device Mockup <span>Studio</span>
        </div>
        <span className="badge">{video ? video.name : 'no footage loaded'}</span>
        <span className="spacer" />
        {error && <span className="hint" style={{ color: 'var(--danger)' }}>{error}</span>}
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => accept(e.target.files?.[0])}
        />
        <button className="btn" onClick={() => inputRef.current?.click()}>
          {video ? 'Replace video' : 'Upload video'}
        </button>
      </header>

      <LeftPanel />

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

        {(!video || dragging) && (
          <div className={`dropzone ${dragging ? 'active' : ''}`}>
            <strong style={{ fontSize: 15 }}>Drop a screen recording here</strong>
            <span className="hint">MP4 or WebM · it becomes a live texture on the laptop display</span>
            <button className="btn primary" style={{ pointerEvents: 'auto' }} onClick={() => inputRef.current?.click()}>
              Choose file
            </button>
          </div>
        )}

        {exporting && (
          <div className="overlay">
            <strong>Rendering {Math.round(exporting.progress * 100)}%</strong>
            <div className="progress" style={{ width: 260 }}>
              <i style={{ width: `${exporting.progress * 100}%` }} />
            </div>
            <span className="hint">{exporting.phase} — keep this tab in the foreground</span>
          </div>
        )}
      </main>

      <RightPanel />
      <Timeline />
    </div>
  )
}
