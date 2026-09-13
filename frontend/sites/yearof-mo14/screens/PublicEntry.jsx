import { useState, useEffect } from 'react'
import { getTimelineItem } from '../api.js'

export default function PublicEntry({ matchRef, onBack }) {
  const [item, setItem] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getTimelineItem(matchRef).then(setItem).catch(e => setError(e.message))
  }, [matchRef])

  if (error) return <p style={{ color: '#c23b3b' }}>{error}</p>
  if (!item) return <p>Laden...</p>

  return (
    <div>
      <a className="yof-back" href="#" onClick={e => { e.preventDefault(); onBack() }}>&larr; terug naar het overzicht</a>
      <div className="yof-card">
        <span className={`badge ${item.kind}`}>{item.kind}</span>
        <h2 style={{ margin: '10px 0 4px', fontSize: 18 }}>{item.title}</h2>
        <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
          {new Date(item.date).toLocaleDateString('nl-NL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
        {item.score_us != null && (
          <p style={{ fontSize: 24, fontWeight: 800, margin: '14px 0 0' }}>{item.score_us} - {item.score_them}</p>
        )}
        {item.description && <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5 }}>{item.description}</p>}
        <p style={{ marginTop: 16, fontSize: 13, color: '#999' }}>
          Verslagen en foto&rsquo;s bij deze {item.kind === 'competitie' ? 'wedstrijd' : 'dag'} volgen binnenkort.
        </p>
      </div>
    </div>
  )
}
