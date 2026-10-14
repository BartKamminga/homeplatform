import { useEffect } from 'react'
import '@core/arcade/arcade.css'
import '@core/arcade/arcade-blocks.css'

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Press+Start+2P&family=Inter:wght@400;600&display=swap'

function ensureFonts() {
  if (document.querySelector('link[data-arcade-fonts]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = FONTS_HREF
  link.dataset.arcadeFonts = '1'
  document.head.appendChild(link)
}

// Basis voor elke arcade-frontend (item 1336): fonts, body-achtergrond, theme-color en CRT-overlay.
export default function ArcadeShell({ children, crt = true }) {
  useEffect(() => {
    ensureFonts()
    document.body.classList.add('ac-body')
    const meta = document.querySelector('meta[name="theme-color"]')
    const prev = meta?.getAttribute('content')
    meta?.setAttribute('content', '#07011a')
    return () => {
      document.body.classList.remove('ac-body')
      if (meta && prev) meta.setAttribute('content', prev)
    }
  }, [])

  return (
    <div className="ac-root">
      {children}
      {crt && <div className="ac-crt" aria-hidden="true" />}
    </div>
  )
}
