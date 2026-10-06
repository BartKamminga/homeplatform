import { useEffect, useRef } from 'react'
import PhotoDetail from './PhotoDetail.jsx'

// Detailvenster met navigatie door de zichtbare (gefilterde/gesorteerde)
// lijst en sneltoetsen: pijltjes, Esc, P (publiceren/concept), H
// (highlight), 1-9 (speelster taggen), Del (archiveren).
// Verdwijnt de open foto uit de lijst (bv. na publiceren in "Te beoordelen"),
// dan schuift het venster door naar de foto die op zijn plek komt.
export default function PhotoDetailModal({ photos, openId, setOpenId, autoAdvance, setAutoAdvance, tagPlayers, onAction, onCaption, onDelete, onPurge, ...rest }) {
  const lastIndex = useRef(0)
  let index = photos.findIndex(p => p.id === openId)
  if (index === -1 && photos.length) index = Math.min(lastIndex.current, photos.length - 1)
  const photo = index >= 0 ? photos[index] : null
  if (index >= 0) lastIndex.current = index

  useEffect(() => {
    if (photo && photo.id !== openId) setOpenId(photo.id)
    if (!photo && openId) setOpenId(null)
  }, [photo?.id, openId])

  const go = step => photos.length && setOpenId(photos[(index + step + photos.length) % photos.length].id)

  async function act(action, value) {
    await onAction(photo, action, value)
    if (autoAdvance && action === 'publish') go(1)
  }

  useEffect(() => {
    if (!photo) return
    function onKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (e.key === 'Escape') setOpenId(null)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'p' || e.key === 'P') act(photo.status === 'published' ? 'concept' : 'publish')
      else if ((e.key === 'h' || e.key === 'H') && photo.match_ref) act(photo.match_highlight ? 'highlight_off' : 'highlight_on')
      else if (e.key === 'Delete' && !photo.archived_at) onDelete(photo) // archiveren, nooit definitief
      else if (/^[1-9]$/.test(e.key) && tagPlayers[Number(e.key) - 1]) {
        const pl = tagPlayers[Number(e.key) - 1]
        act(photo.player_ids.includes(pl.id) ? 'untag' : 'tag', pl.id)
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!photo) return null

  return (
    <div onClick={() => setOpenId(null)} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 820, background: 'white', borderRadius: 12, padding: 14, maxHeight: '94vh', overflowY: 'auto',
      }}>
        <PhotoDetail photo={photo} tagPlayers={tagPlayers} onAction={act} onCaption={v => onCaption(photo, v)}
          onDelete={() => onDelete(photo)} onPurge={() => onPurge(photo)} {...rest} />
        {/* Onderbalk op 1 regel: navigatie links, Sluiten rechts. Let op: .yof-btn
            is standaard width:100% - hier expliciet auto, anders drukt hij de rest samen. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12,
          borderTop: '1px solid #eee', fontSize: 12, whiteSpace: 'nowrap',
        }}>
          <button onClick={() => go(-1)} className="yof-btn-secondary" style={{ flexShrink: 0 }}>&lsaquo; vorige</button>
          <span style={{ color: '#999', minWidth: 44, textAlign: 'center', flexShrink: 0 }}>{index + 1} / {photos.length}</span>
          <button onClick={() => go(1)} className="yof-btn-secondary" style={{ flexShrink: 0 }}>volgende &rsaquo;</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: autoAdvance ? '#16a34a' : '#999', cursor: 'pointer', flexShrink: 0 }}
            title="Na publiceren automatisch naar de volgende foto">
            <input type="checkbox" checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)} style={{ margin: 0 }} />
            auto door
          </label>
          <button onClick={() => setOpenId(null)} className="yof-btn"
            style={{ width: 'auto', marginLeft: 'auto', padding: '8px 18px', fontSize: 13, flexShrink: 0 }}>
            Sluiten <span style={{ opacity: 0.6, fontWeight: 400 }}>[Esc]</span>
          </button>
        </div>
      </div>
    </div>
  )
}
