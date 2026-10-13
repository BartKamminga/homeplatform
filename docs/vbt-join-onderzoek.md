# VBT – onderzoek JOIN (join.cc): wat kunnen we hergebruiken?

*13-10-2026 · roadmap-item "VBT - onderzoek join.cc" · bronnen onderaan*

## Wat JOIN is
JOIN is een **adaptieve trainingsapp** voor fietsers. Bij de start geef je je doel op (een vrij plan of een evenement),
je beschikbaarheid per week en of je traint op vermogen, hartslag of gevoel. JOIN maakt daar een plan van en
**stelt het continu bij**: na een gemiste of zware training, bij ziekte of blessure, als je minder tijd hebt, en op
basis van je feedback. Er is een workout-speler voor indoor trainers (met ERG) en koppelingen met Garmin en Wahoo.

## De mechanismen (voor zover publiek beschreven)

| Mechanisme | Hoe JOIN het doet |
|---|---|
| **Onboarding** | Profiel (vermogen/hartslag/gevoel), doel (plan of evenement), beschikbaarheid per week, FTP-inschatting. Plan "op maat" vanaf dag 1. |
| **Beschikbaarheid** | Per week aan te passen; het plan rekent direct opnieuw. Per dag "geen tijd vandaag". |
| **Feedback na elke rit** | Inspanning (RPE) en een **Readiness**-vraag (spierpijn, vermoeidheid). Zwaar gevoeld of niet fit → volgende trainingen worden lichter of verschuiven. |
| **Gemiste of geruilde training** | Je kunt een andere rit indienen; JOIN berekent "het beste pad vooruit". Gebruikers melden dat JOIN stuurt op **tijd-in-vermogenszones** per planfase: na een zware geüploade rit verdween een geplande VO2max-sessie en werd de volgende training duur. Er is ook **Shuffle workout**. |
| **Workout-bibliotheek** | Workouts in varianten per duur (bv. *30-30's – 50 min*, *Sprint-threshold-sprint – 30/45 min*), zodat het plan op de beschikbare tijd past. |
| **eFTP** | Geschatte FTP: vertrekt van je laatst geteste FTP; checkt of intervallen een verhoging rechtvaardigen en modelleert het effect van gewone trainingen. Elke **3 maanden een 20-min FTP-test** in het plan. Nieuwe piek over **12 of 20 min** in een gewone training → voorstel tot FTP-verhoging. Slaap en voeding tellen niet mee. |
| **FTP-test** | Telt alleen op de geplande dag; na de test plus feedback rekent JOIN de nieuwe FTP uit. |
| **Workout Score** | Een score per uitgevoerde workout. Een (Nederlandse) scriptie vond dat dit motiveert, maar demotiveert bij een lage score zonder uitleg over wat beter kan. |
| **Indoor** | Workout-speler met ERG en alle sensoren op één scherm. |

Niet publiek: de precieze algoritmes (belasting/vermoeidheid, schalen van workouts). JOIN noemt het
*"science-backed algorithms"*, ontworpen door coaches met World Tour-ervaring.

## Wat VBT al heeft
- Vaste plannen (FTP Builder, Build Me Up, Gran Fondo, Back to Fitness) op een kalender met afvinken; plankeuze per gebruiker (item 1300).
- Workout-bibliotheek met .zwo-import, ERG op de Kickr, cadansscore.
- Ritten met samples (1 Hz), pauzes en eventlog, MY RIDES, prullenbak.
- Items in de roadmap: **FTP-tests → nieuwe FTP**, **virtuele FTP**, **trends in zones**.

## Wat we kunnen hergebruiken (concepten, geen code of content)

### 1. Feedback na elke rit: RPE + readiness *(klein, hoge waarde)*
Na de finish twee tikken: *Hoe zwaar was het?* (1–10) en *Hoe voel je je?* (fris / wat moe / kapot). Opslaan bij de rit.
Dit is de brandstof voor punt 2 en voor een eerlijkere trendgrafiek. In VBT: twee rijen knoppen op het finish-scherm en
twee kolommen in `vbt_rides`.

### 2. Adaptief plan in plaats van een vast schema *(groot, kern van JOIN)*
Een plan bestaat dan niet meer uit vaste dagen, maar uit **weken met een doel**: totale tijd, verdeling over de zones,
één sleutel-workout. Een regelset kiest per dag de workout uit de bibliotheek, met varianten per duur:
- **beschikbaarheid** per weekdag (in minuten) → kies de variant die past;
- **gemist** → schuif de sleutel-workout door en laat duurwerk vallen; **geruild of extra gereden** → reken de gereden tijd-in-zones mee;
- **RPE hoog of readiness laag** → de volgende training een zone lager of korter; twee keer laag → een herstelweek.
- Begin eenvoudig met regels die we zelf kunnen uitleggen, geen AI. Dat sluit ook aan bij de les uit de scriptie: geef bij een lage score altijd een reden.

### 3. eFTP / virtuele FTP *(sluit aan op bestaande items)*
Neem de regels van JOIN over als startpunt:
- vertrek van de laatste test-FTP;
- een nieuwe piek over 12 of 20 min in een gewone rit → voorstel om de FTP te verhogen (95% van de 20-min-piek, of het 12-min-equivalent);
- elke ~3 maanden een FTP-test in het plan;
- alleen ritten met echte trainerdata tellen mee.

### 4. Varianten van workouts per duur *(middel)*
Bibliotheekworkouts in 30/45/60/90-minutenversies (dezelfde opbouw, langere of kortere blokken). Nodig voor punt 2,
en handig om op een drukke dag snel een kortere versie te kiezen ("Shuffle / Shorter").

### 5. Workout-score met uitleg *(klein)*
We hebben al een cadansscore. Breid die uit naar vermogen (ERG maakt dat bijna altijd 100%, dus vooral relevant bij SIM
en vrije ritten) en geef **altijd een concrete tip** ("2 van de 6 blokken onder doel; volgende keer FTP 5 W lager?").

### 6. Duidelijke indeling van het menu *(antwoord op Barts opmerking)*
Bij JOIN draait alles om **"wat doe ik vandaag"**, met daaronder het plan, de bibliotheek en de geschiedenis.
Voorstel voor het linkerpaneel van VBT (fase 3–4 van de React-refactor):

| Sectie | Inhoud |
|---|---|
| **TODAY** | De workout van vandaag uit het actieve plan, met START, *korter* (variant) en *andere workout*; daaronder je laatste rit met feedback |
| **MY PLAN** | Het **actieve** plan, zichtbaar bovenaan ("Build Me Up · week 3 van 13"); de kalender; knop *Switch plan* → overzicht van alle plannen met uitleg en duur |
| **WORKOUTS** | De bibliotheek (plannen en .zwo-imports), met filters op type en duur |
| **MY RIDES** | Geschiedenis met prullenbak; per rit de feedback |
| **PROGRESS** | Trends in zones, FTP- en eFTP-verloop |
| DEVICES · SETTINGS · HELP | Zoals nu |

Zo heeft elk begrip één plek: het **actieve plan** (MY PLAN), **workouts** (WORKOUTS) en **wat je gereden hebt** (MY RIDES).

### Bewust niet overnemen
- Een "AI-coach" als black box: liever uitlegbare regels (zie punt 2).
- Slaap- en voedingsdata: niet nodig voor wat Bart wil.
- Hardlopen: valt buiten de scope van VBT.

## Voorgestelde volgorde
1. **Menu-indeling** (punt 6), samen met fase 3–4 van de React-refactor. Dat lost de huidige onduidelijkheid op.
2. **Feedback na de rit** (punt 1). Klein, en de basis voor punt 2.
3. **FTP-test → nieuwe FTP** en **eFTP** (punt 3; de items bestaan al).
4. **Workout-varianten per duur** (punt 4).
5. **Adaptief plan v1** (punt 2): beschikbaarheid, gemist/geruild, RPE/readiness.
6. **Workout-score met uitleg** (punt 5) en **trends**.

## Bronnen
- [How JOIN works](https://join.cc/how-join-works/)
- [The Story of JOIN](https://join.cc/cycling-tips/the-story-of-join-how-an-adaptive-training-app-changed-cycling)
- [JOIN Cycling Coach – App Store](https://apps.apple.com/app/id1167933055)
- [JOIN help – What is eFTP](https://help.join.cc/hc/en-150/articles/16014326824977-What-is-eFTP)
- [JOIN help – How do I calculate my FTP](https://help.join.cc/hc/en-150/articles/25862701364497-How-to-I-calculate-my-FTP)
- [What to do with eFTP in the JOIN app](https://join.cc/cycling-tips/eftp-in-the-join-app)
- [My Journey To and With JOIN](https://join.cc/cycling-tips/journey-to-and-with-join) (gebruikerservaring)
- [TrainerRoad forum – JOIN cycling app](https://www.trainerroad.com/forum/t/join-cycling-app/62908?page=15) (gebruikerservaringen)
- [Scriptie: feedback on cycling metrics in an adaptive training app (UU)](https://studenttheses.uu.nl/handle/20.500.12932/44124)
- Voorbeelden van workouts per duur: [30-30's – 50 min](https://join.cc/workouts/cycling-workouts/30-30's-0hours-50minutes), [Sprint-threshold-sprint – 30 min](https://join.cc/workouts/cycling-workouts/sprint-threshold-sprint-0hours-30minutes)
