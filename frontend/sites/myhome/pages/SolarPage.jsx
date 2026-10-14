import { useState } from 'react'
import { api } from '@core/api.js'
import useLive from '../useLive.js'
import { allRooms } from '../model.js'
import SolarRoof from '../components/solar/SolarRoof.jsx'
import { arrayPanels, inverterIndex, newArrayId } from '../components/solar/solar.js'

// Zonnepanelen inregelen: velden op het dak, elk paneel aan zijn micro-omvormer, live vermogen per paneel.
export default function SolarPage({ home, onHomeChange }) {
  const live = useLive(home.id)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const solar = home.meta?.solar || { arrays: [], panels: {} }
  const devices = [...allRooms(home).flatMap((r) => r.devices), ...home.unassigned_devices]
  const inverters = inverterIndex(devices, live)
  const serials = Object.keys(inverters).sort()
  const panels = (solar.arrays || []).flatMap(arrayPanels)
  const linked = panels.filter((p) => solar.panels?.[p.key]?.serial)
  const used = new Set(linked.map((p) => solar.panels[p.key].serial))
  const totalW = Object.values(inverters).reduce((s, i) => s + (i.watt || 0), 0)
  const kwp = (solar.arrays || []).reduce((s, a) => s + a.rows * a.cols * (a.wp || 0), 0) / 1000
  const anyOn = Object.values(inverters).some((i) => (i.watt || 0) > 20)
  const dead = Object.entries(inverters).filter(([, i]) => anyOn && (i.watt ?? 0) < 1).map(([s]) => s)

  async function save(next) {
    setError('')
    try {
      onHomeChange(await api.patch(`/api/myhome/homes/${home.id}`, { meta: { ...home.meta, solar: next } }))
    } catch (e) { setError(e.message) }
  }
  const setArray = (id, patch) => save({ ...solar, arrays: solar.arrays.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
  const setPanel = (key, patch) => save({ ...solar, panels: { ...solar.panels, [key]: { ...(solar.panels?.[key] || {}), ...patch } } })
  const addArray = () => {
    const top = home.floors[home.floors.length - 1]
    const pts = top.rooms.flatMap((r) => r.polygon || [])
    const x = pts.length ? Math.min(...pts.map((p) => p[0])) + 0.5 : 0
    const z = pts.length ? Math.min(...pts.map((p) => p[1])) + 0.5 : 0
    const a = { id: newArrayId(), name: `Field ${(solar.arrays || []).length + 1}`, x, z, rotation: 0, orientation: 'portrait',
      rows: 2, cols: 3, panel_w: 1.0, panel_h: 1.7, wp: 330, azimuth: null, tilt: null }
    save({ ...solar, arrays: [...(solar.arrays || []), a] })
    setSelected({ array: a.id })
  }

  const arr = solar.arrays?.find((a) => a.id === selected?.array)
  const pinfo = selected?.panel ? solar.panels?.[selected.panel] || {} : null
  // Suggesties: omvormers met een opbrengst (calibratie) die het dichtst bij de Wh uit de Enphase-app ligt.
  const calib = solar.calib?.wh || {}
  const scale = (() => {
    const refs = Object.values(solar.panels || {}).filter((p) => p.ref_wh && p.serial && calib[p.serial])
    const a = refs.reduce((s, p) => s + p.ref_wh, 0)
    const b = refs.reduce((s, p) => s + calib[p.serial], 0)
    return a && b ? a / b : 1
  })()
  const suggestions = pinfo?.ref_wh
    ? serials.filter((s) => calib[s] != null).sort((x, y) => Math.abs(calib[x] * scale - pinfo.ref_wh) - Math.abs(calib[y] * scale - pinfo.ref_wh))
    : serials

  return (
    <div className="mh-solar-page">
      <div className="mh-viewer-controls">
        <span><strong>{Math.round(totalW)} W</strong> now</span>
        <span>{panels.length} panels{kwp ? ` · ${kwp.toFixed(2)} kWp` : ''}</span>
        <span>{linked.length} of {panels.length} linked to an inverter</span>
        {dead.length > 0 && <span className="mh-pill none">{dead.length} inverter{dead.length > 1 ? 's' : ''} without output: {dead.join(', ')}</span>}
        <span className="mh-spacer" />
        <button className="mh-btn" onClick={addArray}>Add panel field</button>
      </div>
      {error && <p className="mh-error" style={{ padding: '6px 16px' }}>{error}</p>}
      <div className="mh-stage">
        <div className="mh-plan-wrap">
          <SolarRoof home={home} solar={solar} inverters={inverters} selected={selected} onSelect={setSelected}
            onMove={(id, [x, z]) => setArray(id, { x, z })} />
        </div>

        {arr && !pinfo && (
          <div className="mh-room-card">
            <div className="mh-row" style={{ justifyContent: 'space-between' }}>
              <input id={`arr-name-${arr.id}`} className="mh-title-input" defaultValue={arr.name} key={arr.id + arr.name} aria-label="Field name"
                onBlur={(e) => e.target.value.trim() && e.target.value !== arr.name && setArray(arr.id, { name: e.target.value.trim() })} />
              <button className="mh-btn ghost" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>
            <dl className="mh-dl">
              {[['rows', 'Rows'], ['cols', 'Columns'], ['wp', 'Watt-peak per panel'], ['azimuth', 'Azimuth (°, 180 = south)'], ['tilt', 'Tilt (°)']].map(([k, label]) => (
                <FieldNum key={k} id={`arr-${k}-${arr.id}`} label={label} value={arr[k]} onSave={(v) => setArray(arr.id, { [k]: v })} />
              ))}
              <dt>Panels</dt>
              <dd>
                <select id={`arr-or-${arr.id}`} value={arr.orientation} aria-label="Orientation" onChange={(e) => setArray(arr.id, { orientation: e.target.value })}>
                  <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
                </select>
              </dd>
              <dt>Rotation</dt>
              <dd className="mh-row">
                <button className="mh-btn ghost" onClick={() => setArray(arr.id, { rotation: (arr.rotation || 0) - 5 })}>−5°</button>
                <span className="mh-mono">{arr.rotation || 0}°</span>
                <button className="mh-btn ghost" onClick={() => setArray(arr.id, { rotation: (arr.rotation || 0) + 5 })}>+5°</button>
              </dd>
            </dl>
            <p className="mh-muted">Drag the field to its place on the roof. Click a panel to link its inverter.</p>
            <button className="mh-btn ghost" onClick={() => {
              const keep = Object.fromEntries(Object.entries(solar.panels || {}).filter(([k]) => !k.startsWith(`${arr.id}:`)))
              save({ ...solar, arrays: solar.arrays.filter((a) => a.id !== arr.id), panels: keep }); setSelected(null)
            }}>Delete field</button>
          </div>
        )}

        {pinfo && (
          <div className="mh-room-card">
            <div className="mh-row" style={{ justifyContent: 'space-between' }}>
              <div><h3 style={{ margin: 0 }}>{arr?.name}</h3><h2>Panel {selected.panel.split(':').slice(1).map((n) => Number(n) + 1).join(' · ')}</h2></div>
              <button className="mh-btn ghost" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>
            <dl className="mh-dl">
              <dt>Inverter</dt>
              <dd>
                <select id="panel-serial" value={pinfo.serial || ''} aria-label="Inverter" onChange={(e) => setPanel(selected.panel, { serial: e.target.value || null, unsure: false })}>
                  <option value="">— not linked —</option>
                  {suggestions.map((s) => (
                    <option key={s} value={s}>
                      {s}{inverters[s]?.watt != null ? ` · ${Math.round(inverters[s].watt)} W` : ''}{calib[s] != null ? ` · ~${Math.round(calib[s] * scale)} Wh` : ''}{used.has(s) && s !== pinfo.serial ? ' (in use)' : ''}
                    </option>
                  ))}
                </select>
              </dd>
              <dt>Now</dt><dd className="mh-mono">{pinfo.serial && inverters[pinfo.serial]?.watt != null ? `${Math.round(inverters[pinfo.serial].watt)} W` : '—'}</dd>
              <FieldNum id="panel-ref" label="Wh in Enphase app" value={pinfo.ref_wh} onSave={(v) => setPanel(selected.panel, { ref_wh: v })} />
            </dl>
            {pinfo.unsure && <p className="mh-diff">Not sure yet: two inverters had the same output on the reference day.</p>}
            {pinfo.ref_wh && calib && Object.keys(calib).length > 0 && (
              <p className="mh-muted">The list is sorted by how close each inverter's output on {solar.calib.date} is to {pinfo.ref_wh} Wh.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FieldNum({ id, label, value, onSave }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <input id={id} type="number" defaultValue={value ?? ''} key={`${id}-${value}`} style={{ width: 100 }} aria-label={label}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onBlur={(e) => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== (value ?? null)) onSave(v) }} />
      </dd>
    </>
  )
}
