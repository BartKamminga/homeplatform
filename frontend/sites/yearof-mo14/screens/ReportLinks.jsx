import { useState } from 'react'
import { addReportLink, updateReportLink, deleteReportLink } from '../api.js'

export const LINK_TYPES = [
  { value: 'instagram', label: 'Instagram', icon: '📸' },
  { value: 'video', label: 'Wedstrijdbeelden', icon: '▶️' },
]

function typeInfo(type) {
  return LINK_TYPES.find(t => t.value === type) || { label: type, icon: '🔗' }
}

const fieldStyle = { boxSizing: 'border-box', padding: 8, fontSize: 13, borderRadius: 6, border: '1px solid #ccc' }

// Nog geen report_id (nieuw verslag) - default 1 instagram + 4 video-rijen,
// klaar om in te vullen (de meest gebruikte mix voor wedstrijdbeelden).
export function defaultNewLinks() {
  return [
    { link_type: 'instagram', url: '', note: '' },
    { link_type: 'video', url: '', note: '' },
    { link_type: 'video', url: '', note: '' },
    { link_type: 'video', url: '', note: '' },
    { link_type: 'video', url: '', note: '' },
  ]
}

export function NewLinksEditor({ links, onChange }) {
  function update(i, patch) {
    onChange(links.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }
  function remove(i) {
    onChange(links.filter((_, idx) => idx !== i))
  }
  function add() {
    onChange([...links, { link_type: 'video', url: '', note: '' }])
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {links.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <select value={l.link_type} onChange={e => update(i, { link_type: e.target.value })} style={{ fontSize: 12 }}>
            {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input value={l.url} onChange={e => update(i, { url: e.target.value })} placeholder="Link (optioneel)"
            style={{ ...fieldStyle, flex: 2 }} />
          <input value={l.note} onChange={e => update(i, { note: e.target.value })} placeholder="Notitie (optioneel)"
            style={{ ...fieldStyle, flex: 1 }} />
          <button onClick={() => remove(i)} style={{ fontSize: 11, cursor: 'pointer' }}>x</button>
        </div>
      ))}
      <button onClick={add} style={{ fontSize: 12, cursor: 'pointer' }}>+ nog een linkje</button>
    </div>
  )
}

function ExistingLinkRow({ link, onSave, onDelete }) {
  const [form, setForm] = useState({ link_type: link.link_type, url: link.url, note: link.note || '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await onSave({ link_type: form.link_type, url: form.url, note: form.note || null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
      <select value={form.link_type} onChange={e => setForm({ ...form, link_type: e.target.value })} style={{ fontSize: 12 }}>
        {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="Link"
        style={{ ...fieldStyle, flex: 2 }} />
      <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Notitie (optioneel)"
        style={{ ...fieldStyle, flex: 1 }} />
      <button onClick={save} style={{ fontSize: 11, cursor: 'pointer' }}>{saving ? '...' : 'Opslaan'}</button>
      <button onClick={onDelete} style={{ fontSize: 11, cursor: 'pointer' }}>Verwijder</button>
    </div>
  )
}

// Bestaand verslag - rechtstreeks tegen de link-endpoints, toont alleen de
// al ingevulde linkjes plus een mini-formulier om er nog een toe te voegen.
export function ExistingLinksEditor({ reportId, links, onChanged }) {
  const [newType, setNewType] = useState('video')
  const [newUrl, setNewUrl] = useState('')
  const [newNote, setNewNote] = useState('')
  const [error, setError] = useState('')

  async function saveRow(link, body) {
    try {
      await updateReportLink(link.id, body)
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }
  async function removeRow(link) {
    try {
      await deleteReportLink(link.id)
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }
  async function add() {
    if (!newUrl.trim()) return
    try {
      await addReportLink(reportId, { link_type: newType, url: newUrl, note: newNote || null })
      setNewUrl(''); setNewNote('')
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {error && <p style={{ color: '#c23b3b', fontSize: 12 }}>{error}</p>}
      {links.map(l => (
        <ExistingLinkRow key={l.id} link={l} onSave={body => saveRow(l, body)} onDelete={() => removeRow(l)} />
      ))}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select value={newType} onChange={e => setNewType(e.target.value)} style={{ fontSize: 12 }}>
          {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Nieuwe link"
          style={{ ...fieldStyle, flex: 2 }} />
        <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Notitie (optioneel)"
          style={{ ...fieldStyle, flex: 1 }} />
        <button onClick={add} style={{ fontSize: 12, cursor: 'pointer' }}>+ toevoegen</button>
      </div>
    </div>
  )
}

// Publieke weergave: preview-tiles i.p.v. platte linkjes.
export function LinkTiles({ links }) {
  if (!links || links.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginTop: 8 }}>
      {links.map(l => {
        const info = typeInfo(l.link_type)
        return (
          <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="yof-card"
            style={{ display: 'block', textDecoration: 'none', color: 'inherit', textAlign: 'center', padding: 12 }}>
            <div style={{ fontSize: 22 }}>{info.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{info.label}</div>
            {l.note && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{l.note}</div>}
          </a>
        )
      })}
    </div>
  )
}
