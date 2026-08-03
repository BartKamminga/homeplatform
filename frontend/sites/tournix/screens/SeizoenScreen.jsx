import { useState, useEffect } from 'react'
import { getTournaments, createTournament } from '../api.js'
import BeheerDiscoveryTab from '../beheer/DiscoveryTab.jsx'
import VangerTab          from '../beheer/VangerTab.jsx'
import StatsTab           from '../beheer/StatsTab.jsx'
import CaptureArchiefTab  from '../beheer/ArchiefTab.jsx'

const SEIZOEN_TABS = [
  { id: 'publicaties', label: 'Publicaties' },
  { id: 'discovery',   label: 'Discovery'   },
  { id: 'vanger',      label: 'Vanger'      },
  { id: 'stats',       label: 'Stats'       },
  { id: 'archief',     label: 'Archief'     },
]

// ── Publicatie kaart ──────────────────────────────────────────────────────────

function PublicatieCard({ tournament, onOpen }) {
  return (
    <div className="t-card" onClick={() => onOpen(tournament)}>
      <div className="t-card-body">
        <div className="t-card-name">{tournament.name}</div>
        {tournament.season && (
          <div className="t-card-meta">{tournament.season}</div>
        )}
        {tournament.description && (
          <div className="t-card-meta" style={{ fontStyle: 'italic' }}>{tournament.description}</div>
        )}
      </div>
    </div>
  )
}

// ── Nieuwe publicatie popup ───────────────────────────────────────────────────

const KNOWN_SEASONS = ['2024-2025', '2025-2026', '2026-2027']

function CreatePublicatiePopup({ onClose, onCreated }) {
  const [name,   setName]   = useState('')
  const [season, setSeason] = useState('2026-2027')
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setErr('Naam is verplicht')
    setSaving(true)
    setErr('')
    try {
      const t = await createTournament({ name: name.trim(), season: season || undefined })
      onCreated(t)
    } catch {
      setErr('Opslaan mislukt')
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: 14, padding: '24px 28px',
        width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Nieuwe publicatie</h2>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
            Naam *
          </label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="bijv. NK Zaalhockey 2027"
            style={inputStyle}
          />
          <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, marginTop: 12 }}>
            Seizoen
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {KNOWN_SEASONS.map(s => (
              <button
                key={s} type="button"
                onClick={() => setSeason(s)}
                style={{
                  flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 12,
                  border: season === s ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: season === s ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: season === s ? '#fff' : 'var(--color-text)',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: season === s ? 700 : 400,
                }}
              >{s}</button>
            ))}
          </div>
          {err && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btnOutlineStyle}>Annuleren</button>
            <button type="submit" disabled={saving} style={btnPrimaryStyle}>
              {saving ? 'Opslaan…' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Publicaties tab ───────────────────────────────────────────────────────────

function PublicatiesTab({ tournaments, onOpen }) {
  if (tournaments.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🏑</div>
        Geen actieve publicaties
      </div>
    )
  }
  return (
    <div>
      {tournaments.map(t => (
        <PublicatieCard key={t.id} tournament={t} onOpen={onOpen} />
      ))}
    </div>
  )
}

// ── SeizoenScreen ─────────────────────────────────────────────────────────────

export function SeizoenScreen({ onOpenTournament, isAdmin }) {
  const [tab,         setTab]         = useState('publicaties')
  const [tournaments, setTournaments] = useState([])
  const [search,      setSearch]      = useState('')
  const [showCreate,  setShowCreate]  = useState(false)

  useEffect(() => {
    getTournaments().then(setTournaments).catch(() => {})
  }, [])

  const q        = search.trim().toLowerCase()
  const filtered = q ? tournaments.filter(t => t.name.toLowerCase().includes(q)) : tournaments
  const active   = filtered.filter(t => t.status === 'active')

  function handleCreated(t) {
    setShowCreate(false)
    setTournaments(prev => [t, ...prev])
    onOpenTournament(t)
  }

  return (
    <div className="seizoen-screen">
      {showCreate && (
        <CreatePublicatiePopup onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

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
                placeholder="Zoek publicatie…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1, padding: '8px 12px',
                  border: '1px solid var(--color-border)', borderRadius: 9,
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  fontSize: 13, fontFamily: 'inherit', outline: 'none',
                }}
              />
              {isAdmin && (
                <button onClick={() => setShowCreate(true)} style={{
                  padding: '8px 14px', borderRadius: 9, border: 'none',
                  background: 'var(--color-primary)', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}>+ Nieuw</button>
              )}
            </div>
            <PublicatiesTab tournaments={active} onOpen={onOpenTournament} />
          </>
        )}
        {tab === 'discovery' && (
          <BeheerDiscoveryTab view="resultaten" />
        )}
        {tab === 'vanger' && (
          <VangerTab />
        )}
        {tab === 'stats' && (
          <StatsTab />
        )}
        {tab === 'archief' && (
          <CaptureArchiefTab />
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: '1px solid var(--color-border)', borderRadius: 8,
  background: 'var(--color-bg)', color: 'var(--color-text)',
  fontFamily: 'inherit', boxSizing: 'border-box',
}

const btnOutlineStyle = {
  padding: '8px 16px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--color-border)', background: 'var(--color-surface)',
  color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit',
}

const btnPrimaryStyle = {
  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  border: 'none', background: 'var(--color-primary)', color: '#fff',
  cursor: 'pointer', fontFamily: 'inherit',
}
