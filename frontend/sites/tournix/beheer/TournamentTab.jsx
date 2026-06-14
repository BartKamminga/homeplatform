import { useState, useEffect } from 'react'
import { updateTournament, updateTournamentStage, copyTournament } from '../api.js'
import { inputStyle, noTid } from './styles.js'

export default function TournamentTab({ active, clubs, onRefresh, onSelect }) {
  const [nameInput, setNameInput] = useState(active?.name ?? '')
  useEffect(() => { setNameInput(active?.name ?? '') }, [active?.id])

  async function handleRename(e) {
    e.preventDefault()
    if (!active || !nameInput.trim() || nameInput === active.name) return
    await updateTournament(active.id, { name: nameInput })
    await onRefresh()
  }

  async function handleStageChange(s) {
    if (!active) return
    await updateTournamentStage(active.id, s)
    await onRefresh()
  }

  async function handleLocationClub(clubId) {
    if (!active) return
    await updateTournament(active.id, { location_club_id: clubId || null })
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

      {/* Locatie */}
      {clubs.length > 0 && (
        <div style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>LOCATIE</div>
          <select value={active.location_club_id ?? ''} onChange={e => handleLocationClub(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}>
            <option value="">— geen club —</option>
            {clubs.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Fase */}
      <div style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>FASE</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['inregel','Inregel'],['test','Test'],['productie','Productie']].map(([s, label]) => (
            <button key={s} onClick={() => handleStageChange(s)} style={{
              padding: '6px 14px', fontSize: 13, borderRadius: 6, fontFamily: 'inherit',
              border: active.stage === s ? 'none' : '1px solid var(--color-border)',
              background: active.stage === s
                ? (s === 'inregel' ? 'var(--color-primary)' : s === 'test' ? 'var(--color-warning)' : 'var(--color-success)')
                : 'transparent',
              color: active.stage === s ? '#fff' : 'var(--color-text-muted)',
              cursor: 'pointer', fontWeight: active.stage === s ? 600 : 400,
            }}>{label}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
          {active.stage === 'inregel'   && 'Vrij bewerken — teams, velden en wedstrijden aanmaken.'}
          {active.stage === 'test'      && 'Bevroren data — scores simuleren zonder opslaan.'}
          {active.stage === 'productie' && 'Live — scores worden opgeslagen, voorspellingen tellen mee.'}
        </div>
      </div>

      {/* Status */}
      <div style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>STATUS</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['active','Actief'],['finished','Afgelopen']].map(([val, label]) => (
            <button key={val} onClick={() => updateTournament(active.id, { status: val }).then(onRefresh)}
              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, fontFamily: 'inherit',
                border: active.status === val ? 'none' : '1px solid var(--color-border)',
                background: active.status === val
                  ? (val === 'finished' ? 'var(--color-text-muted)' : 'var(--color-success)')
                  : 'transparent',
                color: active.status === val ? '#fff' : 'var(--color-text-muted)', cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
        {active.status === 'finished' && (
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
