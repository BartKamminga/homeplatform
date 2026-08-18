import { C } from './constants.js'

export function MyBoardsView({ myBoards, onOpen, onCopyUrl, onDelete, onNewBoard }) {
  return (
    <div style={{ padding: '16px 12px' }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.06em',
        marginBottom: 14, color: C.chalk }}>MIJN BOARDS</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {myBoards.map(b => (
          <div key={b.code} style={{ flex: '1 1 240px', background: C.card, borderRadius: 12,
            border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 14px 10px' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.chalk, marginBottom: 6,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {b.club && (
                  <span style={{ fontSize: 10, color: C.gold, background: 'rgba(207,159,63,0.1)',
                    border: `1px solid ${C.gold}`, borderRadius: 4, padding: '1px 6px' }}>
                    ⭐ {b.club}
                  </span>
                )}
                {(b.pins || []).length > 0 && (
                  <span style={{ fontSize: 10, color: C.muted, background: C.deep,
                    border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px' }}>
                    📌 {b.pins.length} comp.
                  </span>
                )}
                {(b.pool_pins || []).length > 0 && (
                  <span style={{ fontSize: 10, color: C.muted, background: C.deep,
                    border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px' }}>
                    📌 {b.pool_pins.length} poule{b.pool_pins.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => onOpen(b)} style={{
                flex: 1, padding: '9px', background: 'transparent', border: 'none',
                color: C.gold, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}>Openen</button>
              <button onClick={() => onCopyUrl(b.code)} style={{
                padding: '9px 12px', background: 'transparent', border: 'none',
                borderLeft: `1px solid ${C.border}`,
                color: C.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}>🔗</button>
              <button onClick={() => onDelete(b.code)} style={{
                padding: '9px 10px', background: 'transparent', border: 'none',
                borderLeft: `1px solid ${C.border}`,
                color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onNewBoard} style={{
        marginTop: 16, background: 'transparent', border: `1px solid ${C.border}`,
        borderRadius: 8, padding: '8px 16px', color: C.muted, fontSize: 12,
        cursor: 'pointer', fontFamily: 'inherit',
      }}>+ Nieuw board (leeg beginnen)</button>
    </div>
  )
}
