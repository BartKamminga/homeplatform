import { useState, useEffect } from 'react'
import { getTournaments, getStandings, getSnapshots, getSnapshot } from '../api.js'

export default function OverzichtPage({ onTab, stage }) {
  const [tournaments, setTournaments] = useState([])
  const [active,      setActive]      = useState(null)
  const [standings,   setStandings]   = useState([])
  const [snapshots,   setSnapshots]   = useState([])
  const [viewRound,   setViewRound]   = useState(null)
  const [error,       setError]       = useState('')

  useEffect(() => {
    getTournaments()
      .then(list => {
        setTournaments(list)
        const act = list.find(t => t.status === 'active') ?? list[0] ?? null
        setActive(act)
        if (act) {
          getStandings(act.id).then(setStandings).catch(() => {})
          getSnapshots(act.id).then(setSnapshots).catch(() => {})
        }
      })
      .catch(e => setError(e.message))
  }, [])

  // When viewRound changes, load snapshot standings or fall back to live
  useEffect(() => {
    if (!active) return
    if (viewRound === null) {
      getStandings(active.id).then(setStandings).catch(() => {})
    } else {
      getSnapshot(active.id, viewRound)
        .then(snap => { if (snap?.standings) setStandings(snap.standings) })
        .catch(() => {})
    }
  }, [viewRound, active?.id])

  function switchTournament(t) {
    setActive(t)
    setViewRound(null)
    setSnapshots([])
    setStandings([])
    getStandings(t.id).then(setStandings).catch(() => {})
    getSnapshots(t.id).then(setSnapshots).catch(() => {})
  }

  if (error) return <p style={err}>{error}</p>

  if (!active) return (
    <div style={empty}>
      <span style={{ fontSize: 48 }}>🏆</span>
      <p style={{ fontSize: 15, color: 'var(--color-text-muted)', marginTop: 12 }}>Nog geen toernooi aangemaakt.</p>
      <button onClick={() => onTab('beheer')} style={btn}>Toernooi aanmaken</button>
    </div>
  )

  return (
    <div style={{ padding: '20px 16px' }}>
      {/* Banner */}
      <div style={{
        background: 'var(--color-primary)', borderRadius: 14,
        padding: '18px 20px', color: '#fff', marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          {active.status === 'active' ? 'Actief toernooi' : active.status === 'finished' ? 'Afgelopen' : 'Concept'}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{active.name}</div>
        {active.location && <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{active.location}</div>}
        {active.date && (
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
            {new Date(active.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        )}
      </div>

      {/* Wisselen */}
      {tournaments.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {tournaments.map(t => (
            <button
              key={t.id}
              onClick={() => switchTournament(t)}
              style={{
                padding: '5px 12px', fontSize: 12, borderRadius: 20, fontFamily: 'inherit', cursor: 'pointer',
                border: `1px solid ${t.id === active.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: t.id === active.id ? 'var(--color-primary)' : 'var(--color-surface)',
                color: t.id === active.id ? '#fff' : 'var(--color-text)',
                fontWeight: t.id === active.id ? 600 : 400,
              }}
            >{t.name}</button>
          ))}
        </div>
      )}

      {/* Stand */}
      <>
        <h2 style={sectionTitle}>Stand</h2>

        {/* Time travel: round selector */}
        {snapshots.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => setViewRound(null)}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, border: viewRound === null ? 'none' : '1px solid var(--color-border)', background: viewRound === null ? 'var(--color-primary)' : 'transparent', color: viewRound === null ? '#fff' : 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Live
            </button>
            {snapshots.map(s => (
              <button
                key={s.round}
                onClick={() => setViewRound(s.round)}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, border: viewRound === s.round ? 'none' : '1px solid var(--color-border)', background: viewRound === s.round ? 'var(--color-primary)' : 'transparent', color: viewRound === s.round ? '#fff' : 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Ronde {s.round}
              </button>
            ))}
          </div>
        )}

        {standings.length > 0 ? (
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 12, overflow: 'hidden', marginBottom: 20,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 32px 32px 32px 32px 40px', gap: 8, padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
              <span>#</span><span>Team</span><span style={{ textAlign: 'center' }}>W</span><span style={{ textAlign: 'center' }}>G</span><span style={{ textAlign: 'center' }}>V</span><span style={{ textAlign: 'center' }}>D</span><span style={{ textAlign: 'right' }}>Pts</span>
            </div>
            {standings.map((row, i) => (
              <div key={row.id} style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 32px 32px 32px 32px 40px',
                gap: 8, padding: '10px 12px', fontSize: 13, alignItems: 'center',
                borderBottom: i < standings.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{i + 1}</span>
                <span style={{ fontWeight: 500 }}>{row.name}</span>
                <span style={{ textAlign: 'center' }}>{row.won}</span>
                <span style={{ textAlign: 'center' }}>{row.draw}</span>
                <span style={{ textAlign: 'center' }}>{row.lost}</span>
                <span style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>{row.gf}-{row.ga}</span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{row.pts}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>
            Stand verschijnt zodra er wedstrijden zijn gespeeld.
          </p>
        )}
      </>
    </div>
  )
}

const sectionTitle = { fontSize: 13, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 10 }
const empty = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }
const err   = { color: 'var(--color-danger)', padding: 20, fontSize: 13 }
const btn   = {
  marginTop: 16, padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500,
  background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}
