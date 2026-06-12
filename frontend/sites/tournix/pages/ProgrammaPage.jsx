import { useState, useEffect } from 'react'
import { getTournaments, getMatches, getTeams, getFields } from '../api.js'

const STATUS_LABEL = { scheduled: 'Gepland', playing: 'Bezig', finished: 'Klaar' }
const STATUS_COLOR = { scheduled: 'var(--color-text-muted)', playing: '#f59e0b', finished: '#22c55e' }

export default function ProgrammaPage() {
  const [tid,     setTid]     = useState(null)
  const [matches, setMatches] = useState([])
  const [teams,   setTeams]   = useState({})
  const [fields,  setFields]  = useState({})
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    getTournaments()
      .then(list => {
        const act = list.find(t => t.status === 'active') ?? list[0] ?? null
        if (!act) { setLoading(false); return }
        setTid(act.id)
        return Promise.all([getMatches(act.id), getTeams(act.id), getFields(act.id)])
          .then(([m, t, f]) => {
            setMatches(m)
            setTeams(Object.fromEntries(t.map(x => [x.id, x])))
            setFields(Object.fromEntries(f.map(x => [x.id, x])))
          })
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={muted}>Laden…</p>
  if (error)   return <p style={err}>{error}</p>
  if (!tid)    return <p style={muted}>Geen actief toernooi.</p>

  const grouped = matches.reduce((acc, m) => {
    const key = m.round != null ? `Ronde ${m.round}` : 'Overig'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  if (Object.keys(grouped).length === 0) return (
    <p style={muted}>Nog geen wedstrijden gepland.</p>
  )

  return (
    <div style={{ padding: '20px 16px' }}>
      {Object.entries(grouped).map(([round, list]) => (
        <div key={round} style={{ marginBottom: 24 }}>
          <h2 style={sectionTitle}>{round}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map(m => (
              <div key={m.id} style={{
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 12, padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, textAlign: 'right', fontWeight: 600, fontSize: 14 }}>
                    {teams[m.team_a_id]?.name ?? '—'}
                  </div>
                  <div style={{ minWidth: 60, textAlign: 'center' }}>
                    {m.status === 'finished'
                      ? <span style={{ fontSize: 16, fontWeight: 700 }}>{m.score_a} – {m.score_b}</span>
                      : <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>vs</span>
                    }
                  </div>
                  <div style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>
                    {teams[m.team_b_id]?.name ?? '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {m.scheduled_at && (
                    <span>{new Date(m.scheduled_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                  {m.field_id && fields[m.field_id] && (
                    <span>{fields[m.field_id].name}</span>
                  )}
                  <span style={{ color: STATUS_COLOR[m.status] }}>{STATUS_LABEL[m.status]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const sectionTitle = { fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }
const muted = { padding: 24, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }
const err   = { padding: 24, fontSize: 13, color: 'var(--color-danger)' }
