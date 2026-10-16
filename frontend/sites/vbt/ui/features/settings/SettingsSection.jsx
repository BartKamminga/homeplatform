// SETTINGS: FTP en max-hartslag (gelden direct, ook midden in een rit), ploegleider-stem, verkeer,
// en de browser-instelling om Bluetooth-apparaten te onthouden.
import { useEffect, useState } from 'react'
import { useVbt, actions } from '../../hooks/useVbt.js'
import { copyText } from '../../common/clipboard.js'
import { FLAG_CHROME, FLAG_EDGE } from '../help/helpContent.js'
import StravaBlock from './StravaBlock.jsx'
import MusicBlock from './MusicBlock.jsx'
import WorldBlock from './WorldBlock.jsx'
import { previewExtra } from './previewExtra.js'

function NumberField({ label, value, unit, min, max, onSave }) {
  const [v, setV] = useState(value)
  useEffect(() => { setV(value) }, [value])
  const save = () => {
    const n = Math.max(min, Math.min(max, parseInt(v, 10) || value))
    setV(n)
    if (n !== value) onSave(n)
  }
  return (
    <label className="pn-field">
      <small>{label}</small>
      <span><input type="number" min={min} max={max} value={v} onChange={e => setV(e.target.value)}
        onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save() }} /> {unit}</span>
    </label>
  )
}

// eigen stand direct bijwerken: het snapshot ververst maar 4x/s, anders 'vergeet' een snelle tweede klik de eerste
function Toggle({ label, checked, onChange, indent }) {
  const [on, setOn] = useState(!!checked)
  useEffect(() => { setOn(!!checked) }, [checked])
  return (
    <label className={'pn-toggle' + (indent ? ' pn-indent' : '')}>
      <input type="checkbox" checked={on} onChange={e => { setOn(e.target.checked); onChange(e.target.checked) }} /> {label}
    </label>
  )
}

function FtpHistory({ history }) {
  if (!history || !history.length) return null
  return (
    <>
      <h4>FTP HISTORY</h4>
      <ul className="pn-history">
        {history.slice(-8).reverse().map((h, i) => (
          <li key={i}><span>{h.date}</span><b>{h.ftp} W</b><i>{h.prev ? (h.ftp >= h.prev ? '+' : '') + (h.ftp - h.prev) + ' W · ' : ''}{h.source}</i></li>
        ))}
      </ul>
    </>
  )
}

export default function SettingsSection() {
  const ftp = useVbt(s => s.ftp)
  const settings = useVbt(s => s.settings) || {}
  const hrMax = settings.hrMax || 185
  const zones = window.VBT.hrZones
  const save = patch => actions().saveSettings(patch)

  return (
    <div className="pn-section">
      <NumberField label="FTP" value={ftp || 180} unit="W" min={50} max={600} onSave={n => actions().setFtp(n)} />
      <p className="pn-hint">All workout targets scale with your FTP - also during a ride.</p>

      <NumberField label="MAX HEART RATE" value={hrMax} unit="BPM" min={120} max={230} onSave={n => save({ hrMax: n })} />
      <div className="pn-zones">
        {zones.map((z, i) => {
          const lo = Math.round(hrMax * (i ? zones[i - 1].max : 0.5)), hi = z.max > 1 ? hrMax : Math.round(hrMax * z.max)
          return <div key={z.name} style={{ borderColor: z.color }}><b style={{ color: z.color }}>{z.name}</b><span>{z.label}</span><i>{lo}-{hi}</i></div>
        })}
      </div>

      <WorldBlock />

      <h4>DISPLAY</h4>
      <div className="pn-buttons">
        <button className="ghostbtn" onClick={() => actions().setAllDisplay(true)}>ALL ON</button>
        <button className="ghostbtn" onClick={() => actions().setAllDisplay(false)}>ALL OFF</button>
      </div>
      {window.VBT.settings.DISPLAY.map(g => (
        <div key={g.group} className="pn-display">
          <small>{g.group.toUpperCase()}</small>
          {g.items.map(([key, label]) => (
            <Toggle key={key} label={label} checked={settings[key] !== false} indent={key.startsWith('veh_')}
              onChange={v => { save({ [key]: v }); if (v) previewExtra(key) }} />
          ))}
        </div>
      ))}

      <FtpHistory history={settings.ftpHistory} />

      <MusicBlock />

      <StravaBlock />

      <h4>REMEMBER BLUETOOTH DEVICES</h4>
      <p className="pn-hint">Set this to <b>Enabled</b> and restart the browser, then VBT reconnects your KICKR and strap by itself.</p>
      <div className="pn-flag"><code>{FLAG_CHROME}</code><button className="ghostbtn" onClick={() => copyText(FLAG_CHROME)}>COPY</button></div>
      <div className="pn-flag"><code>{FLAG_EDGE}</code><button className="ghostbtn" onClick={() => copyText(FLAG_EDGE)}>COPY</button></div>
    </div>
  )
}
