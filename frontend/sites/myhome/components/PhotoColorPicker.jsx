import { useEffect, useRef, useState } from 'react'

// Foto groot tonen; klik op een plek om de kleur te pakken (gemiddelde van 7x7 pixels) voor muur of vloer.
export default function PhotoColorPicker({ source, onUse, onClose }) {
  const canvasRef = useRef(null)
  const [color, setColor] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const c = canvasRef.current
      const scale = Math.min(1, 1200 / img.width)
      c.width = img.width * scale
      c.height = img.height * scale
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    }
    img.onerror = () => setError('The photo could not be loaded.')
    img.src = source.url
  }, [source.url])

  function pick(e) {
    const c = canvasRef.current
    const r = c.getBoundingClientRect()
    const x = Math.round(((e.clientX - r.left) / r.width) * c.width)
    const y = Math.round(((e.clientY - r.top) / r.height) * c.height)
    const { data } = c.getContext('2d').getImageData(Math.max(0, x - 3), Math.max(0, y - 3), 7, 7)
    let [rs, gs, bs, n] = [0, 0, 0, 0]
    for (let i = 0; i < data.length; i += 4) { rs += data[i]; gs += data[i + 1]; bs += data[i + 2]; n++ }
    const hex = '#' + [rs, gs, bs].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('')
    setColor(hex)
  }

  return (
    <div className="mh-modal" role="dialog" aria-modal="true" aria-label={source.title} onClick={onClose}>
      <div className="mh-modal-body" onClick={(e) => e.stopPropagation()}>
        <div className="mh-row" style={{ justifyContent: 'space-between' }}>
          <h2>{source.title}</h2>
          <button className="mh-btn ghost" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="mh-muted">Click on the wall or the floor to take its colour.</p>
        {error ? <p className="mh-error">{error}</p> : <canvas ref={canvasRef} className="mh-picker" onClick={pick} />}
        <div className="mh-row">
          <span className="mh-swatch" style={{ background: color || 'transparent' }} />
          <span className="mh-mono">{color || 'no colour picked'}</span>
          <span className="mh-spacer" />
          <button className="mh-btn ghost" disabled={!color} onClick={() => onUse('floor_color', color)}>Use as floor colour</button>
          <button className="mh-btn" disabled={!color} onClick={() => onUse('wall_color', color)}>Use as wall colour</button>
        </div>
      </div>
    </div>
  )
}
