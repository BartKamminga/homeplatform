import { useState, useEffect, useRef, useCallback } from 'react'

const MIME = {
  mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
  m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg',
  opus: 'audio/ogg', wma: 'audio/x-ms-wma',
}

export function useCast() {
  const [castAvailable, setCastAvailable] = useState(false)
  const [castConnected, setCastConnected] = useState(false)
  const contextRef = useRef(null)

  useEffect(() => {
    function init(isAvailable) {
      if (!isAvailable) return
      try {
        const ctx = cast.framework.CastContext.getInstance()
        ctx.setOptions({
          receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        })
        contextRef.current = ctx
        setCastAvailable(true)

        ctx.addEventListener(
          cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          (e) => setCastConnected(e.castState === cast.framework.CastState.CONNECTED),
        )
      } catch {
        // Cast SDK not present (non-Chrome browser)
      }
    }

    if (window.__castApiAvailable) {
      init(window.__castApiAvailable)
    } else {
      window.addEventListener('castApiAvailable', (e) => init(e.detail), { once: true })
    }
  }, [])

  const castTrack = useCallback((track, displayName) => {
    const session = contextRef.current?.getCurrentSession()
    if (!session || !track) return

    const ext = track.ext?.toLowerCase() ?? 'mp3'
    const mime = MIME[ext] ?? 'audio/mpeg'
    const encoded = track.file.split('/').map(encodeURIComponent).join('/')
    const url = `${window.location.origin}/api/mixmusic/stream/${encoded}`

    const mediaInfo = new chrome.cast.media.MediaInfo(url, mime)
    mediaInfo.metadata = new chrome.cast.media.MusicTrackMediaMetadata()
    mediaInfo.metadata.title = displayName || track.name
    mediaInfo.metadata.albumName = track.folder || 'Mix Music'

    session.loadMedia(new chrome.cast.media.LoadRequest(mediaInfo)).catch(() => {})
  }, [])

  function openPicker() {
    contextRef.current?.requestSession()
  }

  function stopCast() {
    contextRef.current?.endCurrentSession(true)
  }

  return { castAvailable, castConnected, castTrack, openPicker, stopCast }
}
