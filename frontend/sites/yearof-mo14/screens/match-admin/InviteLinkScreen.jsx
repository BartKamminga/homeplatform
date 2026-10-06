import LinkPanel from '../LinkPanel.jsx'
import InviteCreateForm from '../InviteCreateForm.jsx'

// Invullinkjes van deze wedstrijd: maken (formulier in het blok) + bestaande
// links met invul-status, bezoeken en kopieer - via het generieke LinkPanel.
export function InviteLinkScreen({ matchRef, players, onBack }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>&larr; terug</button>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Invullinkje versturen</h3>
      <LinkPanel kinds={['contribute']} filter={l => l.match_ref === matchRef}
        actions={{ contribute: (_, reload) => <InviteCreateForm matchRef={matchRef} players={players} onCreated={reload} /> }} />
    </div>
  )
}
