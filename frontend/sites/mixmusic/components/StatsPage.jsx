import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

const MOMENT_LABELS = { morning: 'Ochtend', afternoon: 'Middag', evening: 'Avond', night: 'Nacht' }
const MOMENT_COLORS = { morning: '#f59e0b', afternoon: '#10b981', evening: '#818cf8', night: '#475569' }

function fmtTime(s) {
  if (!s || s < 1) return '—'
  if (s < 60)   return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return m > 0 ? `${h}u ${m}m` : `${h}u`
}

function BarList({ items, valueKey, fmt }) {
  if (!items?.length) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nog geen data</div>
  const max = items[0][valueKey] || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <div key={item.file} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', minWidth: 14, textAlign: 'right' }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }} title={item.label}>{item.label}</div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(item[valueKey] / max) * 100}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.4s' }} />
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>{fmt(item[valueKey])}</span>
        </div>
      ))}
    </div>
  )
}

export default function StatsPage({ onClose }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/mixmusic/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.4)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 340, background: 'var(--bg)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Statistieken</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, padding: 4 }}>×</button>
        </div>

        <div style={{ flex: 1, padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {loading && <div style={{ paddingTop: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Laden…</div>}

          {!loading && stats && (
            <>
              {/* Totaal */}
              <section style={{ paddingTop: 20 }}>
                <div style={sectionLabel}>Totaal</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    ['Luistertijd', fmtTime(stats.total_play_seconds)],
                    ['Afgespeeld', `${stats.total_plays}×`],
                    ['Tracks', `${stats.tracked_tracks}`],
                  ].map(([label, val]) => (
                    <div key={label} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 8px', textAlign: 'center', border: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{val}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Top luistertijd */}
              <section>
                <div style={sectionLabel}>Meest geluisterd (tijd)</div>
                <BarList items={stats.top_by_time} valueKey="seconds" fmt={fmtTime} />
              </section>

              {/* Top speelcount */}
              <section>
                <div style={sectionLabel}>Meest afgespeeld (keer)</div>
                <BarList items={stats.top_by_plays} valueKey="count" fmt={n => `${n}×`} />
              </section>

              {/* Top hartjes */}
              <section>
                <div style={sectionLabel}>Meeste hartjes</div>
                <BarList items={stats.top_by_hearts} valueKey="count" fmt={n => `♥${n}`} />
              </section>

              {/* Genre-verdeling */}
              {Object.keys(stats.genre_distribution).length > 0 && (
                <section>
                  <div style={sectionLabel}>Genres</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {Object.entries(stats.genre_distribution).map(([g, cnt]) => {
                      const max = Object.values(stats.genre_distribution)[0]
                      return (
                        <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text)', minWidth: 80 }}>{g}</span>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)' }}>
                            <div style={{ height: '100%', width: `${(cnt / max) * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', minWidth: 24, textAlign: 'right' }}>{cnt}</span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Moment-verdeling */}
              {Object.keys(stats.moment_distribution).length > 0 && (
                <section>
                  <div style={sectionLabel}>Momenten</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(stats.moment_distribution).map(([mo, cnt]) => (
                      <div key={mo} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 12, background: (MOMENT_COLORS[mo] || 'var(--accent)') + '22', border: `1px solid ${MOMENT_COLORS[mo] || 'var(--accent)'}44` }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: MOMENT_COLORS[mo] || 'var(--accent)' }} />
                        <span style={{ fontSize: 12, color: 'var(--text)' }}>{MOMENT_LABELS[mo] || mo}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{cnt}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

const sectionLabel = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--muted)', marginBottom: 10,
}
