import { useState, useEffect } from 'react'
import { getSponsors, createSponsor, updateSponsor, deleteSponsor, moveSponsor, uploadSponsorLogo } from '../api.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, margin: '0 0 4px' }
const fieldStyle = { padding: 6, fontSize: 13, marginBottom: 10, width: 300, maxWidth: '100%', boxSizing: 'border-box' }

function SponsorCard({ sponsor, atTop, atBottom, onMove, onSave, onDelete, onUploadLogo }) {
  const [name, setName] = useState(sponsor.name)
  const [description, setDescription] = useState(sponsor.description || '')
  const [websiteUrl, setWebsiteUrl] = useState(sponsor.website_url || '')
  const [uploading, setUploading] = useState(false)

  async function pickLogo(file) {
    if (!file) return
    setUploading(true)
    try {
      await onUploadLogo(sponsor.id, file)
    } finally {
      setUploading(false)
    }
  }

  function save() {
    onSave(sponsor.id, { name, description: description || null, website_url: websiteUrl || null })
  }

  return (
    <div className="yof-card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ width: 90, flexShrink: 0 }}>
          {sponsor.logo_url ? (
            <img src={sponsor.logo_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', background: '#fafafa', borderRadius: 8 }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '1', background: '#f2f2f2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#999' }}>
              geen logo
            </div>
          )}
          <input type="file" accept="image/*" onChange={e => pickLogo(e.target.files?.[0])}
            style={{ fontSize: 10, marginTop: 6, width: '100%' }} />
          {uploading && <p style={{ fontSize: 10, color: '#999', margin: '2px 0 0' }}>Uploaden...</p>}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={labelStyle}>Naam</label>
          <input value={name} onChange={e => setName(e.target.value)} style={fieldStyle} />

          <label style={labelStyle}>Tekst (optioneel)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...fieldStyle, resize: 'vertical' }} />

          <label style={labelStyle}>Website (optioneel)</label>
          <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://..." style={fieldStyle} />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={save} className="yof-btn-secondary">Opslaan</button>
            <button onClick={() => onMove(sponsor.id, 'up')} disabled={atTop} className="yof-btn-secondary" style={{ opacity: atTop ? 0.4 : 1 }}>&#8593;</button>
            <button onClick={() => onMove(sponsor.id, 'down')} disabled={atBottom} className="yof-btn-secondary" style={{ opacity: atBottom ? 0.4 : 1 }}>&#8595;</button>
            <button onClick={() => onDelete(sponsor.id)} className="yof-btn-secondary">Verwijderen</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SponsorsAdmin() {
  const [sponsors, setSponsors] = useState([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [confirm, confirmDialog] = useConfirm()

  function load() {
    getSponsors().then(setSponsors).catch(e => setError(e.message))
  }
  useEffect(load, [])

  async function add() {
    if (!newName.trim()) return
    try {
      await createSponsor({ name: newName.trim() })
      setNewName('')
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function save(id, body) {
    try {
      await updateSponsor(id, body)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function uploadLogo(id, file) {
    try {
      await uploadSponsorLogo(id, file)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function move(id, direction) {
    try {
      await moveSponsor(id, direction)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function remove(id) {
    if (!(await confirm('Deze sponsor verwijderen? Dit kan niet ongedaan gemaakt worden.'))) return
    try {
      await deleteSponsor(id)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      {confirmDialog}
      <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>Sponsors</h3>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 14px' }}>
        Verschijnen publiek op de Actie-pagina, ook zonder teamcode - net als de thermometer zelf.
      </p>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      {sponsors.map((s, i) => (
        <SponsorCard key={s.id} sponsor={s} atTop={i === 0} atBottom={i === sponsors.length - 1}
          onMove={move} onSave={save} onDelete={remove} onUploadLogo={uploadLogo} />
      ))}
      {sponsors.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog geen sponsors toegevoegd.</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Naam nieuwe sponsor"
          style={{ padding: 6, fontSize: 13, flex: 1 }} onKeyDown={e => e.key === 'Enter' && add()} />
        <button onClick={add} className="yof-btn">+ Toevoegen</button>
      </div>
    </div>
  )
}
