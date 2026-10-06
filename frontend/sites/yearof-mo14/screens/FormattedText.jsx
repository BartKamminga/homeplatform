// Opmaak zoals in WhatsApp in ingevoerde teksten: *vet*, _cursief_, ~doorgehaald~.
// Zo werken ook teksten die uit WhatsApp geplakt worden meteen. Bouwt
// React-elementen (geen innerHTML), dus ingevoerde HTML blijft gewoon tekst.
//
// Regels (net als WhatsApp): de tekst tussen de tekens begint en eindigt niet
// met een spatie, blijft op 1 regel, en het teken staat niet midden in een
// woord - zo blijven bv. snake_case-namen en URLs met _ ongemoeid.

const TAGS = { '*': 'strong', '_': 'em', '~': 's' }
const PATTERN = /([*_~])(?=\S)([^\n]*?\S)\1/g
const WORD_CHAR = /[\p{L}\p{N}]/u

// wrap(tag, children, key) bepaalt wat er met een opgemaakt stuk gebeurt:
// renderen als element, of (stripFormatting) alleen de tekst houden.
function parse(text, wrap, key = 'f') {
  const out = []
  const re = new RegExp(PATTERN)
  let last = 0
  let m
  while ((m = re.exec(text))) {
    const before = text[m.index - 1]
    const after = text[m.index + m[0].length]
    if ((before && WORD_CHAR.test(before)) || (after && WORD_CHAR.test(after))) {
      re.lastIndex = m.index + 1
      continue
    }
    if (m.index > last) out.push(text.slice(last, m.index))
    const childKey = `${key}-${m.index}`
    out.push(wrap(TAGS[m[1]], parse(m[2], wrap, childKey), childKey))
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export default function FormattedText({ text }) {
  if (!text) return null
  return <>{parse(text, (Tag, children, key) => <Tag key={key}>{children}</Tag>)}</>
}

// Platte tekst zonder opmaaktekens - voor ingekorte voorvertoningen, waar een
// afgekapt *-teken anders los zou blijven staan.
export function stripFormatting(text) {
  if (!text) return ''
  const flatten = parts => parts.map(p => (Array.isArray(p) ? flatten(p) : p)).join('')
  return flatten(parse(text, (_tag, children) => children))
}
