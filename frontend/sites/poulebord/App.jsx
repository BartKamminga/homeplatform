import { useState, useEffect, useRef } from 'react'
import { getTournaments, getPhases, getPhaseStandings, getClubs, getBoard, saveBoard, getBoardByCode, searchPools, getPoolMatches } from './api.js'

const _standingsCache = {}
function useStandings(phaseId) {
  const [data, setData] = useState(_standingsCache[phaseId] ?? null)
  useEffect(() => {
    if (!phaseId) return
    if (_standingsCache[phaseId]) { setData(_standingsCache[phaseId]); return }
    getPhaseStandings(phaseId)
      .then(rows => { _standingsCache[phaseId] = rows; setData(rows) })
      .catch(() => setData([]))
  }, [phaseId])
  return data
}

const SEASON    = '2026-2027'
const CATEGORIES = ['MO14', 'JO14', 'MO16', 'JO16', 'MO18', 'JO18']
const CLUB_KEY       = 'pb_club'
const BOARD_KEY      = 'pb_board_on'
const PINS_KEY       = 'pb_pins'
const POOL_PINS_KEY  = 'pb_pool_pins'
const MY_BOARDS_KEY  = 'pb_my_boards'

const C = {
  bg:     '#0b3427',
  deep:   '#082a20',
  card:   '#10402f',
  chalk:  '#f3efe3',
  muted:  '#8fab9d',
  gold:   '#cf9f3f',
  goldBr: '#e8bf68',
  border: 'rgba(143,171,157,0.18)',
}

const SEIZOEN_INFO = {
  MO18: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 6 wedstrijden',
      niveaus: ['Topklasse — 8 poules × 4', 'Subtopklasse — 16 poules × 4', '1e Klasse — per district'] },
    { nr: 2, label: 'Reguliere competitie', periode: 'Na herfstvakantie · 14 wedstrijden',
      niveaus: ['Landelijke Competitie — 2 poules × 8', 'Super O18 — 4 poules × 8', 'Subtopklasse — 6 poules × 8', '1e Klasse — per district'] },
    { nr: 3, label: 'Play-offs & NK', periode: '13, 20 en 27 juni',
      niveaus: ['LC: nr. 1+2 → halve finales, finale 27 juni', 'Super O18: nr. 1+2 per poule → finaledag 20 juni'] },
  ],
  JO18: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 6 wedstrijden',
      niveaus: ['Topklasse — 8 poules × 4', 'Subtopklasse — 16 poules × 4', '1e Klasse — per district'] },
    { nr: 2, label: 'Reguliere competitie', periode: 'Na herfstvakantie · 14 wedstrijden',
      niveaus: ['Landelijke Competitie — 2 poules × 8', 'Super O18 — 4 poules × 8', 'Subtopklasse — 6 poules × 8', '1e Klasse — per district'] },
    { nr: 3, label: 'Play-offs & NK', periode: '13, 20 en 27 juni',
      niveaus: ['LC: nr. 1+2 → halve finales, finale 27 juni', 'Super O18: nr. 1+2 per poule → finaledag 20 juni'] },
  ],
  MO16: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 5 wedstrijden',
      niveaus: ['Topklasse — 8 poules × 6', 'Subtopklasse — 8 poules × 6', '1e Klasse — per district'] },
    { nr: 2, label: 'Reguliere competitie', periode: 'Na herfstvakantie',
      niveaus: ['Landelijke Competitie — 4 poules × 6', 'Super O16 — 4 poules × 6', 'Subtopklasse', '1e Klasse — per district'] },
    { nr: 3, label: 'NK', periode: 'Voorjaar', niveaus: ['LC play-offs', 'Super O16 finaledag'] },
  ],
  JO16: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 5 wedstrijden',
      niveaus: ['Topklasse — 8 poules × 6', 'Subtopklasse — 8 poules × 6', '1e Klasse — per district'] },
    { nr: 2, label: 'Reguliere competitie', periode: 'Na herfstvakantie',
      niveaus: ['Landelijke Competitie — 4 poules × 6', 'Super O16 — 4 poules × 6', 'Subtopklasse', '1e Klasse — per district'] },
    { nr: 3, label: 'NK', periode: 'Voorjaar', niveaus: ['LC play-offs', 'Super O16 finaledag'] },
  ],
  MO14: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 5 wedstrijden', niveaus: ['10 poules × 6 (60 teams)'] },
    { nr: 2, label: 'Herindeling', periode: 'Na herfstvakantie',
      niveaus: ['Super O14 — 5 poules × 6 (nr. 1-3)', 'IDC O14 — nr. 4+5', 'Subtopklasse — nr. 6'] },
    { nr: 3, label: 'NK O14', periode: 'Voorjaar', niveaus: ['Super O14: nr. 1+2 per poule → finaledag'] },
  ],
  JO14: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 5 wedstrijden', niveaus: ['8 poules × 6 (48 teams)'] },
    { nr: 2, label: 'Hermindeling', periode: 'Na herfstvakantie', niveaus: ['4 poules × 6 (nr. 1-3 per poule)'] },
    { nr: 3, label: 'NK O14', periode: 'Voorjaar', niveaus: ['Play-offs vanuit hermindeling'] },
  ],
}

function categoryOf(name = '') {
  const u = name.toUpperCase()
  return CATEGORIES.find(c => u.includes(c)) ?? null
}

function sublabelOf(name = '', cat = '') {
  return name.replace(new RegExp(cat, 'i'), '').trim()
}

// ── Empty board ────────────────────────────────────────────────────────────────

function EmptyBoard() {
  return (
    <div style={{ textAlign: 'center', padding: '52px 24px' }}>
      <div style={{ fontSize: 36, marginBottom: 14 }}>📌</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
        letterSpacing: '0.06em', marginBottom: 10, color: C.chalk }}>JE BOARD IS LEEG</div>
      <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
        Stel je club in via ⭐ om automatisch alle NK-poules te zien.<br /><br />
        Of pin een competitie of poule tijdens het bladeren.
      </div>
    </div>
  )
}

// ── Season info ────────────────────────────────────────────────────────────────

