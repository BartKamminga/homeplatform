import { useEffect, useState } from 'react'
import { api } from '@core/api.js'

// Live-status per apparaat (meta.live, gevuld door HA-events), elke 4 s opnieuw zolang de pagina zichtbaar is.
export default function useLive(homeId) {
  const [live, setLive] = useState({})
  useEffect(() => {
    let stop = false
    const tick = () => {
      if (document.hidden) return
      api.get(`/api/myhome/homes/${homeId}/live`).then((l) => { if (!stop) setLive(l) }).catch(() => {})
    }
    tick()
    const t = setInterval(tick, 4000)
    return () => { stop = true; clearInterval(t) }
  }, [homeId])
  return live
}
