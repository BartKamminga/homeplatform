import { useState, useEffect } from 'react'
import { getSettings, putSettings, getToolVersions } from '../../api.js'
import { FORMATS, FMT_LABEL } from '../../helpers.js'
import { AcSeg, AcStepper } from '@components/arcade/controls.jsx'
import { useAcToast } from '@components/arcade/overlays.jsx'

// Tab Download (item 1338): standaardformaat, gelijktijdige downloads en tool-versies.
function VersionCard({ name, data }) {
  const ok = data.up_to_date
  const missing = data.installed === 'niet gevonden'
  return (
    <div>
      <small>{name.toUpperCase()}</small>
      <b style={{ fontSize: 15 }}>{missing ? '–' : data.installed}</b>
      <i style={{ color: ok ? 'var(--ac-ok)' : missing ? 'var(--ac-pink)' : 'var(--ac-yellow)', opacity: 1 }}>
        {ok ? '✓ up to date' : missing ? 'not found' : <>▲ {data.release_url ? <a href={data.release_url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{data.latest}</a> : data.latest} available</>}
      </i>
    </div>
  )
}

export default function DownloadTab() {
  const [loading, setLoading] = useState(true)
  const [maxConcurrent, setMaxConcurrent] = useState(2)
  const [fmt, setFmt] = useState(() => localStorage.getItem('bc_fmt') || 'flac')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [versions, setVersions] = useState(null)
  const [toast, showToast] = useAcToast()

  useEffect(() => {
    getSettings()
      .then(s => { if (s.max_concurrent) setMaxConcurrent(Math.max(1, Math.min(10, parseInt(s.max_concurrent, 10) || 2))) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try { await putSettings({ max_concurrent: String(maxConcurrent) }); showToast('SAVED') }
    catch (e) { showToast(e.message || 'SAVE FAILED', true) }
    setSaving(false)
  }

  async function check() {
    setChecking(true); setVersions(null)
    try { setVersions(await getToolVersions()) } catch (e) { setVersions({ error: e.message || 'Could not check' }) }
    setChecking(false)
  }

  if (loading) return <p className="ac-hint">Loading…</p>

  return (
    <div className="bca-tab">
      <div className="ac-card">
        <div className="ac-row"><span>DEFAULT FORMAT<small>Used for new crades. Beatport needs LINK Professional for FLAC.</small></span>
          <AcSeg value={fmt} onChange={f => { setFmt(f); localStorage.setItem('bc_fmt', f) }} items={FORMATS.map(f => ({ value: f, label: FMT_LABEL[f] }))} /></div>
        <div className="ac-row"><span>PARALLEL DOWNLOADS<small>1–10 at the same time. Takes effect after a backend restart.</small></span>
          <AcStepper value={maxConcurrent} min={1} max={10} onChange={setMaxConcurrent} label="Parallel downloads" /></div>
      </div>
      <div>
        <div className="bca-field-head"><span className="ac-label">Download tools</span>
          <button type="button" className="ac-btn ac-btn--sm ac-btn--cyan" onClick={check} disabled={checking}>{checking ? 'CHECKING…' : 'CHECK VERSIONS'}</button></div>
        {!versions && !checking && <p className="ac-hint">Check whether beatportdl and yt-dlp are up to date.</p>}
        {versions?.error && <p className="ac-hint" style={{ color: 'var(--ac-pink)' }}>{versions.error}</p>}
        {versions && !versions.error && (
          <div className="ac-grid"><VersionCard name="beatportdl" data={versions.beatportdl} /><VersionCard name="yt-dlp" data={versions.ytdlp} /></div>
        )}
      </div>
      <button type="button" className="ac-btn ac-btn--primary" onClick={save} disabled={saving}>{saving ? 'SAVING…' : 'SAVE'}</button>
      {toast}
    </div>
  )
}
