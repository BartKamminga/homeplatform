import { useState, useEffect } from 'react'
import { getPlayers, createPlayer, updatePlayer, deletePlayer, uploadPlayerPhotoAdmin, createProfileLink, listProfileLinks, getPlayerEditsModeration, applyPlayerEdit, rejectPlayerEdit } from '../api.js'
import { copyToClipboard } from '../clipboard.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'

const inputStyle = { padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }
const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }

function ProfileLinkCell({ playerId, links, onCreated }) {
  const [copied, setCopied] = useState(false)
  const link = links.find(l => l.player_id === playerId)

  async function make() {
    await createProfileLink(playerId)
    onCreated()
  }
  async function copy() {
    const url = `${window.location.origin}/yearof-mo14/?profiel=${link.id}`
    try {
      await copyToClipboard(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback: het veldje hieronder blijft handmatig selecteerbaar */ }
  }

  if (!link) return <button onClick={make} className="yof-btn-secondary">Maak profiellink</button>

  const url = `${window.location.origin}/yearof-mo14/?profiel=${link.id}`
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input readOnly value={url} onFocus={e => e.target.select()}
        style={{ fontSize: 11, padding: '3px 5px', borderRadius: 6, border: '1px solid #ddd', width: 150 }} />
      <button onClick={copy} className="yof-btn-secondary">{copied ? 'OK!' : 'Kopieer'}</button>
    </div>
  )
}

