import { useState, useEffect } from 'react'
import {
  getCaptureSessions, getCaptureSessionItems, reprocessCaptures,
  deleteCaptureSession, deleteOldCaptureSessions,
} from '../api.js'
import { muted, ghostBtn } from './styles.js'

const PAGE_SIZE = 50

function captureLabel(captureType) {
  if (captureType === 'poule_capture') return 'Poule capture'
  if (captureType === 'club_detail')   return 'Club detail'
  if (captureType === 'comp_detail')   return 'Competitie detail'
  if (captureType === 'clubs_list')    return 'Clubs lijst'
  if (captureType === 'comp_list')     return 'Competities lijst'
  return 'Capture'
}

function fmt(iso) {
  if (!iso) return '?'
  return new Date(iso).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function SessionRow({ s, onSelect, selected, onReprocess, reprocessing, onDelete, deleting }) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={e => { e.stopPropagation(); onReprocess(s.session_id) }}
            disabled={reprocessing}
            title="Herverwerk alle poule-captures in deze sessie"
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 5, cursor: reprocessing ? 'default' : 'pointer',
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text-muted)', fontFamily: 'inherit', opacity: reprocessing ? 0.5 : 1,
            }}
          >
            🔄 herverwerk
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(s.session_id) }}
            disabled={deleting}
            title="Verwijder deze sessie uit het archief"
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 5, cursor: deleting ? 'default' : 'pointer',
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text-muted)', fontFamily: 'inherit', opacity: deleting ? 0.5 : 1,
            }}
          >
            🗑
          </button>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 99,
            background: 'var(--color-surface-2)', color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
          }}>
            {s.item_count} item{s.item_count === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      {s.competitions.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
          {s.competitions.join(' · ')}
        </div>
      )}
    </div>
  )
}

