import { useState, useEffect, useRef } from 'react'
import { getTree, createSection, updateSection, deleteSection, createRack, updateRack, deleteRack, createCrade, updateCrade, deleteCrade, restartCrade, cancelCrade, syncPreview, syncExecute } from './api.js'
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
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      {/* dak */}
      <path d="M2.5 9.5 L10 2.5 L17.5 9.5"/>
      {/* muren */}
      <path d="M4.5 8.5 L4.5 17.5 L15.5 17.5 L15.5 8.5"/>
      {/* deur */}
      <path d="M8 17.5 L8 13 Q10 11.8 12 13 L12 17.5" strokeWidth="1.2"/>
      {/* raam */}
      <rect x="5.5" y="10" width="2.5" height="2.5" rx="0.4" strokeWidth="1"/>
      {/* schoorsteen */}
      <rect x="12.5" y="3.5" width="2" height="3" rx="0.3" strokeWidth="1.1"/>
    </svg>
  )
}

function RackIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      {/* kastframe */}
      <rect x="2" y="1.5" width="16" height="17" rx="1.2"/>
      {/* rackrails */}
      <line x1="4.5" y1="1.5" x2="4.5" y2="18.5" strokeWidth="1"/>
      <line x1="15.5" y1="1.5" x2="15.5" y2="18.5" strokeWidth="1"/>
      {/* rack-units */}
      <rect x="5" y="3.5" width="10" height="3" rx="0.6" strokeWidth="1.1"/>
      <rect x="5" y="8" width="10" height="3" rx="0.6" strokeWidth="1.1"/>
      <rect x="5" y="12.5" width="10" height="3" rx="0.6" strokeWidth="1.1"/>
      {/* schroefgaatjes */}
      <circle cx="3.7" cy="5"    r="0.5" fill="currentColor" stroke="none"/>
      <circle cx="3.7" cy="9.5"  r="0.5" fill="currentColor" stroke="none"/>
      <circle cx="3.7" cy="14"   r="0.5" fill="currentColor" stroke="none"/>
      <circle cx="16.3" cy="5"   r="0.5" fill="currentColor" stroke="none"/>
      <circle cx="16.3" cy="9.5" r="0.5" fill="currentColor" stroke="none"/>
      <circle cx="16.3" cy="14"  r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function CradeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      {/* krat buitenrand */}
      <rect x="1.5" y="5" width="17" height="13" rx="1.2"/>
      {/* verticale latten */}
      <line x1="7"  y1="5" x2="7"  y2="18"/>
      <line x1="13" y1="5" x2="13" y2="18"/>
      {/* horizontale lat */}
      <line x1="1.5" y1="11" x2="18.5" y2="11"/>
      {/* handvat */}
      <path d="M7.5 5 L7.5 3 Q10 1.5 12.5 3 L12.5 5" strokeWidth="1.3"/>
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

const _BP_TYPES = new Set(['playlist','playlists','release','releases','track','tracks','artist','artists','chart','charts','label','labels','mix','mixes'])

function slugFromBeatportUrl(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    // Zoek het content-type segment (bijv. 'playlists') en pak de slug erna.
    // Beatport URLs kunnen een taalprefix hebben: /en/playlists/<slug>/<id>
    const typeIdx = parts.findIndex(p => _BP_TYPES.has(p.toLowerCase()))
    if (typeIdx !== -1 && typeIdx + 1 < parts.length) {
      const slug = parts[typeIdx + 1]
      if (!/^\d+$/.test(slug))
        return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }
  } catch {}
  return null
}

