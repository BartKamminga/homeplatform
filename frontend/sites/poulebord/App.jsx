import { useState, useEffect } from 'react'
import { getTournaments, getPhases, getPhaseStandings } from './api.js'

const SEASON = '2026-2027'
const CATEGORIES = ['MO14', 'JO14', 'MO16', 'JO16', 'MO18', 'JO18']

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

function categoryOf(name = '') {
  const u = name.toUpperCase()
  return CATEGORIES.find(c => u.includes(c)) ?? null
}

function StandingsTable({ rows }) {
  const byPool = {}
  for (const r of rows) {
    const key = r.pool_name ?? '—'
    if (!byPool[key]) byPool[key] = []
    byPool[key].push(r)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Object.entries(byPool).map(([pname, prows]) => (
        <div key={pname} style={{ background: C.deep, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '7px 12px', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', color: C.gold, borderBottom: `1px solid ${C.border}` }}>
            POULE {pname}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.muted, fontSize: 11 }}>
                <th style={{ padding: '5px 4px 5px 12px', textAlign: 'left', fontWeight: 500, width: 22 }}>#</th>
                <th style={{ padding: '5px 4px', textAlign: 'left', fontWeight: 500 }}>Team</th>
                <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 500, width: 28 }}>W</th>
                <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 500, width: 28 }}>G</th>
                <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 500, width: 28 }}>V</th>
                <th style={{ padding: '5px 12px 5px 4px', textAlign: 'center', fontWeight: 600, width: 36, color: C.chalk }}>Pt</th>
              </tr>
            </thead>
            <tbody>
              {prows.map((r, i) => (
                <tr key={r.id} style={{
                  borderTop: `1px solid ${C.border}`,
                  background: i === 0 ? 'rgba(207,159,63,0.07)' : 'transparent',
                }}>
                  <td style={{ padding: '9px 4px 9px 12px', color: C.muted, fontSize: 12 }}>{i + 1}</td>
                  <td style={{ padding: '9px 4px', color: C.chalk, fontWeight: i === 0 ? 600 : 400,
                    maxWidth: 0, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'center', color: C.muted }}>{r.w}</td>
                  <td style={{ padding: '9px 8px', textAlign: 'center', color: C.muted }}>{r.d}</td>
                  <td style={{ padding: '9px 8px', textAlign: 'center', color: C.muted }}>{r.l}</td>
                  <td style={{ padding: '9px 12px 9px 4px', textAlign: 'center',
                    color: C.goldBr, fontWeight: 700, fontSize: 14 }}>{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function PhaseCard({ phase }) {
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
          : <StandingsTable rows={standings} />
      }
    </div>
  )
}

function TournamentCard({ tournament }) {
  const [phases, setPhases] = useState(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    getPhases(tournament.id)
      .then(data => setPhases(data))
      .catch(() => setPhases([]))
  }, [tournament.id])

  const poolPhases = phases?.filter(p =>
    p.phase_type === 'pool' && (p.is_main_phase || p.match_count > 0)
  ) ?? []

  return (
    <div style={{ background: C.card, borderRadius: 12, overflow: 'hidden', marginBottom: 10,
      border: `1px solid ${C.border}` }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '13px 16px', background: 'transparent', border: 'none',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
      }}>
        <span style={{ flex: 1, color: C.chalk, fontWeight: 700, fontSize: 16,
          fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
          {tournament.name}
        </span>
        <span style={{ color: C.muted, fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          {phases === null
            ? <div style={{ color: C.muted, fontSize: 13, padding: '10px 0', textAlign: 'center' }}>Laden…</div>
            : poolPhases.length === 0
              ? <div style={{ color: C.muted, fontSize: 13, padding: '10px 0', textAlign: 'center', fontStyle: 'italic' }}>
                  Geen poulefases gevonden
                </div>
              : poolPhases.map(p => <PhaseCard key={p.id} phase={p} />)
          }
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [all, setAll] = useState(null)
  const [cat, setCat] = useState(null)
  const [error, setError] = useState(null)

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

  const available = all ? CATEGORIES.filter(c => all.some(t => categoryOf(t.name) === c)) : []
  const visible   = all ? all.filter(t => categoryOf(t.name) === cat) : []

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "'Inter', sans-serif", color: C.chalk }}>

      {/* Sticky header */}
      <div style={{ background: C.deep, position: 'sticky', top: 0, zIndex: 10,
        borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 8px' }}>
          <span style={{ fontSize: 20 }}>🏒</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.06em',
              color: C.chalk, lineHeight: 1 }}>POULEBORD</div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.05em' }}>SEIZOEN {SEASON}</div>
          </div>
        </div>

        {available.length > 0 && (
          <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', padding: '0 8px' }}>
            {available.map(c => (
              <button key={c} onClick={() => setCat(c)} style={{
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

        {visible.map(t => (
          <TournamentCard key={t.id} tournament={t} />
        ))}
      </div>
    </div>
  )
}
