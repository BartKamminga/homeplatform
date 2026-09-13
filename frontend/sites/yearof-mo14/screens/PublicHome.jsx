export default function PublicHome({ onNavigate }) {
  return (
    <div>
      <div className="yof-hero">
        <div style={{ fontSize: 32 }}>🇫🇷</div>
        <h1>Samen op naar Parijs!</h1>
        <p>Volg het team, bekijk de wedstrijden en steun de actie voor onze teamtrip.</p>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <button className="yof-btn" style={{ background: 'white', color: '#12203c' }}
          onClick={() => onNavigate('team')}>Het team bekijken</button>
        <button className="yof-btn" style={{ background: 'white', color: '#12203c' }}
          onClick={() => onNavigate('timeline')}>Wedstrijden &amp; bijzondere dagen</button>
      </div>
    </div>
  )
}
