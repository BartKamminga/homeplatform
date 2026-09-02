import { useEffect, useState } from 'react'
import { listContacts, createContact, updateContact, deleteContact, listItems, listCases } from '../api.js'
import { ConfirmDialog, useConfirm } from '@components/ConfirmDialog.jsx'

const EMPTY = { email: '', display_name: '', notes: '' }

// Item 1052: profiel van WIE de andere partij in een mail/document is, los
// van MindboxContext (dat gaat over HOE Bart terugschrijft). v1 koppelt
// alleen op e-mailadres (uit .msg sender/to/cc via -Contact/link_item_contact).
export default function ContactsPage() {
  const [contacts, setContacts] = useState([])
  const [items, setItems] = useState([])
  const [cases, setCases] = useState([])
  const [editing, setEditing] = useState(null) // null=gesloten, {}=nieuw, object=bewerken
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [confirmAction, confirmDialog] = useConfirm()

  function load() {
    listContacts().then(setContacts).catch(e => setError(e.message))
    listItems().then(setItems).catch(() => {})
    listCases().then(setCases).catch(() => {})
  }
  useEffect(() => { load() }, [])

  // Item 1052 (Bart): "waar een contact mee te maken heeft?" - afgeleid uit
  // alle items (ongefilterd) + cases, geen apart endpoint nodig.
  function itemsOf(contactId) {
    return items.filter(i => i.contact_id === contactId)
  }
  function caseNameOf(caseId) {
    return cases.find(c => c.id === caseId)?.name
  }

  function openNew() {
    setForm(EMPTY)
    setEditing({})
  }

  function openEdit(contact) {
    setForm({ email: contact.email, display_name: contact.display_name || '', notes: contact.notes || '' })
    setEditing(contact)
  }

  async function save() {
    if (editing?.id) {
      // E-mailadres is de identiteit van een contact - niet aanpasbaar na aanmaken.
      await updateContact(editing.id, { display_name: form.display_name, notes: form.notes })
    } else {
      if (!form.email.trim()) return
      const contact = await createContact({ email: form.email.trim(), display_name: form.display_name.trim() || null })
      if (form.notes.trim()) await updateContact(contact.id, { notes: form.notes.trim() })
    }
    setEditing(null)
    load()
  }

  async function remove(contact) {
    if (!(await confirmAction(`Contact "${contact.display_name || contact.email}" verwijderen? Bestanden die 'm gebruiken verliezen de koppeling.`))) return
    await deleteContact(contact.id)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={openNew}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--color-primary)', color: '#fff' }}
        >
          + Nieuw contact
        </button>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Wie is de afzender/betrokkene bij een bestand - los van hoe je terugschrijft (dat is Context)
        </span>
      </div>

      {error && <div style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {editing && (
        <div style={{ padding: 16, marginBottom: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="E-mailadres"
              disabled={!!editing.id}
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', opacity: editing.id ? 0.6 : 1 }}
            />
            <input
              value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="Naam (optioneel)"
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)' }}
            />
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Notities - bv. communicatiestijl, inschatting van de persoon..."
              style={{ padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', minHeight: 100, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(null)} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>
                Annuleren
              </button>
              <button onClick={save} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {!contacts.length && !editing && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Nog geen contacten. Ze worden ook automatisch aangemaakt zodra je een bestand aan een afzender koppelt.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {contacts.map(c => (
          <div key={c.id} style={{ padding: 14, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
              <div>
                <strong style={{ fontSize: 14 }}>{c.display_name || c.email}</strong>
                {c.display_name && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.email}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(c)} title="Bewerken" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>✎</button>
                <button onClick={() => remove(c)} title="Verwijderen" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            {c.notes && (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto', marginBottom: 8 }}>
                {c.notes}
              </div>
            )}
            {!!itemsOf(c.id).length && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>GEBRUIKT BIJ</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {itemsOf(c.id).map(item => (
                    <div key={item.id} style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {item.case_id ? `📁 ${caseNameOf(item.case_id) || item.case_id}` : '📥 Bestanden'} · {item.original_filename}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {confirmDialog}
    </div>
  )
}
