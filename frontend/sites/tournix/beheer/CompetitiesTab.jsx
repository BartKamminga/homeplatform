import { useState, useEffect } from 'react'
import {
  getTournamentComps, addTournamentComp,
  patchTournamentComp, removeTournamentComp,
  getDiscoveryComps,
} from '../api.js'
import {
  card, cardLabel, primaryBtn, ghostBtn, noTid,
  muted, successBanner, errorBanner, deleteBtn, inputStyle,
} from './styles.js'

const SEASON = '2026-2027'

const FASE_OPTIONS = [
  { value: '',       label: '— geen —' },
  { value: 'herfst', label: 'Herfst' },
  { value: 'lente',  label: 'Lente' },
  { value: 'nk',     label: 'NK' },
  { value: 'overig', label: 'Overig' },
]

export default function CompetitiesTab({ tid }) {
  const [links,      setLinks]      = useState([])
  const [allComps,   setAllComps]   = useState([])
  const [loading,    setLoading]    = useState(false)
  const [msg,        setMsg]        = useState('')
  const [error,      setError]      = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [filterQ,    setFilterQ]    = useState('')
  const [adding,     setAdding]     = useState(false)

  useEffect(() => { if (tid) { loadLinks(); loadComps() } }, [tid])

  async function loadLinks() {
    setLoading(true)
    try { setLinks(await getTournamentComps(tid)) }
    catch (e) { flash(e.message, true) }
    finally { setLoading(false) }
  }

  async function loadComps() {
    try {
      const r = await getDiscoveryComps()
      setAllComps((r.competitions || []).filter(c => c.season === SEASON))
    } catch { /* stil */ }
  }

  function flash(text, isErr = false) {
    if (isErr) setError(text); else setMsg(text)
    setTimeout(() => { setMsg(''); setError('') }, 3500)
  }

  async function handleAdd(comp) {
    setAdding(true)
    try {
      await addTournamentComp(tid, { competition_id: comp.id, order: links.length })
      flash(`${comp.name} gekoppeld`)
      setShowPicker(false)
      setFilterQ('')
      await loadLinks()
    } catch (e) { flash(e.message, true) }
    finally { setAdding(false) }
  }

  async function handleFaseChange(lnk, fase) {
    try {
      await patchTournamentComp(tid, lnk.id, { fase: fase || null })
      setLinks(prev => prev.map(l => l.id === lnk.id ? { ...l, fase: fase || null } : l))
    } catch (e) { flash(e.message, true) }
  }

  async function handleRemove(lnk) {
    if (!window.confirm(`Koppeling met "${lnk.competition?.name}" verwijderen?`)) return
    try {
      await removeTournamentComp(tid, lnk.id)
      flash('Koppeling verwijderd')
      await loadLinks()
    } catch (e) { flash(e.message, true) }
  }

  if (!tid) return <p style={noTid}>Selecteer een toernooi via de keuzelijst bovenaan.</p>
  if (loading) return <p style={muted}>Laden…</p>

  const linkedIds = new Set(links.map(l => l.competition_id))
  const q = filterQ.trim().toLowerCase()
  const pickerComps = allComps
    .filter(c => !linkedIds.has(c.id))
    .filter(c => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Groepeer gekoppelde competities per fase voor overzicht
  const byFase = {}
  for (const lnk of links) {
    const key = lnk.fase || ''
    if (!byFase[key]) byFase[key] = []
    byFase[key].push(lnk)
  }
  const faseOrder = ['herfst', 'lente', 'nk', 'overig', '']
  const faseLabel = { herfst: 'Herfst', lente: 'Lente', nk: 'NK', overig: 'Overig', '': 'Geen fase' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg   && <div style={successBanner}>{msg}</div>}
      {error && <div style={errorBanner}>{error}</div>}

      {links.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: 24 }}>
          Nog geen competities gekoppeld.
        </div>
      ) : faseOrder.filter(k => byFase[k]).map(key => (
        <div key={key}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 6, paddingLeft: 2 }}>
            {faseLabel[key]}
          </div>
          {byFase[key].map(lnk => (
            <CompetitionRow
              key={lnk.id}
              lnk={lnk}
              onFaseChange={fase => handleFaseChange(lnk, fase)}
              onRemove={() => handleRemove(lnk)}
            />
          ))}
        </div>
      ))}

      {/* + Koppel competitie */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showPicker ? 12 : 0 }}>
          <div style={cardLabel}>COMPETITIE KOPPELEN</div>
          <button
            onClick={() => { setShowPicker(p => !p); setFilterQ('') }}
            style={{ ...ghostBtn, fontSize: 12, marginLeft: 'auto' }}
          >
            {showPicker ? 'Sluiten' : '+ Koppelen'}
          </button>
        </div>

        {showPicker && (
          <>
            <input
              value={filterQ}
              onChange={e => setFilterQ(e.target.value)}
              placeholder="Filter op naam…"
              autoFocus
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
            />
            {pickerComps.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: '8px 0' }}>
                {allComps.length === 0 ? 'Geen discovery-competities gevonden.' : 'Alle competities al gekoppeld.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                {pickerComps.map(comp => (
                  <button key={comp.id} onClick={() => !adding && handleAdd(comp)} disabled={adding}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)', color: 'var(--color-text)',
                      cursor: adding ? 'default' : 'pointer', fontFamily: 'inherit',
                      textAlign: 'left', opacity: adding ? 0.7 : 1,
                    }}>
                    <span style={{ fontSize: 11, opacity: 0.6, flexShrink: 0 }}>
                      {comp.hockey_type === 'ZA' ? '🏒' : '🏑'}
                    </span>
                    <span style={{ flex: 1, fontSize: 13 }}>{comp.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>
                      + Koppelen
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── CompetitionRow ─────────────────────────────────────────────────────────────

function CompetitionRow({ lnk, onFaseChange, onRemove }) {
  const [open, setOpen] = useState(false)
  const comp   = lnk.competition
  const poules = lnk.poules || []

  return (
    <div style={{ ...card, marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Naam */}
        <button onClick={() => setOpen(o => !o)}
          style={{ flex: 1, background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {comp?.hockey_type === 'ZA' ? '🏒 ' : '🏑 '}
            {lnk.label || comp?.name || '—'}
          </span>
          {poules.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>
              {poules.length} poules {open ? '▲' : '▼'}
            </span>
          )}
        </button>

        {/* Fase-dropdown */}
        <select
          value={lnk.fase || ''}
          onChange={e => onFaseChange(e.target.value)}
          style={{ ...inputStyle, width: 'auto', fontSize: 12, padding: '3px 8px' }}
        >
          {FASE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button onClick={onRemove} style={deleteBtn} title="Verwijder koppeling">✕</button>
      </div>

      {open && poules.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 10, paddingLeft: 4 }}>
          {poules.map(p => (
            <span key={p.id} style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 6,
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
            }}>{p.name}</span>
          ))}
        </div>
      )}
    </div>
  )
}
