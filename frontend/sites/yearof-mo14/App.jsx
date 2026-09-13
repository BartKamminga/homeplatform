import { useState, useEffect } from 'react'
import AuthGate from '@components/AuthGate.jsx'
import './public.css'
import { getMe } from './api.js'
import PlayersAdmin from './screens/PlayersAdmin.jsx'
import TimelineAdmin from './screens/TimelineAdmin.jsx'
import AccessAdmin from './screens/AccessAdmin.jsx'
import RoadmapAdmin from './screens/RoadmapAdmin.jsx'
import PhotosAdmin from './screens/PhotosAdmin.jsx'
import Gate from './screens/Gate.jsx'
import PublicSite from './screens/PublicSite.jsx'
import { getStoredCode, storeCode } from './gate.js'
import { validateTeamCode } from './api.js'

function BeheerderPaneel() {
  const [me, setMe] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('spelers')

  useEffect(() => {
    getMe().then(setMe).catch(e => setError(e.message))
  }, [])

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Beheerder</h2>
      {error && <p style={{ color: '#c23b3b' }}>{error}</p>}
      {me && <p style={{ fontSize: 13, color: '#666' }}>Ingelogd als <strong>{me.username}</strong> ({me.email})</p>}

      <div style={{ display: 'flex', gap: 4, margin: '16px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap' }}>
        {[
          { key: 'spelers', label: 'Spelers' },
          { key: 'wedstrijden', label: 'Wedstrijden & bijzondere dagen' },
          { key: 'toegang', label: 'Toegang' },
          { key: 'fotos', label: "Foto's" },
          { key: 'roadmap', label: 'Roadmap' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 14px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
            background: 'transparent', border: 'none', cursor: 'pointer',
            borderBottom: tab === t.key ? '2px solid #f4c81e' : '2px solid transparent',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'spelers' && <PlayersAdmin />}
      {tab === 'wedstrijden' && <TimelineAdmin />}
      {tab === 'toegang' && <AccessAdmin />}
      {tab === 'fotos' && <PhotosAdmin />}
      {tab === 'roadmap' && <RoadmapAdmin />}
    </div>
  )
}

export default function App() {
  const [showBeheer, setShowBeheer] = useState(false)
  const [gateStatus, setGateStatus] = useState('checking') // checking | locked | unlocked

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlCode = params.get('code')
    const code = (urlCode || getStoredCode() || '').trim().toLowerCase()

    if (!code) {
      setGateStatus('locked')
      return
    }
    validateTeamCode(code)
      .then(res => {
        if (res.valid) {
          storeCode(code)
          if (urlCode) {
            // code niet zichtbaar in de URL laten staan (adresbalk/geschiedenis/screenshots)
            const url = new URL(window.location.href)
            url.searchParams.delete('code')
            window.history.replaceState({}, '', url.toString())
          }
        }
        setGateStatus(res.valid ? 'unlocked' : 'locked')
      })
      .catch(() => setGateStatus('locked'))
  }, [])

  if (showBeheer) {
    return (
      <AuthGate site="yearof-mo14" siteName="MO14 à Paris">
        <BeheerderPaneel />
      </AuthGate>
    )
  }

  if (gateStatus === 'checking') return null

  if (gateStatus === 'locked') {
    return (
      <>
        <Gate onUnlock={() => setGateStatus('unlocked')} />
        <BeheerderLink onClick={() => setShowBeheer(true)} />
      </>
    )
  }

  return (
    <>
      <PublicSite />
      <BeheerderLink onClick={() => setShowBeheer(true)} />
    </>
  )
}

function BeheerderLink({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed', bottom: 10, right: 10, fontSize: 11, color: '#999',
        background: 'rgba(255,255,255,.8)', border: '1px solid #ddd', borderRadius: 8,
        padding: '4px 8px', cursor: 'pointer', zIndex: 10,
      }}
    >
      beheerder
    </button>
  )
}
