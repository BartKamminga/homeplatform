import { useState, useRef, useEffect } from 'react'
import { useAppGroupPref } from '@core/useAppGroupPref.js'

const APP_BACK = {
  dontforget: '/dontforget/',
  tournix:    '/tournix/',
  fiets:      '/fiets/',
  mixmusic:   '/mixmusic/',
}

export default function GroupChip({ app }) {
  const { groups, current, setGroup, loading } = useAppGroupPref(app)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (groups.length === 0) return null

  const label = current || 'Persoonlijk'
  const backPath = APP_BACK[app] ?? `/${app}/`
  const accent = 'var(--color-primary, var(--accent))'
  const accentBg = 'var(--color-primary-light, rgba(99,102,241,0.10))'
  const border = 'var(--color-border, var(--border))'
  const surface = 'var(--color-surface, var(--bg-card))'
  const textMuted = 'var(--color-text-muted, var(--text-muted))'
  const text = 'var(--color-text, var(--text))'

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
          cursor: loading ? 'default' : 'pointer',
          border: `1px solid ${accent}`,
          background: accentBg,
          color: accent,
          fontFamily: 'inherit', opacity: loading ? 0.6 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        <i className="ti ti-users" style={{ fontSize: 12 }} />
        <span>{label}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: surface, border: `1px solid ${border}`,
          borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
          minWidth: 160, zIndex: 200, overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 12px 4px', fontSize: 10, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: textMuted,
          }}>
            Wissel groep
          </div>

          {[null, ...groups].map(g => {
            const slug = g ? g.slug : null
            const name = g ? g.slug : 'Persoonlijk'
            const active = (current ?? null) === slug
            return (
              <div
                key={slug ?? '__personal__'}
                onClick={() => { if (!active && !loading) { setGroup(slug); setOpen(false) } }}
                style={{
                  padding: '7px 12px', fontSize: 13,
                  cursor: active ? 'default' : 'pointer',
                  background: active ? accentBg : 'transparent',
                  color: active ? accent : text,
                  fontWeight: active ? 600 : 400,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {active && <i className="ti ti-check" style={{ fontSize: 12 }} />}
                {!active && <span style={{ display: 'inline-block', width: 12 }} />}
                {name}
              </div>
            )
          })}

          <div style={{ borderTop: `1px solid ${border}`, marginTop: 4 }}>
            <a
              href={`/account/groups?back=${backPath}`}
              style={{
                display: 'block', padding: '8px 12px', fontSize: 12,
                color: textMuted, textDecoration: 'none',
              }}
            >
              Groepen beheren →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
