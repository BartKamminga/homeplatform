import { useState, useEffect } from 'react'
import {
  getTournamentComps, addTournamentComp,
  removeTournamentComp, createPhasesFromComp,
  getDiscoveryComps,
} from '../api.js'
import {
  card, cardLabel, primaryBtn, ghostBtn, noTid,
  muted, successBanner, errorBanner, deleteBtn,
} from './styles.js'

const SEASON = '2026-2027'

export default function CompetitiesTab({ tid }) {
  const [links,      setLinks]      = useState([])
  const [allComps,   setAllComps]   = useState([])
  const [loading,    setLoading]    = useState(false)
  const [msg,        setMsg]        = useState('')
  const [error,      setError]      = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [filterQ,    setFilterQ]    = useState('')
  const [adding,     setAdding]     = useState(false)
  const [creatingId, setCreatingId] = useState(null)

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
      const seasonComps = (r.competitions || []).filter(c => c.season === SEASON)
      setAllComps(seasonComps)
    } catch { /* stil falen */ }
  }

  function flash(text, isErr = false) {
    if (isErr) setError(text); else setMsg(text)
    setTimeout(() => { setMsg(''); setError('') }, 3500)
  }

  async function handleAdd(comp) {
    setAdding(true)
    try {
      const order = links.length
      await addTournamentComp(tid, { competition_id: comp.id, order })
      flash(`${comp.name} gekoppeld`)
      setShowPicker(false)
      setFilterQ('')
      await loadLinks()
    } catch (e) { flash(e.message, true) }
    finally { setAdding(false) }
  }

  async function handleRemove(lnk) {
    if (!window.confirm(`Koppeling met "${lnk.competition?.name}" verwijderen?`)) return
    try {
      await removeTournamentComp(tid, lnk.id)
      flash('Koppeling verwijderd')
      await loadLinks()
    } catch (e) { flash(e.message, true) }
  }

  async function handleCreatePhases(lnk) {
    setCreatingId(lnk.id)
    try {
      const r = await createPhasesFromComp(tid, lnk.id)
      flash(`${r.created} fases aangemaakt${r.skipped > 0 ? `, ${r.skipped} al bestonden` : ''}`)
      await loadLinks()
    } catch (e) { flash(e.message, true) }
    finally { setCreatingId(null) }
  }

  if (!tid) return <p style={noTid}>Selecteer een toernooi via de keuzelijst bovenaan.</p>
  if (loading) return <p style={muted}>Laden…</p>

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

      {/* Gekoppelde competities */}
      {links.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: 24 }}>
          Nog geen competities gekoppeld.
        </div>
      ) : links.map((lnk, idx) => (
        <CompetitionCard
          key={lnk.id}
          lnk={lnk}
          idx={idx}
          creating={creatingId === lnk.id}
          onRemove={() => handleRemove(lnk)}
          onCreatePhases={() => handleCreatePhases(lnk)}
        />
      ))}

      {/* + Koppel competitie knop */}
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
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '7px 10px', borderRadius: 8, fontSize: 13,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text)',
                fontFamily: 'inherit', outline: 'none', marginBottom: 10,
              }}
            />
            {pickerComps.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: '8px 0' }}>
                {allComps.length === 0 ? 'Geen discovery-competities gevonden.' : 'Alle competities al gekoppeld.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                {pickerComps.map(comp => (
                  <button
                    key={comp.id}
                    onClick={() => !adding && handleAdd(comp)}
                    disabled={adding}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)', color: 'var(--color-text)',
                      cursor: adding ? 'default' : 'pointer', fontFamily: 'inherit',
                      textAlign: 'left', opacity: adding ? 0.7 : 1,
                    }}
                  >
                    <span style={{ fontSize: 11, opacity: 0.6, flexShrink: 0 }}>
                      {comp.hockey_type === 'ZA' ? '🏒' : '🏑'}
                    </span>
                    <span style={{ flex: 1, fontSize: 13 }}>{comp.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>+ Koppelen</span>
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

// ── CompetitionCard ────────────────────────────────────────────────────────────

function CompetitionCard({ lnk, idx, creating, onRemove, onCreatePhases }) {
  const [open, setOpen] = useState(false)
  const comp   = lnk.competition
  const poules = lnk.poules || []

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: open ? 12 : 0 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0, minWidth: 20, textAlign: 'right' }}>
          {idx + 1}.
        </span>
        <button onClick={() => setOpen(o => !o)}
          style={{ flex: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: 'inherit', textAlign: 'left' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            {comp?.hockey_type === 'ZA' ? '🏒 ' : '🏑 '}
            {lnk.label || comp?.name || '—'}
          </span>
          {poules.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>
              {poules.length} poules {open ? '▲' : '▼'}
            </span>
          )}
        </button>
        <button
          onClick={onCreatePhases}
          disabled={creating}
          title="Maak TournixPhase aan voor elke poule in deze competitie"
          style={{ ...ghostBtn, fontSize: 11, padding: '3px 10px', opacity: creating ? 0.6 : 1 }}
        >
          {creating ? '⟳ Fases…' : '⚡ Fases aanmaken'}
        </button>
        <button onClick={onRemove} style={deleteBtn} title="Verwijder koppeling">✕</button>
      </div>

      {open && poules.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 28 }}>
          {poules.map(p => (
            <span key={p.id} style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 6,
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
            }}>
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
