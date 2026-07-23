import { useState } from 'react'
import { api } from '@core/api.js'

export function VangerButton({ phaseId, tournamentId }) {
  const [state, setState] = useState('idle') // 'idle' | 'queuing' | 'done'

  async function handleClick(e) {
    e.stopPropagation()
    if (state !== 'idle') return
    setState('queuing')
    try {
      const url = tournamentId
        ? `/api/tournix/tournaments/${tournamentId}/sync`
        : `/api/tournix/phases/${phaseId}/sync`
      await api.post(url)
      setState('done')
    } catch { /* ignore — button resets anyway */ }
    setTimeout(() => setState('idle'), 1400)
  }

  const cls = `vbtn${state === 'queuing' ? ' vq' : ''}${state === 'done' ? ' vd' : ''}`

  return (
    <button
      className={cls}
      onClick={handleClick}
      title={state === 'done' ? 'Toegevoegd!' : 'Toevoegen aan vanger queue'}
    >
      {state === 'done' ? '✓' : 'V'}
    </button>
  )
}
