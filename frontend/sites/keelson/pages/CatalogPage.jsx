import { useState } from 'react'

// The fixed model: dimensions, element kinds, tooling, way of working and expected relations.
export default function CatalogPage({ cat }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const match = (k) => !q || [k.name, k.key, k.summary, k.practice, ...k.tooling].join(' ').toLowerCase().includes(q)

  return (
    <div className="ks-page">
      <section className="ks-intro">
        <h1>Catalog</h1>
        <p className="ks-muted">
          {cat.dimensions.length} dimensions and {cat.kinds.length} element kinds, each with the tooling that fits and the agreed
          way of working. Systems are measured against this catalog.
        </p>
        <input id="catalog-search" className="ks-search" placeholder="Search kinds, tools or practices…" value={query}
               onChange={(e) => setQuery(e.target.value)} aria-label="Search the catalog" />
      </section>

      {cat.layers.map((layer) => (
        <section key={layer.key} className="ks-section">
          <div className="ks-layer-head" style={{ '--c': `var(--ks-${layer.key})` }}>
            <span className="ks-sq" /><h2>{layer.name}</h2><span className="ks-muted">{layer.summary}</span>
          </div>
          {cat.dimensions.filter((d) => d.layer === layer.key).map((d) => {
            const kinds = (cat.kindsByDim[d.key] || []).filter(match)
            if (!kinds.length) return null
            return (
              <div key={d.key} className="ks-catdim">
                <h3>{d.name}</h3>
                <p className="ks-muted">{d.summary}</p>
                <div className="ks-table-wrap">
                  <table className="ks-table">
                    <thead><tr><th>Kind</th><th>Tooling</th><th>Way of working</th><th>Relations</th></tr></thead>
                    <tbody>
                      {kinds.map((k) => (
                        <tr key={k.key}>
                          <td><strong>{k.name}</strong><div className="ks-muted mono">{k.key}</div><div className="ks-muted">{k.summary}</div></td>
                          <td><div className="ks-chips">{k.tooling.map((t) => <span key={t} className="ks-chip">{t}</span>)}</div></td>
                          <td>{k.practice}</td>
                          <td className="ks-muted">
                            {cat.relations.filter((r) => r.from === k.key).map((r) => (
                              <div key={`${r.to}-${r.verb}`}>{r.verb} <strong>{cat.kinds[r.to]?.name}</strong></div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
