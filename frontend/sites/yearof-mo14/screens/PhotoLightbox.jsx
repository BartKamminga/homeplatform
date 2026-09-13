import { useEffect } from 'react'

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

      <img src={`/api/yearof-mo14/photos/${photo.id}/full.jpg`} alt="" onClick={e => e.stopPropagation()}
        style={{ maxWidth: '92vw', maxHeight: '86vh', objectFit: 'contain', borderRadius: 8 }} />

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
