import { useState, useEffect } from 'react'
import AuthGate from '@components/AuthGate.jsx'
import './public.css'
import { getMe, validateTeamCode } from './api.js'
import { getStoredCode, storeCode } from './gate.js'
import Gate from './screens/Gate.jsx'
import PublicSite from './screens/PublicSite.jsx'
import ContributeReport from './screens/ContributeReport.jsx'
import EditProfile from './screens/EditProfile.jsx'
import { StandaloneMatchView, StandalonePlayerView } from './screens/StandaloneViews.jsx'
import { trackVisit } from './tracking.js'
import AdminStudio from './features/studio/AdminStudio.jsx'
import SectionContent from './features/studio/SectionContent.jsx'
import SectionTabs from './features/studio/SectionTabs.jsx'
import useWideScreen from './features/studio/useWideScreen.js'

function BeheerderPaneel() {
  const [me, setMe] = useState(null)
  const [error, setError] = useState('')
  const wide = useWideScreen()

  useEffect(() => {
    getMe().then(setMe).catch(e => setError(e.message))
  }, [])

  if (error) return <p style={{ color: '#c23b3b', padding: 24 }}>{error}</p>
  // Groot scherm: studio met de site links en het bewerkscherm rechts (item 1239).
  if (wide) return <AdminStudio me={me} />
  return <AdminTabs me={me} />
}

// Klein scherm: het beheer met tabbladen zoals voorheen.
function AdminTabs({ me }) {
  const [panel, setPanel] = useState({ section: 'wedstrijden' })

  // Bridge vanuit de Bekijk site-preview (adminMode) naar het echte
  // wysiwyg-bewerkscherm - 1 pad i.p.v. twee (item 1155/1156).
  const openMatch = matchRef => setPanel({ section: 'wedstrijden', matchRef })

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Beheerder</h2>
      {me && <p style={{ fontSize: 13, color: '#666' }}>Ingelogd als <strong>{me.username}</strong> ({me.email})</p>}
      <p style={{ fontSize: 12, color: '#888' }}>Tip: op een groot scherm staan de site en het beheer naast elkaar.</p>

      <div style={{ margin: '16px 0', borderBottom: '1px solid #eee' }}>
        <SectionTabs active={panel.section} onSelect={section => setPanel({ section })}
          extraTabs={[{ key: 'preview', label: 'Bekijk site', extra: true }]} />
      </div>

      {panel.section === 'preview' ? (
        <div style={{ margin: '0 -24px', border: '3px dashed #f4c81e' }}>
          <PublicSite previewMode adminMode
            onEditMatch={openMatch}
            onEditPlayer={playerId => setPanel({ section: 'spelers', playerId })}
            onEditGeneral={reportId => setPanel({ section: 'verslagen', reportId: reportId || undefined })}
          />
        </div>
      ) : (
        <SectionContent panel={panel}
          onOpenMatch={openMatch}
          onCloseMatch={() => setPanel({ section: 'wedstrijden' })}
          onSelectSection={section => setPanel({ section })}
        />
      )}
    </div>
  )
}

export default function App() {
  const [showBeheer, setShowBeheer] = useState(false)
  const [gateStatus, setGateStatus] = useState('checking') // checking | locked | unlocked

  const invulCode = new URLSearchParams(window.location.search).get('invul')
  const profielCode = new URLSearchParams(window.location.search).get('profiel')
  const entryMatchRef = new URLSearchParams(window.location.search).get('entry')
  const spelerCode = new URLSearchParams(window.location.search).get('speler')

  useEffect(() => {
    if (invulCode || profielCode || entryMatchRef || spelerCode) return // los scherm, doet zelf een (eventueel) gate-check
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
          trackVisit('site', code)
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

  if (invulCode) {
    return <ContributeReport code={invulCode} />
  }
  if (profielCode) {
    return <EditProfile code={profielCode} />
  }
  if (spelerCode) {
    return <StandalonePlayerView code={spelerCode} />
  }

  if (showBeheer) {
    return (
      <AuthGate site="yearof-mo14" siteName="MO14 à Paris">
        <BeheerderPaneel />
      </AuthGate>
    )
  }

  if (entryMatchRef) {
    return (
      <>
        <StandaloneMatchView matchRef={entryMatchRef} />
        <BeheerderLink onClick={() => setShowBeheer(true)} />
      </>
    )
  }

  if (gateStatus === 'checking') return null

  if (gateStatus === 'locked') {
    return (
      <>
        <Gate onUnlock={() => { trackVisit('site', getStoredCode()); setGateStatus('unlocked') }} />
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
