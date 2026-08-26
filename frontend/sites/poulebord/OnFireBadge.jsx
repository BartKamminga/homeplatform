// item 965: klein, herbruikbaar "on fire"-icoon voor een team met een lopende
// winstreak - gevoed door de backend (services/hockey_query_scope.py::
// compute_win_streaks), niet client-side herberekend. Zelfde plek/patroon als
// het 💬-AI-notitie-icoon in RankRow.jsx::TeamName (icoon + tooltip).

export const ON_FIRE_THRESHOLD = 3

export function OnFireBadge({ streak, threshold = ON_FIRE_THRESHOLD }) {
  if (!streak || streak < threshold) return null
  return (
    <span title={`${streak}x op rij gewonnen`} style={{ marginLeft: 4, fontSize: 10, cursor: 'help' }}>
      🔥
    </span>
  )
}
