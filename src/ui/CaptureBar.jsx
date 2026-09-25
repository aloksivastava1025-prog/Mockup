import React, { useState } from 'react'
import { canCaptureTab, captureTab, openSite } from '../media/capture.js'

/**
 * For people arriving without footage: point at a website and record it.
 *
 * Two steps rather than one, because the browser insists on it. Pasting a URL
 * cannot put a live site inside this page — sites refuse to be framed, and a
 * cross-origin frame has no pixels we are allowed to read. So the field opens
 * the site in its own tab, and the picker aims the recorder at that tab.
 */
export default function CaptureBar({ onFile }) {
  const [url, setUrl] = useState('')
  const [seconds, setSeconds] = useState(10)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  if (!canCaptureTab()) return null

  const record = async () => {
    setError(null)
    setBusy('Pick the tab to record…')
    try {
      const file = await captureTab({ seconds, onTick: (left) => setBusy(`Recording — ${left}s`) })
      setBusy('Loading…')
      await onFile(file)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(null)
    }
  }

  const openThenRecord = async () => {
    setError(null)
    if (!url.trim()) return
    const { win } = openSite(url.trim())
    if (!win) {
      setError('The browser blocked the new tab. Allow popups, or open the site yourself and press Record a tab.')
      return
    }
    // Give the site a moment to paint before the picker shows its thumbnails,
    // otherwise every option in the list is a blank white rectangle.
    setBusy('Opening the site…')
    await new Promise((r) => setTimeout(r, 1200))
    await record()
  }

  return (
    <div className="capture" style={{ pointerEvents: 'auto' }}>
      <div className="capture-row">
        <input
          className="text-input"
          placeholder="yoursite.com"
          value={url}
          spellCheck={false}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && openThenRecord()}
        />
        <button className="btn primary" disabled={!!busy || !url.trim()} onClick={openThenRecord}>
          Open &amp; record
        </button>
      </div>
      <div className="capture-row">
        <div className="seg" style={{ flex: '0 0 auto' }}>
          {[5, 10, 15].map((n) => (
            <button key={n} className={seconds === n ? 'on' : ''} onClick={() => setSeconds(n)}>
              {n}s
            </button>
          ))}
        </div>
        <button className="btn" disabled={!!busy} onClick={record}>
          Record a tab
        </button>
      </div>
      <span className="hint">
        {busy
          ? busy
          : 'Opens the site in a new tab, then asks which tab to record. Scroll it while it records.'}
      </span>
      {error && <span className="hint" style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}
