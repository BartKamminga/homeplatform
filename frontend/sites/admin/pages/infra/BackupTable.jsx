import { Badge, cardStyle, labelStyle, fmtAgo, OK, BAD, MUTED } from './ui.jsx';

const th = { ...labelStyle, textAlign: 'left', padding: '7px 10px', borderBottom: '1px solid var(--color-border)' };
const td = { padding: '5px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--color-border)' };

function Mark({ ok, unknown, pending, title }) {
  if (pending) return <span title="Runs at 03:00" style={{ color: MUTED }}>…</span>;
  if (unknown) return <span title={title || 'Unknown - no NAS index yet'} style={{ color: MUTED }}>?</span>;
  return <span title={title} style={{ color: ok ? OK : BAD, fontWeight: 700 }}>{ok ? '✓' : '✗'}</span>;
}

function hostLabel(h) {
  return `${h.hostname} (${h.role === 'production' ? 'prod' : 'acc'})`;
}

export default function BackupTable({ hosts }) {
  const withBackups = hosts.filter(h => h?.available && h.backups);
  if (!withBackups.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const dates = withBackups[0].backups.days.map(d => d.date);

  return (
    <>
      <div style={{ overflowX: 'auto', ...cardStyle, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Date</th>
              {withBackups.map(h => (
                <th key={h.hostname} style={th} colSpan={2}>
                  {hostLabel(h)}
                  <div style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginTop: 2 }}>
                    {h.backups.nas_mounted === false
                      ? <Badge color={BAD}>NAS not mounted at last run</Badge>
                      : <span>NAS checked {fmtAgo(h.backups.nas_checked_at)}</span>}
                  </div>
                </th>
              ))}
            </tr>
            <tr>
              <th style={th} />
              {withBackups.map(h => [
                <th key={h.hostname + 'l'} style={th}>Local</th>,
                <th key={h.hostname + 'n'} style={th}>NAS</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {dates.map(date => (
              <tr key={date}>
                <td style={td}>{date}</td>
                {withBackups.map(h => {
                  const d = h.backups.days.find(x => x.date === date) || {};
                  const pending = date === today && !d.local;
                  return [
                    <td key={h.hostname + 'l'} style={td}>
                      <Mark ok={d.local} pending={pending} />
                      {d.local_mb != null && <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>{d.local_mb} MB</span>}
                    </td>,
                    <td key={h.hostname + 'n'} style={td}>
                      <Mark ok={d.nas} unknown={d.nas == null} pending={pending && !d.nas} />
                    </td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '6px 2px 0' }}>
        Local copies are kept for 14 days; the NAS keeps everything. A ✗ in the NAS column on a day with a local ✓ means the copy never reached the NAS.
      </p>

      {withBackups.some(h => h.backups.predeploy?.length) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginTop: 14 }}>
          {withBackups.filter(h => h.backups.predeploy?.length).map(h => (
            <div key={h.hostname} style={cardStyle}>
              <div style={{ ...labelStyle, marginBottom: 6 }}>Pre-deploy snapshots — {hostLabel(h)}</div>
              {h.backups.predeploy.slice(0, 5).map(p => (
                <div key={p.name} style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)', padding: '2px 0' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>{p.name}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{p.size_mb} MB</span>
                  <span style={{ color: 'var(--color-text-muted)', width: 64, textAlign: 'right' }}>{fmtAgo(p.at)}</span>
                </div>
              ))}
              {h.backups.predeploy.length > 5 && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>+{h.backups.predeploy.length - 5} older (max 10 kept)</div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
