import { useState, useEffect } from 'react'
import { getSpotlightReports, getPlayers, getTimeline, getPhotosByReport } from '../api.js'
import { LinkTiles } from './ReportLinks.jsx'
import { PhotoLightbox, PhotoThumb } from './PhotoLightbox.jsx'

const ROLE_LABEL = { speelster: 'speelster', coach: 'coach', ouder: 'ouder' }

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

export default function PublicSpotlight({ onOpenMatch, adminMode = false, onEditGeneral }) {
  const [reports, setReports] = useState([])
  const [players, setPlayers] = useState([])
  const [entries, setEntries] = useState([])
  const [openId, setOpenId] = useState(null)
  const [error, setError] = useState('')
  const [photosByReport, setPhotosByReport] = useState({})
  const [lightbox, setLightbox] = useState(null) // { reportId, index }

  useEffect(() => {
    getSpotlightReports().then(rows => {
      setReports(rows)
      Promise.all(rows.map(r => getPhotosByReport(r.id).then(photos => [r.id, photos]).catch(() => [r.id, []])))
        .then(pairs => setPhotosByReport(Object.fromEntries(pairs)))
    }).catch(e => setError(e.message))
    getPlayers().then(setPlayers).catch(() => {})
    getTimeline().then(setEntries).catch(() => {})
  }, [])

  function writerName(r) {
    if (r.author_name) return r.author_name
    const player = players.find(p => p.id === r.player_ids?.[0])
    if (player) return player.nickname || player.name
    return ROLE_LABEL[r.interviewee_role] || null
  }

  function matchTitle(matchRef) {
    return entries.find(e => e.match_ref === matchRef)?.title
  }

  // adminMode: hele kaart bridget meteen naar het echte bewerkscherm i.p.v.
  // in-/uitklappen - wedstrijd-gebonden naar de wedstrijdpagina, algemeen
  // (nieuws) naar Algemene berichten (item 1156).
  function handleCardClick(r) {
    if (!adminMode) {
      setOpenId(open => (open === r.id ? null : r.id))
      return
    }
    if (r.match_ref) onOpenMatch(r.match_ref)
    else onEditGeneral(r.id)
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>In de kijker</h2>
      <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px' }}>
        Interviews, wedstrijdverslagen en ander nieuws, uitgelicht door de teammanager.
      </p>
      {error && <p style={{ color: '#c23b3b' }}>{error}</p>}

      <div style={{ display: 'grid', gap: 10 }}>
        {reports.map(r => {
          const open = openId === r.id
          const name = writerName(r)
          const title = matchTitle(r.match_ref)
          return (
            <div key={r.id} className="yof-card" onClick={() => handleCardClick(r)} style={{ cursor: 'pointer', position: 'relative' }}>
              {adminMode && (
                <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, color: '#999' }}>&#9998; bewerken</span>
              )}
              <AuthorAvatars playerIds={r.player_ids} players={players} />
              {name && (
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#a3245c', fontWeight: 700, marginBottom: 4 }}>
                  {name}{r.interviewee_role && r.author_name ? ` · ${ROLE_LABEL[r.interviewee_role]}` : ''}
                </div>
              )}
              <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>&ldquo;{r.title}&rdquo;</h3>
              {r.published_at && (
                <p style={{ margin: '0 0 6px', fontSize: 11, color: '#999' }}>
                  {new Date(r.published_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              )}
              {!open && (
                <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                  {r.body.length > 120 ? r.body.slice(0, 120) + '...' : r.body}
                </p>
              )}
              {open && (
                <div onClick={e => e.stopPropagation()}>
                  <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.body}</p>
                  <LinkTiles links={r.links} />
                </div>
              )}
              {photosByReport[r.id]?.length > 0 && (
                <div onClick={e => e.stopPropagation()}
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6, marginTop: 8 }}>
                  {photosByReport[r.id].map((p, i) => (
                    <a key={p.id} href="#" onClick={e => { e.preventDefault(); setLightbox({ reportId: r.id, index: i }) }}>
                      <PhotoThumb photo={p} />
                    </a>
                  ))}
                </div>
              )}
              {title && (
                <p style={{ margin: '8px 0 0', fontSize: 12 }}>
                  Bij:{' '}
                  <a href="#" onClick={e => { e.stopPropagation(); e.preventDefault(); onOpenMatch(r.match_ref) }} style={{ color: '#12203c' }}>
                    {title} &rsaquo;
                  </a>
                </p>
              )}
            </div>
          )
        })}
        {reports.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog niets uitgelicht.</p>}
      </div>
      <PhotoLightbox
        photos={lightbox ? photosByReport[lightbox.reportId] || [] : []}
        index={lightbox?.index ?? null}
        onClose={() => setLightbox(null)}
        onNavigate={i => setLightbox(l => ({ ...l, index: i }))}
      />
    </div>
  )
}
