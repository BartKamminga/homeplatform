"""YearOf MO14 ("MO14 à Paris") — supportersite Victoria MO14-1.

Single-tenant (bewust, zie roadmap item 1142/1143): geen team_slug-kolom,
hardcoded voor dit ene team. Generaliseren pas bij een echt tweede team.
"""

from datetime import datetime
from typing import Optional
import uuid

from sqlmodel import Field, SQLModel


def new_uuid() -> str:
    return str(uuid.uuid4())


class YearOfPlayer(SQLModel, table=True):
    __tablename__ = "yearof_players"

    id:           str            = Field(default_factory=new_uuid, primary_key=True)
    name:         str
    nickname:     Optional[str]  = Field(default=None)
    shirt_number: Optional[int]  = Field(default=None)
    role_title:   Optional[str]  = Field(default=None)  # bv. "Coach"/"Trainer" - toont i.p.v. het rugnummer op begeleiding
    position:     Optional[str]  = Field(default=None)
    photo_url:    Optional[str]  = Field(default=None)
    bio:          Optional[str]  = Field(default=None)
    fun_facts:    Optional[str]  = Field(default=None)  # JSON: [{"label": ..., "value": ...}]
    archived_at:  Optional[datetime] = Field(default=None)  # verborgen op de publieke site, content eronder blijft bestaan
    created_at:   datetime       = Field(default_factory=datetime.utcnow)
    updated_at:   datetime       = Field(default_factory=datetime.utcnow)


class YearOfTeamLink(SQLModel, table=True):
    """Teamlinkje (viewer-toegang), code-als-PK naar het PoulebordBoard-patroon.

    Fase 7 (item 1149): elk linkje heeft een vangnet-vervaldatum (expires_at,
    instelbaar, default 10 dagen) en vervalt daarnaast direct zodra een
    nieuwer linkje wordt uitgegeven (revoked_at)."""
    __tablename__ = "yearof_team_links"

    id:         str            = Field(primary_key=True)  # 6-char code
    created_at: datetime        = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = Field(default=None)  # vangnet; None = alleen bij nieuwer linkje vervallen
    revoked_at: Optional[datetime] = Field(default=None)


class YearOfShortLink(SQLModel, table=True):
    """Korte deel-link (bv. https://webheaven.nl/l/we9mv0) die server-side
    doorstuurt naar een bevroren (team_code, match_ref)-combinatie - ofwel de
    hele site (match_ref leeg) ofwel 1 nav-loze wedstrijdpagina (wedstrijdlink).
    Bewust bevroren i.p.v. dynamisch naar "de huidige actieve teamcode"
    verwijzen: anders zou een korte link voor altijd blijven werken, ook na
    het wekelijks verversen van de teamcode - dat ondermijnt de
    toegangsbeperking die die rotatie juist moet bieden. De korte link stopt
    dus vanzelf met werken zodra team_code wordt ingetrokken/vervangen,
    precies zoals de niet-verkorte vorm dat al deed."""
    __tablename__ = "yearof_short_links"

    id:         str            = Field(primary_key=True)  # 6-char code
    team_code:  str
    match_ref:  Optional[str]  = Field(default=None)  # None = hele site, anders wedstrijdlink
    created_at: datetime        = Field(default_factory=datetime.utcnow)


class YearOfPhoto(SQLModel, table=True):
    """Foto-bijdrage (fase 4, item 1146). uploader_code is het teamlinkje/
    contributor-linkje waarmee geupload is - geen User.id, want anonieme
    bezoekers hebben geen homeplatform-account.

    report_id (toegevoegd 2026-09-14): een foto hoort optioneel bij een
    specifiek verslag/interview/algemeen bericht i.p.v. alleen los bij een
    wedstrijd te hangen - zo blijft een bijgevoegde foto bij het artikel
    staan i.p.v. in 1 gedeelde fotogalerij per wedstrijd te verdwijnen.
    match_ref is optioneel geworden omdat algemene berichten (geen
    match_ref) ook fotos moeten kunnen hebben."""
    __tablename__ = "yearof_photos"

    id:             str            = Field(default_factory=new_uuid, primary_key=True)
    match_ref:      Optional[str]  = Field(default=None, index=True)  # "knhb:{id}" | "custom:{id}"
    report_id:      Optional[str]  = Field(default=None, foreign_key="yearof_reports.id", index=True)
    photo_type:     str             = Field(default="actie")  # actie | team | sfeer
    media_type:     str             = Field(default="photo")  # photo | video
    file_ext:       Optional[str]  = Field(default=None)  # alleen bij video - welk bestand serveren (geen transcode)
    status:         str             = Field(default="concept")  # concept | published
    uploader_code:  Optional[str]   = Field(default=None)
    caption:        Optional[str]  = Field(default=None)
    created_at:     datetime        = Field(default_factory=datetime.utcnow)  # uploaddatum
    published_at:   Optional[datetime] = Field(default=None)  # moment van eerste publicatie (blijft staan bij een latere concept-terugzet)
    updated_at:     datetime        = Field(default_factory=datetime.utcnow)


