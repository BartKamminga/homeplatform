// Varianten van een workout (item 1305): ORIGINAL / 30 / 45 / 60 / 90 MIN, KORTER en SHUFFLE (andere workout
// met ongeveer dezelfde duur en zwaarte). De gekozen variant wordt getoond en gereden; bij een plan-workout telt
// hij gewoon als die plan-dag.
import { actions } from '../../hooks/useVbt.js'

export default function VariantBar({ wo, shown, onChange }) {
  const V = window.VBT.workoutVariants
  const base = wo, sizes = V.sizes(base)
  if (!sizes.length && wo.free) return null
  const cur = shown.variant || null
  const shorter = V.shorter(shown)
  const shuffle = async () => {
    const lib = await actions().listWorkouts().catch(() => [])
    const alt = V.shuffle(base, lib)
    if (alt) onChange(alt)
    else window.VBT.toast?.('NO SIMILAR WORKOUT FOUND IN THE LIBRARY')
  }
  return (
    <div className="pn-variants">
      {sizes.length > 0 && (
        <span className="pn-viewtoggle">
          <button className={!cur && !shown.swappedFrom ? 'active' : ''} onClick={() => onChange(null)}>ORIGINAL</button>
          {sizes.map(m => <button key={m} className={cur === m ? 'active' : ''} onClick={() => onChange(V.resize(shown.swappedFrom ? shown : base, m))}>{m} MIN</button>)}
        </span>
      )}
      {shorter && <button className="ghostbtn" onClick={() => onChange(shorter)} title="Same workout, one size shorter">&#8681; SHORTER</button>}
      {!window.VBT.ftp.testType(base) && !base.free && <button className="ghostbtn" onClick={shuffle} title="Another workout of about the same length and intensity">&#8644; SHUFFLE</button>}
      {shown.swappedFrom && <small className="hint">INSTEAD OF {shown.swappedFrom.toUpperCase()}</small>}
    </div>
  )
}
