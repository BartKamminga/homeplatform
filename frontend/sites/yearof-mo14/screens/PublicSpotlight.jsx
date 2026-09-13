import { useState, useEffect } from 'react'
import { getReports, getPlayers } from '../api.js'

const ROLE_LABEL = { speelster: 'Speelster', coach: 'Coach', ouder: 'Ouder' }

function InstaEmbed({ url }) {
  return <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>📸 Instagram-post bekijken</a>
}
function YoutubeEmbed({ url }) {
  return <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>▶️ Video bekijken</a>
}

function AuthorAvatars({ playerIds, players }) {
  if (!playerIds || playerIds.length === 0) return null
  return (
    <div style={{ display: 'flex', marginBottom: 6 }}>
      {playerIds.map((id, i) => {
        const p = players.find(pl => pl.id === id)
        if (!p) return null
        return (
          <div key={id} title={p.nickname || p.name} style={{
            width: 26, height: 26, borderRadius: '50%', marginLeft: i > 0 ? -8 : 0,
            border: '2px solid white', overflow: 'hidden', flexShrink: 0,
            background: 'linear-gradient(160deg, #2a2a2a, #0b0b0b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#f4c81e', fontSize: 10, fontWeight: 700,
          }}>
            {p.photo_url
              ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (p.nickname || p.name || '?').charAt(0).toUpperCase()}
          </div>
        )
      })}
    </div>
  )
}

export default function PublicSpotlight() {
  const [reports, setReports] = useState([])
  const [players, setPlayers] = useState([])
  const [openId, setOpenId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getReports(null, 'interview').then(setReports).catch(e => setError(e.message))
    getPlayers().then(setPlayers).catch(() => {})
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
              <AuthorAvatars playerIds={r.player_ids} players={players} />
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
