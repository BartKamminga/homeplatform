// Gedeelde leeftijd-helper voor de Vanger-queue-componenten (RFTR-B6, item
// 989, fase 6.5) - QueueFilterBar.jsx en PouleQueueSection.jsx hadden een
// letterlijk identieke regex (AGE_RE_G/AGE_RE).
const AGE_RE = /[JMjm][OZoz](\d+)-/

export function ageGroupFromShortName(shortName, fallback = null) {
  const m = AGE_RE.exec(shortName || '')
  return m ? 'O' + m[1] : fallback
}

// isJeugd is een ander concept (matcht op vrije competitienaam-tekst, niet op
// het team-shortname-prefixpatroon hierboven) - hier alleen her-geëxporteerd
// voor een centrale importplek, niet samengevoegd met ageGroupFromShortName.
export { isJeugd } from './discovery/discoveryHelpers.js'
