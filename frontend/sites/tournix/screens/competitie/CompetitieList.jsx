export default function CompetitieList({ compsData, onSelect, onRemove, isAdmin }) {
  if (compsData.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px 0', fontSize: 13, fontStyle: 'italic' }}>
        Nog geen competities gekoppeld aan dit toernooi.
        {isAdmin && <><br />Gebruik "+ Koppelen" hierboven om competities toe te voegen.</>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {compsData.map(comp => {
        const poules         = comp.poules ?? []
        const matchesPlayed  = poules.reduce((s, p) => s + (p.matches_played ?? 0), 0)
        const matchesTotal   = poules.reduce((s, p) => s + (p.matches_total  ?? 0), 0)
        const pouleTekst = poules.length > 0 ? poules.map(p => p.name).join(' · ') : 'Geen poules'
        const tags      = comp.fase_tags ?? []
        return (
          <div key={comp.link_id} style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
            <button onClick={() => onSelect(comp)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{comp.hockey_type === 'ZA' ? '🏒' : '🏑'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{comp.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[comp.class_name, comp.district].filter(Boolean).join(' · ')}
                  {(comp.class_name || comp.district) && pouleTekst ? ' — ' : ''}
                  {pouleTekst}
                </div>
                {tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                    {tags.map(t => (
                      <span key={t.id} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'var(--color-primary)', color: '#fff', fontWeight: 600, letterSpacing: '0.02em' }}>{t.name}</span>
                    ))}
                  </div>
                )}
                {matchesTotal > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                    <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--color-success)', width: `${Math.round(matchesPlayed / matchesTotal * 100)}%` }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                      {matchesPlayed}/{matchesTotal}
                    </span>
                    {matchesPlayed > 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, display: 'inline-block' }} />}
                  </div>
                )}
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 14, flexShrink: 0 }}>›</span>
            </button>
            {isAdmin && (
              <button onClick={() => onRemove(comp.link_id, comp.name)} title="Competitie ontkoppelen"
                style={{ padding: '0 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
            )}
          </div>
        )
      })}
    </div>
  )
}
