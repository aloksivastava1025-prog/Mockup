import { useStudio } from '../store/useStudio.js'

const AUTOSAVE_KEY = 'mockup-studio:autosave'

/**
 * Projects store the scene, not the media. A recording is far too large to sit
 * in a JSON file or in localStorage, so the file remembers which source it was
 * built against by name and the user re-attaches it on open.
 */
export function downloadProject() {
  const data = useStudio.getState().toProject()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const base = (data.sourceName ?? 'mockup').replace(/\.[^.]+$/, '')
  a.href = url
  a.download = `${base}.mockup.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function openProjectFile(file) {
  const text = await file.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`"${file.name}" is not valid JSON.`)
  }
  useStudio.getState().loadProject(data)
  return data
}

/** Autosave so a refresh never costs the whole session. */
export function saveAutosave() {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(useStudio.getState().toProject()))
  } catch {
    // quota or private mode — autosave is a convenience, never a hard failure
  }
}

export function readAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY)
  } catch {
    /* ignore */
  }
}

/** Persists the document a moment after the last edit. */
export function startAutosave(intervalMs = 1500) {
  let timer = null
  return useStudio.subscribe(() => {
    clearTimeout(timer)
    timer = setTimeout(saveAutosave, intervalMs)
  })
}
