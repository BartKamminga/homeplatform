import { useState, useEffect, useRef } from 'react'
import {
  getPublicationComps, addPublicationComp, updatePublicationComp, removePublicationComp,
  getDiscoveryComps, syncCompetition,
  getPublicationTags, addPublicationTag, removePublicationTag, reorderPublicationTags,
  assignCompTag, removeCompTag,
  KNOWN_SEASONS,
} from '../../api.js'
import { card, muted, successBanner, errorBanner } from '../styles.js'
import { useCollapse } from '../ui.jsx'
import CompetitieDetailView from './CompetitieDetailView.jsx'
import CompetitionRow from './CompetitionRow.jsx'
import InlineConfirm from './InlineConfirm.jsx'
import BeheerPanel from './BeheerPanel.jsx'
import CompetitiePicker from './CompetitiePicker.jsx'

function normalizeSeason(s) {
  if (!s) return '2026-2027'
  const clean = s.trim().replace(/\s*-\s*/, '-')
  return KNOWN_SEASONS.includes(clean) ? clean : '2026-2027'
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
  const [metaOpen,    toggleMetaOpen] = useCollapse(false)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const tagDragIdx = useRef(null)
  const [tagOverIdx, setTagOverIdx] = useState(null)

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

  // item 746: tags kunnen slepen om volgorde te bepalen - zelfde patroon als
  // publicatie-reorder (PublicatieTab.jsx), maar dan voor de globale tag-lijst.
  function handleReorderTags(newList) {
    setGlobalTags(newList)
    reorderPublicationTags(newList.map(t => t.id)).catch(() => {})
  }

  function handleTagDrop(targetIdx) {
    if (tagDragIdx.current === null || tagDragIdx.current === targetIdx) { setTagOverIdx(null); return }
    const next = [...globalTags]
    const [moved] = next.splice(tagDragIdx.current, 1)
    next.splice(targetIdx, 0, moved)
    tagDragIdx.current = null
    setTagOverIdx(null)
    handleReorderTags(next)
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

      {isAdmin && (
        <BeheerPanel
          metaOpen={metaOpen} toggleMetaOpen={toggleMetaOpen}
          published={published} onTogglePublished={onTogglePublished}
          season={season} setSeason={setSeason}
          globalTags={globalTags} onRequestDeleteTag={setConfirmTag}
          newTagName={newTagName} setNewTagName={setNewTagName} addingTag={addingTag} onAddTag={handleAddTag}
          onDelete={onDelete} confirmDel={confirmDel} setConfirmDel={setConfirmDel} deleting={deleting} onConfirmDelete={handleDelete}
          onTagDragStart={i => { tagDragIdx.current = i }}
          onTagDragOver={i => setTagOverIdx(i)}
          onTagDrop={handleTagDrop}
          tagOverIdx={tagOverIdx}
        />
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

      <CompetitiePicker
        showPicker={showPicker} setShowPicker={setShowPicker}
        selectedComps={selectedComps} setSelectedComps={setSelectedComps}
        adding={adding} onBulkAdd={handleBulkAdd} onAdd={handleAdd}
        filterQ={filterQ} setFilterQ={setFilterQ}
        pickerComps={pickerComps} allComps={allComps}
      />
    </div>
  )
}
