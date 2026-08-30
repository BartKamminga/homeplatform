const PHASE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#4a3aa7']

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

// item 1009/1012: seizoensfase-band over de maanden. Fase 2b levert de
// `season_phases`-instelling (nog niet aanwezig in Fase 1) - tot die tijd
// toont dit alleen de maandtelling, met een duidelijke hint dat de fases
// nog ingesteld moeten worden.
export default function JaarView({ data, onSelectMonth }) {
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 3 + i, 1))
  const phases = data.season_phases || []

  function countForMonth(month) {
    let total = 0
    for (const poule of data.poules) {
      for (const m of poule.matches) {
        if (sameMonth(new Date(m.date), month)) total++
      }
    }
    return total
  }

  function phaseForMonth(month) {
    return phases.find(p => month >= new Date(p.start) && month <= new Date(p.end))
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
      {!phases.length && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          Nog geen seizoensfases ingesteld — alleen het aantal wedstrijden per maand wordt getoond.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
        {months.map((month, i) => {
          const phase = phaseForMonth(month)
          const color = phase ? PHASE_COLORS[phases.indexOf(phase) % PHASE_COLORS.length] : 'var(--color-border)'
          const count = countForMonth(month)
          return (
            <div key={i} onClick={() => onSelectMonth(month)} style={{ cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                {month.toLocaleDateString('nl-NL', { month: 'short' })}
              </div>
              <div style={{ height: 8, borderRadius: 4, background: color, opacity: phase ? 1 : 0.3 }} />
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 4 }}>{count || ''}</div>
            </div>
          )
        })}
      </div>
      {!!phases.length && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14, fontSize: 10, color: 'var(--color-text-muted)' }}>
          {phases.map((p, i) => (
            <span key={p.id}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: PHASE_COLORS[i % PHASE_COLORS.length], marginRight: 4 }} />
              {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
