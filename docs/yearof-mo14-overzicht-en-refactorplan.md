# MO14 à Paris: overzicht functionaliteit en refactorplan

Stand: 06-10-2026, na v5.13. Bron: volledige doorlichting van
`frontend/sites/yearof-mo14/` (59 bestanden, 6109 regels) en
`backend/routers/yearof_mo14/` plus `backend/models/yearof.py`.

---

## 0. Eerst doen: twee beveiligingslekken (los van de refactor)

Deze twee zijn gecontroleerd in de code en moeten vóór de refactor als hotfix.

| # | Lek | Waar | Gevolg |
|---|---|---|---|
| A | `GET /photos` en `GET /reports` geven het volledige model terug, dus ook `uploader_code` en `contributor_code` | `photos.py:220`, `reports.py:98-103` | Wie alleen een **wedstrijdlink** heeft, ziet via `uploader_code` de **teamcode** en dus de hele site. Dat ondermijnt 1186. Via `contributor_code` krijgt hij invulcodes: verslag overschrijven, waarna het verslag naar concept springt en offline gaat. |
| B | `POST /photos` vraagt geen enkele code | `photos.py:84-153` | Iedereen kan anoniem uploaden, tot 200 MB. Met de `report_id` van een gepubliceerd verslag staat de upload **direct live**. |

Kleinere lekken die in dezelfde hotfix passen:
- `GET /entries` toont ook gearchiveerde dagen (`entries_timeline.py:68`).
- `GET /photos/{id}/tags` en `GET /matches/{ref}/photo-block` vragen geen enkele toegang.
- Codes worden gemaakt met `random` in plaats van `secrets`. Profiel- en invulcodes delen ook geen namespace met team- en shortcodes.
- `apply_player_edit` controleert de status niet: een afgewezen wijziging kan alsnog worden toegepast.

---

## 1. Functionaliteit per pagina

### 1a. Publieke site (achter de sitelink/teamcode)

