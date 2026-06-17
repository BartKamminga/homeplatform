import { useState } from 'react'
import { usePlayerContext } from '../context/PlayerContext.jsx'

export default function GenresPanel({ onClose }) {
  const { genres, addGenre, deleteGenre } = usePlayerContext()
  const [newGenre,   setNewGenre]   = useState('')
  const [genreError, setGenreError] = useState(null)

  async function handleAdd(e) {
    e.preventDefault()
    const name = newGenre.trim()
    if (!name) return
    setGenreError(null)
    try {
      await addGenre(name)
      setNewGenre('')
    } catch (err) {
      setGenreError(err.message || 'Toevoegen mislukt')
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 60,
        width: 300, background: 'var(--bg)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, padding: '4px', marginRight: 10, lineHeight: 1 }}>←</button>
          <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Genres</span>
        </div>
        <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input
              value={newGenre}
              onChange={e => setNewGenre(e.target.value)}
              placeholder="Nieuw genre..."
              style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', borderRadius: 6, fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none' }}
            />
            <button type="submit" style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 16, cursor: 'pointer', fontWeight: 500 }}>+</button>
          </form>
          {genreError && <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{genreError}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {genres.map(g => (
              <span key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 16, fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                {g.name}
                <span onClick={() => deleteGenre(g.id)} style={{ color: 'var(--muted)', cursor: 'pointer', fontSize: 13, lineHeight: 1 }} title="Verwijderen">×</span>
              </span>
            ))}
            {genres.length === 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Nog geen genres</span>}
          </div>
        </div>
      </div>
    </>
  )
}
