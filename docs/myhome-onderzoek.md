# MyHome — onderzoek naar mogelijkheden en richting

*13-10-2026 · roadmap 1314, 1317, 1318 · gebaseerd op de antwoorden van Bart op 10 kritische vragen*

## 1. Samenvatting en advies

1. **MyHome wordt geen zoveelste plattegrond-kaart.** Er zijn er al minstens zes (NextFloor, Houseplan, NeonPlan 3D,
   Easy Floorplan, Floorplan 3D, ha-floorplan). Het gat dat niemand vult: **één kloppend beeld van het huis als bron
   van waarheid voor namen en indeling**, plus alles wat geen plek heeft in HA (stopcontacten, netwerk, groepen,
   foto's, maten), plus een **leuke, levende weergave van wat er in HA gebeurt** (de eventbus).
2. **Doelvorm: een Home Assistant-app (add-on) met Ingress**, lokaal, open source. Daarmee blijven data en
   plattegronden in HA (en in de HA-backup, dus nu ook op de NAS), is er geen extra server of tunnel nodig, en kan
   MyHome namen en ruimtes netjes terugschrijven naar HA.
3. **De huidige HomePlatform-versie blijft het prototype.** Backend (FastAPI) en frontend (React, three.js) zijn
   herbruikbaar; de verhuizing naar een app is vooral verpakken, auth via HA, en opslag in `/data`.
4. **Volgorde:** eerst eenduidigheid (namen/ruimtes/verdiepingen kloppend krijgen, met voorstellen die HA bijwerken),
   dan het eventbus-speelgoed, dan open source uitbrengen, en 3D-wow als er tijd over is.

## 2. Uitgangspunten (antwoorden 13-10)

| # | Vraag | Antwoord | Gevolg |
|---|---|---|---|
| 1 | Voor wie | Eerst voor mezelf, later open source voor de HA-community | Generiek bouwen, maar geen onboarding/multi-tenant-werk vooraf |
| 2 | Toegang | Iedereen kan in zijn eigen kamer kijken | Kijkrechten per persoon per ruimte (zie §7) |
| 3 | Bron van waarheid | Het huis en de indeling, voor benamingen en indeling van ruimtes/devices | MyHome is leidend voor namen, ruimtes, verdiepingen; schrijft terug naar HA |
| 4 | Sturen | Niet; HA is leidend | Geen bediening in MyHome; alleen kijken en inrichten |
| 5 | Server/privacy | Nog onbekend | Antwoord: lokaal in HA (add-on); geen data naar buiten |
| 6 | Doel | Overzicht, eenduidigheid, en een grappige tool om "de MQ" van HA inzichtelijk te maken | Kernfuncties: registry-hygiëne + eventbus-visualisatie |
| 7 | Eigen invoertijd | Weinig | Zoveel mogelijk afleiden uit HA; gebruiker bevestigt alleen |
| 8 | Systemen | Zoveel mogelijk in HA; wat daar geen plek heeft in MyHome | MyHome voegt alleen toe wat HA niet kent |
| 9 | 3D | Wow-factor, alleen als er tijd over is | Laagste prioriteit; bestaande three.js-view volstaat voorlopig |
| 10 | Kosten | Lokaal en open source | Geen cloud-API's in het product (zie §9 over de agent) |

## 3. Wat er al bestaat

| Project | Wat het doet | Sterk | Ontbreekt t.o.v. MyHome |
|---|---|---|---|
| [NextFloor](https://community.home-assistant.io/t/nextfloor-draw-your-floor-plan-in-ha-and-see-the-house-live-in-3d-hacs-free/1027979) | Plattegrond tekenen in een HA-paneel, live 3D, lamp aan = ruimte licht op | Native in HA, 3D, live | Geen bron-van-waarheid, geen stroom/netwerk, geen eventbus-inzicht |
| [Houseplan card](https://github.com/Matysh/houseplan-card) | Ruimtes tekenen, koppelen aan area, apparaten verschijnen vanzelf | Area-koppeling, wandtablet | Kaart, geen registerbeheer; volgens de maker nog ruw |
| [NeonPlan 3D](https://github.com/Mastershort/neonplan3d) | Editor (muren, deuren, ramen, meubels, dak) + neon-3D met live bediening | Rijke editor | Focus op bediening en beeld, niet op eenduidigheid |
| [Easy Floorplan](https://github.com/nicosandller/easy-floorplan) | Drag-and-drop editor voor muren, deuren, tekst, bediening | Eenvoud | Idem |
| [ha-floorplan](https://github.com/CCOSTAN/ha-floorplan) | SVG die meekleurt met entity-states | Volwassen, flexibel | SVG zelf maken, geen model van het huis |
| [Floorplan 3D](https://community.home-assistant.io/t/floorplan-3d-a-home-assistant-3d-floorplan-card/902878), [Ready-made 3D](https://community.home-assistant.io/t/ready-made-3d-floorplan-for-home-assistant-physics-based-lighting-fully-offline-no-extra-tools/1012715) | 3D-kaarten met belichting | Wow | Alleen weergave |
| HA zelf: [Areas-dashboard](https://vahac.com/blogs/home-assistant-2026-4-new-features-areas-dashboard/) | Automatisch dashboard per ruimte (experimenteel) | Native | Geen plattegrond, geen controle of de indeling klopt |

**Conclusie:** weergave en bediening op een plattegrond zijn uitontwikkeld. Niemand helpt je om de **indeling zelf
kloppend** te krijgen en te houden, en niemand maakt de **eventbus** zichtbaar.

## 4. Wat MyHome uniek maakt

1. **Registry-hygiëne (eenduidigheid).** MyHome vergelijkt het huismodel met de HA-registers en geeft voorstellen:
   - verdiepingen: HA "First floor" = begane grond, level 1 → level 0;
   - weesruimtes: Bedroom, Den, Upstairs zonder verdieping of apparaten;
   - ruimtes die niet op de tekening bestaan (Tinyhouse, Study);
   - apparaten zonder ruimte (nu 136), verkeerde ruimte, of namen die niet passen ("Kerstboom" die geen kerstboom is);
   - naamconventie: `<ruimte> <functie>` (bv. "Keuken plafond", "Slaapkamer D bureaulamp"), toepasbaar met één klik.
   Elk voorstel toont een diff (huidig → voorgesteld) en wordt pas na bevestiging naar HA geschreven.
2. **Wat HA niet kent** (antwoord 8): stopcontacten, netwerkaansluitingen, access points, groepenkast en groepen,
   maten, muurkleuren, foto's per ruimte, notities. Dat zit al in het huidige model.
3. **De eventbus als speelgoed** (antwoord 6), zie §8.
4. **Blauwdrukken** (lichtplan Base/Task/Mood, netwerk/VLAN): adviezen per ruimtesoort, als voorstel, niet als bediening.

## 5. Architectuur: waar draait MyHome?

| Vorm | Wat | Voor | Tegen |
|---|---|---|---|
| **A. HomePlatform-site (nu)** | Losse site op G4/g5, HA pusht via REST | Werkt al, snel itereren | Data buiten HA, extra server, niet bruikbaar voor de community |
| **B. HA-app (add-on) met Ingress** ✔ | Docker-container in HA, eigen web-UI in de zijbalk via [Ingress](https://community.home-assistant.io/t/introducing-hass-io-ingress/111502?page=4) | Lokaal, HA-login, geen poorten, eigen backend en opslag, zit in de HA-backup, kan admin-websocket gebruiken | Alleen HA OS / Supervised (geen HA Container/Core) |
| C. Custom integration + `panel_custom` (HACS) | Python-integratie + JS-paneel in de HA-frontend | Werkt op elke installatie, HACS-distributie | Backend in HA-core-proces, beperkter, frontend in HA-stijl, zwaardere review ([HACS-eisen](https://hacs.xyz/docs/publish/start)) |
| D. Lovelace-kaart | Alleen frontend | Licht | Geen eigen opslag, geen registerbeheer |

**Advies: B, met later eventueel D als extra** (een kaart die de MyHome-plattegrond op een dashboard toont).
De huidige code is grotendeels herbruikbaar: FastAPI-backend → app-container met SQLite in `/data`; React-frontend
→ geserveerd achter Ingress; auth via de Ingress-headers in plaats van JWT/hp_-keys; de HA-koppeling gaat via de
Supervisor-token rechtstreeks op de websocket (geen REST-push en secrets meer nodig, ook geen VLAN-probleem).

Let op: Ingress-pagina's zijn [mogelijk ook voor niet-admins bereikbaar](https://community.home-assistant.io/t/possible-bug-able-to-access-app-ingress-as-normal-user-despite-panel-admin-being-set-to-true/1018296);
schrijfacties naar de HA-registers dus in de backend afschermen op admin.

## 6. Eén bron van waarheid: hoe de sync werkt

- **HA → MyHome (altijd):** apparaten, entities, ruimtes, verdiepingen, states. Dat werkt nu al via het package.
- **MyHome → HA (alleen na bevestiging):** ruimtenamen, verdiepingen + level, ruimte van een apparaat, apparaatnaam
  (`name_by_user`). Via de websocket-commando's van de registers (`config/area_registry/*`,
  `config/floor_registry/*`, `config/device_registry/update`). De device-registry-API is in
  [2026.8–2026.9 gewijzigd](https://developers.home-assistant.io/blog/2026/08/19/device-registry-websocket-api-changes)
  (één `config_entry_id` per device), dus op de nieuwe vorm bouwen. Nooit `.storage` direct bewerken; dat wordt
  teruggedraaid (bekende valkuil).
- **Conflictregel:** wat de gebruiker in MyHome heeft vastgesteld wint; wijzigingen in HA daarna worden als
  afwijking gemeld ("in HA staat dit apparaat nu in X, in MyHome in Y — welke klopt?"), niet stil overschreven.
- **Hue:** Hue-ruimtes en -zones volgen HA-ruimtes via een voorstel (alleen kijken; sturen doet HA).

## 7. Toegang per kamer (antwoord 2)

HA heeft geen rechten per ruimte; alleen admin/niet-admin ([discussie](https://github.com/orgs/home-assistant/discussions/1171),
[ha-rbac als custom integration](https://community.home-assistant.io/t/access-control-real-per-user-permissions-as-a-custom-integration/1022515)).
In de app kan MyHome de HA-gebruiker uit de Ingress-headers koppelen aan ruimtes: Thom ziet zijn kamer, de
gemeenschappelijke ruimtes en de rest grijs. Eerlijk: dat is een **weergavegrens, geen beveiligingsgrens**; wie in HA
zelf rondklikt ziet alles. Voor een gezin is dat passend.

## 8. "De MQ van HA inzichtelijk maken" (antwoord 6)

Data: `subscribe_events` (state_changed, automation_triggered, call_service) via de websocket; optioneel MQTT-topics
van Zigbee2MQTT. Ideeën, van makkelijk naar leuk:

1. **Live-ticker per ruimte:** events verschijnen als korte "pings" op de plattegrond (staat er nu deels: gloed, OPEN, puls).
2. **Hartslag van het huis:** events per minuut per ruimte als hittekaart over de dag; 's nachts zie je wie er wakker is.
3. **Kletskousen:** top 10 apparaten die de meeste events sturen (vaak een slecht ingestelde sensor die elke seconde rapporteert).
4. **Automation-bogen:** als een automation afgaat, een boog van het triggerende apparaat naar het aangestuurde apparaat
   op de plattegrond. Maakt in één oogopslag zichtbaar "beweging in de hal → licht overloop".
5. **Afspelen:** de dag terugspoelen als animatie (wie liep waar, welke lampen gingen aan).
6. **Zigbee-mesh:** routes en linkkwaliteit uit Zigbee2MQTT over de plattegrond; zwakke plekken direct zichtbaar.
7. **Stilte-alarm:** apparaten die al dagen niets meer melden (batterij leeg, buiten bereik).

Punt 4 en 6 zijn voor zover gevonden nergens anders te krijgen; dat is de "grappige tool" en meteen nuttig.

## 9. Weinig invoer (antwoord 7) en lokaal/open source (antwoord 10)

- **Afleiden in plaats van invoeren:** ruimtes en apparaten komen uit HA; plattegronden worden één keer ingelezen;
  daarna alleen bevestigen. Plaatsen op de plattegrond is optioneel (een apparaat in de juiste ruimte is genoeg voor
  eenduidigheid).
- **Spanning met item 1317 (agent):** "Process all input" leunt op Claude en dat is niet lokaal. Voorstel: in het
  open-sourceproduct een **lokale route** (regels + optioneel een lokaal model via Ollama voor foto's/tekst), en de
  Claude-agent alleen als persoonlijk gereedschap voor Bart tijdens de opbouw.
- **Plattegrond inlezen lokaal:** zonder AI blijft over: overtrekken op een achtergrondfoto (zoals NextFloor) of een
  eenvoudige rechthoek-editor. Dat is voor de community de realistische route.

## 10. Voorgestelde volgorde

| Fase | Inhoud | Waarom nu |
|---|---|---|
| 1. Eenduidigheid (prototype) | Afwijkingenlijst HA ↔ model, naamconventie, voorstellen met diff, terugschrijven naar HA-registers | Kern van antwoord 3 en 6; levert direct een opgeruimd HA op |
| 2. Eventbus-weergave | Live-ticker, hartslag, kletskousen, automation-bogen | De "grappige tool"; data is er al |
| 3. Verhuizen naar HA-app | Add-on-repository, Ingress, Supervisor-websocket, opslag in `/data`, per-kamer-weergave | Lokaal, geen tunnel, geen secrets; voorwaarde voor open source |
| 4. Open source | GitHub-repo, README, licentie (MIT of Apache-2.0), voorbeeldhuis, screenshots, forumpost | Community (antwoord 1) |
| 5. 3D-wow | Materialen, zonnestand, deuren/ramen, eventbus in 3D | Alleen bij tijd over (antwoord 9) |

## 11. Open punten

- Mag MyHome **apparaatnamen in HA aanpassen**, of alleen ruimtes en verdiepingen? (Namen raken automations niet
  — die gebruiken entity-id's — maar wel spraakassistenten en dashboards.)
- Moeten we de **Tinyhouse** als echte ruimte in het model opnemen (staat nog niet op de tekeningen)?
- **Licentie** voor de open-sourceversie.
- Productie-deploy van de huidige site: zinvol als tussenstap, of direct door naar de HA-app (fase 3)?

## Bronnen

- [Ingress-introductie](https://community.home-assistant.io/t/introducing-hass-io-ingress/111502?page=4), [Ingress zonder add-on (hass_ingress)](https://github.com/lovelylain/hass_ingress), [Ingress en niet-admins](https://community.home-assistant.io/t/possible-bug-able-to-access-app-ingress-as-normal-user-despite-panel-admin-being-set-to-true/1018296)
- [Device registry websocket-wijzigingen 2026](https://developers.home-assistant.io/blog/2026/08/19/device-registry-websocket-api-changes), [Area registry](https://developers.home-assistant.io/docs/area_registry_index), [core device_registry.py](https://git.sudo.is/home-assistant/core/src/branch/dev/homeassistant/components/config/device_registry.py)
- [HACS publiceren](https://hacs.xyz/docs/publish/start), [HACS integratie-eisen](https://experimental.hacs.xyz/docs/publish/integration)
- Plattegrondprojecten: [NextFloor](https://community.home-assistant.io/t/nextfloor-draw-your-floor-plan-in-ha-and-see-the-house-live-in-3d-hacs-free/1027979), [Houseplan](https://github.com/Matysh/houseplan-card), [NeonPlan 3D](https://github.com/Mastershort/neonplan3d), [Easy Floorplan](https://github.com/nicosandller/easy-floorplan), [ha-floorplan](https://github.com/CCOSTAN/ha-floorplan), [Floorplan 3D](https://community.home-assistant.io/t/floorplan-3d-a-home-assistant-3d-floorplan-card/902878), [floorplan-gids 2026](https://joinhomeshift.com/home-assistant-floorplan)
- [Areas-dashboard](https://vahac.com/blogs/home-assistant-2026-4-new-features-areas-dashboard/)
- Rechten: [discussie #1171](https://github.com/orgs/home-assistant/discussions/1171), [ha-rbac](https://community.home-assistant.io/t/access-control-real-per-user-permissions-as-a-custom-integration/1022515)
