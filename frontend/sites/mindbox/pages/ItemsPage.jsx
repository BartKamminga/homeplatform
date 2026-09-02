import { useEffect, useRef, useState } from 'react'
import { listItems, uploadItem, updateItem, deleteItem, downloadItem, listContexts } from '../api.js'
import { copyText, mindboxRunCommand } from '../utils.js'

const STATUS_OPTIONS = [
  { value: 'new', label: 'Nieuw' },
  { value: 'in_progress', label: 'In behandeling' },
  { value: 'done', label: 'Afgerond' },
]

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ItemsPage() {
  const [items, setItems] = useState([])
  const [contexts, setContexts] = useState([])
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  function load() {
    listItems().then(setItems).catch(e => setError(e.message))
  }
  useEffect(() => {
    load()
    listContexts().then(setContexts).catch(() => {})
  }, [])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      await uploadItem(file)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleStatusChange(item, status) {
    await updateItem(item.id, { status })
    load()
  }

  async function handleContextChange(item, contextId) {
    if (contextId) await updateItem(item.id, { context_id: contextId })
    else await updateItem(item.id, { clear_context: true })
    load()
  }

  async function handleNotesBlur(item, notes) {
    if (notes === (item.notes || '')) return
    await updateItem(item.id, { notes })
    load()
  }

  async function handleDelete(item) {
    if (!window.confirm(`"${item.original_filename}" verwijderen?`)) return
    await deleteItem(item.id)
    load()
  }

  // Fase 2 (item 1050, Bart 2-09-2026: "net als in de admin roadmap, de
  // mogelijkheid om de commando's voor het verwerken meteen te kunnen
  // kopiëren") - MindBox.Run bestaat nog niet als echt commando, maar de
  // exacte, kopieerbare aanroep alvast klaarzetten kost niets en bereidt de
  // workflow voor.
  const [copyMsg, setCopyMsg] = useState('')
  function handleCopyRun(target) {
    copyText(mindboxRunCommand(target))
      .then(() => { setCopyMsg('Gekopieerd!'); setTimeout(() => setCopyMsg(''), 1500) })
      .catch(() => setCopyMsg('Kopiëren mislukt'))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
            border: 'none', background: 'var(--color-primary)', color: '#fff',
          }}
        >
          {uploading ? 'Bezig...' : '+ Bestand uploaden'}
        </button>
        <input ref={fileInputRef} type="file" onChange={handleFileChange} style={{ display: 'none' }} />
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          .msg, .doc(x), .xls(x), .ppt(x), .pdf, .txt, .csv — max 25MB
        </span>
        {!!items.length && (
          <button
            onClick={() => handleCopyRun('all')}
            title="Kopieer MindBox.Run(all) om alle bestanden te verwerken"
            style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 11, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontFamily: 'monospace' }}
          >
            ⧉ MindBox.Run(all)
          </button>
        )}
        {copyMsg && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{copyMsg}</span>}
      </div>

      {error && <div style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {!items.length && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Nog geen bestanden geüpload.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => (
          <div
            key={item.id}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 140px 200px 1fr auto', gap: 12, alignItems: 'start',
              padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{item.original_filename}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {fmtSize(item.size_bytes)} · {fmtDate(item.created_at)}
              </div>
            </div>

            <select
              value={item.status}
              onChange={e => handleStatusChange(item, e.target.value)}
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <select
              value={item.context_id || ''}
              onChange={e => handleContextChange(item, e.target.value)}
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
            >
              <option value="">Geen context</option>
              {contexts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <textarea
              defaultValue={item.notes || ''}
              placeholder="Extra info / context voor verwerking..."
              onBlur={e => handleNotesBlur(item, e.target.value)}
              style={{
                padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)',
                resize: 'vertical', minHeight: 32, fontFamily: 'inherit',
              }}
            />

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => handleCopyRun(`#${item.id}`)}
                title="Kopieer MindBox.Run(#item) voor dit bestand"
                style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
              >
                ⧉
              </button>
              <button
                onClick={() => downloadItem(item.id, item.original_filename)}
                title="Downloaden"
                style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
              >
                ⬇
              </button>
              <button
                onClick={() => handleDelete(item)}
                title="Verwijderen"
                style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
