import { useState, useEffect, useRef } from 'react'
import { getTree, createSection, updateSection, deleteSection, createRack, updateRack, deleteRack, createCrade, updateCrade, deleteCrade, restartCrade } from './api.js'
import './App.css'

const FORMATS = ['flac', 'mp3', 'wav']
const SRC_ICON = { beatport: '🎵', youtube: '▶️', soundcloud: '☁️', auto: '🌐' }
const ST = {
  no_job:      { label: 'Leeg',  cls: 'empty' },
  queued:      { label: 'Wacht', cls: 'queued' },
  downloading: { label: 'Bezig', cls: 'active' },
  done:        { label: 'Klaar', cls: 'done' },
  error:       { label: 'Fout',  cls: 'error' },
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function SectionIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      <rect x="2" y="9" width="20" height="13" rx="1.5"/>
      <path d="M2 9 L2 7 L9 7 L11 9"/>
      <line x1="2" y1="14" x2="22" y2="14"/>
    </svg>
  )
}

function RackIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      <rect x="2" y="11" width="20" height="11" rx="1.5"/>
      <rect x="1" y="9" width="22" height="3" rx="1"/>
      <line x1="7" y1="12" x2="7" y2="22"/>
      <line x1="12" y1="12" x2="12" y2="22"/>
      <line x1="17" y1="12" x2="17" y2="22"/>
      <path d="M2 10 Q4 5 7 10"/>
      <path d="M7 10 Q9.5 3.5 12 10"/>
      <path d="M12 10 Q14.5 5.5 17 10"/>
      <path d="M17 10 Q20 7 22 10"/>
    </svg>
  )
}

