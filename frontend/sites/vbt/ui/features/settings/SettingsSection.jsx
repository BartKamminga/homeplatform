// SETTINGS: FTP (geldt direct, ook midden in een workout) en de browser-instelling om apparaten te onthouden.
import { useEffect, useState } from 'react'
import { useVbt, actions } from '../../hooks/useVbt.js'
import { copyText } from '../../common/clipboard.js'
import { FLAG_CHROME, FLAG_EDGE } from '../help/helpContent.js'

export default function SettingsSection() {
  const ftp = useVbt(s => s.ftp)
  const [value, setValue] = useState(ftp || 180)
  useEffect(() => { if (ftp) setValue(ftp) }, [ftp])

  const save = () => setValue(actions().setFtp(value))

  return (
    <div className="pn-section">
      <label className="pn-field">
        <small>FTP</small>
        <span>
          <input type="number" min="50" max="600" value={value} onChange={e => setValue(e.target.value)}
            onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save() }} /> W
        </span>
      </label>
      <p className="pn-hint">All workout targets scale with your FTP - also during a ride.</p>
      <h4>REMEMBER BLUETOOTH DEVICES</h4>
      <p className="pn-hint">Set this to <b>Enabled</b> and restart the browser, then VBT reconnects your KICKR and strap by itself.</p>
      <div className="pn-flag"><code>{FLAG_CHROME}</code><button className="ghostbtn" onClick={() => copyText(FLAG_CHROME)}>COPY</button></div>
      <div className="pn-flag"><code>{FLAG_EDGE}</code><button className="ghostbtn" onClick={() => copyText(FLAG_EDGE)}>COPY</button></div>
    </div>
  )
}
