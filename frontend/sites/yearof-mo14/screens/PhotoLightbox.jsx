import { useEffect, useRef, useState } from 'react'

// Grid-tegel voor een foto/filmpje. Filmpjes hebben geen server-side
// gegenereerde thumbnail (geen ffmpeg op de server) - i.p.v. daarvan
// grijpt de browser zelf 1 frame uit de video (via een verborgen <video>
// + <canvas>) en toont dat als preview, met een afspeel-icoontje erover.
// De video-route ondersteunt geen Range-requests, dus dit downloadt het
// hele bestand progressief - acceptabel voor de korte clips hier, maar
// geen streaming-achtige lichte fetch.
function VideoThumb({ photo }) {
  const canvasRef = useRef(null)
  const [ready, setReady] = useState(false)

  function captureFrame(e) {
    const video = e.target
    const canvas = canvasRef.current
    if (!canvas || !video.videoWidth) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    setReady(true)
  }

  return (
    <div style={{ width: '100%', aspectRatio: '1', borderRadius: 8, background: '#12203c', position: 'relative', overflow: 'hidden' }}>
      <video src={`/api/yearof-mo14/photos/${photo.id}/video`} preload="metadata" muted playsInline
        style={{ display: 'none' }}
        onLoadedMetadata={e => { e.target.currentTime = Math.min(0.5, (e.target.duration || 0) / 2) }}
        onSeeked={captureFrame}
      />
      <canvas ref={canvasRef} style={{
        width: '100%', height: '100%', objectFit: 'cover', display: ready ? 'block' : 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,.6)',
      }}>▶️</div>
    </div>
  )
}

export function PhotoThumb({ photo }) {
  if (photo.media_type === 'video') {
    return <VideoThumb photo={photo} />
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

      {(photo.published_at || photo.created_at) && (
        <div style={{ position: 'absolute', bottom: 14, left: 16, color: 'rgba(255,255,255,.7)', fontSize: 12 }}>
          {new Date(photo.published_at || photo.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      )}
    </div>
  )
}
