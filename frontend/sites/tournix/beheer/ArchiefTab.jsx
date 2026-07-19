import { useState, useEffect } from 'react'
import { getCaptureSessions, getCaptureSessionItems } from '../api.js'
import { muted, ghostBtn } from './styles.js'

function fmt(iso) {
  if (!iso) return '?'
  return new Date(iso).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function SessionRow({ s, onSelect, selected }) {
  return (
    <div
      onClick={() => onSelect(s.session_id)}
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: selected ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))' : 'var(--color-surface)',
        cursor: 'pointer',
        marginBottom: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          {fmt(s.captured_at)}
        </span>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 99,
          background: 'var(--color-surface-2)', color: 'var(--color-text-muted)',
          border: '1px solid var(--color-border)',
        }}>
          {s.item_count} poules
        </span>
      </div>
      {s.competitions.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
          {s.competitions.join(' · ')}
        </div>
      )}
    </div>
  )
}

function ItemDetail({ item }) {
  const [open, setOpen] = useState(false)
  const m = item.meta
  const teamCount = m.team_count ?? '?'
  const played = m.matches_played ?? '?'
  const remaining = m.matches_remaining ?? '?'
  return (
    <div style={{
      borderRadius: 7,
      border: '1px solid var(--color-border)',
      background: 'var(--color-background)',
      marginBottom: 6,
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', userSelect: 'none' }}>
          {open ? '▼' : '▶'}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: 'var(--color-text)' }}>
          {m.poule_name || item.external_id}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          👥 {teamCount} &nbsp; 📊 {played} &nbsp; 📅 {remaining}
        </span>
      </div>
      {open && (
        <div style={{ padding: '0 12px 10px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, marginBottom: 4 }}>
            {m.competition && <span>{m.competition}</span>}
            {m.class_name && <span> · {m.class_name}</span>}
            {m.via_team && <span style={{ marginLeft: 8, opacity: 0.7 }}>via {m.via_team}</span>}
          </div>
          {m.teams && m.teams.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              {m.teams.map((t, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 99,
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}>{t}</span>
              ))}
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 8, fontFamily: 'monospace' }}>
            id: {item.external_id} · vastgelegd {fmt(item.captured_at)}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ArchiefTab() {
  const [sessions,    setSessions]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selectedSid, setSelectedSid] = useState(null)
  const [items,       setItems]       = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    setLoading(true)
    getCaptureSessions()
      .then(r => { setSessions(r.sessions ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  async function selectSession(sid) {
    if (selectedSid === sid) { setSelectedSid(null); setItems([]); return }
    setSelectedSid(sid)
    setItemsLoading(true)
    try {
      const r = await getCaptureSessionItems(sid)
      setItems(r.items ?? [])
    } catch (e) {
      setItems([])
    } finally {
      setItemsLoading(false)
    }
  }

  if (loading) return <div style={muted}>Laden…</div>
  if (error)   return <div style={{ ...muted, color: 'var(--color-danger)' }}>Fout: {error}</div>
  if (sessions.length === 0) return (
    <div style={muted}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>🗄️</div>
      <div>Nog geen gearchiveerde data.</div>
      <div style={{ marginTop: 4, fontSize: 12 }}>
        Data wordt automatisch gearchiveerd als je de Hockey Data Vanger gebruikt.
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Sessie lijst */}
      <div style={{ flex: '0 0 260px', minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
          Sessies ({sessions.length})
        </div>
        {sessions.map(s => (
          <SessionRow
            key={s.session_id}
            s={s}
            selected={selectedSid === s.session_id}
            onSelect={selectSession}
          />
        ))}
      </div>

      {/* Detail */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selectedSid && (
          <div style={muted}>Klik op een sessie om de gevangen poules te zien.</div>
        )}
        {selectedSid && itemsLoading && (
          <div style={muted}>Laden…</div>
        )}
        {selectedSid && !itemsLoading && items.length === 0 && (
          <div style={muted}>Geen items gevonden.</div>
        )}
        {selectedSid && !itemsLoading && items.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              {items.length} poules in deze sessie
            </div>
            {items.map(item => <ItemDetail key={item.id} item={item} />)}
          </>
        )}
      </div>
    </div>
  )
}
