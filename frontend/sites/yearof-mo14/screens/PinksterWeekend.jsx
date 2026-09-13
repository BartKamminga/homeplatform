import { useState, useEffect } from 'react'
import { getTimeline } from '../api.js'
import PublicEntry from './PublicEntry.jsx'

export default function PinksterWeekend({ onBack, previewMode = false }) {
  const [pinnedRef, setPinnedRef] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getTimeline().then(items => {
      const pinned = items.find(it => it.is_pinned)
      if (pinned) setPinnedRef(pinned.match_ref)
      else setNotFound(true)
    }).catch(e => setError(e.message))
  }, [])

  if (error) return <p style={{ color: '#c23b3b' }}>{error}</p>

  if (notFound) {
    return (
      <div>
        <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Pinksterweekend Parijs</h2>
        <p style={{ fontSize: 13, color: '#666' }}>
          Deze pagina komt binnenkort — de beheerder moet nog een bijzondere dag aanmaken en vastpinnen
          (Wedstrijden-tabblad, &ldquo;bijzonder&rdquo; + vastpinnen aanvinken).
        </p>
      </div>
    )
  }

  if (!pinnedRef) return null

  return (
    <div>
      <div className="yof-hero" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 28 }}>🗼</div>
        <h1 style={{ fontSize: 18 }}>Het grote Parijs-weekend</h1>
        <p>15-17 mei 2027 — het hoogtepunt van de hele actie.</p>
      </div>
      <PublicEntry matchRef={pinnedRef} onBack={onBack} previewMode={previewMode} />
    </div>
  )
}
