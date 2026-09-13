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

export default function PublicSite({ previewMode = false }) {
  const [view, setView] = useState({ name: 'home' })

  function nav(name) {
    setView({ name })
  }

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
        {view.name === 'home' && <PublicHome onNavigate={nav} onOpenMatch={ref => setView({ name: 'entry', ref })} />}
        {view.name === 'action' && <PublicAction />}
        {view.name === 'spotlight' && <PublicSpotlight onOpenMatch={ref => setView({ name: 'entry', ref })} />}
        {view.name === 'team' && <PublicTeam onOpenPlayer={id => setView({ name: 'player', id })} />}
        {view.name === 'player' && <PublicPlayer playerId={view.id} onBack={() => nav('team')} />}
        {view.name === 'timeline' && <PublicTimeline onOpenEntry={ref => setView({ name: 'entry', ref })} />}
        {view.name === 'entry' && <PublicEntry matchRef={view.ref} onBack={() => nav('timeline')} previewMode={previewMode} />}
        {view.name === 'upload' && <PublicUploadPhotos />}
        {view.name === 'pinksterweekend' && <PinksterWeekend onBack={() => nav('home')} previewMode={previewMode} />}
      </div>
    </div>
  )
}
