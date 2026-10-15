import { useCallback, useEffect, useState } from 'react'
import { getDossier, listEntries } from '../api.js'
import SummaryPanel from '../components/SummaryPanel.jsx'
import AddPanel from '../components/AddPanel.jsx'
import ProposalsPanel from '../components/ProposalsPanel.jsx'
import EntryList from '../components/EntryList.jsx'

export default function DossierPage({ slug, onBack }) {
  const [dossier, setDossier] = useState(null)
  const [proposals, setProposals] = useState([])
  const [version, setVersion] = useState(0) // verhogen = lijst opnieuw laden
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const d = await getDossier(slug)
      setDossier(d)
      setProposals(await listEntries(d.id, { review: 'proposed' }))
      setVersion((v) => v + 1)
    } catch (e) { setError(e.message) }
  }, [slug])

  useEffect(() => { reload() }, [reload])

  if (error) return <div className="ds-page"><p className="ds-error">{error}</p></div>
  if (!dossier) return <div className="ds-page"><p className="ds-muted">Loading dossier…</p></div>

  return (
    <div className="ds-page">
      <button type="button" className="ds-link ds-back" onClick={onBack}>← All dossiers</button>
      <SummaryPanel dossier={dossier} onSaved={setDossier} />
      {proposals.length > 0 && <ProposalsPanel proposals={proposals} onChanged={reload} />}
      <AddPanel dossier={dossier} onAdded={reload} />
      <EntryList dossier={dossier} version={version} onChanged={reload} />
    </div>
  )
}
