import { useState } from 'react'
import { isLiked, setLiked } from '../likes.js'

// Hartje-knop voor verslagen/interviews/fotos - alleen een positieve reactie
// (geen duim-omlaag), client-side dedupe via localStorage (zie likes.js) i.p.v.
// server-side per-bezoeker tracking, zelfde vertrouwensmodel als de rest van
// deze anonieme site.
export function LikeButton({ kind, id, initialCount, likeFn, unlikeFn, dark = false }) {
  const [liked, setLikedState] = useState(() => isLiked(kind, id))
  const [count, setCount] = useState(initialCount || 0)
  const [busy, setBusy] = useState(false)

  async function toggle(e) {
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      const res = liked ? await unlikeFn(id) : await likeFn(id)
      setLiked(kind, id, !liked)
      setLikedState(!liked)
      if (typeof res?.like_count === 'number') setCount(res.like_count)
    } catch {
      // netwerkfout: niets bijwerken, gewoon opnieuw te proberen
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={toggle} disabled={busy} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none',
      cursor: 'pointer', fontSize: 13, padding: '2px 4px', color: dark ? 'white' : 'inherit',
    }}>
      <span style={{ fontSize: 15 }}>{liked ? '❤️' : '🤍'}</span>
      {count > 0 && <span style={{ color: dark ? 'rgba(255,255,255,.8)' : '#666' }}>{count}</span>}
    </button>
  )
}
