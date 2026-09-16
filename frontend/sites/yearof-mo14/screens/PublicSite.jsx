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

export default function PublicSite({ previewMode = false, adminMode = false, onEditMatch, onEditPlayer, onEditGeneral }) {
  const [view, setView] = useState({ name: 'home' })

  function nav(name) {
    setView({ name })
  }

  // adminMode: klikken op een wedstrijd/speler stapt niet naar een lokale
  // preview-view, maar bridget meteen naar het echte wysiwyg-bewerkscherm
  // (Wedstrijden/Spelers-tabblad) - 1 pad i.p.v. twee (item 1155).
  const openMatch = adminMode ? (ref => onEditMatch(ref)) : (ref => setView({ name: 'entry', ref }))
  const openPlayer = adminMode ? (id => onEditPlayer(id)) : (id => setView({ name: 'player', id }))

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
          { key: 'upload', label: "Foto's toevoegen" },
          { key: 'pinksterweekend', label: 'Parijs weekend' },
        ].map(t => (
          <button key={t.key} className={view.name === t.key ? 'active' : ''} onClick={() => nav(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="yof-main">
        {view.name === 'home' && <PublicHome onNavigate={nav} onOpenMatch={openMatch} />}
        {view.name === 'action' && <PublicAction />}
        {view.name === 'spotlight' && <PublicSpotlight onOpenMatch={openMatch} adminMode={adminMode} onEditGeneral={onEditGeneral} />}
        {view.name === 'team' && <PublicTeam onOpenPlayer={openPlayer} />}
        {view.name === 'player' && <PublicPlayer playerId={view.id} onBack={() => nav('team')} />}
        {view.name === 'timeline' && <PublicTimeline onOpenEntry={openMatch} />}
        {view.name === 'entry' && <PublicEntry matchRef={view.ref} onBack={() => nav('timeline')} previewMode={previewMode} />}
        {view.name === 'upload' && <PublicUploadPhotos />}
        {view.name === 'pinksterweekend' && (
          <PinksterWeekend onBack={() => nav('home')} previewMode={previewMode} adminMode={adminMode} onEditMatch={onEditMatch} />
        )}
      </div>
    </div>
  )
}
