import { useState, useEffect } from 'react'
import {
  getPublicationComps, addPublicationComp, updatePublicationComp, removePublicationComp,
  getDiscoveryComps, syncCompetition,
  getPublicationTags, addPublicationTag, removePublicationTag,
  assignCompTag, removeCompTag,
  KNOWN_SEASONS,
} from '../api.js'
import {
  card, cardLabel, ghostBtn,
  muted, successBanner, errorBanner, inputStyle,
} from './styles.js'
import CompetitieDetailView from './CompetitieDetailView.jsx'
import CompetitionRow from './CompetitionRow.jsx'

function normalizeSeason(s) {
  if (!s) return '2026-2027'
  const clean = s.trim().replace(/\s*-\s*/, '-')
  return KNOWN_SEASONS.includes(clean) ? clean : '2026-2027'
}

function InlineConfirm({ msg, onConfirm, onCancel }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid color-mix(in srgb, var(--color-danger) 20%, transparent)',
      borderRadius: 8, padding: '10px 14px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    }}>
      <span style={{ flex: 1, fontSize: 12, minWidth: 120 }}>{msg}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onCancel} style={{
          padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
          border: '1px solid var(--color-border)', background: 'var(--color-bg)',
          color: 'var(--color-text)', fontFamily: 'inherit',
        }}>Nee</button>
        <button onClick={onConfirm} style={{
          padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
          border: 'none', background: 'var(--color-danger)', color: '#fff',
          fontFamily: 'inherit', fontWeight: 600,
        }}>Ja</button>
      </div>
    </div>
  )
}

