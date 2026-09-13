import { useState, useEffect } from 'react'
import { getPlayers, createPlayer, deletePlayer, createProfileLink, listProfileLinks, getPlayerEditsModeration, applyPlayerEdit, rejectPlayerEdit } from '../api.js'
import { copyToClipboard } from '../clipboard.js'

const inputStyle = { padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }

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

  if (!link) return <button onClick={make} style={{ fontSize: 11, cursor: 'pointer' }}>Maak profiellink</button>

  const url = `${window.location.origin}/yearof-mo14/?profiel=${link.id}`
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input readOnly value={url} onFocus={e => e.target.select()}
        style={{ fontSize: 11, padding: '3px 5px', borderRadius: 6, border: '1px solid #ddd', width: 150 }} />
      <button onClick={copy} style={{ fontSize: 11, cursor: 'pointer' }}>{copied ? 'OK!' : 'Kopieer'}</button>
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
        <div key={e.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 12 }}>
          <strong>{playerName(e.player_id)}</strong>
          <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
            {e.nickname && <li>Bijnaam: {e.nickname}</li>}
            {e.position && <li>Positie: {e.position}</li>}
            {e.bio && <li>Over mij: {e.bio}</li>}
            {e.fun_facts && <li>Leuk weetje: {e.fun_facts}</li>}
          </ul>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => approve(e.id)} style={{ fontSize: 11, cursor: 'pointer' }}>Goedkeuren</button>
            <button onClick={() => reject(e.id)} style={{ fontSize: 11, cursor: 'pointer' }}>Afwijzen</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function PlayersAdmin() {
  const [players, setPlayers] = useState([])
  const [profileLinks, setProfileLinks] = useState([])
  const [form, setForm] = useState({ name: '', nickname: '', shirt_number: '', position: '' })
  const [error, setError] = useState('')

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

  async function remove(id) {
    try {
      await deletePlayer(id)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <PlayerEditsModeration players={players} />

      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Spelers</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#888' }}>
            <th style={{ padding: 6 }}>Nr</th>
            <th style={{ padding: 6 }}>Naam</th>
            <th style={{ padding: 6 }}>Bijnaam</th>
            <th style={{ padding: 6 }}>Positie</th>
            <th style={{ padding: 6 }}>Profiellink</th>
            <th style={{ padding: 6 }}></th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id} style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: 6 }}>{p.shirt_number ?? '-'}</td>
              <td style={{ padding: 6 }}>{p.name}</td>
              <td style={{ padding: 6 }}>{p.nickname ?? '-'}</td>
              <td style={{ padding: 6 }}>{p.position ?? '-'}</td>
              <td style={{ padding: 6 }}>
                <ProfileLinkCell playerId={p.id} links={profileLinks} onCreated={loadLinks} />
              </td>
              <td style={{ padding: 6 }}>
                <button onClick={() => remove(p.id)} style={{ fontSize: 12, cursor: 'pointer' }}>verwijder</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input style={inputStyle} placeholder="Naam" value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })} />
        <input style={inputStyle} placeholder="Bijnaam" value={form.nickname}
          onChange={e => setForm({ ...form, nickname: e.target.value })} />
        <input style={{ ...inputStyle, width: 60 }} placeholder="Nr" value={form.shirt_number}
          onChange={e => setForm({ ...form, shirt_number: e.target.value })} />
        <input style={inputStyle} placeholder="Positie" value={form.position}
          onChange={e => setForm({ ...form, position: e.target.value })} />
        <button onClick={add} style={{ fontSize: 13, cursor: 'pointer' }}>Toevoegen</button>
      </div>
    </div>
  )
}
