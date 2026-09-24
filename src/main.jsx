import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { useStudio } from './store/useStudio.js'

// `window.__studioApi` is published from scene/Studio.jsx, which owns it.
if (import.meta.env.DEV) window.__studio = useStudio

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
