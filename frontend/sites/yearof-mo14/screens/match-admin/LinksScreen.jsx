import { useState } from 'react'
import { createReportDirect, deleteReport, updateReport } from '../../api.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'
import { defaultInstagramLinks, defaultVideoLinks, NewLinksEditor, ExistingLinksEditor } from '../ReportLinks.jsx'

export const LINKS_BLOCK_META = {
  instagram: { title: 'Instagram', reportTitle: 'Instagram', defaults: defaultInstagramLinks },
  wedstrijd_beelden: { title: 'Wedstrijdbeelden', reportTitle: 'Wedstrijdbeelden', defaults: defaultVideoLinks },
}

export function LinksScreen({ matchRef, reportType, existingReport, insertAfterId, onBack, onRefresh }) {
  const meta = LINKS_BLOCK_META[reportType]
  const [links, setLinks] = useState(meta.defaults())
  const [error, setError] = useState('')
  const [confirm, confirmDialog] = useConfirm()

  async function create() {
    try {
      await createReportDirect({
        match_ref: matchRef, report_type: reportType, title: meta.reportTitle, body: '', status: 'published',
        links, insert_after_id: insertAfterId || null,
      })
      onBack()
    } catch (e) {
      setError(e.message)
    }
  }

  async function removeBlock() {
    if (!(await confirm(`Dit hele ${meta.title}-blok verwijderen (inclusief alle linkjes erin)? Dit kan niet ongedaan gemaakt worden.`))) return
    try {
      await deleteReport(existingReport.id)
      onBack()
    } catch (e) {
      setError(e.message)
    }
  }

  async function toggleBlockPublish() {
    try {
      await updateReport(existingReport.id, { status: existingReport.status === 'published' ? 'concept' : 'published' })
      onRefresh()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {confirmDialog}
      <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>&larr; terug</button>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>{meta.title}</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      {existingReport ? (
        <>
          {existingReport.status === 'concept' && (
            <span style={{ display: 'inline-block', background: '#fde68a', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, marginBottom: 10 }}>
              CONCEPT
            </span>
          )}
          <ExistingLinksEditor reportId={existingReport.id} links={existingReport.links || []} onChanged={onRefresh} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={toggleBlockPublish} className="yof-btn-secondary">
              {existingReport.status === 'published' ? `Hele ${meta.title}-blok naar concept` : `Hele ${meta.title}-blok publiceren`}
            </button>
            <button onClick={removeBlock} className="yof-btn-secondary">Verwijder dit blok</button>
          </div>
        </>
      ) : (
        <>
          <NewLinksEditor links={links} onChange={setLinks} />
          <button onClick={create} className="yof-btn">Toevoegen</button>
        </>
      )}
    </div>
  )
}
