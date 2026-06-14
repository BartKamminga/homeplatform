import { useState, useEffect } from 'react'
import { getMatches, getTeams, getFields, getPhases, setResult } from '../api.js'

export default function UitslagenPage({ tournament }) {
  const [matches,  setMatches]  = useState([])
  const [teams,    setTeams]    = useState({})
  const [fields,   setFields]   = useState({})
  const [phases,   setPhases]   = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const [scoreEdit,      setScoreEdit]      = useState(null)
  const [scoreA,         setScoreA]         = useState('')
  const [scoreB,         setScoreB]         = useState('')
  const [shootoutWinner, setShootoutWinner] = useState(null)
  const [savingScore,    setSavingScore]    = useState(null)
  const [saveError,      setSaveError]      = useState('')

  useEffect(() => {
    setMatches([]); setTeams({}); setFields({}); setPhases([])
    if (!tournament?.id) return
    setLoading(true)
    Promise.all([getMatches(tournament.id), getTeams(tournament.id), getFields(tournament.id), getPhases(tournament.id)])
      .then(([m, t, f, ph]) => {
        setMatches(m)
        setTeams(Object.fromEntries(t.map(x => [x.id, x])))
        setFields(Object.fromEntries(f.map(x => [x.id, x])))
        setPhases(ph)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [tournament?.id])

  async function saveEdit(mid) {
    if (scoreA === '' || scoreB === '') return
    setSavingScore(mid)
    try {
      const match = matches.find(m => m.id === mid)
      const data = { score_a: parseInt(scoreA), score_b: parseInt(scoreB) }
      if (match?.match_type === 'ko') data.shootout_winner = shootoutWinner
      await setResult(mid, data)
      setScoreEdit(null); setScoreA(''); setScoreB(''); setShootoutWinner(null)
      const updated = await getMatches(tournament.id)
      setMatches(updated)
    } catch (e) {
      setSaveError(e.message)
    } finally { setSavingScore(null) }
  }

  function openEdit(m) {
    setScoreEdit(m.id)
    setScoreA(m.status === 'finished' ? String(m.score_a) : '0')
    setScoreB(m.status === 'finished' ? String(m.score_b) : '0')
    setShootoutWinner(m.shootout_winner ?? null)
    setSaveError('')
  }

  if (!tournament) return <p style={muted}>Selecteer een toernooi in de header.</p>
  if (loading) return <p style={muted}>Laden…</p>
  if (error)   return <p style={err}>{error}</p>

  const finished = matches.filter(m => m.status === 'finished' && !m.phase_id)
  const phaseFinished = matches.filter(m => m.status === 'finished' && m.phase_id)

  const groupedByRonde = finished.reduce((acc, m) => {
    const key = m.match_type === 'ko' ? 'Knock-out' : m.round != null ? `Ronde ${m.round}` : 'Overig'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const allGroups = Object.entries(groupedByRonde)

  // Fase-uitslagen
  for (const phase of phases.filter(p => p.match_count > 0)) {
    const pm = phaseFinished.filter(m => m.phase_id === phase.id)
    if (!pm.length) continue
    const byRound = pm.reduce((acc, m) => {
      const key = m.round != null ? `${phase.name} — Ronde ${m.round}` : phase.name
      if (!acc[key]) acc[key] = []
      acc[key].push(m)
      return acc
    }, {})
    for (const [k, v] of Object.entries(byRound)) allGroups.push([k, v])
  }

  if (!allGroups.length) return <p style={muted}>Nog geen gespeelde wedstrijden.</p>

  const MatchRow = ({ m }) => {
    const isEditing = scoreEdit === m.id
    const winA = m.score_a > m.score_b
    const winB = m.score_b > m.score_a
    return (
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, textAlign: 'right', fontWeight: winA ? 700 : 500, fontSize: 14, color: winB ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
            {teams[m.team_a_id]?.name ?? '—'}
          </div>
          <div style={{ minWidth: 60, textAlign: 'center' }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>
              {m.score_a} – {m.score_b}
            </span>
            {m.shootout_winner && (
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>
                PSO — {m.shootout_winner === 'a' ? teams[m.team_a_id]?.name : teams[m.team_b_id]?.name}
              </div>
            )}
          </div>
          <div style={{ flex: 1, textAlign: 'left', fontWeight: winB ? 700 : 500, fontSize: 14, color: winA ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
            {teams[m.team_b_id]?.name ?? '—'}
          </div>
        </div>
        {(m.scheduled_at || (m.field_id && fields[m.field_id])) && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>
            {m.scheduled_at && <span>{new Date(m.scheduled_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>}
            {m.field_id && fields[m.field_id] && <span>{fields[m.field_id].name}</span>}
          </div>
        )}
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min="0" value={scoreA} onChange={e => { setScoreA(e.target.value); setSaveError('') }} style={scoreInput} placeholder="0" autoFocus />
              <span>–</span>
              <input type="number" min="0" value={scoreB} onChange={e => { setScoreB(e.target.value); setSaveError('') }} style={scoreInput} placeholder="0" />
              <button onClick={() => saveEdit(m.id)} disabled={savingScore === m.id} style={primaryBtn}>{savingScore === m.id ? '…' : 'Opslaan'}</button>
              <button onClick={() => { setScoreEdit(null); setSaveError('') }} style={ghostBtn}>Annuleer</button>
            </div>
            {m.match_type === 'ko' && scoreA !== '' && scoreB !== '' && parseInt(scoreA) === parseInt(scoreB) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>PSO gewonnen door:</span>
                {[['a', teams[m.team_a_id]?.name], ['b', teams[m.team_b_id]?.name]].map(([key, name]) => (
                  <button key={key} type="button" onClick={() => setShootoutWinner(prev => prev === key ? null : key)}
                    style={{ padding: '3px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${shootoutWinner === key ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: shootoutWinner === key ? 'var(--color-primary)' : 'transparent',
                      color: shootoutWinner === key ? '#fff' : 'var(--color-text-muted)' }}>
                    {name ?? '—'}
                  </button>
                ))}
              </div>
            )}
            {saveError && <div style={{ fontSize: 11, color: 'var(--color-danger)' }}>{saveError}</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={() => openEdit(m)} style={{ ...ghostBtn, fontSize: 11, padding: '3px 10px' }}>Wijzig</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 16px' }}>
      {allGroups.map(([round, list]) => (
        <div key={round} style={{ marginBottom: 24 }}>
          <h2 style={sectionTitle}>{round}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map(m => <MatchRow key={m.id} m={m} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

const sectionTitle = { fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }
const muted      = { padding: 24, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }
const err        = { padding: 24, fontSize: 13, color: 'var(--color-danger)' }
const scoreInput = { padding: '6px 8px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 13, outline: 'none', textAlign: 'center', width: 46 }
const primaryBtn = { padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const ghostBtn   = { padding: '5px 10px', borderRadius: 8, fontSize: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit' }
