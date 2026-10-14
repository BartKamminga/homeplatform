import { useEffect, useState } from 'react'
import { api } from '@core/api.js'
import { STATUS_LABEL, suggestedVerbs } from '../model.js'
import LinkForm from './LinkForm.jsx'

// Side panel for one element: what it is, how it should be handled, and everything it is linked to.
export default function ElementDrawer({ cat, element, system, onSelect, onClose, onChanged }) {
  const kind = cat.kinds[element.kind]
  const dim = kind && cat.dims[kind.dimension]
  const own = element.system_id === system.id
  const [draft, setDraft] = useState({ name: element.name, description: element.description || '', status: element.status })
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft({ name: element.name, description: element.description || '', status: element.status })
    setConfirming(false)
    setError('')
  }, [element])

  const byId = Object.fromEntries([...system.elements, ...system.linked_elements].map((e) => [e.id, e]))
  const outgoing = system.links.filter((l) => l.from_id === element.id)
  const incoming = system.links.filter((l) => l.to_id === element.id)
  const dirty = draft.name !== element.name || draft.description !== (element.description || '') || draft.status !== element.status

  async function save() {
    try {
      await api.patch(`/api/keelson/elements/${element.id}`, { ...draft, description: draft.description || null })
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  async function remove() {
    try {
      await api.delete(`/api/keelson/elements/${element.id}`)
      onClose()
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  async function unlink(id) {
    try {
      await api.delete(`/api/keelson/links/${id}`)
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  const relRow = (l, otherId, text) => {
    const other = byId[otherId]
    return (
      <li key={l.id}>
        <button type="button" className="ks-rel" onClick={() => onSelect(otherId)} disabled={!other}>
          <span className={`ks-dot ${other?.status || 'missing'}`} />
          <span>{text(other?.name || 'unknown')}</span>
        </button>
        <button type="button" className="ks-x" aria-label="Remove link" onClick={() => unlink(l.id)}>×</button>
      </li>
    )
  }

  return (
    <aside className="ks-drawer" aria-label={element.name}>
      <div className="ks-row ks-drawer-head">
        <span className="ks-eyebrow" style={{ color: dim ? `var(--ks-${dim.layer})` : undefined }}>{dim?.name} · {kind?.name || element.kind}</span>
        <button type="button" className="ks-x" aria-label="Close" onClick={onClose}>×</button>
      </div>

      {own ? (
        <div className="ks-form">
          <input id="el-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Name" className="ks-el-title" />
          <select id="el-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} aria-label="Status">
            {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <textarea id="el-description" rows={3} value={draft.description} placeholder="What is it, where does it live?"
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })} aria-label="Description" />
          {dirty && <button type="button" className="ks-btn" onClick={save}>Save changes</button>}
        </div>
      ) : (
        <>
          <h2>{element.name}</h2>
          <p className="ks-muted">Belongs to another system. {element.description}</p>
        </>
      )}

      {Object.keys(element.attributes).length > 0 && (
        <dl className="ks-attrs">
          {Object.entries(element.attributes).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd className="mono">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></div>
          ))}
        </dl>
      )}

      {kind && (
        <>
          <div><h3>Tooling and systems</h3><div className="ks-chips">{kind.tooling.map((t) => <span key={t} className="ks-chip">{t}</span>)}</div></div>
          <div><h3>Way of working</h3><p className="ks-practice">{kind.practice}</p></div>
        </>
      )}

      <div>
        <h3>Links ({outgoing.length + incoming.length})</h3>
        <ul className="ks-rels">
          {outgoing.map((l) => relRow(l, l.to_id, (n) => <><span className="ks-muted">{l.verb}</span> {n}</>))}
          {incoming.map((l) => relRow(l, l.from_id, (n) => <>{n} <span className="ks-muted">{l.verb} this</span></>))}
        </ul>
        {own && (
          <LinkForm element={element} verbsFor={(to) => suggestedVerbs(cat, element.kind, to?.kind)} kindName={(k) => cat.kinds[k]?.name || k}
                    onLinked={onChanged} />
        )}
      </div>

      {own && (
        <div className="ks-danger">
          {confirming ? (
            <div className="ks-row">
              <span>Delete “{element.name}” and its links?</span>
              <button type="button" className="ks-btn danger" onClick={remove}>Delete</button>
              <button type="button" className="ks-btn ghost" onClick={() => setConfirming(false)}>Keep</button>
            </div>
          ) : <button type="button" className="ks-btn ghost" onClick={() => setConfirming(true)}>Delete element</button>}
        </div>
      )}
      {error && <p className="ks-error">{error}</p>}
    </aside>
  )
}
