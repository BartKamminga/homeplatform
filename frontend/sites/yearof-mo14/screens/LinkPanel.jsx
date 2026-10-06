import { useState, useEffect } from 'react'
import { getLinkOverview, revokeShortLink, createShortLink } from '../api.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'
import { SECTIONS, LinkSection } from './LinkOverview.jsx'
import LinkTotals from './LinkTotals.jsx'

// "+ Maak ...link" voor wedstrijd-/spelerslinks: alleen zolang er geen geldige
// link is (anders hergebruikt de backend die toch). Nieuwe nodig = eerst intrekken.
// Kopieer/Bekijk/Intrekken staan in de rij van de link zelf.
export function CreateShortLinkButton({ rows, body, label, onCreated }) {
  const [error, setError] = useState('')
  if (rows.some(l => l.status === 'active')) return null
  return (
    <>
      <button className="yof-btn-secondary"
        onClick={() => createShortLink(body).then(onCreated).catch(e => setError(e.message))}>
        + {label}
      </button>
      {error && <span style={{ color: '#c23b3b', fontSize: 12, marginLeft: 8 }}>{error}</span>}
    </>
  )
}

// Generiek linkjes-overzicht (items 1186/1193): haalt het overzicht op en toont
// per soort (kinds) een blok, eventueel gefilterd - bv. alleen de linkjes van
// 1 wedstrijd of 1 speelster. actions = { soort: (rows, reload) => knoppen }
// voor maken/kopiëren in het juiste blok. reloadKey ophogen = opnieuw ophalen.
export default function LinkPanel({ kinds = SECTIONS.map(s => s.key), filter = () => true, actions = {}, reloadKey = 0, showTotals = false }) {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [confirm, confirmDialog] = useConfirm()

  function load() {
    getLinkOverview().then(setOverview).catch(e => setError(e.message))
  }
  useEffect(load, [reloadKey])

  async function revoke(link) {
    if (!(await confirm(`Link "${link.label}" (${link.code}) intrekken? Wie de link heeft, kan de pagina daarna niet meer openen.`))) return
    await revokeShortLink(link.code)
    load()
  }

  if (error) return <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>
  if (!overview) return <p style={{ fontSize: 13 }}>Laden...</p>

  return (
    <div>
      {confirmDialog}
      {showTotals && <LinkTotals totals={overview.totals} />}
      {SECTIONS.filter(s => kinds.includes(s.key)).map(s => {
        const rows = (overview[s.key] || []).filter(filter)
        return (
          <LinkSection key={s.key} section={s} links={rows} onRevoke={revoke}
            actions={actions[s.key] ? actions[s.key](rows, load) : null} />
        )
      })}
    </div>
  )
}
