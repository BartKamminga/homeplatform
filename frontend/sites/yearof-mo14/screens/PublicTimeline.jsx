import { useState, useEffect } from 'react'
import { getTimeline, getStandings } from '../api.js'
import NationalQueries from './NationalQueries.jsx'

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
  const [standings, setStandings] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getTimeline().then(setItems).catch(e => setError(e.message))
    getStandings().then(setStandings).catch(() => {})
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
            {(it.score_home ?? it.score_us) != null && (
              <strong>{it.score_home ?? it.score_us}-{it.score_away ?? it.score_them}</strong>
            )}
            <span className={`badge ${it.kind}`}>{it.kind === 'competitie' ? 'competitie' : it.kind}</span>
          </div>
        </a>
      ))}
      {items.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog niets gepland.</p>}

      {standings?.standings?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Pouletabel{standings.pool_name ? ` · ${standings.pool_name}` : ''}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#888' }}>
                <th style={{ padding: '4px 6px' }}>#</th>
                <th style={{ padding: '4px 6px' }}>Team</th>
                <th style={{ padding: '4px 6px', textAlign: 'center' }}>G</th>
                <th style={{ padding: '4px 6px', textAlign: 'center' }}>W-G-V</th>
                <th style={{ padding: '4px 6px', textAlign: 'center' }}>DS</th>
                <th style={{ padding: '4px 6px', textAlign: 'right' }}>Pt</th>
              </tr>
            </thead>
            <tbody>
              {standings.standings.map((r, i) => (
                <tr key={r.team_id} style={{ borderTop: '1px solid #eee', fontWeight: r.is_us ? 700 : 400, background: r.is_us ? '#fdf8e8' : 'transparent' }}>
                  <td style={{ padding: '4px 6px' }}>{i + 1}</td>
                  <td style={{ padding: '4px 6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.club_logo_url && <img src={r.club_logo_url} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />}
                      {r.team_name}
                    </div>
                  </td>
                  <td style={{ padding: '4px 6px', textAlign: 'center' }}>{r.played}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center' }}>{r.won}-{r.drawn}-{r.lost}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center' }}>{r.gf}-{r.ga}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right' }}>{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NationalQueries />
    </div>
  )
}
