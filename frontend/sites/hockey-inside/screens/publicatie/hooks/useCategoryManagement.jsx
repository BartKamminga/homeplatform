import { useState, useEffect } from 'react'
import { getTagCategories, addTagCategory, removeTagCategory, reorderTagCategories } from '../../../api.js'

// Uitgesplitst uit CompetitiesTab.jsx (RFTR-B6, item 989, fase 6.4).
export function useCategoryManagement(flash) {
  const [categories, setCategories] = useState([])
  const [newCatName, setNewCatName] = useState('')
  const [addingCat,  setAddingCat]  = useState(false)
  const [confirmCat, setConfirmCat] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try { setCategories(await getTagCategories()) }
    catch { /* stil */ }
  }

  async function handleAddCategory() {
    const name = newCatName.trim()
    if (!name) return
    setAddingCat(true)
    try {
      const c = await addTagCategory({ name })
      setCategories(prev => prev.some(x => x.id === c.id) ? prev : [...prev, c])
      setNewCatName('')
    } catch (e) { flash(e.message, true) }
    finally { setAddingCat(false) }
  }

  function handleReorderCategories(newList) {
    setCategories(newList)
    reorderTagCategories(newList.map(c => c.id)).catch(() => {})
  }

  // item 883: knoppen i.p.v. drag-and-drop (werkt niet op touchscreens) -
  // zelfde patroon als PublicatieTab.jsx.
  function moveCategory(idx, dir) {
    const target = idx + dir
    if (target < 0 || target >= categories.length) return
    const next = [...categories]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    handleReorderCategories(next)
  }

  async function doRemoveCategory(cat) {
    setConfirmCat(null)
    try {
      await removeTagCategory(cat.id)
      setCategories(prev => prev.filter(x => x.id !== cat.id))
      return true
    } catch (e) { flash(e.message, true); return false }
  }

  return {
    categories, newCatName, setNewCatName, addingCat, confirmCat, setConfirmCat,
    handleAddCategory, moveCategory, doRemoveCategory,
  }
}
