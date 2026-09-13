import { useState, useEffect } from 'react'
import { getTimelineItem, getReports, getReportsModeration, getPhotos, updateReport } from '../api.js'

function InstaEmbed({ url }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="yof-card" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
      📸 Instagram-post bekijken
    </a>
  )
}
function YoutubeEmbed({ url }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="yof-card" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
      ▶️ Video bekijken
    </a>
  )
}

export default function PublicEntry({ matchRef, onBack, previewMode = false }) {
  const [item, setItem] = useState(null)
  const [reports, setReports] = useState([])
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState('')

  function loadReports() {
    const call = previewMode ? getReportsModeration() : getReports(matchRef)
    call
      .then(rows => setReports(previewMode ? rows.filter(r => r.match_ref === matchRef) : rows))
      .catch(e => setError(e.message))
  }

  useEffect(() => {
    getTimelineItem(matchRef).then(setItem).catch(e => setError(e.message))
    loadReports()
    getPhotos(matchRef).then(setPhotos).catch(() => {})
  }, [matchRef])

  async function publish(report) {
    await updateReport(report.id, { status: 'published' })
    loadReports()
  }

  if (error) return <p style={{ color: '#c23b3b' }}>{error}</p>
  if (!item) return <p>Laden...</p>

  return (
    <div>
      <a className="yof-back" href="#" onClick={e => { e.preventDefault(); onBack() }}>&larr; terug naar het overzicht</a>
      <div className="yof-card" style={{ marginBottom: 14 }}>
        <span className={`badge ${item.kind}`}>{item.kind}</span>
        <h2 style={{ margin: '10px 0 4px', fontSize: 18 }}>{item.title}</h2>
        <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
          {new Date(item.date).toLocaleDateString('nl-NL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
        {item.score_us != null && (
          <p style={{ fontSize: 24, fontWeight: 800, margin: '14px 0 0' }}>{item.score_us} - {item.score_them}</p>
        )}
        {item.description && <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5 }}>{item.description}</p>}
      </div>

      {photos.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Foto&rsquo;s</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
            {photos.map(p => (
              <a key={p.id} href={`/api/yearof-mo14/photos/${p.id}/full.jpg`} target="_blank" rel="noreferrer">
                <img src={`/api/yearof-mo14/photos/${p.id}/thumb.jpg`} alt=""
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              </a>
            ))}
          </div>
        </div>
      )}

      {reports.length > 0 && (
        <div>
          <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Verslagen &amp; interviews</h3>
          {reports.map(r => (
            <div key={r.id} className="yof-card" style={{ marginBottom: 10, position: 'relative' }}>
              {r.status === 'concept' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ background: '#fde68a', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                    CONCEPT
                  </span>
                  <button onClick={() => publish(r)} style={{ fontSize: 11, cursor: 'pointer' }}>Publiceren</button>
                </div>
              )}
              <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{r.title}</h4>
              {r.author_name && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>door {r.author_name}</p>}
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.body}</p>
              {r.insta_url && <div style={{ marginTop: 8 }}><InstaEmbed url={r.insta_url} /></div>}
              {r.youtube_url && <div style={{ marginTop: 8 }}><YoutubeEmbed url={r.youtube_url} /></div>}
              {r.youtube_urls?.length > 0 && (
                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  {r.youtube_urls.map((url, i) => <YoutubeEmbed key={i} url={url} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
