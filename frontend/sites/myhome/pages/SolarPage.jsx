import useLive from '../useLive.js'
import { allRooms, panelWatt } from '../model.js'
import { panelColor } from '../components/plan/SolarPanelShape.jsx'

// Overzicht zonnepanelen. De panelen zelf zijn apparaten op de verdieping "Dak" (Model > Plan > Dak):
// daar plaats, draai en wissel je ze. Hier: totaal, per dakvlak, per paneel, wat defect of nog onzeker is.
const serialOf = (d) => (d.meta?.entities || []).find((e) => e.startsWith('sensor.inverter_'))?.replace('sensor.inverter_', '')

export default function SolarPage({ home }) {
  const live = useLive(home.id)
  const rooms = allRooms(home)
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]))
  const panels = [...rooms.flatMap((r) => r.devices), ...home.unassigned_devices].filter((d) => d.kind === 'solar_panel')
  const watts = panels.map((d) => panelWatt(d, live))
  const max = Math.max(1, ...watts.filter((w) => w != null))
  const total = watts.reduce((s, w) => s + (w || 0), 0)
  const anyOn = watts.some((w) => (w || 0) > 20)
  const dead = panels.filter((d) => anyOn && (panelWatt(d, live) ?? 0) < 1)
  const unsure = panels.filter((d) => d.meta?.solar_unsure)
  const unplaced = panels.filter((d) => !d.meta?.position)
  const planes = rooms.filter((r) => r.kind === 'roof')
  const byPlane = planes.map((p) => ({ plane: p, list: panels.filter((d) => d.room_id === p.id) }))

  return (
    <div className="mh-page">
      <div>
        <h2>Solar</h2>
        <p className="mh-muted">
          Panels live on the floor <strong>Roof</strong>: go to Model → Plan → Roof to place, turn or swap them.
          Each panel is one micro-inverter; its output comes live from Home Assistant.
        </p>
      </div>
      <div className="mh-stats">
        <div><span className="mh-mono">{Math.round(total)} W</span><small>now</small></div>
        <div><span className="mh-mono">{panels.length}</span><small>panels</small></div>
        <div className={dead.length ? 'bad' : ''}><span className="mh-mono">{dead.length}</span><small>without output</small></div>
        <div className={unsure.length ? 'warn' : ''}><span className="mh-mono">{unsure.length}</span><small>place not sure</small></div>
        <div className={unplaced.length ? 'warn' : ''}><span className="mh-mono">{unplaced.length}</span><small>not on the roof</small></div>
      </div>
      {dead.length > 0 && (
        <p className="mh-banner" style={{ borderRadius: 8 }}>
          No output while the sun is up: {dead.map(serialOf).join(', ')}. Usually a broken micro-inverter; worth a call to the installer.
        </p>
      )}
      {byPlane.map(({ plane, list }) => (
        <section key={plane.id}>
          <h3>{plane.name} · {list.length} panels{plane.meta?.azimuth != null ? ` · facing ${plane.meta.azimuth}°` : ''}{plane.meta?.tilt != null ? ` · tilt ${plane.meta.tilt}°` : ''} · {Math.round(list.reduce((s, d) => s + (panelWatt(d, live) || 0), 0))} W</h3>
          <div className="mh-solar-strip">
            {list.map((d) => {
              const w = panelWatt(d, live)
              return (
                <span key={d.id} className="mh-solar-chip" style={{ background: panelColor(w, max), color: w != null && w / max > 0.55 ? '#1d2629' : '#fff' }}
                  title={`${d.name}${d.meta?.solar_unsure ? ' (place not sure)' : ''}`}>
                  {w != null ? Math.round(w) : '–'}{d.meta?.solar_unsure ? '?' : ''}
                </span>
              )
            })}
          </div>
        </section>
      ))}
      <section>
        <h3>All panels</h3>
        <div className="mh-scroll">
          <table className="mh-table">
            <thead><tr><th>Inverter</th><th>Roof plane</th><th className="num">Now</th><th className="num">Enphase app</th><th className="num">HA history</th><th>Place</th></tr></thead>
            <tbody>
              {panels.slice().sort((a, b) => (panelWatt(b, live) || 0) - (panelWatt(a, live) || 0)).map((d) => {
                const s = serialOf(d)
                const w = panelWatt(d, live)
                return (
                  <tr key={d.id}>
                    <td className="mh-mono">{s}</td>
                    <td>{roomById[d.room_id]?.name || '—'}</td>
                    <td className="num">{w != null ? `${Math.round(w)} W` : '—'}</td>
                    <td className="num">{d.meta?.ref_wh != null ? `${d.meta.ref_wh} Wh` : '—'}</td>
                    <td className="num">{home.meta?.solar?.calib?.wh?.[s] != null ? `${home.meta.solar.calib.wh[s]} Wh` : '—'}</td>
                    <td>{!d.meta?.position ? <span className="mh-pill none">not placed</span> : d.meta?.solar_unsure ? <span className="mh-pill proposed">not sure</span> : <span className="mh-pill linked">ok</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
