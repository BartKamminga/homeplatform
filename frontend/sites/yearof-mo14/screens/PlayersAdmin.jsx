import { useState, useEffect } from 'react'
import { getPlayers, createPlayer, deletePlayer } from '../api.js'

const inputStyle = { padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }

export default function PlayersAdmin() {
  const [players, setPlayers] = useState([])
  const [form, setForm] = useState({ name: '', nickname: '', shirt_number: '', position: '' })
  const [error, setError] = useState('')

  function load() {
    getPlayers().then(setPlayers).catch(e => setError(e.message))
  }
  useEffect(load, [])

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
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Spelers</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#888' }}>
            <th style={{ padding: 6 }}>Nr</th>
            <th style={{ padding: 6 }}>Naam</th>
            <th style={{ padding: 6 }}>Bijnaam</th>
            <th style={{ padding: 6 }}>Positie</th>
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
