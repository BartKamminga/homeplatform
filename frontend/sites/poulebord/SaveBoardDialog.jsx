import { C } from './constants.js'

export function SaveBoardDialog({
  open, onClose, saveName, onSaveNameChange, saveNameRef,
  saving, savedCode, onSave, shareUrl, onCopyUrl, copied,
}) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.deep, borderRadius: 16, padding: '20px 20px 24px',
        width: '100%', maxWidth: 360, border: `1px solid ${C.border}` }}>
        {!savedCode ? (
          <>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20,
              letterSpacing: '0.06em', marginBottom: 6 }}>Board opslaan & delen</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              Geef je board een naam en deel de link.
            </div>
            <input
              ref={saveNameRef}
              autoFocus
              value={saveName}
              onChange={e => onSaveNameChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSave()}
              placeholder="Naam voor dit board…"
              style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 8, color: C.chalk, fontSize: 13, padding: '8px 12px',
                fontFamily: 'inherit', marginBottom: 16, boxSizing: 'border-box', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onSave} disabled={saving || !saveName.trim()} style={{
                flex: 1, background: C.gold, color: C.deep, border: 'none', borderRadius: 8,
                padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                opacity: saving || !saveName.trim() ? 0.5 : 1,
              }}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
              <button onClick={onClose} style={{
                background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>Annuleer</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20,
              letterSpacing: '0.06em', marginBottom: 6 }}>Opgeslagen!</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              Deel de link met iedereen die dit board wil zien.
            </div>
            <div style={{ background: C.bg, borderRadius: 8, padding: '8px 12px', fontSize: 11,
              color: C.muted, marginBottom: 12, wordBreak: 'break-all', border: `1px solid ${C.border}` }}>
              {shareUrl}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onCopyUrl} style={{
                flex: 1, background: copied ? C.gold : C.card, color: copied ? C.deep : C.chalk,
                border: `1px solid ${copied ? C.gold : C.border}`, borderRadius: 8,
                padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{copied ? 'Gekopieerd!' : '🔗 Kopieer link'}</button>
              <button onClick={onClose} style={{
                background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>Sluiten</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