function SeizoenInfo({ cat, open, onToggle }) {
  const info = SEIZOEN_INFO[cat]
  if (!info) return null
  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={onToggle} style={{
        background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8,
        color: C.muted, fontSize: 11, padding: '4px 10px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
      }}>
        <span>ℹ</span><span>Seizoensstructuur {cat}</span>
        <span style={{ fontSize: 9 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ background: C.deep, borderRadius: 10, padding: '12px', marginTop: 6,
          border: `1px solid ${C.border}`, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {info.map(fase => (
            <div key={fase.nr} style={{ flex: '1 1 150px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <div style={{ background: C.gold, color: C.deep, borderRadius: '50%', width: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{fase.nr}</div>
                <div>
                  <div style={{ color: C.chalk, fontWeight: 700, fontSize: 11 }}>{fase.label}</div>
                  <div style={{ color: C.muted, fontSize: 9 }}>{fase.periode}</div>
                </div>
              </div>
              {fase.niveaus.map((n, i) => (
                <div key={i} style={{ fontSize: 10, color: C.muted, paddingLeft: 10, paddingBottom: 2,
                  borderLeft: `2px solid ${C.border}`, marginLeft: 8 }}>{n}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Pool detail modal (bottom sheet) ─────────────────────────────────────────

function PoolDetailModal({ phaseId, poolName, tournamentName, rows, onClose }) {
  const [matches, setMatches] = useState(null)

  useEffect(() => {
    getPoolMatches(phaseId, poolName)
      .then(setMatches)
      .catch(() => setMatches({ finished: [], scheduled: [] }))
  }, [phaseId, poolName])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}>
      <div style={{ background: C.deep, borderRadius: '16px 16px 0 0', width: '100%',
        maxHeight: '82dvh', overflowY: 'auto',
        border: `1px solid ${C.border}`, borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, background: C.deep,
          padding: '14px 16px 10px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24,
              letterSpacing: '0.06em', color: C.gold, lineHeight: 1 }}>
              POULE {poolName}
            </div>
            {tournamentName && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{tournamentName}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'transparent',
            border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '6px 12px', color: C.muted, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        </div>

        <div style={{ padding: '14px 14px 32px' }}>
          {/* Standings */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Stand</div>
          <div style={{ background: C.card, borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.muted, fontSize: 10 }}>
                  <th style={{ padding: '5px 3px 5px 12px', textAlign: 'left', fontWeight: 500, width: 20 }}>#</th>
                  <th style={{ padding: '5px 3px', textAlign: 'left', fontWeight: 500 }}>Team</th>
                  <th style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 500, width: 26 }}>W</th>
                  <th style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 500, width: 26 }}>G</th>
                  <th style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 500, width: 26 }}>V</th>
                  <th style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 500, width: 44, whiteSpace: 'nowrap' }}>GV–GT</th>
                  <th style={{ padding: '5px 12px 5px 3px', textAlign: 'center', fontWeight: 600,
                    width: 32, color: C.chalk }}>Pt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${C.border}`,
                    background: i === 0 ? 'rgba(207,159,63,0.07)' : 'transparent' }}>
                    <td style={{ padding: '6px 3px 6px 12px', color: C.muted, fontSize: 11 }}>{i + 1}</td>
                    <td style={{ padding: '6px 3px', color: C.chalk, fontWeight: i === 0 ? 600 : 400,
                      maxWidth: 0, width: '100%', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td>
                    <td style={{ padding: '6px', textAlign: 'center', color: C.muted }}>{r.w}</td>
                    <td style={{ padding: '6px', textAlign: 'center', color: C.muted }}>{r.d}</td>
                    <td style={{ padding: '6px', textAlign: 'center', color: C.muted }}>{r.l}</td>
                    <td style={{ padding: '6px', textAlign: 'center', color: C.muted, fontSize: 11 }}>
                      {r.gf ?? 0}–{r.ga ?? 0}
                    </td>
                    <td style={{ padding: '6px 12px 6px 3px', textAlign: 'center',
                      color: C.goldBr, fontWeight: 700, fontSize: 14 }}>{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Matches */}
          {matches === null ? (
            <div style={{ textAlign: 'center', color: C.muted, padding: '12px 0', fontSize: 13 }}>Laden…</div>
          ) : (
            <>
              {matches.finished.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
                    textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Gespeeld</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
                    {matches.finished.map(m => (
                      <div key={m.id} style={{ background: C.card, borderRadius: 8,
                        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ flex: 1, fontSize: 12, color: C.chalk, textAlign: 'right',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.team_a}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.gold,
                          letterSpacing: '0.04em', flexShrink: 0, minWidth: 44, textAlign: 'center' }}>
                          {m.score_a}–{m.score_b}
                        </span>
                        <span style={{ flex: 1, fontSize: 12, color: C.chalk,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.team_b}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {matches.scheduled.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
                    textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Nog te spelen</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {matches.scheduled.map(m => (
                      <div key={m.id} style={{ background: C.card, borderRadius: 8,
                        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ flex: 1, fontSize: 12, color: C.chalk, textAlign: 'right',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.team_a}</span>
                        <span style={{ fontSize: 12, color: C.muted, flexShrink: 0,
                          minWidth: 44, textAlign: 'center' }}>vs</span>
                        <span style={{ flex: 1, fontSize: 12, color: C.chalk,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.team_b}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {matches.finished.length === 0 && matches.scheduled.length === 0 && (
                <div style={{ textAlign: 'center', color: C.muted, fontSize: 12,
                  fontStyle: 'italic', padding: '8px 0' }}>Geen wedstrijden gevonden</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Standings table ────────────────────────────────────────────────────────────

function StandingsTable({ rows, club, phaseId, poolPins, onPoolPin, tournamentName }) {
  const [detailPool, setDetailPool] = useState(null) // { poolName, rows }

  const byPool = {}
  for (const r of rows) {
    const key = r.pool_name ?? '—'
    if (!byPool[key]) byPool[key] = []
    byPool[key].push(r)
  }

  const isMyClub = name => club && name.toLowerCase().startsWith(club.toLowerCase())

  return (
    <>
      {detailPool && (
        <PoolDetailModal
          phaseId={phaseId}
          poolName={detailPool.poolName}
          tournamentName={tournamentName || ''}
          rows={detailPool.rows}
          onClose={() => setDetailPool(null)}
        />
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(byPool)
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
          .map(([pname, prows]) => {
            const pinKey = `${phaseId}::${pname}`
            const isPinned = poolPins?.has(pinKey)
            return (
              <div key={pname} style={{ flex: '1 1 240px', background: C.deep, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '5px 6px 5px 10px', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.08em', color: C.gold, borderBottom: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button onClick={() => setDetailPool({ poolName: pname, rows: prows })}
                    style={{ background: 'transparent', border: 'none', padding: 0,
                      cursor: 'pointer', color: C.gold, fontWeight: 700, fontSize: 11,
                      letterSpacing: '0.08em', fontFamily: 'inherit', textAlign: 'left' }}>
                    POULE {pname} ›
                  </button>
                  {onPoolPin && (
                    <button
                      onClick={() => onPoolPin(phaseId, pname)}
                      title={isPinned ? 'Verwijder poule van board' : 'Pin deze poule op je board'}
                      style={{
                        background: isPinned ? 'rgba(207,159,63,0.15)' : 'transparent',
                        border: `1px solid ${isPinned ? C.gold : 'transparent'}`,
                        borderRadius: 4, padding: '1px 5px', fontSize: 10,
                        color: isPinned ? C.gold : C.muted, cursor: 'pointer',
                        lineHeight: 1.4, flexShrink: 0,
                      }}>📌</button>
                  )}
                </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: C.muted, fontSize: 10 }}>
                    <th style={{ padding: '4px 3px 4px 10px', textAlign: 'left', fontWeight: 500, width: 18 }}>#</th>
                    <th style={{ padding: '4px 3px', textAlign: 'left', fontWeight: 500 }}>Team</th>
                    <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 24 }}>W</th>
                    <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 24 }}>G</th>
                    <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 24 }}>V</th>
                    <th style={{ padding: '4px 10px 4px 3px', textAlign: 'center', fontWeight: 600, width: 30, color: C.chalk }}>Pt</th>
                  </tr>
                </thead>
                <tbody>
                  {prows.map((r, i) => {
                    const my = isMyClub(r.name)
                    return (
                      <tr key={r.id} style={{
                        borderTop: `1px solid ${C.border}`,
                        background: my ? 'rgba(207,159,63,0.13)' : i === 0 ? 'rgba(207,159,63,0.05)' : 'transparent',
                      }}>
                        <td style={{ padding: '5px 3px 5px 10px', color: C.muted, fontSize: 11 }}>{i + 1}</td>
                        <td style={{ padding: '5px 3px', color: my ? C.goldBr : C.chalk,
                          fontWeight: my || i === 0 ? 600 : 400,
                          maxWidth: 0, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {my && <span style={{ marginRight: 3, fontSize: 9 }}>▶</span>}
                          {r.name}
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', color: C.muted }}>{r.w}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', color: C.muted }}>{r.d}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center', color: C.muted }}>{r.l}</td>
                        <td style={{ padding: '5px 10px 5px 3px', textAlign: 'center',
                          color: C.goldBr, fontWeight: 700, fontSize: 13 }}>{r.pts}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Club pool card (board) ────────────────────────────────────────────────────

function ClubPoolCard({ entry, club }) {
  const standings = useStandings(entry.phase_id)
  const [showDetail, setShowDetail] = useState(false)

  const poolRows = standings ? standings.filter(r => r.pool_name === entry.pool_name) : null
  const isMyClub = name => club && name.toLowerCase().startsWith(club.toLowerCase())

  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
      marginBottom: 8, overflow: 'hidden' }}>
      {showDetail && poolRows && (
        <PoolDetailModal
          phaseId={entry.phase_id}
          poolName={entry.pool_name}
          tournamentName={entry.tournament_name}
          rows={poolRows}
          onClose={() => setShowDetail(false)}
        />
      )}
      <div style={{ padding: '5px 10px', fontSize: 10, color: C.muted,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => poolRows?.length > 0 && setShowDetail(true)}
          style={{ background: 'transparent', border: 'none', padding: 0,
            cursor: poolRows?.length > 0 ? 'pointer' : 'default',
            color: C.gold, fontWeight: 700, letterSpacing: '0.06em', fontSize: 11,
            fontFamily: 'inherit', flexShrink: 0 }}>
          POULE {entry.pool_name}{poolRows?.length > 0 ? ' ›' : ''}
        </button>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.tournament_name}
        </span>
      </div>
      {poolRows === null ? (
        <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 10 }}>Laden…</div>
      ) : poolRows.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 10, fontStyle: 'italic' }}>
          Nog geen wedstrijden gespeeld
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: C.muted, fontSize: 10 }}>
              <th style={{ padding: '4px 3px 4px 10px', textAlign: 'left', fontWeight: 500, width: 18 }}>#</th>
              <th style={{ padding: '4px 3px', textAlign: 'left', fontWeight: 500 }}>Team</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 24 }}>W</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 24 }}>G</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 24 }}>V</th>
              <th style={{ padding: '4px 10px 4px 3px', textAlign: 'center', fontWeight: 600, width: 30, color: C.chalk }}>Pt</th>
            </tr>
          </thead>
          <tbody>
            {poolRows.map((r, i) => {
              const my = isMyClub(r.name)
              return (
                <tr key={r.id} style={{
                  borderTop: `1px solid ${C.border}`,
                  background: my ? 'rgba(207,159,63,0.13)' : i === 0 ? 'rgba(207,159,63,0.05)' : 'transparent',
                }}>
                  <td style={{ padding: '5px 3px 5px 10px', color: C.muted, fontSize: 11 }}>{i + 1}</td>
                  <td style={{ padding: '5px 3px', color: my ? C.goldBr : C.chalk,
                    fontWeight: my || i === 0 ? 600 : 400,
                    maxWidth: 0, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {my && <span style={{ marginRight: 3, fontSize: 9 }}>▶</span>}
                    {r.name}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'center', color: C.muted }}>{r.w}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'center', color: C.muted }}>{r.d}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'center', color: C.muted }}>{r.l}</td>
                  <td style={{ padding: '5px 10px 5px 3px', textAlign: 'center',
                    color: C.goldBr, fontWeight: 700, fontSize: 13 }}>{r.pts}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Phase card ────────────────────────────────────────────────────────────────

function PhaseCard({ phase, club, poolPins, onPoolPin, tournamentName }) {
  const standings = useStandings(phase.phase_type === 'pool' ? phase.id : null)

  if (phase.phase_type !== 'pool') return null

  return (
    <div style={{ marginBottom: 4 }}>
      {phase.name && (
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '8px 0 6px', fontWeight: 600 }}>{phase.name}</div>
      )}
      {standings === null
        ? <div style={{ color: C.muted, fontSize: 13, padding: '10px 0', textAlign: 'center' }}>Laden…</div>
        : standings.length === 0
          ? <div style={{ color: C.muted, fontSize: 13, padding: '10px 0', textAlign: 'center', fontStyle: 'italic' }}>
              Nog geen wedstrijden gespeeld
            </div>
          : <StandingsTable rows={standings} club={club}
              phaseId={phase.id} poolPins={poolPins} onPoolPin={onPoolPin}
              tournamentName={tournamentName} />
      }
    </div>
  )
}

// ── Pinned pool group card (board) ────────────────────────────────────────────

function PinnedPoolSlot({ pin, isMyClub, onUnpin, idx }) {
  const standings = useStandings(pin.phaseId)
  const poolRows = standings ? standings.filter(r => r.pool_name === pin.poolName) : null
  return (
    <div style={{ flex: '1 1 180px', borderLeft: idx > 0 ? `1px solid ${C.border}` : 'none' }}>
      <div style={{ padding: '4px 6px 4px 10px', fontSize: 10, fontWeight: 700,
        letterSpacing: '0.08em', color: C.gold, borderBottom: `1px solid ${C.border}` }}>
        POULE {pin.poolName}
      </div>
      {poolRows === null ? (
        <div style={{ color: C.muted, fontSize: 11, padding: 8, textAlign: 'center' }}>Laden…</div>
      ) : poolRows.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 11, padding: 8, textAlign: 'center', fontStyle: 'italic' }}>Nog geen wedstrijden</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            {poolRows.map((r, i) => {
              const my = isMyClub(r.name)
              return (
                <tr key={r.id} style={{
                  borderTop: `1px solid ${C.border}`,
                  background: my ? 'rgba(207,159,63,0.13)' : i === 0 ? 'rgba(207,159,63,0.05)' : 'transparent',
                }}>
                  <td style={{ padding: '4px 3px 4px 8px', color: C.muted, fontSize: 10, width: 16 }}>{i + 1}</td>
                  <td style={{ padding: '4px 3px', color: my ? C.goldBr : C.chalk,
                    fontWeight: my || i === 0 ? 600 : 400,
                    maxWidth: 0, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {my && <span style={{ marginRight: 3, fontSize: 8 }}>▶</span>}
                    {r.name}
                  </td>
                  <td style={{ padding: '4px 8px 4px 3px', textAlign: 'center',
                    color: C.goldBr, fontWeight: 700, fontSize: 12, width: 26 }}>{r.pts}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function PinnedPoolGroupCard({ tournamentName, pins, club, onUnpin }) {
  const isMyClub = name => club && name.toLowerCase().startsWith(club.toLowerCase())
  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
      marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ padding: '5px 8px 5px 10px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: C.chalk, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tournamentName}
        </span>
        {pins.map(p => (
          <span key={`${p.phaseId}::${p.poolName}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: 'rgba(207,159,63,0.1)', border: `1px solid ${C.gold}`,
            borderRadius: 4, padding: '1px 4px', fontSize: 10, color: C.gold,
          }}>
            Poule {p.poolName}
            <button onClick={() => onUnpin(p.phaseId, p.poolName)} style={{
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', color: C.muted, fontSize: 9, lineHeight: 1,
            }}>✕</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {pins.map((p, idx) => (
          <PinnedPoolSlot key={`${p.phaseId}::${p.poolName}`}
            pin={p} isMyClub={isMyClub} onUnpin={onUnpin} idx={idx} />
        ))}
      </div>
    </div>
  )
}

// ── Pinned tournament card (board) ────────────────────────────────────────────

function CompactPinnedCard({ tournament, club, onUnpin }) {
  const [phases, setPhases] = useState(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    getPhases(tournament.id).then(setPhases).catch(() => setPhases([]))
  }, [tournament.id])

  const poolPhases = phases?.filter(p =>
    p.phase_type === 'pool' && (p.is_main_phase || p.pools?.some(pool => pool.team_count > 0))
  ) ?? []

  return (
    <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
      marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          flex: 1, padding: '12px 16px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ flex: 1, color: C.chalk, fontWeight: 700, fontSize: 15,
            fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {tournament.name}
          </span>
          <span style={{ color: C.muted, fontSize: 10 }}>{open ? '▲' : '▼'}</span>
        </button>
        <button onClick={onUnpin} style={{
          background: 'transparent', border: 'none',
          borderLeft: `1px solid ${C.border}`,
          padding: '0 14px', fontSize: 12, color: C.muted, cursor: 'pointer', flexShrink: 0,
        }}>✕</button>
      </div>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          {phases === null
            ? <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 8 }}>Laden…</div>
            : poolPhases.length === 0
              ? <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 8, fontStyle: 'italic' }}>Geen poulefases</div>
              : poolPhases.map(p => <PhaseCard key={p.id} phase={p} club={club} tournamentName={tournament.name} />)
          }
        </div>
      )}
    </div>
  )
}