function ItemDetail({ item, onReprocess, reprocessing }) {
  const [open,    setOpen]    = useState(false)
  const [rawOpen, setRawOpen] = useState(false)
  const [copied,  setCopied]  = useState(false)
  const m = item.meta

  // Parse standings and matches from payload — zelfde dubbele data-envelope
  // als de backend-parser (_parse_raw_poule leest raw.data.data.poule, zie
  // item 709); compDetailData hieronder deed dit al goed, poule_capture niet.
  const pouleData = item.payload?.data?.data?.poule ?? null
  const standings = pouleData?.standings ?? []
  const matches   = pouleData?.matches   ?? []

  const rounds = {}
  for (const match of matches) {
    const r = match.round ?? match.match_day ?? 0
    if (!rounds[r]) rounds[r] = []
    rounds[r].push(match)
  }
  const sortedRounds = Object.keys(rounds).sort((a, b) => Number(a) - Number(b))

  const isCompDetail  = item.capture_type === 'comp_detail'
  const isClubDetail  = item.capture_type === 'club_detail'
  const isClubsList   = item.capture_type === 'clubs_list'
  const compDetailData   = isCompDetail ? (item.payload?.data?.data ?? {}) : null
  const compDetailPoules = compDetailData?.poules ?? []
  const clubPayload   = isClubDetail ? item.payload : null
  const clubTeams     = clubPayload?.teams ?? []

  const title = isCompDetail
    ? (compDetailData?.name || m.competition || captureLabel(item.capture_type))
    : isClubDetail
      ? (m.name || m.club || captureLabel(item.capture_type))
      : ([m.competition, m.poule_name].filter(Boolean).join(' — ') || captureLabel(item.capture_type))
  const subtitle = isCompDetail
    ? (m.class_name || '')
    : isClubDetail
      ? [clubPayload?.city, clubPayload?.district].filter(Boolean).join(' · ')
      : [m.class_name, m.via_team ? `via ${m.via_team}` : null].filter(Boolean).join(' · ')

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
        {isCompDetail
          ? <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>🏆 {compDetailPoules.length} poules</span>
          : isClubDetail
            ? <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>👥 {m.teams ?? '?'} teams</span>
            : isClubsList
              ? <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>🏟️ {m.clubs_count ?? '?'} clubs</span>
              : item.capture_type === 'poule_capture'
                ? <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>👥 {m.team_count ?? '?'} &nbsp; 📊 {m.matches_played ?? '?'} &nbsp; 📅 {m.matches_remaining ?? '?'}</span>
                : null
        }
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

          {isCompDetail && compDetailPoules.length > 0 && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Poules ({compDetailPoules.length})
              </div>
              {compDetailPoules.map(p => {
                const cls = p.competition?.class_name
                const nTeams = p.standings?.length ?? '?'
                const nMatches = p.matches?.length ?? '?'
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '2px 0', borderBottom: '1px solid color-mix(in srgb, var(--color-border) 40%, transparent)' }}>
                    <span style={{ flex: 1, fontWeight: 500 }}>{p.name}</span>
                    {cls && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{cls}</span>}
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>#{p.id}</span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{nTeams} teams · {nMatches} wed.</span>
                  </div>
                )
              })}
            </div>
          )}

          {isClubDetail && (clubPayload?.city || clubPayload?.district || clubPayload?.website || clubTeams.length > 0) && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border)' }}>
              {(clubPayload?.city || clubPayload?.district || clubPayload?.website) && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                  {clubPayload.city     && <span>📍 {clubPayload.city}</span>}
                  {clubPayload.district && <span>🗺 {clubPayload.district}</span>}
                  {clubPayload.website  && (
                    <a href={clubPayload.website} target="_blank" rel="noreferrer"
                       style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>🌐 Website</a>
                  )}
                </div>
              )}
              {clubTeams.length > 0 && (() => {
                const byCategory = {}
                for (const t of clubTeams) {
                  const cat = t.category_group_name || 'Overig'
                  if (!byCategory[cat]) byCategory[cat] = []
                  byCategory[cat].push(t)
                }
                return (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                      Teams ({clubTeams.length})
                    </div>
                    {Object.entries(byCategory).map(([cat, teams]) => (
                      <div key={cat} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>{cat}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {teams.map(t => (
                            <div key={t.id} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                              borderRadius: 5, padding: '2px 7px', fontSize: 11,
                            }}>
                              <span style={{ fontSize: 10 }}>{t.hockey_type === 'ZA' ? '🏒' : '🏑'}</span>
                              <span>{t.short_name || t.name}</span>
                              {t.recent_poule_id && (
                                <span style={{ fontSize: 9, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                  #{t.recent_poule_id}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          {standings.length === 0 && sortedRounds.length === 0 && !isCompDetail && !isClubDetail && (
            <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Geen detail-data beschikbaar voor dit item.
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--color-border)', padding: '6px 12px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace', flex: 1 }}>
              id: {item.external_id} · vastgelegd {fmt(item.captured_at)}
            </span>
            {(item.capture_type === 'poule_capture' || item.capture_type === 'comp_detail') && (
              <button
                onClick={e => { e.stopPropagation(); onReprocess(item.id) }}
                disabled={reprocessing}
                title="Herverwerk deze capture"
                style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, cursor: reprocessing ? 'default' : 'pointer',
                  fontFamily: 'inherit', border: '1px solid var(--color-border)', background: 'transparent',
                  color: 'var(--color-text-muted)', opacity: reprocessing ? 0.5 : 1 }}
              >↺ herverwerk</button>
            )}
            {item.payload && (
              <>
                {copied && <span style={{ fontSize: 10, color: 'var(--color-success)' }}>✓</span>}
                <button
                  onClick={e => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(JSON.stringify(item.payload, null, 2))
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
                    border: '1px solid var(--color-border)', background: 'transparent',
                    color: 'var(--color-text-muted)' }}
                  title="Kopieer JSON naar klembord"
                >📋</button>
                <button
                  onClick={e => { e.stopPropagation(); setRawOpen(o => !o) }}
                  style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
                    border: '1px solid var(--color-border)', background: rawOpen ? 'var(--color-surface-2)' : 'transparent',
                    color: rawOpen ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                >
                  {rawOpen ? '▲ raw' : '▶ raw'}
                </button>
              </>
            )}
          </div>
          {rawOpen && item.payload && (
            <div style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
              <pre style={{ margin: 0, padding: '10px 12px', fontSize: 10, fontFamily: 'monospace', lineHeight: 1.5,
                color: 'var(--color-text-muted)', overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                {JSON.stringify(item.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ArchiefTab() {
  const [sessions,     setSessions]     = useState([])
  const [hasMore,      setHasMore]      = useState(false)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [selectedSid,  setSelectedSid]  = useState(null)
  const [items,        setItems]        = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [error,        setError]        = useState(null)
  const [reprocessing, setReprocessing] = useState(false)
  const [reprocessMsg, setReprocessMsg] = useState(null)
  const [deleting,     setDeleting]     = useState(false)
  const [cleanupDays,  setCleanupDays]  = useState(30)

  useEffect(() => {
    setLoading(true)
    getCaptureSessions(0, PAGE_SIZE)
      .then(r => { setSessions(r.sessions ?? []); setHasMore(!!r.has_more); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const r = await getCaptureSessions(sessions.length, PAGE_SIZE)
      setSessions(prev => [...prev, ...(r.sessions ?? [])])
      setHasMore(!!r.has_more)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleDeleteSession(sid) {
    if (!window.confirm('Deze sessie definitief uit het archief verwijderen?')) return
    setDeleting(true)
    try {
      await deleteCaptureSession(sid)
      setSessions(prev => prev.filter(s => s.session_id !== sid))
      if (selectedSid === sid) { setSelectedSid(null); setItems([]) }
    } catch (e) {
      setReprocessMsg(`Fout: ${e.message}`)
    } finally {
      setDeleting(false)
    }
  }

  async function handleCleanupOld() {
    if (!window.confirm(`Alle captures ouder dan ${cleanupDays} dagen definitief verwijderen?`)) return
    setDeleting(true)
    try {
      const r = await deleteOldCaptureSessions(cleanupDays)
      setReprocessMsg(`✓ ${r.deleted} captures opgeruimd`)
      const r2 = await getCaptureSessions(0, PAGE_SIZE)
      setSessions(r2.sessions ?? [])
      setHasMore(!!r2.has_more)
      setSelectedSid(null)
      setItems([])
    } catch (e) {
      setReprocessMsg(`Fout: ${e.message}`)
    } finally {
      setDeleting(false)
      setTimeout(() => setReprocessMsg(null), 5000)
    }
  }

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

  async function handleReprocessSession(sid) {
    setReprocessing(true)
    setReprocessMsg(null)
    try {
      const r = await reprocessCaptures({ session_id: sid })
      setReprocessMsg(`✓ ${r.ok} verwerkt${r.failed ? `, ${r.failed} mislukt` : ''}`)
    } catch (e) {
      setReprocessMsg(`Fout: ${e.message}`)
    } finally {
      setReprocessing(false)
      setTimeout(() => setReprocessMsg(null), 5000)
    }
  }

  async function handleReprocessCapture(captureId) {
    setReprocessing(true)
    setReprocessMsg(null)
    try {
      const r = await reprocessCaptures({ capture_id: captureId })
      setReprocessMsg(`✓ ${r.ok} verwerkt${r.failed ? `, ${r.failed} mislukt` : ''}`)
    } catch (e) {
      setReprocessMsg(`Fout: ${e.message}`)
    } finally {
      setReprocessing(false)
      setTimeout(() => setReprocessMsg(null), 5000)
    }
  }

  if (loading) return <div style={muted}>Laden…</div>
  if (error)   return <div style={{ ...muted, color: 'var(--color-danger)' }}>Fout: {error}</div>
  if (sessions.length === 0) return (
    <div style={muted}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>🗄️</div>
      <div>Nog geen gearchiveerde data.</div>
      <div style={{ marginTop: 4, fontSize: 12 }}>
        Data wordt automatisch gearchiveerd als je Scout of Ghost gebruikt.
      </div>
    </div>
  )

  return (
    <div>
      {reprocessMsg && (
        <div style={{
          marginBottom: 12, padding: '8px 14px', borderRadius: 7, fontSize: 12,
          background: reprocessMsg.startsWith('✓') ? 'color-mix(in srgb, var(--color-success) 12%, var(--color-surface))' : 'color-mix(in srgb, var(--color-danger) 12%, var(--color-surface))',
          border: `1px solid ${reprocessMsg.startsWith('✓') ? 'var(--color-success)' : 'var(--color-danger)'}`,
          color: 'var(--color-text)',
        }}>
          {reprocessMsg}
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Sessie lijst */}
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Sessies ({sessions.length}{hasMore ? '+' : ''})
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Opschonen ouder dan</span>
            <input
              type="number" min={1} value={cleanupDays}
              onChange={e => setCleanupDays(Number(e.target.value) || 1)}
              style={{
                width: 48, fontSize: 11, padding: '2px 6px', borderRadius: 5,
                border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>dagen</span>
            <button
              onClick={handleCleanupOld}
              disabled={deleting}
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 5, cursor: deleting ? 'default' : 'pointer',
                border: '1px solid var(--color-border)', background: 'transparent',
                color: 'var(--color-text-muted)', fontFamily: 'inherit', opacity: deleting ? 0.5 : 1,
              }}
            >
              🧹 opschonen
            </button>
          </div>
          {sessions.map(s => (
            <SessionRow
              key={s.session_id}
              s={s}
              selected={selectedSid === s.session_id}
              onSelect={selectSession}
              onReprocess={handleReprocessSession}
              reprocessing={reprocessing}
              onDelete={handleDeleteSession}
              deleting={deleting}
            />
          ))}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                width: '100%', fontSize: 12, padding: '8px', borderRadius: 6, marginTop: 6,
                cursor: loadingMore ? 'default' : 'pointer', border: '1px solid var(--color-border)',
                background: 'transparent', color: 'var(--color-text-muted)', fontFamily: 'inherit',
              }}
            >
              {loadingMore ? 'Laden…' : 'Meer laden'}
            </button>
          )}
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
                {items.length} item{items.length === 1 ? '' : 's'} in deze sessie
              </div>
              {items.map(item => (
                <ItemDetail
                  key={item.id}
                  item={item}
                  onReprocess={handleReprocessCapture}
                  reprocessing={reprocessing}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
