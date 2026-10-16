// Cadanspaneel links in de HUD (item 1347): groot RPM-getal; tijdens een workout-blok met doelcadans
// het doel erbij en de kleur groen (binnen 6 RPM), geel (te laag) of roze (te hoog).
const COLORS = { ok: '#5dff9e', low: '#ffe66d', high: '#ff2e88', free: '#24e8ff' }
const HINT = { ok: 'ON TARGET', low: 'SPIN FASTER', high: 'EASE OFF' }

export default function CadencePanel({ c }) {
  const color = COLORS[c.state]
  return (
    <section className="panel cadpanel">
      <label>CADENCE {c.target && <span id="cadHint" className="chip" style={{ background: color }}>{HINT[c.state]}</span>}</label>
      <div className="big"><span id="cadBig" style={{ color, textShadow: '0 0 18px ' + color }}>{c.rpm}</span><small>RPM</small></div>
      <div className="sub">
        {c.target ? <>TARGET <b id="cadTarget">{c.target}</b> RPM · </> : null}30S AVG <b id="cadAvg">{c.avg}</b>
      </div>
    </section>
  )
}
