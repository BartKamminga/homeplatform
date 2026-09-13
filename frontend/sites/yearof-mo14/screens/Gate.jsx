import { useState } from 'react'
import { validateTeamCode } from '../api.js'
import { storeCode } from '../gate.js'

export default function Gate({ onUnlock }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function submit() {
    const trimmed = code.trim().toLowerCase()
    if (!trimmed) return
    setChecking(true)
    setError('')
    try {
      const res = await validateTeamCode(trimmed)
      if (res.valid) {
        storeCode(trimmed)
        onUnlock()
      } else {
        setError('Deze code klopt niet (meer). Vraag het nieuwste linkje in de WhatsApp-groep.')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="yof yof-gate">
      <div className="yof-gate-card">
        <div style={{ fontSize: 40 }}>🏑</div>
        <h1 style={{ fontSize: 18, margin: '12px 0 4px' }}>MO14 à Paris</h1>
        <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
          Vul de teamcode in die je in de WhatsApp-groep hebt gekregen.
        </p>
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          maxLength={6}
          placeholder="••••••"
          autoFocus
        />
        {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
        <button className="yof-btn" onClick={submit} disabled={checking}>
          {checking ? 'Bezig...' : 'Doorgaan'}
        </button>
      </div>
    </div>
  )
}
