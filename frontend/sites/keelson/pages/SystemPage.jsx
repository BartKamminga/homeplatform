import { useCallback, useEffect, useState } from 'react'
import { api } from '@core/api.js'
import { KIND_LABEL, SYSTEM_STATUS_LABEL, coverage } from '../model.js'
import LiveFigures from '../components/LiveFigures.jsx'
import DimensionBlock from '../components/DimensionBlock.jsx'
import ElementDrawer from '../components/ElementDrawer.jsx'

const PHASE_FILTERS = [['all', 'Everything'], ['setup', 'Set up'], ['run', 'Maintain'], ['evolve', 'Evolve']]

export default function SystemPage({ cat, systemId, onChanged, onOpenMap }) {
  const [system, setSystem] = useState(null)
  const [selected, setSelected] = useState(null)
  const [phase, setPhase] = useState('all')
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      setSystem(await api.get(`/api/keelson/systems/${systemId}`))
    } catch (e) {
      setError(e.message)
    }
  }, [systemId])

  useEffect(() => { reload() }, [reload])

  async function afterChange() {
    await reload()
    onChanged()
  }

  async function patchSystem(body) {
    try {
      setSystem(await api.patch(`/api/keelson/systems/${systemId}`, body))
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  if (error && !system) return <div className="ks-page"><p className="ks-error">{error}</p></div>
  if (!system) return <div className="ks-page"><p className="ks-muted">Loading system…</p></div>

  const cov = coverage(cat, system)
  const all = [...system.elements, ...system.linked_elements]
  const element = selected && all.find((e) => e.id === selected)

  return (
    <div className="ks-split">
      <div className="ks-page">
        <section className="ks-intro">
          <div className="ks-crumb"><a href="#systems">Systems</a><span>/</span><span>{KIND_LABEL[system.kind]}</span></div>
          <div className="ks-row ks-title-row">
            <h1>{system.name}</h1>
            <select id="system-status" value={system.status} onChange={(e) => patchSystem({ status: e.target.value })} aria-label="System status">
              {Object.entries(SYSTEM_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button type="button" className="ks-btn ghost" onClick={onOpenMap}>Show on map</button>
          </div>
          {system.description && <p className="ks-muted">{system.description}</p>}
          <div className="ks-stats">
            <span><b>{cov.covered}/{cov.total}</b> dimensions described</span>
            <span><b>{system.element_count}</b> elements</span>
            <span><b>{system.checks_done}/{system.checks_total}</b> checklist items done</span>
            {system.owner && <span>Owner <b>{system.owner}</b></span>}
          </div>
          {error && <p className="ks-error">{error}</p>}
        </section>

        <LiveFigures live={system.live} />

        <div className="ks-row">
          <span className="ks-muted">Checklist focus</span>
          <div className="ks-seg" role="group" aria-label="Checklist focus">
            {PHASE_FILTERS.map(([k, l]) => <button key={k} type="button" aria-pressed={phase === k} onClick={() => setPhase(k)}>{l}</button>)}
          </div>
        </div>

        {cat.layers.map((layer) => (
          <section key={layer.key} className="ks-section">
            <div className="ks-layer-head" style={{ '--c': `var(--ks-${layer.key})` }}>
              <span className="ks-sq" /><h2>{layer.name}</h2><span className="ks-muted">{layer.summary}</span>
            </div>
            <div className="ks-dims">
              {cat.dimensions.filter((d) => d.layer === layer.key).map((d) => (
                <DimensionBlock key={d.key} cat={cat} dim={d} system={system} phase={phase}
                                selected={selected} onSelect={setSelected} onChanged={afterChange} />
              ))}
            </div>
          </section>
        ))}
      </div>
      {element && (
        <ElementDrawer cat={cat} element={element} system={system} onSelect={setSelected}
                       onClose={() => setSelected(null)} onChanged={afterChange} />
      )}
    </div>
  )
}
