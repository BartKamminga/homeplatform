import { useState, useEffect, useRef } from 'react'
import { getSettings, putSettings, syncPreview, syncExecute, getProvider, setProvider, getToolVersions } from '../api.js'
import { FORMATS, FMT_LABEL } from '../helpers.js'

// ── Tabs definitie ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'naamformaat', icon: '🎵', label: 'Naamformaat' },
  { id: 'download',    icon: '⚡', label: 'Download'    },
  { id: 'sync',        icon: '🔄', label: 'Sync'        },
  { id: 'provider',    icon: '⚙',  label: 'Provider'    },
]

// ── Hoofdcomponent ────────────────────────────────────────────────────────────

export function SettingsPanel({ onClose, onDone, initialTab = 'naamformaat' }) {
  const [tab, setTab] = useState(initialTab)

  return (
    <div className="bc-dlg-overlay" onClick={onClose}>
      <div className="bc-panel" onClick={e => e.stopPropagation()}>

        <div className="bc-panel-hdr">
          <div>
            <div className="bc-sync-hdr-eyebrow">BeatCrades · Instellingen</div>
            <div className="bc-sync-hdr-title">
              {TABS.find(t => t.id === tab)?.icon} {TABS.find(t => t.id === tab)?.label}
            </div>
          </div>
          <button className="bc-del-btn" onClick={onClose}>✕</button>
        </div>

        <div className="bc-panel-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`bc-panel-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="bc-panel-tab-ico">{t.icon}</span>
              <span className="bc-panel-tab-lbl">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="bc-panel-content">
          {tab === 'naamformaat' && <NaamformaatTab />}
          {tab === 'download'    && <DownloadTab />}
          {tab === 'sync'        && <SyncTab onDone={onDone} onClose={onClose} />}
          {tab === 'provider'    && <ProviderTab />}
        </div>

      </div>
    </div>
  )
}

// ── Tab: Naamformaat ──────────────────────────────────────────────────────────

const DEFAULTS = {
  filename_template: '{title} - {artist}',
  dir_template:      '{section}/{rack}/{crade}',
}

const SAMPLES = [
  { title: 'Piece of Your Heart', artist: 'Meduza',    artists: 'Meduza feat. Goodboys', release: 'Piece of Your Heart',        genre: 'House',       year: '2019', track_number: '01', bpm: '124', key: 'Gm', label: 'Virgin EMI',      section: 'Mijn Sets',   rack: 'House',      crade: 'Summer 2025 Chart' },
  { title: 'Break My Soul',       artist: 'Beyonce',   artists: 'Beyonce',                release: 'Renaissance',                genre: 'House',       year: '2022', track_number: '02', bpm: '126', key: 'Fm', label: 'Parkwood',         section: 'Mijn Sets',   rack: 'House',      crade: 'Summer 2025 Chart' },
  { title: 'Insomnia',            artist: 'Faithless', artists: 'Faithless',              release: 'Reverence',                  genre: 'House',       year: '1995', track_number: '03', bpm: '133', key: 'Em', label: 'Cheeky Records',   section: 'Mijn Sets',   rack: 'House',      crade: 'Summer 2025 Chart' },
  { title: 'Blue Monday',         artist: 'New Order', artists: 'New Order',              release: 'Power Corruption and Lies',  genre: 'Synth-pop',   year: '1983', track_number: '01', bpm: '136', key: 'Dm', label: 'Factory Records',  section: 'Klassiekers', rack: 'Synth-pop',  crade: 'New Order Best Of' },
  { title: 'Around The World',    artist: 'Daft Punk', artists: 'Daft Punk',              release: 'Homework',                   genre: 'Electronic',  year: '1997', track_number: '04', bpm: '121', key: 'Am', label: 'Virgin Records',   section: 'Klassiekers', rack: 'Electronic', crade: 'Daft Punk Essentials' },
]

