import { api } from '@core/api.js'
import { pill } from '../queueShared.jsx'
import { ghostBtn } from '../styles.js'

export default function QueuesPanel({ pluginErrors, setPluginErrors, rangeData, inferResult, isInferring, errOpen, setErrOpen, onRunInfer }) {
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

      {/* ID-reeks per seizoen */}
      {rangeData && rangeData.seasons.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px' }}>
            <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>📊 Poule ID-reeks</span>
            <button onClick={onRunInfer} disabled={isInferring} style={{ ...ghostBtn, alignSelf: 'center' }}>
              {isInferring ? '⏳ bezig…' : '⚡ Infereer seizoen'}
            </button>
          </div>
          <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rangeData.seasons.map(s => (
              <div key={s.season} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '2px 0' }}>
                <span style={{ fontWeight: 600, minWidth: 72 }}>{s.season}</span>
                <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{s.min_id} – {s.max_id}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>({s.count} poules, span {s.span})</span>
                {s.gap_before > 0 && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>gap: {s.gap_before}</span>}
              </div>
            ))}
            {inferResult && (
              <div style={{ marginTop: 6, fontSize: 11, padding: '5px 8px', borderRadius: 6,
                background: 'color-mix(in srgb, var(--color-warning) 12%, var(--color-surface))',
                color: 'var(--color-warning)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>
                ⚡ {inferResult.marked_pending} teams → season_pending
                {inferResult.cleared_pending > 0 && `, ${inferResult.cleared_pending} gecleard`}
                {inferResult.marked_pending === 0 && inferResult.cleared_pending === 0 && ' — alles al correct'}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
