import { useState, useEffect } from 'react'
import {
  getTournamentComps, addTournamentComp,
  patchTournamentComp, removeTournamentComp,
  getDiscoveryComps,
  getTournamentFases, addTournamentFase, removeTournamentFase,
} from '../api.js'
import {
  card, cardLabel, ghostBtn, noTid,
  muted, successBanner, errorBanner, deleteBtn, inputStyle,
} from './styles.js'

const SEASON = '2026-2027'

const BASE_FASES = [
  { value: 'herfst', label: 'Herfst' },
  { value: 'lente',  label: 'Lente' },
  { value: 'nk',     label: 'NK' },
  { value: 'overig', label: 'Overig' },
]

export default function CompetitiesTab({ tid }) {
  const [links,        setLinks]        = useState([])
  const [customFases,  setCustomFases]  = useState([])  // eigen fases
  const [allComps,     setAllComps]     = useState([])
  const [loading,      setLoading]      = useState(false)
  const [msg,          setMsg]          = useState('')
  const [error,        setError]        = useState('')
  const [showPicker,   setShowPicker]   = useState(false)
  const [filterQ,      setFilterQ]      = useState('')
  const [adding,       setAdding]       = useState(false)
  const [newFaseName,  setNewFaseName]  = useState('')
  const [addingFase,   setAddingFase]   = useState(false)

  useEffect(() => {
    if (tid) { loadLinks(); loadFases(); loadComps() }
  }, [tid])

  async function loadLinks() {
    setLoading(true)
    try { setLinks(await getTournamentComps(tid)) }
    catch (e) { flash(e.message, true) }
    finally { setLoading(false) }
  }

  async function loadFases() {
    try { setCustomFases(await getTournamentFases(tid)) }
    catch { /* stil */ }
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

  // ── Fase-beheer ──────────────────────────────────────────────────────────────

  async function handleAddFase() {
    const name = newFaseName.trim()
    if (!name) return
    setAddingFase(true)
    try {
      const f = await addTournamentFase(tid, { name, order: customFases.length })
      setCustomFases(prev => [...prev, f])
      setNewFaseName('')
    } catch (e) { flash(e.message, true) }
    finally { setAddingFase(false) }
  }

  async function handleRemoveFase(f) {
    // Controleer of fase nog in gebruik is
    const inUse = links.some(l => l.fase === f.name)
    if (inUse && !window.confirm(`"${f.name}" is nog gekoppeld aan een competitie. Toch verwijderen?`)) return
    try {
      await removeTournamentFase(tid, f.id)
      setCustomFases(prev => prev.filter(x => x.id !== f.id))
    } catch (e) { flash(e.message, true) }
  }

  // ── Competitie-koppeling ─────────────────────────────────────────────────────

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

  // Alle beschikbare fase-opties: basis + eigen (op naam dedupliceren)
  const baseNames = new Set(BASE_FASES.map(f => f.value))
  const extraFases = customFases.filter(f => !baseNames.has(f.name.toLowerCase()))
  const allFaseOptions = [
    { value: '', label: '— geen —' },
    ...BASE_FASES,
    ...extraFases.map(f => ({ value: f.name, label: f.name })),
  ]

  // Groepeer gekoppelde comps per fase
  const FASE_ORDER = ['herfst', 'lente', 'nk', 'overig', ...extraFases.map(f => f.name), '']
  const byFase = {}
  for (const lnk of links) {
    const key = lnk.fase || ''
    if (!byFase[key]) byFase[key] = []
    byFase[key].push(lnk)
  }
  const faseLabel = {
    herfst: 'Herfst', lente: 'Lente', nk: 'NK', overig: 'Overig', '': 'Geen fase',
    ...Object.fromEntries(extraFases.map(f => [f.name, f.name])),
  }

  const linkedIds = new Set(links.map(l => l.competition_id))
  const q = filterQ.trim().toLowerCase()
  const pickerComps = allComps
    .filter(c => !linkedIds.has(c.id))
    .filter(c => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg   && <div style={successBanner}>{msg}</div>}
      {error && <div style={errorBanner}>{error}</div>}

      {/* ── Fase beheer ─────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ ...cardLabel, marginBottom: 10 }}>FASE-LIJST</div>

        {/* Basis fases (vast) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {BASE_FASES.map(f => (
            <span key={f.value} style={{
              fontSize: 11, padding: '2px 10px', borderRadius: 20,
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)', opacity: 0.6,
            }}>{f.label}</span>
          ))}
        </div>

        {/* Eigen fases */}
        {extraFases.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {extraFases.map(f => (
              <span key={f.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, padding: '2px 6px 2px 10px', borderRadius: 20,
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)',
              }}>
                {f.name}
                <button onClick={() => handleRemoveFase(f)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-muted)', fontSize: 10, lineHeight: 1, padding: 0,
                }}>✕</button>
              </span>
            ))}
          </div>
        )}

        {/* Toevoegen */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={newFaseName}
            onChange={e => setNewFaseName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddFase()}
            placeholder="Eigen fase toevoegen…"
            style={{ ...inputStyle, flex: 1, fontSize: 12 }}
          />
          <button
            onClick={handleAddFase}
            disabled={addingFase || !newFaseName.trim()}
            style={{
              ...ghostBtn, fontSize: 12,
              opacity: addingFase || !newFaseName.trim() ? 0.4 : 1,
            }}
          >+ Toevoegen</button>
        </div>
      </div>

      {/* ── Gekoppelde competities ───────────────────────────────── */}
      {links.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: 24 }}>
          Nog geen competities gekoppeld.
        </div>
      ) : FASE_ORDER.filter(k => byFase[k]).map(key => (
        <div key={key}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 6, paddingLeft: 2 }}>
            {faseLabel[key]}
          </div>
          {byFase[key].map(lnk => (
            <CompetitionRow
              key={lnk.id}
              lnk={lnk}
              faseOptions={allFaseOptions}
              onFaseChange={fase => handleFaseChange(lnk, fase)}
              onRemove={() => handleRemove(lnk)}
            />
          ))}
        </div>
      ))}

      {/* ── Competitie koppelen ──────────────────────────────────── */}
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

function CompetitionRow({ lnk, faseOptions, onFaseChange, onRemove }) {
  const [open, setOpen] = useState(false)
  const comp   = lnk.competition
  const poules = lnk.poules || []

  return (
    <div style={{ ...card, marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

        <select
          value={lnk.fase || ''}
          onChange={e => onFaseChange(e.target.value)}
          style={{ ...inputStyle, width: 'auto', fontSize: 12, padding: '3px 8px' }}
        >
          {faseOptions.map(o => (
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
