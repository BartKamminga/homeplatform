import { useState, useEffect } from 'react'
import { getTournaments, getPhases } from '../api.js'
import { VangerButton } from '../components/VangerButton.jsx'
import BeheerDiscoveryTab        from '../beheer/DiscoveryTab.jsx'
import CaptureArchiefTab         from '../beheer/ArchiefTab.jsx'
import CreateTournamentPopup     from '../beheer/CreateTournamentPopup.jsx'

const SEIZOEN_TABS = [
  { id: 'publicaties', label: 'Publicaties' },
  { id: 'archief',     label: 'Archief'     },
  { id: 'vanger',      label: 'Vanger'      },
  { id: 'discovery',   label: 'Discovery'   },
]

// ── Phase type color helper ───────────────────────────────────────────────

function phaseTypeColor(p) {
  if (p.period === 'nk')    return { color: '#b45309', bg: '#fef3c7' }
  if (p.surface === 'zaal') return { color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' }
  return { color: '#2e7d32', bg: '#dcfce7' }
}

// ── Tournament card ───────────────────────────────────────────────────────

function TournamentCard({ tournament, onOpen }) {
  const [phases, setPhases] = useState([])

  useEffect(() => {
    getPhases(tournament.id).then(setPhases).catch(() => {})
  }, [tournament.id])

  const labelPhases   = phases.filter(p => p.phase_label)
  const totalMatches  = labelPhases.reduce((s, p) => s + (p.match_count ?? 0), 0)
  const doneMatches   = labelPhases.reduce((s, p) => s + (p.matches_finished ?? 0), 0)
  const overallPct    = totalMatches > 0 ? Math.round(doneMatches / totalMatches * 100) : null

  return (
    <div className="t-card" onClick={() => onOpen(tournament)}>
      <div className="t-card-body">
        <div className="t-card-name">{tournament.name}</div>
        {tournament.season && (
          <div className="t-card-meta">{tournament.season}</div>
        )}
        {labelPhases.length > 0 && (
          <div className="t-card-phases">
            {labelPhases.map(p => {
              const { color, bg } = phaseTypeColor(p)
              return (
                <span key={p.id} className="t-phase-pill" style={{ color, background: bg }}>
                  {p.phase_label}
                </span>
              )
            })}
          </div>
        )}
        {overallPct !== null && (
          <div className="t-card-meta" style={{ marginTop: 4 }}>
            {doneMatches} / {totalMatches} gespeeld
          </div>
        )}
      </div>
      <VangerButton tournamentId={tournament.id} />
      {overallPct !== null && (
        <div className="t-card-progress">
          <div className="t-card-progress-bar" style={{ width: overallPct + '%' }} />
        </div>
      )}
    </div>
  )
}

// ── Publicaties tab ───────────────────────────────────────────────────────

function PublicatiesTab({ tournaments, onOpen }) {
  if (tournaments.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🏆</div>
        Geen actieve toernooien
      </div>
    )
  }
  return (
    <div>
      {tournaments.map(t => (
        <TournamentCard key={t.id} tournament={t} onOpen={onOpen} />
      ))}
    </div>
  )
}

// ── Archief tab ───────────────────────────────────────────────────────────

function ArchiefTab({ tournaments, onOpen }) {
  if (tournaments.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📦</div>
        Geen gearchiveerde toernooien
      </div>
    )
  }
  return (
    <div>
      {tournaments.map(t => (
        <TournamentCard key={t.id} tournament={t} onOpen={onOpen} />
      ))}
    </div>
  )
}

// ── SeizoenScreen ─────────────────────────────────────────────────────────

export function SeizoenScreen({ onOpenTournament, isAdmin }) {
  const [tab,         setTab]         = useState('publicaties')
  const [tournaments, setTournaments] = useState([])
  const [search,      setSearch]      = useState('')
  const [showCreate,  setShowCreate]  = useState(false)

  useEffect(() => {
    getTournaments().then(setTournaments).catch(() => {})
  }, [])

  const q       = search.trim().toLowerCase()
  const filtered = q ? tournaments.filter(t => t.name.toLowerCase().includes(q)) : tournaments

  const active   = filtered.filter(t => t.status === 'active')
  const finished = filtered.filter(t => t.status === 'finished')

  function handleCreated() {
    setShowCreate(false)
    getTournaments().then(setTournaments).catch(() => {})
  }

  return (
    <div className="seizoen-screen">
      {showCreate && <CreateTournamentPopup onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      <div className="sub-tabs">
        {SEIZOEN_TABS.map(t => (
          <button
            key={t.id}
            className={`sub-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="seizoen-content">
        {tab === 'publicaties' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="search"
                placeholder="Zoek toernooi…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1, padding: '8px 12px',
                  border: '1px solid var(--color-border)', borderRadius: 9,
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  fontSize: 13, fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button onClick={() => setShowCreate(true)} style={{
                padding: '8px 14px', borderRadius: 9, border: 'none',
                background: 'var(--color-primary)', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>+ Nieuw</button>
            </div>
            <PublicatiesTab tournaments={active} onOpen={onOpenTournament} />
          </>
        )}
        {tab === 'archief' && (
          <>
            <ArchiefTab tournaments={finished} onOpen={onOpenTournament} />
            <div className="section-header" style={{ marginTop: 16 }}>
              <span className="section-title">Capture-sessies</span>
            </div>
            <CaptureArchiefTab />
          </>
        )}
        {tab === 'vanger' && (
          <BeheerDiscoveryTab view="vanger" />
        )}
        {tab === 'discovery' && (
          <BeheerDiscoveryTab view="resultaten" />
        )}
      </div>
    </div>
  )
}
