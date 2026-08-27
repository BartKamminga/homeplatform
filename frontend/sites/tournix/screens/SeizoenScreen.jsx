import { useState, useEffect, useRef } from 'react'
import { getTournaments, createTournament, updateTournament, reorderTournaments, KNOWN_SEASONS } from '../api.js'
import CreateNamedSeasonModal from '@components/CreateNamedSeasonModal.jsx'

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
        <CreateNamedSeasonModal
          title="Nieuw toernooi"
          namePlaceholder="bijv. NK Zaalhockey 2027"
          seasons={KNOWN_SEASONS}
          onSubmit={(name, season) => createTournament({ name, season })}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
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