function parseProgress(log) {
  if (!log) return { done: 0, total: null }
  let done = 0, total = null
  for (const line of log.split('\n')) {
    let m = line.match(/Downloading item (\d+) of (\d+)/i)
           || line.match(/Downloading track (\d+)[/ ](\d+)/i)
           || line.match(/\[(\d+)\/(\d+)\]/)
           || line.match(/item\s+(\d+)\s+of\s+(\d+)/i)
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

// ── PlaceholderRow ─────────────────────────────────────────────────────────────

const PH_CFG = {
  section: { ph: 'Naam nieuwe Section…',                        btn: 'Aanmaken' },
  rack:    { ph: 'Naam nieuw Rack…',                            btn: 'Aanmaken' },
  crade:   { ph: 'URL — Beatport, YouTube of SoundCloud…',      btn: '↓ Starten' },
}

function PlaceholderRow({ type, onSubmit }) {
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)
  const cfg = PH_CFG[type]

  const handleSubmit = async () => {
    if (!val.trim() || busy) return
    setBusy(true)
    try { await onSubmit(val.trim()); setVal('') }
    finally { setBusy(false) }
  }

  return (
    <div className={`bc-ph bc-ph--${type}`}>
      <div className="bc-ph-ico">
        {type === 'section' && <SectionIcon size={18}/>}
        {type === 'rack'    && <RackIcon size={16}/>}
        {type === 'crade'   && <CradeIcon size={15}/>}
      </div>
      <input
        className="bc-ph-input"
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={cfg.ph}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
      />
      <button className="bc-ph-btn" disabled={!val.trim() || busy} onClick={handleSubmit}>
        {busy ? '…' : cfg.btn}
      </button>
    </div>
  )
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
  const [syncOpen,     setSyncOpen]     = useState(false)
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
  const addSection = async () => {
    const name = await openPrompt('Naam van de nieuwe Section:')
    if (!name?.trim()) return
    await createSection({ name: name.trim() }); await load()
  }
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

  // ── Rack drag-drop ──
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

  // ── Open state ──
  const isSectionOpen = id => id in openSections ? openSections[id] : true
  const isRackOpen    = id => id in openRacks    ? openRacks[id]    : true
  const toggleSection = id => setOpenSections(s => ({ ...s, [id]: !(id in s ? s[id] : true) }))
  const toggleRack    = id => setOpenRacks(r    => ({ ...r, [id]: !(id in r ? r[id] : true) }))
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

        {/* Free racks (no section) */}
        {tree.racks.map(rack => (
          <RackBlock key={rack.id} rack={rack} {...rackCallbacks} />
        ))}

        {/* Free crades (no rack) */}
        {tree.crades.map(crade => (
          <CradeRow key={crade.id} crade={crade}
            open={isCradeOpen(openCrades, crade.id)}
            onToggle={() => toggleCrade(crade.id)}
            onRename={() => renameCrade(crade.id, crade.name)}
            onDelete={() => removeCrade(crade.id)}
            onRestart={() => onRestartCrade(crade.id)}
            onCancel={() => onCancelCrade(crade.id)}
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

        {/* Section placeholder — altijd onderaan */}
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

// ── RackBlock ────────────────────────────────────────────────────────────────

function RackBlock({ rack,
  openRacks, openCrades, toggleRack, toggleCrade,
  draggingCrade, draggingRack, dragOver, setDragOver,
  onCradeDragStart, onCradeDragEnd,
  onRackDragOver, onRackDrop,
  onRackDragStart, onRackDragEnd,
  renameRack, removeRack, removeCrade, onRestartCrade, onCancelCrade,
  renameCrade, addCradeInRack,
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
              onRename={() => renameCrade(crade.id, crade.name)}
              onDelete={() => removeCrade(crade.id)}
              onRestart={() => onRestartCrade(crade.id)}
              onCancel={() => onCancelCrade(crade.id)}
              inRack
              dragging={draggingCrade === crade.id}
              onDragStart={e => onCradeDragStart(e, crade.id)}
              onDragEnd={onCradeDragEnd} />
          ))}
          <PlaceholderRow type="crade" onSubmit={url => addCradeInRack(rack.id, url)} />
        </div>
      )}
    </div>
  )
}

function isCradeOpen(openCrades, id) { return !!openCrades[id] }

// ── CradeRow ──────────────────────────────────────────────────────────────────

const STALL_MS = 20 * 60 * 1000

