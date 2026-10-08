import { useState, useEffect } from 'react'
import { getTimelineModeration } from '../../api.js'
import MatchAdminDetail from '../../screens/match-admin/index.jsx'

// Parijs-weekend in de beheerstudio (item 1239): de pagina is de vastgepinde
// bijzondere dag, dus hetzelfde bewerkscherm als een wedstrijdpagina.
export default function PinnedPageAdmin() {
  const [pinnedRef, setPinnedRef] = useState(undefined) // undefined = laden, null = geen
  const [error, setError] = useState('')

  useEffect(() => {
    getTimelineModeration()
      .then(items => setPinnedRef(items.find(it => it.is_pinned)?.match_ref || null))
      .catch(e => setError(e.message))
  }, [])

  if (error) return <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>
  if (pinnedRef === undefined) return null
  if (!pinnedRef) {
    return (
      <p style={{ fontSize: 13, color: '#666' }}>
        Er is nog geen Parijs-weekend-pagina. Maak onder Wedstrijden &amp; bijzondere dagen een bijzondere dag aan en vink &ldquo;vastpinnen&rdquo; aan.
      </p>
    )
  }
  return <MatchAdminDetail matchRef={pinnedRef} pinnedPage />
}
