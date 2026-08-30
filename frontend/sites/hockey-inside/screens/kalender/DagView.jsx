import { useState } from 'react'

// Gevalideerde categorale kleuren (dataviz-skill, validate_palette.js) -
// blauw=wedstrijd, oranje=burst-scanvenster. Los van het thema omdat dit een
// vaste, betekenisvolle 2-kleuren-encodering is, geen merk-kleur.
const COL_MATCH = '#2a78d6'
const COL_BURST = '#eb6834'
const COL_GOOD  = '#0ca30c'

const DAY_START_H = 8
const DAY_END_H   = 22

function fmtTime(d) {
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}
function timeToPct(date) {
  const h = date.getHours() + date.getMinutes() / 60
  return Math.max(0, Math.min(100, ((h - DAY_START_H) / (DAY_END_H - DAY_START_H)) * 100))
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function DagView({ data, date, onDateChange }) {
  const [tooltip, setTooltip] = useState(null)
  const { settings, poules, recent_captures: recentCaptures } = data
  const burstHours = 3 // v1-aanname: geen harde grens in de code zelf, zie item 1012 Fase 2b voor een echte regel

  const rows = poules
    .map(poule => {
      const matches = poule.matches
        .map(m => ({ ...m, dateObj: new Date(m.date) }))
        .filter(m => sameDay(m.dateObj, date))
        .sort((a, b) => a.dateObj - b.dateObj)
      if (!matches.length) return null
      const ends = matches.map(m => new Date(m.dateObj.getTime() + settings.match_duration_min * 60000))
      const burstStart = new Date(Math.min(...ends.map(d => d.getTime())))
      const burstEnd = new Date(burstStart.getTime() + burstHours * 3600000)
      const ticks = []
      for (let t = burstStart.getTime(); t < burstEnd.getTime(); t += settings.active_matchday_interval_min * 60000) {
        ticks.push(new Date(t))
      }
      const captures = (recentCaptures || [])
        .filter(c => c.poule_id === poule.poule_id)
        .map(c => new Date(c.captured_at))
        .filter(d => sameDay(d, date))
      return { poule, matches, burstStart, burstEnd, ticks, captures }
    })
    .filter(Boolean)
    .sort((a, b) => a.matches[0].dateObj - b.matches[0].dateObj)

  function shiftDay(delta) {
    const next = new Date(date)
    next.setDate(next.getDate() + delta)
    onDateChange(next)
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => shiftDay(-1)} style={navBtnStyle}>←</button>
        <strong style={{ fontSize: 13 }}>{date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
        <button onClick={() => shiftDay(1)} style={navBtnStyle}>→</button>
        <button onClick={() => onDateChange(new Date())} style={{ ...navBtnStyle, marginLeft: 'auto' }}>Vandaag</button>
      </div>

      <div style={{ display: 'flex', gap: 16, padding: '8px 14px', fontSize: 11, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 7, background: COL_MATCH, borderRadius: 2, marginRight: 4 }} />Wedstrijd</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 7, background: `repeating-linear-gradient(45deg, ${COL_BURST}, ${COL_BURST} 2px, transparent 2px, transparent 4px)`, border: `1px solid ${COL_BURST}`, borderRadius: 2, marginRight: 4 }} />Burst-scanvenster</span>
        <span style={{ color: COL_GOOD }}>★ Gevolgd team</span>
        <span>⏺ Echte capture</span>
        <span style={{ opacity: 0.5 }}>Grijs = buiten actieve queue-filter</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ padding: '4px 10px', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700 }}>POULE</div>
        <div style={{ position: 'relative', height: 20 }}>
          {Array.from({ length: DAY_END_H - DAY_START_H + 1 }, (_, i) => DAY_START_H + i).map(h => (
            <span key={h} style={{ position: 'absolute', left: `${((h - DAY_START_H) / (DAY_END_H - DAY_START_H)) * 100}%`, fontSize: 9, color: 'var(--color-text-muted)' }}>
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>
      </div>

      {!rows.length && (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
          Geen wedstrijden op deze dag (binnen actieve/gevolgde poules).
        </div>
      )}

      {rows.map(({ poule, matches, burstStart, burstEnd, ticks, captures }) => (
        <div
          key={poule.poule_id}
          style={{
            display: 'grid', gridTemplateColumns: '220px 1fr', borderBottom: '1px solid var(--color-border)',
            opacity: poule.in_active_filter ? 1 : 0.45,
          }}
          title={poule.in_active_filter ? undefined : 'Buiten de actieve queue-filter - wordt niet opgepakt door Ghost/Scout'}
        >
          <div style={{ padding: '6px 10px', fontSize: 11, overflow: 'hidden' }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {poule.followed && <span style={{ color: COL_GOOD, marginRight: 3 }}>★</span>}
              {matches.length === 1 ? `${matches[0].home_team_name} – ${matches[0].away_team_name}` : `${matches.length} wedstrijden`}
            </div>
            <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>
              {poule.poule_name} · {poule.competition_name}
              {poule.is_landelijke && ' · landelijk (12u-cadans)'}
            </div>
          </div>

          <div style={{ position: 'relative', height: 30 }}>
            {Array.from({ length: DAY_END_H - DAY_START_H + 1 }, (_, i) => DAY_START_H + i).map(h => (
              <div key={h} style={{ position: 'absolute', left: `${((h - DAY_START_H) / (DAY_END_H - DAY_START_H)) * 100}%`, top: 0, bottom: 0, borderLeft: '1px solid var(--color-border)' }} />
            ))}

            {matches.map(m => {
              const end = new Date(m.dateObj.getTime() + settings.match_duration_min * 60000)
              const x1 = timeToPct(m.dateObj)
              const x2 = timeToPct(end)
              const isLive = m.status === 'live'
              return (
                <div
                  key={m.match_id}
                  onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: `${m.home_team_name} ${m.home_score ?? ''} - ${m.away_score ?? ''} ${m.away_team_name}\n${fmtTime(m.dateObj)}–${fmtTime(end)} · ${m.status}` })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    position: 'absolute', left: `${x1}%`, width: `${Math.max(0.6, x2 - x1)}%`, top: 7, height: 16,
                    background: COL_MATCH, borderRadius: 3,
                    outline: isLive ? `2px solid ${COL_GOOD}` : 'none',
                  }}
                >
                  {isLive && (
                    <span style={{ position: 'absolute', top: -13, left: 0, fontSize: 8, fontWeight: 700, color: COL_GOOD, whiteSpace: 'nowrap' }}>
                      LIVE {m.home_score}-{m.away_score}
                    </span>
                  )}
                </div>
              )
            })}

            <div
              onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: `Burst-scanvenster\n${fmtTime(burstStart)}–${fmtTime(burstEnd)}\nelke ${settings.active_matchday_interval_min} min` })}
              onMouseLeave={() => setTooltip(null)}
              style={{
                position: 'absolute', left: `${timeToPct(burstStart)}%`, width: `${Math.max(0.6, timeToPct(burstEnd) - timeToPct(burstStart))}%`,
                top: 7, height: 16, borderRadius: 3, border: `1px solid ${COL_BURST}`,
                background: `repeating-linear-gradient(45deg, ${COL_BURST} 0, ${COL_BURST} 3px, color-mix(in srgb, ${COL_BURST} 25%, transparent) 3px, color-mix(in srgb, ${COL_BURST} 25%, transparent) 6px)`,
              }}
            />
            {ticks.map((t, i) => (
              <div key={i} style={{ position: 'absolute', left: `${timeToPct(t)}%`, top: 4, width: 2, height: 22, background: COL_BURST, opacity: 0.55, borderRadius: 1 }} />
            ))}

            {captures.map((c, i) => (
              <div
                key={i}
                onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: `Echte capture\n${fmtTime(c)}` })}
                onMouseLeave={() => setTooltip(null)}
                style={{ position: 'absolute', left: `${timeToPct(c)}%`, top: -2, width: 8, height: 8, borderRadius: '50%', background: 'var(--color-text)', border: '1px solid var(--color-surface)' }}
              />
            ))}
          </div>
        </div>
      ))}

      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 12, top: tooltip.y + 12, zIndex: 50,
          background: 'var(--color-text)', color: 'var(--color-surface)', fontSize: 11,
          padding: '6px 9px', borderRadius: 6, maxWidth: 260, whiteSpace: 'pre-line', pointerEvents: 'none',
        }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}

const navBtnStyle = {
  fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
  border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)',
}
