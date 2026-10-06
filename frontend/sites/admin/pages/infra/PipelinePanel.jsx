import { Badge, Chip, cardStyle, fmtAgo, OK, BAD, WARN, MUTED } from './ui.jsx';

function RunStatus({ run }) {
  if (run.status !== 'completed') return <Badge color={WARN}>{run.status?.replace('_', ' ')}</Badge>;
  const color = run.conclusion === 'success' ? OK : run.conclusion === 'failure' ? BAD : MUTED;
  return <Badge color={color}>{run.conclusion}</Badge>;
}

function duration(run) {
  if (!run.created_at || !run.updated_at || run.status !== 'completed') return null;
  const s = Math.round((new Date(run.updated_at) - new Date(run.created_at)) / 1000);
  return s < 120 ? `${s}s` : `${Math.round(s / 60)}m`;
}

export default function PipelinePanel({ runs, actionsUrl }) {
  if (runs == null) {
    return <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>GitHub API not reachable (rate limit or network) — <a href={actionsUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>open Actions ↗</a></p>;
  }
  if (!runs.length) return <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No runs</p>;
  return (
    <div style={{ ...cardStyle, padding: '6px 16px' }}>
      {runs.map(run => (
        <div key={run.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          <RunStatus run={run} />
          <Chip color={run.branch === 'main' ? 'var(--color-primary)' : '#8b5cf6'}>{run.branch}</Chip>
          <a href={run.url} target="_blank" rel="noopener noreferrer"
            style={{ flex: 1, minWidth: 200, fontSize: 12, color: 'var(--color-text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={run.title}>
            {run.title}
          </a>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-muted)' }}>{run.workflow !== 'Deploy HomePlatform' ? run.workflow + ' · ' : ''}{run.sha}</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 90, textAlign: 'right' }}>
            {fmtAgo(run.created_at)}{duration(run) ? ` · ${duration(run)}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
