// BACKUP: lokaal journal, server-backup (lag) en outbox; met "sync now".
import { useEffect, useState } from 'react'
import { useVbt, actions } from '../../hooks/useVbt.js'

const STATUS = { ok: 'UP TO DATE', behind: 'CATCHING UP', failing: 'OFFLINE - LOCAL ONLY', off: 'NOT RIDING' }
const ago = s => (s === null || s === undefined ? '-' : s < 1 ? 'just now' : Math.round(s) + ' s ago')

export default function BackupTab() {
  const b = useVbt(s => s.backup)
  const recording = useVbt(s => s.recording)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const poll = () => actions().pendingRides().then(p => setPending(p.length)).catch(() => {})
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [])

  if (!b) return null
  return (
    <div className="pn-section">
      <div className="pn-kv"><span>SERVER BACKUP</span><b className="pn-status" data-status={b.status}>{STATUS[b.status]}</b></div>
      <div className="pn-grid">
        <div><small>NOT YET ON SERVER</small><b>{recording ? b.lag + ' S' : '-'}</b><i>of riding</i></div>
        <div><small>LAST SERVER SYNC</small><b className="pn-small">{ago(b.age)}</b><i>every 10 s</i></div>
        <div><small>LOCAL JOURNAL</small><b className="pn-small">{ago(b.journalAge)}</b><i>every second</i></div>
        <div><small>OUTBOX</small><b>{pending}</b><i>{pending ? 'waiting to sync' : 'all synced'}</i></div>
      </div>
      <div className="pn-buttons">
        <button className="ghostbtn" onClick={() => actions().syncNow()}>&#8635; SYNC NOW</button>
      </div>
      <p className="pn-hint">Your ride is kept on this device every second and on the server every 10 seconds.
        Finished rides wait in the outbox until the server confirms them.</p>
    </div>
  )
}
