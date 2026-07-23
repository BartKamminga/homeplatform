import { useState, useEffect, useRef } from 'react'
import { getClubs } from '../api.js'

export function ClubFilterBar({ clubId, onChange }) {
  const [clubs, setClubs] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    getClubs().then(setClubs).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = clubs.find(c => c.id === clubId)

  return (
    <div className="club-filter-bar" ref={ref}>
      <button
        className={`club-chip${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="club-dot" />
        <span className="club-name">{selected?.name ?? 'Alle clubs'}</span>
        <span className="club-chevron">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="club-dropdown">
          <button
            className={`club-option${!clubId ? ' sel' : ''}`}
            onClick={() => { onChange(null); setOpen(false) }}
          >
            Alle clubs
          </button>
          {clubs.map(c => (
            <button
              key={c.id}
              className={`club-option${c.id === clubId ? ' sel' : ''}`}
              onClick={() => { onChange(c.id); setOpen(false) }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
