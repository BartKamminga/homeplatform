import { useState, useEffect } from 'react'
import { PHOTO_TYPES } from './photoFilters.js'

// Inhoud van het detailvenster: grote foto + alle eigenschappen. Acties gaan
// via onAction(action, value) (zelfde acties als de bulkbalk, voor 1 foto).
// tagPlayers = speelsters in sneltoets-volgorde (1-9).

const fmt = iso => iso ? new Date(/[zZ]$/.test(iso) ? iso : `${iso}Z`).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null
const label = { display: 'block', fontSize: 11, fontWeight: 700, color: '#888', margin: '10px 0 4px', textTransform: 'uppercase', letterSpacing: '.04em' }
const select = { fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd', background: 'white', width: '100%' }

export default function PhotoDetail({ photo, tagPlayers, entries, entryTitle, onAction, onCaption, onDelete, lockedMatch }) {
  const [caption, setCaption] = useState(photo.caption || '')
  useEffect(() => setCaption(photo.caption || ''), [photo.id, photo.caption])
  const live = photo.status === 'published'
  const favorites = photo.favorite_player_ids || []

  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 300px', minWidth: 0 }}>
        {photo.media_type === 'video' ? (
          <video src={`/api/yearof-mo14/photos/${photo.id}/video`} controls
            style={{ width: '100%', maxHeight: '70vh', borderRadius: 8, background: '#000', display: 'block' }} />
        ) : (
          <img src={`/api/yearof-mo14/photos/${photo.id}/medium.jpg`} alt=""
            style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8, background: '#111', display: 'block' }} />
        )}
      </div>

      <div style={{ flex: '1 1 240px', fontSize: 12 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{
            fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            color: live ? '#065f46' : '#92400e', background: live ? '#bbf7d0' : '#fde68a',
          }}>{live ? 'Live' : 'Concept'}</span>
          <button onClick={() => onAction(live ? 'concept' : 'publish')} className="yof-btn-secondary" style={{ flex: 1 }}>
            {live ? 'Terug naar concept' : 'Publiceren'} <span style={{ opacity: 0.5 }}>[P]</span>
          </button>
          <button onClick={onDelete} className="yof-btn-secondary" style={{ color: '#c23b3b' }} title="Verwijderen [Del]">&times;</button>
        </div>

        <span style={label}>Speelsters <span style={{ textTransform: 'none', fontWeight: 400 }}>(toets 1-9)</span></span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {tagPlayers.map((pl, i) => {
            const tagged = photo.player_ids.includes(pl.id)
            return (
              <button key={pl.id} onClick={() => onAction(tagged ? 'untag' : 'tag', pl.id)} style={{
                border: 'none', borderRadius: 999, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
                background: tagged ? '#16a34a' : '#e5e7eb', color: tagged ? 'white' : '#555',
              }}>
                {i < 9 && <span style={{ opacity: 0.6, marginRight: 3 }}>{i + 1}</span>}
                {pl.nickname || pl.name}{favorites.includes(pl.id) ? ' ♥' : ''}
              </button>
            )
          })}
        </div>

        {photo.match_ref && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!photo.match_highlight} style={{ margin: 0 }}
              onChange={() => onAction(photo.match_highlight ? 'highlight_off' : 'highlight_on')} />
            Wedstrijd-highlight ⭐ <span style={{ opacity: 0.5 }}>[H]</span>
          </label>
        )}

        <span style={label}>Type</span>
        <select value={photo.photo_type} onChange={e => onAction('type', e.target.value)} style={select}>
          {PHOTO_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>

        <span style={label}>Wedstrijd</span>
        {photo.report ? (
          <div>{entryTitle(photo.match_ref) || 'Algemeen'} <span style={{ color: '#888' }}>&middot; bij verslag &ldquo;{photo.report.title}&rdquo; (volgt het verslag)</span></div>
        ) : (
          <select value={photo.match_ref || ''} onChange={e => e.target.value && onAction('move', e.target.value)} style={select}>
            {!photo.match_ref && <option value="">Zonder wedstrijd</option>}
            {entries.map(e => <option key={e.match_ref} value={e.match_ref}>{(e.date || '').slice(0, 10)} · {e.title}</option>)}
          </select>
        )}

        <span style={label}>Notitie</span>
        <input value={caption} placeholder="Notitie (optioneel)" onChange={e => setCaption(e.target.value)}
          onBlur={() => caption !== (photo.caption || '') && onCaption(caption)}
          style={{ ...select, padding: '5px 8px' }} />

        <div style={{ color: '#888', marginTop: 10, lineHeight: 1.6 }}>
          {photo.source?.label}<br />
          Geupload {fmt(photo.created_at)}{photo.published_at && <> &middot; live sinds {fmt(photo.published_at)}</>}
          {photo.like_count > 0 && <> &middot; {photo.like_count} &#10084;</>}
        </div>
        {lockedMatch && photo.match_ref !== lockedMatch && (
          <p style={{ color: '#92400e', marginTop: 8 }}>Verplaatst naar een andere wedstrijd - verdwijnt uit deze lijst.</p>
        )}
      </div>
    </div>
  )
}
