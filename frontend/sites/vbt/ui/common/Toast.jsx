// Korte melding onderin beeld. De engine roept VBT.toast(text, ms) aan; dit component registreert die functie.
import { useEffect, useRef, useState } from 'react'

export default function ToastHost() {
  const [toast, setToast] = useState({ text: '', show: false })
  const timer = useRef(null)

  useEffect(() => {
    window.VBT.toast = (text, ms = 4000) => {
      setToast({ text, show: true })
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), ms)
    }
    return () => clearTimeout(timer.current)
  }, [])

  return <div id="toast" className={toast.show ? 'show' : ''} role="status">{toast.text}</div>
}
