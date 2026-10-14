import { useEffect, useState } from 'react'
import { api } from '@core/api.js'

// Adds a link from the current element to any element in any system, with verbs suggested by the catalog.
export default function LinkForm({ element, verbsFor, kindName, onLinked }) {
  const [graph, setGraph] = useState(null)
  const [toId, setToId] = useState('')
  const [verb, setVerb] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { api.get('/api/keelson/graph').then(setGraph).catch((e) => setError(e.message)) }, [])

  const systems = Object.fromEntries((graph?.systems || []).map((s) => [s.id, s]))
  const candidates = (graph?.elements || []).filter((c) => c.id !== element.id)
  const target = candidates.find((c) => c.id === toId)
  const verbs = verbsFor(target)
  // Own system first, then the platform, then the rest
  const rank = (c) => (c.system_id === element.system_id ? 0 : systems[c.system_id]?.kind === 'platform' ? 1 : 2)
  const sorted = [...candidates].sort((a, b) => rank(a) - rank(b) || (systems[a.system_id]?.name || '').localeCompare(systems[b.system_id]?.name || '')
    || kindName(a.kind).localeCompare(kindName(b.kind)) || a.name.localeCompare(b.name))
  const groups = []
  sorted.forEach((c) => {
    const name = systems[c.system_id]?.name || 'Other'
    if (groups.at(-1)?.name !== name) groups.push({ name, items: [] })
    groups.at(-1).items.push(c)
  })

  async function submit(e) {
    e.preventDefault()
    if (!toId || !verb.trim()) return
    try {
      await api.post('/api/keelson/links', { from_id: element.id, to_id: toId, verb: verb.trim() })
      setToId('')
      setVerb('')
      setError('')
      onLinked()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="ks-linkform" onSubmit={submit}>
      <span className="ks-muted">Link “{element.name}” to another element</span>
      <input id="link-verb" list="link-verbs" placeholder="Verb, e.g. runs on" value={verb} onChange={(e) => setVerb(e.target.value)} aria-label="Verb" />
      <datalist id="link-verbs">{verbs.map((v) => <option key={v} value={v} />)}</datalist>
      <select id="link-target" value={toId} onChange={(e) => setToId(e.target.value)} aria-label="Linked element" disabled={!graph}>
        <option value="">{graph ? 'Choose an element…' : 'Loading elements…'}</option>
        {groups.map((g) => (
          <optgroup key={g.name} label={g.name}>
            {g.items.map((c) => <option key={c.id} value={c.id}>{kindName(c.kind)}: {c.name}</option>)}
          </optgroup>
        ))}
      </select>
      <button className="ks-btn" type="submit" disabled={!toId || !verb.trim()}>Add link</button>
      {error && <p className="ks-error">{error}</p>}
    </form>
  )
}
