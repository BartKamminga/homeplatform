import { useEffect } from 'react'

// Grid-tegel voor een foto/filmpje - filmpjes hebben geen thumbnail (geen
// ffmpeg beschikbaar om er een te genereren), dus een simpel afspeel-icoontje
// i.p.v. een echte videopreview.
export function PhotoThumb({ photo }) {
  if (photo.media_type === 'video') {
    return (
      <div style={{
        width: '100%', aspectRatio: '1', borderRadius: 8, background: '#12203c',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
      }}>▶️</div>
    )
  }
  return (
    <img src={`/api/yearof-mo14/photos/${photo.id}/thumb.jpg`} alt=""
      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
  )
}

export function PhotoLightbox({ photos, index, onClose, onNavigate }) {
  const open = index != null && photos[index]

  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onNavigate((index + 1) % photos.length)
      if (e.key === 'ArrowLeft') onNavigate((index - 1 + photos.length) % photos.length)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, index, photos.length, onClose, onNavigate])

  if (!open) return null
  const photo = photos[index]

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <button onClick={e => { e.stopPropagation(); onClose() }} style={{
        position: 'absolute', top: 12, right: 16, fontSize: 30, color: 'white',
        background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1,
      }}>&times;</button>

      {photos.length > 1 && (
        <button onClick={e => { e.stopPropagation(); onNavigate((index - 1 + photos.length) % photos.length) }} style={{
          position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 36, color: 'white',
          background: 'none', border: 'none', cursor: 'pointer', padding: 12,
        }}>&lsaquo;</button>
      )}

      {photo.media_type === 'video' ? (
        <video src={`/api/yearof-mo14/photos/${photo.id}/video`} controls autoPlay onClick={e => e.stopPropagation()}
          style={{ maxWidth: '92vw', maxHeight: '86vh', borderRadius: 8 }} />
      ) : (
        <img src={`/api/yearof-mo14/photos/${photo.id}/full.jpg`} alt="" onClick={e => e.stopPropagation()}
          style={{ maxWidth: '92vw', maxHeight: '86vh', objectFit: 'contain', borderRadius: 8 }} />
      )}

      {photos.length > 1 && (
        <button onClick={e => { e.stopPropagation(); onNavigate((index + 1) % photos.length) }} style={{
          position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 36, color: 'white',
          background: 'none', border: 'none', cursor: 'pointer', padding: 12,
        }}>&rsaquo;</button>
      )}

      {photos.length > 1 && (
        <div style={{ position: 'absolute', bottom: 14, color: 'white', fontSize: 13 }}>
          {index + 1} / {photos.length}
        </div>
      )}
    </div>
  )
}
