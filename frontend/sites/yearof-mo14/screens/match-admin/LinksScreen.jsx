import { useState } from 'react'
import { createReportDirect } from '../../api.js'
import { defaultInstagramLinks, defaultVideoLinks, NewLinksEditor, ExistingLinksEditor } from '../ReportLinks.jsx'

export const LINKS_BLOCK_META = {
  instagram: { title: 'Instagram', reportTitle: 'Instagram', defaults: defaultInstagramLinks, linkType: 'instagram' },
  wedstrijd_beelden: { title: 'Wedstrijdbeelden', reportTitle: 'Wedstrijdbeelden', defaults: defaultVideoLinks, linkType: 'video' },
}

// Bewerkscherm van een Instagram-/Wedstrijdbeelden-blok: alleen de lijst met
// linkjes (type volgt uit het blok). Live/concept, wedstrijdlink, volgorde en
// verwijderen staan op het blok zelf op de wedstrijdpagina (item 1239).

export function LinksScreen({ matchRef, reportType, existingReport, insertAfterId, onBack, onRefresh }) {
  const meta = LINKS_BLOCK_META[reportType]
  const [links, setLinks] = useState(meta.defaults())
  const [error, setError] = useState('')

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

  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>&larr; terug</button>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>{meta.title}</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      {existingReport ? (
        <ExistingLinksEditor reportId={existingReport.id} links={existingReport.links || []} onChanged={onRefresh} fixedType={meta.linkType} />
      ) : (
        <>
          <NewLinksEditor links={links} onChange={setLinks} fixedType={meta.linkType} />
          <button onClick={create} className="yof-btn">Toevoegen</button>
        </>
      )}
    </div>
  )
}
