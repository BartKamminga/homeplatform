import Modal from '@components/Modal.jsx'
import CopyButton from '@components/CopyButton.jsx'

// Item 1053: uitgelicht uit CommandsPage.jsx (bestandsgrens-afspraak) - de
// "bekijk + kopieer MindBox.ps1"-modal, incl. onboarding-stappen voor een
// nieuwe machine (Bart: "zodat ik om de download-scans heen kan" - sommige
// omgevingen scannen/blokkeren .ps1-downloads, kopiëren naar het klembord
// omzeilt dat).
export default function ScriptModal({ scriptText, onClose }) {
  return (
    <Modal title="MindBox.ps1" onClose={onClose} width={760}>
      <div style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 16 }}>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li><b>Download</b>: kopieer de tekst hieronder naar een nieuw bestand <code>MindBox.ps1</code> (of gebruik "downloaden"), vanaf een nieuwe machine.</li>
          <li><b>Map openen in VSCode</b>: zet het bestand in een (lege) map, open die map in VSCode.</li>
          <li>
            <b>Eenmalig setup</b> (in een terminal, vóór je Claude Code start):
            <pre style={{ margin: '4px 0', padding: '6px 10px', background: 'var(--color-surface-2)', borderRadius: 6, fontSize: 12 }}>.\MindBox.ps1 -Setup -Env acc</pre>
            Dit vraagt om gebruikersnaam/wachtwoord en maakt een lokaal <code>.mindbox.config.acc.ps1</code>-bestand met een API-key aan. Dat bestand staat in <code>.gitignore</code> (<code>.mindbox.config.*.ps1</code>), dus het komt nooit in git terecht — puur lokaal op die machine.
          </li>
          <li><b>Nieuwe Claude Code-sessie starten</b> in diezelfde map — verder geen configuratie nodig, die ziet gewoon MindBox.ps1 + het configbestand liggen.</li>
          <li><b>Aan de slag</b>: kopieer een commando van de website (bv. <code>Acc.MindBox.Case.Run(#...)</code> van de Cases-pagina, of straks je eigen commando's uit de catalogus) en plak het in de chat. Claude Code herkent het en roept zelf <code>.\MindBox.ps1 -Explain -Command "..."</code> aan om de recipe op te vragen, en voert 'm uit.</li>
        </ol>
        <p style={{ marginTop: 10, color: 'var(--color-text-muted)' }}>
          Let op: aangezien je nu vanaf acc download, werkt dit zo alleen <b>binnen je thuisnetwerk</b> (acc is niet extern bereikbaar). Wil je dit ook buiten je LAN kunnen doen, dan moet eerst prod live (mergen naar <code>main</code>) en heb je het externe Cloudflare-domein nodig.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <CopyButton text={scriptText} label="Kopieer naar klembord" icon="⧉" />
        <a
          href="/api/mindbox/commands/script"
          download="MindBox.ps1"
          style={{ fontSize: 12, color: 'var(--color-text-muted)' }}
        >
          of toch downloaden
        </a>
      </div>
      <pre style={{
        margin: 0, padding: 12, maxHeight: '60vh', overflow: 'auto', fontSize: 11, lineHeight: 1.5,
        background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {scriptText || 'Laden...'}
      </pre>
    </Modal>
  )
}
