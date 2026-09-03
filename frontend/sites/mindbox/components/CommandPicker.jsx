import { useEffect, useState } from 'react'
import CopyButton from '@components/CopyButton.jsx'
import { buildCommandString } from '../utils.js'

// Item 1055 (vervolg, Bart): "geen onduidelijkheid meer, of maar 2 panels
// met duidelijk onderscheid" - vervangt een pill per commando (naast de
// echte applicatie-knoppen) door 1 dropdown + 1 kopieerknop, zodat een
// commando-rij nooit meer aanvoelt als "nog een knop" tussen de echte acties.
// `param` mag een vaste waarde zijn (bv. item.id) of een functie die op
// basis van het geselecteerde commando's param_kind de juiste waarde kiest
// (bv. caseObj.name vs caseObj.id - zie CasesPage).
export default function CommandPicker({ commands, param, env, title }) {
  const [selectedId, setSelectedId] = useState(commands[0]?.id || '')

  useEffect(() => {
    if (!commands.some(c => c.id === selectedId)) setSelectedId(commands[0]?.id || '')
  }, [commands])

  if (!commands.length) return null
  const selected = commands.find(c => c.id === selectedId) || commands[0]
  const resolvedParam = typeof param === 'function' ? param(selected) : param

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <select
        value={selected.id}
        onChange={e => setSelectedId(e.target.value)}
        title={title || 'Commando kiezen om in de terminal uit te voeren'}
        style={{ padding: '4px 6px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', maxWidth: 240 }}
      >
        {commands.map(c => (
          <option key={c.id} value={c.id}>{c.icon} {c.description || c.notation_key}</option>
        ))}
      </select>
      <CopyButton
        text={buildCommandString(selected, resolvedParam, env)}
        title={selected.description || selected.notation_key}
      />
    </span>
  )
}
