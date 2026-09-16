import { useState, useEffect } from 'react'
import AuthGate from '@components/AuthGate.jsx'
import './public.css'
import { getMe } from './api.js'
import PlayersAdmin from './screens/PlayersAdmin.jsx'
import TimelineAdmin from './screens/TimelineAdmin.jsx'
import AccessAdmin from './screens/AccessAdmin.jsx'
import ActionAdmin from './screens/ActionAdmin.jsx'
import PhotosAdmin from './screens/PhotosAdmin.jsx'
import ReportsAdmin from './screens/ReportsAdmin.jsx'
import MatchAdminDetail from './screens/MatchAdminDetail.jsx'
import PublicSite from './screens/PublicSite.jsx'
import ContributeReport from './screens/ContributeReport.jsx'
import EditProfile from './screens/EditProfile.jsx'

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
          { key: 'spelers', label: 'Spelers' },
          { key: 'wedstrijden', label: 'Wedstrijden & bijzondere dagen' },
          { key: 'toegang', label: 'Toegang' },
          { key: 'fotos', label: "Foto's" },
          { key: 'verslagen', label: 'Algemene berichten' },
          { key: 'actie', label: 'Actie' },
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

  const invulCode = new URLSearchParams(window.location.search).get('invul')
  const profielCode = new URLSearchParams(window.location.search).get('profiel')

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

  // Publieke site staat bewust open (besloten 2026-09-13) - geen teamcode-
  // gate meer, alleen de beheerder-module hierboven blijft achter een login.
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