// ── Tournament card (browse mode) ─────────────────────────────────────────────

function TournamentCard({ tournament, club, pinned, onPin, poolPins, onPoolPin }) {
  const [phases, setPhases] = useState(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    getPhases(tournament.id).then(setPhases).catch(() => setPhases([]))
  }, [tournament.id])

  const poolPhases = phases?.filter(p =>
    p.phase_type === 'pool' && (p.is_main_phase || p.pools?.some(pool => pool.team_count > 0))
  ) ?? []

  return (
    <div style={{ background: C.card, borderRadius: 12, overflow: 'hidden', marginBottom: 10,
      border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          flex: 1, padding: '13px 16px', background: 'transparent', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        }}>
          <span style={{ flex: 1, color: C.chalk, fontWeight: 700, fontSize: 16,
            fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {tournament.name}
          </span>
          <span style={{ color: C.muted, fontSize: 11 }}>{open ? '▲' : '▼'}</span>
        </button>
        <button onClick={onPin} title={pinned ? 'Verwijder competitie van board' : 'Pin competitie op board'} style={{
          background: pinned ? 'rgba(207,159,63,0.15)' : 'transparent',
          border: `1px solid ${pinned ? C.gold : 'transparent'}`,
          borderRadius: 4, padding: '1px 5px', fontSize: 10,
          color: pinned ? C.gold : C.muted, cursor: 'pointer',
          lineHeight: 1.4, flexShrink: 0, marginRight: 12,
        }}>📌</button>
      </div>

      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          {phases === null
            ? <div style={{ color: C.muted, fontSize: 13, padding: '10px 0', textAlign: 'center' }}>Laden…</div>
            : poolPhases.length === 0
              ? <div style={{ color: C.muted, fontSize: 13, padding: '10px 0', textAlign: 'center', fontStyle: 'italic' }}>
                  Geen poulefases gevonden
                </div>
              : poolPhases.map(p => (
                  <PhaseCard key={p.id} phase={p} club={club}
                    poolPins={poolPins} onPoolPin={onPoolPin}
                    tournamentName={tournament.name} />
                ))
          }
        </div>
      )}
    </div>
  )
}

