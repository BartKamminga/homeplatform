const s = {
  hero: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '28px', padding: '40px',
    background: 'var(--bg)', overflowY: 'auto',
    minHeight: 0,
  },
  vinylContainer: { position: 'relative', cursor: 'pointer' },
  vinyl: {
    width: '220px', height: '220px', borderRadius: '50%',
    background: 'conic-gradient(from 0deg, #111 0deg 30deg, #222 30deg 60deg, #111 60deg 90deg, #222 90deg 120deg, #111 120deg 150deg, #222 150deg 180deg, #111 180deg 210deg, #222 210deg 240deg, #111 240deg 270deg, #222 270deg 300deg, #111 300deg 330deg, #222 330deg 360deg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 0 3px rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.5)',
    position: 'relative',
  },
  vinylCenter: {
    width: '60px', height: '60px', borderRadius: '50%',
    background: 'radial-gradient(circle, var(--accent) 0%, var(--accent2) 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '20px', zIndex: 1,
  },
  overlay: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '36px', zIndex: 2,
    transition: 'opacity 0.2s',
  },
  trackInfo: { textAlign: 'center', maxWidth: '440px' },
  title: {
    fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700,
    lineHeight: 1.2, marginBottom: '8px', color: 'var(--text)',
  },
  meta: { fontSize: '13px', color: 'var(--muted)', letterSpacing: '0.05em' },
  stateBox: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '12px', padding: '20px 24px', textAlign: 'left', maxWidth: '460px', width: '100%',
  },
}

export default function NowPlaying({ track, playing, onToggle, error }) {
  if (error) {
    return (
      <div style={s.hero}>
        <div style={s.stateBox}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: 'var(--accent)' }}>
            ⚠ Kan tracks niet laden
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7 }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!track) {
    return (
      <div style={s.hero}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>♫</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--text)', marginBottom: '10px' }}>
            Mix Music
          </div>
          <div style={{ fontSize: '13px' }}>Kies een track in de lijst</div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.hero}>
      <div
        style={s.vinylContainer}
        onClick={onToggle}
        onMouseEnter={e => e.currentTarget.querySelector('.overlay').style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.querySelector('.overlay').style.opacity = '0'}
      >
        <div style={s.vinyl} className={playing ? 'spinning' : ''}>
          <div style={s.vinylCenter}>♫</div>
        </div>
        <div className="overlay" style={{ ...s.overlay, opacity: 0, color: 'var(--text)' }}>
          {playing
            ? <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </div>
      </div>

      <div style={s.trackInfo}>
        <div style={s.title}>{track.name}</div>
        <div style={s.meta}>{track.folder || 'Muziek'} &nbsp;·&nbsp; {track.ext}</div>
      </div>
    </div>
  )
}
