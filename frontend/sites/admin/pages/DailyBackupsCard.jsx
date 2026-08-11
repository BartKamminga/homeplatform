import { useState, useEffect, useCallback } from 'react'
import { api } from '@core/api.js'

const btnBase = {
  padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit', border: 'none', transition: 'opacity 0.15s',
}
const btnSecondary = { ...btnBase, background: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }
const btnDanger    = { ...btnBase, background: '#dc2626', color: '#fff' }

export default function DailyBackupsCard() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [status,  setStatus]  = useState(null)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/admin/backup/daily')
      setData(r)
    } catch (e) {
      setStatus({ type: 'err', msg: e.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function doTrigger() {
    setStatus(null)
    try {
      const r = await api.post('/api/admin/backup/daily/trigger', {})
      setStatus({ type: 'ok', msg: `✓ Backup gemaakt: ${r.filename} (${r.size_mb} MB)` })
      load()
    } catch (e) {
      setStatus({ type: 'err', msg: e.message })
    }
  }

  async function doRestore(filename) {
    setConfirm(null); setStatus(null)
    try {
      await api.post(`/api/admin/backup/daily/restore/${filename}`, {})
      setStatus({ type: 'warn', msg: `⚠ Restore ingepland voor "${filename}". Backend herstart binnen ~1 minuut.` })
      load()
    } catch (e) {
      setStatus({ type: 'err', msg: e.message })
    }
  }

  const pending = data?.pending_restore
  const backups = data?.backups ?? []

  return (
    <>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 14, padding: '18px 20px', marginBottom: 16,
        borderTop: '3px solid #16a34a',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>📅</span>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Dagelijkse backups</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              Automatisch elke dag om 03:00 (prod + acc). Bewaard: 14 dagen lokaal + kopie op NAS.
            </p>
          </div>
          <button onClick={doTrigger} style={{ ...btnSecondary, flexShrink: 0, whiteSpace: 'nowrap' }}>
            ▶ Backup nu
          </button>
        </div>

        {pending && (
          <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#fef9c3', color: '#713f12', fontSize: 12, fontWeight: 500 }}>
            ⏳ Restore in behandeling: <code style={{ fontFamily: 'monospace' }}>{pending}</code> — backend herstart binnen ~1 min
          </div>
        )}

        {status && (
          <div style={{
            marginBottom: 12, padding: '8px 12px', borderRadius: 8, fontSize: 12,
            background: status.type === 'ok' ? '#dcfce7' : status.type === 'warn' ? '#fef9c3' : '#fee2e2',
            color:      status.type === 'ok' ? '#166534' : status.type === 'warn' ? '#713f12' : '#991b1b',
          }}>
            {status.msg}
          </div>
        )}

        {loading && <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Laden…</p>}

        {!loading && backups.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Nog geen backups. Klik "Backup nu" om de eerste aan te maken.</p>
        )}

        {!loading && backups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {backups.map((b, i) => (
              <div key={b.filename} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 9,
                background: i === 0 ? 'var(--color-background)' : 'transparent',
                border: `1px solid ${i === 0 ? 'var(--color-border)' : 'transparent'}`,
              }}>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text)', flex: 1 }}>
                  {b.date}
                  {i === 0 && <span style={{ marginLeft: 8, fontSize: 10, background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>laatste</span>}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 60, textAlign: 'right' }}>{b.size_mb} MB</span>
                <button
                  onClick={() => setConfirm(b.filename)}
                  disabled={!!pending}
                  style={{ ...btnSecondary, fontSize: 11, padding: '4px 10px', opacity: pending ? 0.4 : 1 }}
                >
                  Terugzetten
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 16, padding: '28px 24px', maxWidth: 420, width: '100%' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Backup terugzetten?</h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              Bestand: <code style={{ fontFamily: 'monospace' }}>{confirm}</code>
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              De huidige database wordt vervangen. De backend herstart automatisch (~1 min). <strong>Dit is onomkeerbaar.</strong>
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => doRestore(confirm)} style={{ ...btnDanger, flex: 1 }}>Ja, terugzetten</button>
              <button onClick={() => setConfirm(null)} style={{ ...btnSecondary, flex: 1 }}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
