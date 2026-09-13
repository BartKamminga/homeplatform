import { useState, useEffect } from 'react'
import { getTimeline } from '../api.js'

function fmtDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })
}

export default function PublicTimeline({ onOpenEntry }) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    getTimeline().then(setItems).catch(e => setError(e.message))
  }, [])

  return (
    <div>
      <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>Wedstrijden &amp; bijzondere dagen</h2>
      {error && <p style={{ color: '#c23b3b' }}>{error}</p>}
      {items.map(it => (
        <a key={it.match_ref} className="yof-list-row"
          href="#" onClick={e => { e.preventDefault(); onOpenEntry(it.match_ref) }}>
          <div>
            <div style={{ fontSize: 13, color: '#666' }}>{fmtDate(it.date)}</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{it.title}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {it.score_us != null && <strong>{it.score_us}-{it.score_them}</strong>}
            <span className={`badge ${it.kind}`}>{it.kind === 'competitie' ? 'competitie' : it.kind}</span>
          </div>
        </a>
      ))}
      {items.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog niets gepland.</p>}
    </div>
  )
}
