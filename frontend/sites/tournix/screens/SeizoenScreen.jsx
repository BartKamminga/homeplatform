import { useState, useEffect, useRef } from 'react'
import { getTournaments, createTournament, updateTournament, reorderTournaments, KNOWN_SEASONS } from '../api.js'

// ── Publicatie kaart ──────────────────────────────────────────────────────────

function TournooiCard({ tournament: t, onOpen, isAdmin, onTogglePublished, draggable, onDragStart, onDragOver, onDrop, isDragOver }) {
  return (
    <div
      className="t-card"
      onClick={() => onOpen(t)}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); onDragOver && onDragOver() }}
      onDrop={onDrop}
      style={{ opacity: isDragOver ? 0.5 : 1, cursor: draggable ? 'grab' : 'pointer' }}
    >
      <div className="t-card-body">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-card-name">{t.name}</div>
            {t.season && <div className="t-card-meta">{t.season}</div>}
            {t.description && <div className="t-card-meta" style={{ fontStyle: 'italic' }}>{t.description}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            {isAdmin ? (
              <button
                onClick={e => { e.stopPropagation(); onTogglePublished(t) }}
                title={t.published ? 'Klik om te verbergen' : 'Klik om te publiceren'}
                style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 99, cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 600, border: 'none',
                  background: t.published ? '#16a34a22' : '#f9731622',
                  color: t.published ? '#16a34a' : '#f97316',
                }}
              >{t.published ? '● Zichtbaar' : '○ Concept'}</button>
            ) : !t.published ? (
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 99,
                background: '#f9731622', color: '#f97316', fontWeight: 600,
              }}>Concept</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Nieuw toernooi popup ──────────────────────────────────────────────────────

function CreateTournooiPopup({ onClose, onCreated }) {
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
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Nieuw toernooi</h2>
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

// ── Toernooien lijst ──────────────────────────────────────────────────────────

function TournooienTab({ tournaments, onOpen, isAdmin, onTogglePublished, onReorder }) {
  const dragIdx = useRef(null)
  const [overIdx, setOverIdx] = useState(null)

  if (tournaments.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🏑</div>
        Geen actieve toernooien
      </div>
    )
  }

  function handleDrop(targetIdx) {
    if (dragIdx.current === null || dragIdx.current === targetIdx) { setOverIdx(null); return }
    const next = [...tournaments]
    const [moved] = next.splice(dragIdx.current, 1)
    next.splice(targetIdx, 0, moved)
    dragIdx.current = null
    setOverIdx(null)
    onReorder(next)
  }

  return (
    <div>
      {tournaments.map((t, i) => (
        <TournooiCard
          key={t.id}
          tournament={t}
          onOpen={onOpen}
          isAdmin={isAdmin}
          onTogglePublished={onTogglePublished}
          draggable={isAdmin}
          onDragStart={() => { dragIdx.current = i }}
          onDragOver={() => setOverIdx(i)}
          onDrop={() => handleDrop(i)}
          isDragOver={overIdx === i && dragIdx.current !== i}
        />
      ))}
    </div>
  )
}

// ── SeizoenScreen ─────────────────────────────────────────────────────────────

export function SeizoenScreen({ onOpenTournament, isAdmin }) {
  const [tournaments, setTournaments] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [showCreate,  setShowCreate]  = useState(false)

  useEffect(() => {
    setLoading(true)
    getTournaments().then(setTournaments).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const q      = search.trim().toLowerCase()
  const active = (q ? tournaments.filter(t => t.name.toLowerCase().includes(q)) : tournaments)
    .filter(t => t.status === 'active')

  function handleCreated(t) {
    setShowCreate(false)
    setTournaments(prev => [t, ...prev])
    onOpenTournament(t)
  }

  function handleReorder(newList) {
    setTournaments(prev => {
      const activeIds = new Set(newList.map(t => t.id))
      return [...newList, ...prev.filter(t => !activeIds.has(t.id))]
    })
    reorderTournaments(newList.map(t => t.id)).catch(() => {})
  }

  async function handleTogglePublished(t) {
    const next = !t.published
    setTournaments(prev => prev.map(x => x.id === t.id ? { ...x, published: next } : x))
    try {
      await updateTournament(t.id, { published: next })
    } catch {
      setTournaments(prev => prev.map(x => x.id === t.id ? { ...x, published: t.published } : x))
    }
  }

  return (
    <div className="seizoen-screen">
      {showCreate && (
        <CreateTournooiPopup onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      <div className="seizoen-content">
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
          {isAdmin && (
            <button onClick={() => setShowCreate(true)} style={{
              padding: '8px 14px', borderRadius: 9, border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>+ Toernooi</button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>
            Laden…
          </div>
        ) : (
          <TournooienTab
            tournaments={active}
            onOpen={onOpenTournament}
            isAdmin={isAdmin}
            onTogglePublished={handleTogglePublished}
            onReorder={handleReorder}
          />
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