function CradeRow({ crade, open, onToggle, onRename, onDelete, onRestart, onCancel, inRack, dragging, onDragStart, onDragEnd }) {
  const [logExpanded, setLogExpanded] = useState(false)
  const logRef = useRef(null)

  const st  = ST[crade.status] || ST.no_job
  const src = detectSrc(crade.source_url)
  const { done, total } = parseProgress(crade.progress_log)
  const pct = total ? Math.round(done / total * 100) : 0
  const isActive = crade.status === 'downloading' || crade.status === 'queued'

  const isStalled = crade.status === 'downloading' && crade.last_progress_at &&
    (Date.now() - new Date(crade.last_progress_at).getTime()) > STALL_MS

  const canCancel  = crade.status === 'downloading'
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
        <span className="bc-crade-icon"><CradeIcon size={16} /></span>
        <div className="bc-crade-name-wrap">
          <span className="bc-crade-name"
            onClick={e => { e.stopPropagation(); onRename() }}
            title="Klik om te hernoemen">
            {crade.name}
          </span>
          {crade.status === 'downloading' && crade.progress_log && (
            <span className="bc-crade-progress-line">{lastLine(crade.progress_log)}</span>
          )}
        </div>
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
        {canCancel && (
          <button className="bc-stop-btn" onClick={e => { e.stopPropagation(); onCancel() }} title="Download stoppen">⏹</button>
        )}
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
          {src === 'beatport' && crade.output_path && (
            <div className="bc-detected-name">📁 {crade.output_path}</div>
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

// ── SyncModal ────────────────────────────────────────────────────────────────

const SYNC_TYPE_META = {
  create_dir:     { label: 'Aanmaken op disk',      icon: '📁', cls: 'add' },
  reorganize_dir: { label: 'Structuur aanpassen',   icon: '🗂️', cls: 'upd' },
  clear_output:   { label: 'DB bijwerken',           icon: '🔗', cls: 'upd' },
  mark_missing:   { label: 'Ontbrekend markeren',   icon: '⚠️', cls: 'del' },
  add_from_disk:  { label: 'Nieuw vanuit disk',     icon: '📥', cls: 'new' },
}

function SyncModal({ onClose, onDone }) {
  const [loading,   setLoading]   = useState(true)
  const [actions,   setActions]   = useState([])
  const [dlRoot,    setDlRoot]    = useState('')
  const [selected,  setSelected]  = useState({})
  const [executing, setExecuting] = useState(false)
  const [results,   setResults]   = useState(null)

  useEffect(() => {
    syncPreview()
      .then(data => {
        setActions(data.actions)
        setDlRoot(data.download_root)
        const sel = {}
        data.actions.forEach(a => { sel[a.id] = a.selected })
        setSelected(sel)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle = id => setSelected(s => ({ ...s, [id]: !s[id] }))

  const toggleGroup = type => {
    const ofType = actions.filter(a => a.type === type)
    const allOn  = ofType.every(a => selected[a.id])
    setSelected(s => {
      const n = { ...s }
      ofType.forEach(a => { n[a.id] = !allOn })
      return n
    })
  }

  const execute = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
    if (!ids.length) return
    setExecuting(true)
    try {
      const res = await syncExecute(ids)
      setResults(res.results)
      onDone?.()
    } catch (e) {
      setResults([{ id: '_err', ok: false, message: e.message || 'Onbekende fout' }])
    }
    setExecuting(false)
  }

  const selCount = Object.values(selected).filter(Boolean).length
  const groups   = Object.entries(SYNC_TYPE_META)
    .map(([type, meta]) => ({ type, meta, items: actions.filter(a => a.type === type) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="bc-dlg-overlay" onClick={onClose}>
      <div className="bc-sync-modal" onClick={e => e.stopPropagation()}>

        <div className="bc-sync-hdr">
          <div>
            <div className="bc-sync-hdr-eyebrow">BeatCrades · Disk-Sync</div>
            <div className="bc-sync-hdr-title">Vergelijking database ↔ schijf</div>
          </div>
          <button className="bc-del-btn" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="bc-sync-empty">Scannen…</div>

        ) : results ? (
          <>
            <div className="bc-sync-body">
              {results.map(r => (
                <div key={r.id} className={`bc-sync-result-card${r.ok ? ' ok' : ' fail'}`}>
                  <span className="bc-sync-result-icon">{r.ok ? '✓' : '✕'}</span>
                  <span>{r.message}</span>
                </div>
              ))}
            </div>
            <div className="bc-sync-footer">
              <span />
              <button className="bc-btn bc-btn-pri" onClick={onClose}>Sluiten</button>
            </div>
          </>

        ) : groups.length === 0 ? (
          <>
            <div className="bc-sync-empty">✓ Alles is al gesynchroniseerd.</div>
            <div className="bc-sync-footer">
              <span />
              <button className="bc-btn bc-btn-sec" onClick={onClose}>Sluiten</button>
            </div>
          </>

        ) : (
          <>
            <div className="bc-sync-meta">
              <span className="bc-sync-meta-chip">🗂 {dlRoot}</span>
              <span className="bc-sync-meta-chip">📦 {actions.length} item{actions.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="bc-sync-legend">
              {Object.entries(SYNC_TYPE_META).map(([type, m]) => (
                <span key={type} className={`bc-sync-leg bc-sync-leg--${m.cls}`}>
                  <span className="bc-sync-leg-dot" />
                  {m.label}
                </span>
              ))}
            </div>

            <div className="bc-sync-body">
              {groups.map(({ type, meta, items }) => (
                <div key={type} className="bc-sync-action-group">
                  <div className="bc-sync-group-sep" onClick={() => toggleGroup(type)}>
                    <span className={`bc-sync-sep-label bc-sync-sep--${meta.cls}`}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="bc-sync-sep-count">
                      {items.filter(a => selected[a.id]).length}/{items.length} geselecteerd
                    </span>
                  </div>
                  <div className="bc-sync-cards">
                    {items.map(a => (
                      <label key={a.id} className={`bc-sync-card bc-sync-card--${meta.cls}${selected[a.id] ? ' checked' : ''}`}>
                        <input
                          type="checkbox"
                          className="bc-sync-cb"
                          checked={!!selected[a.id]}
                          onChange={() => toggle(a.id)}
                        />
                        <span className={`bc-sync-card-icon bc-sync-card-icon--${meta.cls}`}>{meta.icon}</span>
                        <div className="bc-sync-card-body">
                          <span className="bc-sync-card-name">{a.crade_name}</span>
                          <span className="bc-sync-card-desc">{a.description}</span>
                          <code className="bc-sync-card-path">{a.rel_path}</code>
                        </div>
                        <span className={`bc-sync-badge bc-sync-badge--${meta.cls}`}>{meta.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bc-sync-footer">
              <span className="bc-sync-sel">{selCount} actie{selCount !== 1 ? 's' : ''} geselecteerd</span>
              <button className="bc-btn bc-btn-sec" onClick={onClose}>Annuleren</button>
              <button className="bc-btn bc-btn-pri" disabled={!selCount || executing} onClick={execute}>
                {executing ? 'Bezig…' : 'Sync uitvoeren'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
