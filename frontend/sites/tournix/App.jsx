import { useState, useEffect } from 'react'
import GroupChip from '@components/GroupChip.jsx'
import { getMe } from './api.js'
import { SeizoenScreen }    from './screens/SeizoenScreen.jsx'
import { CompetitieScreen } from './screens/CompetitieScreen.jsx'

export default function App() {
  const [screen,     setScreen]     = useState('seizoen')
  const [tournament, setTournament] = useState(null)
  const [isAdmin,    setIsAdmin]    = useState(false)

  useEffect(() => {
    getMe().then(me => setIsAdmin(me?.groups?.includes('admins') ?? false)).catch(() => {})
  }, [])

  function openTournament(t) {
    setTournament(t)
    setScreen('competitie')
  }

  function goBack() {
    setScreen('seizoen')
    setTournament(null)
  }

  const showBack = screen !== 'seizoen' && tournament

  return (
    <div className="app-root">
      <header className="app-header">
        {showBack ? (
          <>
            <button className="back-btn" onClick={goBack}>← Terug</button>
            <span className="header-tournament-name">{tournament.name}</span>
            <div className="header-right">
              <GroupChip app="tournix" />
            </div>
          </>
        ) : (
          <>
            <span className="app-logo">🏑</span>
            <span className="app-title">Tournix</span>
            <div className="header-right">
              <GroupChip app="tournix" />
              <a href="/account/groups?back=/tournix/" className="icon-btn" title="Account">👤</a>
            </div>
          </>
        )}
      </header>

      {screen === 'competitie' && tournament ? (
        <div className="main-content">
          <CompetitieScreen tournament={tournament} isAdmin={isAdmin} />
        </div>
      ) : (
        <SeizoenScreen onOpenTournament={openTournament} isAdmin={isAdmin} />
      )}
    </div>
  )
}
