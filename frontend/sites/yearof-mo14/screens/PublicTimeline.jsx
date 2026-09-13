import { useState, useEffect } from 'react'
import { getTimeline } from '../api.js'

function fmtDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const datePart = d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })
  const hasTime = !(d.getHours() === 0 && d.getMinutes() === 0) || /T\d{2}:\d{2}/.test(iso)
  if (!hasTime) return datePart
  return `${datePart} · ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {it.opponent_club_logo && (
              <img src={it.opponent_club_logo} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontSize: 13, color: '#666' }}>{fmtDate(it.date)}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{it.title}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 2, fontSize: 12 }}>
                {it.has_photos && <span title="Foto's beschikbaar">📷</span>}
                {it.has_report && <span title="Verslag/interview beschikbaar">📝</span>}
                {it.has_footage && <span title="Wedstrijdbeelden beschikbaar">▶️</span>}
              </div>
            </div>
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
