import { card, cardLabel, ghostBtn, inputStyle } from '../styles.js'

// ── Competitie koppelen (uitgesplitst uit CompetitiesTab, item 737) ──

export default function CompetitiePicker({
  showPicker, setShowPicker,
  selectedComps, setSelectedComps,
  adding, onBulkAdd, onAdd,
  filterQ, setFilterQ,
  pickerComps, allComps,
}) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showPicker ? 12 : 0 }}>
        <div style={cardLabel}>COMPETITIE KOPPELEN</div>
        {showPicker && selectedComps.size > 0 && (
          <button
            onClick={onBulkAdd}
            disabled={adding}
            style={{ ...ghostBtn, fontSize: 12, color: 'var(--color-primary)', borderColor: 'var(--color-primary)', opacity: adding ? 0.5 : 1 }}
          >
            {adding ? 'Bezig…' : `+ Koppel ${selectedComps.size} geselecteerde`}
          </button>
        )}
        <button
          onClick={() => { setShowPicker(p => !p); setFilterQ(''); setSelectedComps(new Set()) }}
          style={{ ...ghostBtn, fontSize: 12, marginLeft: 'auto' }}
        >
          {showPicker ? 'Sluiten' : '+ Koppelen'}
        </button>
      </div>
      {showPicker && (
        <>
          <input
            value={filterQ}
            onChange={e => setFilterQ(e.target.value)}
            placeholder="Filter op naam…"
            autoFocus
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
          />
          {pickerComps.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: '8px 0' }}>
              {allComps.length === 0 ? 'Geen discovery-competities gevonden.' : 'Alle competities al gekoppeld.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
              {pickerComps.map(comp => {
                const checked = selectedComps.has(comp.id)
                return (
                  <div key={comp.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 8,
                    border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: checked ? 'var(--color-primary)11' : 'var(--color-surface)',
                    cursor: adding ? 'default' : 'pointer',
                  }} onClick={() => {
                    if (adding) return
                    setSelectedComps(prev => {
                      const n = new Set(prev)
                      if (n.has(comp.id)) n.delete(comp.id); else n.add(comp.id)
                      return n
                    })
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      onClick={e => e.stopPropagation()}
                      style={{ flexShrink: 0, width: 'auto', accentColor: 'var(--color-primary)' }}
                    />
                    <span style={{ fontSize: 11, opacity: 0.6, flexShrink: 0 }}>
                      {comp.hockey_type === 'ZA' ? '🏒' : '🏑'}
                    </span>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{comp.name}</span>
                      {comp.class_name && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{comp.class_name}</span>}
                    </span>
                    {!checked && (
                      <button onClick={e => { e.stopPropagation(); if (!adding) onAdd(comp) }} disabled={adding}
                        style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                        + Direct
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
