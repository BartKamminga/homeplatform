import { useState } from 'react'
import { clearToken } from '@core/api.js'
import { VERSION, CHANGELOG } from '../changelog.jsx'
import ThemeSwitcher from '@components/ThemeSwitcher.jsx'

export default function Settings({ onClose, genres, onAddGenre, onDeleteGenre }) {
  const [newGenre, setNewGenre] = useState('')
  const [genreError, setGenreError] = useState(null)

  const user = (() => { try { return JSON.parse(localStorage.getItem('hp_user') || '{}') } catch { return {} } })()

  async function handleAddGenre(e) {
    e.preventDefault()
    const name = newGenre.trim()
    if (!name) return
    setGenreError(null)
    try {
      await onAddGenre(name)
      setNewGenre('')
    } catch (e) {
      setGenreError(e.message || 'Toevoegen mislukt')
    }
  }

  function handleLogout() {
    clearToken()
    window.location.reload()
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.4)' }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 320, background: 'var(--bg)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            Instellingen
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ flex: 1, padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Thema */}
          <section style={{ paddingTop: 20 }}>
            <div style={sectionLabel}>Thema</div>
            <ThemeSwitcher />
          </section>

          {/* Account */}
          <section>
            <div style={sectionLabel}>Account</div>
            <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
              Ingelogd als <strong>{user.username || '—'}</strong>
            </div>
            <button onClick={handleLogout} style={dangerBtn}>
              Uitloggen
            </button>
          </section>

          {/* Genres */}
          <section>
            <div style={sectionLabel}>Genres beheren</div>
            <form onSubmit={handleAddGenre} style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input
                value={newGenre}
                onChange={e => setNewGenre(e.target.value)}
                placeholder="Nieuw genre..."
                style={inputStyle}
              />
              <button type="submit" style={addBtn}>+</button>
            </form>
            {genreError && <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{genreError}</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {genres.map(g => (
                <span key={g.id} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 16, fontSize: 12,
                  background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)',
                }}>
                  {g.name}
                  <span
                    onClick={() => onDeleteGenre(g.id)}
                    style={{ color: 'var(--muted)', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
                    title="Verwijderen"
                  >×</span>
                </span>
              ))}
              {genres.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Nog geen genres</span>
              )}
            </div>
          </section>

          {/* Changelog */}
          <section>
            <div style={sectionLabel}>Over Mix Music</div>
            {CHANGELOG.map(entry => (
              <div key={entry.version} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>v{entry.version}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{entry.date}</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {entry.changes.map((c, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{c}</li>
                  ))}
                </ul>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Mix Music v{VERSION}</div>
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

const inputStyle = {
  flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)',
  color: 'var(--text)', padding: '6px 10px', borderRadius: 6,
  fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
}

const addBtn = {
  padding: '6px 14px', borderRadius: 6, border: 'none',
  background: 'var(--accent)', color: '#fff', fontSize: 16, cursor: 'pointer', fontWeight: 500,
}

const dangerBtn = {
  width: '100%', padding: '8px 14px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg2)',
  color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
  textAlign: 'left',
}
