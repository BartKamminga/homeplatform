import { C } from './constants.js'
import { useQueryResult } from './hooks.js'

const STATS = [
  { key: 'points',    label: 'Punten' },
  { key: 'goal_diff', label: 'Doelsaldo' },
  { key: 'goals_for', label: 'Doelpunten voor' },
  { key: 'won',       label: 'Overwinningen' },
]

const selectStyle = {
  background: C.deep, border: `1px solid ${C.border}`, borderRadius: 5,
  color: C.muted, fontSize: 10, padding: '1px 4px', fontFamily: 'inherit',
}

export function QueryCard({ pin, onUpdate, onUnpin }) {
  const rows = useQueryResult(pin)
  const isRanking = pin.template === 'ranking'

  const title = isRanking
    ? `Ranglijst · ${pin.tag || 'Alle niveaus'}`
    : `Topscorers laatste ronde · ${pin.tag || 'Alle niveaus'}`

  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
      marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ padding: '6px 8px 6px 10px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.04em', flex: 1 }}>
          {title}
        </span>
        {isRanking && (
          <select value={pin.stat} onChange={e => onUpdate({ stat: e.target.value })} style={selectStyle}>
            {STATS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        )}
        <select value={pin.limit} onChange={e => onUpdate({ limit: parseInt(e.target.value, 10) })} style={selectStyle}>
          {[3, 5, 10].map(n => <option key={n} value={n}>Top {n}</option>)}
        </select>
        <button onClick={onUnpin} style={{
          background: 'none', border: 'none', padding: 0,
          cursor: 'pointer', color: C.muted, fontSize: 11, lineHeight: 1,
        }}>✕</button>
      </div>
      {rows === null ? (
        <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 10 }}>Laden…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 10, fontStyle: 'italic' }}>
          Geen data gevonden
        </div>
      ) : (
        <div>
          {rows.map(r => (
            <div key={`${r.rank}-${r.team_name}`} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
              borderBottom: `1px solid ${C.border}`, fontSize: 12,
            }}>
              <span style={{ color: C.muted, width: 14, textAlign: 'right', flexShrink: 0 }}>{r.rank}</span>
              {r.club_logo_url && (
                <img src={r.club_logo_url} alt="" style={{
                  width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                }} />
              )}
              <span style={{ flex: 1, minWidth: 0, color: C.chalk,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.team_name}
              </span>
              <span style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>{r.poule_name}</span>
              <span style={{ color: C.gold, fontWeight: 700, flexShrink: 0, minWidth: 18, textAlign: 'right' }}>
                {isRanking ? r[pin.stat] : r.goals}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
