import { useState, useEffect } from 'react'
import GroupChip from '@components/GroupChip.jsx'
import { getMe, getTournamentCompetitionStandings } from './api.js'
import { SeizoenScreen }    from './screens/SeizoenScreen.jsx'
import { TournooiScreen }   from './screens/TournooiScreen.jsx'
import { CompetitieScreen } from './screens/CompetitieScreen.jsx'
import { VangerButton }     from './components/VangerButton.jsx'

// 'seizoen' | 'tournooi' | 'competitie'

export default function App() {
  const [screen,     setScreen]     = useState('seizoen')
  const [tournament, setTournament] = useState(null)
  const [isAdmin,    setIsAdmin]    = useState(false)

  useEffect(() => {
    getMe().then(me => setIsAdmin(!!me?.is_admin)).catch(() => {})
  }, [])

  async function openTournament(t) {
    setTournament(t)
    // Kijk of dit toernooi gekoppelde competities heeft → CompetitieScreen
    try {
      const data = await getTournamentCompetitionStandings(t.id)
      const hasComps = data.fases && data.fases.some(f => f.competitions.length > 0)
      setScreen(hasComps ? 'competitie' : 'tournooi')
    } catch {
      setScreen('tournooi')
    }
  }

  function goBack() {
    setScreen('seizoen')
    setTournament(null)
  }

  const showBack = screen !== 'seizoen' && tournament

  return (
    <div className="app-root">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="app-header">
        {showBack ? (
          <>
            <button className="back-btn" onClick={goBack}>← Terug</button>
            <span className="header-tournament-name">{tournament.name}</span>
            <div className="header-right">
              {screen === 'tournooi' && <VangerButton tournamentId={tournament.id} />}
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

      {/* ── Screens ─────────────────────────────────────────────────── */}
      {screen === 'competitie' && tournament ? (
        <div className="main-content">
          <CompetitieScreen
            tournament={tournament}
            isAdmin={isAdmin}
          />
        </div>
      ) : screen === 'tournooi' && tournament ? (
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
