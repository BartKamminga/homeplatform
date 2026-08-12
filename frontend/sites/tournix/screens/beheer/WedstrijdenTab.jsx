import { useState, useEffect } from 'react'
import { getMatches, setResult, getPhases, generatePhaseSchedule } from '../../api.js'
import { card, cardLabel, ghostBtn, successBanner, errorBanner } from '../styles.js'

// ── ScoreInput ──────────────────────────────────────────────────────────────────

function ScoreInput({ match, onSaved }) {
  const [home, setHome] = useState(match.home_score ?? '')
  const [away, setAway] = useState(match.away_score ?? '')
  const [saving, setSaving] = useState(false)

  const dirty = String(home) !== String(match.home_score ?? '') ||
                String(away) !== String(match.away_score ?? '')

  async function save() {
    if (!dirty) return
    const h = parseInt(home, 10)
    const a = parseInt(away, 10)
    if (isNaN(h) || isNaN(a)) return
    setSaving(true)
    try { await setResult(match.id, { home_score: h, away_score: a }); onSaved?.() }
    catch { /* stil: parent reloadt niet */ }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <input type="number" min={0} max={99} value={home}
        onChange={e => setHome(e.target.value)}
        onBlur={save}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        style={{
          width: 36, padding: '3px 4px', textAlign: 'center', borderRadius: 6,
          border: `1px solid ${dirty ? 'var(--color-primary)' : 'var(--color-border)'}`,
          background: 'var(--color-bg)', color: 'var(--color-text)',
          fontFamily: 'inherit', fontSize: 13, fontVariantNumeric: 'tabular-nums',
          opacity: saving ? 0.5 : 1,
        }}
      />
      <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>–</span>
      <input type="number" min={0} max={99} value={away}
        onChange={e => setAway(e.target.value)}
        onBlur={save}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        style={{
          width: 36, padding: '3px 4px', textAlign: 'center', borderRadius: 6,
          border: `1px solid ${dirty ? 'var(--color-primary)' : 'var(--color-border)'}`,
          background: 'var(--color-bg)', color: 'var(--color-text)',
          fontFamily: 'inherit', fontSize: 13, fontVariantNumeric: 'tabular-nums',
          opacity: saving ? 0.5 : 1,
        }}
      />
    </div>
  )
}

// ── MatchRow ────────────────────────────────────────────────────────────────────

function MatchRow({ match, isAdmin, onSaved }) {
  const played = match.home_score != null && match.away_score != null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
      borderTop: '1px solid var(--color-border)', flexWrap: 'wrap',
    }}>
      {match.date && (
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0, minWidth: 52 }}>
          {String(match.date).slice(11, 16) || String(match.date).slice(0, 10)}
        </span>
      )}
      <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {match.home_team_name || '?'}
      </span>
      {isAdmin ? (
        <ScoreInput match={match} onSaved={onSaved} />
      ) : (
        <span style={{ fontWeight: played ? 700 : 400, fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontSize: 13, color: played ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
          {played ? `${match.home_score}–${match.away_score}` : 'vs'}
        </span>
      )}
      <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
        {match.away_team_name || '?'}
      </span>
      {match.field_name && (
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0 }}>{match.field_name}</span>
      )}
    </div>
  )
}

// ── WedstrijdenTab ──────────────────────────────────────────────────────────────

export default function WedstrijdenTab({ tournament, isAdmin }) {
  const [matches,   setMatches]   = useState([])
  const [phases,    setPhases]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [genPhase,  setGenPhase]  = useState(null)
  const [generating, setGenerating] = useState(false)
  const [msg,       setMsg]       = useState('')
  const [err,       setErr]       = useState('')

  useEffect(() => { load() }, [tournament.id])

  async function load() {
    setLoading(true)
    try {
      const [m, p] = await Promise.all([getMatches(tournament.id), getPhases(tournament.id)])
      setMatches(m)
      setPhases(p)
      if (p.length && !genPhase) setGenPhase(p[0].id)
    } catch { setErr('Laden mislukt') }
    finally { setLoading(false) }
  }

  async function handleGenerate() {
    if (!genPhase) return
    setGenerating(true)
    try { await generatePhaseSchedule(genPhase); await load(); setMsg('Schema gegenereerd') }
    catch { setErr('Genereren mislukt') }
    finally { setGenerating(false); setTimeout(() => setMsg(''), 3000) }
  }

  if (loading) return <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: 20 }}>Laden…</div>

  // group matches: phase → pool → round
  const byPhase = {}
  for (const m of matches) {
    const pid = m.phase_id || 'onbekend'
    if (!byPhase[pid]) byPhase[pid] = {}
    const round = m.round ?? 0
    if (!byPhase[pid][round]) byPhase[pid][round] = []
    byPhase[pid][round].push(m)
  }

  const phaseMap = Object.fromEntries(phases.map(p => [p.id, p.name]))

  return (
    <div>
      {msg && <div style={{ ...successBanner, marginBottom: 12 }}>{msg}</div>}
      {err && <div style={{ ...errorBanner, marginBottom: 12 }} onClick={() => setErr('')}>{err}</div>}

      {isAdmin && phases.length > 0 && (
        <div style={{ ...card, marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Schema genereren:</span>
          <select value={genPhase || ''} onChange={e => setGenPhase(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 12 }}>
            {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={handleGenerate} disabled={generating}
            style={{ ...ghostBtn, opacity: generating ? 0.5 : 1 }}>
            {generating ? 'Bezig…' : '⚙ Genereer'}
          </button>
        </div>
      )}

      {matches.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: 28 }}>
          {phases.length === 0
            ? 'Maak eerst een fase aan en genereer een schema.'
            : 'Nog geen wedstrijden. Genereer een schema via de knop hierboven.'}
        </div>
      ) : (
        Object.entries(byPhase).map(([phaseId, rounds]) => (
          <div key={phaseId} style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--color-text)' }}>
              {phaseMap[phaseId] || 'Fase'}
            </div>
            {Object.entries(rounds)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([round, roundMatches]) => (
                <div key={round} style={{ ...card, marginBottom: 8, padding: '8px 0' }}>
                  <div style={{ ...cardLabel, paddingLeft: 10, paddingBottom: 6 }}>
                    RONDE {round === '0' ? '—' : round}
                  </div>
                  {roundMatches.map(m => (
                    <MatchRow key={m.id} match={m} isAdmin={isAdmin} onSaved={load} />
                  ))}
                </div>
              ))}
          </div>
        ))
      )}
    </div>
  )
}
