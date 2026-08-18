import { C } from './constants.js'
import { useQueryResult } from './hooks.js'

export const STATS_BY_TEMPLATE = {
  ranking: [
    { key: 'points',        label: 'Punten' },
    { key: 'goal_diff',     label: 'Doelsaldo' },
    { key: 'goals_for',     label: 'Doelpunten voor' },
    { key: 'goals_against', label: 'Doelpunten tegen (minste eerst)' },
    { key: 'won',           label: 'Overwinningen' },
    { key: 'drawn',         label: 'Gelijke spelen' },
    { key: 'streak',        label: 'Winstreak' },
  ],
  round_scorers: [
    { key: 'goals_for',     label: 'Meeste doelpunten' },
    { key: 'goals_against', label: 'Beste verdediging' },
  ],
  round_matches: [
    { key: 'biggest_margin', label: 'Grootste overwinning' },
    { key: 'closest_match',  label: 'Spannendste wedstrijd' },
  ],
  upcoming_matches: [],
  club_ranking: [],
}

// round_scorers heeft bewust geen seizoensvariant: die zou letterlijk
// dezelfde cijfers tonen als de goals_for/goals_against-stat op Ranglijst.
const HAS_ROUND_SEASON_TOGGLE = new Set(['round_matches'])

const selectStyle = {
  background: C.deep, border: `1px solid ${C.border}`, borderRadius: 5,
  color: C.muted, fontSize: 10, padding: '1px 4px', fontFamily: 'inherit',
}

function titleFor(pin) {
  // pin.tag (enkelvoud) is de oude vorm van vóór multi-tag-filtering (item 669).
  const tags = pin.tags ?? (pin.tag ? [pin.tag] : [])
  const tagLabel = tags.length ? tags.join(', ') : 'Alle niveaus'
  if (pin.template === 'ranking') return `Ranglijst · ${tagLabel}`

  if (pin.template === 'upcoming_matches') return `Belangrijke wedstrijd op komst · ${tagLabel}`
  if (pin.template === 'club_ranking') return `Clubranglijst · ${tagLabel}`

  if (pin.template === 'round_scorers') {
    const base = pin.stat === 'goals_against' ? 'Beste verdediging' : 'Topscorers'
    return `${base} laatste ronde · ${tagLabel}`
  }

  const periodLabel = pin.scope === 'season' ? 'dit seizoen' : 'laatste ronde'
  const base = pin.stat === 'closest_match' ? 'Spannendste wedstrijd' : 'Grootste overwinning'
  return `${base} ${periodLabel} · ${tagLabel}`
}

function TeamRows({ rows, stat }) {
  return rows.map(r => (
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
        {r[stat]}
      </span>
    </div>
  ))
}

function MatchRows({ rows }) {
  return rows.map(r => (
    <div key={`${r.rank}-${r.home_team}-${r.away_team}`} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
      borderBottom: `1px solid ${C.border}`, fontSize: 12,
    }}>
      <span style={{ color: C.muted, width: 14, textAlign: 'right', flexShrink: 0 }}>{r.rank}</span>
      <span style={{ flex: 1, minWidth: 0, color: C.chalk,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.home_team} <strong style={{ color: C.gold }}>{r.home_score}-{r.away_score}</strong> {r.away_team}
      </span>
      <span style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>{r.poule_name}</span>
      <span style={{ color: C.gold, fontWeight: 700, flexShrink: 0 }}>Δ{r.margin}</span>
    </div>
  ))
}

function UpcomingMatchRows({ rows }) {
  return rows.map(r => (
    <div key={`${r.rank}-${r.home_team}-${r.away_team}`} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
      borderBottom: `1px solid ${C.border}`, fontSize: 12,
    }}>
      <span style={{ color: C.muted, width: 14, textAlign: 'right', flexShrink: 0 }}>{r.rank}</span>
      <span style={{ flex: 1, minWidth: 0, color: C.chalk,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.home_team} <span style={{ color: C.muted }}>vs</span> {r.away_team}
      </span>
      <span style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>{r.poule_name}</span>
      <span style={{ color: C.gold, fontWeight: 700, flexShrink: 0, fontSize: 9, whiteSpace: 'nowrap',
        textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {r.type}
      </span>
      <span style={{ color: C.muted, fontSize: 10, flexShrink: 0, whiteSpace: 'nowrap' }}>
        #{r.home_position}·{r.home_points}p – #{r.away_position}·{r.away_points}p
      </span>
    </div>
  ))
}

function ClubRankingRows({ rows }) {
  return rows.map(r => (
    <div key={`${r.rank}-${r.club_name}`} style={{
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
        {r.club_name}
      </span>
      <span style={{ color: C.gold, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
        {r.team_count} team{r.team_count !== 1 ? 's' : ''}
      </span>
    </div>
  ))
}

export function QueryCard({ pin: rawPin, pinned, onTogglePin, onUpdate }) {
  // Migratie item 673: win_streak bestond ooit als los template, is nu de
  // streak-stat op ranking. Kaarten die al gepind waren vóór deze wijziging
  // migreren hier stilzwijgend mee.
  const pin = rawPin.template === 'win_streak' ? { ...rawPin, template: 'ranking', stat: 'streak' } : rawPin
  const rows = useQueryResult(pin)
  const statOptions = STATS_BY_TEMPLATE[pin.template] || []

  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
      marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ padding: '6px 8px 6px 10px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.04em', flex: 1 }}>
          {titleFor(pin)}
        </span>
        {HAS_ROUND_SEASON_TOGGLE.has(pin.template) && (
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 5, overflow: 'hidden' }}>
            {[['round', 'Ronde'], ['season', 'Seizoen']].map(([s, label]) => (
              <button key={s} onClick={() => onUpdate({ scope: s })} style={{
                padding: '1px 6px', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
                background: (pin.scope || 'round') === s ? C.gold : 'transparent',
                color: (pin.scope || 'round') === s ? C.deep : C.muted,
              }}>{label}</button>
            ))}
          </div>
        )}
        {statOptions.length > 1 && (
          <select value={pin.stat} onChange={e => onUpdate({ stat: e.target.value })} style={selectStyle}>
            {statOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        )}
        <select value={pin.limit} onChange={e => onUpdate({ limit: parseInt(e.target.value, 10) })} style={selectStyle}>
          {[3, 5, 10].map(n => <option key={n} value={n}>Top {n}</option>)}
        </select>
        <button onClick={onTogglePin} title={pinned ? 'Van board halen' : 'Pinnen op board'} style={{
          background: pinned ? 'rgba(207,159,63,0.15)' : 'transparent',
          border: `1px solid ${pinned ? C.gold : C.border}`, borderRadius: 4,
          padding: '1px 5px', fontSize: 11, color: pinned ? C.gold : C.muted,
          cursor: 'pointer', lineHeight: 1.3, flexShrink: 0,
        }}>📌</button>
      </div>
      {rows === null ? (
        <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 10 }}>Laden…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 10, fontStyle: 'italic' }}>
          Geen data gevonden
        </div>
      ) : pin.template === 'round_matches' ? (
        <div><MatchRows rows={rows} /></div>
      ) : pin.template === 'upcoming_matches' ? (
        <div><UpcomingMatchRows rows={rows} /></div>
      ) : pin.template === 'club_ranking' ? (
        <div><ClubRankingRows rows={rows} /></div>
      ) : (
        <div><TeamRows rows={rows} stat={pin.stat} /></div>
      )}
    </div>
  )
}
