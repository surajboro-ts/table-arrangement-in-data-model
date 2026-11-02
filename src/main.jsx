import React from 'react'
import { createRoot } from 'react-dom/client'
import './radiant/tokens/index.css'
import './app.css'
import App from './App'
import Gallery from './Gallery'
import './gallery.css'

/** ?gallery renders the Radiant catalogue instead of the editor. */
const showGallery = new URLSearchParams(window.location.search).has('gallery')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {showGallery ? <Gallery /> : <App />}
  </React.StrictMode>
)
