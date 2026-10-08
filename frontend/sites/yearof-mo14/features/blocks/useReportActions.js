import { updateReport, deleteReport, createReportDirect } from '../../api.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'

// Gedeelde acties voor de balk boven een bericht (item 1239): live/concept,
// In de kijker, verwijderen en een nieuw (concept)bericht aanmaken.
export default function useReportActions(reload) {
  const [confirm, confirmDialog] = useConfirm()
  const run = async (fn) => { await fn(); reload() }
  return {
    confirmDialog,
    toggleLive: r => run(() => updateReport(r.id, { status: r.status === 'published' ? 'concept' : 'published' })),
    toggleFeatured: r => run(() => updateReport(r.id, { featured: !r.featured })),
    remove: async r => {
      if (!(await confirm(`"${r.title}" verwijderen? Dit kan niet ongedaan gemaakt worden.`))) return
      await run(() => deleteReport(r.id))
    },
    createNews: (matchRef = null) => run(() => createReportDirect({
      match_ref: matchRef, report_type: 'nieuws', title: 'Nieuw bericht', body: '', status: 'concept', links: [],
    })),
  }
}