class YearOfPhotoPlayerTag(SQLModel, table=True):
    __tablename__ = "yearof_photo_player_tags"

    id:        str = Field(default_factory=new_uuid, primary_key=True)
    photo_id:  str = Field(foreign_key="yearof_photos.id", index=True)
    player_id: str = Field(foreign_key="yearof_players.id", index=True)


class YearOfProfileLink(SQLModel, table=True):
    """Profiellinkje (fase 6, item 1148): permanent, geen vervaldatum -
    hoort bij 1 speler, hele seizoen geldig."""
    __tablename__ = "yearof_profile_links"

    id:         str      = Field(primary_key=True)  # 6-char code
    player_id:  str       = Field(foreign_key="yearof_players.id", index=True)
    created_at: datetime  = Field(default_factory=datetime.utcnow)


class YearOfPlayerEdit(SQLModel, table=True):
    """Concept-wijziging op een spelersprofiel (fase 6). Losse staging-rij
    i.p.v. schaduwvelden op YearOfPlayer - altijd concept-review, nooit
    auto-publish (expliciet besloten, zie item 1142)."""
    __tablename__ = "yearof_player_edits"

    id:           str            = Field(default_factory=new_uuid, primary_key=True)
    player_id:    str             = Field(foreign_key="yearof_players.id", index=True)
    nickname:     Optional[str]  = Field(default=None)
    position:     Optional[str]  = Field(default=None)
    photo_url:    Optional[str]  = Field(default=None)
    bio:          Optional[str]  = Field(default=None)
    fun_facts:    Optional[str]  = Field(default=None)
    status:       str             = Field(default="concept")  # concept | applied | rejected
    created_at:   datetime        = Field(default_factory=datetime.utcnow)


class YearOfActionSettings(SQLModel, table=True):
    """Instellingen voor de inzamelactie (fase 8, item 1150) - 1 singleton-rij
    (id vast op "default"). donation_url is de simpele oplossing voor item
    1153 (betaallink): beheerder plakt zelf een extern betaalverzoek (bv.
    Tikkie), geen eigen payment-integratie."""
    __tablename__ = "yearof_action_settings"

    id:            str            = Field(default="default", primary_key=True)
    goal_amount:   int             = Field(default=4000)
    raised_amount: int             = Field(default=0)
    donation_url:  Optional[str]  = Field(default=None)
    updated_at:    datetime        = Field(default_factory=datetime.utcnow)


class YearOfContributorLink(SQLModel, table=True):
    """Wedstrijd-invullink (fase 5, item 1147): eenmalig/tijdelijk, gekoppeld
    aan 1 wedstrijd/dag en evt. 1 speler. Code-als-PK, zelfde patroon als
    YearOfTeamLink/PoulebordBoard."""
    __tablename__ = "yearof_contributor_links"

    id:          str            = Field(primary_key=True)  # 6-char code
    match_ref:   str
    player_id:   Optional[str]  = Field(default=None, foreign_key="yearof_players.id")
    report_type: str            = Field(default="interview")  # interview | wedstrijdverslag (bv. vooraf-preview)
    opened_at:   Optional[datetime] = Field(default=None)  # eerste keer dat de invulpagina geopend werd
    expires_at:  datetime
    revoked_at: Optional[datetime] = Field(default=None)
    created_at: datetime        = Field(default_factory=datetime.utcnow)


