import { useState, useEffect } from 'react'
import PublicatieTab     from './screens/PublicatieTab.jsx'
import DiscoveryTab      from './screens/DiscoveryTab.jsx'
import DistrictKaartTab  from './screens/DistrictKaartTab.jsx'
import VangerTab         from './screens/VangerTab.jsx'
import StatsTab          from './screens/StatsTab.jsx'
import ArchiefTab        from './screens/ArchiefTab.jsx'
import { getMe }         from './api.js'

export default function App() {
  const [tab,     setTab]     = useState('publicaties')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    getMe().then(me => setIsAdmin(me?.groups?.includes('admins') ?? false)).catch(() => {})
  }, [])

  const TABS = [
    { key: 'publicaties', label: 'Publicaties' },
    ...(isAdmin ? [{ key: 'kaart', label: 'Kaart' }] : []),
    { key: 'discovery',   label: 'Discovery' },
    { key: 'vanger',      label: 'Vanger' },
    { key: 'stats',       label: 'Statistieken' },
    { key: 'archief',     label: 'Archief' },
  ]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 16px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 22 }}>🏒</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Hockey Inside</h1>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1, fontFamily: 'inherit',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'publicaties' && <PublicatieTab />}
      {tab === 'kaart'       && <DistrictKaartTab onNavigateToDistrict={() => setTab('discovery')} />}
      {tab === 'discovery'   && <DiscoveryTab />}
      {tab === 'vanger'      && <VangerTab />}
      {tab === 'stats'       && <StatsTab />}
      {tab === 'archief'     && <ArchiefTab />}
    </div>
  )
}
