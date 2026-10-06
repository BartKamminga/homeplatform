import { createProfileLink } from '../api.js'
import LinkPanel, { CreateShortLinkButton } from './LinkPanel.jsx'
import InviteCreateForm from './InviteCreateForm.jsx'

// Alle linkjes van 1 speelster (uitklapper in de spelerslijst): spelerslinks,
// invullinks en haar profiellink - elk blok met zijn eigen maak-acties;
// kopieer/bekijk/intrekken per link in de rij.
export default function PlayerLinksPanel({ playerId }) {
  return (
    <LinkPanel kinds={['player', 'contribute', 'profile']} filter={l => l.player_id === playerId} actions={{
      // Spelerslink voor de Vrienden-van-groep: alleen het profiel, 10 dagen geldig
      player: (rows, reload) => (
        <CreateShortLinkButton rows={rows} body={{ player_id: playerId }} label="Maak spelerslink" onCreated={reload} />
      ),
      contribute: (_, reload) => <InviteCreateForm playerId={playerId} onCreated={reload} />,
      // Profiellink is permanent (1 per speelster): alleen maken als die er nog niet is
      profile: (rows, reload) => rows.length > 0 ? null : (
        <button onClick={() => createProfileLink(playerId).then(reload)} className="yof-btn-secondary">
          + Maak profiellink
        </button>
      ),
    }} />
  )
}
