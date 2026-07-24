import { useState, useEffect } from 'react'
import { updateTournament, updateTournamentStage } from '../api.js'
import { noTid } from './styles.js'

export default function TournamentTab({ active, onRefresh }) {
  const [localStage,  setLocalStage]  = useState(active?.stage ?? null)
  const [localStatus, setLocalStatus] = useState(active?.status ?? null)
  useEffect(() => {
    setLocalStage(active?.stage ?? null)
    setLocalStatus(active?.status ?? null)
  }, [active?.id])

  async function handleStageChange(s) {
    if (!active) return
    setLocalStage(s)
    await updateTournamentStage(active.id, s)
    await onRefresh()
  }

  if (!active) return <p style={noTid}>Selecteer een toernooi via de keuzelijst bovenaan.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Fase */}
      <div style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>FASE</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['inregel','Inregel'],['test','Test'],['productie','Productie']].map(([s, label]) => (
            <button key={s} onClick={() => handleStageChange(s)} style={{
              padding: '6px 14px', fontSize: 13, borderRadius: 6, fontFamily: 'inherit',
              border: localStage === s ? 'none' : '1px solid var(--color-border)',
              background: localStage === s
                ? (s === 'inregel' ? 'var(--color-primary)' : s === 'test' ? 'var(--color-warning)' : 'var(--color-success)')
                : 'transparent',
              color: localStage === s ? '#fff' : 'var(--color-text-muted)',
              cursor: 'pointer', fontWeight: localStage === s ? 600 : 400,
            }}>{label}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
          {localStage === 'inregel'   && 'Vrij bewerken — teams, velden en wedstrijden aanmaken.'}
          {localStage === 'test'      && 'Bevroren data — scores simuleren zonder opslaan.'}
          {localStage === 'productie' && 'Live — scores worden opgeslagen, voorspellingen tellen mee.'}
        </div>
      </div>

      {/* Status */}
      <div style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>STATUS</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['active','Actief'],['finished','Afgelopen']].map(([val, label]) => (
            <button key={val} onClick={() => {
              setLocalStatus(val)
              updateTournament(active.id, { status: val }).then(onRefresh)
            }}
              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, fontFamily: 'inherit',
                border: localStatus === val ? 'none' : '1px solid var(--color-border)',
                background: localStatus === val
                  ? (val === 'finished' ? 'var(--color-text-muted)' : 'var(--color-success)')
                  : 'transparent',
                color: localStatus === val ? '#fff' : 'var(--color-text-muted)', cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
        {localStatus === 'finished' && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
            Afgelopen toernooien zijn niet zichtbaar op de overzichtspagina.
          </div>
        )}
      </div>

    </div>
  )
}
