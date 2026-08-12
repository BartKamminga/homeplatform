import { useState, useEffect } from 'react'
import { updateTournament, deleteTournament, copyTournament, getClubs } from '../../api.js'
import { card, cardLabel, ghostBtn, inputStyle, successBanner, errorBanner } from '../styles.js'

const STAGES = ['inregel', 'test', 'productie']
const STAGE_LABEL = { inregel: 'Inregel', test: 'Test', productie: 'Productie' }
const STAGE_COLOR = { inregel: '#7c3aed', test: '#d97706', productie: '#16a34a' }

function stageBtn(active, color) {
  return {
    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit',
    cursor: 'pointer', fontWeight: active ? 700 : 400,
    border: `1px solid ${active ? color : 'var(--color-border)'}`,
    background: active ? color : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text)',
  }
}

export default function TournamentTab({ tournament, onDeleted, onUpdated }) {
  const [name,          setName]          = useState(tournament.name)
  const [clubs,         setClubs]         = useState([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copying,       setCopying]       = useState(false)
  const [msg,           setMsg]           = useState('')
  const [err,           setErr]           = useState('')

  useEffect(() => { getClubs().then(setClubs).catch(() => {}) }, [])
  useEffect(() => { setName(tournament.name) }, [tournament.id])

  function flash(text, isErr = false) {
    if (isErr) { setErr(text); setTimeout(() => setErr(''), 3500) }
    else       { setMsg(text); setTimeout(() => setMsg(''), 3000) }
  }

  async function patch(data) {
    try { onUpdated?.(await updateTournament(tournament.id, data)) }
    catch { flash('Opslaan mislukt', true) }
  }

  async function handleNameBlur() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== tournament.name) await patch({ name: trimmed })
    else setName(tournament.name)
  }

  async function handleDelete() {
    try { await deleteTournament(tournament.id); onDeleted?.() }
    catch { flash('Verwijderen mislukt', true); setConfirmDelete(false) }
  }

  async function handleCopy() {
    setCopying(true)
    try { await copyTournament(tournament.id); flash('Kopie aangemaakt') }
    catch { flash('Kopiëren mislukt', true) }
    finally { setCopying(false) }
  }

  return (
    <div>
      {msg && <div style={{ ...successBanner, marginBottom: 12 }}>{msg}</div>}
      {err && <div style={{ ...errorBanner, marginBottom: 12 }}>{err}</div>}

      <div style={{ ...card, marginBottom: 12 }}>
        <div style={cardLabel}>NAAM</div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      {tournament.season && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={cardLabel}>SEIZOEN</div>
          <div style={{ fontSize: 13 }}>{tournament.season}</div>
        </div>
      )}

      {clubs.length > 0 && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={cardLabel}>LOCATIE (CLUB)</div>
          <select
            value={tournament.club_id || ''}
            onChange={e => patch({ club_id: e.target.value || null })}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          >
            <option value="">— Geen locatie —</option>
            {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div style={{ ...card, marginBottom: 12 }}>
        <div style={cardLabel}>BEHEERFASE</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STAGES.map(s => (
            <button key={s} onClick={() => patch({ stage: s })}
              style={stageBtn(tournament.stage === s, STAGE_COLOR[s])}>
              {STAGE_LABEL[s]}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
          Inregel = volledig bewerkbaar · Test = scores invoeren · Productie = live
        </div>
      </div>

      <div style={{ ...card, marginBottom: 12 }}>
        <div style={cardLabel}>STATUS</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => patch({ status: 'actief' })}
            style={stageBtn(tournament.status === 'actief', '#16a34a')}>Actief</button>
          <button onClick={() => patch({ status: 'afgelopen' })}
            style={stageBtn(tournament.status === 'afgelopen', '#6b7280')}>Afgelopen</button>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 12 }}>
        <div style={cardLabel}>ACTIES</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={handleCopy} disabled={copying}
            style={{ ...ghostBtn, opacity: copying ? 0.5 : 1 }}>
            {copying ? 'Bezig…' : '📋 Kopieer toernooi'}
          </button>
          {confirmDelete ? (
            <>
              <button onClick={() => setConfirmDelete(false)} style={ghostBtn}>Nee</button>
              <button onClick={handleDelete}
                style={{ ...ghostBtn, borderColor: '#dc2626', color: '#dc2626' }}>
                Ja, verwijderen
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              style={{ ...ghostBtn, borderColor: '#dc2626', color: '#dc2626' }}>
              🗑 Verwijderen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
