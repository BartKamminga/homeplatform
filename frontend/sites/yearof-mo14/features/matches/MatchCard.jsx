import { splitTeam } from './matchCardModel.js'
import './matchCard.css'

// Wedstrijdkaart in drie stijlen (zie docs/yearof-mo14-wedstrijdkop-voorstellen.html):
// A = diagonaal vlak, B = scorebord met kleurband, C = compacte rij met zachte fade.
// model komt uit toCardModel(item). footer = vervangt de locatieregel (bv. in lijsten).
export default function MatchCard({ model, variant = 'A', footer }) {
  const { home, away } = model
  const vars = { '--home': home.color, '--home-ink': home.ink, '--away': away.color, '--away-ink': away.ink }
  const dateWithTime = model.played && model.timeLabel ? `${model.dateLabel} · ${model.timeLabel}` : model.dateLabel
  const center = model.played
    ? <div className="yof-mc-score">{model.scoreHome}<span className="sep"> - </span>{model.scoreAway}</div>
    : model.timeLabel
      ? <div className="yof-mc-score time">{model.timeLabel}</div>
      : <div className="yof-mc-vs">vs</div>
  const foot = footer !== undefined ? footer : model.location ? <span className="yof-mc-loc">📍 {model.location}</span> : null
  const logo = team => (
    <div className="yof-mc-logo">{team.logo ? <img src={team.logo} alt="" /> : <span>{team.name.slice(0, 1)}</span>}</div>
  )
  const name = (team, cls) => <span className={`yof-mc-name ${cls}`}>{splitTeam(team.name)}</span>

  if (variant === 'B') {
    return (
      <div className="yof-mc yof-mc-b" style={vars}>
        <div className="band"><div className="meta"><span><span className="type">{model.kindLabel}</span> · {dateWithTime}</span></div></div>
        <div className="logos">{logo(home)}{logo(away)}</div>
        <div className="board">{name(home, 'home')}{center}{name(away, 'away')}</div>
        {foot && <div className="foot">{foot}</div>}
      </div>
    )
  }
  if (variant === 'C') {
    return (
      <div className="yof-mc yof-mc-c" style={vars}>
        <div className="top">
          <span className="meta type">{model.kindLabel}</span>
          <span className="meta date">{dateWithTime}</span>
        </div>
        <div className="row3">
          <div className="team home">{logo(home)}{name(home, 'home')}</div>
          {center}
          <div className="team away">{logo(away)}{name(away, 'away')}</div>
        </div>
        {foot && <div className="foot">{foot}</div>}
      </div>
    )
  }
  return (
    <div className="yof-mc yof-mc-a" style={vars}>
      <div className="top"><span className="meta"><span className="type">{model.kindLabel}</span> · {model.dateLabel}</span></div>
      <div className="body">
        <div className="team home">{logo(home)}{name(home, 'home')}</div>
        {center}
        <div className="team away">{logo(away)}{name(away, 'away')}</div>
      </div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  )
}
