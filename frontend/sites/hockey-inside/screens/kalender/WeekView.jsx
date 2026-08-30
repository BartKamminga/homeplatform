const COL_GOOD = '#0ca30c'
const COL_SCHEDULED = '#eda100'

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

// item 1009: compacte week-weergave - alleen aantallen per dag (wedstrijden +
// scan-activiteit), geen losse wedstrijdregels (dat leverde bij drukke dagen
// met honderden placeholder-wedstrijden een onleesbare lijst op). Voor de
// details van 1 dag: klik door naar de Dag-view.
export default function WeekView({ data, date, onDateChange, onSelectDay }) {
  const monday = startOfWeek(date)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })

  const countsByDay = days.map(day => {
    let total = 0
    let followed = 0
    for (const poule of data.poules) {
      for (const m of poule.matches) {
        if (sameDay(new Date(m.date), day)) {
          total++
          if (poule.followed) followed++
        }
      }
    }
    const captures = (data.recent_captures || []).filter(c => sameDay(new Date(c.captured_at), day)).length
    const scheduled = (data.scheduled_cmds || []).filter(c => sameDay(new Date(c.event_at || c.scheduled_at), day))
    const executed = scheduled.filter(c => c.executed).length
    const pending = scheduled.length - executed
    return { total, followed, captures, executed, pending }
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
        {days.map((day, i) => {
          const { total, followed, captures, executed, pending } = countsByDay[i]
          return (
            <div
              key={i}
              onClick={() => onSelectDay(day)}
              style={{ padding: 10, borderRight: i < 6 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer', minHeight: 76 }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                {day.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' })}
              </div>
              <div style={{ fontSize: 11 }}>
                {followed > 0 && <span style={{ color: COL_GOOD }}>★ </span>}
                {total} wedstrijd{total === 1 ? '' : 'en'}
              </div>
              {(!!captures || !!executed || !!pending) && (
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {!!captures && <span>⏺ {captures}</span>}
                  {!!executed && <span style={{ color: COL_SCHEDULED }}> · ▲ {executed}</span>}
                  {!!pending && <span style={{ color: COL_SCHEDULED, opacity: 0.6 }}> · △ {pending}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const navBtnStyle = {
  fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
  border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)',
}