| Pagina | Component | Functionaliteit |
|---|---|---|
| Home | `PublicHome` | hero + thermometer · laatste/volgende wedstrijd · mini-poulestand · "volgende week in de kijker" (interviewkandidaten) · **In de kijker**: speelster van de week + 2 berichten |
| Actie | `PublicAction` | uitleg · thermometer · doneerknop (alleen met URL) · sponsors |
| In de kijker | `PublicSpotlight` | uitgelichte berichten: auteurs, uitklapbare tekst, foto's + lightbox, links, likes |
| Team | `PublicTeam` | spelerstegels → spelerspagina |
| Speler | `PublicPlayer` | profielkaart · "Over …" · Favorieten · alle foto's per wedstrijd |
| Wedstrijden | `PublicTimeline` | lijst met iconen/score · eigen pouletabel · landelijke ranglijsten |
| Wedstrijd | `PublicEntry` | kop (logo's, datum, locatie, score) · blokken in volgorde: foto's + verslagen/interviews/Instagram/beelden · likes |
| Foto's toevoegen | `PublicUploadPhotos` | wedstrijd + type kiezen · bestanden/plakken · comprimeren · voortgang |
| Parijs weekend | `PinksterWeekend` | de vastgepinde dag als wedstrijdpagina |

### 1b. Losse schermen (eigen link, geen navigatie)

| URL | Component | Voor wie | Functionaliteit |
|---|---|---|---|
| `/l/…` → `?entry=&link=` | `StandaloneMatchView` | vrienden | alleen highlights van 1 wedstrijd + inzamelblok |
| `/l/…` → `?speler=` | `StandalonePlayerView` | vrienden | profiel, "Over", favoriete foto's, inzamelblok, sponsors |
| `?invul=` | `ContributeReport` | speelster/ouder | verslag/interview/foto's insturen (altijd concept) |
| `?profiel=` | `EditProfile` | speelster | eigen profiel bijwerken (concept, goedkeuring nodig) |
| — | `Gate` | iedereen zonder code | teamcode invoeren |

### 1c. Beheer

| Tab | Component | Functionaliteit |
|---|---|---|
| Wedstrijden | `TimelineAdmin` → `MatchAdminDetail` | lijst met inline locatie/score (autosave) · pin · archiveren · nieuwe dag · **wedstrijdpagina WYSIWYG**: blokken toevoegen/invoegen/verplaatsen, highlight-ster, invullink-placeholders · doelpunten · linkjes & bezoeken · fotobeheer |
| Spelers | `PlayersAdmin` | profielwijzigingen goedkeuren · bewerken (incl. Ouders/Buddy/Coaches) · in de kijker · archiveren · ▸ linkjes · ▸ foto's (favorieten) · nieuwe speler |
| Foto's | `PhotosAdmin` → `PhotoModerationGrid` | grid · bulk publiceren/verwijderen · detailmodal met tags, highlight, notitie |
| Algemene berichten | `ReportsAdmin` | lijst · bewerken via `ReportForm` · nieuw bericht |
| Actie | `ActionAdmin` | doel, opgehaald, donatielink |
| Sponsors | `SponsorsAdmin` | logo, naam, tekst, website, volgorde |
| Linkjes | `LinksAdmin` | totalen · 5 blokken (site/wedstrijd/speler/invul/profiel) met bezoeken, historie, acties · niet meetellen |
| Bekijk site | `PublicSite adminMode` | preview; klik op wedstrijd/speler opent de editor |

---

## 2. Componenten en modules (huidige stand)

### Frontend: bestanden > 250 regels
`PublicEntry` 272 · `ContributeReport` 273 · `EditProfile` 294 · `TimelineAdmin` 298 ·
`ReportForm` 303 · `PlayersAdmin` 263 · `ReportLinks` 256 · `match-admin/index` 250.

Alle componenten staan plat in `screens/`, met uitzondering van `match-admin/`.
Gedeelde bouwstenen (PhotoThumb, PlayerProfileCard, LinkPanel, FormattedText, …) staan
daar tussen de pagina's en zijn niet als zodanig herkenbaar.

### Backend: modules > 300 regels
`reports.py` 486 · `players.py` 410 · `photos.py` 351 · `entries_timeline.py` 324 ·
`models/yearof.py` 310.

Testdekking: alleen `test_yearof_links.py`. Deze modules hebben **geen enkele test**:
`photos`, `reports`, `matches`, `action_sponsors`, `entries_timeline`, en het
player-edits-pad.

---

## 3. Verschillen in gebruik (dezelfde functie, anders gebouwd)

### 3.1 Linkbeheer
- **Kopiëren: vijf manieren.**
  - `AccessAdmin`: readOnly-veld + "Gekopieerd!".
  - `LinkRow`: "OK!", zonder veld, fout stil ingeslikt.
  - `InviteDetailScreen`: eigen URL-opbouw + groot veld.
  - `LinksAdmin`: alleen het notrack-veld.
  - `clipboard.js` is een kopie van het bestaande `@components/CopyButton`.
- **Status: drie logica's.**
  - `LinkOverview` (geldig/verlopen, kleine letters).
  - `linkStatus.js` (hoofdletters met kleur, andere prioriteit).
  - De backend (`_status`, `_valid_until`, `_valid_short_link`), met daarnaast nog **zes** kopieën van verloop-logica.
  - Tijdzone: `daysLeft` plakt `Z` achter de tijd, `linkStatus.js`/`AccessAdmin` niet. Dat geeft 1-2 uur verschil.
- **Werkwoorden per soort.**
  - Wedstrijd/speler: "Intrekken" (met confirm).
  - Invul: "Verwijderen" (hard delete, terwijl `revoked_at` bestaat).
  - Profiel: niets.
  - Sitelink: "Vernieuw" **zonder** confirm.
- **Invullinks: vier ingangen, drie weergaven.** LinkPanel-tabel, placeholderkaart op de wedstrijdpagina, en `InviteDetailScreen`. Een invullink gemaakt via het blok ververst de placeholders niet.

### 3.2 Content plaatsen: wedstrijdpagina vs. Algemene berichten
| | Wedstrijdpagina | Algemene berichten |
|---|---|---|
| Volgorde | `sort_order` + ↑/↓, fotoblok apart (virtuele rij −500) | **geen** volgorde, geen pijlen |
| Invoegen op positie | "+ hier iets invoegen" (niet boven, niet na het fotoblok) | nee |
| Kaart (beheer) | inline in `PublicEntry` | eigen kopie `AlgemeenReportCard`: andere ster (★ featured vs ⭐ highlight), andere datum, geen foto's, knop op andere plek |
| Typen | verslag, interview, Instagram, beelden, invullink | nieuws |

Verder:
- **Invullinks** krijgen geen positie: de placeholder staat altijd bovenaan.
- **Meerdere Instagram-blokken:** een klik op het 2e opent het 1e (zoeken op type).
- **Publiceren werkt op vier manieren.**
  - `ReportForm`/`LinksScreen`: direct live.
  - `ContributeReport` door de beheerder: toch concept.
  - Profiel: concept bij de speelster, direct bij de beheerder.
  - De inline "Publiceren"-knop verschijnt alleen in de PinksterWeekend-preview.
- **WYSIWYG-breuk:** de preview in `ReportForm` toont geen `*vet*`.

### 3.3 Foto's
- **Thumbs:** het gedeelde `PhotoThumb` naast 5× inline `<img>`. `PublicPlayer` toont daardoor een **kapotte thumb voor video's**.
- **Upload: drie lussen.**
  - `PublicUploadPhotos`: fout per foto + voortgang.
  - `ContributeReport` en `ReportForm`: fouten stil ingeslikt.
  - Plakken (Ctrl+V) zit in 2 van de 3.
  - Previews met ×-knop: 4 kopieën. `createObjectURL` wordt nooit vrijgegeven.
- **Lightbox:** `PhotoLightbox` en de moderatiemodal hebben elk een eigen toetsenbord-afhandeling. `@components/Modal` wordt niet gebruikt.
- **Concept-badges:** 5 posities en stijlen. Gridbreedtes: 70, 90, 100 px en 3 kolommen.

### 3.4 Speelster-weergave: 8 varianten
| Variant | Weergave |
|---|---|
| Teamtegel | 3:4 |
| Profielkaart | groot 3:4 |
| Editor-preview | **ronde 72px**, wijkt af van de echte kaart |
| Fototegel in editor | 96px |
| Beheerlijst | 36px, **nooit de foto** |
| Homepagina-kandidaten | 28px |
| Auteurs | 26px, overlappend |
| Speelster van de week | 110px |

Ook verschillend:
- De metaregel "rol/positie · #nr" is 4× opnieuw gebouwd.
- De naam staat als "bijnaam" (publiek) of als "naam (bijnaam)" (beheer).

### 3.5 Formulieren en opslaan
- Label-stijl 20× inline, invoerveld-stijl 16× inline. `fieldStyle` bestaat 3× met **verschillende** waarden.
- Terug-knop: 16×, in twee varianten.
- Header/brand-markup: 5×. "Kaartschermen" (🔒/🎉/⏳): 6×.
- **Opslaan op vijf manieren:**
  - autosave bij blur (locatie, score, fotonotitie);
  - autosave **per toetsaanslag** (doelpunten);
  - knop per rij (sponsors, links);
  - knop per formulier;
  - directe toggles.
  - Alleen `ActionAdmin` meldt "Opgeslagen!".

### 3.6 Laden, fouten, bevestigen
- **Laden:** "Laden..." in 4 varianten; elders niets, of de lege tekst al tijdens het laden.
- **Fouten:**
  - Foutkleur 38× inline.
  - Veel acties zonder foutafhandeling: fotohandlers op de wedstrijdpagina (dezelfde 7 handlers staan in `PhotosAdmin` mét afhandeling), publiceren/verplaatsen, intrekken.
  - **Bug:** `ContributeReport`/`EditProfile` vervangen bij een mislukte verzending het hele formulier door een slotscherm.
- **Confirm ontbreekt bij:** sitelink vernieuwen, speelster van de week wisselen, vastpinnen.
- **Uitklappers op drie manieren:** "Toon/Verberg"-knop, ▸-knop, hele klikbare rij.

### 3.7 Datums, scores, tabellen
- **Datums:** 9 losse opmaakfuncties. De "heeft tijd"-logica staat 3×, de score-expressie 3×.
- **Pouletabellen:** twee tabellen, waarin **"DS" iets anders betekent** (Timeline: goals voor-tegen, PouleCard: doelsaldo), plus een derde stijl bij de landelijke ranglijst.
- **Thermometer + doneerknop:** 2× gedupliceerd.

### 3.8 API-laag
- **Upload-fetches:** 4× bijna identiek, met verschillende auth-headers.
- **Beheerschermen en publieke endpoints:**
  - Ze gebruiken de publieke `getPlayers`, waardoor gearchiveerde speelsters niet te taggen zijn.
  - Ze halen **hele tabellen** op en filteren client-side (`getReportsModeration`/`getPhotosModeration`, dubbel geladen door de wedstrijdeditor en de ingebedde preview).
- **Dode functies:** `getStatus`, `getRoadmapItems`, `deletePlayer`, `getEntries`, `deleteEntry`, `listProfileLinks`, `clearCode`, en de prop `ReportForm.matchOptions`.

### 3.9 Backend: hetzelfde concept, anders gemodelleerd
- **Toegangstokens: vier tabellen met verschillend gedrag.**
  | Tabel | Gedrag |
  |---|---|
  | TeamLink | intrekken via rotatie |
  | ShortLink | eigen expiry + intrekken, legacy volgt de teamcode |
  | ContributorLink | expiry verplicht, `revoked_at` ongebruikt, alleen hard delete |
  | ProfileLink | permanent, niet in te trekken |

  Codegeneratie staat 3×. Auth-checks gebeuren op drie manieren: dependencies, handmatig, en losse token-lookups (5×).
- **Curatievlaggen: vijf varianten.** `Photo.match_highlight`, `Report.match_highlight`, `Report.featured`, `Tag.favorite`, `Entry.is_pinned`, plus spotlight als aparte tabel.
- **Volgorde: drie schema's.** Reports per 1000, sponsors +1, reportlinks "aantal". Er zijn drie move-endpoints, die geen van alle `direction` valideren; reportlinks zijn niet te verplaatsen.
- **Status:** vrije string, nergens gevalideerd. Het meepubliceren van foto's met een verslag werkt maar één kant op.
- **Archiveren vs. verwijderen:** speler en dag worden gearchiveerd, al het andere wordt hard verwijderd. Ontbrekende opruiming:
  - wedstrijdlinks + bezoeken bij het verwijderen van een dag;
  - weesbestanden op schijf (oude logo's, spelersfoto's, afgewezen profielfoto's).
- **Uploads:** validatie en opslag 3× gekopieerd, en 3 serve-routes. Een publieke route leest 200 MB in het geheugen vóór de groottecheck. Geen EXIF-rotatie.
- **Responses:** whitelists (spelerslink, spotlight, favorieten) naast volledige modellen op publieke routes. Dat leidt tot lek A, en `parents`/`buddy`/`coaches` gaan via `/players` mee.
- **Tijdlijn opzoeken:** dezelfde volledige scan staat op 5 plekken, ook op het publieke, ongecachete `og-match.png`.
- **Overig:** overal naive `datetime.utcnow()`. De bezoeken per dag rekenen in UTC, niet in NL-tijd.

---

## 4. Refactorplan

### Uitgangspunten
1. **Per fase geen gedragswijziging**, behalve waar dat expliciet bij de fase staat. Elke fase gaat apart via develop → acc → prod.
2. **Eerst tests, dan verbouwen.** Voor de modules zonder tests komen eerst karakteriseringstests (photos, reports, entries, players-edits). Die vangen ook lek A/B af.
3. **Eén bron per concept:** één statuslogica voor links, één avatar, één fotokiezer, één inhoudsblokkenlijst.
4. **Bestanden < 250 regels**, één map per functionaliteit.
5. Gedeelde componenten uit `@components` (CopyButton, Modal, Skeleton, Badge) gebruiken in plaats van eigen kopieën.

### 4.1 Frontend: doelstructuur

```
yearof-mo14/
  App.jsx                 alleen routing (publiek / losse links / beheer)
  shells/                 PublicShell (header+nav), StandaloneShell, AdminShell (tabs),
                          MessageScreen (gate/bedankt/verlopen-kaart)
  lib/
    api/                  client.js (get/post/put + uploadFile met 1 fout-parser)
                          + per domein: players, links, matches, reports, photos, action
    format.js             datum (kort/lang/met tijd), score, "rol · #nr", spelersnaam
    labels.js             rapporttypes, rollen, statuslabels (1 plek)
    gate.js, tracking.js
  ui/                     Field (label+input/textarea/select), Button-varianten (incl. outline),
                          BackLink, SectionCard (kop + hint + teller + acties),
                          Expander, StatusPill, ConceptBadge, ErrorText, Loading/Empty,
                          CopyField (kopieer + zichtbaar fallback-veld), MoveButtons, ConfirmButton
  features/
    links/                LinkPanel, LinkSection, LinkRow, LinkTotals, CreateLinkButton,
                          InviteCreateForm, SiteLinkManager (nu AccessAdmin), linkStatus (1 bron)
    players/              PlayerAvatar (1 component, maten s/m/l, altijd foto+fallback),
                          PlayerProfileCard, PlayerAboutCard, PlayerSpotlightCard,
                          PlayerEditor (form + preview = echte PlayerProfileCard),
                          PlayersAdmin, PlayerEditsModeration, favorites/
    photos/               PhotoThumb, PhotoGrid, Lightbox (+ useLightboxKeys),
                          PhotoPicker (kiezen + plakken + previews + URL-opruiming),
                          useUploadQueue (comprimeren + upload + voortgang + fouten),
                          ModerationGrid, PhotoDetail
    content/              ContentBlockList (geordende blokken met invoegen/verplaatsen),
                          ReportCard (1 kaart, publiek + beheer), ReportEditor (ReportForm opgesplitst),
                          ReportLinks (editor + tegels), ChooseContentKind, InvitePlaceholder
    matches/              Timeline, MatchHeader, MatchPage (PublicEntry opgesplitst),
                          MatchAdmin (+ GoalsPanel), PouleTable (1 tabel, 1 betekenis van DS)
    action/               Thermometer, DonateBlock, SponsorList, ActionAdmin, SponsorsAdmin
    pages/                Home, Team, Player, Spotlight, Upload, Pinkster,
                          standalone/{Match, Player, Contribute, Profile}
```

De belangrijkste inhoudelijke keuze is **`ContentBlockList`**. Dat wordt één component voor de wedstrijdpagina én voor Algemene berichten:
- invoegen op elke positie, ook bovenaan en na het fotoblok;
- verplaatsen;
- invullink-placeholders op hun eigen plek;
- dezelfde `ReportCard`.

Daarmee verdwijnen de verschillen uit §3.2.

### 4.2 Backend: doelstructuur

```
routers/yearof_mo14/
  core/
    access.py      require_team_access / require_match_access / token-dependencies (1 manier)
    tokens.py      codegeneratie met secrets, 1 namespace; 1 validity-functie
                   (geldig/verlopen/ingetrokken + geldig_tot) gebruikt door links, visits, /l/
    uploads.py     validatie, streaming groottecheck, EXIF-rotatie, varianten, serve-helper
    ordering.py    generiek verplaatsen (sort_order) + Literal["up","down"]
    timeline.py    find_timeline_item(ref) met korte cache, include_archived expliciet
    schemas.py     publieke response-modellen (Pydantic) - nooit meer volledige modellen naar buiten
    clock.py       now_utc() timezone-aware + NL-dag helper
  players/         crud.py, profile_links.py, player_edits.py, favorites.py, spotlight.py
  content/         reports_public.py, reports_admin.py, report_links.py, contributor_links.py
  photos/          upload.py, moderation.py, files.py
  matches/         entries.py, timeline.py, goals.py, photo_block.py
  links/           team_links.py, short_links.py, og_preview.py, visits.py
  action.py        actie + sponsors
```

### 4.3 Fases

| Fase | Wat | Gedragswijziging | Omvang | Risico |
|---|---|---|---|---|
| **0. Hotfix beveiliging** | lek A (response-whitelist foto's/verslagen), lek B (upload vereist geldige team-/invul-/beheercode), gearchiveerde entries, auth op tags/photo-block, `secrets` + gedeelde namespace, status-check bij profielwijziging + tests | ja (dichtzetten) | S | laag |
| **1. Backend-fundament** | karakteriseringstests photos/reports/entries/edits · `core/` (tokens, access, uploads, ordering, timeline, schemas, clock) · modules opsplitsen volgens 4.2 | nee | L | midden: veel verplaatsingen, afgedekt door tests |
| **2. Frontend-fundament** | `lib/api` per domein + 1 upload-helper · `format.js` · `labels.js` · `ui/`-kit · shells · dode code weg | nee | M | laag: mechanisch vervangen |
| **3. Foto's & spelers** | PhotoPicker + useUploadQueue (alle drie de uploadflows) · 1 Lightbox · PlayerAvatar overal (ook in beheerlijst) · editor-preview = echte kaart · video-thumb-bug | klein (fixes) | M | laag |
| **4. Linkbeheer** | 1 statuslogica (backend levert status + geldig_tot, frontend toont) · CopyField overal · invullinks intrekken i.p.v. verwijderen · confirm bij vernieuwen · placeholders verversen | klein | S-M | laag |
| **5. Inhoud** | ContentBlockList + ReportCard voor wedstrijdpagina én Algemene berichten · invoegen overal · meerdere Instagram-blokken · 1 publicatiemodel · preview met opmaak | **ja** (Algemene berichten krijgen volgorde) | L | midden |
| **6. Data-consistentie** | statuswaarden valideren (Literal) · sort_order één schema (+ migratie) · archiveren-vs-verwijderen-beleid · cascades (wedstrijdlinks, bezoeken, weesbestanden) · naive → aware datetimes | deels | M | midden: migraties |

Volgorde: 0 → 1 → 2 → 3/4 (onafhankelijk van elkaar) → 5 → 6.
Fase 0 kan meteen. Fase 1 en 2 kunnen parallel, want ze raken elkaar niet.

### Roadmap-items (aangemaakt 06-10-2026)
| Item | Fase | Titel (kort) |
|---|---|---|
| 1203 | 0 | security-Patch: lekken dichten |
| 1204 | 1 | Refactor-BE: karakteriseringstests |
| 1205 | 1 | Refactor-BE: core-laag |
| 1206 | 1 | Refactor-BE: modules opsplitsen per domein |
| 1207 | 4 | Refactor-BE: linkstatus uit 1 bron + invullinks intrekken |
| 1208 | 6 | Refactor-BE: data-consistentie |
| 1209 | 2 | Refactor-FE: fundament |
| 1210 | 3 | Refactor-FE: foto's en spelers |
| 1211 | 4 | Refactor-FE: linkbeheer |
| 1212 | 5 | Refactor-FE: inhoud (ContentBlockList) |

### 4.4 Beslissingen
| # | Vraag | Stand |
|---|---|---|
| 1 | **Lek B:** wie mag foto's uploaden? | ✅ **Besloten 06-10:** geldige sitelink, invullink of beheerder. |
| 2 | **Algemene berichten:** zelf de volgorde bepalen, net als op de wedstrijdpagina? (basis van fase 5) | ✅ **Besloten 07-10: ja.** |
| 3 | **Invullinks:** intrekken in plaats van verwijderen? | ✅ volgt uit 1214 ("nooit echt verwijderen"): **intrekken**. |
| 4 | **Profiellinks:** vernieuwbaar of intrekbaar maken? | ✅ **Besloten 07-10:** gelijktrekken met alle andere links. Overal hetzelfde: intrekken, vernieuwen, status, historie, bezoeken. Nog open: de geldigheidsduur (nu permanent). |
| 5 | **`/players`:** ouders/buddy/coaches mee naar iedereen met de sitelink? | ✅ **07-10:** voor nu goed. |
| 6 | **Linktabellen samenvoegen tot één tokentabel?** | Voorstel: **nee**, wel gedrag gelijktrekken via `core/tokens.py`. |
| 7 | **Definitief verwijderen** | ✅ **Besloten 06-10:** mag, maar alleen vanuit het archief, met dubbele bevestiging. |

---

## 5. Stand van zaken (07-10-2026)

### Wat er sinds het plan al gebouwd is
| Item | Wat | Raakt fase | Stand |
|---|---|---|---|
| **1213** | Fotobeheer als werkbak: `features/photos/` met PhotoManager, `photoFilters.js`, `useUploadQueue`, `PhotoUploadPanel`, `PhotoDetail(Modal)`. Backend `photo_manager.py` (beheerlijst zonder `uploader_code`, bulk-endpoint). | **3** (deels), **2** (eerste `features/`-map) | ✅ live v5.14 |
| **1214** (foto's) | Foto's archiveren in plaats van verwijderen; archieffilter op alle publieke fotoqueries; terugzetten en definitief verwijderen. | **6** (archiefbeleid, deels) | ✅ live v5.14; rest open |
| **1217** | Wedstrijdenlijst scrolt naar de volgende wedstrijd. | – | ✅ live v5.14.1 |

Wat daarmee van **fase 3 (1210)** al klaar is:
- `useUploadQueue` en een uploadpaneel bestaan nu. De andere uploadflows (`PublicUploadPhotos`, `ContributeReport`, `ReportForm`) gebruiken ze nog niet.
- De oude `PhotoModerationGrid`/`PhotoCard` en zeven dubbele fotohandlers zijn weg.
- Nog open: één Lightbox, PlayerAvatar, en de editor-preview gelijk aan de echte kaart.

### Nieuwe items die het plan raken
| Item | Wat | Raakt |
|---|---|---|
| **1214** (rest) | Archiveren voor berichten, links bij verslagen, sponsors en invullinks (intrekken); mee-archiveren bij dagen en spelers. | **fase 6** (1208) en **fase 4** (1207: invullinks intrekken) |
| **1215** | Zaalcompetitie: meerdere teams en poules (zMO14-1/-12/-2), wisselen tussen veld en zaal. Deadline: poules eind november, start in december. | **fase 1** (`core/timeline.py`): de tijdlijn wordt multi-team. Liefst niet tegelijk met de grote verbouwing van dezelfde modules. |

### Competitie-inzicht (nieuw, 07-10)
| Item | Wat | Bestaande bouwsteen |
|---|---|---|
| **1229** | Overige wedstrijden en uitslagen in de poule | `/api/hockey/public/hockey-poules/{pid}/matches` |
| **1230** | Topklasse MO14 landelijk | `NationalQueries` + Poulebord-querywidgets (tag Topklasse) |
| **1231** | Herindelingsprognose MO14 | Poulebord-card uit item 1182 (v5.8) |
| **1232** | Kans op elke eindplek | Scenario-/simulatie-engine van Poulebord en NKHockey |

Voorstel: samen in **één tab "Competitie"**, gebouwd **na of samen met 1215**. 1215 maakt de site multi-poule, en deze vier tonen poules.

### Herziene volgorde (voorstel)
```
1. 1203  security-Patch                        (fase 0)  - meteen
2. 1204  karakteriseringstests                 (fase 1a) - vangnet voor alles hierna
3. 1214  archiveren rest  + 1207 invullinks intrekken    - backend-gedrag, klein-midden
4. 1215  zaalcompetitie, gebouwd OP een nieuwe core/timeline.py + core/schemas.py
         (= het relevante stuk van 1205, niet de hele core-laag)  - vóór eind november
5. 1209  FE-fundament (api per domein, format, labels, ui-kit)
6. 1210 rest / 1211 linkbeheer                 (fase 3/4)
7. 1205 rest + 1206 modules opsplitsen        (fase 1b)  - na de zaal-deadline
8. 1212  inhoud / ContentBlockList             (fase 5)  - na beslissing 2
9. 1208  data-consistentie rest                (fase 6)
```

Waarom zo:
- **1203 eerst**: echte lekken.
- **1204 vroeg**: zonder tests is elke volgende stap riskant.
- **1215 is het enige item met een harde deadline.** Door 1215 direct op `core/timeline.py` te bouwen, doen we dat stuk refactor maar één keer.
- **Het grote opsplitsen (1206)** pas na de zaal-deadline, omdat het dezelfde bestanden raakt als 1215.
