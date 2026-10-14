import { useEffect, useState } from 'react'
import { DEVICE_KINDS, HAS_PORTS, SymbolIcon } from './plan/symbols.jsx'

// Verbindingen: een apparaat hangt aan een poort/groep van een ander apparaat (meta.link = {to, port}).
// Aansluiting -> patchpaneel poort 12 -> switch poort 5 -> router; stopcontact -> groepenkast groep 3.
const portWord = (kind) => (kind === 'meter' ? 'Group' : 'Port')

export function linkLabel(device, byId) {
  const link = device.meta?.link
  if (!link?.to) return null
  const target = byId[link.to]
  if (!target) return 'connected to a removed device'
  return `${target.name}${link.port ? ` · ${portWord(target.kind).toLowerCase()} ${link.port}` : ''}`
}

export default function ConnectionEditor({ device, devices, onMeta }) {
  const meta = device.meta || {}
  const link = meta.link || {}
  const byId = Object.fromEntries(devices.map((d) => [d.id, d]))
  const targets = devices.filter((d) => HAS_PORTS.includes(d.kind) && d.id !== device.id)
  const target = byId[link.to]
  const [port, setPort] = useState(link.port || '')
  const [ports, setPorts] = useState(meta.ports || '')
  useEffect(() => { setPort(link.port || ''); setPorts(meta.ports || '') }, [device.id, link.port, meta.ports])

  const setLink = (to, p) => onMeta({ ...meta, link: to ? { to, port: p || null } : undefined })
  const children = devices.filter((d) => d.meta?.link?.to === device.id)
  const usedPorts = new Set(children.map((d) => String(d.meta.link.port || '')))
  const takenOnTarget = new Set(devices.filter((d) => d.meta?.link?.to === link.to && d.id !== device.id).map((d) => String(d.meta.link.port || '')))
  const freeOnTarget = target?.meta?.ports
    ? Array.from({ length: Number(target.meta.ports) }, (_, i) => String(i + 1)).filter((p) => !takenOnTarget.has(p))
    : []

  return (
    <div>
      <h3>Connection</h3>
      <dl className="mh-dl">
        <dt>Connected to</dt>
        <dd>
          <select id={`link-${device.id}`} value={link.to || ''} aria-label="Connected to"
            onChange={(e) => setLink(e.target.value, e.target.value === link.to ? link.port : '')}>
            <option value="">— not connected —</option>
            {targets.map((t) => <option key={t.id} value={t.id}>{DEVICE_KINDS[t.kind]?.label}: {t.name}</option>)}
          </select>
        </dd>
        {link.to && (
          <>
            <dt>{portWord(target?.kind)}</dt>
            <dd>
              <input id={`port-${device.id}`} value={port} list={`free-${device.id}`} placeholder={target?.meta?.ports ? `1–${target.meta.ports}` : 'e.g. 12'}
                aria-label={portWord(target?.kind)} style={{ width: 90 }}
                onChange={(e) => setPort(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                onBlur={() => port !== (link.port || '') && setLink(link.to, port.trim())} />
              <datalist id={`free-${device.id}`}>{freeOnTarget.map((p) => <option key={p} value={p} />)}</datalist>
              {port && takenOnTarget.has(String(port)) && <span className="mh-diff"> already in use</span>}
            </dd>
          </>
        )}
      </dl>

      {HAS_PORTS.includes(device.kind) && (
        <div style={{ marginTop: 10 }}>
          <dl className="mh-dl">
            <dt>{portWord(device.kind)}s</dt>
            <dd>
              <input id={`ports-${device.id}`} type="number" min="0" max="96" value={ports} style={{ width: 80 }} aria-label="Number of ports"
                onChange={(e) => setPorts(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                onBlur={() => String(ports) !== String(meta.ports || '') && onMeta({ ...meta, ports: ports ? Number(ports) : undefined })} />
              {meta.ports ? <span className="mh-muted"> {meta.ports - [...usedPorts].filter((p) => p && Number(p) <= meta.ports).length} free</span> : null}
            </dd>
          </dl>
          {(children.length > 0 || meta.ports) && (
            <ul className="mh-ports">
              {(meta.ports ? Array.from({ length: Number(meta.ports) }, (_, i) => String(i + 1)) : []).map((p) => {
                const on = children.filter((c) => String(c.meta.link.port || '') === p)
                return (
                  <li key={p} className={on.length ? '' : 'free'}>
                    <span className="mh-mono">{p}</span>
                    <span>{on.length ? on.map((c) => <span key={c.id} className="mh-row" style={{ gap: 4 }}><SymbolIcon kind={c.kind} size={14} />{c.name}</span>) : 'free'}</span>
                  </li>
                )
              })}
              {children.filter((c) => !c.meta.link.port || (meta.ports && Number(c.meta.link.port) > meta.ports)).map((c) => (
                <li key={c.id}><span className="mh-mono">{c.meta.link.port || '–'}</span><span className="mh-row" style={{ gap: 4 }}><SymbolIcon kind={c.kind} size={14} />{c.name}</span></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
