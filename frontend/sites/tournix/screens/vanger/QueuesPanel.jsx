import { api } from '@core/api.js'
import { pill } from '../queueShared.jsx'
import { ghostBtn } from '../styles.js'

export default function QueuesPanel({ pluginErrors, setPluginErrors, clubScanQueue, clubLogoMap, competitions, rangeData, inferResult, isInferring, expanded, errOpen, setErrOpen, toggle, onRunInfer, cmdOps }) {
  const { addSingleCmd, cmdAdding } = cmdOps

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
              onClick={() => { if (window.confirm('Alle plugin fouten wissen?')) api.delete('/api/tournix/discovery/plugin-errors').then(() => setPluginErrors([])) }}
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

      {/* Club-scan queue */}
      {clubScanQueue.total > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div onClick={() => toggle('club_scan_q')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 12 }}>{expanded.has('club_scan_q') ? '▾' : '▸'}</span>
            <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>🏢 Club-scan queue</span>
            <span style={{ ...pill('partial'), color: 'var(--color-warning)', borderColor: 'var(--color-warning)' }}>{clubScanQueue.total} clubs</span>
          </div>
          {expanded.has('club_scan_q') && (
            <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '4px 2px 8px', fontStyle: 'italic' }}>
                Poule gescand maar bond heeft nog geen nieuw seizoen — club opnieuw scannen om nieuwe poule-ID op te halen
              </div>
              {clubScanQueue.clubs.map(c => {
                const addKey   = 'scan_club_' + c.club_external_id
                const addState = cmdAdding[addKey]
                return (
                  <div key={c.club_external_id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 2px', fontSize: 11, borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
                    {clubLogoMap[c.club_external_id] && (
                      <img src={clubLogoMap[c.club_external_id]} alt="" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0, borderRadius: 2 }} />
                    )}
                    <span style={{ flex: 1 }}>{c.friendly_name || c.name}</span>
                    {c.city && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{c.city}</span>}
                    <span style={{ ...pill('partial'), fontSize: 10 }}>{c.pending_teams} teams</span>
                    <button
                      disabled={!!addState}
                      onClick={() => addSingleCmd('scan_club', { external_id: c.club_external_id, label: c.friendly_name || c.name })}
                      style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, cursor: addState ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0,
                        border: `1px solid ${addState === 'added' ? 'var(--color-success)' : addState === 'exists' ? 'var(--color-warning)' : 'var(--color-border)'}`,
                        background: 'none',
                        color: addState === 'added' ? 'var(--color-success)' : addState === 'exists' ? 'var(--color-warning)' : 'var(--color-text-muted)',
                        transition: 'color .2s, border-color .2s' }}>
                      {addState === 'adding' ? '…' : addState === 'added' ? '✓ toegevoegd' : addState === 'exists' ? '⚠ al in queue' : '+ cmd'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Competities queue */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div onClick={() => toggle('comp_q')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 12 }}>{expanded.has('comp_q') ? '▾' : '▸'}</span>
          <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>🏆 Competities queue</span>
          {competitions.length > 0
            ? <span style={pill('muted')}>{competitions.length} beschikbaar</span>
            : <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>leeg</span>}
        </div>
        {expanded.has('comp_q') && (
          <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {competitions.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '4px 2px 8px', fontStyle: 'italic' }}>
                Nog geen competities — klik eerst op ⟳ Competities hierboven en laat de vanger draaien
              </div>
            )}
            {['VE', 'ZA', ''].map(ht => {
              const group = competitions.filter(c => ht === '' ? (!c.hockey_type || (c.hockey_type !== 'VE' && c.hockey_type !== 'ZA')) : c.hockey_type === ht)
              if (!group.length) return null
              const htLabel = ht === 'VE' ? '🏑 Veldhockey' : ht === 'ZA' ? '🏒 Zaalhockey' : '⚪ Overig'
              return (
                <div key={ht || 'other'}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.04em', padding: '6px 2px 3px', borderBottom: '1px solid var(--color-border)', marginBottom: 2 }}>
                    {htLabel}
                  </div>
                  {group.map(c => {
                    const addKey   = 'get_competition_detail_' + c.hl_comp_id
                    const addState = cmdAdding[addKey]
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 2px', fontSize: 11, borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
                        <span style={{ flex: 1 }}>{c.name}</span>
                        {c.class_name && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{c.class_name}</span>}
                        {c.poule_count > 0 && <span style={{ ...pill('ok'), fontSize: 10 }}>{c.poule_count} poules</span>}
                        {c.hl_comp_id && (
                          <button
                            disabled={!!addState}
                            onClick={() => addSingleCmd('get_competition_detail', { comp_id: c.hl_comp_id, label: c.name })}
                            style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, cursor: addState ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0,
                              border: `1px solid ${addState === 'added' ? 'var(--color-success)' : addState === 'exists' ? 'var(--color-warning)' : 'var(--color-border)'}`,
                              background: 'none',
                              color: addState === 'added' ? 'var(--color-success)' : addState === 'exists' ? 'var(--color-warning)' : 'var(--color-text-muted)',
                              transition: 'color .2s, border-color .2s' }}>
                            {addState === 'adding' ? '…' : addState === 'added' ? '✓ toegevoegd' : addState === 'exists' ? '⚠ al in queue' : '+ cmd'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

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
