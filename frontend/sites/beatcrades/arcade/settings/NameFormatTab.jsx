import { useState, useEffect, useRef } from 'react'
import { getSettings, putSettings } from '../../api.js'
import { useAcToast } from '@components/arcade/overlays.jsx'
import { DEFAULTS, SAMPLES, CRADE_TRACKS, TRACK_TOKENS, DIR_TOKENS, DIR_TRACK_TOKENS, renderDir, renderFile, hasUnresolved } from './templates.js'

// Tab Name format (item 1338): bestandsnaam- en map-template met tokens en live preview.
function TokenChips({ tokens, dir, onPick }) {
  return (
    <div className="bca-tokens">
      {tokens.map(t => (
        <button key={t} type="button" className={dir ? 'dir' : ''} draggable title={`Click or drag to insert {${t}}`}
          onDragStart={e => { e.dataTransfer.setData('text/plain', `{${t}}`); e.dataTransfer.effectAllowed = 'copy' }}
          onClick={() => onPick(t)}>{t}</button>
      ))}
    </div>
  )
}

function TemplateField({ id, label, value, setValue, inputRef, onReset, suffix }) {
  const insertAt = text => {
    const el = inputRef.current
    const start = el?.selectionStart ?? value.length, end = el?.selectionEnd ?? value.length
    setValue(value.slice(0, start) + text + value.slice(end))
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + text.length, start + text.length) })
  }
  return (
    <div>
      <div className="bca-field-head"><label className="ac-label" htmlFor={id}>{label}</label>
        <button type="button" className="ac-icon" onClick={onReset} title="Restore default" aria-label="Restore default">↺</button></div>
      <div className="bca-tpl" onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const t = e.dataTransfer.getData('text/plain'); if (t) insertAt(t) }}>
        <input id={id} ref={inputRef} className="ac-input" value={value} onChange={e => setValue(e.target.value)} spellCheck={false} />
        {suffix && <span>{suffix}</span>}
      </div>
    </div>
  )
}

export default function NameFormatTab() {
  const [loading, setLoading] = useState(true)
  const [fnTpl, setFnTpl] = useState(DEFAULTS.filename_template)
  const [dirTpl, setDirTpl] = useState(DEFAULTS.dir_template)
  const [sampleIdx, setSampleIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [toast, showToast] = useAcToast()
  const fnRef = useRef(null), dirRef = useRef(null)

  useEffect(() => {
    getSettings().then(s => {
      if (s.filename_template) setFnTpl(s.filename_template)
      if (s.dir_template) setDirTpl(s.dir_template)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const insert = (ref, value, setter) => token => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length, end = el?.selectionEnd ?? value.length
    setter(value.slice(0, start) + `{${token}}` + value.slice(end))
  }

  async function save() {
    setSaving(true)
    try { await putSettings({ filename_template: fnTpl, dir_template: dirTpl }); showToast('SAVED') }
    catch (e) { showToast(e.message || 'SAVE FAILED', true) }
    setSaving(false)
  }

  if (loading) return <p className="ac-hint">Loading…</p>
  const sample = SAMPLES[sampleIdx]
  const tracks = CRADE_TRACKS[sampleIdx] || [sample]
  const fn = renderFile(fnTpl, sample)
  const dirs = renderDir(dirTpl, sample)

  return (
    <div className="bca-tab">
      <TemplateField id="bca-fn" label="File name" value={fnTpl} setValue={setFnTpl} inputRef={fnRef} suffix=".flac"
        onReset={() => setFnTpl(DEFAULTS.filename_template)} />
      <span className="ac-label">Track fields · click or drag</span>
      <TokenChips tokens={TRACK_TOKENS} onPick={insert(fnRef, fnTpl, setFnTpl)} />

      <TemplateField id="bca-dir" label="Folder structure" value={dirTpl} setValue={setDirTpl} inputRef={dirRef}
        onReset={() => setDirTpl(DEFAULTS.dir_template)} />
      <span className="ac-label">Structure fields</span>
      <div className="bca-tokens-row">
        <TokenChips tokens={DIR_TOKENS} dir onPick={insert(dirRef, dirTpl, setDirTpl)} />
        <TokenChips tokens={DIR_TRACK_TOKENS} onPick={insert(dirRef, dirTpl, setDirTpl)} />
      </div>
      <p className="ac-hint">Use / between folders. Empty segments are left out.</p>

      <div><label className="ac-label" htmlFor="bca-sample">Sample track</label>
        <select id="bca-sample" className="ac-select" value={sampleIdx} onChange={e => setSampleIdx(Number(e.target.value))}>
          {SAMPLES.map((s, i) => <option key={i} value={i}>{s.title} · {s.artist} ({s.genre}, {s.year})</option>)}
        </select></div>

      <div>
        <span className="ac-label">Live preview</span>
        <div className="ac-well bca-preview">
          <span className="muted">downloads/</span>{dirs.map((d, i) => <span key={i}><span className="dir">{d}</span>/</span>)}
          <span className={hasUnresolved(fn) ? 'warn' : 'file'}>{fn || '…'}.flac</span>
        </div>
      </div>
      <div>
        <span className="ac-label">All tracks in this crade</span>
        <div className="bca-tracklist">
          {tracks.map((t, i) => (
            <div key={i}><span>{String(i + 1).padStart(2, '0')}</span><span>{renderFile(fnTpl, t)}.flac</span><span>FLAC</span></div>
          ))}
        </div>
      </div>
      <button type="button" className="ac-btn ac-btn--primary" onClick={save} disabled={saving}>{saving ? 'SAVING…' : 'SAVE'}</button>
      {toast}
    </div>
  )
}
