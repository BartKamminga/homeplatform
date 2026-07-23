import { useState, useEffect } from 'react'
import { api } from '@core/api.js'
import { getTournaments, getPhases } from '../api.js'
import { VangerButton } from '../components/VangerButton.jsx'
import { ClubFilterBar } from '../components/ClubFilterBar.jsx'

const SEIZOEN_TABS = [
  { id: 'publicaties', label: 'Publicaties' },
  { id: 'vanger',      label: 'Vanger'      },
  { id: 'discovery',   label: 'Discovery'   },
  { id: 'archief',     label: 'Archief'     },
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

// ── Vanger tab ────────────────────────────────────────────────────────────

const STATUS_LABEL = {
  pending:     'Wacht',
  in_progress: 'Bezig',
  done:        'Klaar',
  failed:      'Fout',
  skipped:     'Overgeslagen',
}

function VangerTab({ items, onRefresh }) {
  const pending     = items.filter(i => i.status === 'pending').length
  const in_progress = items.filter(i => i.status === 'in_progress').length

  return (
    <div>
      {(pending > 0 || in_progress > 0) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {in_progress > 0 && (
            <span style={{ fontSize: 13, color: '#3b82f6' }}>
              {in_progress} bezig
            </span>
          )}
          {pending > 0 && (
            <span style={{ fontSize: 13, color: '#f59e0b' }}>
              {pending} in de wacht
            </span>
          )}
          <button
            onClick={onRefresh}
            style={{
              marginLeft: 'auto', fontSize: 12, padding: '2px 8px',
              border: '1px solid var(--color-border)', borderRadius: 6,
              background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Vernieuwen
          </button>
        </div>
      )}
      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📡</div>
          Geen opdrachten in de queue
        </div>
      ) : (
        <div className="vq-list">
          {items.slice(0, 60).map(item => {
            // params is already a parsed object from the API
            const params = typeof item.params === 'object' ? item.params : {}
            return (
              <div key={item.id} className="vq-item">
                <span className={`vq-dot ${item.status}`} />
                <span className="vq-label">{params.label ?? item.cmd_type}</span>
                <span className="vq-status">{STATUS_LABEL[item.status] ?? item.status}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Discovery tab ─────────────────────────────────────────────────────────

function DiscoveryTab({ competitions, clubs = [], teams = [] }) {
  const unlinked = competitions.filter(c => !c.linked)
  const linked   = competitions.filter(c => c.linked)

  const teamsByClub = {}
  for (const t of teams) {
    if (!teamsByClub[t.club_external_id]) teamsByClub[t.club_external_id] = []
    teamsByClub[t.club_external_id].push(t)
  }

  return (
    <div>
      {competitions.length === 0 && clubs.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          Geen data — start de vanger op hockey.nl
        </div>
      )}

      {linked.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">Gekoppeld ({linked.length})</span>
          </div>
          <div className="comp-list">
            {linked.map(c => (
              <CompItem key={c.id} comp={c} />
            ))}
          </div>
        </>
      )}
      {unlinked.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">Competities ({unlinked.length})</span>
          </div>
          <div className="comp-list">
            {unlinked.map(c => (
              <CompItem key={c.id} comp={c} />
            ))}
          </div>
        </>
      )}

      {clubs.length > 0 && (
        <>
          <div className="section-header" style={{ marginTop: 16 }}>
            <span className="section-title">Clubs ({clubs.length})</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{teams.length} teams</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...clubs].sort((a, b) => {
              const al = (teamsByClub[a.external_id] || []).length
              const bl = (teamsByClub[b.external_id] || []).length
              return bl - al || (a.friendly_name || a.name).localeCompare(b.friendly_name || b.name, 'nl')
            }).map(c => {
              const ct = teamsByClub[c.external_id] || []
              const veld = ct.filter(t => t.hockey_type !== 'ZA' && (!t.short_name || t.short_name[0] !== 'z')).length
              const zaal = ct.filter(t => t.hockey_type === 'ZA' || (t.short_name && t.short_name[0] === 'z')).length
              return (
                <div key={c.external_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 9, fontSize: 13 }}>
                  <span style={{ flex: 1, fontWeight: 500 }}>{c.friendly_name || c.name}</span>
                  {c.city && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.city}</span>}
                  {veld > 0 && <span style={{ fontSize: 11, color: '#2e7d32' }}>🏑 {veld}</span>}
                  {zaal > 0 && <span style={{ fontSize: 11, color: '#7c3aed' }}>🏒 {zaal}</span>}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function CompItem({ comp }) {
  const typeIcon = comp.hockey_type === 'ZA' ? '🏒' : '🏑'
  const detail = [comp.competition_name, comp.season].filter(Boolean).join(' · ')

  return (
    <div className={`comp-item${comp.linked ? ' comp-linked' : ''}`}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{typeIcon}</span>
      <div className="comp-body">
        <div className="comp-name">{comp.name}</div>
        {detail && <div className="comp-detail">{detail}</div>}
        {comp.linked && comp.linked_tournament_name && (
          <div className="comp-detail" style={{ color: 'var(--color-primary)' }}>
            {comp.linked_tournament_name} · {comp.linked_phase_label}
          </div>
        )}
      </div>
      <VangerButton phaseId={comp.linked_phase_id} />
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

export function SeizoenScreen({ clubId, onClubChange, onOpenTournament }) {
  const [tab,          setTab]          = useState('publicaties')
  const [tournaments,  setTournaments]  = useState([])
  const [vangerItems,  setVangerItems]  = useState([])
  const [competitions, setCompetitions] = useState([])
  const [discClubs,    setDiscClubs]    = useState([])
  const [discTeams,    setDiscTeams]    = useState([])

  useEffect(() => {
    getTournaments().then(setTournaments).catch(() => {})
  }, [])

  function loadVanger() {
    api.get('/api/tournix/discovery/vanger/cmd-queue').then(data => {
      // Endpoint geeft {counts, recent:[{id, cmd_type, params (object), status, ...}]}
      setVangerItems(Array.isArray(data) ? data : (data.recent ?? []))
    }).catch(() => {})
  }

  function loadDiscovery() {
    Promise.all([
      api.get('/api/tournix/discovery/competitions'),
      api.get('/api/tournix/discovery/clubs'),
      api.get('/api/tournix/discovery/teams'),
    ]).then(([compsData, clubsData, teamsData]) => {
      setCompetitions(Array.isArray(compsData) ? compsData : [])
      setDiscClubs(clubsData.clubs || [])
      setDiscTeams(teamsData.teams || [])
    }).catch(() => {})
  }

  useEffect(() => {
    if (tab === 'vanger')    loadVanger()
    if (tab === 'discovery') loadDiscovery()
  }, [tab])

  // Client-side club filter (by location_club_id)
  const filtered = clubId
    ? tournaments.filter(t => t.location_club_id === clubId)
    : tournaments

  const active   = filtered.filter(t => t.status === 'active')
  const finished = filtered.filter(t => t.status === 'finished')

  return (
    <div className="seizoen-screen">
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

      <ClubFilterBar clubId={clubId} onChange={onClubChange} />

      <div className="seizoen-content">
        {tab === 'publicaties' && (
          <PublicatiesTab tournaments={active} onOpen={onOpenTournament} />
        )}
        {tab === 'vanger' && (
          <VangerTab items={vangerItems} onRefresh={loadVanger} />
        )}
        {tab === 'discovery' && (
          <DiscoveryTab competitions={competitions} clubs={discClubs} teams={discTeams} />
        )}
        {tab === 'archief' && (
          <ArchiefTab tournaments={finished} onOpen={onOpenTournament} />
        )}
      </div>
    </div>
  )
}
