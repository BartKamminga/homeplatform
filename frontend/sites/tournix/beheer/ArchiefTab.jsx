import { useState, useEffect } from 'react'
import { getCaptureSessions, getCaptureSessionItems } from '../api.js'
import { muted, ghostBtn } from './styles.js'

function fmt(iso) {
  if (!iso) return '?'
  return new Date(iso).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function SessionRow({ s, onSelect, selected }) {
  return (
    <div
      onClick={() => onSelect(s.session_id)}
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: selected ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))' : 'var(--color-surface)',
        cursor: 'pointer',
        marginBottom: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          {fmt(s.captured_at)}
        </span>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 99,
          background: 'var(--color-surface-2)', color: 'var(--color-text-muted)',
          border: '1px solid var(--color-border)',
        }}>
          {s.item_count} poules
        </span>
      </div>
      {s.competitions.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
          {s.competitions.join(' · ')}
        </div>
      )}
    </div>
  )
}

function ItemDetail({ item }) {
  const [open, setOpen] = useState(false)
  const m = item.meta

  // Parse standings and matches from payload
  const pouleData = item.payload?.data?.poule ?? null
  const standings = pouleData?.standings ?? []
  const matches   = pouleData?.matches   ?? []

  const rounds = {}
  for (const match of matches) {
    const r = match.round ?? match.match_day ?? 0
    if (!rounds[r]) rounds[r] = []
    rounds[r].push(match)
  }
  const sortedRounds = Object.keys(rounds).sort((a, b) => Number(a) - Number(b))

  const title = [m.competition, m.poule_name].filter(Boolean).join(' — ')
  const subtitle = [m.class_name, m.via_team ? `via ${m.via_team}` : null].filter(Boolean).join(' · ')

  return (
    <div style={{
      borderRadius: 7,
      border: '1px solid var(--color-border)',
      background: 'var(--color-background)',
      marginBottom: 6,
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', userSelect: 'none' }}>
          {open ? '▼' : '▶'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title || item.external_id}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>{subtitle}</div>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
          👥 {m.team_count ?? '?'} &nbsp; 📊 {m.matches_played ?? '?'} &nbsp; 📅 {m.matches_remaining ?? '?'}
        </span>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>

          {/* Standings */}
          {standings.length > 0 && (
            <div style={{ padding: '8px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 6 }}>Stand</div>
              <div style={{ display: 'grid', gridTemplateColumns: '18px 1fr 28px 28px 28px', gap: 4, fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2, padding: '0 2px' }}>
                <span>#</span><span>Team</span><span style={{ textAlign: 'right' }}>P</span><span style={{ textAlign: 'right' }}>D</span><span style={{ textAlign: 'right', fontWeight: 700 }}>Pts</span>
              </div>
              {standings.map((s, i) => {
                const name = s.team?.name ?? s.name ?? '—'
                const pts  = s.points ?? s.pts ?? 0
                const gf   = s.goals_for  ?? s.gf ?? 0
                const ga   = s.goals_against ?? s.ga ?? 0
                const diff = gf - ga
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '18px 1fr 28px 28px 28px', gap: 4, fontSize: 12, padding: '3px 2px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{i + 1}</span>
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    <span style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontSize: 11 }}>{gf}–{ga}</span>
                    <span style={{ textAlign: 'right', fontSize: 11, color: diff > 0 ? 'var(--color-success)' : diff < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                      {diff > 0 ? '+' : ''}{diff}
                    </span>
                    <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{pts}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Match rounds */}
          {sortedRounds.length > 0 && (
            <div style={{ padding: '8px 12px', borderTop: standings.length > 0 ? '1px solid var(--color-border)' : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 6 }}>Wedstrijden</div>
              {sortedRounds.map(r => (
                <div key={r} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 3 }}>Ronde {r}</div>
                  {rounds[r].map((match, mi) => {
                    const ha = match.home_team?.name ?? match.team_a?.name ?? '—'
                    const hb = match.away_team?.name ?? match.team_b?.name ?? '—'
                    const finished = match.status === 'final' || match.status === 'finished'
                    const score = finished ? `${match.home_goals ?? match.score_a ?? 0}–${match.away_goals ?? match.score_b ?? 0}` : '–'
                    return (
                      <div key={mi} style={{ display: 'flex', alignItems: 'center', fontSize: 11, gap: 4, padding: '1px 0' }}>
                        <span style={{ flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text)' }}>{ha}</span>
                        <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, color: finished ? 'var(--color-text)' : 'var(--color-text-muted)', fontSize: finished ? 12 : 11 }}>{score}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text)' }}>{hb}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {standings.length === 0 && sortedRounds.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Geen detail-data beschikbaar voor dit item.
            </div>
          )}

          <div style={{ padding: '6px 12px 8px', fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace', borderTop: '1px solid var(--color-border)' }}>
            id: {item.external_id} · vastgelegd {fmt(item.captured_at)}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ArchiefTab() {
  const [sessions,    setSessions]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selectedSid, setSelectedSid] = useState(null)
  const [items,       setItems]       = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    setLoading(true)
    getCaptureSessions()
      .then(r => { setSessions(r.sessions ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  async function selectSession(sid) {
    if (selectedSid === sid) { setSelectedSid(null); setItems([]); return }
    setSelectedSid(sid)
    setItemsLoading(true)
    try {
      const r = await getCaptureSessionItems(sid)
      setItems(r.items ?? [])
    } catch (e) {
      setItems([])
    } finally {
      setItemsLoading(false)
    }
  }

  if (loading) return <div style={muted}>Laden…</div>
  if (error)   return <div style={{ ...muted, color: 'var(--color-danger)' }}>Fout: {error}</div>
  if (sessions.length === 0) return (
    <div style={muted}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>🗄️</div>
      <div>Nog geen gearchiveerde data.</div>
      <div style={{ marginTop: 4, fontSize: 12 }}>
        Data wordt automatisch gearchiveerd als je de Hockey Data Vanger gebruikt.
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Sessie lijst */}
      <div style={{ flex: '0 0 260px', minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
          Sessies ({sessions.length})
        </div>
        {sessions.map(s => (
          <SessionRow
            key={s.session_id}
            s={s}
            selected={selectedSid === s.session_id}
            onSelect={selectSession}
          />
        ))}
      </div>

      {/* Detail */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selectedSid && (
          <div style={muted}>Klik op een sessie om de gevangen poules te zien.</div>
        )}
        {selectedSid && itemsLoading && (
          <div style={muted}>Laden…</div>
        )}
        {selectedSid && !itemsLoading && items.length === 0 && (
          <div style={muted}>Geen items gevonden.</div>
        )}
        {selectedSid && !itemsLoading && items.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              {items.length} poules in deze sessie
            </div>
            {items.map(item => <ItemDetail key={item.id} item={item} />)}
          </>
        )}
      </div>
    </div>
  )
}
