/* ── Gedeelde helpers voor de Databronnen & API's-pagina ────────────────── */

export const VERDICT_STYLE = {
  yes:     { label: 'Ja — direct',      color: '#16a085', bg: '#16a08518' },
  partial: { label: 'Deels',            color: '#c8961a', bg: '#c8961a18' },
  no:      { label: 'Nee',              color: '#c0392b', bg: '#c0392b18' },
};

export function VerdictBadge({ verdict }) {
  const v = VERDICT_STYLE[verdict];
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, color: v.color, background: v.bg,
      border: `1px solid ${v.color}55`, borderRadius: '4px', padding: '1px 7px',
      whiteSpace: 'nowrap', justifySelf: 'start',
    }}>
      {v.label}
    </span>
  );
}

export function SubHeader({ label }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: 'var(--color-text-light)', margin: '20px 0 8px',
    }}>{label}</div>
  );
}

export function ColHeader({ cols }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1.6fr 2fr 1.3fr 1fr', gap: '10px',
      padding: '4px 0 6px', borderBottom: '1px solid var(--color-border)',
    }}>
      {cols.map((h, i) => (
        <span key={i} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-light)' }}>{h}</span>
      ))}
    </div>
  );
}

export function SourceRow({ row }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1.6fr 2fr 1.3fr 1fr', gap: '10px',
      padding: '8px 0', borderBottom: '1px solid var(--color-border)', alignItems: 'baseline',
    }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>{row.source}</span>
      <div>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{row.purpose}</span>
        <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '2px' }}>{row.note}</div>
      </div>
      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-light)', overflowWrap: 'anywhere' }}>{row.file}</span>
      <VerdictBadge verdict={row.verdict} />
    </div>
  );
}

export function SectionCard({ title, subtitle, children }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginTop: '16px',
    }}>
      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: subtitle ? '4px' : '16px' }}>{title}</div>
      {subtitle && <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>{subtitle}</p>}
      {children}
    </div>
  );
}

export function GroupedTable({ groups, cols }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '20px 24px',
    }}>
      <ColHeader cols={cols} />
      {groups.map((group) => (
        <div key={group.title}>
          <SubHeader label={group.title} />
          {group.rows.map((row, i) => (
            <SourceRow key={i} row={row} />
          ))}
        </div>
      ))}
    </div>
  );
}
