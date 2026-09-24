import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { useStudio } from './store/useStudio.js'
import { studioApi } from './scene/studioApi.js'

if (import.meta.env.DEV) {
  window.__studio = useStudio
  window.__studioApi = studioApi
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