// ── Board view ────────────────────────────────────────────────────────────────

function BoardSection({ label, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: C.muted,
        padding: '4px 2px 8px', borderTop: `1px solid ${C.border}` }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function BoardView({ club, pins, poolPins, allTournaments, onUnpin, onPoolUnpin }) {
  const [boardData, setBoardData] = useState(null)

  useEffect(() => {
    if (!club) { setBoardData([]); return }
    getBoard(club, 'productie').then(setBoardData).catch(() => setBoardData([]))
  }, [club])

  const clubTournamentIds  = new Set((boardData || []).map(e => e.tournament_id))
  const clubPhasePoolKeys  = new Set((boardData || []).map(e => `${e.phase_id}::${e.pool_name}`))

  const pinnedTournaments = [...pins]
    .map(id => allTournaments?.find(t => t.id === id))
    .filter(t => t && !clubTournamentIds.has(t.id))

  const pinnedPools = [...poolPins.values()]
    .filter(p => !clubPhasePoolKeys.has(`${p.phaseId}::${p.poolName}`))

  const hasClub     = club && boardData !== null && boardData.length > 0
  const hasT        = pinnedTournaments.length > 0
  const hasP        = pinnedPools.length > 0
  const hasPinned   = hasT || hasP
  const showSubLabels = hasT && hasP

  if (!club && !hasPinned) return <EmptyBoard />

  const byCategory = {}
  for (const entry of (boardData || [])) {
    const cat = entry.category || '—'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(entry)
  }

  return (
    <div style={{ padding: '12px 10px' }}>
      {club && boardData === null && (
        <div style={{ textAlign: 'center', color: C.muted, padding: '20px 0', fontSize: 13 }}>Laden…</div>
      )}

      {club && boardData !== null && boardData.length === 0 && (
        <div style={{ background: C.card, borderRadius: 10, padding: '14px 16px',
          color: C.muted, fontSize: 13, textAlign: 'center', marginBottom: 10,
          border: `1px solid ${C.border}` }}>
          Geen NK-poules gevonden voor <strong style={{ color: C.chalk }}>{club}</strong>
        </div>
      )}

      {CATEGORIES.filter(c => byCategory[c]).map(cat => (
        <div key={cat}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: C.gold, padding: '6px 2px 5px' }}>
            {cat}
          </div>
          {byCategory[cat].map(entry => (
            <ClubPoolCard key={`${entry.phase_id}-${entry.pool_name}`} entry={entry} club={club} />
          ))}
        </div>
      ))}

      {hasPinned && (
        <BoardSection label={hasClub ? 'Gepind' : undefined}>
          {showSubLabels && hasT && (
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: C.muted, padding: '0 2px 6px' }}>
              Competities
            </div>
          )}
          {pinnedTournaments.map(t => (
            <CompactPinnedCard key={t.id} tournament={t} club={club} onUnpin={() => onUnpin(t.id)} />
          ))}

          {showSubLabels && hasP && (
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: C.muted, padding: '8px 2px 6px' }}>
              Poules
            </div>
          )}
          {(() => {
            const grouped = {}
            for (const p of pinnedPools) {
              if (!grouped[p.tournamentName]) grouped[p.tournamentName] = []
              grouped[p.tournamentName].push(p)
            }
            return Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([tn, gPins]) => (
                <PinnedPoolGroupCard
                  key={tn}
                  tournamentName={tn}
                  pins={gPins.sort((a, b) => a.poolName.localeCompare(b.poolName, undefined, { numeric: true }))}
                  club={club}
                  onUnpin={onPoolUnpin}
                />
              ))
          })()}
        </BoardSection>
      )}
    </div>
  )
}

