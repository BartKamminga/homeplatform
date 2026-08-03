const HT_LABEL = { VE: '🏑 Veldhockey', ZA: '🏒 Zaalhockey' }

export default function QueueFilterBar({ qFilter, queue, clubs, showWaiting, onToggleNiveau, onToggleGender, onToggleHt, onToggleAge, onSaveFilter, onSetShowWaiting }) {
  const hasJun = qFilter.categories.includes('Junioren')
  const hasSen = qFilter.categories.includes('Senioren')
  const genderOptions = [...(hasJun ? ['Jongens', 'Meisjes'] : []), ...(hasSen ? ['Heren', 'Dames'] : [])]

  const AGE_RE_G = /[JMjm][OZoz](\d+)-/
  const ageOfG   = sn => { const m = AGE_RE_G.exec(sn || ''); return m ? 'O' + m[1] : null }
  const availAges = hasJun ? [...new Set(
    (queue.poules || []).filter(p => p.has_poule !== false).map(p => ageOfG(p.short_name)).filter(Boolean)
  )].sort((a, b) => parseInt(b.slice(1)) - parseInt(a.slice(1))) : []

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

      {genderOptions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>Geslacht</span>
          {genderOptions.map(g => togBtn(qFilter.genders.includes(g), g, () => onToggleGender(g)))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>Type</span>
        {['VE', 'ZA'].map(ht => togBtn(qFilter.hockey_types.includes(ht), HT_LABEL[ht] || ht, () => onToggleHt(ht)))}
      </div>

      {availAges.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>Leeftijd</span>
          {availAges.map(ag => togBtn(qFilter.age_groups.includes(ag), ag, () => onToggleAge(ag)))}
          {qFilter.age_groups.length > 0 && (
            <button onClick={() => onSaveFilter({ ...qFilter, age_groups: [] })}
              style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)' }}>
              × alles
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>Club</span>
        <select
          value={qFilter.club_external_id || ''}
          onChange={e => onSaveFilter({ ...qFilter, club_external_id: e.target.value || null })}
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'var(--color-surface)', color: 'var(--color-text)', fontFamily: 'inherit',
            border: `1px solid ${qFilter.club_external_id ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
          <option value="">— alle clubs —</option>
          {(() => {
            const idsInQueue = new Set()
            for (const p of (queue.poules || [])) {
              idsInQueue.add(p.club_external_id)
              for (const id of (p.clubs_in_poule || [])) idsInQueue.add(id)
            }
            return clubs
              .filter(c => idsInQueue.has(c.external_id))
              .sort((a, b) => (a.friendly_name || a.name).localeCompare(b.friendly_name || b.name, 'nl'))
              .map(c => <option key={c.external_id} value={c.external_id}>{c.friendly_name || c.name}</option>)
          })()}
        </select>
        {qFilter.club_external_id && (
          <button onClick={() => onSaveFilter({ ...qFilter, club_external_id: null })}
            style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)' }}>
            × wissen
          </button>
        )}
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

      {(qFilter.age_groups.length > 0 || qFilter.club_external_id || qFilter.genders?.length > 0) && (
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          Filter actief — de vanger pakt alleen deze teams op
        </div>
      )}
    </div>
  )
}
