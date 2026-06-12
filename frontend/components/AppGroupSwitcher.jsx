import { useAppGroupPref } from '@core/useAppGroupPref.js'

export default function AppGroupSwitcher({ app, style, labelStyle, selectStyle }) {
  const { groups, current, setGroup, loading } = useAppGroupPref(app)

  if (groups.length === 0) return null

  const displayName = current ?? 'Persoonlijk'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted, var(--muted))', ...labelStyle }}>
          Actieve groep
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
          background: current ? 'var(--color-primary-light, rgba(255,62,108,0.12))' : 'var(--color-surface, var(--bg2))',
          color: current ? 'var(--color-primary, var(--accent))' : 'var(--color-text-muted, var(--muted))',
          border: `1px solid ${current ? 'var(--color-primary, var(--accent))' : 'var(--color-border, var(--border))'}`,
        }}>
          {displayName}
        </span>
      </div>
      <select
        value={current ?? ''}
        onChange={e => setGroup(e.target.value)}
        disabled={loading}
        style={{
          background: 'var(--color-surface, var(--bg2))',
          border: '1px solid var(--color-border, var(--border))',
          color: 'var(--color-text, var(--text))',
          borderRadius: 8, padding: '7px 10px',
          fontSize: 13, cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.6 : 1,
          width: '100%', fontFamily: 'inherit',
          ...selectStyle,
        }}
      >
        <option value="">Persoonlijk</option>
        {groups.map(g => (
          <option key={g.slug} value={g.slug}>{g.slug}</option>
        ))}
      </select>
      {loading && (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted, var(--muted))' }}>Opslaan…</span>
      )}
    </div>
  )
}
