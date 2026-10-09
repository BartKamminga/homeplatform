import { useState } from 'react'
import PublicHome from './PublicHome.jsx'
import PublicTeam from './PublicTeam.jsx'
import PublicPlayer from './PublicPlayer.jsx'
import PublicTimeline from './PublicTimeline.jsx'
import PublicEntry from './PublicEntry.jsx'
import PublicUploadPhotos from './PublicUploadPhotos.jsx'
import PublicAction from './PublicAction.jsx'
import CustomPage from '../features/pages/CustomPage.jsx'
import BrandMark from '../features/brand/BrandMark.jsx'
import useCustomPages, { SPOTLIGHT_PAGE, viewForPageRef } from '../features/pages/useCustomPages.js'
import CompetitionTab from '../features/competition/CompetitionTab.jsx'
import TopklasseTab from '../features/competition/TopklasseTab.jsx'
import useCompetitionAccess from '../features/competition/useCompetitionAccess.js'
import usePageBlocks from '../features/blocks/usePageBlocks.js'
import usePageMeta from '../features/pages/pageMeta.js'

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
export default function PublicSite({ previewMode = false, adminMode = false, studio = false, view: controlledView, onViewChange, onEditMatch, onEditPlayer }) {
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
  // Concepten (verslagen, foto's) alleen in het oude Bekijk site; de studio-preview toont wat bezoekers zien.
  const showConcepts = previewMode && !studio
  const openMatch = bridge ? (ref => onEditMatch(ref)) : (ref => { setView({ name: 'entry', ref }); setUrlEntry(ref) })
  const openPlayer = bridge ? (id => onEditPlayer(id)) : (id => setView({ name: 'player', id }))
  // Tabs Competitie (eigen team) en Topklasse (landelijk), items 1229-1232: elk
  // een eigen featureflag; op concept staan ze nergens in het menu (item 1239).
  const competition = useCompetitionAccess()
  // Overige pagina's live/concept (item 1239): concept = niet in het menu en
  // leeg als je er toch komt - voor iedereen gelijk, ook in de studio-preview.
  const { conceptBlocks } = usePageBlocks()
  // Eigen pagina's (max 3, bv. Parijs weekend): view { name: 'custom', id }.
  const customPages = useCustomPages()
  const meta = usePageMeta() // naam/kop per vaste pagina (item 1248)
  const customPage = view.name === 'custom' ? customPages.find(p => p.id === view.id) : null
  const pageLive = name => {
    if (name === 'competition') return competition.visible
    if (name === 'topklasse') return competition.topklasseVisible
    return !conceptBlocks.has(`page.${name}`)
  }
  const show = name => view.name === name && pageLive(name)

  return (
    <div className="yof">
      {/* Kop + menu in 1 blok dat bij scrollen bovenaan blijft staan */}
      <div className="yof-top">
      <div className="yof-header">
        {/* Klik op het logo = Home (item 1245) - scheelt een tab in het menu */}
        <BrandMark onClick={() => nav('home')} />
      </div>
      <div className="yof-nav">
        {[
          'action', 'spotlight', 'team', 'timeline', 'competition', 'topklasse', 'upload',
        ].map(key => ({ key, label: meta(key).label })).filter(t => pageLive(t.key)).map(t => (
          <button key={t.key} className={view.name === t.key ? 'active' : ''} onClick={() => nav(t.key)}>
            {t.label}
          </button>
        ))}
        {customPages.filter(p => pageLive(p.id)).map(p => (
          <button key={p.id} className={view.name === 'custom' && view.id === p.id ? 'active' : ''}
            onClick={() => { setView({ name: 'custom', id: p.id }); setUrlEntry(null) }}>
            {p.label}
          </button>
        ))}
      </div>
      </div>
      <div className="yof-main">
        {view.name === 'home' && <PublicHome onNavigate={nav} onOpenMatch={openMatch} onOpenPlayer={openPlayer}
          onOpenPage={ref => { const v = viewForPageRef(ref); if (v) { setView(v); setUrlEntry(null) } }} />}
        {show('action') && <PublicAction />}
        {show('spotlight') && <CustomPage page={{ ...SPOTLIGHT_PAGE, ...meta('spotlight') }} onBack={() => nav('home')} previewMode={showConcepts} />}
        {show('team') && <PublicTeam onOpenPlayer={openPlayer} />}
        {view.name === 'player' && <PublicPlayer playerId={view.id} onBack={() => nav('team')} adminMode={controls} />}
        {show('timeline') && <PublicTimeline onOpenEntry={openMatch} />}
        {show('competition') && <CompetitionTab access={competition} />}
        {show('topklasse') && <TopklasseTab access={competition} />}
        {!['home', 'entry', 'player', 'custom'].includes(view.name) && !pageLive(view.name) && (competition.config || !['competition', 'topklasse'].includes(view.name)) && (
          <p style={{ fontSize: 13, color: '#888', textAlign: 'center', marginTop: 40 }}>
            Deze pagina is (nog) niet beschikbaar.
          </p>
        )}
        {view.name === 'entry' && <PublicEntry matchRef={view.ref} onBack={() => nav('timeline')} previewMode={showConcepts} />}
        {show('upload') && <PublicUploadPhotos />}
        {customPage && pageLive(customPage.id) && (
          <CustomPage key={customPage.id} page={customPage} onBack={() => nav('home')} previewMode={showConcepts} />
        )}
        {view.name === 'custom' && customPages.length > 0 && !(customPage && pageLive(customPage.id)) && (
          <p style={{ fontSize: 13, color: '#888', textAlign: 'center', marginTop: 40 }}>Deze pagina is (nog) niet beschikbaar.</p>
        )}
      </div>
    </div>
  )
}
