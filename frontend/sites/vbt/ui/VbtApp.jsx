// VBT React-schil: start de engine (canvas/gameloop blijft plain JS) en bevat de UI eromheen.
// Fase 1: alleen de opstart + de layout-haakjes voor de zijpanelen (--panel-left/--panel-right).
import { useEffect } from 'react'

let booted = false

export default function VbtApp() {
  useEffect(() => {
    if (booted) return   // StrictMode draait effects in dev twee keer
    booted = true
    document.getElementById('vbt-app').hidden = false
    window.VBT.boot().then(() => window.VBT.stravaUi.init())
  }, [])

  return null
}
