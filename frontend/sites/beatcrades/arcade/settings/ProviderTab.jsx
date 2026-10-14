import { useState, useEffect } from 'react'
import { getProvider, setProvider } from '../../api.js'

// Tab Provider (item 1338): welke Beatport-downloader actief is.
export default function ProviderTab() {
  const [data, setData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { getProvider().then(setData).catch(e => setError(e.message)) }, [])

  async function pick(p) {
    if (!data || p === data.provider || saving) return
    setSaving(true)
    try { const r = await setProvider(p); setData(d => ({ ...d, provider: r.provider, from_env: r.from_env })) }
    catch (e) { setError(e.message) }
    setSaving(false)
  }

  if (error && !data) return <p className="ac-hint" style={{ color: 'var(--ac-pink)' }}>{error}</p>
  if (!data) return <p className="ac-hint">Loading…</p>

  return (
    <div className="bca-tab">
      <span className="ac-label">Beatport provider</span>
      {data.options.map(p => (
        <button key={p} type="button" className={`bca-prov${data.provider === p ? ' on' : ''}`} onClick={() => pick(p)} disabled={saving}>
          <span>{p}</span>{data.provider === p && <span className="ac-pill done">✓ ACTIVE</span>}
        </button>
      ))}
      {data.from_env && <p className="ac-hint">The default comes from the <code className="bca-code">BEATPORT_PROVIDER</code> environment variable and resets after a restart.</p>}
      {error && <p className="ac-hint" style={{ color: 'var(--ac-pink)' }}>{error}</p>}
    </div>
  )
}
