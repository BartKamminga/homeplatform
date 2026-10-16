// Strava-knop bij een afgeronde rit in MY RIDES: uploaden als dat nog niet gebeurd is, anders de activiteit openen.
// Zelfde logica als het eindscherm (strava.js); een rit van de server heeft id i.p.v. serverId.
import { useMemo } from 'react'
import { useStrava, rideButton, buttonLabel } from './strava.js'

export default function StravaRideButton({ ride }) {
  const s = useStrava()                                       // ververst bij busy/klaar
  const r = useMemo(() => Object.assign({}, ride, { serverId: ride.serverId || ride.id }), [ride])
  if (!s.configured) return null
  const st = buttonLabel(r)
  return (
    <button id="rideStrava" className="ghostbtn strava" disabled={!st.enabled} onClick={() => rideButton(r)}>
      &#8679; {st.text}
    </button>
  )
}
