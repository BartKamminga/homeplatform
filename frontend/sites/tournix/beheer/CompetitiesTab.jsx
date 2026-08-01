import { useState, useEffect, useRef } from 'react'
import {
  getTournamentComps, addTournamentComp, removeTournamentComp,
  getDiscoveryComps,
  getFaseTags, addFaseTag, removeFaseTag,
  assignCompFaseTag, removeCompFaseTag,
} from '../api.js'
import {
  card, cardLabel, ghostBtn,
  muted, successBanner, errorBanner, deleteBtn, inputStyle,
} from './styles.js'

export default function CompetitiesTab({ tid, season = '2026-2027' }) {
  const [links,       setLinks]       = useState([])
  const [globalTags,  setGlobalTags]  = useState([])   // globale fase-tag pool
  const [allComps,    setAllComps]    = useState([])
  const [loading,     setLoading]     = useState(false)
  const [msg,         setMsg]         = useState('')
  const [error,       setError]       = useState('')
  const [showPicker,  setShowPicker]  = useState(false)
  const [filterQ,     setFilterQ]     = useState('')
  const [adding,      setAdding]      = useState(false)
  const [newTagName,  setNewTagName]  = useState('')
  const [addingTag,   setAddingTag]   = useState(false)

  useEffect(() => { loadGlobalTags() }, [])
  useEffect(() => { if (tid) { loadLinks(); loadComps() } }, [tid])

  async function loadLinks() {
    setLoading(true)
    try { setLinks(await getTournamentComps(tid)) }
    catch (e) { flash(e.message, true) }
    finally { setLoading(false) }
  }

  async function loadGlobalTags() {
    try { setGlobalTags(await getFaseTags()) }
    catch { /* stil */ }
  }

  async function loadComps() {
    try {
      const r = await getDiscoveryComps(season)
      setAllComps(r.competitions || [])
    } catch { /* stil */ }
  }

  function flash(text, isErr = false) {
    if (isErr) setError(text); else setMsg(text)
    setTimeout(() => { setMsg(''); setError('') }, 3500)
  }

  // ── Globale tag-pool beheer ──────────────────────────────────────────────────

  async function handleAddTag() {
    const name = newTagName.trim()
    if (!name) return
    setAddingTag(true)
    try {
      const t = await addFaseTag({ name })
      setGlobalTags(prev => prev.some(x => x.id === t.id) ? prev : [...prev, t])
      setNewTagName('')
    } catch (e) { flash(e.message, true) }
    finally { setAddingTag(false) }
  }

  async function handleRemoveTag(tag) {
    if (!window.confirm(`Tag "${tag.name}" verwijderen? Wordt ook bij alle koppelingen verwijderd.`)) return
    try {
      await removeFaseTag(tag.id)
      setGlobalTags(prev => prev.filter(x => x.id !== tag.id))
      setLinks(prev => prev.map(l => ({
        ...l,
        fase_tags: (l.fase_tags || []).filter(t => t.id !== tag.id),
      })))
    } catch (e) { flash(e.message, true) }
  }

  // ── Tags per competitie ──────────────────────────────────────────────────────

  async function handleAssignTag(lnk, tagId) {
    const tag = globalTags.find(t => t.id === tagId)
    if (!tag) return
    setLinks(prev => prev.map(l => l.id === lnk.id
      ? { ...l, fase_tags: [...(l.fase_tags || []), { id: tag.id, name: tag.name }] }
      : l
    ))
    try {
      await assignCompFaseTag(tid, lnk.id, tagId)
    } catch (e) {
      setLinks(prev => prev.map(l => l.id === lnk.id
        ? { ...l, fase_tags: (l.fase_tags || []).filter(t => t.id !== tagId) }
        : l
      ))
      flash(e.message, true)
    }
  }

  async function handleRemoveCompTag(lnk, tagId) {
    setLinks(prev => prev.map(l => l.id === lnk.id
      ? { ...l, fase_tags: (l.fase_tags || []).filter(t => t.id !== tagId) }
      : l
    ))
    try {
      await removeCompFaseTag(tid, lnk.id, tagId)
    } catch (e) {
      await loadLinks()
      flash(e.message, true)
    }
  }

  // ── Competitie koppelen ──────────────────────────────────────────────────────

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

  async function handleRemove(lnk) {
    if (!window.confirm(`Koppeling met "${lnk.competition?.name}" verwijderen?`)) return
    try {
      await removeTournamentComp(tid, lnk.id)
      flash('Koppeling verwijderd')
      await loadLinks()
    } catch (e) { flash(e.message, true) }
  }

  if (!tid) return <p style={muted}>Laden…</p>
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

      {/* ── Globale fase-tag pool ────────────────────────────────── */}
      <div style={card}>
        <div style={{ ...cardLabel, marginBottom: 10 }}>FASE-TAGS (globaal)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
          {globalTags.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Nog geen tags aangemaakt.</span>
          )}
          {globalTags.map(tag => (
            <span key={tag.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, padding: '3px 6px 3px 10px', borderRadius: 20,
              border: '1px solid var(--color-primary)',
              color: 'var(--color-primary)',
            }}>
              {tag.name}
              <button onClick={() => handleRemoveTag(tag)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)', fontSize: 10, lineHeight: 1, padding: 0,
              }}>✕</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddTag()}
            placeholder="Nieuwe tag…"
            style={{ ...inputStyle, flex: 1, fontSize: 12 }}
          />
          <button
            onClick={handleAddTag}
            disabled={addingTag || !newTagName.trim()}
            style={{ ...ghostBtn, fontSize: 12, opacity: addingTag || !newTagName.trim() ? 0.4 : 1 }}
          >+ Toevoegen</button>
        </div>
      </div>

      {/* ── Gekoppelde competities ───────────────────────────────── */}
      {links.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: 24 }}>
          Nog geen competities gekoppeld.
        </div>
      ) : links.map(lnk => (
        <CompetitionRow
          key={lnk.id}
          lnk={lnk}
          globalTags={globalTags}
          onAssignTag={tagId => handleAssignTag(lnk, tagId)}
          onRemoveTag={tagId => handleRemoveCompTag(lnk, tagId)}
          onRemove={() => handleRemove(lnk)}
        />
      ))}

      {/* ── Competitie koppelen ──────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showPicker ? 12 : 0 }}>
          <div style={cardLabel}>COMPETITIE KOPPELEN</div>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 4 }}>{season}</span>
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
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 13 }}>{comp.name}</span>
                      {comp.class_name && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{comp.class_name}</span>}
                    </span>
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

// ── CompetitionRow ─────────────────────────────────────────────────────────────

function CompetitionRow({ lnk, globalTags, onAssignTag, onRemoveTag, onRemove }) {
  const [open,       setOpen]       = useState(false)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const pickerRef = useRef(null)
  const comp      = lnk.competition
  const poules    = lnk.poules || []
  const assigned  = lnk.fase_tags || []
  const assignedIds = new Set(assigned.map(t => t.id))
  const available = globalTags.filter(t => !assignedIds.has(t.id))

  useEffect(() => {
    if (!showTagPicker) return
    function onClickOut(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowTagPicker(false)
    }
    document.addEventListener('mousedown', onClickOut)
    return () => document.removeEventListener('mousedown', onClickOut)
  }, [showTagPicker])

  return (
    <div style={{ ...card, marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* naam + poules toggle */}
        <button onClick={() => setOpen(o => !o)}
          style={{ flex: 1, background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {comp?.hockey_type === 'ZA' ? '🏒 ' : '🏑 '}
            {lnk.label || [comp?.name, comp?.class_name].filter(Boolean).join(' | ') || '—'}
          </span>
          {poules.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>
              {poules.length} poules {open ? '▲' : '▼'}
            </span>
          )}
        </button>
        <button onClick={onRemove} style={deleteBtn} title="Verwijder koppeling">✕</button>
      </div>

      {/* tag chips + toevoegen */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8, alignItems: 'center', position: 'relative' }}>
        {assigned.map(tag => (
          <span key={tag.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, padding: '2px 6px 2px 8px', borderRadius: 20,
            background: 'var(--color-primary)', color: '#fff',
          }}>
            {tag.name}
            <button onClick={() => onRemoveTag(tag.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.8)', fontSize: 10, lineHeight: 1, padding: 0,
            }}>✕</button>
          </span>
        ))}

        {available.length > 0 && (
          <div ref={pickerRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTagPicker(p => !p)}
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                border: '1px dashed var(--color-primary)',
                color: 'var(--color-primary)', background: 'none',
                cursor: 'pointer',
              }}
            >+ tag</button>
            {showTagPicker && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)',
                padding: '6px 0', minWidth: 140,
              }}>
                {available.map(tag => (
                  <button key={tag.id}
                    onClick={() => { onAssignTag(tag.id); setShowTagPicker(false) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '6px 14px', fontSize: 12,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-text)',
                    }}
                  >{tag.name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {assigned.length === 0 && available.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>geen tags</span>
        )}
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
