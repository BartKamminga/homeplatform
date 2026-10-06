// Gedeelde bouwstenen voor de Infrastructuur-pagina (item 1190).

export const ROLE_COLOR = { production: 'var(--color-primary)', acceptance: '#8b5cf6', development: '#0ea5e9' };
export const OK = '#22c55e';
export const WARN = '#ea580c';
export const BAD = '#dc2626';
export const MUTED = '#94a3b8';

export const labelStyle = { fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)' };
export const cardStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16 };

export function Section({ title, right, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ ...labelStyle, fontSize: 11, letterSpacing: '0.09em' }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        {right}
      </div>
      {children}
    </div>
  );
}

export function Badge({ color, children, title }) {
  return (
    <span title={title} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 700, whiteSpace: 'nowrap', background: color + '22', color, border: `1px solid ${color}44` }}>
      {children}
    </span>
  );
}

export function Chip({ href, color = 'var(--color-text-muted)', children }) {
  const style = { fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, border: `1px solid ${color}66`, color, background: color + '11', textDecoration: 'none', display: 'inline-block' };
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{children}</a> : <span style={style}>{children}</span>;
}

export function StatCells({ cells }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, background: 'var(--color-border)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
      {cells.map(c => (
        <div key={c.label} style={{ background: 'var(--color-surface)', padding: '9px 14px', flex: '1 1 110px' }}>
          <div style={{ ...labelStyle, marginBottom: 3 }}>{c.label}</div>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: c.color || 'var(--color-text)' }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

export function fmtUptime(s) {
  if (s == null) return '—';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function fmtAgo(iso) {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function pctColor(pct) {
  return pct >= 90 ? BAD : pct >= 75 ? WARN : undefined;
}
