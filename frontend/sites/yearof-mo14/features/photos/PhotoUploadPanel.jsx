import { useState } from 'react'
import useUploadQueue from './useUploadQueue.js'
import { PHOTO_TYPES } from './photoFilters.js'

// Uploaden in de context van de PhotoManager (item 1213):
// - matchRef gezet (wedstrijdpagina) = meteen aan die wedstrijd gekoppeld;
// - reportId gezet (later: bij een bericht) = aan dat bericht gekoppeld;
// - anders kies je de wedstrijd.
// onUploaded(ids, publishNow) - de PhotoManager ververst en publiceert evt.

const select = { fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid #ddd', background: 'white' }

export default function PhotoUploadPanel({ matchRef = null, reportId = null, entries, onUploaded, onClose }) {
  const queue = useUploadQueue()
  const [pickedMatch, setPickedMatch] = useState('')
  const chosenMatch = pickedMatch || entries[0]?.match_ref || ''
  const [photoType, setPhotoType] = useState('actie')
  const [publishNow, setPublishNow] = useState(true)
  const target = { matchRef: reportId ? null : (matchRef || chosenMatch), reportId, photoType }
  const canUpload = queue.files.length > 0 && !queue.busy && (reportId || target.matchRef)

  async function upload() {
    const ids = await queue.uploadAll(target)
    if (ids.length) await onUploaded(ids, publishNow)
  }

  return (
    <div style={{ padding: 12, marginBottom: 12, border: '2px dashed #ccd3e0', borderRadius: 10, background: '#fafbfd' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Foto&rsquo;s &amp; filmpjes uploaden</strong>
        {!matchRef && !reportId && (
          <select value={chosenMatch} onChange={e => setPickedMatch(e.target.value)} style={{ ...select, maxWidth: 260 }}>
            {entries.map(e => <option key={e.match_ref} value={e.match_ref}>{(e.date || '').slice(0, 10)} · {e.title}</option>)}
          </select>
        )}
        <select value={photoType} onChange={e => setPhotoType(e.target.value)} style={select}>
          {PHOTO_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={publishNow} onChange={e => setPublishNow(e.target.checked)} style={{ margin: 0 }} />
          meteen publiceren
        </label>
        <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }} title="Sluiten">&times;</button>
      </div>

      <input type="file" multiple accept="image/*,video/mp4,video/quicktime,video/webm"
        onChange={e => { queue.addFiles(e.target.files); e.target.value = '' }} style={{ fontSize: 12 }} />
      <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>of plak een foto met Ctrl+V</span>

      {queue.previews.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6, marginTop: 10 }}>
          {queue.previews.map((p, i) => (
            <div key={p.url} style={{ position: 'relative' }}>
              {p.isVideo
                ? <div style={{ aspectRatio: '1', borderRadius: 8, background: '#12203c', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▶️</div>
                : <img src={p.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />}
              <button onClick={() => queue.removeFile(i)} disabled={queue.busy} title="Weghalen" style={{
                position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', border: 'none',
                background: 'rgba(0,0,0,.6)', color: 'white', cursor: 'pointer', fontSize: 12, lineHeight: '20px', padding: 0,
              }}>&times;</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <button onClick={upload} disabled={!canUpload} className="yof-btn" style={{ width: 'auto', padding: '8px 18px', fontSize: 13 }}>
          {queue.busy ? `Uploaden ${queue.progress.done}/${queue.progress.total}...` : `Upload ${queue.files.length || ''}`.trim()}
        </button>
        {queue.progress && !queue.busy && queue.errors.length === 0 && <span style={{ fontSize: 12, color: '#16a34a' }}>Klaar!</span>}
      </div>
      {queue.errors.map(msg => <p key={msg} style={{ color: '#c23b3b', fontSize: 12, margin: '4px 0 0' }}>{msg}</p>)}
    </div>
  )
}
