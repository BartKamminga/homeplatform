import { useState, useEffect, useRef } from 'react'
import {
  getTree, createSection, updateSection, deleteSection, mergeSections, createRack, updateRack, deleteRack,
  mergeRacks, createCrade, updateCrade, deleteCrade, restartCrade, cancelCrade, reorderRacks,
} from '../../api.js'
import { detectSrc, slugFromBeatportUrl, todayName, allCradesFrom } from '../../helpers.js'

// Bibliotheek-state en acties voor de arcade-variant (item 1338). Kopie van de logica in classic App.jsx,
// met dezelfde API-calls en localStorage-keys (bc_open_sections/bc_open_racks/bc_fmt).
function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}

export function useLibrary({ ask, confirm }) {
  const [tree, setTree] = useState({ sections: [], racks: [], crades: [] })
  const [loaded, setLoaded] = useState(false)
  const [openSections, setOpenSections] = useState(() => readJson('bc_open_sections'))
  const [openRacks, setOpenRacks] = useState(() => readJson('bc_open_racks'))
  const [openCrades, setOpenCrades] = useState({})
  const timer = useRef(null)

  const load = () => getTree().then(setTree).catch(() => {}).finally(() => setLoaded(true))
  useEffect(() => { load() }, [])
  useEffect(() => { localStorage.setItem('bc_open_sections', JSON.stringify(openSections)) }, [openSections])
  useEffect(() => { localStorage.setItem('bc_open_racks', JSON.stringify(openRacks)) }, [openRacks])

  // Pollen zolang er iets downloadt of wacht.
  useEffect(() => {
    clearInterval(timer.current)
    const all = allCradesFrom(tree)
    if (all.some(c => c.status === 'downloading' || c.status === 'queued')) {
      timer.current = setInterval(load, all.some(c => c.status === 'downloading') ? 2000 : 4000)
    }
    return () => clearInterval(timer.current)
  }, [tree])

  const allRacks = [
    ...tree.sections.flatMap(s => s.racks.map(r => ({ ...r, sectionName: s.name }))),
    ...tree.racks.map(r => ({ ...r, sectionName: null })),
  ]
  const findRack = id => allRacks.find(r => r.id === id) || null
  const rackSectionId = id => tree.sections.find(s => s.racks.some(r => r.id === id))?.id ?? null

  async function rename(kind, id, cur) {
    const name = await ask(`RENAME ${kind.toUpperCase()}`, cur)
    if (!name?.trim() || name === cur) return
    const fn = { section: updateSection, rack: updateRack, crade: updateCrade }[kind]
    await fn(id, { name: name.trim() }); await load()
  }

  const actions = {
    addSection: async name => { await createSection({ name }); await load() },
    promptSection: async () => { const n = await ask('NEW SECTION'); if (n?.trim()) await actions.addSection(n.trim()) },
    addRack: async (sectionId, name) => {
      const n = name ?? await ask('NEW RACK')
      if (!n?.trim()) return
      const rack = await createRack({ name: n.trim(), section_id: sectionId })
      setOpenRacks(r => ({ ...r, [rack.id]: true })); await load()
    },
    renameSection: (id, cur) => rename('section', id, cur),
    renameRack: (id, cur) => rename('rack', id, cur),
    renameCrade: (id, cur) => rename('crade', id, cur),
    removeSection: async id => {
      if (!await confirm('DELETE SECTION?', 'Its racks stay, but are no longer in a section.')) return
      await deleteSection(id); await load()
    },
    removeRack: async id => {
      if (!await confirm('DELETE RACK?', 'Its crades stay, but are no longer in a rack.')) return
      await deleteRack(id); await load()
    },
    removeCrade: async id => {
      if (!await confirm('DELETE CRADE?', 'The crade and all its downloads are removed.')) return
      await deleteCrade(id); await load()
    },
    setRackFormat: async (id, fmt) => { await updateRack(id, { default_format: fmt || null }).catch(() => {}); await load() },
    createCrade: async body => { await createCrade(body); await load() },
    addCradeInRack: async (rackId, url) => {
      const slug = detectSrc(url) === 'beatport' ? slugFromBeatportUrl(url) : null
      const fmt = findRack(rackId)?.default_format || localStorage.getItem('bc_fmt') || 'flac'
      await createCrade({ name: slug || todayName(), source_url: url, format: fmt, group_id: rackId }); await load()
    },
    restartCrade: async id => { await restartCrade(id).catch(() => {}); await load() },
    cancelCrade: async id => { await cancelCrade(id).catch(() => {}); await load() },
    moveCrade: async (id, rackId) => { await updateCrade(id, { group_id: rackId }); await load() },
    moveRack: async (id, sectionId) => { await updateRack(id, { section_id: sectionId }); await load() },
    mergeSection: async (srcId, tgtId) => {
      const src = tree.sections.find(s => s.id === srcId), tgt = tree.sections.find(s => s.id === tgtId)
      if (!src || !tgt) return
      if (!await confirm('MERGE SECTIONS?', `All racks of "${src.name}" move to "${tgt.name}" and "${src.name}" is removed.`, 'MERGE', false)) return
      await mergeSections(String(srcId), String(tgtId)); await load()
    },
    // Rack op rack: zelfde container = herordenen, anders samenvoegen.
    dropRackOnRack: async (dragId, targetId) => {
      const sec = rackSectionId(dragId)
      if (sec === rackSectionId(targetId)) {
        const ids = (sec ? tree.sections.find(s => s.id === sec)?.racks : tree.racks).map(r => r.id)
        const from = ids.indexOf(dragId), to = ids.indexOf(targetId)
        if (from === -1 || to === -1 || from === to) return
        ids.splice(from, 1); ids.splice(to, 0, dragId)
        await reorderRacks(ids); await load()
        return
      }
      const src = findRack(dragId), tgt = findRack(targetId)
      if (!src || !tgt) return
      if (!await confirm('MERGE RACKS?', `All crades of "${src.name}" move to "${tgt.name}" and "${src.name}" is removed.`, 'MERGE', false)) return
      await mergeRacks(String(dragId), String(targetId)); await load()
    },
  }

  const open = {
    section: id => (id in openSections ? openSections[id] : true),
    rack: id => (id in openRacks ? openRacks[id] : false),
    crade: id => !!openCrades[id],
    toggleSection: id => setOpenSections(s => ({ ...s, [id]: !(id in s ? s[id] : true) })),
    toggleRack: id => setOpenRacks(r => ({ ...r, [id]: !(id in r ? r[id] : false) })),
    toggleCrade: id => setOpenCrades(c => ({ ...c, [id]: !c[id] })),
    all: value => {
      setOpenSections(Object.fromEntries(tree.sections.map(s => [s.id, value])))
      setOpenRacks(Object.fromEntries(allRacks.map(r => [r.id, value])))
    },
  }

  return { tree, loaded, load, allRacks, rackSectionId, actions, open }
}
