import { CONNECTION_STATUS } from '../model.js'

// Altijd zichtbaar paneel: bronbestanden, koppelingen en overige databronnen van het huis.
export default function SourcesPanel({ home, sources }) {
  const connections = home?.meta?.connections || []
  const dataSources = home?.meta?.data_sources || []
  const devices = home ? home.device_count : 0

  return (
    <aside className="mh-side" aria-label="Sources and connections">
      <section>
        <h3>Source files</h3>
        {sources.length ? (
          <div className="mh-thumbs">
            {sources.map((s) => (
              <a key={s.id} href={s.url} target="_blank" rel="noreferrer" title={s.title}>
                <img src={s.url} alt={s.title} loading="lazy" />
                <span>{s.title}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="mh-muted">No drawings or photos yet. Add them under Inputs.</p>
        )}
      </section>

      <section>
        <h3>Connections</h3>
        {connections.length ? (
          <ul className="mh-list">
            {connections.map((c, i) => (
              <li key={i}>
                <span className="mh-row" style={{ justifyContent: 'space-between' }}>
                  <strong>{c.name}</strong>
                  <span className={`mh-pill ${c.status || 'planned'}`}>{CONNECTION_STATUS[c.status] || c.status}</span>
                </span>
                {c.detail && <span className="mh-muted">{c.detail}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mh-muted">No connections yet (Home Assistant, Hue, tado, ...).</p>
        )}
        <p className="mh-muted" style={{ marginTop: 8 }}>{devices} device{devices === 1 ? '' : 's'} registered</p>
      </section>

      <section>
        <h3>Other data sources</h3>
        {dataSources.length ? (
          <ul className="mh-list">
            {dataSources.map((d, i) => (
              <li key={i}>
                {d.url ? <a href={d.url} target="_blank" rel="noreferrer">{d.name}</a> : <strong>{d.name}</strong>}
                {d.detail && <span className="mh-muted">{d.detail}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mh-muted">None yet.</p>
        )}
      </section>
    </aside>
  )
}