function PlayerEditsModeration({ players }) {
  const [edits, setEdits] = useState([])
  const [error, setError] = useState('')

  function load() {
    getPlayerEditsModeration().then(setEdits).catch(e => setError(e.message))
  }
  useEffect(load, [])

  function playerName(id) {
    const p = players.find(p => p.id === id)
    return p ? (p.nickname || p.name) : '?'
  }

  async function approve(id) {
    try { await applyPlayerEdit(id); load() } catch (e) { setError(e.message) }
  }
  async function reject(id) {
    try { await rejectPlayerEdit(id); load() } catch (e) { setError(e.message) }
  }

  if (edits.length === 0 && !error) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Openstaande profielwijzigingen</h4>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      {edits.map(e => (
        <div key={e.id} className="yof-card" style={{ marginBottom: 8, fontSize: 12 }}>
          <strong>{playerName(e.player_id)}</strong>
          <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
            {e.nickname && <li>Bijnaam: {e.nickname}</li>}
            {e.position && <li>Positie: {e.position}</li>}
            {e.bio && <li>Over mij: {e.bio}</li>}
            {e.fun_facts && <li>Leuk weetje: {e.fun_facts}</li>}
          </ul>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => approve(e.id)} className="yof-btn-secondary">Goedkeuren</button>
            <button onClick={() => reject(e.id)} className="yof-btn-secondary">Afwijzen</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function EditPlayerRow({ player, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: player.name || '',
    nickname: player.nickname || '',
    shirt_number: player.shirt_number ?? '',
    position: player.position || '',
    bio: player.bio || '',
    fun_facts: player.fun_facts || '',
  })
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')

  function pickPhoto(file) {
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function save() {
    if (!form.name.trim()) return
    try {
      if (photoFile) {
        setUploadingPhoto(true)
        await uploadPlayerPhotoAdmin(player.id, photoFile)
        setUploadingPhoto(false)
      }
      await onSave({
        name: form.name,
        nickname: form.nickname || null,
        shirt_number: form.shirt_number !== '' ? Number(form.shirt_number) : null,
        position: form.position || null,
        bio: form.bio || null,
        fun_facts: form.fun_facts || null,
      })
    } catch (e) {
      setUploadingPhoto(false)
      setError(e.message)
    }
  }

  return (
    <div className="yof-card" style={{ marginBottom: 10 }}>
        {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

        <label style={labelStyle}>Profielfoto</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div className="yof-photo-tile">
            {(photoPreview || player.photo_url)
              ? <img src={photoPreview || player.photo_url} alt="" />
              : <div className="no-photo">{form.shirt_number || '?'}</div>}
            {form.shirt_number !== '' && <span className="shirt-badge">{form.shirt_number}</span>}
          </div>
          <input type="file" accept="image/*" onChange={e => pickPhoto(e.target.files?.[0])} style={{ fontSize: 13 }} />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={labelStyle}>Naam</label>
            <input style={fieldStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={labelStyle}>Bijnaam</label>
            <input style={fieldStyle} value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} />
          </div>
          <div style={{ width: 80 }}>
            <label style={labelStyle}>Nr</label>
            <input style={fieldStyle} value={form.shirt_number} onChange={e => setForm({ ...form, shirt_number: e.target.value })} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={labelStyle}>Positie</label>
            <input style={fieldStyle} value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
          </div>
        </div>

        <label style={labelStyle}>Over mij</label>
        <textarea style={{ ...fieldStyle, resize: 'vertical' }} rows={3} value={form.bio}
          onChange={e => setForm({ ...form, bio: e.target.value })} />

        <label style={labelStyle}>Leuk weetje</label>
        <textarea style={{ ...fieldStyle, resize: 'vertical' }} rows={2} value={form.fun_facts}
          placeholder="Bijv. je favoriete actie, hockeyheld, of waar je naar uitkijkt in Parijs"
          onChange={e => setForm({ ...form, fun_facts: e.target.value })} />

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={save} disabled={uploadingPhoto} className="yof-btn-secondary">
            {uploadingPhoto ? 'Foto uploaden...' : 'Opslaan'}
          </button>
          <button onClick={onCancel} className="yof-btn-secondary">Annuleren</button>
        </div>
    </div>
  )
}

export default function PlayersAdmin() {
  const [players, setPlayers] = useState([])
  const [profileLinks, setProfileLinks] = useState([])
  const [form, setForm] = useState({ name: '', nickname: '', shirt_number: '', position: '' })
  const [editingId, setEditingId] = useState('')
  const [error, setError] = useState('')
  const [confirm, confirmDialog] = useConfirm()

  function load() {
    getPlayers().then(setPlayers).catch(e => setError(e.message))
  }
  function loadLinks() {
    listProfileLinks().then(setProfileLinks).catch(() => {})
  }
  useEffect(() => { load(); loadLinks() }, [])

  async function add() {
    if (!form.name.trim()) return
    try {
      await createPlayer({
        name: form.name,
        nickname: form.nickname || null,
        shirt_number: form.shirt_number ? Number(form.shirt_number) : null,
        position: form.position || null,
      })
      setForm({ name: '', nickname: '', shirt_number: '', position: '' })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function saveEdit(id, body) {
    await updatePlayer(id, body)
    setEditingId('')
    load()
  }

  async function remove(id) {
    if (!(await confirm('Deze speler verwijderen? Dit kan niet ongedaan gemaakt worden.'))) return
    try {
      await deletePlayer(id)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      {confirmDialog}
      <PlayerEditsModeration players={players} />

      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Spelers</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <div style={{ marginBottom: 16 }}>
        {players.map(p => (
          editingId === p.id ? (
            <EditPlayerRow key={p.id} player={p} onSave={body => saveEdit(p.id, body)} onCancel={() => setEditingId('')} />
          ) : (
            <div key={p.id} className="yof-card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#eef1f8', color: '#12203c',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0,
              }}>
                {p.shirt_number ?? '?'}
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}{p.nickname ? ` (${p.nickname})` : ''}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{p.position ?? '-'}</div>
              </div>
              <ProfileLinkCell playerId={p.id} links={profileLinks} onCreated={loadLinks} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEditingId(p.id)} className="yof-btn-secondary">bewerken</button>
                <button onClick={() => remove(p.id)} className="yof-btn-secondary">verwijder</button>
              </div>
            </div>
          )
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input style={inputStyle} placeholder="Naam" value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })} />
        <input style={inputStyle} placeholder="Bijnaam" value={form.nickname}
          onChange={e => setForm({ ...form, nickname: e.target.value })} />
        <input style={{ ...inputStyle, width: 60 }} placeholder="Nr" value={form.shirt_number}
          onChange={e => setForm({ ...form, shirt_number: e.target.value })} />
        <input style={inputStyle} placeholder="Positie" value={form.position}
          onChange={e => setForm({ ...form, position: e.target.value })} />
        <button onClick={add} className="yof-btn-secondary">Toevoegen</button>
      </div>
    </div>
  )
}
