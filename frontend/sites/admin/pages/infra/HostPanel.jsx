import ContainerList from './ContainerList.jsx';
import { Badge, StatCells, cardStyle, labelStyle, fmtAgo, fmtUptime, pctColor, ROLE_COLOR, OK, BAD, WARN, MUTED } from './ui.jsx';

const ROLE_LABEL = { production: 'production', acceptance: 'acceptance + management', development: 'development' };

function InfoLine({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '3px 0' }}>
      <span style={{ ...labelStyle, width: 74, flexShrink: 0 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{children}</span>
    </div>
  );
}

function Unavailable({ host, fallbackTitle, adminLink }) {
  return (
    <div style={{ ...cardStyle, borderLeft: `3px solid ${BAD}` }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{fallbackTitle}</div>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
        Not reachable: <span style={{ fontFamily: 'var(--font-mono)' }}>{host?.error || 'unknown error'}</span>
      </p>
      {adminLink && (
        <a href={adminLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--color-primary)' }}>Open its admin directly ↗</a>
      )}
    </div>
  );
}

export default function HostPanel({ host, isSelf, fallbackTitle, adminLink }) {
  if (!host?.available) return <Unavailable host={host} fallbackTitle={fallbackTitle} adminLink={adminLink} />;

  const color = ROLE_COLOR[host.role] || MUTED;
  const hw = host.hardware;
  const runner = host.runner;
  const runnerColor = runner?.status === 'online' ? OK : runner?.status === 'offline' ? BAD : MUTED;
  const runnerStale = runner?.checked_at && Date.now() - new Date(runner.checked_at) > 5 * 60 * 1000;

  return (
    <div style={{ ...cardStyle, borderLeft: `3px solid ${color}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{host.hostname}</span>
        <Badge color={color}>{ROLE_LABEL[host.role] || host.role}</Badge>
        {isSelf && <Badge color={MUTED}>this machine</Badge>}
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-muted)' }}>{host.lan_ip}</span>
      </div>

      {hw && (
        <StatCells cells={[
          { label: 'CPU', value: `${hw.cpu_percent}%`, color: pctColor(hw.cpu_percent) },
          { label: 'RAM', value: `${hw.memory.used_gb}/${hw.memory.total_gb} GB`, color: pctColor(hw.memory.percent) },
          { label: 'Disk (/)', value: `${hw.disk.used_gb}/${hw.disk.total_gb} GB`, color: pctColor(hw.disk.percent) },
          { label: 'Uptime', value: fmtUptime(hw.uptime_s) },
        ]} />
      )}

      <div>
        <InfoLine label="Deploy">
          {host.deploy ? (
            <>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{host.deploy.short}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{fmtAgo(host.deploy.deployed_at)}</span>
            </>
          ) : <span style={{ color: 'var(--color-text-muted)' }}>no deploy info</span>}
        </InfoLine>
        <InfoLine label="Runner">
          <Badge color={runnerColor}>{runner?.status || 'unknown'}</Badge>
          {runnerStale && <Badge color={WARN} title="services-watcher.sh has not reported for 5+ minutes">stale</Badge>}
          {runner?.service && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)' }}>{runner.service}</span>}
        </InfoLine>
        <InfoLine label="Backups">
          <Badge color={host.backup_cron_enabled ? OK : BAD}>cron {host.backup_cron_enabled ? 'enabled' : 'disabled'}</Badge>
        </InfoLine>
      </div>

      <div>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Containers ({host.containers.length})</div>
        {host.docker_available
          ? <ContainerList containers={host.containers} ip={host.lan_ip} />
          : <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Docker socket not available</p>}
      </div>
    </div>
  );
}
