import { useUiPref } from '@core/useUiPref.js'

export default function DisplayPrefsPanel({ onClose }) {
  const [showPlayCount, setShowPlayCount] = useUiPref('mm_show_play_count', true, v => v === 'true')
  const [showHearts,    setShowHearts]    = useUiPref('mm_show_hearts',     true, v => v === 'true')
  const [showRating,    setShowRating]    = useUiPref('mm_show_rating',     true, v => v === 'true')
  const [showMoments,   setShowMoments]   = useUiPref('mm_show_moments',    true, v => v === 'true')
  const [showExt,       setShowExt]       = useUiPref('mm_show_ext',        true, v => v === 'true')

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
          <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Weergave tracklist</span>
        </div>
        <div style={{ flex: 1, padding: '8px 20px', overflowY: 'auto' }}>
          {[
            ['Speeltijd badge (▶3×)',     showPlayCount, setShowPlayCount],
            ['Hartjes (♥)',               showHearts,    setShowHearts],
            ['Beoordeling (1–10)',        showRating,    setShowRating],
            ['Momenten (gekleurde dots)', showMoments,   setShowMoments],
            ['Bestandsextensie',         showExt,        setShowExt],
          ].map(([label, val, set]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>{label}</span>
              <button
                onClick={() => set(!val)}
                style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative', background: val ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <div style={{ position: 'absolute', top: 3, left: val ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
