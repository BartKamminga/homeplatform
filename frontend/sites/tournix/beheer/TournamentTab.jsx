import { useState, useEffect } from 'react'
import { updateTournament, updateTournamentStage, copyTournament } from '../api.js'
import { inputStyle, noTid } from './styles.js'

export default function TournamentTab({ active, onRefresh, onSelect }) {
  const [nameInput,   setNameInput]   = useState(active?.name ?? '')
  const [seasonInput, setSeasonInput] = useState(active?.season ?? '')
  const [localStage,  setLocalStage]  = useState(active?.stage ?? null)
  const [localStatus, setLocalStatus] = useState(active?.status ?? null)
  useEffect(() => {
    setNameInput(active?.name ?? '')
    setSeasonInput(active?.season ?? '')
    setLocalStage(active?.stage ?? null)
    setLocalStatus(active?.status ?? null)
  }, [active?.id])

  async function handleRename(e) {
    e.preventDefault()
    if (!active || !nameInput.trim() || nameInput === active.name) return
    await updateTournament(active.id, { name: nameInput })
    await onRefresh()
  }

  async function handleSeason(e) {
    e.preventDefault()
    if (!active || seasonInput === (active.season ?? '')) return
    await updateTournament(active.id, { season: seasonInput || null })
    await onRefresh()
  }

  async function handleStageChange(s) {
    if (!active) return
    setLocalStage(s)
    await updateTournamentStage(active.id, s)
    await onRefresh()
  }

  async function handleCopy() {
    if (!active) return
    const newT = await copyTournament(active.id)
    await onRefresh()
    if (onSelect) onSelect(newT.id)
  }

  if (!active) return <p style={noTid}>Selecteer een toernooi via de keuzelijst bovenaan.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Naam */}
      <div style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>NAAM</div>
        <form onSubmit={handleRename} style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            placeholder="Naam van het toernooi"
          />
          <button
            type="submit"
            disabled={!nameInput.trim() || nameInput === active.name}
            style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, fontFamily: 'inherit',
              background: 'var(--color-primary)', color: '#fff', border: 'none',
              cursor: nameInput.trim() && nameInput !== active.name ? 'pointer' : 'default',
              opacity: nameInput.trim() && nameInput !== active.name ? 1 : 0.5 }}
          >
            Opslaan
          </button>
        </form>
      </div>

      {/* Seizoen */}
      <div style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>SEIZOEN</div>
        <form onSubmit={handleSeason} style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={seasonInput}
            onChange={e => setSeasonInput(e.target.value)}
            placeholder="bijv. 2026-2027"
          />
          <button
            type="submit"
            disabled={seasonInput === (active.season ?? '')}
            style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, fontFamily: 'inherit',
              background: 'var(--color-primary)', color: '#fff', border: 'none',
              cursor: seasonInput !== (active.season ?? '') ? 'pointer' : 'default',
              opacity: seasonInput !== (active.season ?? '') ? 1 : 0.5 }}
          >
            Opslaan
          </button>
        </form>
      </div>

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

      {/* Kopieer */}
      <div style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>KOPIEER</div>
        <button onClick={handleCopy}
          style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, fontFamily: 'inherit',
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text)', cursor: 'pointer' }}>
          Kopieer toernooi
        </button>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
          Kopieert teams, poules en velden — zonder wedstrijden en scores.
        </div>
      </div>

    </div>
  )
}