const CRADE_TRACKS = {
  0: [SAMPLES[0], { ...SAMPLES[1], track_number: '02' }, { ...SAMPLES[2], track_number: '03' }, { title: 'Promises', artist: 'Calvin Harris', artists: 'Calvin Harris feat. Sam Smith', release: 'Funk Wav Vol. 2', genre: 'House', year: '2022', track_number: '04', bpm: '121', key: 'Bb', label: 'Columbia', section: 'Mijn Sets', rack: 'House', crade: 'Summer 2025 Chart' }],
  1: [SAMPLES[0], SAMPLES[1], SAMPLES[2]],
  2: [SAMPLES[0], SAMPLES[1], SAMPLES[2]],
  3: [SAMPLES[3], { ...SAMPLES[3], title: 'True Faith', track_number: '02', year: '1987' }],
  4: [SAMPLES[4], { ...SAMPLES[4], title: 'Harder Better Faster Stronger', track_number: '02', year: '2001' }],
}

const TRACK_TOKENS = ['title','artist','artists','release','genre','year','track_number','bpm','key','label']
const DIR_TOKENS   = ['section','rack','crade']

function applyTpl(tpl, data) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (data[k] !== undefined ? data[k] : `{${k}}`))
}
function safeSeg(s) {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}
function renderDir(tpl, data) {
  return tpl.split('/').map(seg => safeSeg(applyTpl(seg, data))).filter(Boolean)
}
function renderFile(tpl, data) {
  return safeSeg(applyTpl(tpl, data))
}
function hasUnresolved(s) {
  return /\{\w+\}/.test(s)
}

