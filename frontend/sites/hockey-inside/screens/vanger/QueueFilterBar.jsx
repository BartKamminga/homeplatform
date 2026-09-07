const HT_LABEL = { VE: '🏑 Veldhockey', ZA: '🏒 Zaalhockey' }

// item 1089: Geslacht/Leeftijd/Club-dimensies verwijderd - alleen Niveau/Type
// resteren als queue-filter.
export default function QueueFilterBar({ qFilter, queue, showWaiting, onToggleNiveau, onToggleHt, onSetShowWaiting }) {
  function togBtn(on, label, onClick) {
    return (
      <button key={label} onClick={onClick} style={{
        fontSize: 11, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: on ? 'var(--color-primary)' : 'var(--color-surface)',
        color: on ? '#fff' : 'var(--color-text)', fontWeight: on ? 600 : 400,
      }}>{label}</button>
    )
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎛 Queue filter</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>Niveau</span>
        {['Junioren', 'Senioren'].map(cat => togBtn(qFilter.categories.includes(cat), cat, () => onToggleNiveau(cat)))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>Type</span>
        {['VE', 'ZA'].map(ht => togBtn(qFilter.hockey_types.includes(ht), HT_LABEL[ht] || ht, () => onToggleHt(ht)))}
      </div>

      {queue.waiting > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>Toon</span>
          {togBtn(showWaiting, `⏳ wacht op indeling (${queue.waiting})`, () => {
            const next = !showWaiting
            onSetShowWaiting(next)
            try { localStorage.setItem('disc_show_waiting', String(next)) } catch {}
          })}
        </div>
      )}
    </div>
  )
}
