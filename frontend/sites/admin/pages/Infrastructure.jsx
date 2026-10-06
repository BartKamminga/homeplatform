import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { api } from '@core/api.js';
import InfraServicesStrip from './InfraServicesStrip.jsx';

// Alle containers hier komen van de docker-socket van de machine die deze
// pagina bedient (infra.py leest de lokale socket) - dus hun URL's wijzen
// altijd naar het eigen LAN-IP van die machine, niet naar een vast IP.
function knownUrls(ownIp) {
  return {
    homeplatform_caddy:       [{ label: ':8080', href: `http://${ownIp}:8080`, cls: 'prod' }, { label: 'webheaven.nl', href: 'https://webheaven.nl', cls: 'green' }],
    homeplatform_caddy_acc:   [{ label: ':8081', href: `http://${ownIp}:8081`, cls: 'acc' }],
    homeplatform_cloudflared: [{ label: 'tunnel → webheaven.nl', href: 'https://webheaven.nl', cls: 'green' }],
    bugsink:                  [{ label: ':8090', href: `http://${ownIp}:8090`, cls: 'ext' }],
    portainer:                [{ label: ':9000', href: `http://${ownIp}:9000`, cls: 'ext' }, { label: ':9443', href: `https://${ownIp}:9443`, cls: 'ext' }],
  };
}

const COCKPIT = { name: 'cockpit', image: 'system service', status: 'running', health: null, ports: [{ public: 9091 }], mounts: [], _cockpit: true };

function envOf(name) {
  if (name.includes('_acc')) return 'acc';
  if (name.startsWith('homeplatform_')) return 'prod';
  return 'ext';
}

export default function Infrastructure() {
  const [data,    setData]    = useState(null);
  const [backups, setBackups] = useState(null);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get('/api/admin/infrastructure').then(setData).catch(e => setError(e.message));
    api.get('/api/admin/backup/daily').then(setBackups).catch(() => {});
  }, []);

  const hw = data?.hardware;
  const machine = data?.machine || {};
  const ownIp   = machine.lan_ip || machine.prod_lan_ip || '';
  // Sinds de cutover: prod op g5, acc + beheertools (o.a. cockpit) op G4. Deze pagina ziet alleen de eigen machine.
  const isProdHost = ownIp && ownIp === machine.prod_lan_ip;
  const otherIp    = isProdHost ? machine.acc_lan_ip : machine.prod_lan_ip;
  const otherAdmin = otherIp ? `http://${otherIp}:${isProdHost ? 8081 : 8080}/admin/infrastructure` : null;
  const all = data?.available ? [...data.containers, ...(isProdHost ? [] : [COCKPIT])] : [];
  const prod  = all.filter(c => envOf(c.name) === 'prod');
  const acc   = all.filter(c => envOf(c.name) === 'acc');
  const ext   = all.filter(c => envOf(c.name) === 'ext' || c._cockpit);

  return (
    <AdminLayout>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Infrastructure</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 24, fontSize: 13 }}>
        {machine.hostname || 'server'} · {ownIp || '…'} · {isProdHost ? 'production' : 'acceptance + management'} · live via Docker socket
      </p>

      {otherAdmin && (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -12, marginBottom: 24 }}>
          This page only shows this machine.{' '}
          {isProdHost ? 'Acceptance and the management tools (Bugsink, Portainer, Cockpit) run on ' : 'Production runs on '}
          <a href={otherAdmin} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>{otherIp} ↗</a>
        </p>
      )}

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}
      {!data && !error && <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>}

      {hw && <HwStrip hw={hw} machine={machine} ownIp={ownIp} />}
      {backups && <BackupStrip backups={backups} />}
      <InfraServicesStrip />

      {!data?.available && data && (
        <div style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 24 }}>
          Docker socket not available — mount <code>/var/run/docker.sock</code> in the backend container.
        </div>
      )}

      {data?.available && (<>
        {prod.length > 0 && (
          <Section title="Production" badge="prod" badgeColor="var(--color-primary)">
            <Grid containers={prod} ownIp={ownIp} />
          </Section>
        )}
        {acc.length > 0 && (
          <Section title="Acceptance" badge="acc" badgeColor="#8b5cf6">
            <Grid containers={acc} ownIp={ownIp} />
          </Section>
        )}
        <Section title="Other services" badge={null}>
          <Grid containers={ext} ownIp={ownIp} />
        </Section>
        <PortTable prodIp={machine.prod_lan_ip} accIp={machine.acc_lan_ip} />
      </>)}
    </AdminLayout>
  );
}

