import { useState } from 'react'
import TournamentTab from '../beheer/TournamentTab.jsx'
import FasesTab      from '../beheer/FasesTab.jsx'

const TABS = ['Toernooi', 'Fases']

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
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabBtn(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Toernooi' && <TournamentTab active={tournament} onRefresh={() => {}} />}
      {tab === 'Fases'    && <FasesTab tid={tid} stage={stage} />}
    </div>
  )
}
