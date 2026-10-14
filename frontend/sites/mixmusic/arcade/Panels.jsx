import { useState, useEffect } from 'react'
import { clearToken } from '@core/api.js'
import { useUiPref } from '@core/useUiPref.js'
import AppGroupSwitcher from '@components/AppGroupSwitcher.jsx'
import { AcPanel } from '@components/arcade/overlays.jsx'
import { AcSwitch, AcVariantSwitch } from '@components/arcade/controls.jsx'
import { usePlayerContext } from '../context/PlayerContext.jsx'
import { genreColor } from './format.js'

// Zijpanelen van Mixmusic arcade (item 1339): Settings, Genres, Tracklist display, Changelog.

export function SettingsPanel({ onClose, onOpen }) {
  const user = (() => { try { return JSON.parse(localStorage.getItem('hp_user') || '{}') } catch { return {} } })()
  const link = (label, key) => <button type="button" className="ac-linkrow" onClick={() => onOpen(key)}><span>{label}</span><em>▶</em></button>
  return (
    <AcPanel drawer title="SETTINGS" onClose={onClose}>
      <div className="ac-card"><div className="ac-row"><span>INTERFACE<small>Classic is the current design, Arcade the new one.</small></span><AcVariantSwitch site="mixmusic" /></div></div>
      <div><span className="ac-label">Display &amp; genres</span>{link('TRACKLIST DISPLAY', 'display')}{link('MANAGE GENRES', 'genres')}</div>
      <div><span className="ac-label">Insights</span>{link('STATISTICS', 'stats')}</div>
      <div>
        <span className="ac-label">Account</span>
        <p className="ac-hint" style={{ marginBottom: 10 }}>Signed in as <b style={{ color: 'var(--ac-yellow)' }}>{user.username || '–'}</b></p>
        <div className="mma-group"><AppGroupSwitcher app="mixmusic" /></div>
        <a className="ac-linkrow" href="/account/groups?back=/mixmusic/" style={{ textDecoration: 'none' }}><span>MORE GROUP SETTINGS</span><em>▶</em></a>
        <button type="button" className="ac-btn ac-btn--danger" style={{ marginTop: 12 }} onClick={() => { clearToken(); window.location.reload() }}>SIGN OUT</button>
      </div>
      <div><span className="ac-label">About</span>{link('ABOUT MIX MUSIC', 'changelog')}</div>
    </AcPanel>
  )
}

export function GenresPanel({ onClose }) {
  const { genres, addGenre, deleteGenre } = usePlayerContext()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  async function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    try { await addGenre(name.trim()); setName('') } catch (err) { setError(err.message || 'Could not add the genre') }
  }
  return (
    <AcPanel drawer title="GENRES" tone="purple" onClose={onClose}>
      <form onSubmit={add} className="mma-inline-form">
        <input className="ac-input" value={name} onChange={e => setName(e.target.value)} placeholder="New genre…" aria-label="New genre" />
        <button type="submit" className="ac-btn ac-btn--primary">ADD</button>
      </form>
      {error && <p className="ac-hint" style={{ color: 'var(--ac-pink)' }}>{error}</p>}
      <div>
        {genres.map(g => (
          <div key={g.id} className="mma-genre" style={{ '--c': genreColor(genres, g.name) }}>
            <i /><span>{g.name}</span>
            <button type="button" className="ac-icon danger" onClick={() => deleteGenre(g.id)} aria-label={`Delete ${g.name}`}>✕</button>
          </div>
        ))}
        {!genres.length && <p className="ac-hint">No genres yet.</p>}
      </div>
    </AcPanel>
  )
}

const DISPLAY = [
  ['mm_show_play_count', 'Play count badge (▶3×)'], ['mm_show_hearts', 'Hearts (♥)'], ['mm_show_rating', 'Rating (1–10)'],
  ['mm_show_moments', 'Moments (coloured dots)'], ['mm_show_ext', 'File extension'],
]
function DisplayRow({ prefKey, label }) {
  const [value, setValue] = useUiPref(prefKey, true, v => v === 'true')
  return <div className="ac-row" style={{ paddingInline: 0 }}><span>{label.toUpperCase()}</span><AcSwitch on={value} onChange={setValue} label={label} /></div>
}

export function DisplayPanel({ onClose }) {
  return (
    <AcPanel drawer title="TRACKLIST DISPLAY" onClose={onClose}>
      <div>{DISPLAY.map(([k, l]) => <DisplayRow key={k} prefKey={k} label={l} />)}</div>
    </AcPanel>
  )
}

export function ChangelogPanel({ onClose }) {
  const [entries, setEntries] = useState([])
  useEffect(() => {
    fetch('/api/changelog?site=mixmusic').then(r => r.json()).then(data => setEntries(data.map(e => ({
      version: e.version,
      date: new Date(e.released_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      changes: e.description ? e.description.split('\n').filter(Boolean) : [e.title],
    })))).catch(() => {})
  }, [])
  return (
    <AcPanel drawer title="CHANGELOG" sub={entries[0] ? `V${entries[0].version}` : ''} onClose={onClose}>
      {entries.map((e, i) => (
        <div key={e.version + i} className="mma-cl">
          <header><b>v{e.version}</b>{i === 0 && <span className="ac-pill done">LATEST</span>}<small>{e.date}</small></header>
          <ul>{e.changes.map((c, j) => <li key={j}>{c.replace(/^[-•]\s*/, '')}</li>)}</ul>
        </div>
      ))}
      {!entries.length && <p className="ac-hint">Loading…</p>}
    </AcPanel>
  )
}
