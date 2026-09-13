import { useState, useEffect } from 'react'
import { getReports } from '../api.js'

const ROLE_LABEL = { speelster: 'Speelster', coach: 'Coach', ouder: 'Ouder' }

function InstaEmbed({ url }) {
  return <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>📸 Instagram-post bekijken</a>
}
function YoutubeEmbed({ url }) {
  return <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>▶️ Video bekijken</a>
}

export default function PublicSpotlight() {
  const [reports, setReports] = useState([])
  const [openId, setOpenId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getReports(null, 'interview').then(setReports).catch(e => setError(e.message))
  }, [])

  return (
    <div>
      <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>In de kijker</h2>
      <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px' }}>
        Interviews met speelsters, coaches en ouders.
      </p>
      {error && <p style={{ color: '#c23b3b' }}>{error}</p>}

      <div style={{ display: 'grid', gap: 10 }}>
        {reports.map(r => {
          const open = openId === r.id
          return (
            <div key={r.id} className="yof-card" onClick={() => setOpenId(open ? null : r.id)} style={{ cursor: 'pointer' }}>
              {r.interviewee_role && (
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#a3245c', fontWeight: 700, marginBottom: 4 }}>
                  {ROLE_LABEL[r.interviewee_role] || r.interviewee_role}
                </div>
              )}
              <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>&ldquo;{r.title}&rdquo;</h3>
              {!open && (
                <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                  {r.body.length > 120 ? r.body.slice(0, 120) + '...' : r.body}
                  {r.author_name ? ` — ${r.author_name}` : ''}
                </p>
              )}
              {open && (
                <div onClick={e => e.stopPropagation()}>
                  <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.body}</p>
                  {r.author_name && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#666' }}>— {r.author_name}</p>}
                  {r.insta_url && <div style={{ marginBottom: 6 }}><InstaEmbed url={r.insta_url} /></div>}
                  {r.youtube_url && <div><YoutubeEmbed url={r.youtube_url} /></div>}
                </div>
              )}
            </div>
          )
        })}
        {reports.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog geen interviews geplaatst.</p>}
      </div>
    </div>
  )
}
