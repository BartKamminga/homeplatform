import { HAS_PORTS, SymbolIcon, DEVICE_KINDS } from '../components/plan/symbols.jsx'
import { allRooms } from '../model.js'

// Boom van verbindingen (meta.link): router -> switch -> patchpaneel -> aansluiting -> apparaat,
// en groepenkast -> groep -> stopcontact. Losse aansluitingen apart, zodat je ziet wat nog te koppelen is.
const NEEDS_LINK = ['network_outlet', 'access_point', 'network_switch', 'patch_panel', 'power_outlet']

export default function NetworkPage({ home }) {
  const rooms = allRooms(home)
  const roomName = Object.fromEntries(rooms.map((r) => [r.id, `${r.floorName} · ${r.name}`]))
  const devices = [...rooms.flatMap((r) => r.devices), ...home.unassigned_devices]
  const byId = Object.fromEntries(devices.map((d) => [d.id, d]))
  const kids = {}
  for (const d of devices) {
    const to = d.meta?.link?.to
    if (to && byId[to]) (kids[to] ||= []).push(d)
  }
  const portSort = (a, b) => String(a.meta.link.port || '').localeCompare(String(b.meta.link.port || ''), undefined, { numeric: true })
  const roots = devices.filter((d) => !(d.meta?.link?.to && byId[d.meta.link.to]) && (kids[d.id] || HAS_PORTS.includes(d.kind)))
  const loose = devices.filter((d) => NEEDS_LINK.includes(d.kind) && !d.meta?.link?.to && !kids[d.id])

  function Node({ d, depth }) {
    const children = (kids[d.id] || []).slice().sort(portSort)
    const used = new Set(children.map((c) => String(c.meta.link.port || '')))
    const free = d.meta?.ports ? Array.from({ length: d.meta.ports }, (_, i) => String(i + 1)).filter((p) => !used.has(p)) : []
    return (
      <li>
        <div className="mh-tree-row">
          {d.meta?.link?.port && <span className="mh-port">{byId[d.meta.link.to]?.kind === 'meter' ? 'group' : 'port'} {d.meta.link.port}</span>}
          <SymbolIcon kind={d.kind} size={18} />
          <strong>{d.name}</strong>
          <span className="mh-muted">{DEVICE_KINDS[d.kind]?.label} · {roomName[d.room_id] || 'no room'}</span>
          {d.meta?.ports ? <span className="mh-muted">· {free.length} of {d.meta.ports} free</span> : null}
        </div>
        {children.length > 0 && (
          <ul className="mh-tree">{children.map((c) => <Node key={c.id} d={c} depth={depth + 1} />)}</ul>
        )}
      </li>
    )
  }

  return (
    <div className="mh-page">
      <div>
        <h2>Network and power</h2>
        <p className="mh-muted">
          How everything is wired: outlets to patch panel and switch ports, sockets to fuse box groups. Set connections in the
          device panel on the plan (Model → click an item → Connection).
        </p>
      </div>
      {roots.length ? (
        <ul className="mh-tree root">{roots.map((d) => <Node key={d.id} d={d} depth={0} />)}</ul>
      ) : (
        <p className="mh-muted">Nothing connected yet. Start by placing a router, switch, patch panel or fuse box on the plan.</p>
      )}
      <section>
        <h3>Not connected yet · {loose.length}</h3>
        <ul className="mh-list">
          {loose.map((d) => (
            <li key={d.id} className="mh-row" style={{ gap: 6 }}>
              <SymbolIcon kind={d.kind} size={16} />{d.name}<span className="mh-muted">· {roomName[d.room_id] || 'no room'}</span>
            </li>
          ))}
          {!loose.length && <li className="mh-muted">Every outlet and network device is connected.</li>}
        </ul>
      </section>
    </div>
  )
}
