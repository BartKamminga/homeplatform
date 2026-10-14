import { useState, useEffect, useRef } from 'react'
import { FORMATS, FMT_LABEL, detectSrc, slugFromBeatportUrl, todayName, allCradesFrom } from '../helpers.js'
import { AcSeg } from '@components/arcade/controls.jsx'

// Formulier "nieuwe crade" in arcade-stijl (item 1338), zelfde gedrag als classic.
export default function NewCradeForm({ tree, racks, onCreate, onClose }) {
  const [name, setName] = useState(todayName())
  const [url, setUrl] = useState('')
  const [rack, setRack] = useState('')
  const [fmt, setFmt] = useState(() => localStorage.getItem('bc_fmt') || 'flac')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const urlRef = useRef(null)

  useEffect(() => { setTimeout(() => urlRef.current?.focus(), 60) }, [])

  const trimmed = url.trim()
  const dup = trimmed ? allCradesFrom(tree).find(c => c.source_url?.trim() === trimmed) : null

  function onUrl(v) {
    setUrl(v)
    if (detectSrc(v) === 'beatport' && name === todayName()) {
      const slug = slugFromBeatportUrl(v)
      if (slug) setName(slug)
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (!trimmed) return
    setBusy(true); setErr('')
    try {
      await onCreate({ name: name || todayName(), source_url: trimmed, format: fmt, group_id: rack || null })
      onClose()
    } catch (ex) {
      setErr(ex.message || 'Could not create the crade')
    } finally { setBusy(false) }
  }

  return (
    <form className="ac-card bca-form" onSubmit={submit}>
      <div className="bca-form-head full"><h3 className="ac-h">NEW CRADE</h3><button type="button" className="ac-icon" onClick={onClose} aria-label="Close">✕</button></div>
      <div><label className="ac-label" htmlFor="bca-name">Name</label>
        <input id="bca-name" className="ac-input" value={name} onChange={e => setName(e.target.value)} /></div>
      <div><label className="ac-label" htmlFor="bca-rack">Rack</label>
        <select id="bca-rack" className="ac-select" value={rack} onChange={e => setRack(e.target.value)}>
          <option value="">No rack</option>
          {racks.map(r => <option key={r.id} value={r.id}>{r.sectionName ? `${r.sectionName} / ${r.name}` : r.name}</option>)}
        </select></div>
      <div className="full"><label className="ac-label" htmlFor="bca-url">Source URL</label>
        <input id="bca-url" ref={urlRef} className={`ac-input${dup ? ' warn' : ''}`} value={url} required
          onChange={e => onUrl(e.target.value)} placeholder="Beatport, YouTube or SoundCloud URL…" />
        {dup && <p className="bca-warn">This URL is already in "{dup.name}".</p>}</div>
      <div><span className="ac-label">Format</span>
        <AcSeg value={fmt} onChange={f => { setFmt(f); localStorage.setItem('bc_fmt', f) }} items={FORMATS.map(f => ({ value: f, label: FMT_LABEL[f] }))} />
        {detectSrc(url) === 'beatport' && <p className="ac-hint" style={{ marginTop: 6 }}>Beatport needs LINK Professional for FLAC.</p>}</div>
      <div className="bca-form-acts">
        {err && <span className="bca-warn">{err}</span>}
        <button type="button" className="ac-btn" onClick={onClose}>CANCEL</button>
        <button type="submit" className="ac-btn ac-btn--primary" disabled={busy || !trimmed}>{busy ? '…' : 'START DOWNLOAD'}</button>
      </div>
    </form>
  )
}
