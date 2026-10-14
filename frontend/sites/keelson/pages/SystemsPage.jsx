import { useState } from 'react'
import { api } from '@core/api.js'
import { KIND_LABEL, SYSTEM_STATUS_LABEL, coverage } from '../model.js'

const GROUPS = [['platform', 'Platform'], ['product', 'Products'], ['tool', 'Tools']]

function SystemCard({ cat, s, onOpen }) {
  const cov = coverage(cat, s)
  const pct = s.checks_total ? Math.round((s.checks_done / s.checks_total) * 100) : 0
  return (
    <button type="button" className={`ks-card ks-system ${s.status}`} onClick={() => onOpen(s.key)}>
      <span className="ks-system-head">
        <strong>{s.name}</strong>
        <span className={`ks-pill ${s.status}`}>{SYSTEM_STATUS_LABEL[s.status]}</span>
      </span>
      {s.description && <span className="ks-muted">{s.description}</span>}
      <span className="ks-dimstrip" aria-label={`${cov.covered} of ${cov.total} dimensions described`}>
        {cat.dimensions.map((d) => (
          <span key={d.key} title={`${d.name}: ${s.elements_per_dimension[d.key] || 0}`}
                style={{ '--c': `var(--ks-${d.layer})` }} className={s.elements_per_dimension[d.key] ? 'on' : ''} />
        ))}
      </span>
      <span className="ks-meta">
        <span>{cov.covered}/{cov.total} dimensions</span>
        <span>{s.element_count} elements</span>
        <span>{pct}% checklist</span>
      </span>
    </button>
  )
}

export default function SystemsPage({ cat, systems, onOpen, onCreated }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('product')
  const [error, setError] = useState('')

  async function create(e) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const s = await api.post('/api/keelson/systems', { name: name.trim(), kind })
      setName('')
      onCreated(s.key)
    } catch (err) {
      setError(err.message)
    }
  }

  const done = systems.reduce((a, s) => a + s.checks_done, 0)
  const total = systems.reduce((a, s) => a + s.checks_total, 0)
  return (
    <div className="ks-page">
      <section className="ks-intro">
        <h1>Systems</h1>
        <p className="ks-muted">
          Each system is measured against the same {cat.dimensions.length} dimensions, from product and code to people and
          finance. The strip on each card shows which dimensions are described; the checklist tracks setting up, maintaining
          and evolving it.
        </p>
        <div className="ks-stats">
          <span><b>{systems.length}</b> systems</span>
          <span><b>{systems.reduce((a, s) => a + s.element_count, 0)}</b> elements</span>
          <span><b>{total ? Math.round((done / total) * 100) : 0}%</b> of all checklists done</span>
        </div>
      </section>

      {GROUPS.map(([k, label]) => {
        const list = systems.filter((s) => s.kind === k)
        if (!list.length) return null
        return (
          <section key={k} className="ks-section">
            <h2>{label}</h2>
            <div className="ks-grid">{list.map((s) => <SystemCard key={s.id} cat={cat} s={s} onOpen={onOpen} />)}</div>
          </section>
        )
      })}

      <section className="ks-section">
        <h2>Add a system</h2>
        <p className="ks-muted">A new system starts with a product element and the full checklist for every dimension.</p>
        <form className="ks-row" onSubmit={create}>
          <input id="new-system-name" placeholder="e.g. Invoice portal" value={name} onChange={(e) => setName(e.target.value)} aria-label="System name" />
          <select id="new-system-kind" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind">
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="ks-btn" type="submit">Add system</button>
        </form>
        {error && <p className="ks-error">{error}</p>}
      </section>
    </div>
  )
}
