import { useState, useEffect } from 'react'
import { validateTeamCode, validateShortLink, getPlayerLinkView, getActionSettings } from '../api.js'
import { getStoredCode, storeCode, setScopedCode } from '../gate.js'
import { trackVisit } from '../tracking.js'
import Gate from './Gate.jsx'
import PublicEntry from './PublicEntry.jsx'
import PlayerProfileCard from './PlayerProfileCard.jsx'
import PlayerCircleCard from './PlayerCircleCard.jsx'
import { FavoritesBlock } from './PlayerFavorites.jsx'
import Thermometer from './Thermometer.jsx'
import SponsorList from './SponsorList.jsx'
import PageBlock from '../features/blocks/PageBlock.jsx'

// Losse pagina's zonder navigatiebalk voor de Vrienden-van-WhatsApp (item
// 1186): een wedstrijdlink (?entry=<ref>&link=<code>) of spelerslink
// (?speler=<code>). De link-code zelf is het toegangstoken voor alleen die
// pagina - de teamcode komt hier nooit in de browser van een vriend(in).

function Shell({ children }) {
  return (
    <div className="yof">
      <div className="yof-header"><div className="brand">🏑 MO14 à Paris</div></div>
      <div className="yof-main">{children}</div>
    </div>
  )
}

function LinkExpired() {
  return (
    <div className="yof yof-gate">
      <div className="yof-gate-card">
        <div style={{ fontSize: 32 }}>⏳</div>
        <h1 style={{ fontSize: 18 }}>Deze link is verlopen</h1>
        <p style={{ fontSize: 14, color: '#666' }}>
          Linkjes zijn een paar dagen geldig. Vraag in de groep om een nieuwe link.
        </p>
      </div>
    </div>
  )
}

// Inzamelblok (thermometer + betaallink) - vrienden zijn potentiele donateurs.
function ActionBlock() {
  const [settings, setSettings] = useState(null)
  useEffect(() => { getActionSettings().then(setSettings).catch(() => {}) }, [])
  if (!settings) return null
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ background: '#12203c', borderRadius: 16, padding: '18px 20px', marginBottom: 10, color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Steun de teamtrip naar Parijs</div>
        <Thermometer settings={settings} />
      </div>
      {settings.donation_url && (
        <a className="yof-btn" href={settings.donation_url} target="_blank" rel="noreferrer"
          style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          Doneer aan de actie
        </a>
      )}
    </div>
  )
}

export function StandaloneMatchView({ matchRef }) {
  const [status, setStatus] = useState('checking') // checking | locked | expired | unlocked

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const linkCode = (params.get('link') || '').trim().toLowerCase()
    const urlCode = params.get('code')
    const teamCode = (urlCode || getStoredCode() || '').trim().toLowerCase()

    async function check() {
      if (linkCode) {
        const res = await validateShortLink(linkCode).catch(() => ({ valid: false }))
        if (res.valid && res.link_type === 'match' && res.match_ref === matchRef) {
          setScopedCode(linkCode)
          trackVisit('match', linkCode)
          return 'unlocked'
        }
      }
      // Ouders met een geldige teamcode zien de wedstrijd altijd
      if (teamCode) {
        const res = await validateTeamCode(teamCode).catch(() => ({ valid: false }))
        if (res.valid) {
          storeCode(teamCode)
          if (urlCode) {
            const url = new URL(window.location.href)
            url.searchParams.delete('code')
            window.history.replaceState({}, '', url.toString())
          }
          return 'unlocked'
        }
      }
      return linkCode ? 'expired' : 'locked'
    }
    check().then(setStatus)
  }, [matchRef])

  if (status === 'checking') return null
  if (status === 'expired') return <LinkExpired />
  if (status === 'locked') return <Gate onUnlock={() => setStatus('unlocked')} />
  return <FanMatchView matchRef={matchRef} />
}

// Wat een fan via de wedstrijdlink ziet: geen menu, alleen wat op de
// wedstrijdlink staat, plus het inzamelblok. Ook de fan-weergave in de
// beheerstudio (item 1239).
export function FanMatchView({ matchRef }) {
  return (
    <Shell>
      <PublicEntry matchRef={matchRef} standalone />
      <PageBlock id="action.thermometer"><ActionBlock /></PageBlock>
    </Shell>
  )
}

// track=false: fan-weergave in de beheerstudio telt niet als bezoek (item 1239).
export function StandalonePlayerView({ code, track = true }) {
  const [player, setPlayer] = useState(null)
  const [status, setStatus] = useState('checking') // checking | expired | ok

  useEffect(() => {
    getPlayerLinkView(code)
      .then(p => {
        setPlayer(p)
        setStatus('ok')
        if (track) trackVisit('player', code)
      })
      .catch(() => setStatus('expired'))
  }, [code])

  if (status === 'checking') return null
  if (status === 'expired') return <LinkExpired />
  return (
    <Shell>
      <PlayerProfileCard player={player} />
      <PlayerCircleCard player={player} />
      <FavoritesBlock photos={player.favorite_photos} title={`Foto's van ${player.nickname || player.name}`} showLikes={false} />
      <PageBlock id="action.thermometer"><ActionBlock /></PageBlock>
      <PageBlock id="action.sponsors"><SponsorList /></PageBlock>
    </Shell>
  )
}
