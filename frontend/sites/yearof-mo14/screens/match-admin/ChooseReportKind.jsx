// Kies-scherm - 1 herkenbare ingang vanuit de preview ("+ item toevoegen"),
// die hierna splitst in 4 losse paden. insertAfterId (kan null zijn) wordt
// gewoon doorgegeven aan het gekozen vervolgpad.
export function ChooseReportKind({ onWriteMyself, onSendInvite, onAddInstagram, onAddFootage, onBack }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>&larr; terug</button>
      <h3 style={{ fontSize: 15, margin: '0 0 14px' }}>Hoe wil je dit toevoegen?</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        <button onClick={onWriteMyself} className="yof-card" style={{ textAlign: 'left', cursor: 'pointer', border: 'none' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Zelf schrijven</div>
          <div style={{ fontSize: 13, color: '#666' }}>Jij typt en publiceert het verslag of interview direct.</div>
        </button>
        <button onClick={onSendInvite} className="yof-card" style={{ textAlign: 'left', cursor: 'pointer', border: 'none' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Invullinkje versturen</div>
          <div style={{ fontSize: 13, color: '#666' }}>Stuur een linkje naar een speelster - zij typt het later zelf in.</div>
        </button>
        <button onClick={onAddInstagram} className="yof-card" style={{ textAlign: 'left', cursor: 'pointer', border: 'none' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Instagram-linkje toevoegen</div>
          <div style={{ fontSize: 13, color: '#666' }}>1 Instagram-post, wordt echt ingebed op de pagina.</div>
        </button>
        <button onClick={onAddFootage} className="yof-card" style={{ textAlign: 'left', cursor: 'pointer', border: 'none' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Wedstrijdbeelden toevoegen</div>
          <div style={{ fontSize: 13, color: '#666' }}>Een blokje met (minimaal 4) video-linkjes.</div>
        </button>
      </div>
    </div>
  )
}
