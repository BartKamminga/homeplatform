import { useEffect, useRef, useState } from 'react'
import {
  listCases, createCase, updateCase, deleteCase, listCaseEvents, addCaseEvent,
  listItems, uploadItem, updateItem, downloadItem,
  listResponses, createResponse, listContexts,
} from '../api.js'
import { copyText, mindboxRunFileCommand, mindboxRunCaseCommand, fetchMindboxEnv } from '../utils.js'

function fmtDate(iso) {
  return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const EVENT_ICON = {
  upload: '📥', status_change: '🔄', context_linked: '🎭', item_added: '➕',
  item_removed: '➖', response_created: '📝', case_created: '✨', case_renamed: '✏️', session_note: '💬',
}

// Outlook-achtig: linkerkolom = cases (mappen), rechterpaneel = detail van de
// geselecteerde case (items/responses/tijdlijn) - Bart, 2-09-2026.
export default function CasesPage() {
  const [cases, setCases] = useState([])
  const [selected, setSelected] = useState(null)
  const [newCaseName, setNewCaseName] = useState('')
  const [error, setError] = useState('')

  function loadCases() {
    listCases().then(setCases).catch(e => setError(e.message))
  }
  useEffect(() => { loadCases() }, [])

  async function handleCreateCase() {
    if (!newCaseName.trim()) return
    const c = await createCase({ name: newCaseName.trim() })
    setNewCaseName('')
    loadCases()
    setSelected(c)
  }

  async function handleRename(c) {
    const name = window.prompt('Nieuwe naam:', c.name)
    if (!name || name === c.name) return
    await updateCase(c.id, { name })
    loadCases()
    if (selected?.id === c.id) setSelected(s => ({ ...s, name }))
  }

  async function handleDelete(c) {
    if (!window.confirm(`Case "${c.name}" verwijderen? Items/responses blijven bestaan, maar verliezen de koppeling.`)) return
    await deleteCase(c.id)
    if (selected?.id === c.id) setSelected(null)
    loadCases()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
      {/* Linkerkolom: case-lijst ("mappen") */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 6, padding: 10, borderBottom: '1px solid var(--color-border)' }}>
          <input
            value={newCaseName}
            onChange={e => setNewCaseName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateCase()}
            placeholder="Nieuwe case..."
            style={{ flex: 1, padding: '5px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
          />
          <button onClick={handleCreateCase} style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>+</button>
        </div>
        {error && <div style={{ color: 'var(--color-danger)', fontSize: 12, padding: 10 }}>{error}</div>}
        {!cases.length && <div style={{ padding: 16, fontSize: 12, color: 'var(--color-text-muted)' }}>Nog geen cases.</div>}
        {cases.map(c => (
          <div
            key={c.id}
            onClick={() => setSelected(c)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6,
              padding: '9px 12px', cursor: 'pointer', fontSize: 13,
              background: selected?.id === c.id ? 'var(--color-primary-light)' : 'transparent',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📁 {c.name}</span>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <span onClick={e => { e.stopPropagation(); handleRename(c) }} title="Hernoemen" style={{ fontSize: 11, cursor: 'pointer' }}>✎</span>
              <span onClick={e => { e.stopPropagation(); handleDelete(c) }} title="Verwijderen" style={{ fontSize: 11, cursor: 'pointer', color: 'var(--color-danger)' }}>✕</span>
            </div>
          </div>
        ))}
      </div>

      {/* Rechterpaneel: detail van de geselecteerde case */}
      {selected ? (
        <CaseDetail caseObj={selected} onChanged={loadCases} />
      ) : (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Selecteer een case, of maak een nieuwe aan.
        </div>
      )}
    </div>
  )
}

function CaseDetail({ caseObj, onChanged }) {
  const [items, setItems] = useState([])
  const [responses, setResponses] = useState([])
  const [events, setEvents] = useState([])
  const [contexts, setContexts] = useState([])
  const [env, setEnv] = useState('Local')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [copyMsg, setCopyMsg] = useState('')
  const fileInputRef = useRef(null)

  function load() {
    listItems(caseObj.id).then(setItems).catch(() => {})
    listResponses(caseObj.id).then(setResponses).catch(() => {})
    listCaseEvents(caseObj.id).then(setEvents).catch(() => {})
    listContexts().then(setContexts).catch(() => {})
  }
  useEffect(() => { load() }, [caseObj.id])
  useEffect(() => { fetchMindboxEnv().then(setEnv) }, [])

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    try {
      await uploadItem(file, caseObj.id)
      load()
      onChanged()
    } finally {
      setUploading(false)
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    await handleUpload(file)
    e.target.value = ''
  }

  // Bart, item 1051: "ik wil graag bestanden kunnen 'slepen' naar de
  // website, bij de tab bestanden of in de case" - hier direct in de case.
  function handleDragOver(e) {
    e.preventDefault()
    setDragOver(true)
  }
  function handleDragLeave() {
    setDragOver(false)
  }
  async function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    await handleUpload(file)
  }

  async function handleContextChange(item, contextId) {
    if (contextId) await updateItem(item.id, { context_id: contextId })
    else await updateItem(item.id, { clear_context: true })
    load()
  }

  async function handleUnlink(item) {
    await updateItem(item.id, { clear_case: true })
    load()
    onChanged()
  }

  function handleCopy(command) {
    copyText(command)
      .then(() => { setCopyMsg('Gekopieerd!'); setTimeout(() => setCopyMsg(''), 1500) })
      .catch(() => setCopyMsg('Kopiëren mislukt'))
  }

  async function handleAddNote() {
    if (!noteText.trim()) return
    await addCaseEvent(caseObj.id, { event_type: 'session_note', description: noteText.trim() })
    setNoteText('')
    load()
  }

  const emptyResponseForm = { content: '', source_item_ids: [], parent_response_id: '' }
  const [showResponseForm, setShowResponseForm] = useState(false)
  const [responseForm, setResponseForm] = useState(emptyResponseForm)

  function toggleResponseSource(itemId) {
    setResponseForm(f => ({
      ...f,
      source_item_ids: f.source_item_ids.includes(itemId)
        ? f.source_item_ids.filter(x => x !== itemId)
        : [...f.source_item_ids, itemId],
    }))
  }

  async function handleSaveResponse() {
    if (!responseForm.content.trim()) return
    await createResponse(caseObj.id, {
      content: responseForm.content,
      source_item_ids: responseForm.source_item_ids,
      parent_response_id: responseForm.parent_response_id || null,
    })
    setResponseForm(emptyResponseForm)
    setShowResponseForm(false)
    load()
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex', flexDirection: 'column', gap: 16,
        border: dragOver ? '2px dashed var(--color-primary)' : '2px dashed transparent',
        borderRadius: 10, transition: 'border-color 0.1s', padding: dragOver ? 8 : 0, margin: dragOver ? -8 : 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <strong style={{ fontSize: 16 }}>📁 {caseObj.name}</strong>
        <button
          onClick={() => handleCopy(mindboxRunCaseCommand(caseObj.id, env))}
          title="Kopieer commando om alle items in deze case te verwerken"
          style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontFamily: 'monospace' }}
        >
          ⧉ {mindboxRunCaseCommand(caseObj.id, env)}
        </button>
        {copyMsg && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{copyMsg}</span>}
      </div>

      {/* Items in deze case */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)' }}>BESTANDEN ({items.length})</div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ padding: '3px 10px', fontSize: 11, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}
          >
            {uploading ? 'Bezig...' : '+ Toevoegen'}
          </button>
          <input ref={fileInputRef} type="file" onChange={handleFileChange} style={{ display: 'none' }} />
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>of sleep een bestand in dit vlak</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(item => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px auto', gap: 8, alignItems: 'center', padding: '8px 10px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12 }}>
              <span>{item.original_filename} <span style={{ color: 'var(--color-text-muted)' }}>· {item.status}</span></span>
              <select value={item.context_id || ''} onChange={e => handleContextChange(item, e.target.value)} style={{ padding: '3px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)' }}>
                <option value="">Geen context</option>
                {contexts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => handleCopy(mindboxRunFileCommand(item.id, env))} title="Kopieer commando voor dit bestand" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>⧉</button>
                <button onClick={() => downloadItem(item.id, item.original_filename)} title="Downloaden" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>⬇</button>
                <button onClick={() => handleUnlink(item)} title="Loskoppelen van deze case" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>⤫</button>
              </div>
            </div>
          ))}
          {!items.length && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Nog geen bestanden in deze case.</div>}
        </div>
      </section>

      {/* Responses in deze case (item 1051: altijd case-gescoped, geen losse Responses-tab meer) */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)' }}>RESPONSES ({responses.length})</div>
          <button
            onClick={() => { setShowResponseForm(s => !s); setResponseForm(emptyResponseForm) }}
            style={{ padding: '3px 10px', fontSize: 11, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}
          >
            + Nieuwe response
          </button>
        </div>
        {showResponseForm && (
          <div style={{ padding: 10, marginBottom: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              value={responseForm.content}
              onChange={e => setResponseForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Inhoud van de response..."
              style={{ padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', minHeight: 80, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>BRONNEN</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.map(i => (
                  <label key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 99, cursor: 'pointer' }}>
                    <input type="checkbox" checked={responseForm.source_item_ids.includes(i.id)} onChange={() => toggleResponseSource(i.id)} />
                    {i.original_filename}
                  </label>
                ))}
                {!items.length && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Nog geen bestanden in deze case om als bron te koppelen.</span>}
              </div>
            </div>
            {!!responses.length && (
              <select
                value={responseForm.parent_response_id}
                onChange={e => setResponseForm(f => ({ ...f, parent_response_id: e.target.value }))}
                style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--color-border)' }}
              >
                <option value="">Geen opvolging (nieuwe response)</option>
                {responses.map(r => (
                  <option key={r.id} value={r.id}>Opvolging op: {r.content.slice(0, 60)}...</option>
                ))}
              </select>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowResponseForm(false)} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>Annuleren</button>
              <button onClick={handleSaveResponse} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>Opslaan</button>
            </div>
          </div>
        )}
        {responses.map(r => (
          <div key={r.id} style={{ padding: 8, fontSize: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, marginBottom: 6, whiteSpace: 'pre-wrap' }}>
            {r.content}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4, fontSize: 10, color: 'var(--color-text-muted)' }}>
              <span>{fmtDate(r.created_at)}</span>
              {r.source_item_ids.map(id => {
                const source = items.find(i => i.id === id)
                return <span key={id} style={{ padding: '1px 6px', border: '1px solid var(--color-border)', borderRadius: 99 }}>📎 {source?.original_filename || id}</span>
              })}
              {r.parent_response_id && <span style={{ fontStyle: 'italic' }}>↳ vervolg op een eerdere response</span>}
            </div>
          </div>
        ))}
        {!responses.length && !showResponseForm && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Nog geen responses in deze case.</div>}
      </section>

      {/* Tijdlijn */}
      <section>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8 }}>TIJDLIJN</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddNote()}
            placeholder="Sessie-notitie toevoegen (bv. samenvatting van een Claude Code-sessie)..."
            style={{ flex: 1, padding: '5px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
          />
          <button onClick={handleAddNote} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>Toevoegen</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {events.map(e => (
            <div key={e.id} style={{ fontSize: 12, display: 'flex', gap: 8, padding: '4px 0' }}>
              <span>{EVENT_ICON[e.event_type] || '•'}</span>
              <span style={{ flex: 1 }}>{e.description}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{fmtDate(e.created_at)}</span>
            </div>
          ))}
          {!events.length && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Nog geen activiteit.</div>}
        </div>
      </section>
    </div>
  )
}
