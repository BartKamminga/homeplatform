import { useState, useEffect, useRef } from 'react'
import { getSettings, putSettings } from '../api.js'

// ── Standaardwaarden ─────────────────────────────────────────────────────────

const DEFAULTS = {
  filename_template: '{title} - {artist}',
  dir_template:      '{section}/{rack}/{crade}',
}

// ── Voorbeelddata ─────────────────────────────────────────────────────────────

const SAMPLES = [
  { title: 'Piece of Your Heart', artist: 'Meduza', artists: 'Meduza feat. Goodboys', release: 'Piece of Your Heart', genre: 'House', year: '2019', track_number: '01', bpm: '124', key: 'Gm', label: 'Virgin EMI', section: 'Mijn Sets', rack: 'House', crade: 'Summer 2025 Chart' },
  { title: 'Break My Soul',        artist: 'Beyonce',  artists: 'Beyonce',                 release: 'Renaissance',          genre: 'House', year: '2022', track_number: '02', bpm: '126', key: 'Fm', label: 'Parkwood',   section: 'Mijn Sets', rack: 'House', crade: 'Summer 2025 Chart' },
  { title: 'Insomnia',             artist: 'Faithless', artists: 'Faithless',              release: 'Reverence',            genre: 'House', year: '1995', track_number: '03', bpm: '133', key: 'Em', label: 'Cheeky Records', section: 'Mijn Sets', rack: 'House', crade: 'Summer 2025 Chart' },
  { title: 'Blue Monday',          artist: 'New Order', artists: 'New Order',              release: 'Power Corruption and Lies', genre: 'Synth-pop', year: '1983', track_number: '01', bpm: '136', key: 'Dm', label: 'Factory Records', section: 'Klassiekers', rack: 'Synth-pop', crade: 'New Order Best Of' },
  { title: 'Around The World',     artist: 'Daft Punk', artists: 'Daft Punk',             release: 'Homework',             genre: 'Electronic', year: '1997', track_number: '04', bpm: '121', key: 'Am', label: 'Virgin Records', section: 'Klassiekers', rack: 'Electronic', crade: 'Daft Punk Essentials' },
]

const CRADE_TRACKS = {
  0: [
    SAMPLES[0],
    { ...SAMPLES[1], track_number: '02' },
    { ...SAMPLES[2], track_number: '03' },
    { title: 'Promises', artist: 'Calvin Harris', artists: 'Calvin Harris feat. Sam Smith', release: 'Funk Wav Bounces Vol. 2', genre: 'House', year: '2022', track_number: '04', bpm: '121', key: 'Bb', label: 'Columbia', section: 'Mijn Sets', rack: 'House', crade: 'Summer 2025 Chart' },
  ],
  1: [SAMPLES[0], SAMPLES[1], SAMPLES[2]],
  2: [SAMPLES[0], SAMPLES[1], SAMPLES[2]],
  3: [SAMPLES[3], { ...SAMPLES[3], title: 'True Faith', track_number: '02', year: '1987' }],
  4: [SAMPLES[4], { ...SAMPLES[4], title: 'Harder Better Faster Stronger', track_number: '02', year: '2001' }],
}

// ── Token-definitie ───────────────────────────────────────────────────────────

const TRACK_TOKENS = ['title','artist','artists','release','genre','year','track_number','bpm','key','label']
const DIR_TOKENS   = ['section','rack','crade']

function applyTpl(tpl, data) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (data[k] !== undefined ? data[k] : `{${k}}`))
}

function safeSeg(s) {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}

function renderDir(tpl, data) {
  return tpl.split('/').map(seg => {
    const resolved = safeSeg(applyTpl(seg, data))
    return resolved
  }).filter(Boolean)
}

function renderFile(tpl, data) {
  return safeSeg(applyTpl(tpl, data))
}

function hasUnresolved(s) {
  return /\{\w+\}/.test(s)
}

// ── Hoofd-component ───────────────────────────────────────────────────────────

