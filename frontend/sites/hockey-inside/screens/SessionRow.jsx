import { fmt } from './archiefHelpers.js'

// Uitgesplitst uit ArchiefTab.jsx (item 737).

export default function SessionRow({ s, onSelect, selected, onReprocess, reprocessing, onDelete, deleting }) {
  return (
    <div
      onClick={() => onSelect(s.session_id)}
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: selected ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))' : 'var(--color-surface)',
        cursor: 'pointer',
        marginBottom: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          {fmt(s.captured_at)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={e => { e.stopPropagation(); onReprocess(s.session_id) }}
            disabled={reprocessing}
            title="Herverwerk alle poule-captures in deze sessie"
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 5, cursor: reprocessing ? 'default' : 'pointer',
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text-muted)', fontFamily: 'inherit', opacity: reprocessing ? 0.5 : 1,
            }}
          >
            🔄 herverwerk
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(s.session_id) }}
            disabled={deleting}
            title="Verwijder deze sessie uit het archief"
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 5, cursor: deleting ? 'default' : 'pointer',
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text-muted)', fontFamily: 'inherit', opacity: deleting ? 0.5 : 1,
            }}
          >
            🗑
          </button>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 99,
            background: 'var(--color-surface-2)', color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
          }}>
            {s.item_count} item{s.item_count === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      {s.competitions.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
          {s.competitions.join(' · ')}
        </div>
      )}
    </div>
  )
}
