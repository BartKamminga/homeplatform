import { useState, useEffect } from 'react'
import { getActionSettings, getHomeReports, getTimeline, getInterviewCandidates, getStandings, getPlayerSpotlight } from '../api.js'
import PlayerSpotlightCard from './PlayerSpotlightCard.jsx'
import Thermometer from './Thermometer.jsx'
import PageBlock from '../features/blocks/PageBlock.jsx'
import usePageBlocks from '../features/blocks/usePageBlocks.js'
import { PouleCard } from './PouleCard.jsx'
import { stripFormatting } from './FormattedText.jsx'
import usePageMeta from '../features/pages/pageMeta.js'
import { PageIcon } from '../features/brand/navIcons.jsx'

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })
}

function MatchTeaser({ label, item, onOpen }) {
  if (!item) return null
  return (
    <a href="#" onClick={e => { e.preventDefault(); onOpen(item.match_ref) }} className="yof-card"
      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
      {item.opponent_club_logo && (
        <img src={item.opponent_club_logo} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      )}
      <div>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#999', marginBottom: 4 }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</div>
        <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
          {fmtDate(item.date)}{(item.score_home ?? item.score_us) != null ? ` · ${item.score_home ?? item.score_us}-${item.score_away ?? item.score_them}` : ''}
        </div>
      </div>
    </a>
  )
}

// onOpenPage(ref): bericht onder In de kijker aanklikken = naar de pagina waar het op staat (item 1241).
export default function PublicHome({ onNavigate, onOpenMatch, onOpenPlayer, onOpenPage, editMode = false }) {
  const [settings, setSettings] = useState(null)
  const [interviews, setInterviews] = useState([])
  const [pastMatch, setPastMatch] = useState(null)
  const [nextMatch, setNextMatch] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [standings, setStandings] = useState(null)
  const [playerSpotlight, setPlayerSpotlight] = useState(null)
  const { conceptBlocks, setting } = usePageBlocks()
  const homeCount = setting('home.spotlight', 'count', 4)
  const home = usePageMeta()('home') // kop instelbaar (item 1248)

  useEffect(() => {
    getActionSettings().then(setSettings).catch(() => {})
    getStandings().then(setStandings).catch(() => {})
    getPlayerSpotlight().then(setPlayerSpotlight).catch(() => {})
    getTimeline().then(items => {
      const now = new Date()
      const past = items.filter(it => new Date(it.date) <= now)
      const future = items.filter(it => new Date(it.date) > now)
      const last = past[past.length - 1] || null
      const next = future[0] || null
      setPastMatch(last)
      setNextMatch(next)
      if (next) {
        getInterviewCandidates(next.match_ref).then(setCandidates).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  // In de kijker (item 1241): nieuwste berichten van de eigen paginas met Toon op Home.
  useEffect(() => {
    getHomeReports(homeCount).then(setInterviews).catch(() => {})
  }, [homeCount])

  // Elk blok apart live/concept (item 1239). editMode = bewerkscherm in de
  // beheerstudio: ook lege blokken tonen, zodat de schakelaar bereikbaar is.
  const block = (id, label, content, options) => (
    <PageBlock id={id} label={label} editMode={editMode} options={options}>
      {content || (editMode ? <p style={{ fontSize: 12, color: '#999', margin: 0 }}>Nu leeg - verschijnt vanzelf zodra er iets is.</p> : null)}
    </PageBlock>
  )
  const live = id => editMode || !conceptBlocks.has(id)
  const countOptions = [{ key: 'count', label: 'Aantal', fallback: 4,
    choices: [2, 4, 6].map(n => ({ value: n, label: String(n) })) }]
  const showSpotlightHeading = (interviews.length > 0 && live('home.spotlight')) || (playerSpotlight && live('home.player_spotlight')) || editMode

  return (
    <div>
      {block('home.hero', 'Kop', (
        <div className="yof-hero">
          {home.icon && <div style={{ fontSize: 32, color: 'var(--accent)' }}><PageIcon value={home.icon} size={34} /></div>}
          <h1>{home.title}</h1>
          {home.subtitle && <p>{home.subtitle}</p>}
          <PageBlock id="action.thermometer">
            <div style={{ marginTop: 16 }}>
              <Thermometer settings={settings} />
            </div>
          </PageBlock>
        </div>
      ))}

      {(pastMatch || nextMatch || editMode) && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          {block('home.last_match', 'Laatste wedstrijd', pastMatch && <MatchTeaser label="Laatste wedstrijd" item={pastMatch} onOpen={onOpenMatch} />)}
          {block('home.standings', 'Pouletabel', standings?.standings?.length > 0 && (
            <PouleCard title={standings.pool_name || 'Poule'} rows={standings.standings} onOpen={() => onNavigate('timeline')} />
          ))}
          {block('home.next_match', 'Volgende wedstrijd', nextMatch && <MatchTeaser label="Volgende wedstrijd" item={nextMatch} onOpen={onOpenMatch} />)}
        </div>
      )}

      {block('home.interview_candidates', 'Volgende week in de kijker', candidates.length > 0 && (
        <div className="yof-card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#a3245c', fontWeight: 700, marginBottom: 8 }}>
            Volgende week in de kijker
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {candidates.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
                  background: 'linear-gradient(160deg, #2a2a2a, #0b0b0b)', color: '#f4c81e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                }}>
                  {c.photo_url
                    ? <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : c.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 13 }}>{c.name}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#999', margin: '8px 0 0' }}>
            Zij vertellen binnenkort over de wedstrijd &mdash; hou &ldquo;In de kijker&rdquo; in de gaten!
          </p>
        </div>
      ))}

      {showSpotlightHeading && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#999', margin: '0 0 8px' }}>
            In de kijker
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {block('home.player_spotlight', 'Speelster van de week', playerSpotlight && <PlayerSpotlightCard spotlight={playerSpotlight} onOpenPlayer={onOpenPlayer} />)}
            {block('home.spotlight', 'In de kijker - berichten met Toon op Home', interviews.length > 0 && (
              <div style={{ display: 'grid', gap: 10 }}>
                {interviews.map(r => (
                  <a key={r.id} href="#" onClick={e => { e.preventDefault(); onOpenPage ? onOpenPage(r.match_ref) : onNavigate('spotlight') }}
                    className="yof-card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>&ldquo;{r.title}&rdquo;</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                      {stripFormatting(r.body).length > 90 ? stripFormatting(r.body).slice(0, 90) + '...' : stripFormatting(r.body)}
                    </p>
                  </a>
                ))}
              </div>
            ), countOptions)}
          </div>
        </div>
      )}
    </div>
  )
}
