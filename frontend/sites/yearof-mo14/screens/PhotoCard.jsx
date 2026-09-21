import { useState } from 'react'
import { useConfirm } from '@components/ConfirmDialog.jsx'

// Detailkaart voor 1 foto/filmpje (tags, notitie, publiceren/verwijderen) -
// wordt getoond in de detail-modal van PhotoModerationGrid.jsx zodra je een
// tegel openklikt, niet meer standaard voor elke foto tegelijk (item 1168:
// bij 350+ fotos per wedstrijd was dat niet meer te doen).
export function PhotoCard({ photo, players, entryTitle, onTogglePublish, onDelete, onToggleTag, onSaveCaption, onToggleHighlight }) {
  const [captionDraft, setCaptionDraft] = useState(undefined)
  const [confirm, confirmDialog] = useConfirm()

  async function saveCaption() {
    if (captionDraft === undefined || captionDraft === (photo.caption || '')) return
    await onSaveCaption(photo, captionDraft)
  }

  async function handleDelete() {
    if (!(await confirm(`${photo.media_type === 'video' ? 'Deze video' : 'Deze foto'} verwijderen? Dit kan niet ongedaan gemaakt worden.`))) return
    onDelete(photo.id)
  }

  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
      {photo.media_type === 'video' ? (
        <video src={`/api/yearof-mo14/photos/${photo.id}/video`} controls
          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', background: '#000' }} />
      ) : (
        <img src={`/api/yearof-mo14/photos/${photo.id}/thumb.jpg`} alt=""
          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', background: '#eee' }} />
      )}
      <div style={{ padding: 8, fontSize: 11 }}>
        <div style={{ color: photo.status === 'published' ? '#16a34a' : '#d97706', fontWeight: 700, marginBottom: 4 }}>
          {photo.status === 'published' ? 'Gepubliceerd' : 'Concept'}
        </div>
        <div style={{ color: '#888', marginBottom: 6 }}>
          {photo.photo_type} &middot; <strong>{entryTitle(photo.match_ref)}</strong>
        </div>
        <div style={{ color: '#999', marginBottom: 6 }}>
          Geupload: {new Date(photo.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          {photo.published_at && (
            <> &middot; Gepubliceerd: {new Date(photo.published_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {players.map(pl => {
            const tagged = photo.player_ids.includes(pl.id)
            return (
              <button key={pl.id} onClick={() => onToggleTag(photo, pl.id)}
                style={{
                  border: 'none', borderRadius: 999, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
                  background: tagged ? '#16a34a' : '#e5e7eb',
                  color: tagged ? 'white' : '#555',
                }}>
                {pl.nickname || pl.name}
              </button>
            )
          })}
        </div>

        {photo.match_ref && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!photo.match_highlight}
              onChange={() => onToggleHighlight(photo)} style={{ margin: 0 }} />
            Match highlight (ook zichtbaar op de losse wedstrijdlink)
          </label>
        )}

        <input
          placeholder="Notitie (optioneel)"
          defaultValue={photo.caption || ''}
          onChange={e => setCaptionDraft(e.target.value)}
          onBlur={saveCaption}
          style={{ width: '100%', boxSizing: 'border-box', fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 6 }}
        />

        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onTogglePublish(photo)} className="yof-btn-secondary" style={{ flex: 1 }}>
            {photo.status === 'published' ? 'Terug naar concept' : 'Publiceren'}
          </button>
          <button onClick={handleDelete} className="yof-btn-secondary">&times;</button>
        </div>
      </div>
      {confirmDialog}
    </div>
  )
}
