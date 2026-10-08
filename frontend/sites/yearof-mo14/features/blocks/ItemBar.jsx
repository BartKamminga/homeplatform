// Balk boven een blok op de wedstrijdpagina in het bewerkscherm (item 1239),
// zelfde vorm als PageBlock: groen = live, grijs = concept. Alle knoppen zijn
// optioneel - wat niet meegegeven wordt, verschijnt niet.
const btn = { background: 'white' }

export default function ItemBar({
  label, live, onToggleLive, onMatchLink, onToggleMatchLink, featured, onToggleFeatured,
  onUp, onDown, onEdit, editLabel = '✎ Bewerken', onDelete,
}) {
  const hasStatus = live !== undefined
  return (
    <div onClick={e => e.stopPropagation()} style={{
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '6px 10px', marginBottom: 6,
      borderRadius: 10, fontSize: 12, background: !hasStatus ? '#f1f2f5' : live ? '#dcfce7' : '#f1f2f5',
    }}>
      <strong style={{ flex: 1, minWidth: 120 }}>{label}</strong>
      {hasStatus && (
        <span style={{ color: live ? '#166534' : '#6b7280', fontWeight: 700 }}>{live ? 'Live' : 'Concept - niet op de site'}</span>
      )}
      {onToggleMatchLink && (
        <button onClick={onToggleMatchLink} className="yof-btn-secondary" style={btn}
          title="Wel of niet tonen op de losse wedstrijdlink (fans)">
          {onMatchLink ? '★ Op wedstrijdlink' : '☆ Niet op wedstrijdlink'}
        </button>
      )}
      {onToggleFeatured && (
        <button onClick={onToggleFeatured} className="yof-btn-secondary" style={btn} title="Wel of niet in In de kijker">
          {featured ? '★ In de kijker' : '☆ Niet in de kijker'}
        </button>
      )}
      {onToggleLive && (
        <button onClick={onToggleLive} className="yof-btn-secondary" style={btn}>{live ? 'Naar concept' : 'Live zetten'}</button>
      )}
      {(onUp || onDown) && (
        <>
          <button onClick={onUp} disabled={!onUp} className="yof-btn-secondary" style={btn} title="Naar boven">&#8593;</button>
          <button onClick={onDown} disabled={!onDown} className="yof-btn-secondary" style={btn} title="Naar beneden">&#8595;</button>
        </>
      )}
      {onEdit && <button onClick={onEdit} className="yof-btn-secondary" style={btn}>{editLabel}</button>}
      {onDelete && <button onClick={onDelete} className="yof-btn-secondary" style={btn} title="Blok verwijderen">Verwijderen</button>}
    </div>
  )
}
