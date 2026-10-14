import { useState } from 'react'
import { setVariant } from '@core/uiVariant.js'

// Kleine arcade-bedieningselementen (item 1336). Styling in core/arcade/*.css.

export function AcTabs({ items, value, onChange, scroll = false, className = '' }) {
  return (
    <div className={`ac-tabs${scroll ? ' scroll' : ''} ${className}`} role="tablist">
      {items.map(it => (
        <button key={it.value} type="button" role="tab" aria-selected={it.value === value}
          className={it.value === value ? 'active' : ''} onClick={() => onChange(it.value)}>
          {it.label}
        </button>
      ))}
    </div>
  )
}

// Segmentknop. multi=true: value is een array en meerdere opties kunnen aan staan.
export function AcSeg({ items, value, onChange, multi = false, full = false, ariaLabel }) {
  const isOn = v => multi ? value.includes(v) : value === v
  return (
    <div className={`ac-seg${full ? ' full' : ''}`} role="group" aria-label={ariaLabel}>
      {items.map(it => (
        <button key={String(it.value)} type="button" aria-pressed={isOn(it.value)} className={isOn(it.value) ? 'active' : ''}
          onClick={() => onChange(it.value)} title={it.title}>
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function AcSwitch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label}
      className={`ac-switch${on ? ' on' : ''}`} onClick={() => onChange(!on)} />
  )
}

export function AcStepper({ value, onChange, step = 1, min = -Infinity, max = Infinity, format = v => v, label }) {
  const clamp = v => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className="ac-stepper" role="group" aria-label={label}>
      <button type="button" className="ac-icon" aria-label="Lower" onClick={() => onChange(clamp(value - step))} disabled={value <= min}>−</button>
      <b>{format(value)}</b>
      <button type="button" className="ac-icon" aria-label="Higher" onClick={() => onChange(clamp(value + step))} disabled={value >= max}>+</button>
    </div>
  )
}

// LED-meter: n segmenten, `on` aan; kleur loopt van cyaan via geel naar roze (zoals VBT).
export function AcLeds({ n = 24, on = 0, ramp = true, className = '' }) {
  return (
    <div className={`ac-leds ${className}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const tone = !ramp ? '' : i >= n * 0.83 ? ' p' : i >= n * 0.6 ? ' y' : ''
        return <i key={i} className={i < on ? 'on' + tone : ''} />
      })}
    </div>
  )
}

export function AcVariantSwitch({ site }) {
  const [busy, setBusy] = useState(false)
  return (
    <AcSeg ariaLabel="Interface" value="arcade"
      items={[{ value: 'classic', label: 'CLASSIC' }, { value: 'arcade', label: 'ARCADE' }]}
      onChange={v => { if (v !== 'arcade' && !busy) { setBusy(true); setVariant(site, v) } }} />
  )
}
