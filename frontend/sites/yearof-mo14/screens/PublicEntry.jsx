import { useState, useEffect } from 'react'
import { getTimelineItem, getReports, getReportsModeration, getPhotos, updateReport } from '../api.js'
import { LinkTiles } from './ReportLinks.jsx'
import { PhotoLightbox, PhotoThumb } from './PhotoLightbox.jsx'

export default function PublicEntry({ matchRef, onBack, previewMode = false, adminMode = false, onEditReport, onNewReport, onEditLinks }) {
  const [item, setItem] = useState(null)
  const [reports, setReports] = useState([])
  const [photos, setPhotos] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(null)
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
        {(item.home_club_logo || item.away_club_logo) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '10px 0 2px' }}>
            {item.home_club_logo
              ? <img src={item.home_club_logo} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 36, height: 36 }} />}
            <span style={{ fontSize: 12, color: '#999' }}>vs</span>
            {item.away_club_logo
              ? <img src={item.away_club_logo} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 36, height: 36 }} />}
          </div>
        )}
        <h2 style={{ margin: '10px 0 4px', fontSize: 18 }}>{item.title}</h2>
        <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
          {new Date(item.date).toLocaleDateString('nl-NL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          {(() => {
            const d = new Date(item.date)
            const hasTime = !(d.getHours() === 0 && d.getMinutes() === 0) || /T\d{2}:\d{2}/.test(item.date)
            return hasTime ? ` · ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : ''
          })()}
        </p>
        {item.location && (
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            📍 <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`}
              target="_blank" rel="noreferrer" style={{ color: '#12203c' }}>{item.location}</a>
          </p>
        )}
        {item.score_us != null && (
          <p style={{ fontSize: 24, fontWeight: 800, margin: '14px 0 0' }}>{item.score_us} - {item.score_them}</p>
        )}
        {item.description && <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5 }}>{item.description}</p>}
      </div>

      {photos.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Foto&rsquo;s</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
            {photos.map((p, i) => (
              <a key={p.id} href="#" onClick={e => { e.preventDefault(); setLightboxIndex(i) }}>
                <PhotoThumb photo={p} />
              </a>
            ))}
          </div>
        </div>
      )}
      <PhotoLightbox photos={photos} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onNavigate={setLightboxIndex} />

      {(reports.length > 0 || adminMode) && (
        <div>
          <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Verslagen &amp; interviews</h3>
          {reports.map(r => (
            <div key={r.id} className="yof-card"
              onClick={adminMode ? () => onEditReport(r) : undefined}
              style={{ marginBottom: 10, position: 'relative', cursor: adminMode ? 'pointer' : 'default' }}>
              {r.status === 'concept' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ background: '#fde68a', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                    CONCEPT
                  </span>
                  {!adminMode && (
                    <button onClick={() => publish(r)} style={{ fontSize: 11, cursor: 'pointer' }}>Publiceren</button>
                  )}
                </div>
              )}
              {adminMode && (
                <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, color: '#999' }}>&#9998; bewerken</span>
              )}
              <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{r.title}</h4>
              {r.author_name && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>door {r.author_name}</p>}
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.body}</p>
              <LinkTiles links={r.links} />
            </div>
          ))}
          {adminMode && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <button onClick={onNewReport} className="yof-btn" style={{ flex: 1, minWidth: 180 }}>
                + Verslag / interview toevoegen
              </button>
              <button onClick={onEditLinks} className="yof-btn"
                style={{ flex: 1, minWidth: 180, background: 'transparent', border: '1px solid #ddd', color: 'inherit' }}>
                + Instagram / wedstrijdbeelden
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
