import { useState, useEffect } from 'react'
import { getLinkOverview, revokeShortLink } from '../api.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'
import { SECTIONS, LinkSection } from './LinkOverview.jsx'
import LinkTotals from './LinkTotals.jsx'

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
