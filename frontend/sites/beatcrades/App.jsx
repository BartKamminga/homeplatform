import { useState, useEffect, useRef, useCallback } from 'react'
import { getTree, createSection, updateSection, deleteSection, mergeSections, createRack, updateRack, deleteRack, mergeRacks, createCrade, updateCrade, deleteCrade, restartCrade, cancelCrade } from './api.js'
import { FORMATS, detectSrc, slugFromBeatportUrl, todayName, allCradesFrom } from './helpers.js'
import { SectionIcon } from './components/Icons.jsx'
import { CradeRow } from './components/CradeRow.jsx'
import { RackBlock } from './components/RackBlock.jsx'
import { PlaceholderRow } from './components/PlaceholderRow.jsx'
import { SettingsPanel } from './components/SettingsPanel.jsx'
import './App.css'

export default function App() {
  const [tree,          setTree]         = useState({ sections: [], racks: [], crades: [] })
  const [newOpen,       setNewOpen]      = useState(false)
  const [newName,       setNewName]      = useState('')
  const [newUrl,        setNewUrl]       = useState('')
  const [newFmt,        setNewFmt]       = useState(() => localStorage.getItem('bc_fmt') || 'flac')
  const [newRack,       setNewRack]      = useState('')
  const [submitting,    setSubmitting]   = useState(false)
  const [err,           setErr]          = useState('')
  const [openSections,  setOpenSections] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bc_open_sections') || '{}') } catch { return {} }
  })
  const [openRacks,     setOpenRacks]    = useState(() => {
    try { return JSON.parse(localStorage.getItem('bc_open_racks') || '{}') } catch { return {} }
  })
  const [openCrades,    setOpenCrades]   = useState({})
  const [draggingCrade,   setDraggingCrade]   = useState(null)
  const [draggingRack,    setDraggingRack]    = useState(null)
  const [draggingSection, setDraggingSection] = useState(null)
  const [dragOver,        setDragOver]        = useState(null)
  const [dlg,           setDlg]          = useState(null)
  const [panelOpen,     setPanelOpen]    = useState(false)
  const [newMenuOpen,   setNewMenuOpen]  = useState(false)
  const timerRef   = useRef(null)
  const newMenuRef = useRef(null)
  const urlRef   = useRef(null)

  const openPrompt  = (title, initial = '')              => new Promise(res => setDlg({ type: 'prompt',  title, value: initial, resolve: res }))
  const openConfirm = (msg, confirmLabel = 'Verwijderen') => new Promise(res => setDlg({ type: 'confirm', msg, confirmLabel,          resolve: res }))
  const closeDlg    = val => { dlg?.resolve(val); setDlg(null) }

  useEffect(() => { localStorage.setItem('bc_open_sections', JSON.stringify(openSections)) }, [openSections])
  useEffect(() => { localStorage.setItem('bc_open_racks',    JSON.stringify(openRacks))    }, [openRacks])
  useEffect(() => {
    if (!newMenuOpen) return
    const h = e => { if (newMenuRef.current && !newMenuRef.current.contains(e.target)) setNewMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [newMenuOpen])

  const load = () => getTree().then(setTree).catch(() => {})
  useEffect(() => { load() }, [])
  useEffect(() => {
    clearInterval(timerRef.current)
    const all = allCradesFrom(tree)
    const isActive = all.some(c => c.status === 'downloading' || c.status === 'queued')
    if (isActive) {
      const ms = all.some(c => c.status === 'downloading') ? 2000 : 4000
      timerRef.current = setInterval(load, ms)
    }
    return () => clearInterval(timerRef.current)
  }, [tree])

  const pickFmt = f => { setNewFmt(f); localStorage.setItem('bc_fmt', f) }

  const openNew = () => {
    setNewName(todayName()); setNewUrl(''); setNewRack(''); setErr(''); setNewOpen(true)
    setTimeout(() => urlRef.current?.focus(), 60)
  }

  const submitCrade = async e => {
    e.preventDefault()
    if (!newUrl.trim()) return
    setSubmitting(true); setErr('')
    try {
      await createCrade({ name: newName || todayName(), source_url: newUrl.trim(), format: newFmt, group_id: newRack || null })
      setNewOpen(false); await load()
    } catch (ex) {
      setErr(ex.message || 'Aanmaken mislukt')
    } finally { setSubmitting(false) }
  }

  // ── Section actions ──
  const addSectionInline = async name => { await createSection({ name }); await load() }
  const renameSection = async (id, cur) => {
    const name = await openPrompt('Nieuwe naam:', cur)
    if (!name?.trim() || name === cur) return
    await updateSection(id, { name: name.trim() }); await load()
  }
  const removeSection = async id => {
    if (!await openConfirm('Section verwijderen? Racks worden losgemaakt.')) return
    await deleteSection(id); await load()
  }
  const mergeSection = async (sourceId, targetId) => {
    const src = tree.sections.find(s => s.id === sourceId)
    const tgt = tree.sections.find(s => s.id === targetId)
    if (!src || !tgt) return
    if (!await openConfirm(`Sectie "${src.name}" samenvoegen met "${tgt.name}"? Alle racks schuiven over naar "${tgt.name}" en "${src.name}" verdwijnt.`, 'Samenvoegen')) return
    await mergeSections(String(sourceId), String(targetId))
    await load()
  }
  const mergeRack = async (sourceId, targetId) => {
    const allRacksList = [
      ...tree.sections.flatMap(s => s.racks),
      ...tree.racks,
    ]
    const src = allRacksList.find(r => r.id === sourceId)
    const tgt = allRacksList.find(r => r.id === targetId)
    if (!src || !tgt) return
    if (!await openConfirm(`Rack "${src.name}" samenvoegen met "${tgt.name}"? Alle crades schuiven over naar "${tgt.name}" en "${src.name}" verdwijnt.`, 'Samenvoegen')) return
    await mergeRacks(String(sourceId), String(targetId))
    await load()
  }

  // ── Rack actions ──
  const addRack = async (sectionId = null) => {
    const name = await openPrompt('Naam van de nieuwe Rack:')
    if (!name?.trim()) return
    const rack = await createRack({ name: name.trim(), section_id: sectionId })
    setOpenRacks(r => ({ ...r, [rack.id]: true }))
    await load()
  }
  const addRackInSection = async (sectionId, name) => {
    const rack = await createRack({ name, section_id: sectionId })
    setOpenRacks(r => ({ ...r, [rack.id]: true }))
    await load()
  }
  const renameRack = async (id, cur) => {
    const name = await openPrompt('Nieuwe naam:', cur)
    if (!name?.trim() || name === cur) return
    await updateRack(id, { name: name.trim() }); await load()
  }
  const removeRack = async id => {
    if (!await openConfirm('Rack verwijderen? Crades worden losgemaakt.')) return
    await deleteRack(id); await load()
  }

  // ── Crade actions ──
  const addCradeInRack = async (rackId, url) => {
    const slug = detectSrc(url) === 'beatport' ? slugFromBeatportUrl(url) : null
    const fmt = localStorage.getItem('bc_fmt') || 'flac'
    await createCrade({ name: slug || todayName(), source_url: url, format: fmt, group_id: rackId })
    await load()
  }
  const renameCrade = async (id, cur) => {
    const name = await openPrompt('Nieuwe naam:', cur)
    if (!name?.trim() || name === cur) return
    await updateCrade(id, { name: name.trim() }); await load()
  }
  const removeCrade = async id => {
    if (!await openConfirm('Crade verwijderen inclusief alle downloads?')) return
    await deleteCrade(id)
    setTree(t => ({
      ...t,
      crades: t.crades.filter(c => c.id !== id),
      racks: t.racks.map(r => ({ ...r, crades: r.crades.filter(c => c.id !== id) })),
      sections: t.sections.map(s => ({ ...s, racks: s.racks.map(r => ({ ...r, crades: r.crades.filter(c => c.id !== id) })) })),
    }))
  }
  const onRestartCrade = async id => { await restartCrade(id).catch(() => {}); await load() }
  const onCancelCrade  = async id => { await cancelCrade(id).catch(() => {});  await load() }
  const onMoveCrade    = async (id, rackId) => { await updateCrade(id, { group_id: rackId || null }); await load() }

  // ── Crade drag-drop ──
  const onCradeDragStart = (e, id) => { setDraggingCrade(id); e.dataTransfer.effectAllowed = 'move' }
  const onCradeDragEnd   = ()      => { setDraggingCrade(null); setDragOver(null) }
  const onRackDragOver   = (e, rackId) => {
    if (!draggingCrade) return
    e.preventDefault(); setDragOver({ kind: 'rack', id: rackId })
  }
  const onRackDrop = async (e, rackId) => {
    e.preventDefault()
    if (draggingCrade) { await updateCrade(draggingCrade, { group_id: rackId }); await load() }
    setDraggingCrade(null); setDragOver(null)
  }
  const onCradeRootDragOver = e => {
    if (!draggingCrade) return
    e.preventDefault(); setDragOver({ kind: 'root-crade', id: null })
  }
  const onCradeRootDrop = async e => {
    e.preventDefault()
    if (draggingCrade) { await updateCrade(draggingCrade, { group_id: null }); await load() }
    setDraggingCrade(null); setDragOver(null)
  }

  // ── Rack drag-drop ──
  const onRackDragStart  = (e, id) => { setDraggingRack(id); e.dataTransfer.effectAllowed = 'move' }
  const onRackDragEnd    = ()      => { setDraggingRack(null); setDragOver(null) }
  const onSectionDragOver = (e, sectionId) => {
    if (!draggingRack) return
    e.preventDefault(); setDragOver({ kind: 'section', id: sectionId })
  }
  const onSectionDrop = async (e, sectionId) => {
    e.preventDefault()
    if (draggingRack) { await updateRack(draggingRack, { section_id: sectionId }); await load() }
    setDraggingRack(null); setDragOver(null)
  }
  const onRackRootDragOver = e => {
    if (!draggingRack) return
    e.preventDefault(); setDragOver({ kind: 'root-rack', id: null })
  }
  const onRackRootDrop = async e => {
    e.preventDefault()
    if (draggingRack) { await updateRack(draggingRack, { section_id: null }); await load() }
    setDraggingRack(null); setDragOver(null)
  }

  // ── Rack drag-drop (merge) ──
  const onRackMergeDragOver = (e, rackId) => {
    if (!draggingRack || draggingRack === rackId) return
    e.preventDefault(); e.stopPropagation()
    setDragOver({ kind: 'rack-merge', id: rackId })
  }
  const onRackMergeDrop = async (e, targetId) => {
    if (!draggingRack || draggingRack === targetId) return
    e.preventDefault(); e.stopPropagation()
    await mergeRack(draggingRack, targetId)
    setDraggingRack(null); setDragOver(null)
  }

  // ── Section drag-drop (merge) ──
  const onSectionDragStart = (e, id) => { setDraggingSection(id); e.dataTransfer.effectAllowed = 'move' }
  const onSectionDragEnd   = ()      => { setDraggingSection(null); setDragOver(null) }
  const onSectionMergeDragOver = (e, sectionId) => {
    if (!draggingSection || draggingSection === sectionId) return
    e.preventDefault(); setDragOver({ kind: 'section-merge', id: sectionId })
  }
  const onSectionMergeDrop = async (e, targetId) => {
    e.preventDefault()
    if (draggingSection && draggingSection !== targetId) {
      await mergeSection(draggingSection, targetId)
    }
    setDraggingSection(null); setDragOver(null)
  }

  // ── Open state ──
  const isSectionOpen = id => id in openSections ? openSections[id] : true
  const toggleSection = id => setOpenSections(s => ({ ...s, [id]: !(id in s ? s[id] : true) }))
  const toggleRack    = id => setOpenRacks(r    => ({ ...r, [id]: !(id in r ? r[id] : false) }))
  const toggleCrade   = id => setOpenCrades(c   => ({ ...c, [id]: !c[id] }))

  const expandAll = () => {
    setOpenSections(Object.fromEntries(tree.sections.map(s => [s.id, true])))
    setOpenRacks(Object.fromEntries([...tree.sections.flatMap(s => s.racks), ...tree.racks].map(r => [r.id, true])))
  }
  const collapseAll = () => {
    setOpenSections(Object.fromEntries(tree.sections.map(s => [s.id, false])))
    setOpenRacks(Object.fromEntries([...tree.sections.flatMap(s => s.racks), ...tree.racks].map(r => [r.id, false])))
  }

  const allRacks = [
    ...tree.sections.flatMap(s => s.racks.map(r => ({ ...r, sectionName: s.name }))),
    ...tree.racks.map(r => ({ ...r, sectionName: null })),
  ]
  const isEmpty = tree.sections.length === 0 && tree.racks.length === 0 && tree.crades.length === 0

  // Item 295: duplicate URL detection
  const urlTrimmed = newUrl.trim()
  const dupCrade = urlTrimmed
    ? allCradesFrom(tree).find(c => c.source_url?.trim() === urlTrimmed)
    : null

  const rackCallbacks = {
    openRacks, openCrades, toggleRack, toggleCrade,
    draggingCrade, draggingRack, dragOver, setDragOver,
    onCradeDragStart, onCradeDragEnd,
    onRackDragOver, onRackDrop,
    onRackDragStart, onRackDragEnd,
    onRackMergeDragOver, onRackMergeDrop,
    renameRack, removeRack, removeCrade, onRestartCrade, onCancelCrade,
    renameCrade, addCradeInRack,
    allRacks, onMoveCrade,
  }

  return (
    <div className="bc-wrap">
      <header className="bc-hdr">
        <div>
          <h1 className="bc-title">BeatCrades</h1>
          <p className="bc-subtitle">Download crates — Beatport · YouTube · SoundCloud</p>
        </div>
        <div className="bc-hdr-btns">
          <button className="bc-btn bc-btn-sec" onClick={collapseAll} title="Alles inklappen">⊖</button>
          <button className="bc-btn bc-btn-sec" onClick={expandAll} title="Alles uitklappen">⊕</button>
          <button className="bc-btn bc-btn-sec" onClick={() => setPanelOpen(true)}>⚙ Instellingen</button>
          <div className="bc-new-wrap" ref={newMenuRef}>
            <button className="bc-btn bc-btn-pri" onClick={() => setNewMenuOpen(o => !o)}>＋ Nieuw ▾</button>
            {newMenuOpen && (
              <div className="bc-new-menu">
                <button className="bc-new-menu-item" onClick={() => { setNewMenuOpen(false); openNew() }}>
                  <span className="bc-new-menu-ico">🎵</span>
                  <span>Crade</span>
                  <span className="bc-new-menu-hint">URL → download</span>
                </button>
                <button className="bc-new-menu-item" onClick={() => { setNewMenuOpen(false); addRack(null) }}>
                  <span className="bc-new-menu-ico">📦</span>
                  <span>Rack</span>
                  <span className="bc-new-menu-hint">Groepeer crades</span>
                </button>
                <button className="bc-new-menu-item" onClick={() => { setNewMenuOpen(false); openPrompt('Naam nieuwe Section:').then(n => n?.trim() && addSectionInline(n.trim())) }}>
                  <span className="bc-new-menu-ico">🗂</span>
                  <span>Section</span>
                  <span className="bc-new-menu-hint">Groepeer racks</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="bc-main">

        {newOpen && (
          <div className="bc-new-card">
            <form onSubmit={submitCrade}>
              <div className="bc-field">
                <label>Naam</label>
                <input className="bc-inp" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="bc-field">
                <label>URL</label>
                <div style={{ flex: 1 }}>
                  <input className="bc-inp" style={{ width: '100%' }} ref={urlRef} value={newUrl}
                    onChange={e => {
                      const url = e.target.value
                      setNewUrl(url)
                      if (detectSrc(url) === 'beatport' && newName === todayName()) {
                        const slug = slugFromBeatportUrl(url)
                        if (slug) setNewName(slug)
                      }
                    }}
                    placeholder="Beatport-, YouTube- of SoundCloud-URL…" required />
                  {dupCrade && (
                    <div className="bc-dup-warn">
                      ⚠ Deze URL bestaat al: <strong>{dupCrade.name}</strong>
                    </div>
                  )}
                </div>
              </div>
              <div className="bc-field">
                <label>Rack</label>
                <select className="bc-inp" value={newRack} onChange={e => setNewRack(e.target.value)}>
                  <option value="">— geen rack —</option>
                  {allRacks.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.sectionName ? `${r.sectionName} / ${r.name}` : r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bc-field">
                <label>Formaat</label>
                <div className="bc-fmt-seg">
                  {FORMATS.map(f => (
                    <button key={f} type="button" className={`bc-fmt-btn${newFmt===f?' active':''}`} onClick={() => pickFmt(f)}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                {detectSrc(newUrl) === 'beatport' && (
                  <span className="bc-fmt-note">Beatport: vereist LINK Professional voor FLAC</span>
                )}
              </div>
              {err && <div className="bc-err-msg">{err}</div>}
              <div className="bc-new-acts">
                <button type="button" className="bc-btn bc-btn-sec" onClick={() => setNewOpen(false)}>Annuleren</button>
                <button type="submit" className="bc-btn bc-btn-pri" disabled={submitting || !newUrl.trim()}>
                  {submitting ? '…' : 'Start download ↓'}
                </button>
              </div>
            </form>
          </div>
        )}

        {tree.sections.map(section => (
          <div key={section.id}
            className={`bc-section${isSectionOpen(section.id) ? ' open' : ''}${dragOver?.kind === 'section' && dragOver.id === section.id ? ' dz-over' : ''}${draggingSection === section.id ? ' dragging' : ''}`}
            onDragOver={e => { onSectionDragOver(e, section.id); onSectionMergeDragOver(e, section.id) }}
            onDrop={e => { onSectionDrop(e, section.id); onSectionMergeDrop(e, section.id) }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null) }}>

            <div className={`bc-section-head${dragOver?.kind === 'section-merge' && dragOver.id === section.id ? ' bc-section-head--merge-over' : ''}`}>
              <span className="bc-drag" title="Section slepen om samen te voegen"
                draggable
                onDragStart={e => { e.stopPropagation(); onSectionDragStart(e, section.id) }}
                onDragEnd={onSectionDragEnd}>⠿</span>
              <span className="bc-chev" onClick={() => toggleSection(section.id)}>{isSectionOpen(section.id) ? '▾' : '▸'}</span>
              <span className="bc-section-icon"><SectionIcon size={16} /></span>
              <span className="bc-section-name" onClick={e => { e.stopPropagation(); renameSection(section.id, section.name) }} title="Klik om te hernoemen">
                {section.name}
              </span>
              {(() => {
                const secTotal      = section.racks.reduce((n, r) => n + r.crades.length, 0)
                const secDone       = section.racks.reduce((n, r) => n + r.crades.filter(c => c.status === 'done').length, 0)
                const secAllDone    = secTotal > 0 && secDone === secTotal
                const secTrackTotal = section.racks.reduce((n, r) => n + r.crades.reduce((m, c) => m + (c.track_count || 0), 0), 0)
                return (
                  <span className={`bc-section-meta${secAllDone ? ' bc-section-meta--done' : ''}`}>
                    {section.racks.length} {section.racks.length === 1 ? 'rack' : 'racks'} · {secDone}/{secTotal} klaar{secTrackTotal > 0 ? ` · ${secTrackTotal} tracks` : ''}
                  </span>
                )
              })()}
              <button className="bc-del-btn" onClick={() => removeSection(section.id)} title="Section verwijderen">✕</button>
            </div>

            {isSectionOpen(section.id) && (
              <div className="bc-section-body">
                {section.racks.map(rack => (
                  <RackBlock key={rack.id} rack={rack} {...rackCallbacks} />
                ))}
                <PlaceholderRow type="rack" onSubmit={name => addRackInSection(section.id, name)} />
              </div>
            )}
          </div>
        ))}

        {tree.racks.map(rack => (
          <RackBlock key={rack.id} rack={rack} {...rackCallbacks} />
        ))}

        {tree.crades.map(crade => (
          <CradeRow key={crade.id} crade={crade}
            open={!!openCrades[crade.id]}
            onToggle={() => toggleCrade(crade.id)}
            onRename={() => renameCrade(crade.id, crade.name)}
            onDelete={() => removeCrade(crade.id)}
            onRestart={() => onRestartCrade(crade.id)}
            onCancel={() => onCancelCrade(crade.id)}
            dragging={draggingCrade === crade.id}
            onDragStart={e => onCradeDragStart(e, crade.id)}
            onDragEnd={onCradeDragEnd}
            allRacks={allRacks}
            onMove={onMoveCrade} />
        ))}

        {draggingCrade && (
          <div className={`bc-drop-zone${dragOver?.kind === 'root-crade' ? ' active' : ''}`}
            onDragOver={onCradeRootDragOver}
            onDrop={onCradeRootDrop}
            onDragLeave={() => setDragOver(null)}>
            ↩ Loslaten om crade uit rack te halen
          </div>
        )}

        {draggingRack && (
          <div className={`bc-drop-zone${dragOver?.kind === 'root-rack' ? ' active' : ''}`}
            onDragOver={onRackRootDragOver}
            onDrop={onRackRootDrop}
            onDragLeave={() => setDragOver(null)}>
            ↩ Loslaten om rack uit section te halen
          </div>
        )}

        <PlaceholderRow type="section" onSubmit={addSectionInline} />

        {isEmpty && !newOpen && (
          <div className="bc-empty">
            <p>Nog geen crades. Maak een <strong>Section</strong> aan, voeg een <strong>＋ Rack</strong> toe of start direct met <strong>＋ Crade</strong>.</p>
          </div>
        )}
      </div>

      {dlg && (
        <div className="bc-dlg-overlay" onClick={() => closeDlg(dlg.type === 'confirm' ? false : null)}>
          <div className="bc-dlg" onClick={e => e.stopPropagation()}>
            <div className="bc-dlg-title">{dlg.type === 'confirm' ? 'Bevestig' : dlg.title}</div>
            {dlg.type === 'confirm' && <p className="bc-dlg-msg">{dlg.msg}</p>}
            {dlg.type === 'prompt' && (
              <input
                className="bc-inp bc-dlg-inp"
                value={dlg.value}
                autoFocus
                onChange={e => setDlg(d => ({ ...d, value: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') closeDlg(dlg.value)
                  if (e.key === 'Escape') closeDlg(null)
                }}
              />
            )}
            <div className="bc-dlg-acts">
              <button className="bc-btn bc-btn-sec" onClick={() => closeDlg(dlg.type === 'confirm' ? false : null)}>
                Annuleren
              </button>
              <button
                className={`bc-btn ${dlg.type === 'confirm' ? 'bc-btn-danger' : 'bc-btn-pri'}`}
                autoFocus={dlg.type === 'confirm'}
                onClick={() => closeDlg(dlg.type === 'confirm' ? true : dlg.value)}
                onKeyDown={e => { if (e.key === 'Escape') closeDlg(dlg.type === 'confirm' ? false : null) }}
              >
                {dlg.type === 'confirm' ? (dlg.confirmLabel ?? 'Verwijderen') : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {panelOpen && (
        <SettingsPanel onClose={() => setPanelOpen(false)} onDone={load} />
      )}
    </div>
  )
}
