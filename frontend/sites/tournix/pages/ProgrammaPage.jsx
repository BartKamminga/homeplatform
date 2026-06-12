import { useState, useEffect } from 'react'
import { getTournaments, getMatches, getTeams, getFields, setResult } from '../api.js'

const STATUS_LABEL = { scheduled: 'Gepland', playing: 'Bezig', finished: 'Klaar' }
const STATUS_COLOR = { scheduled: 'var(--color-text-muted)', playing: '#f59e0b', finished: '#22c55e' }

export default function ProgrammaPage({ stage }) {
  const [tid,      setTid]      = useState(null)
  const [matches,  setMatches]  = useState([])
  const [teams,    setTeams]    = useState({})
  const [fields,   setFields]   = useState({})
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  // Simulation state for test mode
  const [simScores,   setSimScores]   = useState({})   // { [matchId]: { a: number, b: number } }
  const [simEdit,     setSimEdit]     = useState(null)  // matchId currently being edited
  const [simInputA,   setSimInputA]   = useState('')
  const [simInputB,   setSimInputB]   = useState('')

  // Real score editing state for productie mode
  const [scoreEdit,   setScoreEdit]   = useState(null)
  const [scoreA,      setScoreA]      = useState('')
  const [scoreB,      setScoreB]      = useState('')
  const [savingScore, setSavingScore] = useState(null)

  const isTest = stage === 'test'

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

  // Reset sim state when leaving test mode
  useEffect(() => {
    if (!isTest) {
      setSimScores({})
      setSimEdit(null)
    }
  }, [isTest])

  const grouped = matches.reduce((acc, m) => {
    const key = m.round != null ? `Ronde ${m.round}` : 'Overig'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  function openSimEdit(mid) {
    const existing = simScores[mid]
    setSimEdit(mid)
    setSimInputA(existing ? String(existing.a) : '')
    setSimInputB(existing ? String(existing.b) : '')
  }

  function confirmSimScore(mid) {
    const a = parseInt(simInputA)
    const b = parseInt(simInputB)
    if (!isNaN(a) && !isNaN(b) && a >= 0 && b >= 0) {
      setSimScores(prev => ({ ...prev, [mid]: { a, b } }))
    }
    setSimEdit(null)
  }

  function clearSimScore(mid) {
    setSimScores(prev => { const n = { ...prev }; delete n[mid]; return n })
    setSimEdit(null)
  }

  async function saveRealResult(mid) {
    setSavingScore(mid)
    try {
      await setResult(mid, { score_a: parseInt(scoreA), score_b: parseInt(scoreB) })
      setScoreEdit(null); setScoreA(''); setScoreB('')
      const updated = await getMatches(tid)
      setMatches(updated)
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingScore(null)
    }
  }

  if (loading) return <p style={muted}>Laden…</p>
  if (error)   return <p style={err}>{error}</p>
  if (!tid)    return <p style={muted}>Geen actief toernooi.</p>

  if (Object.keys(grouped).length === 0) return (
    <p style={muted}>Nog geen wedstrijden gepland.</p>
  )

  return (
    <div style={{ padding: '20px 16px' }}>
      {/* Simulation banner */}
      {isTest && (
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10,
          padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
            Simulatiemodus — scores worden NIET opgeslagen
          </span>
        </div>
      )}

      {Object.entries(grouped).map(([round, list]) => (
        <div key={round} style={{ marginBottom: 24 }}>
          <h2 style={sectionTitle}>{round}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map(m => {
              const sim = simScores[m.id]
              const hasSimScore = !!sim
              const isSimEditing = simEdit === m.id
              const isRealEditing = scoreEdit === m.id

              // Determine displayed score
              const showFinished = m.status === 'finished' && !isTest
              const showSim = isTest && hasSimScore

              return (
                <div key={m.id} style={{
                  background: isTest && hasSimScore ? '#fffbeb' : 'var(--color-surface)',
                  border: `1px solid ${isTest && hasSimScore ? '#fcd34d' : 'var(--color-border)'}`,
                  borderRadius: 12, padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, textAlign: 'right', fontWeight: 600, fontSize: 14 }}>
                      {teams[m.team_a_id]?.name ?? '—'}
                    </div>
                    <div style={{ minWidth: 60, textAlign: 'center' }}>
                      {showFinished
                        ? <span style={{ fontSize: 16, fontWeight: 700 }}>{m.score_a} – {m.score_b}</span>
                        : showSim
                          ? <span style={{ fontSize: 16, fontWeight: 700, color: '#d97706' }}>{sim.a} – {sim.b}</span>
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
                    {isTest && hasSimScore && (
                      <span style={{ color: '#d97706', fontWeight: 600 }}>Simulatie</span>
                    )}
                  </div>

                  {/* Test mode: simulated score input */}
                  {isTest && isSimEditing && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                      <input
                        type="number" min="0" value={simInputA}
                        onChange={e => setSimInputA(e.target.value)}
                        style={{ ...scoreInput, width: 52 }} placeholder="0"
                      />
                      <span>–</span>
                      <input
                        type="number" min="0" value={simInputB}
                        onChange={e => setSimInputB(e.target.value)}
                        style={{ ...scoreInput, width: 52 }} placeholder="0"
                      />
                      <button onClick={() => confirmSimScore(m.id)} style={primaryBtn}>Simuleer</button>
                      {hasSimScore && <button onClick={() => clearSimScore(m.id)} style={ghostBtn}>Reset</button>}
                      <button onClick={() => setSimEdit(null)} style={ghostBtn}>Annuleer</button>
                    </div>
                  )}
                  {isTest && !isSimEditing && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button
                        onClick={() => openSimEdit(m.id)}
                        style={{ ...ghostBtn, fontSize: 11, padding: '4px 10px' }}
                      >
                        {hasSimScore ? 'Wijzig simulatie' : 'Simuleer score'}
                      </button>
                    </div>
                  )}

                  {/* Productie mode: real score input */}
                  {!isTest && stage === 'productie' && m.status !== 'finished' && isRealEditing && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                      <input type="number" min="0" value={scoreA} onChange={e => setScoreA(e.target.value)} style={{ ...scoreInput, width: 52 }} placeholder="0" />
                      <span>–</span>
                      <input type="number" min="0" value={scoreB} onChange={e => setScoreB(e.target.value)} style={{ ...scoreInput, width: 52 }} placeholder="0" />
                      <button onClick={() => saveRealResult(m.id)} disabled={savingScore === m.id} style={primaryBtn}>
                        {savingScore === m.id ? 'Opslaan…' : 'Opslaan'}
                      </button>
                      <button onClick={() => setScoreEdit(null)} style={ghostBtn}>Annuleer</button>
                    </div>
                  )}
                  {!isTest && stage === 'productie' && m.status !== 'finished' && !isRealEditing && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button
                        onClick={() => { setScoreEdit(m.id); setScoreA(''); setScoreB('') }}
                        style={{ ...ghostBtn, fontSize: 11, padding: '4px 10px' }}
                      >
                        Uitslag invoeren
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

const sectionTitle = { fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }
const muted     = { padding: 24, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }
const err       = { padding: 24, fontSize: 13, color: 'var(--color-danger)' }
const scoreInput = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 13, outline: 'none', textAlign: 'center' }
const primaryBtn = { padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const ghostBtn   = { padding: '6px 12px', borderRadius: 8, fontSize: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit' }
