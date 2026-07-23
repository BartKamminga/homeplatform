import { useState, useEffect } from 'react'
import GroupChip from '@components/GroupChip.jsx'
import { getMe } from './api.js'
import { SeizoenScreen }  from './screens/SeizoenScreen.jsx'
import { TournooiScreen } from './screens/TournooiScreen.jsx'
import { VangerButton }   from './components/VangerButton.jsx'

export default function App() {
  const [screen,     setScreen]     = useState('seizoen') // 'seizoen' | 'tournooi'
  const [tournament, setTournament] = useState(null)
  const [isAdmin,    setIsAdmin]    = useState(false)

  useEffect(() => {
    getMe().then(me => setIsAdmin(!!me?.is_admin)).catch(() => {})
  }, [])

  function openTournament(t) {
    setTournament(t)
    setScreen('tournooi')
  }

  function goBack() {
    setScreen('seizoen')
  }

  const isTournooi = screen === 'tournooi' && tournament

  return (
    <div className="app-root">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="app-header">
        {isTournooi ? (
          <>
            <button className="back-btn" onClick={goBack}>← Terug</button>
            <span className="header-tournament-name">{tournament.name}</span>
            <div className="header-right">
              <VangerButton tournamentId={tournament.id} />
              <GroupChip app="tournix" />
            </div>
          </>
        ) : (
          <>
            <span className="app-logo">🏑</span>
            <span className="app-title">Tournix</span>
            <div className="header-right">
              <GroupChip app="tournix" />
              <a
                href="/account/groups?back=/tournix/"
                className="icon-btn"
                title="Account"
              >
                👤
              </a>
            </div>
          </>
        )}
      </header>

      {/* ── Screens ─────────────────────────────────────────────────── */}
      {isTournooi ? (
        <TournooiScreen
          tournament={tournament}
          onBack={goBack}
          isAdmin={isAdmin}
        />
      ) : (
        <SeizoenScreen
          onOpenTournament={openTournament}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}
