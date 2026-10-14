# MyHome — plan: het huis netjes inregelen, en daarna voor anderen

*14-10-2026 · vervolg op [myhome-onderzoek.md](myhome-onderzoek.md) · roadmap 1314, 1317, 1322*

**Besluit 14-10:** nog niets naar HA pushen. Eerst moet het eigen huis netjes in te regelen zijn, en moet er een plan
liggen om dat ook voor anderen te doen. Of daar een agent-sessie bij hoort, is nog open; dit plan zet de opties naast elkaar.

## 1. Waar staan we

- Het huis staat in MyHome (prod), met 3 verdiepingen, 26 ruimtes en 183 apparaten. De sync en live-status uit HA lopen.
- Push naar HA is gebouwd maar staat uit. De pagina **vs HA** toont alleen de verschillen. Het HA-deel
  staat los in `tools/myhome/ha/myhome_push.yaml` en is niet geïnstalleerd.
- Het opbouwen van het model ging vandaag via een agent-sessie (deze): drie tekeningen en twee foto's, en in een paar
  minuten een model. Daarbij is de spiegeling herkend via de voorgevel, en is het model gecontroleerd tegen BAG
  (219 m² gebruiksoppervlak tegen 210 m² in het model). De verbouwing van de 1e etage moest met een script, omdat de app
  dat nog niet kan.

## 2. Wat er nodig is om het eigen huis netjes in te regelen

Op volgorde van wat het meest scheelt. Alles hieronder werkt zonder AI.

| # | Onderdeel | Waarom (gezien bij het eigen huis) |
|---|---|---|
| 1 | **Ruimtes toevoegen, splitsen, samenvoegen, verwijderen** in de plan-modus | De walk-in closet, de gang van de Tinyhouse en het verdelen van de kasten kon niet in de app. |
| 2 | **Gedeelde muren**: een hoekpunt verslepen schuift de buurruimte mee | Nu kan elke ruimte los bewegen, waardoor er kieren en overlap ontstaan. |
| 3 | **Ongedaan maken** | Met echt tekenwerk moet je terug kunnen. Een versietijdlijn is niet nodig (besluit 14-10). |
| 4 | **Inregel-checklist** met wat er nog openstaat | Bijvoorbeeld: twee ruimtes aan dezelfde HA-ruimte (Badkamer én Bedroom aan "Tinyhouse"; de Badkamer hoort niet bij de suite), 93 apparaten zonder ruimte, ruimtes zonder HA-ruimte, apparaten niet op de plattegrond. |
| 5 | **Apparaten in bulk koppelen** (meerdere tegelijk, of "alles uit HA-ruimte X naar ruimte Y") | 93 apparaten één voor één slepen is te veel werk (jouw antwoord 7: weinig invoertijd). |
| 6 | **Deuren en ramen** als onderdeel van een muur | Maakt de tekening leesbaar. Later is het ook de basis voor deur-/raamsensoren op de goede plek. |
| 7 | **Verdiepingen beheren** (naam, niveau, HA-verdieping) | "First floor" in HA is de begane grond. Dat moet in MyHome goed staan, voordat het ooit naar HA gaat. |
| 8 | **Eén werkplek**: productie is de bron, acc alleen om te testen | Vandaag stonden er wijzigingen op acc die niet op productie stonden en omgekeerd. |

## 3. Hoe iemand anders begint: de onboarding

