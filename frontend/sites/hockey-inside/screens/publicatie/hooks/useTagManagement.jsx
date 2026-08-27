import { useState, useEffect } from 'react'
import { getPublicationTags, addPublicationTag, updatePublicationTag, removePublicationTag, reorderPublicationTags } from '../../../api.js'

// Uitgesplitst uit CompetitiesTab.jsx (RFTR-B6, item 989, fase 6.4).
// categories: uit useCategoryManagement, nodig om een tag-categorie te
// denormaliseren (category_name/category_order) bij toewijzing.
export function useTagManagement(flash, categories) {
  const [globalTags,       setGlobalTags]       = useState([])
  const [newTagName,       setNewTagName]       = useState('')
  const [newTagCategoryId, setNewTagCategoryId] = useState('')
  const [addingTag,        setAddingTag]        = useState(false)
  const [confirmTag,       setConfirmTag]       = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try { setGlobalTags(await getPublicationTags()) }
    catch { /* stil */ }
  }

  async function handleAddTag() {
    const name = newTagName.trim()
    if (!name) return
    setAddingTag(true)
    try {
      const t = await addPublicationTag({ name, category_id: newTagCategoryId || null })
      setGlobalTags(prev => prev.some(x => x.id === t.id) ? prev : [...prev, t])
      setNewTagName('')
      setNewTagCategoryId('')
    } catch (e) { flash(e.message, true) }
    finally { setAddingTag(false) }
  }

  function handleReorderTags(newList) {
    setGlobalTags(newList)
    reorderPublicationTags(newList.map(t => t.id)).catch(() => {})
  }

  // item 883: knoppen i.p.v. drag-and-drop (werkt niet op touchscreens) -
  // zelfde patroon als PublicatieTab.jsx.
  function moveTag(idx, dir) {
    const target = idx + dir
    if (target < 0 || target >= globalTags.length) return
    const next = [...globalTags]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    handleReorderTags(next)
  }

  async function doRemoveTag(tag) {
    setConfirmTag(null)
    try {
      await removePublicationTag(tag.id)
      setGlobalTags(prev => prev.filter(x => x.id !== tag.id))
      return true
    } catch (e) { flash(e.message, true); return false }
  }

  // item 749: tag toewijzen aan een categorie (of terug naar "Overig" met null)
  // - puur organisatorisch, verandert niets aan de AND-filterlogica op naam.
  async function handleAssignTagCategory(tagId, categoryId) {
    const cat = categories.find(c => c.id === categoryId) || null
    setGlobalTags(prev => prev.map(t => t.id === tagId
      ? { ...t, category_id: categoryId, category_name: cat?.name ?? null, category_order: cat?.order ?? null }
      : t
    ))
    try {
      await updatePublicationTag(tagId, { category_id: categoryId })
    } catch (e) {
      await load()
      flash(e.message, true)
    }
  }

  function declassifyCategory(categoryId) {
    setGlobalTags(prev => prev.map(t => t.category_id === categoryId
      ? { ...t, category_id: null, category_name: null, category_order: null }
      : t
    ))
  }

  return {
    globalTags, setGlobalTags, newTagName, setNewTagName, newTagCategoryId, setNewTagCategoryId,
    addingTag, confirmTag, setConfirmTag,
    handleAddTag, moveTag, doRemoveTag, handleAssignTagCategory, declassifyCategory,
  }
}
