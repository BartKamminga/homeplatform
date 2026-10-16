// Workout-score met uitleg (item 1307): score, hoe die is opgebouwd (vermogen / cadans op doel) en 1-2 tips.
// Op het eindscherm en in MY RIDES; alleen bij workouts waar een review voor is.
const colorOf = s => (s >= 85 ? '#5dff9e' : s >= 65 ? '#ffe66d' : '#ff2e88')

export default function ReviewBox({ review }) {
  if (!review) return null
  return (
    <div className="reviewbox">
      <div className="rvhead">
        <b style={{ color: colorOf(review.score) }}>{review.score}%</b>
        <span>WORKOUT SCORE<small>POWER ON TARGET {review.power}%{review.cadence !== null ? ' · CADENCE ON TARGET ' + review.cadence + '%' : ''}</small></span>
      </div>
      <ul>{review.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  )
}
