import { useState } from 'react'
import { api } from '@core/api.js'
import { STATUS_LABEL } from '../model.js'

function AddElementForm({ cat, dim, systemId, initialKind, onDone }) {
  const kinds = cat.kindsByDim[dim.key] || []
  const [kind, setKind] = useState(initialKind || kinds[0]?.key)
  const [name, setName] = useState('')
  const [status, setStatus] = useState('present')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await api.post(`/api/keelson/systems/${systemId}/elements`, { kind, name: name.trim(), status })
      onDone(true)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="ks-add" onSubmit={submit}>
      <select id={`add-kind-${dim.key}`} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind">
        {kinds.map((k) => <option key={k.key} value={k.key}>{k.name}</option>)}
      </select>
      <input id={`add-name-${dim.key}`} autoFocus placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
      <select id={`add-status-${dim.key}`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
        {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <div className="ks-row">
        <button className="ks-btn" type="submit">Add</button>
        <button className="ks-btn ghost" type="button" onClick={() => onDone(false)}>Cancel</button>
      </div>
      {error && <p className="ks-error">{error}</p>}
    </form>
  )
}

function Checklist({ checks, onToggle }) {
  return (
    <ul className="ks-checks">
      {checks.map((c) => (
        <li key={c.id}>
          <label>
            <input type="checkbox" id={`check-${c.id}`} checked={c.done} onChange={() => onToggle(c)} />
            <span>{c.title}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}

export default function DimensionBlock({ cat, dim, system, phase, selected, onSelect, onChanged }) {
  const [adding, setAdding] = useState(null)
  const [checks, setChecks] = useState(() => system.checks.filter((c) => c.dimension === dim.key))
  const kinds = cat.kindsByDim[dim.key] || []
  const elements = system.elements.filter((e) => e.dimension === dim.key)
  const gaps = kinds.filter((k) => !elements.some((e) => e.kind === k.key))
  const shown = phase === 'all' ? checks : checks.filter((c) => c.phase === phase)
  const done = checks.filter((c) => c.done).length

  async function toggle(c) {
    setChecks((list) => list.map((x) => (x.id === c.id ? { ...x, done: !c.done } : x)))
    try {
      await api.patch(`/api/keelson/checks/${c.id}`, { done: !c.done })
      onChanged()
    } catch {
      setChecks((list) => list.map((x) => (x.id === c.id ? { ...x, done: c.done } : x)))
    }
  }

  return (
    <article className="ks-dim" style={{ '--c': `var(--ks-${dim.layer})` }}>
      <header>
        <h3>{dim.name}</h3>
        <span className="ks-muted mono">{elements.length} · {done}/{checks.length}</span>
      </header>

      {elements.length ? (
        <ul className="ks-elements">
          {elements.map((e) => (
            <li key={e.id}>
              <button type="button" aria-pressed={selected === e.id} onClick={() => onSelect(e.id)}>
                <span className={`ks-dot ${e.status}`} title={STATUS_LABEL[e.status]} />
                <span className="ks-el-name">{e.name}</span>
                <span className="ks-el-kind">{cat.kinds[e.kind]?.name || e.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="ks-muted">Nothing described yet.</p>}

      {adding ? (
        <AddElementForm cat={cat} dim={dim} systemId={system.id} initialKind={adding === true ? null : adding}
                        onDone={(changed) => { setAdding(null); if (changed) onChanged() }} />
      ) : (
        <div className="ks-gaps">
          {gaps.map((k) => (
            <button key={k.key} type="button" className="ks-gap" title={k.summary} onClick={() => setAdding(k.key)}>+ {k.name}</button>
          ))}
          {!gaps.length && <button type="button" className="ks-gap" onClick={() => setAdding(true)}>+ Add element</button>}
        </div>
      )}

      {phase === 'all' ? (
        Object.entries(cat.phases).map(([p, label]) => {
          const list = checks.filter((c) => c.phase === p)
          return list.length ? <div key={p} className="ks-phase"><h4>{label}</h4><Checklist checks={list} onToggle={toggle} /></div> : null
        })
      ) : <div className="ks-phase"><h4>{cat.phases[phase]}</h4><Checklist checks={shown} onToggle={toggle} /></div>}
    </article>
  )
}
