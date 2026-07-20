import { useState, useEffect } from 'react'
import { muted } from './styles.js'
import { api } from '@core/api.js'

const STALE_MS = 2 * 60 * 60 * 1000

function freshness(capturedAt) {
  if (!capturedAt) return 'missing'
  return Date.now() - new Date(capturedAt).getTime() < STALE_MS ? 'fresh' : 'stale'
}

function FreshnessChip({ capturedAt }) {
  const f = freshness(capturedAt)
  if (f === 'fresh') {
    const h = (Date.now() - new Date(capturedAt).getTime()) / 3600000
    const label = h < 0.1 ? 'zojuist' : `${h.toFixed(1)}u`
    return (
      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 600,
        background: '#052e16', color: '#4ade80', border: '1px solid #14532d', whiteSpace: 'nowrap' }}>
        ● {label}
      </span>
    )
  }
  if (f === 'stale') {
    const h = Math.round((Date.now() - new Date(capturedAt).getTime()) / 3600000)
    return (
      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 600,
        background: '#422006', color: '#fbbf24', border: '1px solid #78350f', whiteSpace: 'nowrap' }}>
        ● {h}u geleden
      </span>
    )
  }
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 600,
      background: '#1c1917', color: '#6b7280', border: '1px solid #2a2a2a', whiteSpace: 'nowrap' }}>
      ○ nooit
    </span>
  )
}

export default function CoverageTab({ tid }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState(null)

  useEffect(() => {
    setLoading(true)
    api.get('/api/tournix/import/coverage-detail?season=2026-2027')
      .then(r => r.json())
      .then(res => { setData(res); setLoading(false) })
      .catch(e => { setErr(e.message); setLoading(false) })
  }, [tid])

  if (loading) return <div style={muted}>Laden...</div>
  if (err) return <div style={{ ...muted, color: 'var(--color-danger)' }}>Fout: {err}</div>
  if (!data?.entries?.length) return <div style={muted}>Geen capture-configuratie gevonden.</div>

  const entries = tid ? data.entries.filter(e => e.tournament_id === tid) : data.entries
  if (!entries.length) return <div style={muted}>Geen capture config voor dit toernooi.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {entries.map((entry, i) => {
        const nFresh   = entry.poules.filter(p => freshness(p.captured_at) === 'fresh').length
        const nStale   = entry.poules.filter(p => freshness(p.captured_at) === 'stale').length
        const nMissing = entry.poules.filter(p => !p.captured_at).length
        const total    = entry.poules.length
        return (
          <div key={i} style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              padding: '10px 14px',
              background: 'var(--color-surface-2)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>
                {entry.tournament_name}
              </span>
              {entry.capture_group && (
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {entry.capture_group}
                </span>
              )}
              {nFresh > 0 && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#052e16',
                  color: '#4ade80', border: '1px solid #14532d', fontWeight: 600 }}>
                  ● {nFresh}/{total}
                </span>
              )}
              {nStale > 0 && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#422006',
                  color: '#fbbf24', border: '1px solid #78350f', fontWeight: 600 }}>
                  ● {nStale} oud
                </span>
              )}
              {nMissing > 0 && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#1c1917',
                  color: '#6b7280', border: '1px solid #2a2a2a', fontWeight: 600 }}>
                  ○ {nMissing} ontbreekt
                </span>
              )}
            </div>
            <div>
              {entry.poules.map((p, j) => (
                <div key={j} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 14px',
                  borderBottom: j < entry.poules.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}>
                  <span style={{ fontSize: 12, flex: 1, color: 'var(--color-text)' }}>{p.label}</span>
                  <FreshnessChip capturedAt={p.captured_at} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
