import { Badge, WARN, fmtAgo, labelStyle } from './ui.jsx';

// Cron jobs van de host (crontab.json, elke minuut door services-watcher.sh). De logdatum is informatief:
// scripts als restore en services-watcher schrijven alleen naar hun log als er iets gebeurt.
const STALE_MS = 5 * 60 * 1000;
const scriptName = cmd => (cmd.match(/\/([\w.-]+\.(?:sh|py|ps1))/) || [])[1] || cmd.split(' ')[0];

export default function CronList({ cron }) {
  if (!cron) {
    return <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>No crontab.json - services-watcher.sh not running or not updated on this host</p>;
  }
  const stale = Date.now() - new Date(cron.checked_at) > STALE_MS;
  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        Cron jobs ({cron.jobs.length})
        {stale && <Badge color={WARN} title="services-watcher.sh has not refreshed the crontab for 5+ minutes">stale · {fmtAgo(cron.checked_at)}</Badge>}
      </div>
      {cron.jobs.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>No cron jobs</p>}
      {cron.jobs.map((j, i) => (
        <div key={i} title={j.command}
          style={{ display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr) auto', gap: 8, alignItems: 'baseline', fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{j.schedule}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {scriptName(j.command)}
            {/ (prod|acc)\b/.test(j.command) && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}> {j.command.match(/ (prod|acc)\b/)[1]}</span>}
          </span>
          <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {j.log_mtime ? `log updated ${fmtAgo(new Date(j.log_mtime * 1000).toISOString())}` : 'no log'}
          </span>
        </div>
      ))}
    </div>
  );
}