export function SettingsModal({ onClose, onSaved }) {
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [fnTpl,        setFnTpl]        = useState(DEFAULTS.filename_template)
  const [dirTpl,       setDirTpl]       = useState(DEFAULTS.dir_template)
  const [maxConcurrent,setMaxConcurrent]= useState(2)
  const [sampleIdx,    setSample]       = useState(0)
  const [saved,        setSaved]        = useState(false)

  const fnRef  = useRef(null)
  const dirRef = useRef(null)

  useEffect(() => {
    getSettings()
      .then(s => {
        if (s.filename_template) setFnTpl(s.filename_template)
        if (s.dir_template)      setDirTpl(s.dir_template)
        if (s.max_concurrent)    setMaxConcurrent(Math.max(1, Math.min(10, parseInt(s.max_concurrent, 10) || 2)))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const sample = SAMPLES[sampleIdx]
  const tracks = CRADE_TRACKS[sampleIdx] || [sample]

  const fnResult  = renderFile(fnTpl, sample)
  const dirResult = renderDir(dirTpl, sample)

  // Token chip klik → invoegen op cursorpositie
  const insertToken = (token, inputRef, setter) => {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const next  = el.value.slice(0, start) + `{${token}}` + el.value.slice(end)
    setter(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length + 2
      el.setSelectionRange(pos, pos)
    })
  }

  // Drag-and-drop token → input
  const onDragStart = (e, token) => {
    e.dataTransfer.setData('text/plain', `{${token}}`)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const makeDropHandlers = (inputRef, setter) => ({
    onDragOver:  e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; inputRef.current?.classList.add('bc-tpl-drop') },
    onDragLeave: e => { inputRef.current?.classList.remove('bc-tpl-drop') },
    onDrop: e => {
      e.preventDefault()
      inputRef.current?.classList.remove('bc-tpl-drop')
      const token = e.dataTransfer.getData('text/plain')
      if (!token) return
      const el = inputRef.current
      const start = el ? el.selectionStart : 0
      const end   = el ? el.selectionEnd   : 0
      const cur   = el ? el.value          : ''
      const next  = cur.slice(0, start) + token + cur.slice(end)
      setter(next)
      requestAnimationFrame(() => {
        el?.focus()
        const pos = start + token.length
        el?.setSelectionRange(pos, pos)
      })
    },
  })

  const fnDrop  = makeDropHandlers(fnRef,  setFnTpl)
  const dirDrop = makeDropHandlers(dirRef, setDirTpl)

  const save = async () => {
    setSaving(true)
    try {
      await putSettings({ filename_template: fnTpl, dir_template: dirTpl, max_concurrent: String(maxConcurrent) })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved?.()
    } catch (e) {
      console.error('Opslaan mislukt:', e)
    }
    setSaving(false)
  }

  const resetFn  = () => setFnTpl(DEFAULTS.filename_template)
  const resetDir = () => setDirTpl(DEFAULTS.dir_template)

  return (
    <div className="bc-dlg-overlay" onClick={onClose}>
      <div className="bc-settings-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="bc-sync-hdr">
          <div>
            <div className="bc-sync-hdr-eyebrow">BeatCrades · Instellingen</div>
            <div className="bc-sync-hdr-title">Naamformaat bestandsnamen &amp; mappen</div>
          </div>
          <button className="bc-del-btn" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="bc-sync-empty">Laden…</div>
        ) : (
          <div className="bc-settings-body">

            {/* ── Links: formulieren ── */}
            <div className="bc-settings-left">

              {/* Bestandsnaam */}
              <div className="bc-settings-card">
                <div className="bc-settings-card-hdr">
                  <span className="bc-settings-card-ico">🎵</span>
                  <span className="bc-settings-card-title">Bestandsnaam</span>
                  <button className="bc-settings-reset" onClick={resetFn} title="Standaard herstellen">↺</button>
                </div>
                <div className="bc-settings-card-body">
                  <div className="bc-tpl-row" {...fnDrop}>
                    <input
                      ref={fnRef}
                      className="bc-tpl-input"
                      value={fnTpl}
                      onChange={e => setFnTpl(e.target.value)}
                      spellCheck={false}
                    />
                    <span className="bc-tpl-ext">.flac</span>
                  </div>
                  <div className={`bc-tpl-preview${hasUnresolved(fnResult) ? ' warn' : ''}`}>
                    {fnResult || '…'}<span className="bc-tpl-preview-ext">.flac</span>
                  </div>
                  <div className="bc-settings-tokens-label">Track-velden — klik of sleep naar het veld</div>
                  <div className="bc-settings-chips">
                    {TRACK_TOKENS.map(t => (
                      <span
                        key={t}
                        className="bc-settings-chip bc-settings-chip--track"
                        draggable
                        onDragStart={e => onDragStart(e, t)}
                        onClick={() => insertToken(t, fnRef, setFnTpl)}
                        title={`Sleep of klik om {${t}} in te voegen`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mapstructuur */}
              <div className="bc-settings-card">
                <div className="bc-settings-card-hdr">
                  <span className="bc-settings-card-ico">📁</span>
                  <span className="bc-settings-card-title">Mapstructuur</span>
                  <button className="bc-settings-reset" onClick={resetDir} title="Standaard herstellen">↺</button>
                </div>
                <div className="bc-settings-card-body">
                  <div className="bc-tpl-row" {...dirDrop}>
                    <input
                      ref={dirRef}
                      className="bc-tpl-input"
                      value={dirTpl}
                      onChange={e => setDirTpl(e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                  <div className={`bc-tpl-preview${!dirResult.length ? ' warn' : ''}`}>
                    {dirResult.join(' / ') || '(geen mappen)'}
                  </div>
                  <div className="bc-settings-tokens-label">Structuur-velden</div>
                  <div className="bc-settings-chips">
                    {DIR_TOKENS.map(t => (
                      <span
                        key={t}
                        className="bc-settings-chip bc-settings-chip--dir"
                        draggable
                        onDragStart={e => onDragStart(e, t)}
                        onClick={() => insertToken(t, dirRef, setDirTpl)}
                        title={`Sleep of klik om {${t}} in te voegen`}
                      >
                        {t}
                      </span>
                    ))}
                    {TRACK_TOKENS.filter(t => ['genre','artist','year','label'].includes(t)).map(t => (
                      <span
                        key={t}
                        className="bc-settings-chip bc-settings-chip--track"
                        draggable
                        onDragStart={e => onDragStart(e, t)}
                        onClick={() => insertToken(t, dirRef, setDirTpl)}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="bc-settings-info">
                    Gebruik <strong>/</strong> als mapscheiding. Segmenten die leeg zijn worden weggelaten.
                  </div>
                </div>
              </div>

              {/* Download concurrency */}
              <div className="bc-settings-card">
                <div className="bc-settings-card-hdr">
                  <span className="bc-settings-card-ico">⚡</span>
                  <span className="bc-settings-card-title">Gelijktijdige downloads</span>
                </div>
                <div className="bc-settings-card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="range" min={1} max={10} value={maxConcurrent}
                      onChange={e => setMaxConcurrent(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600, fontSize: '1rem' }}>
                      {maxConcurrent}
                    </span>
                  </div>
                  <div className="bc-settings-info">
                    Maximaal aantal downloads tegelijk (1–10). Hoog getal kan de NAS belasten.
                    Wordt actief na herstart van de backend.
                  </div>
                </div>
              </div>

              {/* Voorbeeldtrack selector */}
              <div className="bc-settings-card">
                <div className="bc-settings-card-hdr">
                  <span className="bc-settings-card-ico">🔍</span>
                  <span className="bc-settings-card-title">Voorbeeldtrack</span>
                </div>
                <div className="bc-settings-card-body">
                  <select
                    className="bc-inp bc-settings-select"
                    value={sampleIdx}
                    onChange={e => setSample(Number(e.target.value))}
                  >
                    {SAMPLES.map((s, i) => (
                      <option key={i} value={i}>{s.title} — {s.artist} ({s.genre}, {s.year})</option>
                    ))}
                  </select>
                </div>
              </div>

            </div>

            {/* ── Rechts: live preview ── */}
            <div className="bc-settings-right">
              <div className="bc-settings-preview-label">Live preview</div>

              {/* Volledig pad */}
              <div className="bc-settings-fullpath">
                <span className="bc-settings-fp-root">downloads/</span>
                {dirResult.map((seg, i) => (
                  <span key={i}>
                    <span className="bc-settings-fp-dir">{seg}</span>
                    <span className="bc-settings-fp-sep">/</span>
                  </span>
                ))}
                <span className="bc-settings-fp-file">{fnResult || '…'}<span className="bc-settings-fp-ext">.flac</span></span>
              </div>

              {/* Folder tree */}
              <div className="bc-settings-tree">
                <TreeNode ico="📂" name="downloads/" depth={0} isLast={false} />
                {dirResult.map((seg, i) => (
                  <TreeNode key={i} ico="📁" name={seg + '/'} depth={i + 1} isLast={i === dirResult.length - 1 && tracks.length === 0} cls="dir" />
                ))}
                {tracks.map((t, i) => {
                  const fname = renderFile(fnTpl, t)
                  const isFocus = t.title === sample.title
                  return (
                    <TreeNode
                      key={i}
                      ico="🎵"
                      name={fname}
                      ext=".flac"
                      depth={dirResult.length + 1}
                      isLast={i === tracks.length - 1}
                      cls={isFocus ? 'file focus' : 'file'}
                    />
                  )
                })}
              </div>

              {/* Track lijst */}
              <div className="bc-settings-tracklist-label">Alle tracks in deze crade</div>
              <div className="bc-settings-tracklist">
                {tracks.map((t, i) => {
                  const fname = renderFile(fnTpl, t)
                  return (
                    <div key={i} className="bc-settings-trackrow">
                      <span className="bc-settings-tracknum">{String(i + 1).padStart(2, '0')}</span>
                      <span className="bc-settings-trackname">{fname}<span className="bc-tpl-preview-ext">.flac</span></span>
                      <span className="bc-settings-trackfmt">FLAC</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        {!loading && (
          <div className="bc-sync-footer">
            <span className={`bc-settings-saved${saved ? ' visible' : ''}`}>✓ Opgeslagen</span>
            <button className="bc-btn bc-btn-sec" onClick={onClose}>Sluiten</button>
            <button className="bc-btn bc-btn-pri" onClick={save} disabled={saving}>
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Folder-tree hulpcomponent ─────────────────────────────────────────────────

function TreeNode({ ico, name, ext, depth, isLast, cls }) {
  return (
    <div className="bc-stree-node">
      {Array.from({ length: depth }).map((_, i) => (
        <div key={i} className={`bc-stree-indent${i === depth - 1 && isLast ? ' last' : ''}`}>
          {i === depth - 1 && <div className="bc-stree-connector" />}
        </div>
      ))}
      <div className={`bc-stree-item${cls ? ` bc-stree-item--${cls}` : ''}`}>
        <span className="bc-stree-ico">{ico}</span>
        <span className="bc-stree-name">{name}{ext && <span className="bc-tpl-preview-ext">{ext}</span>}</span>
      </div>
    </div>
  )
}
