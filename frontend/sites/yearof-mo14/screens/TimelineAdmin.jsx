import { useState, useEffect } from 'react'
import { getTimeline, createEntry, updateEntry, deleteEntry } from '../api.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'

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
  const [confirm, confirmDialog] = useConfirm()

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
    if (!(await confirm('Deze wedstrijd/dag verwijderen? Dit kan niet ongedaan gemaakt worden.'))) return
    try {
      await deleteEntry(matchRef.replace('custom:', ''))
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      {confirmDialog}
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Wedstrijden &amp; bijzondere dagen</h3>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 10px' }}>
        Uitslagen van competitiewedstrijden komen automatisch uit Poulebord/hockey-inside. Voor oefenwedstrijden vul je de uitslag hieronder zelf in.
      </p>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <div style={{ marginBottom: 16 }}>
        {items.map(it => (
          <div key={it.match_ref} className="yof-card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {it.opponent_club_logo
              ? <img src={it.opponent_club_logo} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eef1f8', flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#999', marginBottom: 4 }}>
                {it.kind}{it.is_pinned ? ' · 📌' : ''}
              </div>
              <button onClick={() => onOpenMatch(it.match_ref)}
                style={{ fontWeight: 700, fontSize: 14, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#12203c', textAlign: 'left' }}>
                {it.title}
              </button>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>{fmtDateTime(it.date)}</span>
                <LocationCell item={it} onSave={saveScore} />
                <ScoreCell item={it} onSave={saveScore} />
                {it.has_photos && <span title="Foto's beschikbaar">📷</span>}
                {it.has_report && <span title="Verslag/interview beschikbaar">📝</span>}
                {it.has_footage && <span title="Wedstrijdbeelden beschikbaar">▶️</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {it.match_ref.startsWith('custom:') && it.kind === 'bijzonder' && (
                <button onClick={() => togglePin(it)} className="yof-btn-secondary">
                  {it.is_pinned ? 'losmaken' : 'vastpinnen'}
                </button>
              )}
              {it.match_ref.startsWith('custom:') && (
                <button onClick={() => remove(it.match_ref)} className="yof-btn-secondary">verwijder</button>
              )}
            </div>
          </div>
        ))}
      </div>

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
        <button onClick={add} className="yof-btn-secondary">Toevoegen</button>
      </div>
    </div>
  )
}
