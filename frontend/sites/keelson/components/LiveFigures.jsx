import { fmtDate } from '../model.js'

const ORDER = ['idea', 'analyzed', 'pick_up', 'in_progress', 'ready', 'on_acc', 'deploying', 'done']

// Read-only figures that come straight from the HomePlatform roadmap and changelog.
export default function LiveFigures({ live }) {
  const { roadmap, releases } = live
  const statuses = ORDER.filter((s) => roadmap.by_status[s]).concat(Object.keys(roadmap.by_status).filter((s) => !ORDER.includes(s)))
  return (
    <section className="ks-live">
      <div>
        <h3>Roadmap</h3>
        {roadmap.total ? (
          <>
            <p><b className="ks-big">{roadmap.open}</b> open of {roadmap.total} items</p>
            <div className="ks-chips">
              {statuses.map((s) => <span key={s} className="ks-chip mono">{s.replace('_', ' ')} {roadmap.by_status[s]}</span>)}
            </div>
          </>
        ) : <p className="ks-muted">No roadmap items for this system yet.</p>}
      </div>
      <div>
        <h3>Latest releases</h3>
        {releases.length ? (
          <ul className="ks-releases">
            {releases.map((r) => (
              <li key={`${r.version}-${r.released_at}`}>
                <span className="mono">v{r.version}</span><span>{r.title}</span><span className="ks-muted">{fmtDate(r.released_at)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="ks-muted">No changelog entries yet.</p>}
      </div>
    </section>
  )
}
