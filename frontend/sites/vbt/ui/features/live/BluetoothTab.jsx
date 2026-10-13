// BLUETOOTH: status per apparaat, pakketten/s, ouderdom van de laatste data en het volledige BLE-log.
import { useEffect, useRef, useState } from 'react'
import { useVbt, actions } from '../../hooks/useVbt.js'
import { copyText } from '../../common/clipboard.js'

export default function BluetoothTab() {
  const ble = useVbt(s => s.ble)
  const [rate, setRate] = useState(0)
  const prev = useRef({ n: 0, t: performance.now() })
  const logRef = useRef(null)

  // pakketten per seconde uit de teller in de snapshot
  useEffect(() => {
    const id = setInterval(() => {
      const n = window.VBT.ble.live.packets, t = performance.now()
      setRate(Math.round((n - prev.current.n) / ((t - prev.current.t) / 1000) * 10) / 10)
      prev.current = { n, t }
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const log = actions().bleLog()
  useEffect(() => {
    const el = logRef.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 40) el.scrollTop = el.scrollHeight
  })

  if (!ble) return null
  const row = (label, l, ok) => (
    <div className="pn-kv"><span>{label}</span>
      <b className="devstatus" data-status={l.status}>{l.status.toUpperCase()}{l.status === 'connected' && !ok ? ' · NO DATA' : ''}</b></div>
  )
  return (
    <div className="pn-section">
      {row('TRAINER', ble.trainer, ble.trainerOk)}
      {row('HEART RATE', ble.hr, ble.hrOk)}
      <div className="pn-grid">
        <div><small>PACKETS/S</small><b>{rate}</b></div>
        <div><small>LAST DATA</small><b>{ble.dataAge === null ? '-' : ble.dataAge.toFixed(1) + ' s'}</b></div>
        <div><small>PROTOCOL</small><b className="pn-small">{ble.trainer.protocol || '-'}</b></div>
        <div><small>ERG</small><b>{ble.ergCapable ? 'YES' : 'NO'}</b></div>
      </div>
      <div className="pn-buttons"><button className="ghostbtn" onClick={() => copyText(log.join('\n'))}>COPY BLE LOG</button></div>
      <pre className="pn-log" ref={logRef}>{log.join('\n') || 'No Bluetooth activity yet.'}</pre>
    </div>
  )
}
