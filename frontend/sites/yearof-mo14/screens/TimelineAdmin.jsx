import { useState, useEffect } from 'react'
import { getTimeline, createEntry, updateEntry, deleteEntry } from '../api.js'

const inputStyle = { padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }

export default function TimelineAdmin() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ kind: 'oefen', title: '', date: '', opponent: '', isPinned: false })

  function load() {
    getTimeline().then(setItems).catch(e => setError(e.message))
  }
  useEffect(load, [])

  async function add() {
    if (!form.title.trim() || !form.date.trim()) return
    try {
      await createEntry({
        kind: form.kind,
        title: form.title,
        date: form.date,
        opponent: form.opponent || null,
        is_pinned: form.kind === 'bijzonder' ? form.isPinned : false,
      })
      setForm({ kind: 'oefen', title: '', date: '', opponent: '', isPinned: false })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function togglePin(it) {
    try {
      await updateEntry(it.match_ref.replace('custom:', ''), { is_pinned: !it.is_pinned })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function remove(matchRef) {
    if (!matchRef.startsWith('custom:')) return // competitiewedstrijden zijn read-only sync
    try {
      await deleteEntry(matchRef.replace('custom:', ''))
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Wedstrijden &amp; bijzondere dagen</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#888' }}>
            <th style={{ padding: 6 }}>Datum</th>
            <th style={{ padding: 6 }}>Soort</th>
            <th style={{ padding: 6 }}>Titel</th>
            <th style={{ padding: 6 }}>Uitslag</th>
            <th style={{ padding: 6 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.match_ref} style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: 6 }}>{it.date?.slice(0, 10)}</td>
              <td style={{ padding: 6 }}>{it.kind}</td>
              <td style={{ padding: 6 }}>{it.is_pinned ? '📌 ' : ''}{it.title}</td>
              <td style={{ padding: 6 }}>
                {it.score_us != null ? `${it.score_us}-${it.score_them}` : '-'}
              </td>
              <td style={{ padding: 6, display: 'flex', gap: 6 }}>
                {it.match_ref.startsWith('custom:') && it.kind === 'bijzonder' && (
                  <button onClick={() => togglePin(it)} style={{ fontSize: 12, cursor: 'pointer' }}>
                    {it.is_pinned ? 'losmaken' : 'vastpinnen'}
                  </button>
                )}
                {it.match_ref.startsWith('custom:') && (
                  <button onClick={() => remove(it.match_ref)} style={{ fontSize: 12, cursor: 'pointer' }}>verwijder</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={inputStyle} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
          <option value="oefen">Oefenwedstrijd</option>
          <option value="bijzonder">Bijzondere dag</option>
        </select>
        <input style={inputStyle} placeholder="Titel" value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })} />
        <input style={inputStyle} type="date" value={form.date}
          onChange={e => setForm({ ...form, date: e.target.value })} />
        <input style={inputStyle} placeholder="Tegenstander (optioneel)" value={form.opponent}
          onChange={e => setForm({ ...form, opponent: e.target.value })} />
        {form.kind === 'bijzonder' && (
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={form.isPinned} onChange={e => setForm({ ...form, isPinned: e.target.checked })} />
            vastpinnen (bv. Pinksterweekend)
          </label>
        )}
        <button onClick={add} style={{ fontSize: 13, cursor: 'pointer' }}>Toevoegen</button>
      </div>
    </div>
  )
}
