const COL_GOOD = '#0ca30c'

function startOfWeek(date) {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // maandag = 0
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// item 1009: compacte week-weergave - per dag alleen team-namen + tijd, geen
// volledige tijdlijn-balken (dat is de Dag-view). Klik op een dag -> Dag-view.
export default function WeekView({ data, date, onDateChange, onSelectDay }) {
  const monday = startOfWeek(date)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })

  const matchesByDay = days.map(day => {
    const items = []
    for (const poule of data.poules) {
      for (const m of poule.matches) {
        const dt = new Date(m.date)
        if (sameDay(dt, day)) items.push({ ...m, dateObj: dt, poule })
      }
    }
    items.sort((a, b) => a.dateObj - b.dateObj)
    return items
  })

  function shiftWeek(delta) {
    const next = new Date(monday)
    next.setDate(next.getDate() + delta * 7)
    onDateChange(next)
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => shiftWeek(-1)} style={navBtnStyle}>←</button>
        <strong style={{ fontSize: 13 }}>Week van {monday.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}</strong>
        <button onClick={() => shiftWeek(1)} style={navBtnStyle}>→</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((day, i) => (
          <div
            key={i}
            onClick={() => onSelectDay(day)}
            style={{ padding: 8, borderRight: i < 6 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer', minHeight: 120 }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
              {day.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' })}
            </div>
            {matchesByDay[i].slice(0, 8).map((m, j) => (
              <div key={j} style={{ fontSize: 10, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {m.poule.followed && <span style={{ color: COL_GOOD }}>★</span>}
                {' '}{m.dateObj.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} {m.home_team_name}-{m.away_team_name}
              </div>
            ))}
            {matchesByDay[i].length > 8 && (
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>+{matchesByDay[i].length - 8} meer</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const navBtnStyle = {
  fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
  border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)',
}
