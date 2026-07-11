import { useState, useEffect, useRef } from 'react'
import { getTree, createGroup, updateGroup, deleteGroup, createCrade, updateCrade, deleteCrade } from './api.js'
import './App.css'

const FORMATS = ['flac', 'mp3', 'wav']

const SRC_ICON = { beatport: '🎵', youtube: '▶️', soundcloud: '☁️', auto: '🌐' }

const ST = {
  no_job:      { icon: '📁', label: 'Leeg',    cls: 'empty' },
  queued:      { icon: '🕐', label: 'Wacht',   cls: 'queued' },
  downloading: { icon: '⏳', label: 'Bezig',   cls: 'active' },
  done:        { icon: '✅', label: 'Klaar',   cls: 'done' },
  error:       { icon: '❌', label: 'Fout',    cls: 'error' },
}

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

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [tree,       setTree]       = useState({ groups: [], crades: [] })
  const [newOpen,    setNewOpen]    = useState(false)
  const [newName,    setNewName]    = useState('')
  const [newUrl,     setNewUrl]     = useState('')
  const [newFmt,     setNewFmt]     = useState(() => localStorage.getItem('bc_fmt') || 'flac')
  const [newGroup,   setNewGroup]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err,        setErr]        = useState('')
  const [openGroups, setOpenGroups] = useState({})
  const [openCrades, setOpenCrades] = useState({})
  const [dragging,   setDragging]   = useState(null)
  const [dragOver,   setDragOver]   = useState(null)
  const timerRef = useRef(null)
  const urlRef   = useRef(null)

  const load = () => getTree().then(setTree).catch(() => {})

  useEffect(() => { load() }, [])

  useEffect(() => {
    clearInterval(timerRef.current)
    const isActive = tree.crades.some(c => c.status === 'downloading' || c.status === 'queued')
    if (isActive) {
      const ms = tree.crades.some(c => c.status === 'downloading') ? 2000 : 4000
      timerRef.current = setInterval(load, ms)
    }
    return () => clearInterval(timerRef.current)
  }, [tree])

  const pickFmt = (f) => { setNewFmt(f); localStorage.setItem('bc_fmt', f) }

  const openNew = () => {
    setNewName(todayName()); setNewUrl(''); setNewGroup(''); setErr(''); setNewOpen(true)
    setTimeout(() => urlRef.current?.focus(), 60)
  }

  const submitCrade = async (e) => {
    e.preventDefault()
    if (!newUrl.trim()) return
    setSubmitting(true); setErr('')
    try {
      await createCrade({ name: newName || todayName(), source_url: newUrl.trim(), format: newFmt, group_id: newGroup || null })
      setNewOpen(false)
      await load()
    } catch (ex) {
      setErr(ex.message || 'Aanmaken mislukt')
    } finally {
      setSubmitting(false)
    }
  }

  const addGroup = async () => {
    const name = prompt('Naam van de nieuwe groep:')
    if (!name?.trim()) return
    await createGroup({ name: name.trim() })
    await load()
  }

  const renameGroup = async (id, cur) => {
    const name = prompt('Nieuwe naam:', cur)
    if (!name?.trim() || name === cur) return
    await updateGroup(id, { name: name.trim() })
    await load()
  }

  const removeGroup = async (id) => {
    if (!confirm('Groep verwijderen? Crades worden losgemaakt van de groep.')) return
    await deleteGroup(id)
    await load()
  }

  const removeCrade = async (id) => {
    if (!confirm('Crade verwijderen inclusief alle downloads?')) return
    await deleteCrade(id)
    setTree(t => ({ ...t, crades: t.crades.filter(c => c.id !== id) }))
  }

  // Drag & drop
  const onDragStart = (e, id) => { setDragging(id); e.dataTransfer.effectAllowed = 'move' }
  const onDragEnd   = ()       => { setDragging(null); setDragOver(null) }

  const onGroupDragOver = (e, gid) => { if (!dragging) return; e.preventDefault(); setDragOver(gid) }
  const onGroupDrop     = async (e, gid) => {
    e.preventDefault()
    if (dragging) { await updateCrade(dragging, { group_id: gid }); await load() }
    setDragging(null); setDragOver(null)
  }
  const onRootDragOver = (e) => { if (!dragging) return; e.preventDefault(); setDragOver('root') }
  const onRootDrop     = async (e) => {
    e.preventDefault()
    if (dragging) { await updateCrade(dragging, { group_id: null }); await load() }
    setDragging(null); setDragOver(null)
  }

  const isGroupOpen = (id) => id in openGroups ? openGroups[id] : true
  const isCradeOpen = (id) => !!openCrades[id]
  const toggleGroup = (id) => setOpenGroups(g => ({ ...g, [id]: !isGroupOpen(id) }))
  const toggleCrade = (id) => setOpenCrades(g => ({ ...g, [id]: !isCradeOpen(id) }))

  const inGroup  = (gid) => tree.crades.filter(c => c.group_id === gid)
  const ungrouped = tree.crades.filter(c => !c.group_id)
  const isEmpty  = tree.groups.length === 0 && ungrouped.length === 0

  return (
    <div className="bc-wrap">
      <header className="bc-hdr">
        <div>
          <h1 className="bc-title">🎵 BeatCrades</h1>
          <p className="bc-subtitle">Download crates — Beatport · YouTube · SoundCloud</p>
        </div>
        <div className="bc-hdr-btns">
          <button className="bc-btn bc-btn-sec" onClick={addGroup}>＋ Groep</button>
          <button className="bc-btn bc-btn-pri" onClick={openNew}>＋ Crade</button>
        </div>
      </header>

      <div className="bc-main">
        {/* Nieuwe crade form */}
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
                <label>Groep</label>
                <select className="bc-inp" value={newGroup} onChange={e => setNewGroup(e.target.value)}>
                  <option value="">— geen groep —</option>
                  {tree.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
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

        {/* Groepen */}
        {tree.groups.map(g => (
          <div key={g.id}
            className={`bc-group${isGroupOpen(g.id)?' open':''}${dragOver===g.id?' dz-over':''}`}
            onDragOver={e => onGroupDragOver(e, g.id)}
            onDrop={e => onGroupDrop(e, g.id)}
            onDragLeave={() => setDragOver(null)}>

            <div className="bc-group-head">
              <span className="bc-chev" onClick={() => toggleGroup(g.id)}>{isGroupOpen(g.id)?'▾':'▸'}</span>
              <span className="bc-group-icon">🗂️</span>
              <span className="bc-group-name" onClick={() => renameGroup(g.id, g.name)} title="Klik om te hernoemen">
                {g.name}
              </span>
              <span className="bc-group-count">{inGroup(g.id).length} crades</span>
              <button className="bc-del-btn" onClick={() => removeGroup(g.id)} title="Groep verwijderen">✕</button>
            </div>

            {isGroupOpen(g.id) && (
              <div className="bc-group-body">
                {inGroup(g.id).map(c => (
                  <CradeRow key={c.id} crade={c} open={isCradeOpen(c.id)}
                    onToggle={() => toggleCrade(c.id)}
                    onDelete={() => removeCrade(c.id)}
                    inGroup dragging={dragging===c.id}
                    onDragStart={e => onDragStart(e, c.id)}
                    onDragEnd={onDragEnd} />
                ))}
                {inGroup(g.id).length === 0 && (
                  <div className="bc-group-empty">Sleep een crade hierheen…</div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Ongegroepeerde crades */}
        {ungrouped.map(c => (
          <CradeRow key={c.id} crade={c} open={isCradeOpen(c.id)}
            onToggle={() => toggleCrade(c.id)}
            onDelete={() => removeCrade(c.id)}
            dragging={dragging===c.id}
            onDragStart={e => onDragStart(e, c.id)}
            onDragEnd={onDragEnd} />
        ))}

        {/* Ongroepeer-dropzone (alleen zichtbaar bij slepen) */}
        {dragging && (
          <div className={`bc-ungroup-zone${dragOver==='root'?' active':''}`}
            onDragOver={onRootDragOver}
            onDrop={onRootDrop}
            onDragLeave={() => setDragOver(null)}>
            ↩ Loslaten om crade uit groep te halen
          </div>
        )}

        {isEmpty && !newOpen && (
          <div className="bc-empty">
            <p>Nog geen crades. Klik <strong>＋ Crade</strong> om een download te starten.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── CradeRow ──────────────────────────────────────────────────────────────────

function CradeRow({ crade, open, onToggle, onDelete, inGroup, dragging, onDragStart, onDragEnd }) {
  const [logExpanded, setLogExpanded] = useState(false)
  const logRef = useRef(null)

  const st  = ST[crade.status] || ST.no_job
  const src = detectSrc(crade.source_url)
  const { done, total } = parseProgress(crade.progress_log)
  const pct = total ? Math.round(done / total * 100) : 0
  const isActive = crade.status === 'downloading' || crade.status === 'queued'

  useEffect(() => {
    if (logExpanded && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logExpanded, crade.progress_log])

  return (
    <div className={`bc-crade bc-crade--${st.cls}${open?' open':''}${inGroup?' in-group':''}${dragging?' dragging':''}`}
      draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>

      <div className="bc-crade-head" onClick={onToggle}>
        <span className="bc-drag" onClick={e => e.stopPropagation()} title="Slepen">⠿</span>
        <span className="bc-chev">{open?'▾':'▸'}</span>
        <span className="bc-crade-icon">{open?'📂':'📁'}</span>
        <span className="bc-crade-name">{crade.name}</span>
        <div className="bc-badges">
          <span className="bc-badge bc-badge-src">{SRC_ICON[src]}</span>
          {total ? (
            <span className="bc-badge bc-badge-cnt">{done}/{total} tracks</span>
          ) : done > 0 ? (
            <span className="bc-badge bc-badge-cnt">{done} track{done!==1?'s':''}</span>
          ) : null}
          <span className={`bc-badge bc-badge-st bc-badge-st--${st.cls}`}>{st.icon} {st.label}</span>
          <span className="bc-badge bc-badge-fmt">{crade.format.toUpperCase()}</span>
        </div>
        <button className="bc-del-btn" onClick={e => { e.stopPropagation(); onDelete() }} title="Verwijderen">✕</button>
      </div>

      {open && (
        <div className="bc-crade-body">
          {crade.source_url && (
            <div className="bc-src-url">{crade.source_url}</div>
          )}
          {crade.subdir && (
            <div className="bc-subdir">📁 downloads/{crade.subdir}/</div>
          )}

          {/* Progress bar */}
          {isActive && total > 0 && (
            <div className="bc-prog">
              <div className="bc-prog-bar"><div className="bc-prog-fill" style={{ width: `${pct}%` }} /></div>
              <span className="bc-prog-lbl">{done} / {total} ({pct}%)</span>
            </div>
          )}

          {/* Log */}
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

          {/* Error */}
          {crade.error && (
            <div className="bc-crade-err">{crade.error}</div>
          )}
        </div>
      )}
    </div>
  )
}
