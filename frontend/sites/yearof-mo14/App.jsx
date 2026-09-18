import { useState, useEffect } from 'react'
import AuthGate from '@components/AuthGate.jsx'
import './public.css'
import { getMe, validateTeamCode } from './api.js'
import { getStoredCode, storeCode } from './gate.js'
import PlayersAdmin from './screens/PlayersAdmin.jsx'
import TimelineAdmin from './screens/TimelineAdmin.jsx'
import AccessAdmin from './screens/AccessAdmin.jsx'
import ActionAdmin from './screens/ActionAdmin.jsx'
import PhotosAdmin from './screens/PhotosAdmin.jsx'
import ReportsAdmin from './screens/ReportsAdmin.jsx'
import MatchAdminDetail from './screens/MatchAdminDetail.jsx'
import Gate from './screens/Gate.jsx'
import PublicSite from './screens/PublicSite.jsx'
import PublicEntry from './screens/PublicEntry.jsx'
import ContributeReport from './screens/ContributeReport.jsx'
import EditProfile from './screens/EditProfile.jsx'

// "Wedstrijdlink" (?entry=<matchRef>, evt. met &code=): deelt dezelfde
// teamcode-levensduur als de rest van de site (zelfde gate-check als
// hieronder in App()), maar toont bewust GEEN navigatiebalk - alleen die
// ene wedstrijdpagina. Zo kan een wedstrijd breed gedeeld worden zonder
// de rest van de site (spelersprofielen, andere wedstrijden) te ontsluiten.
function StandaloneMatchView({ matchRef }) {
  const [status, setStatus] = useState('checking') // checking | locked | unlocked

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlCode = params.get('code')
    const code = (urlCode || getStoredCode() || '').trim().toLowerCase()
    if (!code) { setStatus('locked'); return }
    validateTeamCode(code)
      .then(res => {
        if (res.valid) {
          storeCode(code)
          if (urlCode) {
            const url = new URL(window.location.href)
            url.searchParams.delete('code')
            window.history.replaceState({}, '', url.toString())
          }
        }
        setStatus(res.valid ? 'unlocked' : 'locked')
      })
      .catch(() => setStatus('locked'))
  }, [])

  if (status === 'checking') return null
  if (status === 'locked') return <Gate onUnlock={() => setStatus('unlocked')} />
  return (
    <div className="yof">
      <div className="yof-header"><div className="brand">🏑 MO14 à Paris</div></div>
      <div className="yof-main">
        <PublicEntry matchRef={matchRef} standalone />
      </div>
    </div>
  )
}

function BeheerderPaneel() {
  const [me, setMe] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('spelers')
  const [matchDetailRef, setMatchDetailRef] = useState(null)
  const [playerEditId, setPlayerEditId] = useState(null)
  const [generalEditId, setGeneralEditId] = useState(null)

  useEffect(() => {
    getMe().then(setMe).catch(e => setError(e.message))
  }, [])

  // Bridge vanuit de Bekijk site-preview (adminMode) naar het echte
  // wysiwyg-bewerkscherm - 1 pad i.p.v. twee (item 1155/1156).
  function openMatchFromPreview(matchRef) {
    setTab('wedstrijden')
    setMatchDetailRef(matchRef)
  }
  function openPlayerFromPreview(playerId) {
    setTab('spelers')
    setPlayerEditId(playerId)
  }
  function openGeneralFromPreview(reportId) {
    setTab('verslagen')
    setGeneralEditId(reportId || null)
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Beheerder</h2>
      {error && <p style={{ color: '#c23b3b' }}>{error}</p>}
      {me && <p style={{ fontSize: 13, color: '#666' }}>Ingelogd als <strong>{me.username}</strong> ({me.email})</p>}

      <div style={{ display: 'flex', gap: 4, margin: '16px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap' }}>
        {[
          { key: 'wedstrijden', label: 'Wedstrijden & bijzondere dagen' },
          { key: 'spelers', label: 'Spelers' },
          { key: 'fotos', label: "Foto's" },
          { key: 'verslagen', label: 'Algemene berichten' },
          { key: 'actie', label: 'Actie' },
          { key: 'toegang', label: 'Toegang' },
          { key: 'preview', label: 'Bekijk site' },
        ].map(t => (
          <button key={t.key} onClick={() => {
            setTab(t.key); setMatchDetailRef(null); setPlayerEditId(null); setGeneralEditId(null)
          }} style={{
            padding: '8px 14px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
            background: 'transparent', border: 'none', cursor: 'pointer',
            borderBottom: tab === t.key ? '2px solid #f4c81e' : '2px solid transparent',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'spelers' && <PlayersAdmin initialEditId={playerEditId} />}
      {tab === 'wedstrijden' && (
        matchDetailRef
          ? <MatchAdminDetail matchRef={matchDetailRef} onBack={() => setMatchDetailRef(null)} />
          : <TimelineAdmin onOpenMatch={setMatchDetailRef} />
      )}
      {tab === 'toegang' && <AccessAdmin />}
      {tab === 'fotos' && <PhotosAdmin />}
      {tab === 'verslagen' && <ReportsAdmin initialEditId={generalEditId} />}
      {tab === 'actie' && <ActionAdmin />}
      {tab === 'preview' && (
        <div style={{ margin: '0 -24px', border: '3px dashed #f4c81e' }}>
          <PublicSite previewMode adminMode
            onEditMatch={openMatchFromPreview}
            onEditPlayer={openPlayerFromPreview}
            onEditGeneral={openGeneralFromPreview}
          />
        </div>
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

  useEffect(() => {
    if (invulCode || profielCode || entryMatchRef) return // los scherm, doet zelf een (eventueel) gate-check
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

  if (invulCode) {
    return <ContributeReport code={invulCode} />
  }
  if (profielCode) {
    return <EditProfile code={profielCode} />
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
