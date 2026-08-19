import { useState, useEffect } from 'react'
import {
  syncCompetition, getCompetitionMatches, getHockeyPouleStandings,
} from '../../api.js'
import { ghostBtn } from '../styles.js'

const TABS = ['Standen', 'Programma', 'Uitslagen']

// ── StandenTab ─────────────────────────────────────────────────────────────────

function StandenTab({ lnk }) {
  const poules = lnk.poules || []
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!poules.length) { setLoading(false); return }
    Promise.all(poules.map(p => getHockeyPouleStandings(p.id).catch(() => null)))
      .then(results => {
        const map = {}
        results.forEach((r, i) => { map[poules[i].id] = r?.standings || [] })
        setData(map)
      }).finally(() => setLoading(false))
  }, [lnk.id])

  if (loading) return <div style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>Laden…</div>
  if (!poules.length) return <div style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>Geen poules gevonden.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {poules.map(p => {
        const rows = data[p.id] || []
        return (
          <div key={p.id}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6, letterSpacing: '.05em' }}>{p.name}</div>
            {rows.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Geen standen beschikbaar.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'var(--color-text-muted)' }}>
                      <th style={{ textAlign: 'left', padding: '2px 6px 4px 0', fontWeight: 400, width: 20 }}>#</th>
                      <th style={{ textAlign: 'left', padding: '2px 6px 4px 0', fontWeight: 400 }}>Team</th>
                      <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 400, width: 28 }}>W</th>
                      <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 400, width: 28 }}>G</th>
                      <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 400, width: 28 }}>V</th>
                      <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 700, width: 32 }}>Pt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '3px 6px 3px 0', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                        <td style={{ padding: '3px 6px 3px 0', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.team_name}</td>
                        <td style={{ textAlign: 'right', padding: '3px 4px', fontVariantNumeric: 'tabular-nums' }}>{r.won}</td>
                        <td style={{ textAlign: 'right', padding: '3px 4px', fontVariantNumeric: 'tabular-nums' }}>{r.drawn}</td>
                        <td style={{ textAlign: 'right', padding: '3px 4px', fontVariantNumeric: 'tabular-nums' }}>{r.lost}</td>
                        <td style={{ textAlign: 'right', padding: '3px 4px', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{r.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── ProgrammaTab ───────────────────────────────────────────────────────────────

function ProgrammaTab({ lnk }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cid = lnk.competition_id
    if (!cid) { setLoading(false); return }
    getCompetitionMatches(cid).catch(() => null).then(r => {
      setMatches(r?.poules?.flatMap(p => p.scheduled || []) || [])
    }).finally(() => setLoading(false))
  }, [lnk.competition_id])

  if (loading) return <div style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>Laden…</div>
  if (!matches.length) return <div style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>Geen geplande wedstrijden.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {matches.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '5px 0', borderTop: '1px solid var(--color-border)', alignItems: 'center' }}>
          {m.date && <span style={{ color: 'var(--color-text-muted)', flexShrink: 0, minWidth: 72 }}>{m.date.slice(0, 10)}</span>}
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home}</span>
          <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>vs</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{m.away}</span>
        </div>
      ))}
    </div>
  )
}

// ── UitslagenTab ───────────────────────────────────────────────────────────────

function UitslagenTab({ lnk }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cid = lnk.competition_id
    if (!cid) { setLoading(false); return }
    getCompetitionMatches(cid).catch(() => null).then(r => {
      const all = r?.poules?.flatMap(p => p.finished || []) || []
      setMatches([...all].reverse())
    }).finally(() => setLoading(false))
  }, [lnk.competition_id])

  if (loading) return <div style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>Laden…</div>
  if (!matches.length) return <div style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>Geen uitslagen beschikbaar.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {matches.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '5px 0', borderTop: '1px solid var(--color-border)', alignItems: 'center' }}>
          {m.date && <span style={{ color: 'var(--color-text-muted)', flexShrink: 0, minWidth: 72 }}>{m.date.slice(0, 10)}</span>}
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home}</span>
          <span style={{ fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {m.home_score ?? '?'}–{m.away_score ?? '?'}
          </span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{m.away}</span>
        </div>
      ))}
    </div>
  )
}

// ── CompetitieDetailView ───────────────────────────────────────────────────────

export default function CompetitieDetailView({ lnk, onBack }) {
  const [tab,     setTab]     = useState('Standen')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const comp = lnk.competition || {}

  async function handleSync() {
    setSyncing(true)
    setSyncMsg('')
    try { await syncCompetition(lnk.competition_id); setSyncMsg('Sync gestart') }
    catch { setSyncMsg('Sync mislukt') }
    finally { setSyncing(false); setTimeout(() => setSyncMsg(''), 3000) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ ...ghostBtn, padding: '5px 10px', flexShrink: 0 }}>← Terug</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {comp.hockey_type === 'ZA' ? '🏒 ' : '🏑 '}
            {lnk.label || comp.name || '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {comp.class_name && <span>{comp.class_name}</span>}
            {comp.district   && <span>{comp.district}</span>}
            {comp.season     && <span>{comp.season}</span>}
            {lnk.poules?.length > 0 && (
              <span>{lnk.poules.length} poule{lnk.poules.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {syncMsg && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{syncMsg}</span>}
          <button onClick={handleSync} disabled={syncing}
            style={{ ...ghostBtn, fontSize: 12, opacity: syncing ? 0.6 : 1 }}>
            {syncing ? 'Bezig…' : '🔄 Sync'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: tab === t ? 700 : 400,
            color: tab === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
            padding: '6px 12px',
            borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: -1,
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Standen'   && <StandenTab   lnk={lnk} />}
      {tab === 'Programma' && <ProgrammaTab lnk={lnk} />}
      {tab === 'Uitslagen' && <UitslagenTab lnk={lnk} />}
    </div>
  )
}
