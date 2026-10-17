// Real Ride (prototype): straatfoto van waar je nu bent over het speelveld, met overvloeien naar de volgende
// foto en een lichte zoom (je 'rijdt' de foto in). De HUD blijft erboven. Naamsvermelding: Mapillary, CC BY-SA.
import { useEffect, useState } from 'react'
import { useVbt } from '../hooks/useVbt.js'

export default function RealRideView() {
  const s = useVbt(null, { fast: true })
  const R = window.VBT.realride
  const pos = R && R.active() && ['ride', 'paused', 'countdown', 'confirm'].includes(s.state) ? R.at(s.dist) : null
  const cur = pos && pos.cur
  const [layers, setLayers] = useState([])          // [{id, url}] - laatste = bovenop (fade-in)

  useEffect(() => {
    if (!cur) return
    setLayers(l => (l.length && l[l.length - 1].id === cur.id ? l : l.slice(-1).concat([{ id: cur.id, url: cur.url, by: cur.by }])))
    if (pos.next) { const img = new Image(); img.src = pos.next.url }                 // alvast laden
  }, [cur && cur.id])

  if (!pos) return null
  const zoom = 1 + (pos.frac || 0) * 0.14
  const top = layers[layers.length - 1]
  return (
    <div id="realride" className={pos.gap || !cur ? 'gap' : ''} aria-hidden="true">
      {layers.map((l, i) => (
        <img key={l.id} src={l.url} alt="" className={i === layers.length - 1 ? 'in' : 'out'}
          style={i === layers.length - 1 ? { transform: 'scale(' + zoom.toFixed(3) + ')' } : undefined} />
      ))}
      {(pos.gap || !cur) && <span className="rrnote">NO STREET PHOTOS HERE</span>}
      {top && <span className="rrcredit">Photo: {top.by || 'Mapillary contributor'} · Mapillary · CC BY-SA</span>}
    </div>
  )
}
