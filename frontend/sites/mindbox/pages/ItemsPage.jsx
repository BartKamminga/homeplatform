import { useEffect, useRef, useState } from 'react'
import { listItems, uploadItem, updateItem, deleteItem, downloadItem, listCases, createCase, listContacts, unlinkItemContact } from '../api.js'
import { copyText, mindboxRunAllCommand, mindboxFileEnhanceCommand, mindboxFileParseToTekstCommand, mindboxFileExtractAttachmentsCommand, fetchMindboxEnv } from '../utils.js'
import { ConfirmDialog, useConfirm } from '@components/ConfirmDialog.jsx'

const NEW_CASE_SENTINEL = '__new__'

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

export default function ItemsPage({ onGoToExisting }) {
  const [items, setItems] = useState([])
  const [cases, setCases] = useState([])
  const [contacts, setContacts] = useState([])
  const [env, setEnv] = useState('Local')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [expandedParsedId, setExpandedParsedId] = useState(null)
  const [expandedAttachmentsId, setExpandedAttachmentsId] = useState(null)
  const fileInputRef = useRef(null)
  const [confirmAction, confirmDialog] = useConfirm()

  function load() {
    listItems().then(setItems).catch(e => setError(e.message))
  }
  useEffect(() => {
    load()
    listCases().then(setCases).catch(() => {})
    listContacts().then(setContacts).catch(() => {})
    fetchMindboxEnv().then(setEnv)
  }, [])

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const item = await uploadItem(file)
      if (item.suggested_case_id) {
        // Item 1051 (Bart): "bestanden die mogelijk bij een case horen (RE:
        // bestanden uit de mail) of erg op elkaar lijken... als voorstel
        // meteen koppelen aan een case (wel met extra bevestiging)" - puur
        // een suggestie, nooit automatisch koppelen.
        const link = await confirmAction(
          `Dit bestand lijkt gerelateerd aan case "${item.suggested_case_name}" - koppelen?`
        )
        if (link) await updateItem(item.id, { case_id: item.suggested_case_id })
      }
      load()
    } catch (err) {
      if (err.status === 409 && err.extra) {
        await handleDuplicate(file, err.extra)
      } else {
        setError(err.message)
      }
    } finally {
      setUploading(false)
    }
  }

  // Item 1051 (Bart): "graag een melding geven direct na de upload met de
  // vraag wat te doen" - annuleren + naar het bestaande bestand/case, of
  // toch uploaden als kopie (backend ontdubbelt dan de bestandsnaam).
  // Directe <ConfirmDialog> i.p.v. useConfirm() omdat dit geen generieke
  // Ja/Nee-vraag is maar 2 specifieke acties nodig heeft.
  const [duplicatePrompt, setDuplicatePrompt] = useState(null) // { file, existing }

  function handleDuplicate(file, existing) {
    setDuplicatePrompt({ file, existing })
  }

  async function handleDuplicateUploadAnyway() {
    const { file } = duplicatePrompt
    setDuplicatePrompt(null)
    try {
      await uploadItem(file, undefined, true)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleDuplicateGoToExisting() {
    onGoToExisting?.(duplicatePrompt.existing)
    setDuplicatePrompt(null)
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    await handleUpload(file)
    e.target.value = ''
  }

  // Bart, item 1051: "ik wil graag bestanden kunnen 'slepen' naar de
  // website, bij de tab bestanden of in de case" - drag-and-drop naast de
  // bestaande file-picker-knop, geen vervanging.
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

  async function handleStatusChange(item, status) {
    await updateItem(item.id, { status })
    load()
  }

  // Bart, item 1051: "ik kan bij een net geuploade file niet direct een
  // case selecteren" - case-koppeling nu ook los, direct in de vlakke
  // bestandenlijst mogelijk (niet alleen vanuit CaseDetail).
  async function handleCaseChange(item, caseId) {
    if (caseId === NEW_CASE_SENTINEL) {
      // Bart: "of een nieuwe case aanmaken, en koppelen" - in 1 stap vanuit
      // de vlakke bestandenlijst, zonder eerst naar de Cases-tab te gaan.
      const name = window.prompt('Naam van de nieuwe case:')
      if (!name?.trim()) return
      const created = await createCase({ name: name.trim() })
      await updateItem(item.id, { case_id: created.id })
      listCases().then(setCases).catch(() => {})
    } else if (caseId) {
      await updateItem(item.id, { case_id: caseId })
    } else {
      await updateItem(item.id, { clear_case: true })
    }
    load()
  }

  async function handleNotesBlur(item, notes) {
    if (notes === (item.notes || '')) return
    await updateItem(item.id, { notes })
    load()
  }

  async function handleDelete(item) {
    if (!(await confirmAction(`"${item.original_filename}" verwijderen?`))) return
    await deleteItem(item.id)
    load()
  }

  // Fase 2 (item 1050, Bart 2-09-2026: "net als in de admin roadmap, de
  // mogelijkheid om de commando's voor het verwerken meteen te kunnen
  // kopiëren") - MindBox.Run bestaat nog niet als echt commando, maar de
  // exacte, kopieerbare aanroep alvast klaarzetten kost niets en bereidt de
  // workflow voor.
  const [copyMsg, setCopyMsg] = useState('')
  function handleCopy(command) {
    copyText(command)
      .then(() => { setCopyMsg('Gekopieerd!'); setTimeout(() => setCopyMsg(''), 1500) })
      .catch(() => setCopyMsg('Kopiëren mislukt'))
  }

  // Bijlagen (item 1051) zijn gewone items met parent_item_id - client-side
  // gegroepeerd uit dezelfde al-opgehaalde lijst, geen extra request nodig.
  function attachmentsOf(itemId) {
    return items.filter(i => i.parent_item_id === itemId)
  }

  // Item 1052: contact-koppeling gebeurt via MindBox.ps1 -Contact (find-or-
  // create op e-mailadres) - hier alleen tonen wie er al gekoppeld is. Een
  // mail heeft vaak meerdere deelnemers (afzender/to/cc), dus many-to-many.
  function contactsOf(item) {
    return contacts.filter(c => item.contact_ids?.includes(c.id))
  }

  async function handleUnlinkContact(item, contactId) {
    await unlinkItemContact(item.id, contactId)
    load()
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: dragOver ? '2px dashed var(--color-primary)' : '2px dashed transparent',
        borderRadius: 10, transition: 'border-color 0.1s', padding: dragOver ? 8 : 0, margin: dragOver ? -8 : 0,
      }}
    >
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
          .msg, .doc(x), .xls(x), .ppt(x), .pdf, .txt, .csv — max 25MB, of sleep een bestand hierheen
        </span>
        {!!items.length && (
          <button
            onClick={() => handleCopy(mindboxRunAllCommand(env))}
            title="Kopieer commando om alle bestanden te verwerken"
            style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 11, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontFamily: 'monospace' }}
          >
            ⧉ {mindboxRunAllCommand(env)}
          </button>
        )}
        {copyMsg && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{copyMsg}</span>}
      </div>

      {error && <div style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {!items.length && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Nog geen bestanden geüpload. Sleep een bestand hierheen, of gebruik de knop hierboven.
        </div>
      )}

      {/* Bijlagen (item 1051) staan NIET los in de vlakke lijst - ze horen
          bij hun ouder-item en worden daar uitklapbaar getoond. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.filter(item => !item.parent_item_id).map(item => (
          <div key={item.id}>
          <div
            style={{
              display: 'grid', gridTemplateColumns: '1fr 130px 160px 1fr auto', gap: 12, alignItems: 'start',
              padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: (expandedParsedId === item.id || expandedAttachmentsId === item.id) ? '8px 8px 0 0' : 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{item.original_filename}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {fmtSize(item.size_bytes)} · {fmtDate(item.created_at)}
              </div>
              {!!contactsOf(item).length && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {contactsOf(item).map(c => (
                    <span key={c.id} title={c.email} style={{ marginRight: 6 }}>
                      👤 {c.display_name || c.email}
                      <span onClick={() => handleUnlinkContact(item, c.id)} title="Loskoppelen" style={{ marginLeft: 3, cursor: 'pointer' }}>✕</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <select
              value={item.status}
              onChange={e => handleStatusChange(item, e.target.value)}
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {/* Item 1051 (Bart): eenmaal gekoppeld aan een case is
                      "Nieuw" niet meer accuraat - het is dan al getriaged. */}
                  {o.value === 'new' && item.case_id ? 'Gekoppeld' : o.label}
                </option>
              ))}
            </select>

            <select
              value={item.case_id || ''}
              onChange={e => handleCaseChange(item, e.target.value)}
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
            >
              <option value="">Geen case</option>
              {cases.map(c => <option key={c.id} value={c.id}>📁 {c.name}</option>)}
              <option value={NEW_CASE_SENTINEL}>+ Nieuwe case...</option>
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
                onClick={() => handleCopy(mindboxFileEnhanceCommand(item.id, env))}
                title="Kopieer commando om extra info aan dit bestand toe te voegen"
                style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
              >
                ⧉
              </button>
              <button
                onClick={() => handleCopy(mindboxFileParseToTekstCommand(item.id, env))}
                title="Kopieer commando om de tekst van dit bestand te laten extraheren"
                style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
              >
                🔎
              </button>
              <button
                onClick={() => handleCopy(mindboxFileExtractAttachmentsCommand(item.id, env))}
                title="Kopieer commando om bijlagen uit dit bestand te extraheren"
                style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
              >
                📎
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
                disabled={!!item.case_id}
                title={item.case_id ? 'Gekoppeld aan een case - ontkoppel eerst (in de case) om te kunnen verwijderen' : 'Verwijderen'}
                style={{
                  padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent',
                  color: item.case_id ? 'var(--color-text-muted)' : 'var(--color-danger)',
                  cursor: item.case_id ? 'not-allowed' : 'pointer', opacity: item.case_id ? 0.5 : 1,
                }}
              >
                ✕
              </button>
              {item.parsed_text && (
                <button
                  onClick={() => setExpandedParsedId(id => id === item.id ? null : item.id)}
                  title="Geparste tekst tonen/verbergen"
                  style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
                >
                  {expandedParsedId === item.id ? '▲' : '▼'}
                </button>
              )}
              {!!attachmentsOf(item.id).length && (
                <button
                  onClick={() => setExpandedAttachmentsId(id => id === item.id ? null : item.id)}
                  title="Bijlagen tonen/verbergen"
                  style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
                >
                  📎 {attachmentsOf(item.id).length}
                </button>
              )}
            </div>
          </div>
          {expandedParsedId === item.id && item.parsed_text && (
            <div style={{
              padding: '10px 16px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderTop: 'none',
              borderRadius: '0 0 8px 8px', fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--color-text-muted)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>GEPARSTE TEKST VAN HET BESTAND</div>
              {item.parsed_text}
            </div>
          )}
          {expandedAttachmentsId === item.id && !!attachmentsOf(item.id).length && (
            <div style={{
              padding: '10px 16px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderTop: 'none',
              borderRadius: '0 0 8px 8px', fontSize: 12,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, color: 'var(--color-text-muted)' }}>BIJLAGEN</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {attachmentsOf(item.id).map(att => (
                  <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📎 {att.original_filename}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{fmtSize(att.size_bytes)}</span>
                    <button
                      onClick={() => downloadItem(att.id, att.original_filename)}
                      title="Downloaden"
                      style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
                    >
                      ⬇
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        ))}
      </div>

      {confirmDialog}
      <ConfirmDialog
        open={!!duplicatePrompt}
        confirmLabel="Toch uploaden"
        cancelLabel="Naar bestaand bestand"
        danger={false}
        onConfirm={handleDuplicateUploadAnyway}
        onCancel={handleDuplicateGoToExisting}
      >
        {duplicatePrompt && (
          <>Dit bestand is al eerder geupload als "{duplicatePrompt.existing.original_filename}".</>
        )}
      </ConfirmDialog>
    </div>
  )
}
