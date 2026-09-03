import { useEffect, useRef, useState } from 'react'
import {
  listCases, createCase, updateCase, deleteCase, listCaseEvents, addCaseEvent,
  listItems, uploadItem, updateItem, downloadItem, unlinkItemCase, exportCase,
  unlinkItems, linkItems, exportEmail,
  listContexts, listContacts, listCommands,
} from '../api.js'
import { fetchMindboxEnv } from '../utils.js'
import { ConfirmDialog, useConfirm } from '@components/ConfirmDialog.jsx'
import Modal from '@components/Modal.jsx'
import RelationsGraph from './RelationsGraph.jsx'
import CommandPicker from '../components/CommandPicker.jsx'
import ImageThumbnail, { hasThumbnail } from '../components/ImageThumbnail.jsx'

const CUSTOM_LINK_TYPE_SENTINEL = '__custom__'

// Item 1058 (vervolg, Bart): "de website krijgt een generieke oplossing door
// een nieuw MindBoxItem aan te maken van het type txt en een linktype te
// kiezen" - vaste, herkenbare types + vrije "anders...", zelfde lijst als
// ItemsPage.jsx/RelationsGraph.jsx.
const LINK_TYPE_OPTIONS = [
  { value: 'related_to', label: 'gerelateerd aan' },
  { value: 'duplicate_of', label: 'duplicaat van' },
  { value: 'source_of', label: 'bron van' },
  { value: 'reply_to', label: 'vervolg op' },
]

function fmtDate(iso) {
  return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'Nieuw' },
  { value: 'in_progress', label: 'In behandeling' },
  { value: 'done', label: 'Afgerond' },
]

// Kleine kleur-stip voor de case-lijst - status in 1 oogopslag zichtbaar
// zonder een case te hoeven openen (Bart: "graag de status van een case
// laten zien in de frontend caseslist").
const STATUS_DOT_COLOR = {
  new: 'var(--color-text-light)',
  in_progress: 'var(--color-warning)',
  done: 'var(--color-success)',
}

const EVENT_ICON = {
  upload: '📥', status_change: '🔄', context_linked: '🎭', item_added: '➕',
  item_removed: '➖', item_parsed: '🔎', response_created: '📝', response_edited: '✏️', response_sent: '✅', case_created: '✨', case_renamed: '✏️', session_note: '💬',
}

// Outlook-achtig: linkerkolom = cases (mappen), rechterpaneel = detail van de
// geselecteerde case (bestanden/tijdlijn) - Bart, 2-09-2026.
export default function CasesPage({ focusCaseId, onConsumeFocus, onGoToExisting }) {
  const [cases, setCases] = useState([])
  const [selected, setSelected] = useState(null)
  const [newCaseName, setNewCaseName] = useState('')
  const [error, setError] = useState('')
  const [confirmAction, confirmDialog] = useConfirm()

  function loadCases() {
    listCases().then(setCases).catch(e => setError(e.message))
  }
  useEffect(() => { loadCases() }, [])

  // Item 1051: bij een duplicaat-upload elders (Bestanden-tab of een andere
  // case) kan de gebruiker naar de case van het bestaande bestand gestuurd
  // worden - hier automatisch selecteren zodra de caselijst geladen is.
  useEffect(() => {
    if (!focusCaseId) return
    const match = cases.find(c => c.id === focusCaseId)
    if (match) {
      setSelected(match)
      onConsumeFocus?.()
    }
  }, [focusCaseId, cases])

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
    if (!(await confirmAction(`Case "${c.name}" verwijderen? Bestanden blijven bestaan, alleen de koppeling met deze case verdwijnt.`))) return
    await deleteCase(c.id)
    if (selected?.id === c.id) setSelected(null)
    loadCases()
  }

  // CaseDetail geeft (optioneel) de bijgewerkte case terug, bv. na een
  // context-wijziging - hou `selected` synchroon zodat de detail-pane niet
  // stale blijft (zelfde probleem als bij handleRename hierboven).
  function handleCaseChanged(updatedCase) {
    loadCases()
    if (updatedCase && selected?.id === updatedCase.id) setSelected(updatedCase)
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
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
              <span
                title={STATUS_OPTIONS.find(o => o.value === c.status)?.label || c.status}
                style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: STATUS_DOT_COLOR[c.status] || STATUS_DOT_COLOR.new,
                }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📁 {c.name}</span>
            </span>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <span onClick={e => { e.stopPropagation(); handleRename(c) }} title="Hernoemen" style={{ fontSize: 11, cursor: 'pointer' }}>✎</span>
              <span onClick={e => { e.stopPropagation(); handleDelete(c) }} title="Verwijderen" style={{ fontSize: 11, cursor: 'pointer', color: 'var(--color-danger)' }}>✕</span>
            </div>
          </div>
        ))}
      </div>

      {/* Rechterpaneel: detail van de geselecteerde case */}
      {selected ? (
        <CaseDetail caseObj={selected} onChanged={handleCaseChanged} onGoToExisting={onGoToExisting} />
      ) : (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Selecteer een case, of maak een nieuwe aan.
        </div>
      )}
      {confirmDialog}
    </div>
  )
}

