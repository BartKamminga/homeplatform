import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import EnvBanner from '@core/EnvBanner.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EnvBanner />
    <App />
  </StrictMode>
)
