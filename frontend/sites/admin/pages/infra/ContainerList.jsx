import { useState } from 'react';
import { Badge, Chip, OK, BAD, MUTED } from './ui.jsx';

// Vaste, leesbare links per bekende container; overige poorten worden als :poort-chip getoond.
function knownUrls(ip) {
  return {
    homeplatform_caddy:       [{ label: ':8080', href: `http://${ip}:8080` }, { label: 'webheaven.nl', href: 'https://webheaven.nl' }],
    homeplatform_caddy_acc:   [{ label: ':8081', href: `http://${ip}:8081` }],
    homeplatform_cloudflared: [{ label: 'tunnel', href: 'https://one.dash.cloudflare.com/networks/tunnels' }],
    bugsink:                  [{ label: ':8090', href: `http://${ip}:8090` }],
    portainer:                [{ label: ':9000', href: `http://${ip}:9000` }],
    'server-mo14-1':          [{ label: 'mo14.webheaven.nl', href: 'https://mo14.webheaven.nl' }],
  };
}

function Health({ c }) {
  if (c.health === 'unhealthy') return <Badge color={BAD}>unhealthy</Badge>;
  if (c.health === 'healthy') return <Badge color={OK}>healthy</Badge>;
  if (c.status === 'running') return <Badge color={OK}>running</Badge>;
  return <Badge color={MUTED}>{c.status || '?'}</Badge>;
}

function shortImage(image) {
  // ghcr.io/bartkamminga/homeplatform-backend:28b073b -> homeplatform-backend
  return image.split('/').pop().split(':')[0];
}

function Row({ c, ip }) {
  const [open, setOpen] = useState(false);
  const known = knownUrls(ip)[c.name] || [];
  const extra = (c.ports || [])
    .filter(p => !known.some(k => k.label === `:${p.public}`))
    .filter((p, i, arr) => arr.findIndex(q => q.public === p.public) === i)
    .map(p => ({ label: `:${p.public}`, href: `http://${ip}:${p.public}` }));
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)', padding: '7px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setOpen(!open)} title="Show volumes"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 11, width: 12 }}>
          {open ? '▾' : '▸'}
        </button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{c.name}</span>
        {c.tag && <Chip>{c.tag}</Chip>}
        <Health c={c} />
        <span style={{ flex: 1 }} />
        {[...known, ...extra].map(u => <Chip key={u.label} href={u.href} color="var(--color-primary)">{u.label}</Chip>)}
      </div>
      {open && (
        <div style={{ marginLeft: 20, marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-muted)' }}>
          <div style={{ marginBottom: 4 }}>{shortImage(c.image)} · {c.status_text}</div>
          {(c.mounts || []).map((m, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 14px 1fr', gap: 4, padding: '2px 0' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.source}>{m.source || `(${m.type})`}</span>
              <span>→</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text)' }} title={m.destination}>
                {m.destination}{m.rw ? '' : ' (ro)'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContainerList({ containers, ip }) {
  if (!containers?.length) return <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No running containers</p>;
  return <div>{containers.map(c => <Row key={c.name} c={c} ip={ip} />)}</div>;
}
