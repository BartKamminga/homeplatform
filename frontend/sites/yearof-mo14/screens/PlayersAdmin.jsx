import { useState, useEffect } from 'react'
import { getPlayersModeration, createPlayer, archivePlayer, restorePlayer, createProfileLink, listProfileLinks, getPlayerEditsModeration, applyPlayerEdit, rejectPlayerEdit } from '../api.js'
import { copyToClipboard } from '../clipboard.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'
import EditProfile from './EditProfile.jsx'

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }
const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }

// Paginawissel-formulier i.p.v. losse inputvelden onderaan de lijst (item
// 1157) - alleen de basisvelden, foto/bio/weetje vul je na het aanmaken
// meteen in via EditProfile (onCreated stuurt daar direct naartoe).
function NewPlayerForm({ onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [shirtNumber, setShirtNumber] = useState('')
  const [position, setPosition] = useState('')
  const [error, setError] = useState('')

  async function submit() {
    if (!name.trim()) return
    try {
      const player = await createPlayer({
        name,
        nickname: nickname || null,
        shirt_number: shirtNumber !== '' ? Number(shirtNumber) : null,
        position: position || null,
      })
      onCreated(player.id)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>Nieuwe speler</h3>
        <button onClick={onCancel} style={{ fontSize: 12, cursor: 'pointer' }}>&larr; terug</button>
      </div>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <label style={labelStyle}>Naam</label>
      <input value={name} onChange={e => setName(e.target.value)} style={fieldStyle} />

      <label style={labelStyle}>Bijnaam</label>
      <input value={nickname} onChange={e => setNickname(e.target.value)} style={fieldStyle} />

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ width: 100 }}>
          <label style={labelStyle}>Rugnummer</label>
          <input value={shirtNumber} onChange={e => setShirtNumber(e.target.value)} style={fieldStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Positie</label>
          <input value={position} onChange={e => setPosition(e.target.value)} style={fieldStyle} />
        </div>
      </div>

      <button className="yof-btn" onClick={submit}>Toevoegen &amp; profiel verder invullen</button>
    </div>
  )
}

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

export default function PlayersAdmin({ initialEditId }) {
  const [players, setPlayers] = useState([])
  const [profileLinks, setProfileLinks] = useState([])
  const [view, setView] = useState('list') // list | new
  const [editingId, setEditingId] = useState(initialEditId || '')
  const [error, setError] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  function load() {
    getPlayersModeration().then(setPlayers).catch(e => setError(e.message))
  }
  function loadLinks() {
    listProfileLinks().then(setProfileLinks).catch(() => {})
  }
  useEffect(() => { load(); loadLinks() }, [])

  const activePlayers = players.filter(p => !p.archived_at)
  const archivedPlayers = players.filter(p => p.archived_at)

  async function archive(id) {
    if (!(await confirm('Deze speler archiveren? Hij verdwijnt dan van de publieke site, maar profiel/foto-tags/doelpunten blijven bewaard - je kunt de speler hieronder bij Gearchiveerd altijd terugzetten.'))) return
    try {
      await archivePlayer(id)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function restore(id) {
    try {
      await restorePlayer(id)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  if (editingId) {
    return (
      <EditProfile adminMode playerId={editingId}
        onSaved={() => { setEditingId(''); load() }}
        onCancel={() => setEditingId('')}
      />
    )
  }

  if (view === 'new') {
    return (
      <NewPlayerForm
        onCreated={newId => { setView('list'); setEditingId(newId); load() }}
        onCancel={() => setView('list')}
      />
    )
  }

  return (
    <div>
      {confirmDialog}
      <PlayerEditsModeration players={players} />

      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Spelers</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <div style={{ marginBottom: 16 }}>
        {activePlayers.map(p => (
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
              <button onClick={() => archive(p.id)} className="yof-btn-secondary">archiveer</button>
            </div>
          </div>
        ))}
      </div>

      {archivedPlayers.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowArchived(s => !s)} className="yof-btn-secondary" style={{ marginBottom: 10 }}>
            {showArchived ? 'Verberg' : 'Toon'} gearchiveerd ({archivedPlayers.length})
          </button>
          {showArchived && archivedPlayers.map(p => (
            <div key={p.id} className="yof-card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', opacity: 0.7 }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}{p.nickname ? ` (${p.nickname})` : ''}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>gearchiveerd</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEditingId(p.id)} className="yof-btn-secondary">bekijk</button>
                <button onClick={() => restore(p.id)} className="yof-btn-secondary">herstellen</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setView('new')} className="yof-btn" style={{ width: '100%' }}>
        + Nieuwe speler
      </button>
    </div>
  )
}
