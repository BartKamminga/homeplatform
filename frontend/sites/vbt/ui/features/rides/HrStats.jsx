// Hartslag/vermogen-cijfers van een rit (item 1351): EF, drift (aerobic decoupling) en watt bij vaste hartslag.
// Alleen bij ritten van 30+ min met hartslag; in MY RIDES en op het eindscherm.
import { hrMetricsOf, refHr, wattsAtHr, driftVerdict } from './hrMetrics.js'

export default function HrStats({ ride, stat }) {
  const m = hrMetricsOf(ride)
  if (!m.eligible) return null
  const hr = refHr(), w = wattsAtHr(m, hr), v = driftVerdict(m)
  return (
    <>
      <div title="Efficiency Factor: normalized power / average heart rate. Higher over the weeks = fitter.">
        <b>{m.ef.toFixed(2)}</b><small>EF W/BPM</small></div>
      {m.steady && <div title="Aerobic decoupling: how much power per heartbeat dropped from the first to the second half (after warm-up). Below 5% is good.">
        <b style={{ color: v.color }}>{m.decoupling > 0 ? '+' : ''}{m.decoupling}%</b><small>HR DRIFT</small></div>}
      {w !== null && stat(w + ' W', '@ ' + hr + ' BPM')}
      <div className="hrverdict" style={{ color: v.color }}>{v.text}</div>
    </>
  )
}
