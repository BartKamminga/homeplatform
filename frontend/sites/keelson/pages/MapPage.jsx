import { useEffect, useMemo, useState } from 'react'
import { api } from '@core/api.js'
import { STATUS_LABEL } from '../model.js'
import MapScene from '../components/MapScene.jsx'

// 3D map of one system (plus what it links to) or of all systems together.
export default function MapPage({ cat, systems, systemKey, onPick, onOpen }) {
  const [graph, setGraph] = useState(null)
  const [selected, setSelected] = useState(null)
  const [allLabels, setAllLabels] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { api.get('/api/keelson/graph').then(setGraph).catch((e) => setError(e.message)) }, [])
  useEffect(() => { setSelected(null) }, [systemKey])

  const system = systems.find((s) => s.key === systemKey)
  const view = useMemo(() => {
    if (!graph) return null
    if (!system) return { elements: graph.elements, links: graph.links, focus: null }
    const own = new Set(graph.elements.filter((e) => e.system_id === system.id).map((e) => e.id))
    const links = graph.links.filter((l) => own.has(l.from_id) || own.has(l.to_id))
    const ids = new Set([...own, ...links.flatMap((l) => [l.from_id, l.to_id])])
    return { elements: graph.elements.filter((e) => ids.has(e.id)), links, focus: own }
  }, [graph, system])

  if (error) return <div className="ks-page"><p className="ks-error">{error}</p></div>
  if (!view) return <div className="ks-page"><p className="ks-muted">Loading the map…</p></div>

  const systemsById = Object.fromEntries(graph.systems.map((s) => [s.id, s]))
  const byId = Object.fromEntries(graph.elements.map((e) => [e.id, e]))
  const el = selected && !selected.startsWith('dim:') ? byId[selected] : null
  const dim = selected?.startsWith('dim:') ? cat.dims[selected.slice(4)] : el && cat.dims[el.dimension]
  const kind = el && cat.kinds[el.kind]
  const rels = el ? graph.links.filter((l) => l.from_id === el.id || l.to_id === el.id) : []
  const dimElements = selected?.startsWith('dim:') ? view.elements.filter((e) => e.dimension === dim.key) : []

  return (
    <div className="ks-mapwrap">
      <div className="ks-mapstage">
        <MapScene cat={cat} elements={view.elements} links={view.links} focus={view.focus}
                  selectedId={selected} allLabels={allLabels} onSelect={setSelected} />
        <div className="ks-maptools">
          <select id="map-system" value={systemKey || ''} onChange={(e) => onPick(e.target.value || null)} aria-label="System">
            <option value="">All systems</option>
            {systems.map((s) => <option key={s.id} value={s.key}>{s.name}</option>)}
          </select>
          <button type="button" className="ks-btn ghost" aria-pressed={allLabels} onClick={() => setAllLabels(!allLabels)}>All labels</button>
        </div>
        <span className="ks-maphint">Drag to rotate · scroll to zoom · click a sphere</span>
      </div>

      <aside className="ks-mappanel">
        {!selected && (
          <>
            <h2>{system ? system.name : 'All systems'}</h2>
            <p className="ks-muted">
              Large spheres are dimensions, small ones are elements. Solid means present, translucent partial, wireframe missing.
              {system && ' Elements of other systems appear when this system links to them.'}
            </p>
            <div className="ks-legend">
              {cat.layers.map((l) => <span key={l.key} style={{ '--c': `var(--ks-${l.key})` }}><i />{l.name}</span>)}
            </div>
            <p className="ks-muted">{view.elements.length} elements · {view.links.length} links</p>
            {system && <button type="button" className="ks-btn" onClick={() => onOpen(system.key)}>Open {system.name}</button>}
          </>
        )}
        {dim && !el && (
          <>
            <span className="ks-eyebrow" style={{ color: `var(--ks-${dim.layer})` }}>Dimension</span>
            <h2>{dim.name}</h2>
            <p className="ks-muted">{dim.summary}</p>
            <ul className="ks-rels">
              {dimElements.map((e) => (
                <li key={e.id}><button type="button" className="ks-rel" onClick={() => setSelected(e.id)}>
                  <span className={`ks-dot ${e.status}`} /><span>{e.name} <span className="ks-muted">· {systemsById[e.system_id]?.name}</span></span>
                </button></li>
              ))}
            </ul>
          </>
        )}
        {el && (
          <>
            <span className="ks-eyebrow" style={{ color: `var(--ks-${dim.layer})` }}>{dim.name} · {kind?.name}</span>
            <h2>{el.name}</h2>
            <p className="ks-muted">{systemsById[el.system_id]?.name} · {STATUS_LABEL[el.status]}</p>
            {el.description && <p>{el.description}</p>}
            {kind && <div><h3>Tooling and systems</h3><div className="ks-chips">{kind.tooling.map((t) => <span key={t} className="ks-chip">{t}</span>)}</div></div>}
            {kind && <div><h3>Way of working</h3><p className="ks-practice">{kind.practice}</p></div>}
            <div>
              <h3>Links ({rels.length})</h3>
              <ul className="ks-rels">
                {rels.map((l) => {
                  const out = l.from_id === el.id
                  const other = byId[out ? l.to_id : l.from_id]
                  return (
                    <li key={l.id}><button type="button" className="ks-rel" onClick={() => setSelected(other.id)}>
                      <span className={`ks-dot ${other.status}`} />
                      <span>{out ? <><span className="ks-muted">{l.verb}</span> {other.name}</> : <>{other.name} <span className="ks-muted">{l.verb} this</span></>}</span>
                    </button></li>
                  )
                })}
              </ul>
            </div>
            <button type="button" className="ks-btn" onClick={() => onOpen(systemsById[el.system_id].key)}>Open in {systemsById[el.system_id]?.name}</button>
          </>
        )}
      </aside>
    </div>
  )
}
