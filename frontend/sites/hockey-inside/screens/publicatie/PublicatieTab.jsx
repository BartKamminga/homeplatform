import { useState, useEffect } from 'react'
import {
  getPublications, createPublication, updatePublication,
  reorderPublications, deletePublication, getMe,
  KNOWN_SEASONS,
} from '../../api.js'
import CompetitiesTab from './CompetitiesTab.jsx'
import { ghostBtn, primaryBtn, inputStyle } from '../styles.js'
import { Toggle } from '../ui.jsx'

// ── Aanmaken popup ────────────────────────────────────────────────────────────

function CreatePopup({ onClose, onCreated }) {
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
      const t = await createPublication({ name: name.trim(), season: season || undefined })
      onCreated(t)
    } catch {
      setErr('Opslaan mislukt')
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, margin: '0 0 18px' }}>Nieuwe publicatie</h2>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Naam *</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="bijv. NK Zaalhockey 2027"
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 14 }}
          />
          <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Seizoen</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {KNOWN_SEASONS.map(s => (
              <button key={s} type="button" onClick={() => setSeason(s)} style={{
                flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 11,
                border: season === s ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: season === s ? 'var(--color-primary)' : 'var(--color-bg)',
                color: season === s ? '#fff' : 'var(--color-text)',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: season === s ? 700 : 400,
              }}>{s}</button>
            ))}
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={ghostBtn}>Annuleren</button>
            <button type="submit" disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Opslaan…' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Publicatie kaart ──────────────────────────────────────────────────────────

function PublicatieCard({ t, isAdmin, onOpen, onTogglePublished, reorderable, isFirst, isLast, onMoveUp, onMoveDown }) {
  return (
    <div
      onClick={() => onOpen(t)}
      style={{
        padding: '14px 16px', background: 'var(--color-surface)',
        border: '1px solid var(--color-border)', borderRadius: 10,
        cursor: 'pointer', marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {reorderable && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
            <button type="button" title="Naar boven" disabled={isFirst}
              onClick={e => { e.stopPropagation(); onMoveUp() }}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, lineHeight: 1,
                color: 'var(--color-text-muted)', cursor: isFirst ? 'default' : 'pointer', opacity: isFirst ? 0.25 : 1 }}>▲</button>
            <button type="button" title="Naar beneden" disabled={isLast}
              onClick={e => { e.stopPropagation(); onMoveDown() }}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, lineHeight: 1,
                color: 'var(--color-text-muted)', cursor: isLast ? 'default' : 'pointer', opacity: isLast ? 0.25 : 1 }}>▼</button>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{t.name}</div>
          {t.season && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t.season}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {isAdmin ? (
            <Toggle
              on={t.published}
              onChange={e => { e.stopPropagation(); onTogglePublished(t) }}
              onLabel="● Zichtbaar" offLabel="○ Concept" offVariant="partial"
            />
          ) : !t.published ? (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'color-mix(in srgb, var(--color-warning) 15%, var(--color-surface))', color: 'var(--color-warning)', fontWeight: 600 }}>Concept</span>
          ) : null}
          {t.competition_count > 0 && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{t.competition_count} comp.</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Publicatie detail ─────────────────────────────────────────────────────────

function PublicatieDetail({ tournament, isAdmin, onBack, onDeleted, onUpdated }) {
  const [t, setT] = useState(tournament)

  async function handleTogglePublished() {
    const next = !t.published
    const updated = { ...t, published: next }
    setT(updated)
    try { await updatePublication(t.id, { published: next }); onUpdated(updated) }
    catch { setT(t) }
  }

  async function handleDelete() {
    await deletePublication(t.id)
    onDeleted()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={onBack} style={{ ...ghostBtn, padding: '6px 10px' }}>← Terug</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{t.name}</div>
          {t.season && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t.season}</div>}
        </div>
      </div>

      <CompetitiesTab
        tid={t.id}
        season={t.season}
        isAdmin={isAdmin}
        published={t.published}
        onTogglePublished={isAdmin ? handleTogglePublished : null}
        onDelete={isAdmin ? handleDelete : null}
      />
    </div>
  )
}

// ── PublicatieTab (root) ──────────────────────────────────────────────────────

export default function PublicatieTab() {
  const [tournaments, setTournaments] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [isAdmin,     setIsAdmin]     = useState(false)
  const [showCreate,  setShowCreate]  = useState(false)
  const [search,      setSearch]      = useState('')

  useEffect(() => {
    getMe().then(me => setIsAdmin(me?.groups?.includes('admins') ?? false)).catch(() => {})
    load()
  }, [])

  function load() {
    setLoading(true)
    getPublications().then(setTournaments).catch(() => {}).finally(() => setLoading(false))
  }

  function handleCreated(t) {
    setShowCreate(false)
    setTournaments(prev => [t, ...prev])
    setSelected(t)
  }

  async function handleTogglePublished(t) {
    const next = !t.published
    setTournaments(prev => prev.map(x => x.id === t.id ? { ...x, published: next } : x))
    try { await updatePublication(t.id, { published: next }) }
    catch { setTournaments(prev => prev.map(x => x.id === t.id ? { ...x, published: t.published } : x)) }
  }

  function handleReorder(newList) {
    setTournaments(prev => {
      const ids = new Set(newList.map(t => t.id))
      return [...newList, ...prev.filter(t => !ids.has(t.id))]
    })
    reorderPublications(newList.map(t => t.id)).catch(() => {})
  }

  // item 883: native HTML5 drag-and-drop (draggable/onDragStart/onDrop) vuurt niet
  // op touchscreens - vervangen door knoppen die overal werken.
  function handleMove(idx, dir, list) {
    const target = idx + dir
    if (target < 0 || target >= list.length) return
    const next = [...list]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    handleReorder(next)
  }

  if (selected) {
    return (
      <PublicatieDetail
        tournament={selected}
        isAdmin={isAdmin}
        onBack={() => { setSelected(null); load() }}
        onDeleted={() => { setSelected(null); load() }}
        onUpdated={t => {
          setTournaments(prev => prev.map(x => x.id === t.id ? t : x))
          setSelected(t)
        }}
      />
    )
  }

  const q = search.trim().toLowerCase()
  const filtered = (q
    ? tournaments.filter(t => t.name.toLowerCase().includes(q))
    : tournaments
  ).filter(t => t.status === 'active')

  return (
    <div>
      {showCreate && (
        <CreatePopup onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Zoek publicatie…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} style={primaryBtn}>+ Nieuw</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>Laden…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>
          {search ? 'Geen resultaten.' : 'Nog geen publicaties aangemaakt.'}
        </div>
      ) : (
        filtered.map((t, i) => (
          <PublicatieCard
            key={t.id}
            t={t}
            isAdmin={isAdmin}
            onOpen={setSelected}
            onTogglePublished={handleTogglePublished}
            reorderable={isAdmin && !q}
            isFirst={i === 0}
            isLast={i === filtered.length - 1}
            onMoveUp={() => handleMove(i, -1, filtered)}
            onMoveDown={() => handleMove(i, 1, filtered)}
          />
        ))
      )}
    </div>
  )
}
