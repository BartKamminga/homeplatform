# MindBox — knelpunten (item 1356)

**Datum:** 15 oktober 2026 · **Aanleiding:** Bart gebruikt MindBox niet, "omdat het niet lekker werkt — eigenlijk alles".
**Besluit:** eerst Dossiers (item 1355) bouwen en een paar weken gebruiken; daarna kiezen tussen MindBox repareren,
het bruikbare deel overnemen in Dossiers, of MindBox uitfaseren. Dit document is de basis voor dat besluit.

Bevindingen komen uit de code en de werkwijze, niet uit gebruiksonderzoek. Vul aan met eigen ervaring (zie "Open vragen").

## Overzicht

| # | Knelpunt | Impact | Richting | Inschatting |
|---|---|---|---|---|
| 1 | Te veel begrippen | Hoog | Schrappen of overnemen in Dossiers | Groot |
| 2 | Toevoegen is omslachtig | Hoog | Overnemen in Dossiers (al opgelost daar) | Klein in MindBox |
| 3 | Geen zoekfunctie | Hoog | Overnemen in Dossiers (al opgelost daar) | Middel in MindBox |
| 4 | Werken met Claude is zwaar | Hoog | Vervangen door Dossier.ps1-werkwijze | Groot |
| 5 | Onoverzichtelijke, grote UI-bestanden | Middel | Herbouwen of uitfaseren | Groot |
| 6 | Verkeerde standaardserver in de CLI | Middel | **Opgelost** in dit item | Klein |
| 7 | Type-hint `_auto_extract` klopte niet | Laag | **Opgelost** (extractie gedeeld) | Klein |

## Toelichting

### 1. Te veel begrippen
Items, cases, links met vrije `link_type`s (`case_member`, `source_of`, `reply_to`, `related_to`, `duplicate_of`, `text_preview`,
`summary`), contexts, knowledge, contacts, deadlines, commands, case-events, responses-als-items en case-exports. Dat zijn
zeven tabbladen en ruim tien begrippen voor wat in de praktijk "een dossier met stukken en notities" is.
Iedere handeling vraagt eerst: welk begrip hoort hierbij? Dossiers heeft er twee (dossier, stuk) met een soort per stuk.

### 2. Toevoegen is omslachtig
- `.eml` stond niet in de toegestane extensies, terwijl de mail-vanger-plugin juist `.eml` exporteert. Mails uit Outlook Web
  konden dus niet direct in MindBox.
- Uploaden en koppelen aan een case zijn aparte stappen (met een case-suggestie die bevestigd moet worden).
- Eén bestand per upload in de API.
In Dossiers: meerdere bestanden tegelijk slepen, `.msg` en `.eml` met bijlagen, tekst plakken, link toevoegen, direct in het dossier.

### 3. Geen zoekfunctie
De MindBox-API en -site hebben geen zoekopdracht over titels of geëxtraheerde tekst. Terugvinden kan alleen door te bladeren.
Dossiers zoekt in een dossier en over alle dossiers heen.

### 4. Werken met Claude is zwaar
`MindBox.ps1` is 954 regels met ongeveer dertig switches, plus een commando-DSL in de database (`env.MindBox.Entity.Cmd(#id)`)
met recipes die via `-Explain` opgevraagd moeten worden, briefing-bestanden per item, `-RunInSession` en `-SaveSession`/`-LoadSession`.
Elke sessie begint met uitzoeken welk commando van toepassing is. In Dossiers: `-Get` levert één markdown-bestand met alles,
afsluiten met een sessienotitie, en een skill (`dossier-mail`) voor de mailronde.

### 5. Onoverzichtelijke UI
`CasesPage.jsx` (813 regels) en `ItemsPage.jsx` (561 regels) zijn ruim boven de 300-regelgrens, met inline styles overal en
knoppen die alleen een emoji tonen (⬇ ⤫ ✎ ✉️) zonder tekst. Lastig te scannen, lastig te onderhouden.
Het Engels-vertalen staat al als roadmap-item 1059 ("het is nu heel verwarrend").

### 6. Verkeerde standaardserver (opgelost)
Na de cutover van 06-10-2026 wees de standaard prod-URL in `MindBox.ps1` nog naar G4 (`192.168.30.232:8080`) in plaats van g5
(`192.168.30.49:8080`). Een `-Setup` op een nieuwe machine zonder opgegeven URL koppelde zo aan de oude omgeving.
Hetzelfde stond in `roadmap.ps1`; beide zijn aangepast.

### 7. Type-hint `_auto_extract` (opgelost)
De functie gaf vier waarden terug, de hint noemde er drie. De extractie staat nu in `services/text_extract.py` (gedeeld met
Dossiers, met `.eml`-ondersteuning); MindBox gebruikt die via aliassen, gedrag ongewijzigd (alle 68 MindBox-tests groen).

## Wat MindBox wél goed doet (meenemen)
- Mechanische tekstextractie (PDF, `.msg` met bijlagen, Word, OCR) — nu gedeeld.
- Duplicaatdetectie op inhoud (hash) — ook in Dossiers.
- Mailthreads herkennen op onderwerp (`reply_to`) — nog niet in Dossiers; kandidaat als blijkt dat het gemist wordt.
- Contacten per mailadres — bewust niet in Dossiers (namen horen niet in een dossier met samenvattingen).
- Deadlines — nog niet in Dossiers; kandidaat.

## Open vragen voor Bart
1. Welke MindBox-cases zijn nog in gebruik en moeten mee naar Dossiers? (Bijvoorbeeld "Aanbesteding Hosting/LVCb",
   "Inhuur Paul - hosting migratie".)
2. Mis je in Dossiers na een paar weken iets uit MindBox: contexts/persona's, contacten, deadlines, concept-antwoorden?
3. Wat irriteerde het meest in het dagelijks gebruik? Dat weegt zwaarder dan deze code-analyse.

## Voorstel voor het besluit (na ± 4 weken Dossiers)
- Gebruik je Dossiers en mis je niets wezenlijks: migreer de lopende cases (script: case → dossier, items → stukken,
  case-events → sessienotities) en zet MindBox op alleen-lezen, daarna uitfaseren.
- Mis je één of twee functies: neem die op in Dossiers (klein houden), daarna hetzelfde.
- Blijkt MindBox voor iets anders onmisbaar (bijv. mail-triage met concept-antwoorden): MindBox versmallen tot dat ene doel.
