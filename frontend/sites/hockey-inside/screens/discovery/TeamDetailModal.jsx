import { useEffect, useState } from 'react'
import { api } from '@core/api.js'
import { pill } from '../ui.jsx'

// item 994: klik-door vanuit een team-pilletje (DiscoveryClubs.jsx) naar alle
// poule-details (stand + wedstrijden) van dat team binnen het geselecteerde
// seizoen - lost ook het gebrek aan leesbare poule/competitie-naam op (item 992).
export default function TeamDetailModal({ teamId, season, onClose }) {
  const [detail,  setDetail]  = useState(null)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api.get(`/api/hockey/teams/${teamId}/detail?season=${season}`)
      .then(r => { if (!cancelled) setDetail(r) })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [teamId, season])

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: '18px 20px', width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>
            {detail?.team?.name || `Team ${teamId}`} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>· {season}</span>
          </span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        {loading && <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Laden…</p>}
        {error   && <p style={{ fontSize: 12, color: 'var(--color-danger)' }}>{error}</p>}

        {detail && detail.poules.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Geen poule(s) gevonden voor dit team in {season}.</p>
        )}

        {detail && detail.poules.map(p => (
          <div key={p.poule_id} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{p.poule_name || `Poule ${p.poule_id}`}</span>
              {p.is_primary && <span style={pill('muted')}>primair</span>}
              <span style={pill(p.captured ? 'ok' : 'partial')}>{p.captured ? '✓ gevangen' : '○ wacht op scan'}</span>
            </div>
            {p.competition_name && (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                🏆 {p.competition_name}{p.class_name ? ` · ${p.class_name}` : ''}{p.district ? ` · ${p.district}` : ''}
              </div>
            )}

            {p.standings.length > 0 && (
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', marginBottom: p.matches.length > 0 ? 8 : 0 }}>
                <thead>
                  <tr style={{ color: 'var(--color-text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '2px 4px' }}>#</th>
                    <th style={{ padding: '2px 4px' }}>Team</th>
                    <th style={{ padding: '2px 4px', textAlign: 'right' }}>G</th>
                    <th style={{ padding: '2px 4px', textAlign: 'right' }}>Pt</th>
                  </tr>
                </thead>
                <tbody>
                  {p.standings.map(s => (
                    <tr key={s.team_id} style={{ fontWeight: s.team_id === teamId ? 700 : 400 }}>
                      <td style={{ padding: '2px 4px' }}>{s.position ?? '–'}</td>
                      <td style={{ padding: '2px 4px' }}>{s.team_name}</td>
                      <td style={{ padding: '2px 4px', textAlign: 'right' }}>{s.played}</td>
                      <td style={{ padding: '2px 4px', textAlign: 'right' }}>{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {p.matches.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {p.matches.map(m => (
                  <div key={m.match_id} style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', gap: 6 }}>
                    <span style={{ flex: 1 }}>{m.home_team_name} — {m.away_team_name}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {m.home_score != null && m.away_score != null ? `${m.home_score}-${m.away_score}` : (m.match_date || m.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
