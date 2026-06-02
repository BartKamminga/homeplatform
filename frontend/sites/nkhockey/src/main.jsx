import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { loadTheme } from '@core/api.js'

// Laad platform thema-tokens als override bovenop styles.css
 loadTheme()

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
