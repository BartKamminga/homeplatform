import { useState, useEffect } from 'react'
import { getPhases, getStandings, getPhaseStandings } from '../api.js'
import { VangerButton } from '../components/VangerButton.jsx'
import OverzichtPage  from '../pages/OverzichtPage.jsx'
import ProgrammaPage  from '../pages/ProgrammaPage.jsx'
import UitslagenPage  from '../pages/UitslagenPage.jsx'
import BeheerPage     from '../pages/BeheerPage.jsx'

function phaseTypeColor(p) {
  if (p.period === 'nk')    return { color: '#b45309', bg: '#fef3c7' }
  if (p.surface === 'zaal') return { color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' }
  return { color: '#2e7d32', bg: '#dcfce7' }
}

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
          {phases.map(p => {
            const { color, bg } = phaseTypeColor(p)
            const isActive = selectedFase === p.id
            return (
              <button
                key={p.id}
                className={`fase-pill${isActive ? ' active' : ''}`}
                onClick={() => setSelectedFase(p.id)}
                style={isActive ? { borderColor: color, color, background: bg, display: 'inline-flex', alignItems: 'center', gap: 5 } : {}}
              >
                {isActive && <span className="fase-pill-dot" style={{ background: color }} />}
                {p.phase_label ?? p.name}
              </button>
            )
          })}
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
  const [stats,      setStats]      = useState(null)
  const [phaseStats, setPhaseStats] = useState([])

  useEffect(() => {
    if (!tournament?.id) return
    getStandings(tournament.id).then(data => {
      let w = 0, g = 0, v = 0, gf = 0, ga = 0
      const rows = Array.isArray(data) ? data : (data.rows ?? [])
      rows.forEach(r => { w += r.won ?? 0; g += r.drawn ?? 0; v += r.lost ?? 0; gf += r.gf ?? 0; ga += r.ga ?? 0 })
      setStats({ w, g, v, gf, ga })
    }).catch(() => {})

    const labeled = phases.filter(p => p.phase_label)
    if (labeled.length < 2) { setPhaseStats([]); return }
    Promise.all(labeled.map(p =>
      getPhaseStandings(p.id).then(data => {
        const rows = Array.isArray(data) ? data : (data.rows ?? [])
        let w = 0, g = 0, v = 0
        rows.forEach(r => { w += r.won ?? 0; g += r.drawn ?? 0; v += r.lost ?? 0 })
        return { phase: p, w, g, v }
      }).catch(() => null)
    )).then(res => setPhaseStats(res.filter(Boolean).filter(r => r.w + r.g + r.v > 0)))
  }, [tournament?.id, phases])

  if (!stats) return null

  const total = stats.w + stats.g + stats.v
  const wPct = total > 0 ? (stats.w / total) * 100 : 0
  const gPct = total > 0 ? (stats.g / total) * 100 : 0
  const vPct = total > 0 ? (stats.v / total) * 100 : 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '8px 16px 6px',
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <StatChip label="W"  value={stats.w}  color="#22c55e" />
        <StatChip label="G"  value={stats.g}  color="#f59e0b" />
        <StatChip label="V"  value={stats.v}  color="#ef4444" />
        <StatChip label="Dc" value={`${stats.gf}-${stats.ga}`} />
      </div>
      {total > 0 && (
        <div style={{ height: 5, display: 'flex', borderRadius: 3, overflow: 'hidden', gap: 1 }}>
          {wPct > 0 && <div style={{ width: wPct + '%', background: '#22c55e', borderRadius: 3, transition: 'width 0.4s' }} />}
          {gPct > 0 && <div style={{ width: gPct + '%', background: '#f59e0b', borderRadius: 3, transition: 'width 0.4s' }} />}
          {vPct > 0 && <div style={{ width: vPct + '%', background: '#ef4444', borderRadius: 3, transition: 'width 0.4s' }} />}
        </div>
      )}
      {phaseStats.length > 0 && (
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {phaseStats.map(({ phase, w, g, v }) => {
            const { color } = phaseTypeColor(phase)
            const parts = []
            if (w > 0) parts.push(`W${w}`)
            if (g > 0) parts.push(`G${g}`)
            if (v > 0) parts.push(`V${v}`)
            return (
              <div key={phase.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ color }}>{phase.phase_label}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{parts.join(' ')}</span>
              </div>
            )
          })}
        </div>
      )}
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
