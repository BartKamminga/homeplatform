import { useState } from 'react'
import { SectionIcon, RackIcon, CradeIcon } from './Icons.jsx'

const PH_CFG = {
  section: { ph: 'Naam nieuwe Section…',                   btn: 'Aanmaken' },
  rack:    { ph: 'Naam nieuw Rack…',                       btn: 'Aanmaken' },
  crade:   { ph: 'URL — Beatport, YouTube of SoundCloud…', btn: '↓ Starten' },
}

export function PlaceholderRow({ type, onSubmit }) {
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)
  const cfg = PH_CFG[type]

  const handleSubmit = async () => {
    if (!val.trim() || busy) return
    setBusy(true)
    try { await onSubmit(val.trim()); setVal('') }
    finally { setBusy(false) }
  }

  return (
    <div className={`bc-ph bc-ph--${type}`}>
      <div className="bc-ph-ico">
        {type === 'section' && <SectionIcon size={18}/>}
        {type === 'rack'    && <RackIcon    size={16}/>}
        {type === 'crade'   && <CradeIcon   size={15}/>}
      </div>
      <input
        className="bc-ph-input"
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={cfg.ph}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
      />
      <button className="bc-ph-btn" disabled={!val.trim() || busy} onClick={handleSubmit}>
        {busy ? '…' : cfg.btn}
      </button>
    </div>
  )
}
