import { useState, useEffect } from 'react'
import { getTimeline, createEntry, updateEntry, deleteEntry } from '../api.js'

const inputStyle = { padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }

function fmtDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const hasTime = !(d.getHours() === 0 && d.getMinutes() === 0) || /T\d{2}:\d{2}/.test(iso)
  const datePart = d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  if (!hasTime) return datePart
  const timePart = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${timePart}`
}

function LocationCell({ item, onSave }) {
  const [value, setValue] = useState(item.location || '')

  if (!item.match_ref.startsWith('custom:')) {
    return item.location
      ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{item.location}</a>
      : <span style={{ color: '#999' }}>-</span>
  }

  async function save() {
    if (value === (item.location || '')) return
    await onSave(item.match_ref.replace('custom:', ''), { location: value || null })
  }

  return (
    <input value={value} onChange={e => setValue(e.target.value)} onBlur={save}
      placeholder="Locatie" style={{ width: 110, padding: '2px 4px', fontSize: 12 }} />
  )
}

function ScoreCell({ item, onSave }) {
  const [us, setUs] = useState(item.score_us ?? '')
  const [them, setThem] = useState(item.score_them ?? '')

  if (!item.match_ref.startsWith('custom:')) {
    // competitiewedstrijden: uitslag komt automatisch uit Poulebord/hockey-inside, read-only
    return <span>{item.score_us != null ? `${item.score_us}-${item.score_them}` : '-'}</span>
  }

  async function save() {
    const newUs = us === '' ? null : Number(us)
    const newThem = them === '' ? null : Number(them)
    if (newUs === (item.score_us ?? null) && newThem === (item.score_them ?? null)) return
    await onSave(item.match_ref.replace('custom:', ''), { score_us: newUs, score_them: newThem })
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input type="number" value={us} onChange={e => setUs(e.target.value)} onBlur={save}
        style={{ width: 40, padding: '2px 4px', fontSize: 12 }} placeholder="-" />
      <span>-</span>
      <input type="number" value={them} onChange={e => setThem(e.target.value)} onBlur={save}
        style={{ width: 40, padding: '2px 4px', fontSize: 12 }} placeholder="-" />
    </div>
  )
}

export default function TimelineAdmin({ onOpenMatch }) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ kind: 'oefen', title: '', date: '', opponent: '', location: '', isPinned: false, scoreUs: '', scoreThem: '' })

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
        location: form.location || null,
        is_pinned: form.kind === 'bijzonder' ? form.isPinned : false,
        score_us: form.scoreUs === '' ? null : Number(form.scoreUs),
        score_them: form.scoreThem === '' ? null : Number(form.scoreThem),
      })
      setForm({ kind: 'oefen', title: '', date: '', opponent: '', location: '', isPinned: false, scoreUs: '', scoreThem: '' })
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

  async function saveScore(id, body) {
    try {
      await updateEntry(id, body)
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
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 10px' }}>
        Uitslagen van competitiewedstrijden komen automatisch uit Poulebord/hockey-inside. Voor oefenwedstrijden vul je de uitslag hieronder zelf in.
      </p>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#888' }}>
            <th style={{ padding: 6 }}>Datum</th>
            <th style={{ padding: 6 }}>Soort</th>
            <th style={{ padding: 6 }}>Titel</th>
            <th style={{ padding: 6 }}>Locatie</th>
            <th style={{ padding: 6 }}>Uitslag</th>
            <th style={{ padding: 6 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.match_ref} style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: 6 }}>{fmtDateTime(it.date)}</td>
              <td style={{ padding: 6 }}>{it.kind}</td>
              <td style={{ padding: 6 }}>
                <button onClick={() => onOpenMatch(it.match_ref)} style={{
                  fontSize: 13, cursor: 'pointer', border: 'none', background: 'none', padding: 0,
                  color: '#12203c', textDecoration: 'underline',
                }}>
                  {it.is_pinned ? '📌 ' : ''}{it.title}
                </button>
              </td>
              <td style={{ padding: 6 }}>
                <LocationCell item={it} onSave={saveScore} />
              </td>
              <td style={{ padding: 6 }}>
                <ScoreCell item={it} onSave={saveScore} />
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
        <input style={inputStyle} type="datetime-local" value={form.date}
          onChange={e => setForm({ ...form, date: e.target.value })} />
        <input style={inputStyle} placeholder="Tegenstander (optioneel)" value={form.opponent}
          onChange={e => setForm({ ...form, opponent: e.target.value })} />
        <input style={inputStyle} placeholder="Locatie (optioneel)" value={form.location}
          onChange={e => setForm({ ...form, location: e.target.value })} />
        {form.kind === 'oefen' && (
          <>
            <input style={{ ...inputStyle, width: 50 }} type="number" placeholder="Uit" value={form.scoreUs}
              onChange={e => setForm({ ...form, scoreUs: e.target.value })} />
            <span>-</span>
            <input style={{ ...inputStyle, width: 50 }} type="number" placeholder="Zij" value={form.scoreThem}
              onChange={e => setForm({ ...form, scoreThem: e.target.value })} />
          </>
        )}
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
