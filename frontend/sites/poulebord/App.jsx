export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0b3427 0%, #082a20 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#f3efe3',
      fontFamily: "'Inter', sans-serif",
      gap: 16,
    }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: '0.03em', lineHeight: 1 }}>
        POULEBORD
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#cf9f3f' }}>
        KNHB Jeugdcompetitie · Seizoen 2026–2027
      </div>
      <div style={{ marginTop: 8, fontSize: 14, color: '#8fab9d' }}>
        In aanbouw — poule-indeling volgt snel
      </div>
    </div>
  )
}
