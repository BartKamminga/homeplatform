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

// ── Tournament card ───────────────────────────────────────────────────────

function TournamentCard({ tournament, onOpen }) {
  const [phases, setPhases] = useState([])

  useEffect(() => {
    getPhases(tournament.id).then(setPhases).catch(() => {})
  }, [tournament.id])

  const phaseLabels = phases
    .filter(p => p.phase_label)
    .map(p => p.phase_label)
    .join(' · ')

  const metaParts = [tournament.season, phaseLabels].filter(Boolean)

  return (
    <div className="t-card" onClick={() => onOpen(tournament)}>
      <div className="t-card-body">
        <div className="t-card-name">{tournament.name}</div>
        {metaParts.length > 0 && (
          <div className="t-card-meta">{metaParts.join(' — ')}</div>
        )}
      </div>
      <VangerButton tournamentId={tournament.id} />
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

function DiscoveryTab({ competitions }) {
  if (competitions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        Geen competities gevonden — start de vanger
      </div>
    )
  }

  const unlinked = competitions.filter(c => !c.linked)
  const linked   = competitions.filter(c => c.linked)

  return (
    <div>
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
            <span className="section-title">Buitenspel ({unlinked.length})</span>
          </div>
          <div className="comp-list">
            {unlinked.map(c => (
              <CompItem key={c.id} comp={c} />
            ))}
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
    api.get('/api/tournix/discovery/competitions').then(data => {
      setCompetitions(Array.isArray(data) ? data : [])
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
          <DiscoveryTab competitions={competitions} />
        )}
        {tab === 'archief' && (
          <ArchiefTab tournaments={finished} onOpen={onOpenTournament} />
        )}
      </div>
    </div>
  )
}
