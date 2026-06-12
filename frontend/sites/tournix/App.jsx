import { useState, useEffect } from 'react'
import OverzichtPage  from './pages/OverzichtPage.jsx'
import ProgrammaPage  from './pages/ProgrammaPage.jsx'
import VoorspelPage   from './pages/VoorspelPage.jsx'
import BeheerPage     from './pages/BeheerPage.jsx'
import GroupChip      from '@components/GroupChip.jsx'
import { getTournaments } from './api.js'

const TABS = [
  { id: 'overzicht', label: 'Overzicht', icon: 'ti-trophy'   },
  { id: 'programma', label: 'Programma', icon: 'ti-calendar' },
  { id: 'voorspel',  label: 'Voorspellen', icon: 'ti-target' },
  { id: 'beheer',    label: 'Beheer',    icon: 'ti-settings' },
]

const STAGE_STYLE = {
  inregel:   { background: 'var(--color-primary)', color: '#fff' },
  test:      { background: 'var(--color-warning)',  color: '#fff' },
  productie: { background: 'var(--color-success)',  color: '#fff' },
}

export default function App() {
  const [tab,        setTab]        = useState('overzicht')
  const [tournament, setTournament] = useState(null)

  function loadActiveTournament() {
    getTournaments()
      .then(list => {
        const act = list.find(t => t.status === 'active') ?? list[0] ?? null
        setTournament(act)
      })
      .catch(() => {})
  }

  useEffect(() => { loadActiveTournament() }, [])

  const stage = tournament?.stage ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--color-background)', color: 'var(--color-text)' }}>
      {/* Header */}
      <header style={{
        padding: '0 20px', height: 52, borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--color-surface)',
      }}>
        <span style={{ fontSize: 20 }}>🏆</span>
        <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>Tournix</span>

        {/* Stage badge */}
        {stage && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            ...STAGE_STYLE[stage],
          }}>
            {stage === 'inregel' ? 'Inregel' : stage === 'test' ? 'Test' : 'Productie'}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <GroupChip app="tournix" />
          <a href="/account/groups?back=/tournix/" style={{
            fontSize: 12, color: 'var(--color-text-muted)',
            textDecoration: 'none', padding: '4px 10px',
            border: '1px solid var(--color-border)', borderRadius: 8,
          }}>Account</a>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 72 }}>
        {tab === 'overzicht' && <OverzichtPage  onTab={setTab} stage={stage} onTournamentChange={loadActiveTournament} />}
        {tab === 'programma' && <ProgrammaPage  stage={stage} />}
        {tab === 'voorspel'  && <VoorspelPage   stage={stage} />}
        {tab === 'beheer'    && <BeheerPage      stage={stage} onStageChange={loadActiveTournament} />}
      </main>

      {/* Tab bar */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 64, background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'stretch',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, border: 'none', background: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              color: tab === t.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontFamily: 'inherit',
            }}
          >
            <i className={`ti ${t.icon}`} style={{ fontSize: 22 }} />
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 600 : 400 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
