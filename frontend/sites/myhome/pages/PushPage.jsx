import { useCallback, useEffect, useState } from 'react'
import { api } from '@core/api.js'

const GROUPS = [
  ['rename_area', 'Home Assistant areas', 'The HA area gets the name of the room in MyHome.'],
  ['move_device', 'Devices to another area', 'The device moves to the HA area of its room in MyHome.'],
  ['rename_device', 'Device names', 'Hue devices are renamed on the Hue bridge (so the Hue app matches too); others in Home Assistant.'],
]
const keyOf = (c) => `${c.kind}|${c.target}`
// Pushen naar HA staat bewust uit (besluit 14-10: eerst het huis inregelen). De lijst helpt wel bij het inregelen.
const PUSH_ENABLED = false

// Verschillen tussen MyHome en HA kiezen en versturen; de applier in HA voert ze uit en meldt terug.
export default function PushPage({ home, onReload }) {
  const [changes, setChanges] = useState(null)
  const [jobs, setJobs] = useState([])
  const [picked, setPicked] = useState(new Set())
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const load = useCallback(async () => {
    try {
      const [c, j] = await Promise.all([
        api.get(`/api/myhome/homes/${home.id}/changes`),
        api.get(`/api/myhome/homes/${home.id}/push`),
      ])
      setChanges(c)
      setJobs(j)
    } catch (e) { setError(e.message) }
  }, [home.id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!jobs.some((j) => j.status === 'pending')) return undefined
    const t = setInterval(load, 5000)   // de applier in HA kijkt elke 30 s; resultaten verschijnen vanzelf
    return () => clearInterval(t)
  }, [jobs, load])

  const toggle = (c) => {
    const next = new Set(picked)
    next.has(keyOf(c)) ? next.delete(keyOf(c)) : next.add(keyOf(c))
    setPicked(next)
  }
  const pickAll = (kind, on) => {
    const next = new Set(picked)
    changes.filter((c) => c.kind === kind && c.supported && !c.queued).forEach((c) => (on ? next.add(keyOf(c)) : next.delete(keyOf(c))))
    setPicked(next)
  }

  // Andersom: MyHome neemt de HA-versie over, het voorstel vervalt.
  async function keepHa(c) {
    setError(''); setInfo('')
    try {
      setChanges(await api.post(`/api/myhome/homes/${home.id}/changes/keep-ha`, { kind: c.kind, target: c.target }))
      await onReload()
    } catch (e) { setError(e.message) }
  }

  async function push() {
    setError(''); setInfo('')
    const list = changes.filter((c) => picked.has(keyOf(c))).map(({ kind, target, payload }) => ({ kind, target, payload }))
    try {
      const r = await api.post(`/api/myhome/homes/${home.id}/push`, { changes: list })
      setInfo(`${r.queued} change${r.queued === 1 ? '' : 's'} sent. Home Assistant picks them up within half a minute.`)
      setPicked(new Set())
      await load()
      await onReload()
    } catch (e) { setError(e.message) }
  }

  if (!changes) return <div className="mh-page"><p className="mh-muted">{error || 'Comparing with Home Assistant…'}</p></div>

  return (
    <div className="mh-page">
      <div>
        <h2>MyHome vs Home Assistant</h2>
        <p className="mh-muted">
          Every difference is a proposal from MyHome. Keep HA drops the proposal and takes over the Home Assistant version.
          {PUSH_ENABLED
            ? ' Pick what should change; Home Assistant applies it and reports back.'
            : ' Sending changes to Home Assistant comes later; for now this list shows where the two differ.'}
        </p>
      </div>
      {error && <p className="mh-error">{error}</p>}
      {info && <p className="mh-banner" style={{ borderRadius: 8 }}>{info}</p>}

      {GROUPS.map(([kind, title, help]) => {
        const list = changes.filter((c) => c.kind === kind)
        if (!list.length) return null
        const open = list.filter((c) => c.supported && !c.queued)
        return (
          <section key={kind}>
            <div className="mh-row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{title} · {list.length}</h3>
              {PUSH_ENABLED && open.length > 0 && (
                <span className="mh-row">
                  <button className="mh-btn ghost" onClick={() => pickAll(kind, true)}>Select all</button>
                  <button className="mh-btn ghost" onClick={() => pickAll(kind, false)}>None</button>
                </span>
              )}
            </div>
            <p className="mh-muted" style={{ margin: '4px 0 8px' }}>{help}</p>
            <ul className="mh-list mh-changes">
              {list.map((c) => (
                <li key={keyOf(c)}>
                  <label className="mh-row" htmlFor={`chg-${keyOf(c)}`} style={{ flexWrap: 'nowrap', opacity: c.supported ? 1 : 0.55 }}>
                    {PUSH_ENABLED && <input id={`chg-${keyOf(c)}`} type="checkbox" disabled={!c.supported || c.queued}
                      checked={picked.has(keyOf(c))} onChange={() => toggle(c)} />}
                    <span>{c.label}</span>
                    {c.queued && <span className="mh-pill proposed">waiting for HA</span>}
                    {!c.supported && <span className="mh-pill none">not possible from HA</span>}
                    <button className="mh-btn ghost" style={{ marginLeft: 'auto' }} title="Use the Home Assistant version in MyHome"
                      onClick={(e) => { e.preventDefault(); keepHa(c) }}>Keep HA</button>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {!changes.length && <p className="mh-muted">Everything matches Home Assistant.</p>}

      {PUSH_ENABLED && (
        <div className="mh-row">
          <button className="mh-btn" disabled={!picked.size} onClick={push}>Push {picked.size || ''} to Home Assistant</button>
        </div>
      )}

      {PUSH_ENABLED && jobs.length > 0 && (
        <section>
          <h3>History</h3>
          <div className="mh-scroll">
            <table className="mh-table">
              <thead><tr><th>Change</th><th>Status</th><th>Result</th><th>When</th></tr></thead>
              <tbody>
                {jobs.slice(0, 50).map((j) => (
                  <tr key={j.id}>
                    <td>{j.kind.replace('_', ' ')}: {j.payload?.from || '—'} → {j.payload?.to}</td>
                    <td><span className={`mh-pill ${j.status === 'applied' ? 'linked' : j.status === 'pending' ? 'proposed' : 'none'}`}>{j.status}</span></td>
                    <td className="mh-muted">{j.result || ''}</td>
                    <td className="mh-mono">{(j.applied_at || j.created_at).slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
