import { useState, useEffect } from 'react'
import { getTimelineModeration, createEntry, updateEntry, archiveEntry, restoreEntry } from '../api.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'

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
    return <span>{item.score_home != null ? `${item.score_home}-${item.score_away}` : '-'}</span>
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

function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }
const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }

// Zelfde paginawissel-patroon als ReportForm/EditProfile: 1 formulier voor
// zowel aanmaken als bewerken (existingItem), i.p.v. losse inputvelden
// onderaan de lijst - lost ook het ontbreken van titel/soort-bewerken op
// (item 1157).
function CustomEntryForm({ existingItem, onSaved, onCancel }) {
  const isEdit = !!existingItem
  const [kind, setKind] = useState(existingItem?.kind || 'oefen')
  const [title, setTitle] = useState(existingItem?.title || '')
  const [date, setDate] = useState(toDatetimeLocal(existingItem?.date))
  const [opponent, setOpponent] = useState(existingItem?.opponent || '')
  const [location, setLocation] = useState(existingItem?.location || '')
  const [isPinned, setIsPinned] = useState(existingItem?.is_pinned || false)
  const [scoreUs, setScoreUs] = useState(existingItem?.score_us ?? '')
  const [scoreThem, setScoreThem] = useState(existingItem?.score_them ?? '')
  const [error, setError] = useState('')

  async function submit() {
    if (!title.trim() || !date.trim()) return
    const body = {
      kind, title, date,
      opponent: opponent || null,
      location: location || null,
      is_pinned: kind === 'bijzonder' ? isPinned : false,
      score_us: scoreUs === '' ? null : Number(scoreUs),
      score_them: scoreThem === '' ? null : Number(scoreThem),
    }
    try {
      if (isEdit) await updateEntry(existingItem.match_ref.replace('custom:', ''), body)
      else await createEntry(body)
      onSaved()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>{isEdit ? 'Wedstrijd/dag bewerken' : 'Nieuwe wedstrijd/bijzondere dag'}</h3>
        <button onClick={onCancel} style={{ fontSize: 12, cursor: 'pointer' }}>&larr; terug</button>
      </div>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <label style={labelStyle}>Soort</label>
      <select value={kind} onChange={e => setKind(e.target.value)} style={{ ...fieldStyle, width: 'auto' }}>
        <option value="oefen">Oefenwedstrijd</option>
        <option value="bijzonder">Bijzondere dag</option>
      </select>

      <label style={labelStyle}>Titel</label>
      <input value={title} onChange={e => setTitle(e.target.value)} style={fieldStyle} />

      <label style={labelStyle}>Datum</label>
      <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} style={fieldStyle} />

      <label style={labelStyle}>Tegenstander (optioneel)</label>
      <input value={opponent} onChange={e => setOpponent(e.target.value)} style={fieldStyle} />

      <label style={labelStyle}>Locatie (optioneel)</label>
      <input value={location} onChange={e => setLocation(e.target.value)} style={fieldStyle} />

      {kind === 'oefen' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Uitslag - wij</label>
            <input type="number" value={scoreUs} onChange={e => setScoreUs(e.target.value)} style={fieldStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Uitslag - zij</label>
            <input type="number" value={scoreThem} onChange={e => setScoreThem(e.target.value)} style={fieldStyle} />
          </div>
        </div>
      )}
      {kind === 'bijzonder' && (
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} />
          vastpinnen (bv. Pinksterweekend)
        </label>
      )}

      <button className="yof-btn" onClick={submit}>{isEdit ? 'Opslaan' : 'Toevoegen'}</button>
    </div>
  )
}

export default function TimelineAdmin({ onOpenMatch }) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [view, setView] = useState('list') // list | form
  const [editingItem, setEditingItem] = useState(null)
  const [confirm, confirmDialog] = useConfirm()

  function load() {
    getTimelineModeration().then(setItems).catch(e => setError(e.message))
  }
  useEffect(load, [])

  const activeItems = items.filter(it => !it.is_archived)
  const archivedItems = items.filter(it => it.is_archived)

  function backToList() {
    setEditingItem(null)
    setView('list')
    load()
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

  async function archive(matchRef) {
    if (!matchRef.startsWith('custom:')) return // competitiewedstrijden zijn read-only sync
    if (!(await confirm("Deze wedstrijd/dag archiveren? Hij verdwijnt dan van de publieke site, maar foto's/verslagen/linkjes eronder blijven bewaard - je kunt 'm hieronder bij Gearchiveerd altijd terugzetten."))) return
    try {
      await archiveEntry(matchRef.replace('custom:', ''))
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function restore(matchRef) {
    try {
      await restoreEntry(matchRef.replace('custom:', ''))
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  if (view === 'form') {
    return <CustomEntryForm existingItem={editingItem} onSaved={backToList} onCancel={backToList} />
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
        {activeItems.map(it => (
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
              {it.match_ref.startsWith('custom:') && (
                <button onClick={() => { setEditingItem(it); setView('form') }} className="yof-btn-secondary">bewerken</button>
              )}
              {it.match_ref.startsWith('custom:') && it.kind === 'bijzonder' && (
                <button onClick={() => togglePin(it)} className="yof-btn-secondary">
                  {it.is_pinned ? 'losmaken' : 'vastpinnen'}
                </button>
              )}
              {it.match_ref.startsWith('custom:') && (
                <button onClick={() => archive(it.match_ref)} className="yof-btn-secondary">archiveer</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {archivedItems.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowArchived(s => !s)} className="yof-btn-secondary" style={{ marginBottom: 10 }}>
            {showArchived ? 'Verberg' : 'Toon'} gearchiveerd ({archivedItems.length})
          </button>
          {showArchived && archivedItems.map(it => (
            <div key={it.match_ref} className="yof-card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', opacity: 0.7 }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#999', marginBottom: 4 }}>{it.kind} &middot; gearchiveerd</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{it.title}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{fmtDateTime(it.date)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => onOpenMatch(it.match_ref)} className="yof-btn-secondary">bekijk</button>
                <button onClick={() => restore(it.match_ref)} className="yof-btn-secondary">herstellen</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => { setEditingItem(null); setView('form') }} className="yof-btn" style={{ width: '100%' }}>
        + Nieuwe wedstrijd/bijzondere dag
      </button>
    </div>
  )
}
