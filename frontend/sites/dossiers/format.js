export const KIND_LABELS = {
  note: 'Note', mail: 'Mail', document: 'Document', link: 'Link', session: 'Session',
}

export function formatDate(value) {
  if (!value) return '-'
  // API levert naive UTC-datetimes zonder 'Z'
  const date = new Date(/Z|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Opdracht om in Claude Desktop te plakken voor een mailronde (skill dossier-mail).
export function mailRoundPrompt(dossier) {
  return [
    `Start a mail round for dossier "${dossier.name}" (slug: ${dossier.slug}) with the skill dossier-mail.`,
    'Open Outlook Web in the built-in browser, search with the dossier\'s mail criteria,',
    'and propose relevant mails to the dossier for review. Read only: never move, send or delete mail.',
  ].join(' ')
}
