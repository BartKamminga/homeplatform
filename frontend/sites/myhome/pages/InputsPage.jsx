import { useState } from 'react'
import { api } from '@core/api.js'
import { uploadImageFile } from '@core/uploadImage.js'
import { CONNECTION_STATUS } from '../model.js'

// Invoerkant: tekeningen/foto's, verbeteringen in gewone taal, koppelingen en overige databronnen.
export default function InputsPage({ home, sources, notes, onReload, onHomeChange }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [src, setSrc] = useState({ title: '', kind: 'drawing', floor_key: '' })
  const [noteText, setNoteText] = useState('')
  const [conn, setConn] = useState({ name: '', status: 'planned', detail: '' })
  const [ds, setDs] = useState({ name: '', url: '', detail: '' })

  async function run(fn) {
    setError('')
    setBusy(true)
    try { await fn() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const upload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    run(async () => {
      const url = await uploadImageFile(file, 'myhome')
      await api.post(`/api/myhome/homes/${home.id}/sources`, {
        ...src, title: src.title || file.name, floor_key: src.floor_key || null,
        file_path: url.replace('/api/uploads/', ''),
      })
      setSrc({ ...src, title: '' })
      e.target.value = ''
      await onReload()
    })
  }

  const saveMeta = (key, list) => run(async () => {
    onHomeChange(await api.patch(`/api/myhome/homes/${home.id}`, { meta: { ...home.meta, [key]: list } }))
  })

  const connections = home.meta?.connections || []
  const dataSources = home.meta?.data_sources || []

  return (
    <div className="mh-page">
      {error && <p className="mh-error">{error}</p>}

      <section>
        <h2>Drawings and photos</h2>
        <p className="mh-muted">Floor plans, photos of the front or an aerial view. They are the source for the model and always stay visible next to it.</p>
        <div className="mh-form" style={{ marginTop: 10 }}>
          <input id="src-title" placeholder="Title (e.g. Attic floor plan)" value={src.title} onChange={(e) => setSrc({ ...src, title: e.target.value })} aria-label="Title" />
          <select id="src-kind" value={src.kind} onChange={(e) => setSrc({ ...src, kind: e.target.value })} aria-label="Kind">
            <option value="drawing">Floor plan / drawing</option>
            <option value="photo">Photo</option>
            <option value="document">Other document</option>
          </select>
          <select id="src-floor" value={src.floor_key} onChange={(e) => setSrc({ ...src, floor_key: e.target.value })} aria-label="Floor">
            <option value="">Whole house</option>
            {home.floors.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
          </select>
          <input id="src-file" type="file" accept="image/*" onChange={upload} disabled={busy} aria-label="Image file" />
        </div>
        <ul className="mh-list" style={{ marginTop: 10 }}>
          {sources.map((s) => (
            <li key={s.id} className="mh-row" style={{ justifyContent: 'space-between' }}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
              <span className="mh-muted">{s.kind}{s.floor_key ? ` · ${s.floor_key}` : ''}</span>
              <button className="mh-btn ghost" onClick={() => run(async () => { await api.delete(`/api/myhome/sources/${s.id}`); await onReload() })}>Remove</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Corrections in plain words</h2>
        <p className="mh-muted">Write what is wrong or missing, e.g. "Bedroom D belongs to Thom" or "the attic landing has a skylight". Open items are processed into the model.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (noteText.trim()) run(async () => { await api.post(`/api/myhome/homes/${home.id}/notes`, { text: noteText }); setNoteText(''); await onReload() }) }}>
          <textarea id="note-text" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Your correction…" aria-label="Correction" />
          <button className="mh-btn" type="submit" disabled={busy || !noteText.trim()}>Add correction</button>
        </form>
        <ul className="mh-list" style={{ marginTop: 10 }}>
          {notes.map((n) => (
            <li key={n.id}>
              <span className="mh-row" style={{ justifyContent: 'space-between' }}>
                <span>{n.text}</span>
                <span className={`mh-pill ${n.status === 'applied' ? 'linked' : n.status === 'open' ? 'proposed' : 'none'}`}>{n.status}</span>
              </span>
              {n.response && <span className="mh-muted">{n.response}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Connections</h2>
        <p className="mh-muted">Systems that know about this house: Home Assistant, Hue, tado, UniFi, …</p>
        <ul className="mh-list" style={{ margin: '10px 0' }}>
          {connections.map((c, i) => (
            <li key={i} className="mh-row" style={{ justifyContent: 'space-between' }}>
              <span><strong>{c.name}</strong> <span className="mh-muted">{c.detail}</span></span>
              <span className="mh-row">
                <select id={`conn-st-${i}`} value={c.status} aria-label={`Status of ${c.name}`}
                  onChange={(e) => saveMeta('connections', connections.map((x, j) => (j === i ? { ...x, status: e.target.value } : x)))}>
                  {Object.entries(CONNECTION_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button className="mh-btn ghost" onClick={() => saveMeta('connections', connections.filter((_, j) => j !== i))}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
        <form className="mh-form" onSubmit={(e) => { e.preventDefault(); if (conn.name.trim()) { saveMeta('connections', [...connections, conn]); setConn({ name: '', status: 'planned', detail: '' }) } }}>
          <input id="conn-name" placeholder="Name (e.g. Philips Hue)" value={conn.name} onChange={(e) => setConn({ ...conn, name: e.target.value })} aria-label="Connection name" />
          <input id="conn-detail" placeholder="Detail (address, what it covers)" value={conn.detail} onChange={(e) => setConn({ ...conn, detail: e.target.value })} aria-label="Connection detail" />
          <button className="mh-btn" type="submit">Add connection</button>
        </form>
      </section>

      <section>
        <h2>Other data sources</h2>
        <form className="mh-form" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (ds.name.trim()) { saveMeta('data_sources', [...dataSources, ds]); setDs({ name: '', url: '', detail: '' }) } }}>
          <input id="ds-name" placeholder="Name (e.g. 3D BAG)" value={ds.name} onChange={(e) => setDs({ ...ds, name: e.target.value })} aria-label="Data source name" />
          <input id="ds-url" placeholder="Link (optional)" value={ds.url} onChange={(e) => setDs({ ...ds, url: e.target.value })} aria-label="Data source link" />
          <input id="ds-detail" placeholder="What it tells us" value={ds.detail} onChange={(e) => setDs({ ...ds, detail: e.target.value })} aria-label="Data source detail" />
          <button className="mh-btn" type="submit">Add data source</button>
        </form>
        <ul className="mh-list" style={{ marginTop: 10 }}>
          {dataSources.map((d, i) => (
            <li key={i} className="mh-row" style={{ justifyContent: 'space-between' }}>
              <span><strong>{d.name}</strong> <span className="mh-muted">{d.detail}</span></span>
              <button className="mh-btn ghost" onClick={() => saveMeta('data_sources', dataSources.filter((_, j) => j !== i))}>Remove</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
