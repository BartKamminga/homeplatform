import { useState, useEffect } from 'react'
import { getMatches, getTeams, predict } from '../api.js'

export default function VoorspelPage({ tournament }) {
  const [matches, setMatches] = useState([])
  const [teams,   setTeams]   = useState({})
  const [preds,   setPreds]   = useState({})
  const [saving,  setSaving]  = useState(null)
  const [saved,   setSaved]   = useState({})
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    setMatches([]); setTeams({})
    if (!tournament?.id) return
    setLoading(true)
    Promise.all([getMatches(tournament.id), getTeams(tournament.id)])
      .then(([m, t]) => {
        setMatches(m.filter(x => x.status !== 'finished'))
        setTeams(Object.fromEntries(t.map(x => [x.id, x])))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [tournament?.id])

  function setPred(mid, side, val) {
    const n = parseInt(val)
    setPreds(p => ({ ...p, [mid]: { ...p[mid], [side]: isNaN(n) ? '' : Math.max(0, n) } }))
  }

  async function submitPred(mid) {
    const p = preds[mid] ?? {}
    if (p.a === '' || p.b === '' || p.a === undefined || p.b === undefined) return
    setSaving(mid)
    try {
      await predict(mid, { pred_a: p.a, pred_b: p.b })
      setSaved(s => ({ ...s, [mid]: true }))
      setTimeout(() => setSaved(s => { const n = {...s}; delete n[mid]; return n }), 2000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(null)
    }
  }

  if (!tournament) return <p style={muted}>Selecteer een toernooi in de header.</p>
  if (loading) return <p style={muted}>Laden…</p>
  if (error)   return <p style={err}>{error}</p>
  if (matches.length === 0) return <p style={muted}>Geen openstaande wedstrijden om te voorspellen.</p>

  return (
    <div style={{ padding: '20px 16px' }}>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
        Voorspel de uitslag van elke wedstrijd. Punten worden berekend na afloop.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {matches.map(m => {
          const p   = preds[m.id] ?? {}
          const ok  = saved[m.id]
          const busy = saving === m.id
          return (
            <div key={m.id} style={{
              background: 'var(--color-surface)', border: `1px solid ${ok ? 'var(--color-success)' : 'var(--color-border)'}`,
              borderRadius: 12, padding: '14px 16px', transition: 'border-color 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, textAlign: 'right', fontWeight: 600, fontSize: 14 }}>
                  {teams[m.team_a_id]?.name ?? '—'}
                </span>
                <input
                  type="number" min="0" value={p.a ?? ''}
                  onChange={e => setPred(m.id, 'a', e.target.value)}
                  style={scoreInput}
                  placeholder="0"
                />
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>–</span>
                <input
                  type="number" min="0" value={p.b ?? ''}
                  onChange={e => setPred(m.id, 'b', e.target.value)}
                  style={scoreInput}
                  placeholder="0"
                />
                <span style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>
                  {teams[m.team_b_id]?.name ?? '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                {ok
                  ? <span style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600 }}>✓ Opgeslagen</span>
                  : (
                    <button
                      onClick={() => submitPred(m.id)}
                      disabled={busy || p.a === '' || p.b === undefined}
                      style={{
                        padding: '6px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8,
                        background: 'var(--color-primary)', color: '#fff', border: 'none',
                        cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit',
                      }}
                    >
                      {busy ? 'Opslaan…' : 'Bevestigen'}
                    </button>
                  )
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const scoreInput = {
  width: 44, height: 36, textAlign: 'center', fontSize: 16, fontWeight: 700,
  background: 'var(--color-background)', border: '1px solid var(--color-border)',
  borderRadius: 8, color: 'var(--color-text)', fontFamily: 'inherit',
  outline: 'none',
}
const muted = { padding: 24, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }
const err   = { padding: 24, fontSize: 13, color: 'var(--color-danger)' }
