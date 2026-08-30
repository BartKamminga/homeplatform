const COL_GOOD = '#0ca30c'
const COL_SCHEDULED = '#eda100'
const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

// Zie WeekView.jsx voor toelichting - landelijke_cadence bestaat niet meer
// als los reason-type.
const REASON_LABELS = [
  ['matchday_burst',        'Matchday-burst'],
  ['daily_fallback',        'Dagelijkse fallback'],
  ['live_check',            'Live-check'],
  ['manual_weekly',         'Niet-autoscan (wekelijks)'],
  ['unknown_start_recheck', 'Onbekende starttijd'],
  ['new_or_empty',          'Nieuwe/lege poules'],
  ['club_scan',             'Club-scan'],
  ['club_list',             'Clublijst'],
]

function reasonCountsFor(scheduleEntries, inRange) {
  const counts = {}
  for (const e of (scheduleEntries || [])) {
    if (e.status !== 'planned' || !inRange(new Date(e.planned_at))) continue
    counts[e.reason] = (counts[e.reason] || 0) + 1
  }
  return counts
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// item 1009: kalendergrid (weken x dagen), per dagcel een stip/telling voor
// aantal wedstrijden - klik op een dag -> Dag-view.
export default function MaandView({ data, date, onDateChange, onSelectDay }) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7 // maandag = 0
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(gridStart.getDate() - startOffset)

  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(d.getDate() + i)
    return d
  })

  function countFor(day) {
    let total = 0
    let placeholder = 0 // datum bekend, starttijd nog niet (middernacht-placeholder)
    let followed = 0
    for (const poule of data.poules) {
      for (const m of poule.matches) {
        const dt = new Date(m.date)
        if (sameDay(dt, day)) {
          total++
          if (dt.getHours() === 0 && dt.getMinutes() === 0) placeholder++
          if (poule.followed) followed++
        }
      }
    }
    const captures = (data.recent_captures || []).filter(c => sameDay(new Date(c.captured_at), day)).length
    const scheduled = (data.scheduled_cmds || []).filter(c => sameDay(new Date(c.event_at || c.scheduled_at), day))
    const executed = scheduled.filter(c => c.executed).length
    const pending = scheduled.length - executed
    // Scanschema (item 1015): zie WeekView.jsx voor dezelfde toelichting -
    // scheduled_cmds is voor toekomstige dagen altijd leeg, dit is de
    // vooruitblik uit het vooraf berekende schema. Uitgesplitst per reason
    // (hover op de ◇-regel).
    const schemaByReason = reasonCountsFor(data.schedule_entries, d => sameDay(d, day))
    const schemaPlanned = Object.values(schemaByReason).reduce((a, b) => a + b, 0)
    const schemaTitle = REASON_LABELS.filter(([key]) => schemaByReason[key])
      .map(([key, label]) => `${label}: ${schemaByReason[key]}`).join('\n')
    return { total, confirmed: total - placeholder, placeholder, followed, captures, executed, pending, schemaPlanned, schemaTitle }
  }

  const gridEnd = new Date(gridStart)
  gridEnd.setDate(gridEnd.getDate() + 42)
  const reasonCounts = reasonCountsFor(data.schedule_entries, d => d >= gridStart && d < gridEnd)

  function shiftMonth(delta) {
    onDateChange(new Date(year, month + delta, 1))
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => shiftMonth(-1)} style={navBtnStyle}>←</button>
        <strong style={{ fontSize: 13 }}>{date.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</strong>
        <button onClick={() => shiftMonth(1)} style={navBtnStyle}>→</button>
      </div>
      <div style={{ display: 'flex', gap: 14, padding: '6px 14px', fontSize: 10, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        <span>⏺ echte capture</span>
        <span style={{ color: COL_SCHEDULED }}>▲ cmd uitgevoerd</span>
        <span style={{ color: COL_SCHEDULED, opacity: 0.6 }}>△ cmd nog niet uitgevoerd</span>
        <span>◇ gepland in scanschema (nog niet gepromoveerd)</span>
      </div>
      {Object.keys(reasonCounts).length > 0 && (
        <div style={{ display: 'flex', gap: 12, padding: '6px 14px', fontSize: 10, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          {REASON_LABELS.filter(([key]) => reasonCounts[key]).map(([key, label]) => (
            <span key={key}>{label}: <strong>{reasonCounts[key]}</strong></span>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)' }}>
        {WEEKDAYS.map(w => (
          <div key={w} style={{ padding: '4px 6px', fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'center' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((day, i) => {
          const { total, confirmed, placeholder, followed, captures, executed, pending, schemaPlanned, schemaTitle } = countFor(day)
          const inMonth = day.getMonth() === month
          const isToday = sameDay(day, new Date())
          return (
            <div
              key={i}
              onClick={() => onSelectDay(day)}
              style={{
                padding: 6, minHeight: 56, cursor: 'pointer', opacity: inMonth ? 1 : 0.35,
                borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--color-border)' : 'none',
                borderBottom: '1px solid var(--color-border)',
                background: isToday ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: isToday ? 700 : 400 }}>{day.getDate()}</div>
              {total > 0 && (
                <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {followed > 0 && <span style={{ color: COL_GOOD }}>★ </span>}
                  {total} wedstrijd{total === 1 ? '' : 'en'}
                  {!!placeholder && <span style={{ fontStyle: 'italic' }}> ({confirmed} bevestigd)</span>}
                </div>
              )}
              {(!!captures || !!executed || !!pending) && (
                <div style={{ fontSize: 9, color: COL_SCHEDULED, marginTop: 1 }}>
                  {!!captures && <span style={{ color: 'var(--color-text-muted)' }}>⏺{captures}</span>}
                  {!!executed && <span> ▲{executed}</span>}
                  {!!pending && <span style={{ opacity: 0.6 }}> △{pending}</span>}
                </div>
              )}
              {!!schemaPlanned && (
                <div
                  title={schemaTitle}
                  style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 1, cursor: 'help', textDecoration: 'underline dotted' }}
                >
                  ◇{schemaPlanned}
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
