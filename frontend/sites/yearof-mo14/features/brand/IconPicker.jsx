import { useState } from 'react'
import { ICONS, PageIcon } from './navIcons.jsx'

// Icoon kiezen uit de Lucide-lijst (pagina-instellingen, 09-10): toont het
// huidige icoon; klik = raster met alle keuzes.
export default function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const tile = active => ({
    width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    border: active ? '2px solid #141414' : '1px solid #ddd', background: active ? '#f5c400' : 'white', color: '#141414', padding: 0,
  })
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} title="Icoon kiezen"
        style={{ ...tile(true), width: '100%', gap: 6 }}>
        <PageIcon value={value} size={20} /> <span style={{ fontSize: 11 }}>&#9662;</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 44, zIndex: 30, width: 300, padding: 10, background: 'white',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.18)', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6,
        }}>
          {Object.keys(ICONS).map(name => (
            <button key={name} type="button" title={name} onClick={() => { onChange(name); setOpen(false) }} style={tile(name === value)}>
              <PageIcon value={name} size={20} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
