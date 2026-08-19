import { api } from '@core/api.js'
import { pill } from '../queueShared.jsx'

export default function QueuesPanel({ pluginErrors, setPluginErrors, errOpen, setErrOpen }) {
  return (
    <>
      {/* Plugin fouten */}
      {pluginErrors.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-danger)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', userSelect: 'none' }}>
            <span onClick={() => setErrOpen(o => !o)} style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 12, cursor: 'pointer' }}>{errOpen ? '▾' : '▸'}</span>
            <span onClick={() => setErrOpen(o => !o)} style={{ fontWeight: 600, fontSize: 13, flex: 1, color: 'var(--color-danger)', cursor: 'pointer' }}>⚠️ Plugin fouten</span>
            <span style={pill('muted')}>{pluginErrors.length} recent</span>
            <button
              onClick={() => { if (window.confirm('Alle plugin fouten wissen?')) api.delete('/api/hockey/plugin-errors').then(() => setPluginErrors([])) }}
              style={{ fontSize: 11, padding: '2px 8px', background: 'none', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', borderRadius: 4, cursor: 'pointer' }}>
              legen
            </button>
          </div>
          {errOpen && (
            <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pluginErrors.map(e => (
                <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 6, fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(e.captured_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ color: 'var(--color-danger)' }}>
                    {e.message}
                    {e.meta?.context && <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>({e.meta.context})</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </>
  )
}
