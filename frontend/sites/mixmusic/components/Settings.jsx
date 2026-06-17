import { clearToken } from '@core/api.js'
import ThemeSwitcher from '@components/ThemeSwitcher.jsx'
import AppGroupSwitcher from '@components/AppGroupSwitcher.jsx'

const MOBILE_OPTIONS = [
  { key: 'D', label: 'Minimal', desc: 'Top bar + transportbalk + tracks/details toggle' },
  { key: 'C', label: 'Gestapeld', desc: 'Afspeler boven, details eronder' },
  { key: 'A', label: 'Tabs', desc: 'Drie tabbladen onderaan' },
  { key: 'B', label: 'Sheet', desc: 'Tracklist + schuifpaneel' },
]

export default function Settings({ onClose, onOpenStats, onOpenDisplay, onOpenGenres, onOpenChangelog, mobileLayout, onMobileLayout, isMobile }) {
  const user = (() => { try { return JSON.parse(localStorage.getItem('hp_user') || '{}') } catch { return {} } })()

  function handleLogout() {
    clearToken()
    window.location.reload()
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.4)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 320, background: 'var(--bg)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            Instellingen
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ flex: 1, padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

          <section style={{ paddingTop: 20 }}>
            <div style={sectionLabel}>Thema</div>
            <ThemeSwitcher />
          </section>

          {isMobile && <section>
            <div style={sectionLabel}>Layout — mobiel</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {MOBILE_OPTIONS.map(o => (
                <button
                  key={o.key}
                  onClick={() => onMobileLayout?.(o.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    borderRadius: 8, border: `1px solid ${mobileLayout === o.key ? 'var(--accent)' : 'var(--border)'}`,
                    background: mobileLayout === o.key ? 'var(--accent)22' : 'var(--bg2)',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: mobileLayout === o.key ? 'var(--accent)' : 'var(--text)', minWidth: 20 }}>{o.key}</span>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: mobileLayout === o.key ? 600 : 400 }}>{o.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>}

          <section>
            <div style={sectionLabel}>Weergave &amp; genres</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={onOpenDisplay} style={{ ...navBtn }}>Weergave tracklist →</button>
              <button onClick={onOpenGenres}  style={{ ...navBtn }}>Genres beheren →</button>
            </div>
          </section>

          <section>
            <div style={sectionLabel}>Inzichten</div>
            <button onClick={onOpenStats} style={{ ...navBtn }}>Statistieken →</button>
          </section>

          <section>
            <div style={sectionLabel}>Account</div>
            <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 12 }}>
              Ingelogd als <strong>{user.username || '—'}</strong>
            </div>
            <div style={{ marginBottom: 14 }}>
              <AppGroupSwitcher app="mixmusic" />
            </div>
            <a
              href={'/account/groups?back=/mixmusic/'}
              style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 12, textDecoration: 'none' }}
            >
              Meer groepsinstellingen →
            </a>
            <button onClick={handleLogout} style={navBtn}>
              Uitloggen
            </button>
          </section>

          <section>
            <div style={sectionLabel}>Over</div>
            <button onClick={onOpenChangelog} style={{ ...navBtn }}>Over Mix Music →</button>
          </section>

        </div>
      </div>
    </>
  )
}

const sectionLabel = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--muted)', marginBottom: 10,
}

const navBtn = {
  width: '100%', padding: '8px 14px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg2)',
  color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
  textAlign: 'left',
}
