import { useState, useEffect } from 'react'
import { getTournaments, getPhases, getPhaseStandings, getClubs, getBoard } from './api.js'

const SEASON = '2026-2027'
const CATEGORIES = ['MO14', 'JO14', 'MO16', 'JO16', 'MO18', 'JO18']
const CLUB_KEY  = 'pb_club'
const BOARD_KEY = 'pb_board_on'
const PINS_KEY  = 'pb_pins'

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
    { nr: 3, label: 'NK', periode: 'Voorjaar',
      niveaus: ['LC play-offs', 'Super O16 finaledag'] },
  ],
  JO16: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 5 wedstrijden',
      niveaus: ['Topklasse — 8 poules × 6', 'Subtopklasse — 8 poules × 6', '1e Klasse — per district'] },
    { nr: 2, label: 'Reguliere competitie', periode: 'Na herfstvakantie',
      niveaus: ['Landelijke Competitie — 4 poules × 6', 'Super O16 — 4 poules × 6', 'Subtopklasse', '1e Klasse — per district'] },
    { nr: 3, label: 'NK', periode: 'Voorjaar',
      niveaus: ['LC play-offs', 'Super O16 finaledag'] },
  ],
  MO14: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 5 wedstrijden',
      niveaus: ['10 poules × 6 (60 teams)'] },
    { nr: 2, label: 'Herindeling', periode: 'Na herfstvakantie',
      niveaus: ['Super O14 — 5 poules × 6 (nr. 1-3)', 'IDC O14 — nr. 4+5', 'Subtopklasse — nr. 6'] },
    { nr: 3, label: 'NK O14', periode: 'Voorjaar',
      niveaus: ['Super O14: nr. 1+2 per poule → finaledag'] },
  ],
  JO14: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 5 wedstrijden',
      niveaus: ['8 poules × 6 (48 teams)'] },
    { nr: 2, label: 'Hermindeling', periode: 'Na herfstvakantie',
      niveaus: ['4 poules × 6 (nr. 1-3 per poule)'] },
    { nr: 3, label: 'NK O14', periode: 'Voorjaar',
      niveaus: ['Play-offs vanuit hermindeling'] },
  ],
}

function categoryOf(name = '') {
  const u = name.toUpperCase()
  return CATEGORIES.find(c => u.includes(c)) ?? null
}

function sublabelOf(name = '', cat = '') {
  return name.replace(new RegExp(cat, 'i'), '').trim()
}

// ── Empty board state ──────────────────────────────────────────────────────────

function EmptyBoard() {
  return (
    <div style={{ textAlign: 'center', padding: '52px 24px' }}>
      <div style={{ fontSize: 36, marginBottom: 14 }}>📌</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
        letterSpacing: '0.06em', marginBottom: 10, color: C.chalk }}>JE BOARD IS LEEG</div>
      <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
        Stel je club in via ⭐ om automatisch<br />alle NK-poules van jouw club te zien.<br /><br />
        Of pin toernooien tijdens het bladeren.
      </div>
    </div>
  )
}

