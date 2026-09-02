import { PHASE_COLORS, phaseColor, phaseForMonth } from './seasonPhases.js'

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

// item 1009/1012/1043: seizoensfase-band over de maanden - `season_phases`
// komt van GET /api/hockey/vanger/scan-calendar (services/hockey_vanger_
// settings.py::get_season_phases), gebaseerd op de officiele KNHB-
// speeldagenkalender.
export default function JaarView({ data, onSelectMonth }) {
  const now = new Date()
  // Het hockeyseizoen loopt van eind augustus t/m juli, niet met het
  // kalenderjaar mee - de 12 getoonde maanden volgen daarom het lopende
  // seizoen (aug t/m jul) i.p.v. een rollend venster rond vandaag.
  const seasonStartYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  const months = Array.from({ length: 12 }, (_, i) => new Date(seasonStartYear, 7 + i, 1))
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

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
      {!phases.length && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          Nog geen seizoensfases ingesteld — alleen het aantal wedstrijden per maand wordt getoond.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
        {months.map((month, i) => {
          const phase = phaseForMonth(phases, month)
          const color = phaseColor(phases, phase)
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
