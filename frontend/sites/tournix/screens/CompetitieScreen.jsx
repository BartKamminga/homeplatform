import { useState, useEffect } from 'react'
import { getTournament } from '../api.js'
import TournamentTab  from './beheer/TournamentTab.jsx'
import TeamsTab       from './beheer/TeamsTab.jsx'
import FasesTab       from './beheer/FasesTab.jsx'
import WedstrijdenTab from './beheer/WedstrijdenTab.jsx'
import StandenTab     from './beheer/StandenTab.jsx'

const TABS_ADMIN  = ['Toernooi', 'Teams', 'Fases', 'Wedstrijden', 'Standen']
const TABS_PUBLIC = ['Standen']

export function CompetitieScreen({ tournament: initial, isAdmin, onDeleted }) {
  const [tournament, setTournament] = useState(initial)
  const [tab,        setTab]        = useState(isAdmin ? 'Toernooi' : 'Standen')

  useEffect(() => {
    setTournament(initial)
    getTournament(initial.id).then(setTournament).catch(() => {})
  }, [initial.id])

  const tabs = isAdmin ? TABS_ADMIN : TABS_PUBLIC

  return (
    <div>
      {/* tab-balk */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 16,
        borderBottom: '1px solid var(--color-border)',
        overflowX: 'auto',
      }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, fontWeight: tab === t ? 700 : 400,
            whiteSpace: 'nowrap', padding: '8px 14px',
            color: tab === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: -1,
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Toernooi'    && <TournamentTab  tournament={tournament} onDeleted={onDeleted} onUpdated={setTournament} />}
      {tab === 'Teams'       && <TeamsTab       tournament={tournament} isAdmin={isAdmin} />}
      {tab === 'Fases'       && <FasesTab       tournament={tournament} isAdmin={isAdmin} />}
      {tab === 'Wedstrijden' && <WedstrijdenTab tournament={tournament} isAdmin={isAdmin} />}
      {tab === 'Standen'     && <StandenTab     tournament={tournament} />}
    </div>
  )
}
