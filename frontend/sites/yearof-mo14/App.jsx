import { useState, useEffect } from 'react'
import AuthGate from '@components/AuthGate.jsx'
import { getMe } from './api.js'

function BeheerderPaneel() {
  const [me, setMe] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getMe().then(setMe).catch(e => setError(e.message))
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Beheerder</h2>
      {error && <p style={{ color: '#c23b3b' }}>{error}</p>}
      {me && <p>Ingelogd als <strong>{me.username}</strong> ({me.email})</p>}
      {!me && !error && <p>Laden...</p>}
    </div>
  )
}

export default function App() {
  const [showBeheer, setShowBeheer] = useState(false)

  if (showBeheer) {
    return (
      <AuthGate site="yearof-mo14" siteName="MO14 à Paris">
        <BeheerderPaneel />
      </AuthGate>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      background: '#12203c', color: 'white', textAlign: 'center', padding: 24,
    }}>
      <div style={{ fontSize: 40 }}>🏑</div>
      <h1 style={{ margin: 0, fontSize: 28 }}>MO14 à Paris</h1>
      <p style={{ color: '#c7cfe3', maxWidth: 380 }}>
        Binnenkort hier: interviews, spelersprofielen en wedstrijden van MO14-1,
        op weg naar Parijs.
      </p>
      <button
        onClick={() => setShowBeheer(true)}
        style={{
          marginTop: 8, padding: '8px 18px', borderRadius: 999, border: 'none',
          background: '#f4c81e', color: '#12100a', fontWeight: 700, cursor: 'pointer',
        }}
      >
        Beheerder inloggen
      </button>
    </div>
  )
}
