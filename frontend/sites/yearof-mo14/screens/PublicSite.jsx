import { useState } from 'react'
import PublicHome from './PublicHome.jsx'
import PublicTeam from './PublicTeam.jsx'
import PublicPlayer from './PublicPlayer.jsx'
import PublicTimeline from './PublicTimeline.jsx'
import PublicEntry from './PublicEntry.jsx'
import PublicUploadPhotos from './PublicUploadPhotos.jsx'
import PublicSpotlight from './PublicSpotlight.jsx'
import PublicAction from './PublicAction.jsx'
import PinksterWeekend from './PinksterWeekend.jsx'
import CompetitionTab from '../features/competition/CompetitionTab.jsx'
import TopklasseTab from '../features/competition/TopklasseTab.jsx'
import useCompetitionAccess from '../features/competition/useCompetitionAccess.js'

// Deeplinks (?match=<matchRef>) alleen op de echte publieke site syncen -
// niet in de admin "Bekijk site"-preview, die leeft in de admin-URL. Bewust
// een andere paramnaam dan de standalone wedstrijdlink (?entry=, zie
// App.jsx/StandaloneMatchView) - anders herkent App.jsx bij een refresh of
// het openen van deze deeplink-URL het per ongeluk als de kale, navbar-loze
// wedstrijdlink-weergave i.p.v. de volledige site op deze wedstrijd.
const syncsUrl = (previewMode, adminMode) => !previewMode && !adminMode

// studio (item 1239): de beheerstudio stuurt de view zelf aan (view +
// onViewChange) zodat het bewerkpaneel ernaast meeloopt; klikken op een
// wedstrijd/speler navigeert dan gewoon in de preview i.p.v. te bridgen.
export default function PublicSite({ previewMode = false, adminMode = false, studio = false, view: controlledView, onViewChange, onEditMatch, onEditPlayer, onEditGeneral }) {
  const [localView, setLocalView] = useState(() => {
    if (!syncsUrl(previewMode, adminMode)) return { name: 'home' }
    const entry = new URLSearchParams(window.location.search).get('match')
    return entry ? { name: 'entry', ref: entry } : { name: 'home' }
  })

  const view = controlledView || localView
  const setView = onViewChange || setLocalView

  function setUrlEntry(ref) {
    if (!syncsUrl(previewMode, adminMode)) return
    const url = new URL(window.location.href)
    if (ref) url.searchParams.set('match', ref)
    else url.searchParams.delete('match')
    window.history.replaceState({}, '', url.toString())
  }

  function nav(name) {
    setView({ name })
    setUrlEntry(null)
  }

  // adminMode: klikken op een wedstrijd/speler stapt niet naar een lokale
  // preview-view, maar bridget meteen naar het echte wysiwyg-bewerkscherm
  // (Wedstrijden/Spelers-tabblad) - 1 pad i.p.v. twee (item 1155).
  const bridge = adminMode && !studio
  // Bewerkknoppen/-labels op de pagina's alleen in het oude tabbladenbeheer; in de
  // studio is de preview precies de site en wordt rechts bewerkt (item 1239).
  const controls = adminMode && !studio
  const openMatch = bridge ? (ref => onEditMatch(ref)) : (ref => { setView({ name: 'entry', ref }); setUrlEntry(ref) })
  const openPlayer = bridge ? (id => onEditPlayer(id)) : (id => setView({ name: 'player', id }))
  // Tabs Competitie (eigen team) en Topklasse (landelijk), items 1229-1232: elk
  // een eigen featureflag; op concept staan ze nergens in het menu (item 1239).
  const competition = useCompetitionAccess()

  return (
    <div className="yof">
      <div className="yof-header">
        <div className="brand">🏑 MO14 à Paris</div>
      </div>
      <div className="yof-nav">
        {[
          { key: 'home', label: 'Home' },
          { key: 'action', label: 'Actie' },
          { key: 'spotlight', label: 'In de kijker' },
          { key: 'team', label: 'Team' },
          { key: 'timeline', label: 'Wedstrijden' },
          ...(competition.visible ? [{ key: 'competition', label: 'Competitie' }] : []),
          ...(competition.topklasseVisible ? [{ key: 'topklasse', label: 'Topklasse' }] : []),
          { key: 'upload', label: "Foto's toevoegen" },
          { key: 'pinksterweekend', label: 'Parijs weekend' },
        ].map(t => (
          <button key={t.key} className={view.name === t.key ? 'active' : ''} onClick={() => nav(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="yof-main">
        {view.name === 'home' && <PublicHome onNavigate={nav} onOpenMatch={openMatch} onOpenPlayer={openPlayer} />}
        {view.name === 'action' && <PublicAction />}
        {view.name === 'spotlight' && <PublicSpotlight onOpenMatch={openMatch} adminMode={controls} onEditGeneral={onEditGeneral} />}
        {view.name === 'team' && <PublicTeam onOpenPlayer={openPlayer} />}
        {view.name === 'player' && <PublicPlayer playerId={view.id} onBack={() => nav('team')} adminMode={controls} />}
        {view.name === 'timeline' && <PublicTimeline onOpenEntry={openMatch} />}
        {view.name === 'competition' && competition.visible && <CompetitionTab access={competition} />}
        {view.name === 'topklasse' && competition.topklasseVisible && <TopklasseTab access={competition} />}
        {studio && competition.config && (
          (view.name === 'competition' && !competition.visible) || (view.name === 'topklasse' && !competition.topklasseVisible)
        ) && (
          <p style={{ fontSize: 13, color: '#888', textAlign: 'center', marginTop: 40 }}>
            Deze pagina staat op concept - bezoekers zien hem niet, ook niet in het menu.
          </p>
        )}
        {view.name === 'entry' && <PublicEntry matchRef={view.ref} onBack={() => nav('timeline')} previewMode={previewMode} />}
        {view.name === 'upload' && <PublicUploadPhotos />}
        {view.name === 'pinksterweekend' && (
          <PinksterWeekend onBack={() => nav('home')} previewMode={previewMode} adminMode={controls} onEditMatch={onEditMatch} />
        )}
      </div>
    </div>
  )
}
