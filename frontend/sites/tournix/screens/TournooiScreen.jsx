import { useState, useEffect } from 'react'
import { getPhases, getStandings } from '../api.js'
import { VangerButton } from '../components/VangerButton.jsx'
import OverzichtPage  from '../pages/OverzichtPage.jsx'
import ProgrammaPage  from '../pages/ProgrammaPage.jsx'
import UitslagenPage  from '../pages/UitslagenPage.jsx'
import BeheerPage     from '../pages/BeheerPage.jsx'

const DETAIL_TABS = [
  { id: 'stand',     label: 'Stand'     },
  { id: 'programma', label: 'Programma' },
  { id: 'uitslagen', label: 'Uitslagen' },
  { id: 'beheer',    label: 'Beheer'    },
]

export function TournooiScreen({ tournament, onBack, isAdmin }) {
  const [tab,          setTab]          = useState('stand')
  const [phases,       setPhases]       = useState([])
  const [selectedFase, setSelectedFase] = useState(null) // null = "Alle"

  useEffect(() => {
    if (!tournament?.id) return
    getPhases(tournament.id).then(list => {
      setPhases(list)
      // Pre-select first phase with a phase_label, else null
      const first = list.find(p => p.phase_label)
      setSelectedFase(first?.id ?? null)
    }).catch(() => {})
  }, [tournament?.id])

  if (!tournament) return null

  const stage = tournament.stage
  const stageBadge = stage === 'test' ? '🟡 Test'
    : stage === 'productie' ? '🟢 Live'
    : null

  return (
    <div className="tournooi-screen">
      {/* ── FaseSelector ────────────────────────────────────────────── */}
      {phases.length > 0 && (
        <div className="fase-selector">
          {phases.length > 1 && (
            <button
              className={`fase-pill${selectedFase === null ? ' active' : ''}`}
              onClick={() => setSelectedFase(null)}
            >
              Alle
            </button>
          )}
          {phases.map(p => (
            <button
              key={p.id}
              className={`fase-pill${selectedFase === p.id ? ' active' : ''}`}
              onClick={() => setSelectedFase(p.id)}
            >
              {p.phase_label ?? p.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Seizoenstotaal: compact stats wanneer "Alle" geselecteerd ─ */}
      {selectedFase === null && phases.length > 1 && (
        <SeizoenTotaal tournament={tournament} phases={phases} />
      )}

      {/* ── Sub-tabs ────────────────────────────────────────────────── */}
      <div className="sub-tabs">
        {DETAIL_TABS.map(t => (
          <button
            key={t.id}
            className={`sub-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="tournooi-content">
        {tab === 'stand'     && <OverzichtPage  tournament={tournament} phaseId={selectedFase} isAdmin={isAdmin} onTab={setTab} />}
        {tab === 'programma' && <ProgrammaPage  tournament={tournament} phaseId={selectedFase} stage={stage}    />}
        {tab === 'uitslagen' && <UitslagenPage   tournament={tournament} phaseId={selectedFase}                  />}
        {tab === 'beheer'    && <BeheerPage      tournament={tournament} isAdmin={isAdmin} onStageChange={() => {}} />}
      </div>
    </div>
  )
}

// ── Seizoenstotaal ─────────────────────────────────────────────────────────

function SeizoenTotaal({ tournament, phases }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!tournament?.id) return
    getStandings(tournament.id).then(data => {
      let w = 0, g = 0, v = 0, gf = 0, ga = 0
      const rows = Array.isArray(data) ? data : (data.rows ?? [])
      rows.forEach(r => { w += r.won ?? 0; g += r.drawn ?? 0; v += r.lost ?? 0; gf += r.gf ?? 0; ga += r.ga ?? 0 })
      setStats({ w, g, v, gf, ga })
    }).catch(() => {})
  }, [tournament?.id, phases])

  if (!stats) return null

  return (
    <div style={{
      display: 'flex', gap: 16, padding: '8px 16px 6px',
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      fontSize: 13,
    }}>
      <StatChip label="W"  value={stats.w}  color="var(--color-success, #22c55e)" />
      <StatChip label="G"  value={stats.g}  color="var(--color-warning, #f59e0b)" />
      <StatChip label="V"  value={stats.v}  color="var(--color-danger,  #ef4444)" />
      <StatChip label="Dc" value={`${stats.gf}-${stats.ga}`} />
    </div>
  )
}

function StatChip({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: color ?? 'var(--color-text-muted)', fontWeight: 600 }}>{value}</span>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
    </div>
  )
}
