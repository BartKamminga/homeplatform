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

  const cell = { padding: 6, verticalAlign: 'top' }
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
        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
          {active && kind !== 'site' && (
            <button onClick={copy} className="yof-btn-secondary">{copied ? 'OK!' : 'Kopieer'}</button>
          )}
          {canRevoke && (
            <button onClick={e => { e.stopPropagation(); onRevoke(link) }} className="yof-btn-secondary" style={{ marginLeft: 4 }}>
              Intrekken
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ padding: '4px 6px 10px 18px', background: '#fafafa' }}>
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

export default function LinkOverview({ overview, onChanged }) {
  const [showInactive, setShowInactive] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  async function revoke(link) {
    if (!(await confirm(`Link "${link.label}" (${link.code}) intrekken? Wie de link heeft, kan de pagina daarna niet meer openen.`))) return
    await revokeShortLink(link.code)
    onChanged()
  }

  return (
    <div>
      {confirmDialog}
      <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 10 }}>
        <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
        {' '}Ook verlopen en ingetrokken linkjes tonen
      </label>
      {SECTIONS.map(s => {
        const rows = (overview[s.key] || []).filter(l => showInactive || l.status === 'active')
        return (
          <div key={s.key} style={{ marginBottom: 18 }}>
            <h4 style={{ fontSize: 14, margin: '0 0 4px' }}>
              {s.title} <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>· {s.hint}</span>
            </h4>
            {rows.length === 0 ? (
              <p style={{ fontSize: 12, color: '#999', margin: 0 }}>Geen {showInactive ? '' : 'geldige '}linkjes.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#888' }}>
                    <th style={{ padding: 6 }}>Link</th>
                    <th style={{ padding: 6 }}>Status</th>
                    <th style={{ padding: 6, textAlign: 'right' }}>Geopend</th>
                    <th style={{ padding: 6, textAlign: 'right' }}>Uniek</th>
                    <th style={{ padding: 6 }}>Laatste bezoek</th>
                    <th style={{ padding: 6 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(l => <LinkRow key={l.code} kind={s.key} link={l} onRevoke={revoke} />)}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}
