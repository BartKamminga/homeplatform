import { useState } from 'react'

// Inklapbaar "Meer" in een blok-editor (item 1258): de minder gebruikte velden
// staan eronder, standaard open zodat niets verstopt raakt.
export default function MoreSection({ children, defaultOpen = true, label = 'More' }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: '1px solid #eee', paddingTop: 8, marginBottom: 14 }}>
      <button onClick={() => setOpen(o => !o)} className="yof-btn-secondary" style={{ fontSize: 12, marginBottom: open ? 10 : 0 }}>
        {open ? '▾' : '▸'} {label}
      </button>
      {open && children}
    </div>
  )
}
