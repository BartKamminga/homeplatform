import { useEffect, useState } from 'react'
import { fetchItemBlobUrl, fetchItemPreviewBlobUrl } from '../api.js'

export function isImageItem(item) {
  return (item.content_type || '').startsWith('image/')
}

// Item 1068: een item toont een thumbnail als het zelf een afbeelding is
// (download) OF als er een automatisch gegenereerde preview voor bestaat
// (bv. pagina 1 van een .pdf, via het losse /preview-endpoint).
export function hasThumbnail(item) {
  return isImageItem(item) || !!item.has_preview
}

// Item 1065 (Bart): "ook plaatjes kunnen gebruiken" - een kleine, klikbare
// preview i.p.v. alleen bestandsnaam + download-knop voor image-items.
export default function ImageThumbnail({ item }) {
  const [url, setUrl] = useState(null)
  const useDownload = isImageItem(item)

  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    const fetcher = useDownload ? fetchItemBlobUrl : fetchItemPreviewBlobUrl
    fetcher(item.id).then(u => {
      if (cancelled) { URL.revokeObjectURL(u); return }
      objectUrl = u
      setUrl(u)
    }).catch(() => {})
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [item.id, useDownload])

  if (!url) return null
  return (
    <img
      src={url}
      alt=""
      onClick={() => window.open(url, '_blank')}
      style={{ maxWidth: 120, maxHeight: 80, borderRadius: 4, display: 'block', marginTop: 4, cursor: 'zoom-in' }}
    />
  )
}
