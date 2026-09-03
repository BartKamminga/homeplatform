import { useEffect, useState } from 'react'
import { fetchItemBlobUrl } from '../api.js'

export function isImageItem(item) {
  return (item.content_type || '').startsWith('image/')
}

// Item 1065 (Bart): "ook plaatjes kunnen gebruiken" - een kleine, klikbare
// preview i.p.v. alleen bestandsnaam + download-knop voor image-items.
export default function ImageThumbnail({ itemId }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    fetchItemBlobUrl(itemId).then(u => {
      if (cancelled) { URL.revokeObjectURL(u); return }
      objectUrl = u
      setUrl(u)
    }).catch(() => {})
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [itemId])

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
