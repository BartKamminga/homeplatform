import { createProfileLink } from '../api.js'
import LinkPanel from './LinkPanel.jsx'
import PlayerLinkButtons from './PlayerLinkButtons.jsx'
import InviteCreateForm from './InviteCreateForm.jsx'

// Alle linkjes van 1 speelster (uitklapper in de spelerslijst): spelerslinks,
// invullinks en haar profiellink - elk blok met zijn eigen maak/kopieer-acties.
export default function PlayerLinksPanel({ playerId }) {
  return (
    <LinkPanel kinds={['player', 'contribute', 'profile']} filter={l => l.player_id === playerId} actions={{
      player: (_, reload) => <PlayerLinkButtons playerId={playerId} onCreated={reload} />,
      contribute: (_, reload) => <InviteCreateForm playerId={playerId} onCreated={reload} />,
      // Profiellink is permanent (1 per speelster): alleen maken als die er nog niet is
      profile: (rows, reload) => rows.length > 0 ? null : (
        <button onClick={() => createProfileLink(playerId).then(reload)} className="yof-btn-secondary">
          Maak profiellink
        </button>
      ),
    }} />
  )
}
