import { useState } from 'react'
import { pill, fmtDuration, fmtBytes, Btn } from '../ui.jsx'
import { makeCmdConclusion, TYPE_BADGE } from '../queueShared.jsx'

const STATUS_COLOR = { pending: 'var(--color-text-muted)', in_progress: 'var(--color-warning)', done: 'var(--color-success)', failed: 'var(--color-danger)', skipped: 'var(--color-text-muted)' }
const STATUS_ICON  = { pending: '⏳', in_progress: '🔄', done: '✓', failed: '✗', skipped: '⏭' }

const TOOLTIPS = {
  slimScannen:      'Start een gecoördineerde scan: begint bij de club met de meeste missende poules, scant die door, voegt de gevonden poules toe, en gaat dan verder met de volgende club. Stopt automatisch als er niets meer te doen valt.',
  slimRefreshen:    'Herscant verouderde poules op prioriteit (nog niet beschikbaar).',
  clubsSync:        'Haalt de volledige clublijst op van de bond (hockey.nl). Gebruik dit als je nieuwe clubs verwacht die nog niet in het systeem staan.',
  competities:      'Haalt de nationale competitie-structuur op van de bond. Nodig als er nieuwe competities zijn bijgekomen.',
  clubsVullen:      'Zet alle clubs in de wachtrij voor een herscanning (scan_club cmds). Gebruik dit als je van alle clubs tegelijk nieuwe poule-ID\'s wilt ophalen.',
  poulesVullen:     'Zet alle missende poules in de wachtrij (get_poule cmds). Gebruik dit als de teams al bekende poule-ID\'s hebben maar de standen nog niet zijn opgehaald.',
  standsRefreshen:  'Zet alle verouderde poules in de wachtrij om standen en uitslagen bij te werken.',
  allesPollen:      'Zet alle poules ouder dan 1 dag in de wachtrij. Gebruik dit voor een volledige refresh van alle standen.',
}

export default function CmdQueueSection({ cmdQueue, cmdFilling, fillMsg, cmdOpen, setCmdOpen, onFill, onClear, onRetryAll, onClearDone, onRetrySingle, cmdOps, smartScan, smartBusy, onStartSmartScan, onStopSmartScan }) {
  const { cmdBtn } = cmdOps
  const [advOpen, setAdvOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
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

  const borderColor = failed > 0 && !isRunning ? 'var(--color-danger)' : isRunning ? 'var(--color-warning)' : done > 0 ? 'var(--color-success)' : 'var(--color-border)'

  return (
    <div style={{ background: 'var(--color-surface)', border: `1px solid ${borderColor}`, borderRadius: 10, overflow: 'hidden' }}>
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
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Feedback / status */}
          {(fillMsg || smartScan?.active) && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {fillMsg && <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>{fillMsg}</span>}
              {smartScan?.active && (
                <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>
                  🎯 Slim scannen actief — {smartScan.cmd_count} cmds verwerkt
                </span>
              )}
            </div>
          )}

          {/* Beheer (conditioneel) */}
          {(failed > 0 || (pending + inProgress) > 0 || (done + skipped) > 0) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', paddingTop: 2, borderTop: '1px solid var(--color-border)' }}>
              {failed > 0 && (
                <Btn onClick={onRetryAll} color='var(--color-warning)'>↺ Retry alle ({failed})</Btn>
              )}
              {(pending + inProgress) > 0 && (
                <Btn onClick={onClear} color='var(--color-danger)'>🗑 Pending leeg</Btn>
              )}
              {(done + skipped) > 0 && !(pending + inProgress) && (
                <Btn onClick={onClearDone}>🗑 Done wissen</Btn>
              )}
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
                const color  = c.filtered_out ? 'var(--color-warning)' : (STATUS_COLOR[c.status] || 'var(--color-text-muted)')
                const icon   = c.filtered_out ? '⏸' : (STATUS_ICON[c.status]  || '?')
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
                        {c.filtered_out && <span style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: 10 }}> · buiten filter</span>}
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
              Queue leeg — open Acties hieronder om te starten
            </div>
          )}

          {/* Acties (inklapbaar, onderaan - item 734) */}
          <div style={{ paddingTop: 4, borderTop: '1px solid var(--color-border)' }}>
            <div
              onClick={() => setActionsOpen(o => !o)}
              style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.04em', cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span>{actionsOpen ? '▾' : '▸'}</span>
              <span>ACTIES</span>
            </div>
            {actionsOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>

                {/* Primair */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {smartScan?.active ? (
                    <Btn onClick={onStopSmartScan} color='var(--color-warning)' filled tooltip={TOOLTIPS.slimScannen}>
                      ⏹ Stop slim scannen ({smartScan.cmd_count}/{smartScan.max_cmds})
                    </Btn>
                  ) : (
                    <Btn onClick={onStartSmartScan} disabled={smartBusy || !!cmdFilling} color='var(--color-primary)' filled tooltip={TOOLTIPS.slimScannen}>
                      {smartBusy ? '…' : '🎯 Slim scannen'}
                    </Btn>
                  )}
                  <Btn disabled tooltip={TOOLTIPS.slimRefreshen} color='var(--color-text-muted)'>
                    🔄 Slim refreshen
                  </Btn>
                </div>

                {/* Infra */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.04em', minWidth: 40 }}>INFRA</span>
                  {cmdBtn('get_clubs',        { label: 'Alle clubs' },            '⟳ Clubs sync',  '#7c3aed', 'md', TOOLTIPS.clubsSync)}
                  {cmdBtn('get_competitions', { label: 'Nationale competities' }, '⟳ Competities', '#b45309', 'md', TOOLTIPS.competities)}
                </div>

                {/* Geavanceerd (inklapbaar) */}
                <div>
                  <div
                    onClick={() => setAdvOpen(o => !o)}
                    style={{ fontSize: 11, color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <span>{advOpen ? '▾' : '▸'}</span>
                    <span>Geavanceerd (bulk)</span>
                  </div>
                  {advOpen && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                      <Btn onClick={() => onFill('clubs')} disabled={!!cmdFilling} tooltip={TOOLTIPS.clubsVullen}>
                        {cmdFilling === 'clubs' ? '…' : '1. Clubs vullen'}
                      </Btn>
                      <Btn onClick={() => onFill('poules')} disabled={!!cmdFilling} tooltip={TOOLTIPS.poulesVullen}>
                        {cmdFilling === 'poules' ? '…' : '2. Poules vullen'}
                      </Btn>
                      <Btn onClick={() => onFill('poules_refresh')} disabled={!!cmdFilling} color='var(--color-primary)' tooltip={TOOLTIPS.standsRefreshen}>
                        {cmdFilling === 'poules_refresh' ? '…' : '⟳ Stands refreshen'}
                      </Btn>
                      <Btn onClick={() => onFill('poules_refresh', 1)} disabled={!!cmdFilling} color='var(--color-primary)' filled tooltip={TOOLTIPS.allesPollen}>
                        {cmdFilling === 'poules_refresh' ? '…' : '📡 Alles pollen'}
                      </Btn>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
