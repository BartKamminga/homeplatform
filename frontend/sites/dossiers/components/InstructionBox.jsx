import { useEffect, useRef, useState } from 'react'
import { copyText } from '@components/CopyButton.jsx'

// Zichtbare, kopieerbare opdracht voor Claude Desktop. Op http (acc) faalt het klembord vaak
// stil; daarom staat de tekst altijd in een vak dat je zelf kunt selecteren.
export default function InstructionBox({ title, text, instruction }) {
  const [env, setEnv] = useState(null)
  const [copied, setCopied] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    fetch('/api/config').then((r) => r.json()).then((d) => setEnv(d.environment)).catch(() => {})
  }, [])

  const value = instruction(env)

  async function copy() {
    try {
      await copyText(value)
      setCopied('ok')
    } catch {
      ref.current?.focus()
      ref.current?.select()
      setCopied('manual')
    }
    setTimeout(() => setCopied(''), 4000)
  }

  return (
    <div className={title ? 'ds-box' : 'ds-instr'}>
      {title && <h2>{title}</h2>}
      {text && <p className="ds-muted ds-small">{text}</p>}
      <textarea ref={ref} className="ds-input ds-instruction" rows={4} readOnly value={value}
        onFocus={(e) => e.target.select()} aria-label="Instruction for Claude Desktop" />
      <div>
        <button type="button" className="ds-btn ds-btn-primary" onClick={copy}>
          {copied === 'ok' ? 'Copied, paste it in Claude Desktop' : copied === 'manual' ? 'Selected, press Ctrl+C' : 'Copy instruction'}
        </button>
      </div>
    </div>
  )
}
