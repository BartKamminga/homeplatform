import { useState, useEffect } from 'react'
import {
  getPublicationComps, addPublicationComp, updatePublicationComp, removePublicationComp,
  getDiscoveryComps, syncCompetition, assignCompTag, removeCompTag,
} from '../../../api.js'

// Uitgesplitst uit CompetitiesTab.jsx (RFTR-B6, item 989, fase 6.4).
// globalTags: uit useTagManagement, nodig om een tag-naam te resolven bij
// toewijzing aan een koppeling.
export function useCompetitionLinks(tid, season, globalTags, flash) {
  const [links,   setLinks]   = useState([])
  const [allComps, setAllComps] = useState([])
  const [loading, setLoading] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [filterQ, setFilterQ] = useState('')
  const [adding,  setAdding]  = useState(false)
  const [selectedComps, setSelectedComps] = useState(new Set())
  const [confirmLink,   setConfirmLink]   = useState(null)
  const [selectedLnk,   setSelectedLnk]   = useState(null)

  useEffect(() => { if (tid) loadLinks() }, [tid])
  useEffect(() => { if (tid) loadComps() }, [tid, season])

  async function loadLinks() {
    setLoading(true)
    try { setLinks(await getPublicationComps(tid)) }
    catch (e) { flash(e.message, true) }
    finally { setLoading(false) }
  }

  async function loadComps() {
    try {
      const r = await getDiscoveryComps(season)
      setAllComps(r.competitions || [])
    } catch { /* stil */ }
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

  function stripTagFromLinks(tagId) {
    setLinks(prev => prev.map(l => ({
      ...l, fase_tags: (l.fase_tags || []).filter(t => t.id !== tagId),
    })))
  }

  return {
    links, allComps, loading, showPicker, setShowPicker, filterQ, setFilterQ,
    adding, selectedComps, setSelectedComps, confirmLink, setConfirmLink, selectedLnk, setSelectedLnk,
    loadLinks, handleAdd, handleBulkAdd, handleToggleVisible, handleToggleScanProfile, doRemoveLink,
    handleAssignTag, handleRemoveCompTag, stripTagFromLinks,
  }
}