class YearOfReport(SQLModel, table=True):
    """Verslag/interview/nieuwsbericht (fase 5, item 1147). Altijd concept
    bij binnenkomst via een contributor-link; door de beheerder direct
    aangemaakte verslagen mogen meteen published zijn."""
    __tablename__ = "yearof_reports"

    id:               str            = Field(default_factory=new_uuid, primary_key=True)
    match_ref:        Optional[str]  = Field(default=None, index=True)  # leeg = algemeen, niet aan 1 wedstrijd gekoppeld
    report_type:      str             = Field(default="interview")  # wedstrijdverslag | interview | nieuws
    interviewee_role: Optional[str]  = Field(default=None)  # speelster | coach | ouder (alleen relevant bij interview)
    status:           str             = Field(default="concept")     # concept | published
    title:            str
    body:             str
    author_name:      Optional[str]  = Field(default=None)
    featured:         bool            = Field(default=False)  # handmatig geselecteerd voor "In de kijker"
    sort_order:       int             = Field(default=0)  # volgorde binnen 1 wedstrijdpagina (WYSIWYG-editor)
    contributor_code: Optional[str]  = Field(default=None)
    created_at:       datetime        = Field(default_factory=datetime.utcnow)  # aanmaak-/uploaddatum
    updated_at:       datetime        = Field(default_factory=datetime.utcnow)
    published_at:     Optional[datetime] = Field(default=None)  # moment van eerste publicatie (blijft staan bij een latere concept-terugzet)


class YearOfReportLink(SQLModel, table=True):
    """Generieke externe link bij een verslag (fase 5-uitbreiding): vervangt de
    losse insta_url/youtube_url/youtube_urls-velden door 1 herbruikbare vorm.
    link_type is vrije tekst, momenteel "instagram" en "video" (uitbreidbaar
    zonder migratie)."""
    __tablename__ = "yearof_report_links"

    id:         str            = Field(default_factory=new_uuid, primary_key=True)
    report_id:  str             = Field(foreign_key="yearof_reports.id", index=True)
    link_type:  str             = Field(default="video")  # instagram | video
    url:        str
    note:       Optional[str]  = Field(default=None)
    sort_order: int             = Field(default=0)


class YearOfReportPlayerTag(SQLModel, table=True):
    __tablename__ = "yearof_report_player_tags"

    id:        str = Field(default_factory=new_uuid, primary_key=True)
    report_id: str = Field(foreign_key="yearof_reports.id", index=True)
    player_id: str = Field(foreign_key="yearof_players.id", index=True)


class YearOfMatchPhotoBlock(SQLModel, table=True):
    """Positie van het foto-blok t.o.v. de verslagen/linkjes-items op de
    wedstrijdpagina (WYSIWYG-editor). Alleen aangemaakt zodra de beheerder het
    foto-blok daadwerkelijk verschuift - zonder rij staat het foto-blok voor
    alle verslagen (zie _photo_block_sort_order in routers/yearof_mo14.py)."""
    __tablename__ = "yearof_match_photo_blocks"

    match_ref:  str = Field(primary_key=True)
    sort_order: int = Field(default=0)


class YearOfMatchGoal(SQLModel, table=True):
    """Doelpuntenregistratie per speler per wedstrijd/dag - handmatig bijgehouden
    door de beheerder op de wedstrijd-detailpagina (fase 5-uitbreiding)."""
    __tablename__ = "yearof_match_goals"

    id:         str = Field(default_factory=new_uuid, primary_key=True)
    match_ref:  str  = Field(index=True)
    player_id:  str  = Field(foreign_key="yearof_players.id", index=True)
    goals:      int  = Field(default=0)


class YearOfCustomEntry(SQLModel, table=True):
    """Handmatig ingevoerde tijdlijn-items naast de KNHB/Poulebord-sync.

    kind="oefen": oefenwedstrijd (opponent/score optioneel ingevuld).
    kind="bijzonder": vrije invoer (teamuitje, feestje, Pinksterweekend-reis).
    """
    __tablename__ = "yearof_custom_entries"

    id:          str            = Field(default_factory=new_uuid, primary_key=True)
    kind:        str             = Field(default="oefen")  # "oefen" | "bijzonder"
    title:       str
    date:        str             # ISO datum/datetime-string, zelfde stijl als HockeyPouleMatch.match_date
    opponent:    Optional[str]   = Field(default=None)
    is_home:     Optional[bool]  = Field(default=None)
    score_us:    Optional[int]   = Field(default=None)
    score_them:  Optional[int]   = Field(default=None)
    location:    Optional[str]  = Field(default=None)
    description: Optional[str]  = Field(default=None)
    is_pinned:   bool            = Field(default=False)  # bv. de Pinksterweekend-pagina
    archived_at: Optional[datetime] = Field(default=None)  # verborgen op de publieke site, foto's/verslagen eronder blijven bestaan
    created_at:  datetime        = Field(default_factory=datetime.utcnow)
    updated_at:  datetime        = Field(default_factory=datetime.utcnow)