// ── Season info panel ──────────────────────────────────────────────────────────

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
        <span>ℹ</span>
        <span>Seizoensstructuur {cat}</span>
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
                  fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {fase.nr}
                </div>
                <div>
                  <div style={{ color: C.chalk, fontWeight: 700, fontSize: 11 }}>{fase.label}</div>
                  <div style={{ color: C.muted, fontSize: 9 }}>{fase.periode}</div>
                </div>
              </div>
              {fase.niveaus.map((n, i) => (
                <div key={i} style={{ fontSize: 10, color: C.muted, paddingLeft: 10, paddingBottom: 2,
                  borderLeft: `2px solid ${C.border}`, marginLeft: 8 }}>
                  {n}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Standings table ────────────────────────────────────────────────────────────

function StandingsTable({ rows, club }) {
  const byPool = {}
  for (const r of rows) {
    const key = r.pool_name ?? '—'
    if (!byPool[key]) byPool[key] = []
    byPool[key].push(r)
  }

  const isMyClub = name => club && name.toLowerCase().startsWith(club.toLowerCase())

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {Object.entries(byPool)
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([pname, prows]) => (
          <div key={pname} style={{ flex: '1 1 240px', background: C.deep, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em', color: C.gold, borderBottom: `1px solid ${C.border}` }}>
              POULE {pname}
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
        ))}
    </div>
  )
}

// ── Compact club card (board mode) ─────────────────────────────────────────────

function CompactClubCard({ entry, club }) {
  const [standings, setStandings] = useState(null)
  useEffect(() => {
    getPhaseStandings(entry.phase_id).then(setStandings).catch(() => setStandings([]))
  }, [entry.phase_id])

  const poolRows = standings ? standings.filter(r => r.pool_name === entry.pool_name) : null
  const rankIdx  = poolRows ? poolRows.findIndex(r => r.name.toLowerCase().startsWith(club.toLowerCase())) : -1
  const rank  = rankIdx >= 0 ? rankIdx + 1 : null
  const total = poolRows?.length ?? null

  return (
    <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`,
      padding: '9px 12px', marginBottom: 6,
      display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.chalk,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.team_name}
        </div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
          {entry.tournament_name} · Poule {entry.pool_name}
        </div>
      </div>
      {standings === null ? (
        <div style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>…</div>
      ) : (
        <div style={{ background: C.deep, borderRadius: 6, padding: '4px 10px',
          textAlign: 'center', flexShrink: 0, minWidth: 36 }}>
          <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1,
            color: rank ? C.goldBr : C.muted }}>{rank ?? '—'}</div>
          {total && <div style={{ fontSize: 8, color: C.muted }}>v {total}</div>}
        </div>
      )}
    </div>
  )
}

// ── Phase card ────────────────────────────────────────────────────────────────

function PhaseCard({ phase, club }) {
  const [standings, setStandings] = useState(null)

  useEffect(() => {
    if (phase.phase_type !== 'pool') return
    getPhaseStandings(phase.id).then(setStandings).catch(() => setStandings([]))
  }, [phase.id])

  if (phase.phase_type !== 'pool') return null

  return (
    <div style={{ marginBottom: 4 }}>
      {phase.name && (
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '8px 0 6px', fontWeight: 600 }}>
          {phase.name}
        </div>
      )}
      {standings === null
        ? <div style={{ color: C.muted, fontSize: 13, padding: '10px 0', textAlign: 'center' }}>Laden…</div>
        : standings.length === 0
          ? <div style={{ color: C.muted, fontSize: 13, padding: '10px 0', textAlign: 'center', fontStyle: 'italic' }}>
              Nog geen wedstrijden gespeeld
            </div>
          : <StandingsTable rows={standings} club={club} />
      }
    </div>
  )
}

// ── Compact pinned card (board mode) ──────────────────────────────────────────

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
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          flex: 1, padding: '12px 16px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          color: C.chalk, fontWeight: 700, fontSize: 15,
          fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ flex: 1 }}>{tournament.name}</span>
          <span style={{ color: C.muted, fontSize: 10, fontFamily: 'inherit' }}>{open ? '▲' : '▼'}</span>
        </button>
        <button onClick={onUnpin} style={{
          background: 'transparent', border: 'none',
          borderLeft: `1px solid ${C.border}`,
          padding: '0 14px', height: '100%', minHeight: 44,
          fontSize: 12, color: C.muted, cursor: 'pointer',
        }}>✕</button>
      </div>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          {phases === null
            ? <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 8 }}>Laden…</div>
            : poolPhases.length === 0
              ? <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 8, fontStyle: 'italic' }}>Geen poulefases</div>
              : poolPhases.map(p => <PhaseCard key={p.id} phase={p} club={club} />)
          }
        </div>
      )}
    </div>
  )
}

// ── Tournament card (browse mode) ─────────────────────────────────────────────

function TournamentCard({ tournament, club, pinned, onPin }) {
  const [phases, setPhases] = useState(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    getPhases(tournament.id)
      .then(data => setPhases(data))
      .catch(() => setPhases([]))
  }, [tournament.id])

  const poolPhases = phases?.filter(p =>
    p.phase_type === 'pool' &&
    (p.is_main_phase || p.pools?.some(pool => pool.team_count > 0))
  ) ?? []

  return (
    <div style={{ background: C.card, borderRadius: 12, overflow: 'hidden', marginBottom: 10,
      border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
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
        <button onClick={onPin} title={pinned ? 'Verwijder uit board' : 'Voeg toe aan board'} style={{
          background: pinned ? 'rgba(207,159,63,0.12)' : 'transparent',
          border: 'none',
          borderLeft: `1px solid ${C.border}`,
          padding: '0 14px',
          fontSize: 14, color: pinned ? C.gold : C.muted,
          cursor: 'pointer', flexShrink: 0,
          transition: 'color 0.15s',
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
              : poolPhases.map(p => <PhaseCard key={p.id} phase={p} club={club} />)
          }
        </div>
      )}
    </div>
  )
}

// ── Board view ────────────────────────────────────────────────────────────────

function BoardView({ club, pins, allTournaments, onUnpin }) {
  const [boardData, setBoardData] = useState(null)

  useEffect(() => {
    if (!club) { setBoardData([]); return }
    getBoard(club, 'productie')
      .then(setBoardData)
      .catch(() => setBoardData([]))
  }, [club])

  const clubTournamentIds = new Set((boardData || []).map(e => e.tournament_id))
  const pinnedExtras = [...pins]
    .map(id => allTournaments?.find(t => t.id === id))
    .filter(t => t && !clubTournamentIds.has(t.id))

  if (!club && pins.size === 0) return <EmptyBoard />

  const byCategory = {}
  for (const entry of (boardData || [])) {
    const cat = entry.category || '—'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(entry)
  }

  const hasClubData = club && boardData !== null && boardData.length > 0

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
            <CompactClubCard key={`${entry.phase_id}-${entry.pool_name}`} entry={entry} club={club} />
          ))}
        </div>
      ))}

      {pinnedExtras.length > 0 && (
        <div style={{ marginTop: hasClubData ? 14 : 0 }}>
          {hasClubData && (
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: C.muted,
              padding: '4px 2px 10px', borderTop: `1px solid ${C.border}` }}>
              Gepind
            </div>
          )}
          {pinnedExtras.map(t => (
            <CompactPinnedCard key={t.id} tournament={t} club={club} onUnpin={() => onUnpin(t.id)} />
          ))}
        </div>
      )}

      {!club && pins.size > 0 && pinnedExtras.length === 0 && (
        <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
          Gepinde toernooien nog niet geladen…
        </div>
      )}
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

  function handleCatChange(c) {
    setCat(c)
    setSubFilter(null)
    setInfoOpen(false)
  }

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
    if (next) localStorage.setItem(BOARD_KEY, '1')
    else localStorage.removeItem(BOARD_KEY)
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

  const available      = all ? CATEGORIES.filter(c => all.some(t => categoryOf(t.name) === c)) : []
  const catTournaments = all ? all.filter(t => categoryOf(t.name) === cat) : []
  const subOptions     = [...new Set(catTournaments.map(t => sublabelOf(t.name, cat)).filter(Boolean))]
  const visible        = subFilter
    ? catTournaments.filter(t => t.name.toLowerCase().includes(subFilter.toLowerCase()))
    : catTournaments

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "'Inter', sans-serif", color: C.chalk }}>

      {/* Sticky header */}
      <div style={{ background: C.deep, position: 'sticky', top: 0, zIndex: 10,
        borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 8px' }}>
          <span style={{ fontSize: 20 }}>🏒</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.06em',
              color: C.chalk, lineHeight: 1 }}>POULEBORD</div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em' }}>SEIZOEN {SEASON}</div>
          </div>
          <button onClick={() => { setClubInput(club); setClubEdit(e => !e) }} style={{
            background: club ? 'rgba(207,159,63,0.15)' : 'transparent',
            border: `1px solid ${club ? C.gold : C.border}`,
            borderRadius: 16, padding: '4px 10px', cursor: 'pointer',
            color: club ? C.gold : C.muted, fontSize: 10, whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}>
            {club ? `⭐ ${club}` : '⭐ Mijn club'}
          </button>
          <button onClick={toggleBoard} title={boardOn ? 'Terug naar browse' : 'Mijn board'} style={{
            background: boardOn ? C.gold : (pins.size > 0 ? 'rgba(207,159,63,0.1)' : 'transparent'),
            border: `1px solid ${boardOn ? C.gold : (pins.size > 0 ? C.gold : C.border)}`,
            borderRadius: 16, padding: '4px 10px', cursor: 'pointer',
            color: boardOn ? C.deep : (pins.size > 0 ? C.gold : C.muted),
            fontSize: 10, whiteSpace: 'nowrap', fontFamily: 'inherit', fontWeight: boardOn ? 700 : 400,
          }}>
            📌{!boardOn && pins.size > 0 ? ` ${pins.size}` : ''}
          </button>
        </div>

        {clubEdit && (
          <div style={{ padding: '8px 16px', display: 'flex', gap: 6, alignItems: 'center',
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

        {!boardOn && available.length > 0 && (
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

      {/* Body */}
      {boardOn ? (
        <BoardView club={club} pins={pins} allTournaments={all} onUnpin={togglePin} />
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
                  key={t.id}
                  tournament={t}
                  club={club}
                  pinned={pins.has(t.id)}
                  onPin={() => togglePin(t.id)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