function CaseDetail({ caseObj, onChanged, onGoToExisting }) {
  const [items, setItems] = useState([])
  const [events, setEvents] = useState([])
  const [contexts, setContexts] = useState([])
  const [contacts, setContacts] = useState([])
  const [commands, setCommands] = useState([])
  const [env, setEnv] = useState('Local')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [error, setError] = useState('')
  const [expandedParsedId, setExpandedParsedId] = useState(null)
  const [expandedAttachmentsId, setExpandedAttachmentsId] = useState(null)
  const [expandedLinksId, setExpandedLinksId] = useState(null)
  const [showGraph, setShowGraph] = useState(false)
  const fileInputRef = useRef(null)
  const [confirmAction, confirmDialog] = useConfirm()

  function load() {
    // Item 1058 (vervolg): geen apart "response"-concept meer - elk
    // gegenereerd tekstbestand is gewoon een MindboxItem en verschijnt
    // gewoon tussen de andere bestanden (herkenbaar aan text_content).
    listItems(caseObj.id).then(setItems).catch(() => {})
    listCaseEvents(caseObj.id).then(setEvents).catch(() => {})
    listContexts().then(setContexts).catch(() => {})
    listContacts().then(setContacts).catch(() => {})
  }

  // Item 1052 (Bart): "kan ik zien welke contacten met een case te maken
  // hebben?" - afgeleid uit de al-opgehaalde items van deze case, geen
  // apart endpoint nodig.
  const caseContacts = contacts.filter(c => items.some(i => i.contact_ids?.includes(c.id)))
  useEffect(() => { load() }, [caseObj.id])
  useEffect(() => {
    fetchMindboxEnv().then(setEnv)
    listCommands().then(setCommands).catch(() => {})
  }, [])

  // Item 1053: commando's uit de backend-catalogus i.p.v. hardcoded functies.
  // Item 1055 (Bart): "ik zie niet alle case gebonden commando's bovenin
  // staan, ik verwacht daar de lijst uit de commando's te zien" - i.p.v. een
  // vaste findCommand()-lookup per notation_key, itereren over ALLE
  // commando's met het juiste entity zodat nieuw aangemaakte Case.*/File.*
  // commando's hier automatisch verschijnen. EERSTE fix filterde op
  // param_kind==='id', maar Case.Save/Case.Load/Case.CreateFromDisk nemen
  // juist de case-NAAM als param (param_kind==='name') - die bleven dus
  // alsnog onzichtbaar. Nu alle entity==='Case'-commando's tonen, met het
  // juiste param per param_kind (caseObj.name i.p.v. caseObj.id).
  const caseCommands = commands.filter(c => c.entity === 'Case')
  const fileCommands = commands.filter(c => c.entity === 'File' && c.param_kind === 'id')

  function caseCommandParam(command) {
    return command.param_kind === 'name' ? caseObj.name : caseObj.id
  }

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      await uploadItem(file, caseObj.id)
      load()
      onChanged()
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
  // toch uploaden als kopie in deze case (backend ontdubbelt de naam).
  const [duplicatePrompt, setDuplicatePrompt] = useState(null) // { file, existing }

  function handleDuplicate(file, existing) {
    setDuplicatePrompt({ file, existing })
  }

  async function handleDuplicateUploadAnyway() {
    const { file } = duplicatePrompt
    setDuplicatePrompt(null)
    try {
      await uploadItem(file, caseObj.id, true)
      load()
      onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleDuplicateGoToExisting() {
    const { existing } = duplicatePrompt
    setDuplicatePrompt(null)
    if (!existing.case_ids?.includes(caseObj.id)) onGoToExisting?.(existing)
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

  // Item 1051 (Bart): "ik wil toch per case een context, niet per bestand"
  // - context zit op de HELE case, niet meer per item.
  async function handleCaseContextChange(contextId) {
    const updated = contextId
      ? await updateCase(caseObj.id, { context_id: contextId })
      : await updateCase(caseObj.id, { clear_context: true })
    onChanged(updated)
  }

  async function handleCaseStatusChange(status) {
    const updated = await updateCase(caseObj.id, { status })
    onChanged(updated)
  }

  async function handleCaseDescriptionBlur(description) {
    if (description === (caseObj.description || '')) return
    const updated = await updateCase(caseObj.id, { description })
    onChanged(updated)
  }

  async function handleUnlink(item) {
    if (!(await confirmAction(`"${item.original_filename}" loskoppelen van deze case?`))) return
    await unlinkItemCase(item.id, caseObj.id)
    load()
    onChanged()
  }

  // Bart: "ik kan de extra info bij een bestand dat is gekoppeld aan een
  // case niet meer editen/bekijken als ik in een case zit" - notities waren
  // hier nooit zichtbaar/bewerkbaar (alleen op de vlakke Bestanden-tab).
  async function handleItemNotesBlur(item, notes) {
    if (notes === (item.notes || '')) return
    await updateItem(item.id, { notes })
    load()
  }

  // Bijlagen (item 1051) zijn gewone items met parent_item_id - client-side
  // gegroepeerd uit dezelfde al-opgehaalde lijst, geen extra request nodig.
  function attachmentsOf(itemId) {
    return items.filter(i => i.parent_item_id === itemId)
  }

  // Item 1068 (vervolg, Bart): "die zie ik niet terug" - een bijlage die (via
  // duplicaat-hergebruik, zie save_upload) ook aan DEZE case hangt maar wiens
  // ouder-mailtje niet in DEZE case zit, moet gewoon als eigen rij getoond
  // worden i.p.v. stilzwijgend te verdwijnen (was: alles met parent_item_id
  // verbergen, ongeacht of die ouder hier uberhaupt zichtbaar is om 'm onder
  // te nesten).
  function isTopLevelInThisCase(item) {
    return !item.parent_item_id || !items.some(i => i.id === item.parent_item_id)
  }

  // Item 1058 (vervolg): generieke item<->item-relaties, het andere item
  // resolven uit de al-opgehaalde `items` van deze case (zelfde patroon als
  // attachmentsOf hierboven en ItemsPage.jsx's linksOf).
  function linksOf(item) {
    return (item.links || []).map(l => ({ ...l, other: items.find(i => i.id === l.item_id) }))
  }

  function toggleLinksPanel(itemId) {
    setExpandedLinksId(id => (id === itemId ? null : itemId))
  }

  async function handleUnlinkItems(linkId) {
    await unlinkItems(linkId)
    load()
  }

  async function handleAddNote() {
    if (!noteText.trim()) return
    await addCaseEvent(caseObj.id, { event_type: 'session_note', description: noteText.trim() })
    setNoteText('')
    load()
  }

  // Item 1058 (vervolg, Bart): "de website krijgt een generieke oplossing
  // door een nieuw MindBoxItem aan te maken van het type txt en een
  // linktype te kiezen" - geen los "response"-endpoint meer: getypte tekst
  // wordt client-side een Blob en gaat door dezelfde upload-route als elk
  // ander bestand (save_upload vult text_content automatisch voor .txt).
  // Bart: de oude "BRONNEN"-checkboxlijst (meerdere bestanden in 1 keer
  // aanvinken) was nuttig - dat patroon blijft, alleen generiek (niet meer
  // response-specifiek) en met een vrij te kiezen link_type voor alle
  // aangevinkte bestanden samen.
  const emptyTextForm = { content: '', filename: '', linkTargetIds: [], linkType: '', linkTypeCustom: '' }
  const [showTextForm, setShowTextForm] = useState(false)
  const [textForm, setTextForm] = useState(emptyTextForm)

  function toggleTextFormLink(itemId) {
    setTextForm(f => ({
      ...f,
      linkTargetIds: f.linkTargetIds.includes(itemId)
        ? f.linkTargetIds.filter(id => id !== itemId)
        : [...f.linkTargetIds, itemId],
    }))
  }

  async function handleCreateTextItem() {
    if (!textForm.content.trim()) return
    const stem = textForm.filename.trim() || 'notitie'
    const filename = stem.toLowerCase().endsWith('.txt') ? stem : `${stem}.txt`
    const file = new File([textForm.content], filename, { type: 'text/plain' })
    const linkType = textForm.linkType === CUSTOM_LINK_TYPE_SENTINEL ? textForm.linkTypeCustom.trim() : textForm.linkType
    const item = await uploadItem(file, caseObj.id)
    if (textForm.linkTargetIds.length && linkType) {
      for (const targetId of textForm.linkTargetIds) {
        await linkItems(item.id, targetId, linkType)
      }
    }
    setTextForm(emptyTextForm)
    setShowTextForm(false)
    load()
    onChanged()
  }

  const [editingTextId, setEditingTextId] = useState(null)
  const [editingText, setEditingText] = useState('')

  function startEditText(item) {
    setEditingTextId(item.id)
    setEditingText(item.text_content || '')
  }

  async function saveEditedText(item) {
    if (!editingText.trim()) return
    await updateItem(item.id, { text_content: editingText })
    setEditingTextId(null)
    load()
  }

  // Item 1058 (vervolg): het .eml-ready-voor-verzending-formaat is een
  // losse, expliciete exportactie op elk tekstitem (backend logt
  // "response_sent" als side-effect).
  async function handleExportEmail(item) {
    await exportEmail(item.id, caseObj.id, item.original_filename.replace(/\.[^.]+$/, '.eml'))
    load()  // tijdlijn verversen na de "response_sent"-event
  }

  // Item 1058 (Bart): case + context + contacten + tijdlijn als 1 lokaal
  // bestand kunnen downloaden, analoog aan de item-briefing.md.
  async function handleExportCase() {
    const item = await exportCase(caseObj.id)
    await downloadItem(item.id, item.original_filename)
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
      {/* Panel 1: echte applicatie-knoppen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 16 }}>📁 {caseObj.name}</strong>
        <button
          onClick={handleExportCase}
          title="Case + context + contacten + tijdlijn downloaden als 1 bestand"
          style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
        >
          📄 Exporteren
        </button>
        <button
          onClick={() => setShowGraph(true)}
          title="Relaties tussen bestanden in deze case bekijken en aanmaken"
          style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
        >
          🔗 Relatie-graph
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <select
            value={caseObj.status}
            onChange={e => handleCaseStatusChange(e.target.value)}
            style={{ padding: '3px 6px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>🎭 Context:</span>
          <select
            value={caseObj.context_id || ''}
            onChange={e => handleCaseContextChange(e.target.value)}
            style={{ padding: '3px 6px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
          >
            <option value="">Geen context</option>
            {contexts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Panel 2: terminal-commando kiezen (item 1055, vervolg) - 1 dropdown
          i.p.v. een pill per case-commando naast de echte knoppen hierboven. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4, borderTop: '1px solid var(--color-border)' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Terminal-commando:</span>
        <CommandPicker commands={caseCommands} param={caseCommandParam} env={env} />
      </div>

      <textarea
        key={caseObj.id}
        defaultValue={caseObj.description || ''}
        placeholder="Omschrijving van deze case..."
        onBlur={e => handleCaseDescriptionBlur(e.target.value)}
        style={{
          padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)',
          resize: 'vertical', minHeight: 40, fontFamily: 'inherit',
        }}
      />

      {error && <div style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</div>}

      {/* Contacten (item 1052): afgeleid uit welke items in deze case aan een
          contact gekoppeld zijn. */}
      {!!caseContacts.length && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)' }}>CONTACTEN:</span>
          {caseContacts.map(c => (
            <span key={c.id} style={{ padding: '2px 8px', fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 99 }}>
              👤 {c.display_name || c.email}
            </span>
          ))}
        </div>
      )}

      {/* Items in deze case */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)' }}>BESTANDEN ({items.filter(isTopLevelInThisCase).length})</div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ padding: '3px 10px', fontSize: 11, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}
          >
            {uploading ? 'Bezig...' : '+ Toevoegen'}
          </button>
          <input ref={fileInputRef} type="file" onChange={handleFileChange} style={{ display: 'none' }} />
          <button
            onClick={() => { setShowTextForm(s => !s); setTextForm(emptyTextForm) }}
            style={{ padding: '3px 10px', fontSize: 11, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
          >
            + Tekst document
          </button>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>of sleep een bestand in dit vlak</span>
        </div>
        {showTextForm && (
          <div style={{ padding: 10, marginBottom: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              value={textForm.content}
              onChange={e => setTextForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Inhoud (bv. een concept-antwoord, plan of samenvatting)..."
              style={{ padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', minHeight: 80, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <input
              value={textForm.filename}
              onChange={e => setTextForm(f => ({ ...f, filename: e.target.value }))}
              placeholder="Bestandsnaam (optioneel, bv. plan.txt)"
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
            />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>RELATIES (optioneel)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.map(i => (
                  <label key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 99, cursor: 'pointer' }}>
                    <input type="checkbox" checked={textForm.linkTargetIds.includes(i.id)} onChange={() => toggleTextFormLink(i.id)} />
                    {i.original_filename}
                  </label>
                ))}
                {!items.length && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Nog geen bestanden in deze case om een relatie mee te leggen.</span>}
              </div>
            </div>
            {!!textForm.linkTargetIds.length && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={textForm.linkType}
                  onChange={e => setTextForm(f => ({ ...f, linkType: e.target.value }))}
                  style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
                >
                  <option value="">Link-type voor alle aangevinkte bestanden...</option>
                  {LINK_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  <option value={CUSTOM_LINK_TYPE_SENTINEL}>anders...</option>
                </select>
                {textForm.linkType === CUSTOM_LINK_TYPE_SENTINEL && (
                  <input
                    value={textForm.linkTypeCustom}
                    onChange={e => setTextForm(f => ({ ...f, linkTypeCustom: e.target.value }))}
                    placeholder="eigen link-type"
                    style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
                  />
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTextForm(false)} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>Annuleren</button>
              <button onClick={handleCreateTextItem} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>Opslaan</button>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.filter(isTopLevelInThisCase).map(item => (
            <div key={item.id}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center', padding: '8px 10px',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: 12,
              borderRadius: (expandedParsedId === item.id || expandedAttachmentsId === item.id || expandedLinksId === item.id || editingTextId === item.id) ? '6px 6px 0 0' : 6,
            }}>
              <span>
                {item.text_content != null && <span title="Tekstbestand (bewerkbaar)" style={{ marginRight: 4 }}>📝</span>}
                {item.parsed_text != null && <span title="Tekst automatisch geextraheerd - klik op 🔎 om te bekijken" style={{ marginRight: 4 }}>🔎</span>}
                {item.original_filename} <span style={{ color: 'var(--color-text-muted)' }}>· {item.status}</span>
                {hasThumbnail(item) && <ImageThumbnail item={item} />}
              </span>
              <textarea
                defaultValue={item.notes || ''}
                placeholder="Extra info / context voor verwerking..."
                onBlur={e => handleItemNotesBlur(item, e.target.value)}
                style={{
                  padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)',
                  resize: 'vertical', minHeight: 28, fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                {/* Panel 1: echte applicatie-knoppen */}
                <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => downloadItem(item.id, item.original_filename)} title="Downloaden" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>⬇</button>
                <button onClick={() => handleUnlink(item)} title="Loskoppelen van deze case" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>⤫</button>
                {item.text_content != null && (
                  <>
                    <button onClick={() => startEditText(item)} title="Bewerken" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>✎</button>
                    <button onClick={() => handleExportEmail(item)} title="Exporteer als .eml, klaar voor verzending" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>✉️</button>
                  </>
                )}
                {item.parsed_text && (
                  <button onClick={() => setExpandedParsedId(id => id === item.id ? null : item.id)} title="Automatisch geextraheerde tekst tonen/verbergen" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>
                    🔎 {expandedParsedId === item.id ? '▲' : '▼'}
                  </button>
                )}
                {!!attachmentsOf(item.id).length && (
                  <button onClick={() => setExpandedAttachmentsId(id => id === item.id ? null : item.id)} title="Bijlagen tonen/verbergen" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>
                    📎 {attachmentsOf(item.id).length}
                  </button>
                )}
                <button onClick={() => toggleLinksPanel(item.id)} title="Relaties met andere bestanden tonen/bewerken" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>
                  🔗{linksOf(item).length ? ` ${linksOf(item).length}` : ''}
                </button>
                </div>
                {/* Panel 2: terminal-commando kiezen */}
                {!!fileCommands.length && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', paddingTop: 4, borderTop: '1px solid var(--color-border)' }}>
                    <CommandPicker commands={fileCommands} param={item.id} env={env} />
                  </div>
                )}
              </div>
            </div>
            {expandedParsedId === item.id && item.parsed_text && (
              <div style={{
                padding: '8px 10px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderTop: 'none',
                borderRadius: '0 0 6px 6px', fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--color-text-muted)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>GEPARSTE TEKST VAN HET BESTAND</div>
                {item.parsed_text}
              </div>
            )}
            {editingTextId === item.id && (
              <div style={{
                padding: '8px 10px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderTop: 'none',
                borderRadius: '0 0 6px 6px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <textarea
                  value={editingText}
                  onChange={e => setEditingText(e.target.value)}
                  style={{ padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', minHeight: 80, fontFamily: 'inherit', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingTextId(null)} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>Annuleren</button>
                  <button onClick={() => saveEditedText(item)} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>Opslaan</button>
                </div>
              </div>
            )}
            {expandedAttachmentsId === item.id && !!attachmentsOf(item.id).length && (
              <div style={{
                padding: '8px 10px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderTop: 'none',
                borderRadius: '0 0 6px 6px', fontSize: 12,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, color: 'var(--color-text-muted)' }}>BIJLAGEN</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {attachmentsOf(item.id).map(att => (
                    <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>📎 {att.original_filename}</span>
                      <button onClick={() => downloadItem(att.id, att.original_filename)} title="Downloaden" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>⬇</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {expandedLinksId === item.id && (
              <div style={{
                padding: '8px 10px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderTop: 'none',
                borderRadius: '0 0 6px 6px', fontSize: 12,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, color: 'var(--color-text-muted)' }}>RELATIES MET ANDERE BESTANDEN</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {linksOf(item).map(l => (
                    <span key={l.link_id} style={{ padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 99 }}>
                      {l.direction === 'out' ? '→' : '←'} {l.other?.original_filename || l.item_id} ({l.link_type})
                      <span onClick={() => handleUnlinkItems(l.link_id)} title="Loskoppelen" style={{ marginLeft: 4, cursor: 'pointer' }}>✕</span>
                    </span>
                  ))}
                  {!linksOf(item).length && <span style={{ color: 'var(--color-text-muted)' }}>Nog geen relaties.</span>}
                </div>
                {/* Item 1058 (vervolg, Bart): het select+select+knop-formulier
                    hier was omslachtig - nieuwe relaties leggen kan nu in de
                    Relatie-graph (2 bestanden aanklikken), zie de knop bovenin. */}
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Nieuwe relatie leggen? Gebruik de "🔗 Relatie-graph"-knop bovenin.
                </div>
              </div>
            )}
            </div>
          ))}
          {!items.length && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Nog geen bestanden in deze case.</div>}
        </div>
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
      {showGraph && (
        <Modal title={`Relaties in "${caseObj.name}"`} onClose={() => setShowGraph(false)} width={860}>
          <RelationsGraph caseId={caseObj.id} />
        </Modal>
      )}
    </div>
  )
}
