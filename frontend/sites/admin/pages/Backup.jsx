import { useState, useRef } from 'react'
import { api } from '@core/api.js'
import AdminLayout from '../AdminLayout.jsx'

const APPS = [
  {
    id: 'mixmusic',
    label: 'Mix Music',
    icon: '♫',
    tables: ['genres', 'hearts', 'meta'],
    description: 'Genres, hartjes en scores per track',
  },
  {
    id: 'dontforget',
    label: 'DontForget',
    icon: '📋',
    tables: ['tasks'],
    description: 'Alle taken (inclusief verwijderde)',
  },
  {
    id: 'tournix',
    label: 'Tournix',
    icon: '🏆',
    tables: ['tournaments', 'teams', 'fields', 'matches', 'predictions'],
    description: 'Toernooien, teams, velden, wedstrijden en voorspellingen',
  },
]

export default function Backup() {
  return (
    <AdminLayout>
      <div style={{ padding: '28px 24px', maxWidth: 720 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Backup & Restore</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 28, lineHeight: 1.5 }}>
          Exporteer app-data als JSON of maak een volledige DB-snapshot. Importeren voegt toe (merge) of overschrijft alle data.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          {APPS.map(app => <AppCard key={app.id} app={app} />)}
        </div>

        <SnapshotCard />
      </div>
    </AdminLayout>
  )
}

// ── Per-app card ──────────────────────────────────────────────────────────────

function AppCard({ app }) {
  const fileRef  = useRef()
  const [status, setStatus]   = useState(null)  // null | {type, msg}
  const [loading, setLoading] = useState(null)  // 'export' | 'import' | null
  const [modal,   setModal]   = useState(null)  // pending File for import

  async function doExport() {
    setLoading('export'); setStatus(null)
    try {
      const res = await fetch(`/api/admin/backup/export/${app.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('hp_token')}` },
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `${app.id}-backup-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setStatus({ type: 'ok', msg: 'Export gedownload' })
    } catch (e) {
      setStatus({ type: 'err', msg: e.message })
    } finally {
      setLoading(null)
    }
  }

  function onFileChosen(e) {
    const f = e.target.files?.[0]
    if (f) { setModal(f); e.target.value = '' }
  }

  async function doImport(mode) {
    if (!modal) return
    setModal(null); setLoading('import'); setStatus(null)
    try {
      const form = new FormData()
      form.append('file', modal)
      const res = await fetch(`/api/admin/backup/import/${app.id}?mode=${mode}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('hp_token')}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Import mislukt')
      setStatus({ type: 'ok', msg: `✓ ${data.inserted} ingevoerd, ${data.skipped} overgeslagen${data.errors ? `, ${data.errors} fouten` : ''}` })
    } catch (e) {
      setStatus({ type: 'err', msg: e.message })
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 14, padding: '18px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>{app.icon}</span>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{app.label}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>{app.description}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {app.tables.map(t => (
                <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{t}</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={doExport} disabled={!!loading} style={btnSecondary}>
              {loading === 'export' ? '…' : '↓ Export'}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={!!loading} style={btnPrimary}>
              {loading === 'import' ? '…' : '↑ Import'}
            </button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={onFileChosen} />
          </div>
        </div>

        {status && (
          <div style={{ marginTop: 12, fontSize: 12, padding: '8px 12px', borderRadius: 8, background: status.type === 'ok' ? '#dcfce7' : '#fee2e2', color: status.type === 'ok' ? '#166534' : '#991b1b' }}>
            {status.msg}
          </div>
        )}
      </div>

      {modal && <ImportModal file={modal} app={app} onConfirm={doImport} onCancel={() => setModal(null)} />}
    </>
  )
}

// ── Import bevestigingsmodal ──────────────────────────────────────────────────

function ImportModal({ file, app, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 16, padding: '28px 24px', maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Import {app.label}</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6 }}>Bestand: <strong>{file.name}</strong></p>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
          Kies hoe bestaande data behandeld wordt:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <button onClick={() => onConfirm('merge')} style={{ ...btnPrimary, width: '100%', padding: '12px 16px', textAlign: 'left' }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Merge — bestaande data behouden</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Alleen nieuwe records (op basis van ID) worden toegevoegd. Niks wordt overschreven.</div>
          </button>
          <button onClick={() => onConfirm('overwrite')} style={{ ...btnDanger, width: '100%', padding: '12px 16px', textAlign: 'left' }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Overschrijven — alles wissen en vervangen</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Alle bestaande data voor {app.label} wordt verwijderd vóór het importeren.</div>
          </button>
        </div>

        <button onClick={onCancel} style={{ ...btnSecondary, width: '100%' }}>Annuleren</button>
      </div>
    </div>
  )
}

// ── DB Snapshot card ──────────────────────────────────────────────────────────

function SnapshotCard() {
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState(null)

  async function doSnapshot() {
    setLoading(true); setStatus(null)
    try {
      const res = await fetch('/api/admin/backup/snapshot', {
        headers: { Authorization: `Bearer ${localStorage.getItem('hp_token')}` },
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const cd   = res.headers.get('content-disposition') ?? ''
      const name = cd.match(/filename="([^"]+)"/)?.[1] ?? 'homeplatform-snapshot.sqlite'
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = name; a.click()
      URL.revokeObjectURL(url)
      setStatus({ type: 'ok', msg: 'Snapshot gedownload' })
    } catch (e) {
      setStatus({ type: 'err', msg: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 14, padding: '18px 20px',
      borderTop: '3px solid var(--color-primary)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🗄</span>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Volledige DB-snapshot</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
            Download het volledige SQLite-bestand. Bevat alle data van alle apps, users en instellingen. Gebruik bij grote wijzigingen of vóór een migratie.
          </p>
        </div>
        <button onClick={doSnapshot} disabled={loading} style={{ ...btnPrimary, flexShrink: 0 }}>
          {loading ? '…' : '↓ Download'}
        </button>
      </div>
      {status && (
        <div style={{ marginTop: 12, fontSize: 12, padding: '8px 12px', borderRadius: 8, background: status.type === 'ok' ? '#dcfce7' : '#fee2e2', color: status.type === 'ok' ? '#166534' : '#991b1b' }}>
          {status.msg}
        </div>
      )}
    </div>
  )
}

// ── Stijlen ───────────────────────────────────────────────────────────────────

const btnBase = {
  padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit', border: 'none', transition: 'opacity 0.15s',
}
const btnPrimary   = { ...btnBase, background: 'var(--color-primary)', color: '#fff' }
const btnSecondary = { ...btnBase, background: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }
const btnDanger    = { ...btnBase, background: '#dc2626', color: '#fff' }