function CradeIcon({ size = 18, open = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      <rect x="2" y="10" width="20" height="12" rx="1.5"/>
      <rect x="1" y="8" width="22" height="3" rx="1"/>
      <line x1="7" y1="11" x2="7" y2="22"/>
      <line x1="12" y1="11" x2="12" y2="22"/>
      <line x1="17" y1="11" x2="17" y2="22"/>
      {open && <>
        <path d="M2.5 10 Q4.5 5.5 7 10"/>
        <path d="M7 10 Q9.5 4.5 12 10"/>
        <path d="M12 10 Q14.5 6 17 10"/>
        <path d="M17 10 Q19.5 7 21.5 10"/>
      </>}
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectSrc(url) {
  const u = (url || '').toLowerCase()
  if (u.includes('beatport.com') || u.includes('beatsource.com')) return 'beatport'
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  if (u.includes('soundcloud.com')) return 'soundcloud'
  return 'auto'
}

function parseProgress(log) {
  if (!log) return { done: 0, total: null }
  let done = 0, total = null
  for (const line of log.split('\n')) {
    const m = line.match(/Downloading item (\d+) of (\d+)/i)
    if (m) { done = parseInt(m[1]); total = parseInt(m[2]) }
  }
  if (!total) done = (log.match(/Destination:/g) || []).length
  return { done, total }
}

function lastLine(log) {
  if (!log) return ''
  return log.split('\n').filter(Boolean).at(-1) || ''
}

function todayName() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
}

function allCradesFrom(tree) {
  return [
    ...tree.crades,
    ...tree.racks.flatMap(r => r.crades),
    ...tree.sections.flatMap(s => s.racks.flatMap(r => r.crades)),
  ]
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [tree,         setTree]         = useState({ sections: [], racks: [], crades: [] })
  const [newOpen,      setNewOpen]      = useState(false)
  const [newName,      setNewName]      = useState('')
  const [newUrl,       setNewUrl]       = useState('')
  const [newFmt,       setNewFmt]       = useState(() => localStorage.getItem('bc_fmt') || 'flac')
  const [newRack,      setNewRack]      = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [err,          setErr]          = useState('')
  const [openSections, setOpenSections] = useState({})
  const [openRacks,    setOpenRacks]    = useState({})
  const [openCrades,   setOpenCrades]   = useState({})
  const [draggingCrade, setDraggingCrade] = useState(null)
  const [draggingRack,  setDraggingRack]  = useState(null)
  const [dragOver,     setDragOver]     = useState(null)
  const [dlg,          setDlg]          = useState(null)
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

  // Section actions
  const addSection = async () => {
    const name = await openPrompt('Naam van de nieuwe Section:')
    if (!name?.trim()) return
    await createSection({ name: name.trim() }); await load()
  }
  const renameSection = async (id, cur) => {
    const name = await openPrompt('Nieuwe naam:', cur)
    if (!name?.trim() || name === cur) return
    await updateSection(id, { name: name.trim() }); await load()
  }
  const removeSection = async id => {
    if (!await openConfirm('Section verwijderen? Racks worden losgemaakt.')) return
    await deleteSection(id); await load()
  }

  // Rack actions
  const addRack = async (sectionId = null) => {
    const name = await openPrompt('Naam van de nieuwe Rack:')
    if (!name?.trim()) return
    await createRack({ name: name.trim(), section_id: sectionId }); await load()
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

  // Crade actions
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

  const onRestartCrade = async id => {
    await restartCrade(id).catch(() => {})
    await load()
  }

  // Crade drag-drop (crade → rack)
  const onCradeDragStart = (e, id) => { setDraggingCrade(id); e.dataTransfer.effectAllowed = 'move' }
  const onCradeDragEnd   = ()      => { setDraggingCrade(null); setDragOver(null) }

  const onRackDragOver = (e, rackId) => {
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

  // Rack drag-drop (rack → section)
  const onRackDragStart = (e, id) => { setDraggingRack(id); e.dataTransfer.effectAllowed = 'move' }
  const onRackDragEnd   = ()      => { setDraggingRack(null); setDragOver(null) }

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

  // Open state helpers
  const isSectionOpen = id => id in openSections ? openSections[id] : true
  const isRackOpen    = id => id in openRacks    ? openRacks[id]    : true
  const toggleSection = id => setOpenSections(s => ({ ...s, [id]: !(id in s ? s[id] : true) }))
  const toggleRack    = id => setOpenRacks(r    => ({ ...r, [id]: !(id in r ? r[id] : true) }))
  const toggleCrade   = id => setOpenCrades(c   => ({ ...c, [id]: !c[id] }))

  // All racks flat (for new-crade form selector)
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
    renameRack, removeRack, removeCrade, onRestartCrade,
  }

  return (
    <div className="bc-wrap">
      <header className="bc-hdr">
        <div>
          <h1 className="bc-title">BeatCrades</h1>
          <p className="bc-subtitle">Download crates — Beatport · YouTube · SoundCloud</p>
        </div>
        <div className="bc-hdr-btns">
          <button className="bc-btn bc-btn-sec" onClick={addSection}>＋ Section</button>
          <button className="bc-btn bc-btn-sec" onClick={() => addRack(null)}>＋ Rack</button>
          <button className="bc-btn bc-btn-pri" onClick={openNew}>＋ Crade</button>
        </div>
      </header>

      <div className="bc-main">

        {/* New crade form */}
        {newOpen && (
          <div className="bc-new-card">
            <form onSubmit={submitCrade}>
              <div className="bc-field">
                <label>Naam</label>
                <input className="bc-inp" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="bc-field">
                <label>URL</label>
                <input className="bc-inp" ref={urlRef} value={newUrl} onChange={e => setNewUrl(e.target.value)}
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

        {/* Sections */}
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
              <button className="bc-btn bc-btn-sec bc-btn-xs" onClick={() => addRack(section.id)}>＋ Rack</button>
              <button className="bc-del-btn" onClick={() => removeSection(section.id)} title="Section verwijderen">✕</button>
            </div>

            {isSectionOpen(section.id) && (
              <div className="bc-section-body">
                {section.racks.map(rack => (
                  <RackBlock key={rack.id} rack={rack} {...rackCallbacks} />
                ))}
                {section.racks.length === 0 && (
                  <div className="bc-section-empty">Sleep een Rack hierheen of klik ＋ Rack</div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Free racks (no section) */}
        {tree.racks.map(rack => (
          <RackBlock key={rack.id} rack={rack} {...rackCallbacks} />
        ))}

        {/* Free crades (no rack) */}
        {tree.crades.map(crade => (
          <CradeRow key={crade.id} crade={crade}
            open={isCradeOpen(crade.id)}
            onToggle={() => toggleCrade(crade.id)}
            onDelete={() => removeCrade(crade.id)}
            onRestart={() => onRestartCrade(crade.id)}
            dragging={draggingCrade === crade.id}
            onDragStart={e => onCradeDragStart(e, crade.id)}
            onDragEnd={onCradeDragEnd} />
        ))}

        {/* Unrack drop zone */}
        {draggingCrade && (
          <div className={`bc-drop-zone${dragOver?.kind === 'root-crade' ? ' active' : ''}`}
            onDragOver={onCradeRootDragOver}
            onDrop={onCradeRootDrop}
            onDragLeave={() => setDragOver(null)}>
            ↩ Loslaten om crade uit rack te halen
          </div>
        )}

        {/* Unsection drop zone */}
        {draggingRack && (
          <div className={`bc-drop-zone${dragOver?.kind === 'root-rack' ? ' active' : ''}`}
            onDragOver={onRackRootDragOver}
            onDrop={onRackRootDrop}
            onDragLeave={() => setDragOver(null)}>
            ↩ Loslaten om rack uit section te halen
          </div>
        )}

        {isEmpty && !newOpen && (
          <div className="bc-empty">
            <p>Nog geen crades. Maak een <strong>＋ Section</strong>, een <strong>＋ Rack</strong> of voeg direct een <strong>＋ Crade</strong> toe.</p>
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
    </div>
  )
}

// ── RackBlock ────────────────────────────────────────────────────────────────

function RackBlock({ rack,
  openRacks, openCrades, toggleRack, toggleCrade,
  draggingCrade, draggingRack, dragOver, setDragOver,
  onCradeDragStart, onCradeDragEnd,
  onRackDragOver, onRackDrop,
  onRackDragStart, onRackDragEnd,
  renameRack, removeRack, removeCrade, onRestartCrade,
}) {
  const isOpen = rack.id in openRacks ? openRacks[rack.id] : true
  const isDragOver = dragOver?.kind === 'rack' && dragOver.id === rack.id
  const isDragging = draggingRack === rack.id

  return (
    <div className={`bc-rack${isOpen ? ' open' : ''}${isDragOver ? ' dz-over' : ''}${isDragging ? ' dragging' : ''}`}
      onDragOver={e => onRackDragOver(e, rack.id)}
      onDrop={e => onRackDrop(e, rack.id)}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null) }}>

      <div className="bc-rack-head"
        draggable
        onDragStart={e => { e.stopPropagation(); onRackDragStart(e, rack.id) }}
        onDragEnd={onRackDragEnd}>
        <span className="bc-drag" title="Rack slepen naar Section">⠿</span>
        <span className="bc-chev" onClick={e => { e.stopPropagation(); toggleRack(rack.id) }}>{isOpen ? '▾' : '▸'}</span>
        <span className="bc-rack-icon"><RackIcon size={17} /></span>
        <span className="bc-rack-name" onClick={e => { e.stopPropagation(); renameRack(rack.id, rack.name) }} title="Klik om te hernoemen">
          {rack.name}
        </span>
        <span className="bc-rack-count">{rack.crades.length} crades</span>
        <button className="bc-del-btn" onClick={e => { e.stopPropagation(); removeRack(rack.id) }} title="Rack verwijderen">✕</button>
      </div>

      {isOpen && (
        <div className="bc-rack-body">
          {rack.crades.map(crade => (
            <CradeRow key={crade.id} crade={crade}
              open={isCradeOpen(openCrades, crade.id)}
              onToggle={() => toggleCrade(crade.id)}
              onDelete={() => removeCrade(crade.id)}
              onRestart={() => onRestartCrade(crade.id)}
              inRack
              dragging={draggingCrade === crade.id}
              onDragStart={e => onCradeDragStart(e, crade.id)}
              onDragEnd={onCradeDragEnd} />
          ))}
          {rack.crades.length === 0 && (
            <div className="bc-rack-empty">Sleep een crade in dit rack…</div>
          )}
        </div>
      )}
    </div>
  )
}

function isCradeOpen(openCrades, id) { return !!openCrades[id] }

// ── CradeRow ──────────────────────────────────────────────────────────────────

const STALL_MS = 5 * 60 * 1000  // 5 minuten zonder voortgang = vastgelopen

function CradeRow({ crade, open, onToggle, onDelete, onRestart, inRack, dragging, onDragStart, onDragEnd }) {
  const [logExpanded, setLogExpanded] = useState(false)
  const logRef = useRef(null)

  const st  = ST[crade.status] || ST.no_job
  const src = detectSrc(crade.source_url)
  const { done, total } = parseProgress(crade.progress_log)
  const pct = total ? Math.round(done / total * 100) : 0
  const isActive = crade.status === 'downloading' || crade.status === 'queued'

  const isStalled = crade.status === 'downloading' && crade.last_progress_at &&
    (Date.now() - new Date(crade.last_progress_at).getTime()) > STALL_MS

  const canRestart = crade.status === 'error' || crade.status === 'done' || isStalled

  useEffect(() => {
    if (logExpanded && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logExpanded, crade.progress_log])

  return (
    <div className={`bc-crade bc-crade--${st.cls}${open ? ' open' : ''}${inRack ? ' in-rack' : ''}${dragging ? ' dragging' : ''}`}
      draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>

      <div className="bc-crade-head" onClick={onToggle}>
        <span className="bc-drag" onClick={e => e.stopPropagation()} title="Crade slepen naar Rack">⠿</span>
        <span className="bc-chev">{open ? '▾' : '▸'}</span>
        <span className="bc-crade-icon"><CradeIcon size={18} open={open} /></span>
        <span className="bc-crade-name">{crade.name}</span>
        <div className="bc-badges">
          <span className="bc-badge bc-badge-src">{SRC_ICON[src]}</span>
          {total ? (
            <span className="bc-badge bc-badge-cnt">{done}/{total} tracks</span>
          ) : done > 0 ? (
            <span className="bc-badge bc-badge-cnt">{done} track{done !== 1 ? 's' : ''}</span>
          ) : null}
          {isStalled
            ? <span className="bc-badge bc-badge-st bc-badge-st--stalled">Vastgelopen</span>
            : <span className={`bc-badge bc-badge-st bc-badge-st--${st.cls}`}>{st.label}</span>
          }
          <span className="bc-badge bc-badge-fmt">{crade.format.toUpperCase()}</span>
        </div>
        {canRestart && (
          <button className="bc-restart-btn" onClick={e => { e.stopPropagation(); onRestart() }} title="Opnieuw starten">↺</button>
        )}
        <button className="bc-del-btn" onClick={e => { e.stopPropagation(); onDelete() }} title="Verwijderen">✕</button>
      </div>

      {open && (
        <div className="bc-crade-body">
          {crade.source_url && (
            <div className="bc-src-url">{crade.source_url}</div>
          )}
          {crade.subdir && (
            <div className="bc-subdir"><CradeIcon size={13} /> downloads/{crade.subdir}/</div>
          )}

          {isActive && total > 0 && (
            <div className="bc-prog">
              <div className="bc-prog-bar"><div className="bc-prog-fill" style={{ width: `${pct}%` }} /></div>
              <span className="bc-prog-lbl">{done} / {total} ({pct}%)</span>
            </div>
          )}

          {crade.progress_log && (
            <div className="bc-log">
              {!logExpanded ? (
                <div className="bc-log-hint" onClick={() => setLogExpanded(true)} title="Klik voor volledig log">
                  {lastLine(crade.progress_log)}
                </div>
              ) : (
                <pre className="bc-log-full" ref={logRef} onClick={() => setLogExpanded(false)}>
                  {crade.progress_log}
                </pre>
              )}
            </div>
          )}

          {crade.error && (
            <div className="bc-crade-err">{crade.error}</div>
          )}
        </div>
      )}
    </div>
  )
}
