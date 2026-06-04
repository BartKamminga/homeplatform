const TABS = [
  { key: 'today',    icon: 'ti-calendar-today', label: 'Vandaag' },
  { key: 'routines', icon: 'ti-repeat',          label: 'Routines' },
  { key: 'history',  icon: 'ti-clock-hour-4',    label: 'Geschiedenis' },
  { key: 'settings', icon: 'ti-settings',         label: 'Instellingen' },
]

export default function TabBar({ active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      borderTop: '0.5px solid var(--border)',
      background: 'var(--bg-card)',
      flexShrink: 0,
    }}>
      {TABS.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 3, padding: '10px 4px', border: 'none', background: 'none', cursor: 'pointer',
          color: active === t.key ? 'var(--accent)' : 'var(--text-faint)',
          fontSize: 11, fontFamily: 'var(--font)',
          transition: 'color var(--transition)',
        }}>
          <i className={`ti ${t.icon}`} style={{ fontSize: 22 }} aria-hidden="true" />
          {t.label}
        </button>
      ))}
    </div>
  )
}