/* ── Hardware strip ── */
function HwStrip({ hw, machine, ownIp }) {
  function fmtUptime(s) {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  const cells = [
    { label: 'Machine', value: machine.hostname || '—' },
    { label: 'CPU', value: `${hw.cpu_percent}%` },
    { label: 'RAM', value: `${hw.memory.used_gb} / ${hw.memory.total_gb} GB (${hw.memory.percent}%)` },
    { label: 'Disk (/)', value: `${hw.disk.used_gb} / ${hw.disk.total_gb} GB (${hw.disk.percent}%)` },
    { label: 'Uptime', value: fmtUptime(hw.uptime_s) },
    { label: 'IP (LAN)', value: ownIp || '—', accent: true },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, background: 'var(--color-border)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
      {cells.map(c => (
        <div key={c.label} style={{ background: 'var(--color-surface)', padding: '12px 18px', flex: '1 1 160px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>{c.label}</div>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: c.accent ? 'var(--color-primary)' : 'var(--color-text)' }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Section ── */
function Section({ title, badge, badgeColor, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{title}</span>
        {badge && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: badgeColor + '22', color: badgeColor, border: `1px solid ${badgeColor}44` }}>{badge}</span>}
        <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
      </div>
      {children}
    </div>
  );
}

/* ── Grid + Card ── */
function Grid({ containers, ownIp }) {
  if (!containers.length) return <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>No containers</p>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
      {containers.map(c => <ContainerCard key={c.name} c={c} ownIp={ownIp} />)}
    </div>
  );
}

function ContainerCard({ c, ownIp }) {
  const env    = envOf(c.name);
  const accent = env === 'prod' ? 'var(--color-primary)' : env === 'acc' ? '#8b5cf6' : 'var(--color-border)';
  const known  = knownUrls(ownIp)[c.name] || [];

  const portUrls = (c.ports || []).filter(p => p.public && !known.find(k => k.label === `:${p.public}`))
    .map(p => ({ label: `:${p.public}→${p.private}/${p.type || 'tcp'}`, href: `http://${ownIp}:${p.public}`, cls: env }));

  const allUrls = [...known, ...portUrls];

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{c.name}</span>
        <HealthBadge status={c.status} health={c.health} />
      </div>

      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 5, padding: '3px 8px', display: 'inline-block', width: 'fit-content' }}>
        {c.image}
      </span>

      {allUrls.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {allUrls.map(u => (
            <a key={u.label} href={u.href} target="_blank" rel="noopener noreferrer" style={urlChipStyle(u.cls)}>{u.label}</a>
          ))}
        </div>
      )}

      {c.mounts?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={labelStyle}>Volumes</span>
          {c.mounts.map((m, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 14px 1fr', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: m.type === 'volume' ? 'var(--color-text-muted)' : 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.source}>{m.source || `(${m.type})`}</span>
              <span style={{ color: 'var(--color-border)', textAlign: 'center' }}>→</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.destination}>{m.destination}</span>
            </div>
          ))}
        </div>
      )}

      {c._cockpit && (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>System service (not Docker) — server management UI</p>
      )}
    </div>
  );
}

function HealthBadge({ status, health }) {
  if (health === 'healthy') return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', fontWeight: 700 }}>healthy</span>;
  if (health === 'unhealthy') return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#dc262622', color: '#dc2626', border: '1px solid #dc262644', fontWeight: 700 }}>unhealthy</span>;
  if (status === 'running') return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', fontWeight: 700 }}>running</span>;
  return null;
}

/* ── Backup status strip ── */
function BackupStrip({ backups }) {
  const latest = backups.backups?.[0];
  const pending = backups.pending_restore;
  const cells = [
    { label: 'Schedule', value: 'Daily 03:00' },
    { label: 'Last backup', value: latest ? latest.date : '—', accent: !!latest },
    { label: 'Size', value: latest ? `${latest.size_mb} MB` : '—' },
    { label: 'Kept', value: `${backups.backups?.length ?? 0} snapshots` },
    { label: 'NAS copy', value: 'nas-backup/database/', note: true },
    { label: 'Restore', value: pending ? `⏳ ${pending}` : '—', warn: !!pending },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, background: 'var(--color-border)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
      {cells.map(c => (
        <div key={c.label} style={{ background: 'var(--color-surface)', padding: '12px 18px', flex: '1 1 140px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>{c.label}</div>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: c.warn ? '#ea580c' : c.accent ? '#22c55e' : c.note ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Port table ── */
function PortTable({ prodIp, accIp }) {
  // Beheertools (Bugsink/Portainer/Cockpit) en sponsordeck blijven bewust op de acc-machine (G4), besluit cutover 06-10.
  const rows = [
    { port: 8080, service: 'HomePlatform prod (Caddy)', url: `http://${prodIp}:8080`, env: 'prod' },
    { port: 8081, service: 'HomePlatform acc (Caddy)', url: `http://${accIp}:8081`, env: 'acc' },
    { port: 8082, service: 'Sponsor deck (mo14.webheaven.nl)', url: `http://${accIp}:8082`, env: 'ext' },
    { port: 8090, service: 'Bugsink (error monitoring)', url: `http://${accIp}:8090`, env: 'ext' },
    { port: 9000, service: 'Portainer', url: `http://${accIp}:9000`, env: 'ext' },
    { port: 9443, service: 'Portainer (HTTPS)', url: `https://${accIp}:9443`, env: 'ext' },
    { port: 9091, service: 'Cockpit (system service)', url: `http://${accIp}:9091`, env: 'ext' },
    { port: '443 / 80', service: 'Cloudflare Tunnel → external (on prod)', url: 'https://webheaven.nl', env: 'green' },
  ];
  const badgeColor = { prod: 'var(--color-primary)', acc: '#8b5cf6', ext: 'var(--color-text-muted)', green: '#22c55e' };
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Port reference</span>
        <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--color-border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-background)' }}>
              {['Port', 'Service', 'URL', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', padding: '8px 14px', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.port} style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.port}</td>
                <td style={{ padding: '10px 14px' }}>{r.service}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{r.url}</a>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: badgeColor[r.env] + '22', color: badgeColor[r.env], border: `1px solid ${badgeColor[r.env]}44`, fontWeight: 700 }}>{r.env}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Helpers ── */
const labelStyle = { fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 2 };

function urlChipStyle(cls) {
  const colors = { prod: 'var(--color-primary)', acc: '#8b5cf6', ext: 'var(--color-text-muted)', green: '#22c55e', int: 'var(--color-text-muted)' };
  const c = colors[cls] || colors.ext;
  return { fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, border: `1px solid ${c}66`, color: c, background: c + '11', textDecoration: 'none', display: 'inline-block' };
}
