import { useState, useEffect } from 'react'
import { getTournamentCompetitionStandings, deleteTournament, removeTournamentComp, syncCompetition } from '../api.js'
import CompetitiesTab    from './CompetitiesTab.jsx'
import CompetitieDetail  from './competitie/CompetitieDetail.jsx'
import CompetitieList    from './competitie/CompetitieList.jsx'

export function CompetitieScreen({ tournament, isAdmin, onDeleted }) {
  const [view,         setView]         = useState('overzicht')
  const [compsData,    setCompsData]    = useState(null)
  const [selectedComp, setSelectedComp] = useState(null)
  const [rescanning,   setRescanning]   = useState(false)
  const [rescanMsg,    setRescanMsg]    = useState('')

  function reload() {
    getTournamentCompetitionStandings(tournament.id)
      .then(data => setCompsData(data.competitions || []))
      .catch(() => setCompsData([]))
  }

  useEffect(() => { setSelectedComp(null); setView('overzicht'); reload() }, [tournament.id])

  function handleBack() { setSelectedComp(null); reload() }

  async function handleDeletePublication() {
    if (!window.confirm(`Publicatie "${tournament.name}" definitief verwijderen?`)) return
    try { await deleteTournament(tournament.id); onDeleted?.() } catch { alert('Verwijderen mislukt') }
  }

  async function handleRescanAll() {
    if (!compsData?.length) return
    setRescanning(true)
    setRescanMsg('')
    try {
      await Promise.all(compsData.map(c => syncCompetition(c.id)))
      setRescanMsg(`${compsData.length} competities herladen`)
      setTimeout(() => setRescanMsg(''), 4000)
      reload()
    } catch { setRescanMsg('Rescan mislukt'); setTimeout(() => setRescanMsg(''), 3000) }
    finally { setRescanning(false) }
  }

  async function handleRemoveComp(linkId, compName) {
    if (!window.confirm(`"${compName}" ontkoppelen van deze publicatie?`)) return
    try { await removeTournamentComp(tournament.id, linkId); reload() } catch { alert('Ontkoppelen mislukt') }
  }

  if (selectedComp) {
    return <CompetitieDetail comp={selectedComp} isAdmin={isAdmin} onBack={handleBack} />
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tournament.name}</div>
          {tournament.season && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{tournament.season}</div>}
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {['overzicht', 'koppelen'].map(v => (
              <button key={v} onClick={() => { setView(v); if (v === 'overzicht') reload() }} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: view === v ? 600 : 400,
                border: `1px solid ${view === v ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: view === v ? 'var(--color-primary)' : 'var(--color-surface)',
                color: view === v ? '#fff' : 'var(--color-text)',
              }}>{v === 'overzicht' ? 'Overzicht' : '+ Koppelen'}</button>
            ))}
            {view === 'overzicht' && compsData?.length > 0 && (
              <button onClick={handleRescanAll} disabled={rescanning} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit',
                cursor: rescanning ? 'default' : 'pointer', fontWeight: 400,
                border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                color: 'var(--color-text-muted)', opacity: rescanning ? 0.5 : 1,
              }}>↻ {rescanning ? 'Laden…' : 'Alles rescannen'}</button>
            )}
            <button onClick={handleDeletePublication} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 400, border: '1px solid #dc2626', background: 'transparent', color: '#dc2626' }}>Verwijderen</button>
          </div>
        )}
        {rescanMsg && <div style={{ width: '100%', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{rescanMsg}</div>}
      </div>

      {view === 'koppelen' && isAdmin && (
        <CompetitiesTab tid={tournament.id} season={tournament.season || '2026-2027'} />
      )}

      {view === 'overzicht' && (
        compsData === null
          ? <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 40 }}>Laden…</div>
          : <CompetitieList compsData={compsData} onSelect={setSelectedComp} onRemove={handleRemoveComp} isAdmin={isAdmin} />
      )}
    </div>
  )
}
