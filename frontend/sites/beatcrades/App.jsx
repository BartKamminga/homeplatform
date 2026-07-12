import { useState, useEffect, useRef } from 'react'
import { getTree, createSection, updateSection, deleteSection, createRack, updateRack, deleteRack, createCrade, updateCrade, deleteCrade, restartCrade, cancelCrade } from './api.js'
import { FORMATS, detectSrc, slugFromBeatportUrl, todayName, allCradesFrom } from './helpers.js'
import { SectionIcon } from './components/Icons.jsx'
import { CradeRow } from './components/CradeRow.jsx'
import { RackBlock } from './components/RackBlock.jsx'
import { PlaceholderRow } from './components/PlaceholderRow.jsx'
import { SyncModal } from './components/SyncModal.jsx'
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
  const [openSections,  setOpenSections] = useState({})
  const [openRacks,     setOpenRacks]    = useState({})
  const [openCrades,    setOpenCrades]   = useState({})
  const [draggingCrade, setDraggingCrade] = useState(null)
  const [draggingRack,  setDraggingRack]  = useState(null)
  const [dragOver,      setDragOver]     = useState(null)
  const [dlg,           setDlg]          = useState(null)
  const [syncOpen,      setSyncOpen]     = useState(false)
  const timerRef = useRef(null)
  const urlRef   = useRef(null)

  const openPrompt  = (title, initial = '') => new Promise(res => setDlg({ type: 'prompt',  title, value: initial, resolve: res }))
  const openConfirm = (msg)                 => new Promise(res => setDlg({ type: 'confirm', msg,                   resolve: res }))
  const closeDlg    = val => { dlg?.resolve(val); setDlg(null) }

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

  // ── Rack actions ──
  const addRack = async (sectionId = null) => {
    const name = await openPrompt('Naam van de nieuwe Rack:')
    if (!name?.trim()) return
    await createRack({ name: name.trim(), section_id: sectionId }); await load()
  }
  const addRackInSection = async (sectionId, name) => {
    await createRack({ name, section_id: sectionId }); await load()
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

  // ── Open state ──
  const isSectionOpen = id => id in openSections ? openSections[id] : true
  const toggleSection = id => setOpenSections(s => ({ ...s, [id]: !(id in s ? s[id] : true) }))
  const toggleRack    = id => setOpenRacks(r    => ({ ...r, [id]: !(id in r ? r[id] : false) }))
  const toggleCrade   = id => setOpenCrades(c   => ({ ...c, [id]: !c[id] }))

  const allRacks = [
    ...tree.sections.flatMap(s => s.racks.map(r => ({ ...r, sectionName: s.name }))),
    ...tree.racks.map(r => ({ ...r, sectionName: null })),
  ]
  const isEmpty = tree.sections.length === 0 && tree.racks.length === 0 && tree.crades.length === 0

  const rackCallbacks = {
    openRacks, openCrades, toggleRack, toggleCrade,
    draggingCrade, draggingRack, dragOver, setDragOver,
    onCradeDragStart, onCradeDragEnd,
    onRackDragOver, onRackDrop,
    onRackDragStart, onRackDragEnd,
    renameRack, removeRack, removeCrade, onRestartCrade, onCancelCrade,
    renameCrade, addCradeInRack,
  }

  return (
    <div className="bc-wrap">
      <header className="bc-hdr">
        <div>
          <h1 className="bc-title">BeatCrades</h1>
          <p className="bc-subtitle">Download crates — Beatport · YouTube · SoundCloud</p>
        </div>
        <div className="bc-hdr-btns">
          <button className="bc-btn bc-btn-sec" onClick={() => setSyncOpen(true)}>🔄 Sync</button>
          <button className="bc-btn bc-btn-sec" onClick={() => addRack(null)}>＋ Rack</button>
          <button className="bc-btn bc-btn-pri" onClick={openNew}>＋ Crade</button>
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
                <input className="bc-inp" ref={urlRef} value={newUrl}
                  onChange={e => {
                    const url = e.target.value
                    setNewUrl(url)
                    if (detectSrc(url) === 'beatport' && newName === todayName()) {
                      const slug = slugFromBeatportUrl(url)
                      if (slug) setNewName(slug)
                    }
                  }}
                  placeholder="Beatport-, YouTube- of SoundCloud-URL…" required />
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
              {detectSrc(newUrl) === 'beatport' ? (
                <div className="bc-field">
                  <label>Formaat</label>
                  <span className="bc-fmt-locked">🎵 Via beatportdl config</span>
                </div>
              ) : (
                <div className="bc-field">
                  <label>Formaat</label>
                  <div className="bc-fmt-seg">
                    {FORMATS.map(f => (
                      <button key={f} type="button" className={`bc-fmt-btn${newFmt===f?' active':''}`} onClick={() => pickFmt(f)}>
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
            className={`bc-section${isSectionOpen(section.id) ? ' open' : ''}${dragOver?.kind === 'section' && dragOver.id === section.id ? ' dz-over' : ''}`}
            onDragOver={e => onSectionDragOver(e, section.id)}
            onDrop={e => onSectionDrop(e, section.id)}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null) }}>

            <div className="bc-section-head">
              <span className="bc-chev" onClick={() => toggleSection(section.id)}>{isSectionOpen(section.id) ? '▾' : '▸'}</span>
              <span className="bc-section-icon"><SectionIcon size={16} /></span>
              <span className="bc-section-name" onClick={() => renameSection(section.id, section.name)} title="Klik om te hernoemen">
                {section.name}
              </span>
              <span className="bc-section-meta">
                {section.racks.length} {section.racks.length === 1 ? 'rack' : 'racks'} · {section.racks.reduce((n, r) => n + r.crades.length, 0)} crades
              </span>
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
            onDragEnd={onCradeDragEnd} />
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
                {dlg.type === 'confirm' ? 'Verwijderen' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {syncOpen && (
        <SyncModal onClose={() => setSyncOpen(false)} onDone={load} />
      )}
    </div>
  )
}