| Stap | Zonder agent | Met agent (optioneel) |
|---|---|---|
| 1. Installeren | HA-app (add-on), zie het onderzoek §5 | idem |
| 2. **Start uit HA** | MyHome maakt per HA-verdieping de ruimtes aan als blokken, met de apparaten er al in. Je hebt meteen overzicht, zonder te tekenen. | idem |
| 3. **Plattegrond** | Tekening of foto als achtergrond, **schaal ijken** (twee punten aanklikken en de afstand invullen), ruimtes overtrekken | Tekeningen en foto's uploaden; de agent maakt de indeling (zoals vandaag), jij keurt goed |
| 4. Koppelen | Checklist (§2.4) en bulk-koppelen (§2.5) | De agent stelt koppelingen voor ("Room Thom" → kamer met bureau en lightstrip); jij bevestigt |
| 5. Correcties | Zelf in de plan-modus | In gewone taal ("de kasten zijn verdeeld over Thom en Steyn"), de agent past het aan (#1317) |
| 6. Later | Push naar HA (staat klaar, uit) | idem |

Stap 2 maakt het verschil voor anderen: je hebt al waarde voordat je ook maar één muur tekent.

## 4. Agent-sessie: wel of niet?

**Wat de agent vandaag goed deed:** drie makelaarstekeningen omzetten naar maten en polygonen. Uit een straatfoto
afleiden dat de tekening gespiegeld is. Uit een luchtfoto de oriëntatie halen. Controleren tegen BAG. En correcties in
gewone taal plus een ingekleurde schets omzetten naar een verbouwing. Dit is het werk dat gebruikers het minst leuk
vinden en het slechtst kunnen.

**Waar het wringt:** jouw uitgangspunt is lokaal en open source. Een agent kost geld per sessie, heeft een API-key nodig
en stuurt plattegronden naar buiten. Hij is niet altijd hetzelfde, dus je moet zijn werk nakijken. Of lokale
beeldmodellen goed genoeg zijn voor maatvoering, heb ik niet getest; ik schat van niet, maar dat is een aanname.

| Optie | Voor | Tegen |
|---|---|---|
| A. **Geen agent**: overtrekken met geijkte schaal + start uit HA | Volledig lokaal, voorspelbaar, open source zonder kosten | Meer werk voor de gebruiker |
| B. **Agent als optionele module** ("Import from drawing (AI)"), met eigen API-key | Snel en prettig voor wie wil; de kern blijft lokaal | Twee routes onderhouden; privacy-uitleg nodig |
| C. **Agent-sessie door jou** voor vrienden en familie (MindBox/Agent Control, #1317) | Je leert wat de agent echt moet kunnen voordat het in het product komt; geen keys bij gebruikers | Schaalt niet; hangt van jou af |
| D. **Lokaal model** (Ollama + vision) | Lokaal | Kwaliteit onbekend; eerst testen |

**Advies:** bouw de kern als **A**. Doe daarna een **pilot met 2–3 huizen via C** (jij draait de sessie), en beslis daarna
over **B**. D kun je meenemen als experiment in dezelfde pilot. Zo komt alles wat de agent doet ook als gewone functie in
de app, en blijft de agent een versneller in plaats van een voorwaarde.

## 5. Voorgestelde volgorde

1. **Inregel-gereedschap**: §2.1 tot en met §2.5 (ruimtes bewerken, gedeelde muren, ongedaan maken, checklist, bulk-koppelen).
2. **Eigen huis afmaken** met dat gereedschap. Klaar betekent: checklist leeg, of bewust geaccepteerd.
3. **Start uit HA + overtrekken met schaal** (§3, stap 2–3): de route voor anderen zonder agent.
4. **Pilot 2–3 huizen** met agent-sessie (C), en daarbij D testen.
5. **Besluit** over de agent-module (B) en over de HA-app (onderzoek §5). Pas daarna push naar HA aanzetten.

## 6. Besluiten van Bart (14-10)

1. **Pilot:** ja, met 2–3 huizen van familie of vrienden (optie C, met D als experiment).
2. **Versies:** ongedaan maken is genoeg; geen tijdlijn met versies.
3. **Tinyhouse:** alleen Study, Gang Tinyhouse, Douche en Bedroom (rechterkolom 1e etage). De Badkamer hoort er niet bij (gecorrigeerd 14-10).
4. **Zolder:** Kamer Lievelot is uitgebreid met de berging ernaast (17,2 m²).

Roadmap: de stappen uit §5 staan als items onder site `myhome`.
