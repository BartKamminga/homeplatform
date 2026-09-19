"""YearOf MO14 ("MO14 à Paris") — supportersite voor Victoria MO14-1.

Fase 1 (item 1143): fundament — status/me-endpoints.
Fase 2 (item 1144): kerndata — spelers-CRUD, wedstrijden/bijzondere-dagen-CRUD,
en een samengevoegde tijdlijn (competitie via hockey-inside/Poulebord + de
handmatige YearOfCustomEntry-rijen).
Fase 3 (item 1145): publieke basispagina's + teamlinkje v1 (simpele code,
handmatig vervangen door de beheerder). Nog GEEN server-side afdwinging op
de publieke GET-endpoints hieronder — dat volgt met content-scoping in fase
1149/fase 7. Voor nu is het teamlinkje een client-side toegangsdeur.

Fase 4 (item 1146): foto-bijdragen. Eigen publieke upload-route (geen
homeplatform-account, want anonieme bezoekers hebben er geen — geauthenticeerd
via het teamlinkje in plaats daarvan), server-side 3 beeldvarianten
(thumb/medium/full) via Pillow, concept/published-status + beheerder-moderatie.

Fase 5 (item 1147): verslagen & interviews. Wedstrijd-invullink (eenmalig/
tijdelijk, publiek — geen teamcode nodig, de invullink zelf is het bewijs)
voor het insturen van een verhaaltje, altijd als concept. Door de beheerder
direct aangemaakte verslagen mogen wel meteen published zijn. Foto-bijdragen
binnen het invulformulier zijn bewust NIET gebouwd (vereist het teamlinkje,
niet de invullink) - fotos voegt men apart toe via de bestaande "Foto's
toevoegen"-pagina (fase 4), getagd op dezelfde match_ref.

Fase 7 (item 1149): teamlinkje-rotatie. Elk teamlinkje krijgt een instelbaar
vangnet (default 10 dagen) naast de bestaande "vervalt bij een nieuwer
linkje"-regel. De publieke GET-endpoints (spelers/tijdlijn/fotos/verslagen)
vereisen een geldige teamcode OF een homeplatform-login (beheerder,
onbeperkte toegang).

Content-scoping (fotos/verslagen nooit tonen als ze gepubliceerd zijn NA het
uitgeven van het huidige linkje) is 2026-09-18 losgelaten - het maakte de site
onbetrouwbaar zodra er na het delen van een linkje weer iets nieuws
gepubliceerd werd (het linkje moest dan telkens opnieuw uitgegeven worden).
De teamcode-gate zelf (wie mag er sowieso op de site) blijft de enige
toegangsbeperking; wekelijks een nieuw linkje delen blijft het advies om
toegang tot de huidige groep te beperken.

Single-tenant, bewust hardcoded voor Victoria MO14-1 (poule_id 551, Topklasse
Zuid-Holland poule B, seizoen 2026-2027) - zie roadmap item 1142/1143.

Dit bestand was oorspronkelijk één 2105-regel-router; opgesplitst per domein
in dit package (players/entries_timeline/matches/access/photos/
contributor_links/reports/action_sponsors + gedeelde _shared) - zuiver
structureel, main.py's `from routers import yearof_mo14` +
`yearof_mo14.router`/`yearof_mo14.shortlink_router` blijven ongewijzigd werken.
"""

from fastapi import APIRouter, Depends

from core.auth import get_current_user
from models.core import User

from .access import router as access_router
from .access import shortlink_router
from .action_sponsors import router as action_sponsors_router
from .contributor_links import router as contributor_links_router
from .entries_timeline import router as entries_timeline_router
from .matches import router as matches_router
from .photos import router as photos_router
from .players import router as players_router
from .reports import router as reports_router

router = APIRouter(prefix="/api/yearof-mo14", tags=["yearof-mo14"])


@router.get("/status")
def status():
    """Publiek, geen auth — bewijst dat de site/router leeft."""
    return {"site": "yearof-mo14", "fase": 8, "status": "actiepagina + Pinksterweekend + polish"}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    """Beheerder-only — bewijst dat de bestaande homeplatform-login werkt voor deze site."""
    return {"username": current_user.username, "email": current_user.email}


router.include_router(players_router)
router.include_router(entries_timeline_router)
router.include_router(matches_router)
router.include_router(access_router)
router.include_router(photos_router)
router.include_router(contributor_links_router)
router.include_router(reports_router)
router.include_router(action_sponsors_router)

__all__ = ["router", "shortlink_router"]
