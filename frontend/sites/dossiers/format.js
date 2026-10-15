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

// Opdrachten om in Claude Desktop te plakken voor een mailronde (skill dossier-mail).
// env: "production" | "acceptance" | ... (uit /api/config); buiten productie moet Dossier.ps1 -Env acc gebruiken.
function envSuffix(env) {
  return env && env !== 'production' ? ' Use -Env acc for every Dossier.ps1 command (acceptance environment).' : ''
}

// Mailronde over alle dossiers: postvak IN + verzonden items, indelen in bestaande of nieuwe (voorgestelde) dossiers.
export function mailTriagePrompt(env) {
  return [
    'Start a mail round for all dossiers with the skill dossier-mail (mode: all dossiers).',
    'Read my Outlook inbox and sent items in screenshot mode (computer use) or in the built-in browser, since the last mail round',
    '(first time: the last 30 days). File every relevant mail as a proposal (summary only) in the matching dossier,',
    'and create a suggested dossier for topics that have none. Do not ask me per mail; I review everything in the Dossiers inbox.',
    'Read only: never move, send or delete mail.',
  ].join(' ') + envSuffix(env)
}

export function mailRoundPrompt(dossier, env) {
  return [
    `Start a mail round for dossier "${dossier.name}" (slug: ${dossier.slug}) with the skill dossier-mail.`,
    'Read my Outlook in screenshot mode (computer use) or in the built-in browser, search with the dossier\'s mail criteria,',
    'and post every matching mail to the dossier as a proposal (summary only) without asking me per mail; I review them on the dossier page.',
    'Read only: never move, send or delete mail.',
  ].join(' ') + envSuffix(env)
}