// ── Pool search result card ───────────────────────────────────────────────────

function PoolSearchCard({ result, poolPins, onPoolPin }) {
  const key = `${result.phase_id}::${result.pool_name}`
  const isPinned = poolPins?.has(key)
  return (
    <div style={{ background: C.card, borderRadius: 10,
      border: `1px solid ${isPinned ? C.gold : C.border}`,
      marginBottom: 6, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
      <div style={{ flex: 1, padding: '8px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: '0.06em' }}>
          POULE {result.pool_name}
        </div>
        <div style={{ fontSize: 11, color: C.chalk, marginTop: 2 }}>{result.tournament_name}</div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{result.matched_team}</div>
      </div>
      <button
        onClick={() => onPoolPin(result.phase_id, result.pool_name, result.tournament_name)}
        title={isPinned ? 'Verwijder van board' : 'Pin deze poule op je board'}
        style={{
          background: isPinned ? 'rgba(207,159,63,0.15)' : 'transparent',
          border: `1px solid ${isPinned ? C.gold : 'transparent'}`,
          borderRadius: 4, padding: '4px 8px', fontSize: 12,
          color: isPinned ? C.gold : C.muted, cursor: 'pointer',
          margin: '0 12px', flexShrink: 0,
        }}
      >📌</button>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [all, setAll]             = useState(null)
  const [cat, setCat]             = useState(null)
  const [subFilter, setSubFilter] = useState(null)
  const [club, setClub]           = useState(() => localStorage.getItem(CLUB_KEY) || '')
  const [clubEdit, setClubEdit]   = useState(false)
  const [clubInput, setClubInput] = useState('')
  const [clubs, setClubs]         = useState([])
  const [infoOpen, setInfoOpen]   = useState(false)
  const [error, setError]         = useState(null)
  const [boardOn, setBoardOn]     = useState(() => localStorage.getItem(BOARD_KEY) === '1')
  const [pins, setPins]           = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || '[]')) }
    catch { return new Set() }
  })
  const [poolPins, setPoolPins]   = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(POOL_PINS_KEY) || '[]')
      return new Map(raw.map(p => [`${p.phaseId}::${p.poolName}`, p]))
    } catch { return new Map() }
  })
  const [myBoards, setMyBoards]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(MY_BOARDS_KEY) || '[]') }
    catch { return [] }
  })
  const [myBoardsView, setMyBoardsView] = useState(false)
  const [searchMode, setSearchMode]     = useState(false)
  const [searchQ, setSearchQ]           = useState('')
  const searchRef = useRef(null)
  const [searchResults, setSearchResults] = useState(null)
  const searchTimerRef = useRef(null)
  const [sharedBoard, setSharedBoard]   = useState(null)  // {id, name} when loaded via ?b=
  const [saveDialog, setSaveDialog]     = useState(false)
  const [saveName, setSaveName]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [savedCode, setSavedCode]       = useState(null)
  const [copied, setCopied]             = useState(false)
  const saveNameRef = useRef(null)

  // Load shared board from URL ?b=code
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('b')
    if (!code) return
    getBoardByCode(code).then(b => {
      setClub(b.club)
      setPins(new Set(b.pins))
      setPoolPins(new Map(b.pool_pins.map(p => [`${p.phaseId}::${p.poolName}`, p])))
      setBoardOn(true)
      setSharedBoard({ id: b.id, name: b.name })
    }).catch(() => {})
  }, [])

  useEffect(() => { getClubs().then(setClubs).catch(() => {}) }, [])

  useEffect(() => {
    getTournaments()
      .then(data => {
        const filtered = data.filter(t => t.season === SEASON)
        setAll(filtered)
        const avail = CATEGORIES.filter(c => filtered.some(t => categoryOf(t.name) === c))
        if (avail.length) setCat(avail[0])
      })
      .catch(() => setError('Kon toernooien niet laden'))
  }, [])

  useEffect(() => {
    if (!searchMode || searchQ.length < 2) { setSearchResults(null); return }
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      searchPools(searchQ, SEASON).then(setSearchResults).catch(() => setSearchResults([]))
    }, 300)
    return () => clearTimeout(searchTimerRef.current)
  }, [searchQ, searchMode])

  function handleCatChange(c) { setCat(c); setSubFilter(null); setInfoOpen(false) }

  function saveClub() {
    const val = clubInput.trim()
    setClub(val)
    if (val) localStorage.setItem(CLUB_KEY, val)
    else localStorage.removeItem(CLUB_KEY)
    setClubEdit(false)
  }

  function toggleBoard() {
    const next = !boardOn
    setBoardOn(next)
    setMyBoardsView(false)
    setSearchMode(false)
    if (next) localStorage.setItem(BOARD_KEY, '1')
    else localStorage.removeItem(BOARD_KEY)
  }

  function openSearch() {
    setSearchMode(true)
    setSearchQ('')
    setBoardOn(false)
    setMyBoardsView(false)
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  function closeSearch() {
    setSearchMode(false)
    setSearchQ('')
    setSearchResults(null)
  }

  function togglePin(tid) {
    setPins(prev => {
      const next = new Set(prev)
      if (next.has(tid)) next.delete(tid)
      else next.add(tid)
      localStorage.setItem(PINS_KEY, JSON.stringify([...next]))
      return next
    })
  }

  function togglePoolPin(phaseId, poolName, tournamentName) {
    const key = `${phaseId}::${poolName}`
    setPoolPins(prev => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, { phaseId, poolName, tournamentName })
      localStorage.setItem(POOL_PINS_KEY, JSON.stringify([...next.values()]))
      return next
    })
  }

  function openMyBoard(b) {
    setClub(b.club)
    setPins(new Set(b.pins || []))
    setPoolPins(new Map((b.pool_pins || []).map(p => [`${p.phaseId}::${p.poolName}`, p])))
    setBoardOn(true)
    setSharedBoard(null)
    setMyBoardsView(false)
    if (b.club) localStorage.setItem(CLUB_KEY, b.club)
    localStorage.setItem(PINS_KEY, JSON.stringify(b.pins || []))
    localStorage.setItem(POOL_PINS_KEY, JSON.stringify(b.pool_pins || []))
    localStorage.setItem(BOARD_KEY, '1')
  }

  async function doSaveBoard() {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      const b = await saveBoard({
        name: saveName.trim(),
        club,
        pins: [...pins],
        pool_pins: [...poolPins.values()],
      })
      const entry = { code: b.id, name: b.name, club: b.club,
        pins: b.pins, pool_pins: b.pool_pins, savedAt: new Date().toISOString() }
      const next = [entry, ...myBoards.filter(x => x.code !== b.id)]
      setMyBoards(next)
      localStorage.setItem(MY_BOARDS_KEY, JSON.stringify(next))
      setSavedCode(b.id)
    } catch (e) {
      alert('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  function boardShareUrl(code) {
    return `${window.location.origin}${window.location.pathname}?b=${code}`
  }

  function copyUrl(code) {
    navigator.clipboard.writeText(boardShareUrl(code)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const totalPins    = pins.size + poolPins.size
  const available    = all ? CATEGORIES.filter(c => all.some(t => categoryOf(t.name) === c)) : []
  const catTournaments = all ? all.filter(t => categoryOf(t.name) === cat) : []
  const subOptions   = [...new Set(catTournaments.map(t => sublabelOf(t.name, cat)).filter(Boolean))]
  const visible      = searchMode
    ? (all || []).filter(t => t.name.toLowerCase().includes(searchQ.toLowerCase()))
    : subFilter
      ? catTournaments.filter(t => sublabelOf(t.name, cat) === subFilter)
      : catTournaments

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "'Inter', sans-serif", color: C.chalk }}>

      {/* Sticky header */}
      <div style={{ background: C.deep, position: 'sticky', top: 0, zIndex: 10,
        borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 12px 8px' }}>
          <button onClick={() => { setMyBoardsView(false); setBoardOn(false) }} style={{
            background: 'transparent', border: 'none', padding: '0 4px 0 0', cursor: 'pointer',
          }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.06em',
              color: C.chalk, lineHeight: 1 }}>🏒</div>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: '0.06em',
              color: C.chalk, lineHeight: 1 }}>POULEBORD</div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.05em' }}>SEIZOEN {SEASON}</div>
          </div>
          <button onClick={searchMode ? closeSearch : openSearch} style={{
            background: searchMode ? 'rgba(207,159,63,0.15)' : 'transparent',
            border: `1px solid ${searchMode ? C.gold : C.border}`,
            borderRadius: 16, padding: '4px 9px', cursor: 'pointer',
            color: searchMode ? C.gold : C.muted, fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}>🔍</button>
          {myBoards.length > 0 && (
            <button onClick={() => { setMyBoardsView(v => !v); setBoardOn(false); setSearchMode(false) }} style={{
              background: myBoardsView ? 'rgba(207,159,63,0.15)' : 'transparent',
              border: `1px solid ${myBoardsView ? C.gold : C.border}`,
              borderRadius: 16, padding: '4px 9px', cursor: 'pointer',
              color: myBoardsView ? C.gold : C.muted, fontSize: 10, whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}>⊞ {myBoards.length}</button>
          )}
          <button onClick={() => { setClubInput(club); setClubEdit(e => !e) }} style={{
            background: club ? 'rgba(207,159,63,0.15)' : 'transparent',
            border: `1px solid ${club ? C.gold : C.border}`,
            borderRadius: 16, padding: '4px 9px', cursor: 'pointer',
            color: club ? C.gold : C.muted, fontSize: 10, whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}>
            {club ? `⭐ ${club}` : '⭐ Club'}
          </button>
          <button onClick={toggleBoard} title={boardOn ? 'Terug naar browse' : 'Mijn board'} style={{
            background: boardOn ? C.gold : (totalPins > 0 ? 'rgba(207,159,63,0.1)' : 'transparent'),
            border: `1px solid ${boardOn ? C.gold : (totalPins > 0 ? C.gold : C.border)}`,
            borderRadius: 16, padding: '4px 9px', cursor: 'pointer',
            color: boardOn ? C.deep : (totalPins > 0 ? C.gold : C.muted),
            fontSize: 10, whiteSpace: 'nowrap', fontFamily: 'inherit', fontWeight: boardOn ? 700 : 400,
          }}>
            📌{!boardOn && totalPins > 0 ? ` ${totalPins}` : ''}
          </button>
        </div>

        {clubEdit && (
          <div style={{ padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'center',
            borderTop: `1px solid ${C.border}` }}>
            <input
              value={clubInput}
              onChange={e => setClubInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveClub()}
              placeholder="Clubnaam (bijv. Kampong)"
              list="pb-clubs-list"
              autoFocus
              style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
                color: C.chalk, fontSize: 12, padding: '5px 10px', fontFamily: 'inherit', outline: 'none' }}
            />
            <datalist id="pb-clubs-list">
              {clubs.map(c => <option key={c} value={c} />)}
            </datalist>
            <button onClick={saveClub} style={{
              background: C.gold, color: C.deep, border: 'none', borderRadius: 6,
              padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>OK</button>
            {club && (
              <button onClick={() => { setClub(''); localStorage.removeItem(CLUB_KEY); setClubEdit(false) }} style={{
                background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}>✕</button>
            )}
          </div>
        )}

        {searchMode && (
          <div style={{ padding: '6px 12px', borderTop: `1px solid ${C.border}` }}>
            <input
              ref={searchRef}
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && closeSearch()}
              placeholder="Zoek team, poule of competitie…"
              style={{ width: '100%', boxSizing: 'border-box', background: C.bg,
                border: `1px solid ${C.border}`, borderRadius: 8, color: C.chalk,
                fontSize: 13, padding: '7px 12px', fontFamily: 'inherit', outline: 'none' }}
            />
          </div>
        )}

        {!boardOn && !myBoardsView && !searchMode && available.length > 0 && (
          <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', padding: '0 8px' }}>
            {available.map(c => (
              <button key={c} onClick={() => handleCatChange(c)} style={{
                padding: '8px 14px', background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '0.05em',
                color: cat === c ? C.gold : C.muted,
                borderBottom: cat === c ? `2px solid ${C.gold}` : '2px solid transparent',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>{c}</button>
            ))}
          </div>
        )}
      </div>

      {/* Save dialog */}
      {saveDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16 }} onClick={() => { setSaveDialog(false); setSavedCode(null); setSaveName('') }}>
          <div style={{ background: C.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360,
            border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
            {!savedCode ? (
              <>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20,
                  letterSpacing: '0.06em', marginBottom: 16 }}>Board opslaan</div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                  {club && <span style={{ color: C.gold }}>⭐ {club} · </span>}
                  {pins.size} competitie{pins.size !== 1 ? 's' : ''} · {poolPins.size} poule{poolPins.size !== 1 ? 's' : ''}
                </div>
                <input
                  ref={saveNameRef}
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSaveBoard()}
                  placeholder="Geef dit board een naam…"
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', background: C.bg,
                    border: `1px solid ${C.border}`, borderRadius: 8, color: C.chalk,
                    fontSize: 14, padding: '10px 12px', fontFamily: 'inherit', outline: 'none',
                    marginBottom: 14 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={doSaveBoard} disabled={saving || !saveName.trim()} style={{
                    flex: 1, background: C.gold, color: C.deep, border: 'none', borderRadius: 8,
                    padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    opacity: saving || !saveName.trim() ? 0.5 : 1,
                  }}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
                  <button onClick={() => { setSaveDialog(false); setSaveName('') }} style={{
                    background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Annuleer</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20,
                  letterSpacing: '0.06em', marginBottom: 6 }}>Opgeslagen!</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
                  Deel de link met iedereen die dit board wil zien.
                </div>
                <div style={{ background: C.bg, borderRadius: 8, padding: '8px 12px', fontSize: 11,
                  color: C.muted, marginBottom: 12, wordBreak: 'break-all', border: `1px solid ${C.border}` }}>
                  {boardShareUrl(savedCode)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => copyUrl(savedCode)} style={{
                    flex: 1, background: copied ? C.gold : C.card, color: copied ? C.deep : C.chalk,
                    border: `1px solid ${copied ? C.gold : C.border}`, borderRadius: 8,
                    padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{copied ? 'Gekopieerd!' : '🔗 Kopieer link'}</button>
                  <button onClick={() => { setSaveDialog(false); setSavedCode(null); setSaveName('') }} style={{
                    background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Sluiten</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      {myBoardsView ? (
        <div style={{ padding: '16px 12px' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.06em',
            marginBottom: 14, color: C.chalk }}>MIJN BOARDS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {myBoards.map(b => (
              <div key={b.code} style={{ flex: '1 1 240px', background: C.card, borderRadius: 12,
                border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '14px 14px 10px' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.chalk, marginBottom: 6,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {b.club && (
                      <span style={{ fontSize: 10, color: C.gold, background: 'rgba(207,159,63,0.1)',
                        border: `1px solid ${C.gold}`, borderRadius: 4, padding: '1px 6px' }}>
                        ⭐ {b.club}
                      </span>
                    )}
                    {(b.pins || []).length > 0 && (
                      <span style={{ fontSize: 10, color: C.muted, background: C.deep,
                        border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px' }}>
                        📌 {b.pins.length} comp.
                      </span>
                    )}
                    {(b.pool_pins || []).length > 0 && (
                      <span style={{ fontSize: 10, color: C.muted, background: C.deep,
                        border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px' }}>
                        📌 {b.pool_pins.length} poule{b.pool_pins.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
                  <button onClick={() => openMyBoard(b)} style={{
                    flex: 1, padding: '9px', background: 'transparent', border: 'none',
                    color: C.gold, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Openen</button>
                  <button onClick={() => copyUrl(b.code)} style={{
                    padding: '9px 12px', background: 'transparent', border: 'none',
                    borderLeft: `1px solid ${C.border}`,
                    color: C.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>🔗</button>
                  <button onClick={() => {
                    const next = myBoards.filter(x => x.code !== b.code)
                    setMyBoards(next)
                    localStorage.setItem(MY_BOARDS_KEY, JSON.stringify(next))
                  }} style={{
                    padding: '9px 10px', background: 'transparent', border: 'none',
                    borderLeft: `1px solid ${C.border}`,
                    color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  }}>✕</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setMyBoardsView(false); setBoardOn(false) }} style={{
            marginTop: 16, background: 'transparent', border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '8px 16px', color: C.muted, fontSize: 12,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>+ Nieuw board (leeg beginnen)</button>
        </div>
      ) : searchMode ? (
        <div style={{ padding: '10px 10px' }}>
          {searchQ.length < 2 ? (
            <div style={{ textAlign: 'center', color: C.muted, padding: '32px 0', fontSize: 13 }}>
              Typ minimaal 2 tekens om te zoeken…
            </div>
          ) : (
            <>
              {visible.length === 0 && (searchResults === null || searchResults.length === 0) && (
                <div style={{ textAlign: 'center', color: C.muted, padding: '32px 0', fontSize: 13 }}>
                  Niets gevonden voor <strong style={{ color: C.chalk }}>{searchQ}</strong>
                </div>
              )}
              {visible.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, letterSpacing: '0.05em' }}>
                    Competities ({visible.length})
                  </div>
                  {visible.map(t => (
                    <TournamentCard
                      key={t.id} tournament={t} club={club}
                      pinned={pins.has(t.id)} onPin={() => togglePin(t.id)}
                      poolPins={poolPins}
                      onPoolPin={(phaseId, poolName) => togglePoolPin(phaseId, poolName, t.name)}
                    />
                  ))}
                </>
              )}
              {searchResults !== null && searchResults.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: C.muted,
                    margin: visible.length > 0 ? '14px 0 8px' : '0 0 8px',
                    letterSpacing: '0.05em' }}>
                    Teams &amp; poules ({searchResults.length})
                  </div>
                  {searchResults.map(r => (
                    <PoolSearchCard
                      key={`${r.phase_id}::${r.pool_name}`}
                      result={r}
                      poolPins={poolPins}
                      onPoolPin={(phaseId, poolName, tn) => togglePoolPin(phaseId, poolName, tn)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      ) : boardOn ? (
        <>
          {sharedBoard && (
            <div style={{ background: 'rgba(207,159,63,0.08)', borderBottom: `1px solid ${C.border}`,
              padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: C.gold, flex: 1 }}>
                📌 Gedeeld board: <strong>{sharedBoard.name}</strong>
              </span>
              <button onClick={() => {
                setSaveName(sharedBoard.name)
                setSaveDialog(true)
              }} style={{
                background: 'transparent', border: `1px solid ${C.gold}`, borderRadius: 6,
                padding: '3px 10px', fontSize: 10, color: C.gold, cursor: 'pointer', fontFamily: 'inherit',
              }}>Opslaan als mijn board</button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px 0' }}>
            <button onClick={() => { setSaveName(''); setSavedCode(null); setSaveDialog(true) }} style={{
              background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 16,
              padding: '4px 12px', fontSize: 10, color: C.muted, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>💾 Opslaan &amp; delen</button>
          </div>
          <BoardView
            club={club} pins={pins} poolPins={poolPins}
            allTournaments={all}
            onUnpin={togglePin}
            onPoolUnpin={(phaseId, poolName) => togglePoolPin(phaseId, poolName)}
          />
        </>
      ) : (
        <div style={{ padding: '12px 10px' }}>
          {error && (
            <div style={{ background: '#3a1010', border: '1px solid #7a2020', borderRadius: 10,
              padding: '12px 16px', color: '#f88', fontSize: 13, margin: '8px 0' }}>
              {error}
            </div>
          )}
          {all === null && !error && (
            <div style={{ textAlign: 'center', color: C.muted, padding: 40, fontSize: 14 }}>Laden…</div>
          )}
          {all !== null && available.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🏒</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
                letterSpacing: '0.06em', marginBottom: 10 }}>NOG GEEN TOERNOOIEN</div>
              <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
                Maak toernooien aan in Tournix<br />
                met seizoen <span style={{ color: C.gold, fontWeight: 600 }}>{SEASON}</span>
              </div>
            </div>
          )}
          {cat && all !== null && (
            <>
              {subOptions.length > 1 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => setSubFilter(null)} style={{
                    padding: '4px 12px', borderRadius: 16, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                    background: !subFilter ? C.gold : 'transparent',
                    color: !subFilter ? C.deep : C.muted,
                    border: `1px solid ${!subFilter ? C.gold : C.border}`,
                    fontWeight: !subFilter ? 700 : 400,
                  }}>Alles</button>
                  {subOptions.map(opt => (
                    <button key={opt} onClick={() => setSubFilter(subFilter === opt ? null : opt)} style={{
                      padding: '4px 12px', borderRadius: 16, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                      background: subFilter === opt ? C.gold : 'transparent',
                      color: subFilter === opt ? C.deep : C.muted,
                      border: `1px solid ${subFilter === opt ? C.gold : C.border}`,
                      fontWeight: subFilter === opt ? 700 : 400,
                    }}>{opt}</button>
                  ))}
                </div>
              )}
              <SeizoenInfo cat={cat} open={infoOpen} onToggle={() => setInfoOpen(o => !o)} />
              {visible.map(t => (
                <TournamentCard
                  key={t.id} tournament={t} club={club}
                  pinned={pins.has(t.id)} onPin={() => togglePin(t.id)}
                  poolPins={poolPins}
                  onPoolPin={(phaseId, poolName) => togglePoolPin(phaseId, poolName, t.name)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
