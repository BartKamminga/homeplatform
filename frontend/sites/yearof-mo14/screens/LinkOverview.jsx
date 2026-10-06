import { Fragment, useState } from 'react'
import { revokeShortLink } from '../api.js'
import { copyToClipboard } from '../clipboard.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'

// Overzicht van alle deelbare linkjes met bezoekcijfers (item 1193).
// Klik op een rij voor de bezoeken per dag.

const SECTIONS = [
  { key: 'site', title: 'Sitelinks', hint: 'ouder-WhatsApp, hele site' },
  { key: 'match', title: 'Wedstrijdlinks', hint: 'Vrienden-van-WhatsApp, 1 wedstrijd' },
  { key: 'player', title: 'Spelerslinks', hint: 'Vrienden-van-WhatsApp, 1 speelster' },
  { key: 'contribute', title: 'Invullinks', hint: 'verslag/interview insturen' },
]

const STATUS_LABEL = { active: 'geldig', expired: 'verlopen', revoked: 'ingetrokken' }

const fmtDate = (iso) => iso ? iso.slice(0, 10) : '-'
const fmtDateTime = (iso) => iso ? iso.slice(0, 16).replace('T', ' ') : '-'

function linkUrl(kind, code) {
  if (kind === 'contribute') return `${window.location.origin}/yearof-mo14/?invul=${code}`
  return `${window.location.origin}/l/${code}`
}

function LinkRow({ kind, link, onRevoke }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const active = link.status === 'active'
  const canRevoke = active && (kind === 'match' || kind === 'player') && !link.legacy

  async function copy(e) {
    e.stopPropagation()
    try {
      await copyToClipboard(linkUrl(kind, link.code))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard werkt niet altijd zonder https - code staat in de rij */ }
  }

  const cell = { padding: '8px 12px', verticalAlign: 'top', overflowWrap: 'anywhere' }
  return (
    <Fragment>
      <tr onClick={() => setOpen(o => !o)} style={{ borderTop: '1px solid #eee', cursor: 'pointer', opacity: active ? 1 : 0.55 }}>
        <td style={cell}>
          <div style={{ fontWeight: 600 }}>{link.label}</div>
          <div style={{ color: '#999' }}>{link.code}{link.legacy ? ' · oude stijl' : ''}</div>
        </td>
        <td style={cell}>
          {STATUS_LABEL[link.status]}
          <div style={{ color: '#999' }}>t/m {fmtDate(link.expires_at)}</div>
        </td>
        <td style={{ ...cell, textAlign: 'right' }}><strong>{link.opens}</strong></td>
        <td style={{ ...cell, textAlign: 'right' }}><strong>{link.unique}</strong></td>
        <td style={cell}>{fmtDateTime(link.last_visit)}</td>
        <td style={cell}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
            {active && kind !== 'site' && (
              <button onClick={copy} className="yof-btn-secondary">{copied ? 'OK!' : 'Kopieer'}</button>
            )}
            {canRevoke && (
              <button onClick={e => { e.stopPropagation(); onRevoke(link) }} className="yof-btn-secondary">
                Intrekken
              </button>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ padding: '4px 12px 10px 24px', background: '#fafafa' }}>
            {link.days.length === 0 ? (
              <span style={{ color: '#999' }}>Nog geen bezoeken.</span>
            ) : (
              <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#888', textAlign: 'left' }}>
                    <th style={{ padding: '2px 12px 2px 0' }}>Dag</th>
                    <th style={{ padding: '2px 12px 2px 0', textAlign: 'right' }}>Geopend</th>
                    <th style={{ padding: '2px 0', textAlign: 'right' }}>Uniek</th>
                  </tr>
                </thead>
                <tbody>
                  {link.days.map(d => (
                    <tr key={d.date}>
                      <td style={{ padding: '2px 12px 2px 0' }}>{d.date}</td>
                      <td style={{ padding: '2px 12px 2px 0', textAlign: 'right' }}>{d.opens}</td>
                      <td style={{ padding: '2px 0', textAlign: 'right' }}>{d.unique}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  )
}

function LinkTable({ kind, rows, onRevoke }) {
  const th = { padding: '8px 12px' }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '34%' }} />
        <col style={{ width: '16%' }} />
        <col style={{ width: '9%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '15%' }} />
        <col style={{ width: '18%' }} />
      </colgroup>
      <thead>
        <tr style={{ textAlign: 'left', color: '#888' }}>
          <th style={th}>Link</th>
          <th style={th}>Status</th>
          <th style={{ ...th, textAlign: 'right' }}>Geopend</th>
          <th style={{ ...th, textAlign: 'right' }}>Uniek</th>
          <th style={th}>Laatste bezoek</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map(l => <LinkRow key={l.code} kind={kind} link={l} onRevoke={onRevoke} />)}
      </tbody>
    </table>
  )
}

// Eén blok per soort: geldige linkjes, daaronder inklapbare historie
// (verlopen/ingetrokken, nieuwste eerst) met hun bezoekcijfers.
function LinkSection({ section, links, onRevoke }) {
  const [showHistory, setShowHistory] = useState(false)
  const active = links.filter(l => l.status === 'active')
  const history = links.filter(l => l.status !== 'active')

  return (
    <div className="yof-card" style={{ marginBottom: 14, padding: 0, overflow: 'hidden', border: '1px solid #e6e9f0' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8, padding: '10px 12px',
        background: '#f4f6fb', borderBottom: '1px solid #e6e9f0', borderLeft: '4px solid #f4c81e',
      }}>
        <h4 style={{ fontSize: 14, margin: 0 }}>{section.title}</h4>
        <span style={{ color: '#888', fontSize: 12, flex: 1 }}>{section.hint}</span>
        <span style={{ fontSize: 12, fontWeight: 700, background: '#12203c', color: '#fff', borderRadius: 999, padding: '1px 8px' }}>
          {active.length}
        </span>
      </div>
      {active.length === 0
        ? <p style={{ fontSize: 12, color: '#999', margin: 0, padding: '10px 12px' }}>Geen geldige linkjes.</p>
        : <LinkTable kind={section.key} rows={active} onRevoke={onRevoke} />}
      {history.length > 0 && (
        <div style={{ borderTop: '1px solid #e6e9f0' }}>
          <button onClick={() => setShowHistory(h => !h)} style={{
            width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#12203c',
            background: '#fafafa', border: 'none', cursor: 'pointer', fontWeight: 600,
          }}>
            {showHistory ? '▾' : '▸'} Historie ({history.length})
          </button>
          {showHistory && <LinkTable kind={section.key} rows={history} onRevoke={onRevoke} />}
        </div>
      )}
    </div>
  )
}

export default function LinkOverview({ overview, onChanged }) {
  const [confirm, confirmDialog] = useConfirm()

  async function revoke(link) {
    if (!(await confirm(`Link "${link.label}" (${link.code}) intrekken? Wie de link heeft, kan de pagina daarna niet meer openen.`))) return
    await revokeShortLink(link.code)
    onChanged()
  }

  return (
    <div>
      {confirmDialog}
      {SECTIONS.map(s => <LinkSection key={s.key} section={s} links={overview[s.key] || []} onRevoke={revoke} />)}
    </div>
  )
}