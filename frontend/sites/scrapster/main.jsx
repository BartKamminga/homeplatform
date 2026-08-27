import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import EnvBanner from '@core/EnvBanner.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/scrapster/sw.js', { scope: '/scrapster/' })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EnvBanner />
    <App />
  </StrictMode>
)
