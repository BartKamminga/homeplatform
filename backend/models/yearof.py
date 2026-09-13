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
    position:     Optional[str]  = Field(default=None)
    photo_url:    Optional[str]  = Field(default=None)
    bio:          Optional[str]  = Field(default=None)
    fun_facts:    Optional[str]  = Field(default=None)  # JSON: [{"label": ..., "value": ...}]
    created_at:   datetime       = Field(default_factory=datetime.utcnow)
    updated_at:   datetime       = Field(default_factory=datetime.utcnow)


class YearOfTeamLink(SQLModel, table=True):
    """Teamlinkje (viewer-toegang), code-als-PK naar het PoulebordBoard-patroon.

    Fase 7 (item 1149): elk linkje heeft een vangnet-vervaldatum (expires_at,
    instelbaar, default 10 dagen) en vervalt daarnaast direct zodra een
    nieuwer linkje wordt uitgegeven (revoked_at). created_at fungeert als
    issued_at - het cutoff-moment voor content-scoping (zie get_team_scope_cutoff
    in routers/yearof_mo14.py): content die na dit moment gepubliceerd is,
    blijft voor dit linkje verborgen, ook al is het linkje zelf nog geldig.
    """
    __tablename__ = "yearof_team_links"

    id:         str            = Field(primary_key=True)  # 6-char code
    created_at: datetime        = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = Field(default=None)  # vangnet; None = alleen bij nieuwer linkje vervallen
    revoked_at: Optional[datetime] = Field(default=None)


class YearOfPhoto(SQLModel, table=True):
    """Foto-bijdrage (fase 4, item 1146). uploader_code is het teamlinkje/
    contributor-linkje waarmee geupload is - geen User.id, want anonieme
    bezoekers hebben geen homeplatform-account."""
    __tablename__ = "yearof_photos"

    id:             str            = Field(default_factory=new_uuid, primary_key=True)
    match_ref:      str             = Field(index=True)  # "knhb:{id}" | "custom:{id}"
    photo_type:     str             = Field(default="actie")  # actie | team | sfeer
    status:         str             = Field(default="concept")  # concept | published
    uploader_code:  Optional[str]   = Field(default=None)
    caption:        Optional[str]  = Field(default=None)
    created_at:     datetime        = Field(default_factory=datetime.utcnow)
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
    insta_url:        Optional[str]  = Field(default=None)
    youtube_url:      Optional[str]  = Field(default=None)
    youtube_urls:     Optional[str]  = Field(default=None)  # JSON-array, voor report_type="wedstrijd_beelden" (tot 4 links)
    contributor_code: Optional[str]  = Field(default=None)
    created_at:       datetime        = Field(default_factory=datetime.utcnow)
    updated_at:       datetime        = Field(default_factory=datetime.utcnow)


class YearOfReportPlayerTag(SQLModel, table=True):
    __tablename__ = "yearof_report_player_tags"

    id:        str = Field(default_factory=new_uuid, primary_key=True)
    report_id: str = Field(foreign_key="yearof_reports.id", index=True)
    player_id: str = Field(foreign_key="yearof_players.id", index=True)


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
    description: Optional[str]  = Field(default=None)
    is_pinned:   bool            = Field(default=False)  # bv. de Pinksterweekend-pagina
    created_at:  datetime        = Field(default_factory=datetime.utcnow)
    updated_at:  datetime        = Field(default_factory=datetime.utcnow)
