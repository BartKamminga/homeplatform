import { useState } from 'react'
import TournamentTab from '../beheer/TournamentTab.jsx'
import FasesTab      from '../beheer/FasesTab.jsx'
import DiscoveryTab  from '../beheer/DiscoveryTab.jsx'

const TABS_TOURNAMENT = ['Toernooi', 'Fases']
const TABS_GLOBAL     = ['Discovery', 'Vanger']

export default function BeheerPage({ tournament }) {
  const [tab, setTab] = useState('Toernooi')

  const tid   = tournament?.id ?? null
  const stage = tournament?.stage ?? null

  function tabBtn(t) {
    return {
      padding: '6px 14px', fontSize: 12, fontWeight: tab === t ? 600 : 400,
      borderRadius: 20, fontFamily: 'inherit', cursor: 'pointer',
      border: `1px solid ${tab === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
      background: tab === t ? 'var(--color-primary)' : 'var(--color-surface)',
      color: tab === t ? '#fff' : 'var(--color-text)',
    }
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 2, whiteSpace: 'nowrap' }}>Toernooi</span>
          {TABS_TOURNAMENT.map(t => (
            <button key={t} onClick={() => setTab(t)} style={tabBtn(t)}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 2, whiteSpace: 'nowrap' }}>Algemeen</span>
          {TABS_GLOBAL.map(t => (
            <button key={t} onClick={() => setTab(t)} style={tabBtn(t)}>{t}</button>
          ))}
        </div>
      </div>

      {tab === 'Toernooi'  && <TournamentTab active={tournament} onRefresh={() => {}} />}
      {tab === 'Fases'     && <FasesTab tid={tid} stage={stage} />}
      {tab === 'Discovery' && <DiscoveryTab view="resultaten" />}
      {tab === 'Vanger'    && <DiscoveryTab view="vanger" />}
    </div>
  )
}
