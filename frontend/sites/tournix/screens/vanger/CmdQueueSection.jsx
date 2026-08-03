import { pill, fmtDuration, fmtBytes, makeCmdConclusion, TYPE_BADGE } from '../queueShared.jsx'

const STATUS_COLOR = { pending: 'var(--color-text-muted)', in_progress: 'var(--color-warning)', done: 'var(--color-success)', failed: 'var(--color-danger)', skipped: 'var(--color-text-muted)' }
const STATUS_ICON  = { pending: '⏳', in_progress: '🔄', done: '✓', failed: '✗', skipped: '⏭' }

export default function CmdQueueSection({ cmdQueue, cmdFilling, fillMsg, gapData, gapFilling, cmdOpen, setCmdOpen, onFill, onClear, onRetryAll, onClearDone, onGapFill, onGapRefresh, onRetrySingle, cmdOps }) {
  const { cmdBtn } = cmdOps
  const counts     = cmdQueue?.counts || {}
  const recent     = cmdQueue?.recent || []
  const pending    = counts.pending     || 0
  const inProgress = counts.in_progress || 0
  const done       = counts.done        || 0
  const failed     = counts.failed      || 0
  const skipped    = counts.skipped     || 0
  const hasAny     = pending + inProgress + done + failed + skipped > 0
  const total      = pending + inProgress + done + failed + skipped
  const finished   = done + failed + skipped
  const progress   = total > 0 ? Math.round((finished / total) * 100) : 0
  const isRunning  = inProgress > 0 || pending > 0

  return (
    <div style={{ background: 'var(--color-surface)', border: `1px solid ${failed > 0 && !isRunning ? 'var(--color-danger)' : isRunning ? 'var(--color-warning)' : done > 0 ? 'var(--color-success)' : 'var(--color-border)'}`, borderRadius: 10, overflow: 'hidden' }}>
      <div onClick={() => setCmdOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 12 }}>{cmdOpen ? '▾' : '▸'}</span>
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>⚡ Cmd queue</span>
        {inProgress > 0 && <span style={{ fontSize: 11, color: 'var(--color-warning)', fontWeight: 700 }}>● {inProgress} bezig</span>}
        {pending > 0    && <span style={pill('partial')}>{pending} wacht</span>}
        {done > 0       && <span style={pill('ok')}>✓ {done}</span>}
        {failed > 0     && <span style={{ ...pill('muted'), color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>✗ {failed}</span>}
        {skipped > 0    && <span style={pill('muted')}>⏭ {skipped}</span>}
      </div>

      {isRunning && total > 1 && (
        <div style={{ height: 2, background: 'var(--color-border)' }}>
          <div style={{ height: '100%', width: progress + '%', background: 'var(--color-warning)', transition: 'width 0.5s ease' }} />
        </div>
      )}

      {cmdOpen && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => onFill('clubs')} disabled={!!cmdFilling}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit', opacity: cmdFilling === 'clubs' ? 0.6 : 1 }}>
              {cmdFilling === 'clubs' ? '…' : '1. Clubs vullen'}
            </button>
            <button onClick={() => onFill('poules')} disabled={!!cmdFilling}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit', opacity: cmdFilling === 'poules' ? 0.6 : 1 }}>
              {cmdFilling === 'poules' ? '…' : '2. Poules vullen'}
            </button>
            <button onClick={() => onFill('poules_refresh')} disabled={!!cmdFilling}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-primary)', background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontFamily: 'inherit', opacity: cmdFilling === 'poules_refresh' ? 0.6 : 1 }}>
              {cmdFilling === 'poules_refresh' ? '…' : '⟳ Stands refreshen'}
            </button>
            <button onClick={() => onFill('poules_refresh', 1)} disabled={!!cmdFilling}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: cmdFilling === 'poules_refresh' ? 0.6 : 1 }}>
              {cmdFilling === 'poules_refresh' ? '…' : '📡 Alles pollen'}
            </button>
            <button onClick={onGapFill} disabled={gapFilling || !!cmdFilling}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-warning)', background: 'none', color: 'var(--color-warning)', cursor: 'pointer', fontFamily: 'inherit', opacity: gapFilling ? 0.6 : 1 }}>
              {gapFilling ? '…' : '🔍 Gap-fill auto'}
            </button>
            {cmdBtn('get_clubs',       { label: 'Alle clubs' },            '⟳ Clubs sync',  '#7c3aed', 'md')}
            {cmdBtn('get_competitions', { label: 'Nationale competities' }, '⟳ Competities', '#b45309', 'md')}
            {fillMsg && <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>{fillMsg}</span>}
            {failed > 0 && (
              <button onClick={onRetryAll} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-warning)', background: 'none', color: 'var(--color-warning)', cursor: 'pointer', fontFamily: 'inherit' }}>
                ↺ Retry alle ({failed})
              </button>
            )}
            {(pending + inProgress) > 0 && (
              <button onClick={onClear} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-danger)', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontFamily: 'inherit' }}>
                🗑 Pending leeg
              </button>
            )}
            {(done + skipped) > 0 && !(pending + inProgress) && (
              <button onClick={onClearDone} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
                🗑 Done wissen
              </button>
            )}
          </div>

          {gapData && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '6px 8px', background: 'color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))', borderRadius: 6, border: '1px solid color-mix(in srgb, var(--color-primary) 15%, transparent)', fontSize: 11 }}>
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Gap {gapData.season}:</span>
              <span style={{ color: gapData.poules.stale > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{gapData.poules.stale} poules verouderd</span>
              <span style={{ color: gapData.clubs.unscanned > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{gapData.clubs.unscanned} clubs onbekend</span>
              <span style={{ color: 'var(--color-text-muted)' }}>→ {gapData.queue_recommendation.get_poule_cmds} poule + {gapData.queue_recommendation.scan_club_cmds} club cmds aanbevolen</span>
              <button onClick={onGapRefresh} style={{ fontSize: 10, padding: '0 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>↺</button>
            </div>
          )}

          {isRunning && total > 0 && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '4px 8px', background: 'color-mix(in srgb, var(--color-warning) 8%, var(--color-surface))', borderRadius: 6, border: '1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)' }}>
              🔄 {finished}/{total} klaar ({progress}%) — {pending} in wacht{inProgress > 0 ? `, ${inProgress} bezig` : ''}
            </div>
          )}

          {recent.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 380, overflowY: 'auto', borderRadius: 6, border: '1px solid var(--color-border)' }}>
              {recent.map(c => {
                const p      = c.params || {}
                const label  = p.label || p.external_id || '–'
                const subId  = c.cmd_type === 'get_poule' ? p.poule_id : p.external_id
                const badge  = TYPE_BADGE[c.cmd_type]
                const summ   = c.result_summary
                const concl  = summ ? makeCmdConclusion(c, summ) : null
                const durStr = summ?.duration_ms != null ? fmtDuration(summ.duration_ms) : null
                const szStr  = summ?.raw_bytes ? fmtBytes(summ.raw_bytes) : null
                const color  = STATUS_COLOR[c.status] || 'var(--color-text-muted)'
                const icon   = STATUS_ICON[c.status]  || '?'
                const fin    = c.finished_at ? new Date(c.finished_at + 'Z').toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null
                return (
                  <div key={c.id} style={{ padding: '5px 2px', borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                      <span style={{ color, fontWeight: 700, fontSize: 12, flexShrink: 0, width: 14 }}>{icon}</span>
                      {badge && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: badge.bg, color: badge.color, flexShrink: 0, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                          {badge.label}
                        </span>
                      )}
                      <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {label}
                        {subId && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> · #{subId}</span>}
                      </span>
                      {durStr && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{durStr}</span>}
                      {fin    && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fin}</span>}
                      {c.status === 'failed' && (
                        <button onClick={() => onRetrySingle(c.id)} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', flexShrink: 0 }}>↺</button>
                      )}
                    </div>
                    {(concl || c.error) && (
                      <div style={{ marginLeft: 19, marginTop: 2, fontSize: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: c.error ? 'var(--color-danger)' : 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.error || concl}
                        </span>
                        {szStr && <span style={{ color: 'var(--color-text-muted)', opacity: 0.6, flexShrink: 0 }}>{szStr}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!hasAny && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Queue leeg — vul met poules of clubs, of voeg individuele items toe via de queues hieronder
            </div>
          )}
        </div>
      )}
    </div>
  )
}