function NaamformaatTab() {
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [fnTpl,     setFnTpl]     = useState(DEFAULTS.filename_template)
  const [dirTpl,    setDirTpl]    = useState(DEFAULTS.dir_template)
  const [sampleIdx, setSample]    = useState(0)
  const [saved,     setSaved]     = useState(false)
  const fnRef  = useRef(null)
  const dirRef = useRef(null)

  useEffect(() => {
    getSettings()
      .then(s => {
        if (s.filename_template) setFnTpl(s.filename_template)
        if (s.dir_template)      setDirTpl(s.dir_template)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const sample = SAMPLES[sampleIdx]
  const tracks = CRADE_TRACKS[sampleIdx] || [sample]
  const fnResult  = renderFile(fnTpl, sample)
  const dirResult = renderDir(dirTpl, sample)

  const insertToken = (token, inputRef, setter) => {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart, end = el.selectionEnd
    const next = el.value.slice(0, start) + `{${token}}` + el.value.slice(end)
    setter(next)
    requestAnimationFrame(() => { el.focus(); const pos = start + token.length + 2; el.setSelectionRange(pos, pos) })
  }

  const onDragStart = (e, token) => { e.dataTransfer.setData('text/plain', `{${token}}`); e.dataTransfer.effectAllowed = 'copy' }

  const makeDropHandlers = (inputRef, setter) => ({
    onDragOver:  e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; inputRef.current?.classList.add('bc-tpl-drop') },
    onDragLeave: () => { inputRef.current?.classList.remove('bc-tpl-drop') },
    onDrop: e => {
      e.preventDefault()
      inputRef.current?.classList.remove('bc-tpl-drop')
      const token = e.dataTransfer.getData('text/plain')
      if (!token) return
      const el = inputRef.current
      const start = el ? el.selectionStart : 0, end = el ? el.selectionEnd : 0, cur = el ? el.value : ''
      setter(cur.slice(0, start) + token + cur.slice(end))
      requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length) })
    },
  })

  const fnDrop  = makeDropHandlers(fnRef,  setFnTpl)
  const dirDrop = makeDropHandlers(dirRef, setDirTpl)

  const save = async () => {
    setSaving(true)
    try {
      await putSettings({ filename_template: fnTpl, dir_template: dirTpl })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error('Opslaan mislukt:', e) }
    setSaving(false)
  }

  if (loading) return <div className="bc-sync-empty">Laden…</div>

  return (
    <div className="bc-panel-tab-body">
      <div className="bc-settings-body">
        <div className="bc-settings-left">

          <div className="bc-settings-card">
            <div className="bc-settings-card-hdr">
              <span className="bc-settings-card-ico">🎵</span>
              <span className="bc-settings-card-title">Bestandsnaam</span>
              <button className="bc-settings-reset" onClick={() => setFnTpl(DEFAULTS.filename_template)} title="Standaard herstellen">↺</button>
            </div>
            <div className="bc-settings-card-body">
              <div className="bc-tpl-row" {...fnDrop}>
                <input ref={fnRef} className="bc-tpl-input" value={fnTpl} onChange={e => setFnTpl(e.target.value)} spellCheck={false} />
                <span className="bc-tpl-ext">.flac</span>
              </div>
              <div className={`bc-tpl-preview${hasUnresolved(fnResult) ? ' warn' : ''}`}>
                {fnResult || '…'}<span className="bc-tpl-preview-ext">.flac</span>
              </div>
              <div className="bc-settings-tokens-label">Track-velden — klik of sleep naar het veld</div>
              <div className="bc-settings-chips">
                {TRACK_TOKENS.map(t => (
                  <span key={t} className="bc-settings-chip bc-settings-chip--track" draggable onDragStart={e => onDragStart(e, t)} onClick={() => insertToken(t, fnRef, setFnTpl)} title={`Sleep of klik om {${t}} in te voegen`}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="bc-settings-card">
            <div className="bc-settings-card-hdr">
              <span className="bc-settings-card-ico">📁</span>
              <span className="bc-settings-card-title">Mapstructuur</span>
              <button className="bc-settings-reset" onClick={() => setDirTpl(DEFAULTS.dir_template)} title="Standaard herstellen">↺</button>
            </div>
            <div className="bc-settings-card-body">
              <div className="bc-tpl-row" {...dirDrop}>
                <input ref={dirRef} className="bc-tpl-input" value={dirTpl} onChange={e => setDirTpl(e.target.value)} spellCheck={false} />
              </div>
              <div className={`bc-tpl-preview${!dirResult.length ? ' warn' : ''}`}>{dirResult.join(' / ') || '(geen mappen)'}</div>
              <div className="bc-settings-tokens-label">Structuur-velden</div>
              <div className="bc-settings-chips">
                {DIR_TOKENS.map(t => (
                  <span key={t} className="bc-settings-chip bc-settings-chip--dir" draggable onDragStart={e => onDragStart(e, t)} onClick={() => insertToken(t, dirRef, setDirTpl)}>{t}</span>
                ))}
                {['genre','artist','year','label'].map(t => (
                  <span key={t} className="bc-settings-chip bc-settings-chip--track" draggable onDragStart={e => onDragStart(e, t)} onClick={() => insertToken(t, dirRef, setDirTpl)}>{t}</span>
                ))}
              </div>
              <div className="bc-settings-info">Gebruik <strong>/</strong> als mapscheiding. Segmenten die leeg zijn worden weggelaten.</div>
            </div>
          </div>

          <div className="bc-settings-card">
            <div className="bc-settings-card-hdr">
              <span className="bc-settings-card-ico">🔍</span>
              <span className="bc-settings-card-title">Voorbeeldtrack</span>
            </div>
            <div className="bc-settings-card-body">
              <select className="bc-inp bc-settings-select" value={sampleIdx} onChange={e => setSample(Number(e.target.value))}>
                {SAMPLES.map((s, i) => <option key={i} value={i}>{s.title} — {s.artist} ({s.genre}, {s.year})</option>)}
              </select>
            </div>
          </div>

        </div>

        <div className="bc-settings-right">
          <div className="bc-settings-preview-label">Live preview</div>
          <div className="bc-settings-fullpath">
            <span className="bc-settings-fp-root">downloads/</span>
            {dirResult.map((seg, i) => (
              <span key={i}><span className="bc-settings-fp-dir">{seg}</span><span className="bc-settings-fp-sep">/</span></span>
            ))}
            <span className="bc-settings-fp-file">{fnResult || '…'}<span className="bc-settings-fp-ext">.flac</span></span>
          </div>
          <div className="bc-settings-tree">
            <TreeNode ico="📂" name="downloads/" depth={0} isLast={false} />
            {dirResult.map((seg, i) => (
              <TreeNode key={i} ico="📁" name={seg + '/'} depth={i + 1} isLast={i === dirResult.length - 1 && tracks.length === 0} cls="dir" />
            ))}
            {tracks.map((t, i) => (
              <TreeNode key={i} ico="🎵" name={renderFile(fnTpl, t)} ext=".flac" depth={dirResult.length + 1} isLast={i === tracks.length - 1} cls={t.title === sample.title ? 'file focus' : 'file'} />
            ))}
          </div>
          <div className="bc-settings-tracklist-label">Alle tracks in deze crade</div>
          <div className="bc-settings-tracklist">
            {tracks.map((t, i) => (
              <div key={i} className="bc-settings-trackrow">
                <span className="bc-settings-tracknum">{String(i + 1).padStart(2, '0')}</span>
                <span className="bc-settings-trackname">{renderFile(fnTpl, t)}<span className="bc-tpl-preview-ext">.flac</span></span>
                <span className="bc-settings-trackfmt">FLAC</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bc-sync-footer">
        <span className={`bc-settings-saved${saved ? ' visible' : ''}`}>✓ Opgeslagen</span>
        <button className="bc-btn bc-btn-pri" onClick={save} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
      </div>
    </div>
  )
}

// ── Tab: Download ─────────────────────────────────────────────────────────────

function DownloadTab() {
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [maxConcurrent, setMaxConcurrent] = useState(2)
  const [defaultFmt,    setDefaultFmt]    = useState(() => localStorage.getItem('bc_fmt') || 'flac')
  const [saved,         setSaved]         = useState(false)
  const [checking,      setChecking]      = useState(false)
  const [versions,      setVersions]      = useState(null)

  useEffect(() => {
    getSettings()
      .then(s => { if (s.max_concurrent) setMaxConcurrent(Math.max(1, Math.min(10, parseInt(s.max_concurrent, 10) || 2))) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const pickFmt = f => { setDefaultFmt(f); localStorage.setItem('bc_fmt', f) }

  const save = async () => {
    setSaving(true)
    try {
      await putSettings({ max_concurrent: String(maxConcurrent) })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error('Opslaan mislukt:', e) }
    setSaving(false)
  }

  const checkVersions = async () => {
    setChecking(true); setVersions(null)
    try { setVersions(await getToolVersions()) }
    catch (e) { setVersions({ error: e.message || 'Fout bij ophalen' }) }
    setChecking(false)
  }

  if (loading) return <div className="bc-sync-empty">Laden…</div>

  return (
    <div className="bc-panel-tab-body bc-panel-tab-body--narrow">

      <div className="bc-settings-card">
        <div className="bc-settings-card-hdr">
          <span className="bc-settings-card-ico">🎵</span>
          <span className="bc-settings-card-title">Standaard formaat</span>
        </div>
        <div className="bc-settings-card-body">
          <div className="bc-fmt-seg">
            {FORMATS.map(f => (
              <button key={f} type="button" className={`bc-fmt-btn${defaultFmt === f ? ' active' : ''}`} onClick={() => pickFmt(f)}>
                {FMT_LABEL[f] || f.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="bc-settings-info">
            Wordt gebruikt bij het aanmaken van een nieuwe Crade. Beatport vereist LINK Professional voor FLAC.
          </div>
        </div>
      </div>

      <div className="bc-settings-card">
        <div className="bc-settings-card-hdr">
          <span className="bc-settings-card-ico">⚡</span>
          <span className="bc-settings-card-title">Gelijktijdige downloads</span>
        </div>
        <div className="bc-settings-card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
            <input type="range" min={1} max={10} value={maxConcurrent} onChange={e => setMaxConcurrent(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', color: 'var(--bc-acc)' }}>{maxConcurrent}</span>
          </div>
          <div className="bc-settings-info">Maximaal aantal downloads tegelijk (1–10). Wordt actief na herstart van de backend.</div>
        </div>
      </div>

      <div className="bc-settings-card">
        <div className="bc-settings-card-hdr">
          <span className="bc-settings-card-ico">🔍</span>
          <span className="bc-settings-card-title">Download-tools</span>
          <button className="bc-btn bc-btn-sec bc-btn-xs" onClick={checkVersions} disabled={checking}>
            {checking ? '…' : 'Controleer updates'}
          </button>
        </div>
        <div className="bc-settings-card-body">
          {!versions && !checking && (
            <div className="bc-settings-info">Klik om te controleren of beatportdl en yt-dlp up-to-date zijn.</div>
          )}
          {checking && <div className="bc-settings-info">GitHub raadplegen…</div>}
          {versions?.error && <div className="bc-settings-info" style={{ color: 'var(--bc-err)' }}>{versions.error}</div>}
          {versions && !versions.error && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <VersionRow name="beatportdl" data={versions.beatportdl} />
              <VersionRow name="yt-dlp"     data={versions.ytdlp} />
            </div>
          )}
        </div>
      </div>

      <div className="bc-sync-footer">
        <span className={`bc-settings-saved${saved ? ' visible' : ''}`}>✓ Opgeslagen</span>
        <button className="bc-btn bc-btn-pri" onClick={save} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
      </div>
    </div>
  )
}

function VersionRow({ name, data }) {
  const ok = data.up_to_date
  const missing = data.installed === 'niet gevonden'
  return (
    <div className={`bc-ver-row${ok ? ' ok' : missing ? ' missing' : ' outdated'}`}>
      <span className="bc-ver-name">{name}</span>
      <span className="bc-ver-installed">{data.installed}</span>
      <span className="bc-ver-arrow">→</span>
      {data.release_url
        ? <a className="bc-ver-latest" href={data.release_url} target="_blank" rel="noreferrer">{data.latest || '?'}</a>
        : <span className="bc-ver-latest">{data.latest || (data.error ? '?' : '—')}</span>
      }
      <span className={`bc-ver-badge${ok ? ' ok' : missing ? ' miss' : ' new'}`}>
        {ok ? '✓ Up-to-date' : missing ? 'Niet gevonden' : 'Update beschikbaar'}
      </span>
    </div>
  )
}

// ── Tab: Sync ─────────────────────────────────────────────────────────────────

const SYNC_TYPE_META = {
  create_dir:     { label: 'Aanmaken op disk',    icon: '📁', cls: 'add' },
  reorganize_dir: { label: 'Structuur aanpassen', icon: '🗂️', cls: 'upd' },
  clear_output:   { label: 'DB bijwerken',         icon: '🔗', cls: 'upd' },
  mark_missing:   { label: 'Ontbrekend markeren', icon: '⚠️', cls: 'del' },
  add_from_disk:  { label: 'Nieuw vanuit disk',   icon: '📥', cls: 'new' },
}

function SyncTab({ onDone, onClose }) {
  const [loading,   setLoading]   = useState(true)
  const [actions,   setActions]   = useState([])
  const [dlRoot,    setDlRoot]    = useState('')
  const [selected,  setSelected]  = useState({})
  const [executing, setExecuting] = useState(false)
  const [results,   setResults]   = useState(null)

  useEffect(() => {
    syncPreview()
      .then(data => {
        setActions(data.actions); setDlRoot(data.download_root)
        const sel = {}; data.actions.forEach(a => { sel[a.id] = a.selected }); setSelected(sel)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle      = id   => setSelected(s => ({ ...s, [id]: !s[id] }))
  const toggleGroup = type => {
    const ofType = actions.filter(a => a.type === type)
    const allOn  = ofType.every(a => selected[a.id])
    setSelected(s => { const n = { ...s }; ofType.forEach(a => { n[a.id] = !allOn }); return n })
  }
  const execute = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
    if (!ids.length) return
    setExecuting(true)
    try { const res = await syncExecute(ids); setResults(res.results); onDone?.() }
    catch (e) { setResults([{ id: '_err', ok: false, message: e.message || 'Onbekende fout' }]) }
    setExecuting(false)
  }

  const selCount = Object.values(selected).filter(Boolean).length
  const groups   = Object.entries(SYNC_TYPE_META)
    .map(([type, meta]) => ({ type, meta, items: actions.filter(a => a.type === type) }))
    .filter(g => g.items.length > 0)

  if (loading) return <div className="bc-sync-empty">Scannen…</div>

  if (results) return (
    <div className="bc-panel-tab-body">
      <div className="bc-sync-body">
        {results.map(r => (
          <div key={r.id} className={`bc-sync-result-card${r.ok ? ' ok' : ' fail'}`}>
            <span className="bc-sync-result-icon">{r.ok ? '✓' : '✕'}</span>
            <span>{r.message}</span>
          </div>
        ))}
      </div>
      <div className="bc-sync-footer"><span /><button className="bc-btn bc-btn-pri" onClick={onClose}>Sluiten</button></div>
    </div>
  )

  if (groups.length === 0) return (
    <div className="bc-panel-tab-body">
      <div className="bc-sync-empty">✓ Alles is al gesynchroniseerd.</div>
    </div>
  )

  return (
    <div className="bc-panel-tab-body">
      <div className="bc-sync-meta">
        <span className="bc-sync-meta-chip">🗂 {dlRoot}</span>
        <span className="bc-sync-meta-chip">📦 {actions.length} item{actions.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="bc-sync-legend">
        {Object.entries(SYNC_TYPE_META).map(([type, m]) => (
          <span key={type} className={`bc-sync-leg bc-sync-leg--${m.cls}`}>
            <span className="bc-sync-leg-dot" />{m.label}
          </span>
        ))}
      </div>
      <div className="bc-sync-body">
        {groups.map(({ type, meta, items }) => (
          <div key={type} className="bc-sync-action-group">
            <div className="bc-sync-group-sep" onClick={() => toggleGroup(type)}>
              <span className={`bc-sync-sep-label bc-sync-sep--${meta.cls}`}>{meta.icon} {meta.label}</span>
              <span className="bc-sync-sep-count">{items.filter(a => selected[a.id]).length}/{items.length} geselecteerd</span>
            </div>
            <div className="bc-sync-cards">
              {items.map(a => (
                <label key={a.id} className={`bc-sync-card bc-sync-card--${meta.cls}${selected[a.id] ? ' checked' : ''}`}>
                  <input type="checkbox" className="bc-sync-cb" checked={!!selected[a.id]} onChange={() => toggle(a.id)} />
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
        <button className="bc-btn bc-btn-pri" disabled={!selCount || executing} onClick={execute}>
          {executing ? 'Bezig…' : 'Sync uitvoeren'}
        </button>
      </div>
    </div>
  )
}

// ── Tab: Provider ─────────────────────────────────────────────────────────────

function ProviderTab() {
  const [data,    setData]    = useState(null)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { getProvider().then(setData).catch(() => {}) }, [])

  const pick = async p => {
    if (!data || p === data.provider || saving) return
    setSaving(true)
    try { const r = await setProvider(p); setData(d => ({ ...d, provider: r.provider, from_env: r.from_env })) }
    catch (e) { console.error('Provider switch mislukt:', e) }
    setSaving(false)
  }

  if (!data) return <div className="bc-sync-empty">Laden…</div>

  return (
    <div className="bc-panel-tab-body bc-panel-tab-body--narrow">
      <div className="bc-settings-card">
        <div className="bc-settings-card-hdr">
          <span className="bc-settings-card-ico">🎧</span>
          <span className="bc-settings-card-title">Beatport provider</span>
        </div>
        <div className="bc-settings-card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.options.map(p => (
              <button key={p} onClick={() => pick(p)} disabled={saving} className={`bc-provider-opt${data.provider === p ? ' active' : ''}`}>
                <span className="bc-provider-opt-name">{p}</span>
                {data.provider === p && <span className="bc-provider-opt-check">✓ Actief</span>}
              </button>
            ))}
          </div>
          {data.from_env && (
            <div className="bc-settings-info" style={{ marginTop: 12 }}>
              Standaard ingesteld via <code>BEATPORT_PROVIDER</code> env-variabele. Reset na herstart.
            </div>
          )}
        </div>
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
