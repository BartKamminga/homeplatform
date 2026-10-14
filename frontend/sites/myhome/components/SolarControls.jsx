import { panelWatt } from '../model.js'

// Zonnepaneel in het apparaatpaneel: vorm/draaiing, en de koppeling paneel <-> omvormer controleren of wisselen.
// Wisselen ruilt alleen de plek (positie, verdieping, ruimte) van twee panelen; de omvormers zelf blijven wie ze zijn.
const serialOf = (d) => (d.meta?.entities || []).find((e) => e.startsWith('sensor.inverter_'))?.replace('sensor.inverter_', '')

export default function SolarControls({ home, device, devices, live, patch, patchOther }) {
  const meta = device.meta || {}
  const panel = meta.panel || {}
  const calib = home.meta?.solar?.calib
  const serial = serialOf(device)
  const others = devices.filter((d) => d.kind === 'solar_panel' && d.id !== device.id && d.meta?.position)
  const setPanel = (p) => patch({ meta: { ...meta, panel: { ...panel, ...p } } })

  async function swapWith(otherId) {
    const o = devices.find((d) => d.id === otherId)
    if (!o) return
    const pick = (m) => ({ position: m.position, floor: m.floor, panel: m.panel, ref_wh: m.ref_wh })
    const mine = pick(meta)
    const theirs = pick(o.meta || {})
    await patchOther(o.id, { room_id: device.room_id, meta: { ...o.meta, ...mine } })
    await patch({ room_id: o.room_id, meta: { ...meta, ...theirs } })
  }

  return (
    <div>
      <h3>Solar panel</h3>
      <dl className="mh-dl">
        <dt>Now</dt><dd className="mh-mono">{panelWatt(device, live) != null ? `${Math.round(panelWatt(device, live))} W` : '—'}</dd>
        <dt>Inverter</dt><dd className="mh-mono">{serial || '—'}</dd>
        {meta.ref_wh != null && <><dt>In Enphase app</dt><dd className="mh-mono">{meta.ref_wh} Wh on {calib?.date || 'the reference day'}</dd></>}
        {calib?.wh?.[serial] != null && <><dt>This inverter</dt><dd className="mh-mono">{calib.wh[serial]} Wh (from HA history)</dd></>}
        <dt>Shape</dt>
        <dd className="mh-row">
          <select id={`pnl-or-${device.id}`} value={panel.orientation || 'landscape'} aria-label="Orientation" onChange={(e) => setPanel({ orientation: e.target.value })}>
            <option value="landscape">Landscape</option><option value="portrait">Portrait</option>
          </select>
          <button className="mh-btn ghost" onClick={() => setPanel({ rotation: (panel.rotation || 0) - 5 })}>−5°</button>
          <span className="mh-mono">{panel.rotation || 0}°</span>
          <button className="mh-btn ghost" onClick={() => setPanel({ rotation: (panel.rotation || 0) + 5 })}>+5°</button>
        </dd>
        <dt>Swap place</dt>
        <dd>
          <select id={`pnl-swap-${device.id}`} value="" aria-label="Swap place with" onChange={(e) => e.target.value && swapWith(e.target.value)}>
            <option value="">— swap with another panel —</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {serialOf(o)}{o.meta?.ref_wh != null ? ` · spot of ${o.meta.ref_wh} Wh` : ''}{o.meta?.solar_unsure ? ' · unsure' : ''}
              </option>
            ))}
          </select>
        </dd>
      </dl>
      <label className="mh-row" htmlFor={`pnl-sure-${device.id}`} style={{ marginTop: 6 }}>
        <input id={`pnl-sure-${device.id}`} type="checkbox" checked={!meta.solar_unsure}
          onChange={(e) => patch({ meta: { ...meta, solar_unsure: !e.target.checked } })} />
        This inverter is in the right place
      </label>
    </div>
  )
}