export default function CompetitiesTab({
  tid,
  season: seasonProp = '2026-2027',
  isAdmin       = false,
  published     = false,
  onTogglePublished = null,
  onDelete      = null,
}) {
  const [links,       setLinks]       = useState([])
  const [globalTags,  setGlobalTags]  = useState([])
  const [allComps,    setAllComps]    = useState([])
  const [loading,     setLoading]     = useState(false)
  const [msg,         setMsg]         = useState('')
  const [error,       setError]       = useState('')
  const [showPicker,  setShowPicker]  = useState(false)
  const [filterQ,     setFilterQ]     = useState('')
  const [adding,      setAdding]      = useState(false)
  const [newTagName,  setNewTagName]  = useState('')
  const [addingTag,   setAddingTag]   = useState(false)
  const [season,      setSeason]      = useState(() => normalizeSeason(seasonProp))
  const [selectedComps, setSelectedComps] = useState(new Set())
  const [confirmTag,  setConfirmTag]  = useState(null)
  const [confirmLink, setConfirmLink] = useState(null)
  const [selectedLnk, setSelectedLnk] = useState(null)
  const [metaOpen,    setMetaOpen]    = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  useEffect(() => { loadGlobalTags() }, [])
  useEffect(() => { if (tid) { loadLinks() } }, [tid])
  useEffect(() => { if (tid) { loadComps() } }, [tid, season])

  async function loadLinks() {
    setLoading(true)
    try { setLinks(await getPublicationComps(tid)) }
    catch (e) { flash(e.message, true) }
    finally { setLoading(false) }
  }

  async function loadGlobalTags() {
    try { setGlobalTags(await getPublicationTags()) }
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

  async function handleAddTag() {
    const name = newTagName.trim()
    if (!name) return
    setAddingTag(true)
    try {
      const t = await addPublicationTag({ name })
      setGlobalTags(prev => prev.some(x => x.id === t.id) ? prev : [...prev, t])
      setNewTagName('')
    } catch (e) { flash(e.message, true) }
    finally { setAddingTag(false) }
  }

  async function doRemoveTag(tag) {
    setConfirmTag(null)
    try {
      await removePublicationTag(tag.id)
      setGlobalTags(prev => prev.filter(x => x.id !== tag.id))
      setLinks(prev => prev.map(l => ({
        ...l, fase_tags: (l.fase_tags || []).filter(t => t.id !== tag.id),
      })))
    } catch (e) { flash(e.message, true) }
  }

  async function handleAssignTag(lnk, tagId) {
    const tag = globalTags.find(t => t.id === tagId)
    if (!tag) return
    setLinks(prev => prev.map(l => l.id === lnk.id
      ? { ...l, fase_tags: [...(l.fase_tags || []), { id: tag.id, name: tag.name }] }
      : l
    ))
    try {
      await assignCompTag(tid, lnk.id, tagId)
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
      await removeCompTag(tid, lnk.id, tagId)
    } catch (e) {
      await loadLinks()
      flash(e.message, true)
    }
  }

  async function handleAdd(comp) {
    setAdding(true)
    try {
      await addPublicationComp(tid, { competition_id: comp.id, order: links.length })
      syncCompetition(comp.id).catch(() => {})
      flash(`${comp.name} gekoppeld`)
      setShowPicker(false)
      setFilterQ('')
      setSelectedComps(new Set())
      await loadLinks()
    } catch (e) { flash(e.message, true) }
    finally { setAdding(false) }
  }

  async function handleBulkAdd() {
    if (!selectedComps.size) return
    setAdding(true)
    const comps = allComps.filter(c => selectedComps.has(c.id))
    try {
      for (let i = 0; i < comps.length; i++) {
        await addPublicationComp(tid, { competition_id: comps[i].id, order: links.length + i })
        syncCompetition(comps[i].id).catch(() => {})
      }
      flash(`${comps.length} competities gekoppeld`)
      setShowPicker(false)
      setFilterQ('')
      setSelectedComps(new Set())
      await loadLinks()
    } catch (e) { flash(e.message, true) }
    finally { setAdding(false) }
  }

  async function handleToggleVisible(lnk) {
    const next = !lnk.visible
    setLinks(prev => prev.map(l => l.id === lnk.id ? { ...l, visible: next } : l))
    try {
      await updatePublicationComp(tid, lnk.id, { visible: next })
    } catch (e) {
      setLinks(prev => prev.map(l => l.id === lnk.id ? { ...l, visible: !next } : l))
      flash(e.message, true)
    }
  }

  async function handleToggleScanProfile(lnk) {
    const next = lnk.scan_profile === 'active' ? 'manual' : 'active'
    setLinks(prev => prev.map(l => l.id === lnk.id ? { ...l, scan_profile: next } : l))
    try {
      await updatePublicationComp(tid, lnk.id, { scan_profile: next })
    } catch (e) {
      setLinks(prev => prev.map(l => l.id === lnk.id ? { ...l, scan_profile: lnk.scan_profile } : l))
      flash(e.message, true)
    }
  }

  async function doRemoveLink(lnk) {
    setConfirmLink(null)
    try {
      await removePublicationComp(tid, lnk.id)
      flash('Koppeling verwijderd')
      await loadLinks()
    } catch (e) { flash(e.message, true) }
  }

  async function handleDelete() {
    setDeleting(true)
    try { await onDelete?.() }
    catch { flash('Verwijderen mislukt', true) }
    finally { setDeleting(false); setConfirmDel(false) }
  }

  if (!tid) return <p style={muted}>Laden…</p>
  if (loading) return <p style={muted}>Laden…</p>

  if (selectedLnk) {
    return <CompetitieDetailView lnk={selectedLnk} onBack={() => setSelectedLnk(null)} />
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

      {confirmTag && (
        <InlineConfirm
          msg={`Tag "${confirmTag.name}" verwijderen? Wordt ook bij alle koppelingen verwijderd.`}
          onConfirm={() => doRemoveTag(confirmTag)}
          onCancel={() => setConfirmTag(null)}
        />
      )}
      {confirmLink && (
        <InlineConfirm
          msg={`Koppeling met "${confirmLink.competition?.name}" verwijderen?`}
          onConfirm={() => doRemoveLink(confirmLink)}
          onCancel={() => setConfirmLink(null)}
        />
      )}

      {/* ── ⚙ Beheer meta-paneel (item 635) ───────────────────────── */}
      {isAdmin && (
        <div style={card}>
          <div
            onClick={() => setMetaOpen(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', flex: 1 }}>⚙ Beheer</span>
            {!metaOpen && (
              <>
                <span style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 600,
                  background: published ? 'color-mix(in srgb, var(--color-success) 15%, var(--color-surface))' : 'color-mix(in srgb, var(--color-warning) 15%, var(--color-surface))',
                  color: published ? 'var(--color-success)' : 'var(--color-warning)',
                }}>
                  {published ? '● Zichtbaar' : '○ Concept'}
                </span>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
                  {season}
                </span>
                {globalTags.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{globalTags.length} tags</span>
                )}
              </>
            )}
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{metaOpen ? '▾' : '▸'}</span>
          </div>

          {metaOpen && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Zichtbaar + verwijderen */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {onTogglePublished && (
                  <button
                    onClick={onTogglePublished}
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
                      fontFamily: 'inherit', fontWeight: 600, border: 'none',
                      background: published ? 'color-mix(in srgb, var(--color-success) 15%, var(--color-surface))' : 'color-mix(in srgb, var(--color-warning) 15%, var(--color-surface))',
                      color: published ? 'var(--color-success)' : 'var(--color-warning)',
                    }}
                  >{published ? '● Zichtbaar' : '○ Concept'}</button>
                )}
                {onDelete && !confirmDel && (
                  <button
                    onClick={() => setConfirmDel(true)}
                    style={{ ...ghostBtn, borderColor: 'var(--color-danger)', color: 'var(--color-danger)', fontSize: 11 }}
                  >Verwijderen</button>
                )}
                {confirmDel && (
                  <>
                    <button onClick={() => setConfirmDel(false)} style={ghostBtn}>Nee</button>
                    <button onClick={handleDelete} disabled={deleting}
                      style={{ ...ghostBtn, borderColor: 'var(--color-danger)', color: 'var(--color-danger)', opacity: deleting ? 0.5 : 1 }}
                    >{deleting ? 'Bezig…' : 'Ja, verwijderen'}</button>
                  </>
                )}
              </div>

              {/* Seizoenskeuze */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Seizoen:</span>
                {KNOWN_SEASONS.map(s => (
                  <button key={s} onClick={() => setSeason(s)} style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 99, fontFamily: 'inherit', cursor: 'pointer',
                    border: `1px solid ${season === s ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: season === s ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: season === s ? '#fff' : 'var(--color-text)',
                  }}>{s}</button>
                ))}
              </div>

              {/* FASE-TAGS */}
              <div>
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
                      <button onClick={() => setConfirmTag(tag)} style={{
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

            </div>
          )}
        </div>
      )}

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
          onToggleVisible={() => handleToggleVisible(lnk)}
          onToggleScanProfile={() => handleToggleScanProfile(lnk)}
          onRemove={() => setConfirmLink(lnk)}
          onOpenDetail={() => setSelectedLnk(lnk)}
        />
      ))}

      {/* ── Competitie koppelen ──────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showPicker ? 12 : 0 }}>
          <div style={cardLabel}>COMPETITIE KOPPELEN</div>
          {showPicker && selectedComps.size > 0 && (
            <button
              onClick={handleBulkAdd}
              disabled={adding}
              style={{ ...ghostBtn, fontSize: 12, color: 'var(--color-primary)', borderColor: 'var(--color-primary)', opacity: adding ? 0.5 : 1 }}
            >
              {adding ? 'Bezig…' : `+ Koppel ${selectedComps.size} geselecteerde`}
            </button>
          )}
          <button
            onClick={() => { setShowPicker(p => !p); setFilterQ(''); setSelectedComps(new Set()) }}
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
                {pickerComps.map(comp => {
                  const checked = selectedComps.has(comp.id)
                  return (
                    <div key={comp.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', borderRadius: 8,
                      border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: checked ? 'var(--color-primary)11' : 'var(--color-surface)',
                      cursor: adding ? 'default' : 'pointer',
                    }} onClick={() => {
                      if (adding) return
                      setSelectedComps(prev => {
                        const n = new Set(prev)
                        if (n.has(comp.id)) n.delete(comp.id); else n.add(comp.id)
                        return n
                      })
                    }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        onClick={e => e.stopPropagation()}
                        style={{ flexShrink: 0, width: 'auto', accentColor: 'var(--color-primary)' }}
                      />
                      <span style={{ fontSize: 11, opacity: 0.6, flexShrink: 0 }}>
                        {comp.hockey_type === 'ZA' ? '🏒' : '🏑'}
                      </span>
                      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{comp.name}</span>
                        {comp.class_name && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{comp.class_name}</span>}
                      </span>
                      {!checked && (
                        <button onClick={e => { e.stopPropagation(); if (!adding) handleAdd(comp) }} disabled={adding}
                          style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                          + Direct
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
