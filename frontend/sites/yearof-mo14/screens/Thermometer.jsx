export default function Thermometer({ settings }) {
  if (!settings) return null
  const pct = settings.goal_amount > 0
    ? Math.min(100, Math.round((settings.raised_amount / settings.goal_amount) * 100))
    : 0

  return (
    <div style={{
      background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)',
      borderRadius: 16, padding: '18px 20px', margin: '0 auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
        <span>Opgehaald</span>
        <span>
          <strong style={{ fontSize: 18, color: '#f4c81e' }}>&euro;{settings.raised_amount}</strong> van &euro;{settings.goal_amount}
        </span>
      </div>
      <div style={{ height: 12, background: 'rgba(255,255,255,.15)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #f4c81e, #ffb24d)', borderRadius: 999 }} />
      </div>
      <div style={{ fontSize: 11, color: '#9aa5c0', marginTop: 6 }}>{pct}% van het doel</div>
    </div>
  )
}
