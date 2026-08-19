import { useState, useEffect } from 'react'
import {
  getCaptureSessions, getCaptureSessionItems, reprocessCaptures,
  deleteCaptureSession, deleteOldCaptureSessions,
} from '../api.js'
import { muted } from './styles.js'
import SessionRow from './SessionRow.jsx'
import ItemDetail from './ItemDetail.jsx'

const PAGE_SIZE = 50

export default function ArchiefTab() {
  const [sessions,     setSessions]     = useState([])
  const [hasMore,      setHasMore]      = useState(false)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [selectedSid,  setSelectedSid]  = useState(null)
  const [items,        setItems]        = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [error,        setError]        = useState(null)
  const [reprocessing, setReprocessing] = useState(false)
  const [reprocessMsg, setReprocessMsg] = useState(null)
  const [deleting,     setDeleting]     = useState(false)
  const [cleanupDays,  setCleanupDays]  = useState(30)

  useEffect(() => {
    setLoading(true)
    getCaptureSessions(0, PAGE_SIZE)
      .then(r => { setSessions(r.sessions ?? []); setHasMore(!!r.has_more); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const r = await getCaptureSessions(sessions.length, PAGE_SIZE)
      setSessions(prev => [...prev, ...(r.sessions ?? [])])
      setHasMore(!!r.has_more)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleDeleteSession(sid) {
    if (!window.confirm('Deze sessie definitief uit het archief verwijderen?')) return
    setDeleting(true)
    try {
      await deleteCaptureSession(sid)
      setSessions(prev => prev.filter(s => s.session_id !== sid))
      if (selectedSid === sid) { setSelectedSid(null); setItems([]) }
    } catch (e) {
      setReprocessMsg(`Fout: ${e.message}`)
    } finally {
      setDeleting(false)
    }
  }

  async function handleCleanupOld() {
    if (!window.confirm(`Alle captures ouder dan ${cleanupDays} dagen definitief verwijderen?`)) return
    setDeleting(true)
    try {
      const r = await deleteOldCaptureSessions(cleanupDays)
      setReprocessMsg(`✓ ${r.deleted} captures opgeruimd`)
      const r2 = await getCaptureSessions(0, PAGE_SIZE)
      setSessions(r2.sessions ?? [])
      setHasMore(!!r2.has_more)
      setSelectedSid(null)
      setItems([])
    } catch (e) {
      setReprocessMsg(`Fout: ${e.message}`)
    } finally {
      setDeleting(false)
      setTimeout(() => setReprocessMsg(null), 5000)
    }
  }

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

  async function handleReprocessSession(sid) {
    setReprocessing(true)
    setReprocessMsg(null)
    try {
      const r = await reprocessCaptures({ session_id: sid })
      setReprocessMsg(`✓ ${r.ok} verwerkt${r.failed ? `, ${r.failed} mislukt` : ''}`)
    } catch (e) {
      setReprocessMsg(`Fout: ${e.message}`)
    } finally {
      setReprocessing(false)
      setTimeout(() => setReprocessMsg(null), 5000)
    }
  }

  async function handleReprocessCapture(captureId) {
    setReprocessing(true)
    setReprocessMsg(null)
    try {
      const r = await reprocessCaptures({ capture_id: captureId })
      setReprocessMsg(`✓ ${r.ok} verwerkt${r.failed ? `, ${r.failed} mislukt` : ''}`)
    } catch (e) {
      setReprocessMsg(`Fout: ${e.message}`)
    } finally {
      setReprocessing(false)
      setTimeout(() => setReprocessMsg(null), 5000)
    }
  }

  if (loading) return <div style={muted}>Laden…</div>
  if (error)   return <div style={{ ...muted, color: 'var(--color-danger)' }}>Fout: {error}</div>
  if (sessions.length === 0) return (
    <div style={muted}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>🗄️</div>
      <div>Nog geen gearchiveerde data.</div>
      <div style={{ marginTop: 4, fontSize: 12 }}>
        Data wordt automatisch gearchiveerd als je Scout of Ghost gebruikt.
      </div>
    </div>
  )

  return (
    <div>
      {reprocessMsg && (
        <div style={{
          marginBottom: 12, padding: '8px 14px', borderRadius: 7, fontSize: 12,
          background: reprocessMsg.startsWith('✓') ? 'color-mix(in srgb, var(--color-success) 12%, var(--color-surface))' : 'color-mix(in srgb, var(--color-danger) 12%, var(--color-surface))',
          border: `1px solid ${reprocessMsg.startsWith('✓') ? 'var(--color-success)' : 'var(--color-danger)'}`,
          color: 'var(--color-text)',
        }}>
          {reprocessMsg}
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Sessie lijst */}
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Sessies ({sessions.length}{hasMore ? '+' : ''})
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Opschonen ouder dan</span>
            <input
              type="number" min={1} value={cleanupDays}
              onChange={e => setCleanupDays(Number(e.target.value) || 1)}
              style={{
                width: 48, fontSize: 11, padding: '2px 6px', borderRadius: 5,
                border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>dagen</span>
            <button
              onClick={handleCleanupOld}
              disabled={deleting}
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 5, cursor: deleting ? 'default' : 'pointer',
                border: '1px solid var(--color-border)', background: 'transparent',
                color: 'var(--color-text-muted)', fontFamily: 'inherit', opacity: deleting ? 0.5 : 1,
              }}
            >
              🧹 opschonen
            </button>
          </div>
          {sessions.map(s => (
            <SessionRow
              key={s.session_id}
              s={s}
              selected={selectedSid === s.session_id}
              onSelect={selectSession}
              onReprocess={handleReprocessSession}
              reprocessing={reprocessing}
              onDelete={handleDeleteSession}
              deleting={deleting}
            />
          ))}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                width: '100%', fontSize: 12, padding: '8px', borderRadius: 6, marginTop: 6,
                cursor: loadingMore ? 'default' : 'pointer', border: '1px solid var(--color-border)',
                background: 'transparent', color: 'var(--color-text-muted)', fontFamily: 'inherit',
              }}
            >
              {loadingMore ? 'Laden…' : 'Meer laden'}
            </button>
          )}
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
                {items.length} item{items.length === 1 ? '' : 's'} in deze sessie
              </div>
              {items.map(item => (
                <ItemDetail
                  key={item.id}
                  item={item}
                  onReprocess={handleReprocessCapture}
                  reprocessing={reprocessing}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
