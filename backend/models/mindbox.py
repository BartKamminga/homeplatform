from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
import uuid


def new_uuid() -> str:
    return str(uuid.uuid4())


class MindboxCase(SQLModel, table=True):
    """Container die meerdere MindboxItems en MindboxResponses aan elkaar
    koppelt (Bart, 2-09-2026: 'vaak zal een MindboxItem vervolg krijgen') -
    bv. een mailwisseling met meerdere binnengekomen mails en meerdere
    concept-antwoorden, of een dossier met meerdere documenten. context_id
    koppelt optioneel EEN herbruikbare persona/instructie (MindboxContext)
    aan de HELE case (Bart, item 1051: 'ik wil toch per case een context,
    niet per bestand.. dat is ingewikkeld') - was eerst per item, dat bleek
    onnodig complex. MindboxContext blijft zelf wel een herbruikbare
    bibliotheek over meerdere, ongerelateerde cases heen."""
    __tablename__ = "mindbox_cases"

    id:          str      = Field(default_factory=new_uuid, primary_key=True)
    user_id:     str      = Field(foreign_key="users.id", index=True)
    name:        str      # bv. "SRE-vacature-kwestie"
    status:      str      = Field(default="new")  # new | in_progress | done
    description: Optional[str] = Field(default=None)
    context_id:  Optional[str] = Field(default=None, foreign_key="mindbox_contexts.id")
    created_at:  datetime = Field(default_factory=datetime.utcnow)
    updated_at:  datetime = Field(default_factory=datetime.utcnow)


class MindboxContext(SQLModel, table=True):
    """Herbruikbare instructie-/persona-tekst (Bart, 2-09-2026: 'sommige
    mails wil ik behandelen als een manager... = een bepaalde session.md-
    inhoud') - een MindboxItem kan aan een context gekoppeld worden om aan
    te geven HOE het behandeld moet worden. Losstaand van agent-control's
    AgentContext (die is gebonden aan een hardcoded agent-registry, zie
    plan) - dit is puur vrije tekst, gescopet op de eigenaar. Bewust GEEN
    case_id - blijft herbruikbaar over cases heen, zie MindboxCase."""
    __tablename__ = "mindbox_contexts"

    id:          str      = Field(default_factory=new_uuid, primary_key=True)
    user_id:     str      = Field(foreign_key="users.id", index=True)
    name:        str      # bv. "Manager-response", "Technische review"
    content:     str      # de instructie-/persona-tekst zelf
    created_at:  datetime = Field(default_factory=datetime.utcnow)
    updated_at:  datetime = Field(default_factory=datetime.utcnow)


class MindboxKnowledge(SQLModel, table=True):
    """Generieke, cross-case kennis-/reference-info met een vrije naam
    (bv. "NIPV-Info", "Hoe sla ik plaatjes op", "Andere systeemzaken") -
    losstaand van MindboxContext (dat is instructie/persona: HOE moet ik
    reageren) en MindboxContact (dat is WIE de andere partij is). v1 is
    bewust een losstaande bibliotheek: geen case_id, geen koppeltabel -
    gewoon opzoekbaar tijdens het werken aan een case, net als Context."""
    __tablename__ = "mindbox_knowledge"

    id:          str      = Field(default_factory=new_uuid, primary_key=True)
    user_id:     str      = Field(foreign_key="users.id", index=True)
    name:        str      # bv. "NIPV-Info", "Hoe sla ik plaatjes op"
    content:     str      # de kennis-/reference-tekst zelf
    created_at:  datetime = Field(default_factory=datetime.utcnow)
    updated_at:  datetime = Field(default_factory=datetime.utcnow)


class MindboxItem(SQLModel, table=True):
    """Een geüpload, persoonsgebonden bestand (mail/document) - Fase 1 (item
    1050): puur opslag + status + vrij notitieveld, geen geautomatiseerde
    verwerking. Bart/Claude bekijken en verwerken items samen in een Claude
    Code-sessie; het notities-veld is bedoeld voor context/voorbereiding die
    Bart daarbij zelf invult. case_id koppelt optioneel dit item aan een
    MindboxCase (bv. een mailwisseling met vervolgmails) - de instructie-
    /persona-context zit op de CASE (zie MindboxCase.context_id), niet hier."""
    __tablename__ = "mindbox_items"

    id:                str      = Field(default_factory=new_uuid, primary_key=True)
    user_id:           str      = Field(foreign_key="users.id", index=True)
    original_filename: str
    file_path:         str      # relatief pad onder UPLOAD_ROOT, conventie: mindbox/{user_id}/{uuid}{ext}
    content_type:      Optional[str] = Field(default=None)
    size_bytes:        int
    content_hash:      Optional[str] = Field(default=None, index=True)  # sha256 van de bytes - duplicaatdetectie (item 1051)
    status:            str      = Field(default="new")  # new | in_progress | done
    notes:             Optional[str] = Field(default=None)
    # Automatisch geextraheerde platte tekst van het bestand zelf (bv. de
    # mail-body van een .msg) - item 1051 (Bart): "als de parsing van een
    # .msg is gedaan, dan wil ik dat kunnen inzien 'onder' het bestand".
    # Bewust een apart veld van `notes` (dat is Bart's EIGEN aantekening,
    # dit is de automatische extractie van de bestandsinhoud zelf).
    parsed_text:       Optional[str] = Field(default=None)
    # Bijlage van een ander item (bv. een PDF die uit een .msg is
    # geextraheerd) - item 1051 (Bart): "hoe gaan we om met attachments in
    # een mail?". Zelfde patroon als MindboxResponse.parent_response_id.
    # Erft altijd het case_id van het ouder-item (zie services.save_upload).
    parent_item_id:    Optional[str] = Field(default=None, foreign_key="mindbox_items.id", index=True)
    case_id:           Optional[str] = Field(default=None, foreign_key="mindbox_cases.id")
    created_at:        datetime = Field(default_factory=datetime.utcnow)
    updated_at:        datetime = Field(default_factory=datetime.utcnow)


class MindboxContact(SQLModel, table=True):
    """Profiel van WIE de andere partij in een mail/document is (persoon of
    systeem) - los van MindboxContext (dat gaat over HOE Bart terugschrijft).
    Herbruikbaar over cases heen, groeit per case (bv. notes-veld met
    inschatting/communicatiestijl). Item 1052 (Bart): 'als er namen in
    files/teksten voorkomen dan moet daar een koppeling worden gemaakt naar
    contacts... makkelijk om te gebruiken voor verbeterde antwoorden en
    inschatting van persoon'. v1 matcht bewust ALLEEN op e-mailadres (uit
    .msg sender/to/cc, betrouwbaar) - koppelen op vrije-tekst namen is
    onbetrouwbaar en blijft voor een latere alias-laag."""
    __tablename__ = "mindbox_contacts"

    id:            str      = Field(default_factory=new_uuid, primary_key=True)
    user_id:       str      = Field(foreign_key="users.id", index=True)
    email:         str      = Field(index=True)  # uniek per user, zie services._normalize_email
    display_name:  Optional[str] = Field(default=None)
    notes:         Optional[str] = Field(default=None)
    created_at:    datetime = Field(default_factory=datetime.utcnow)
    updated_at:    datetime = Field(default_factory=datetime.utcnow)


class MindboxItemContact(SQLModel, table=True):
    """Many-to-many-koppeling tussen een MindboxItem en MindboxContact -
    item 1052 (Bart): 'kan ik meerdere contacten aan een bestand koppelen?'
    Een mail heeft vaak meerdere deelnemers (afzender + to + cc), dus een
    los contact_id-veld op MindboxItem (v1) bleek te beperkt. Zelfde patroon
    als MindboxResponseSource."""
    __tablename__ = "mindbox_item_contacts"

    item_id:     str = Field(foreign_key="mindbox_items.id", primary_key=True)
    contact_id:  str = Field(foreign_key="mindbox_contacts.id", primary_key=True)


class MindboxResponse(SQLModel, table=True):
    """Een voorbereide tekst/rapport/antwoord, gekoppeld aan 1+ MindboxItems
    via MindboxResponseSource (bronvermelding) en optioneel een vervolg op
    een eerdere response (opvolging). case_id is VERPLICHT (Bart, item 1051:
    'los bekijken van responses is niet relevant') - een response bestaat
    altijd binnen een case; bij verwijderen van de case wordt de response
    mee verwijderd (zie services.mindbox.delete_case)."""
    __tablename__ = "mindbox_responses"

    id:                  str      = Field(default_factory=new_uuid, primary_key=True)
    user_id:             str      = Field(foreign_key="users.id", index=True)
    content:             str
    parent_response_id:  Optional[str] = Field(default=None, foreign_key="mindbox_responses.id")
    case_id:             str      = Field(foreign_key="mindbox_cases.id", index=True)
    created_at:          datetime = Field(default_factory=datetime.utcnow)


class MindboxResponseSource(SQLModel, table=True):
    """Many-to-many-koppeling tussen een MindboxResponse en de MindboxItems
    waarop die gebaseerd is (bronvermelding)."""
    __tablename__ = "mindbox_response_sources"

    response_id: str = Field(foreign_key="mindbox_responses.id", primary_key=True)
    item_id:     str = Field(foreign_key="mindbox_items.id", primary_key=True)


class MindboxCaseEvent(SQLModel, table=True):
    """Case-gescoopte activiteiten-tijdlijn (Bart, 2-09-2026: 'alles in audit
    laten landen... met MindCase in detail bijhouden wat er is gebeurd, ook
    binnen de sessie hier in de terminal') - een gerichte, per-case query-
    bare tijdlijn, los van de generieke AuditLog (die niet case-gescoped is
    en niet bedoeld is voor vrije verhalende aantekeningen). event_type is
    vrij (bv. 'upload', 'status_change', 'response_created', 'session_note')
    - 'session_note' is specifiek bedoeld voor een samenvatting van wat er
    in een Claude Code-sessie is gebeurd, handmatig toegevoegd."""
    __tablename__ = "mindbox_case_events"

    id:          str      = Field(default_factory=new_uuid, primary_key=True)
    case_id:     str      = Field(foreign_key="mindbox_cases.id", index=True)
    user_id:     str      = Field(foreign_key="users.id", index=True)
    event_type:  str
    description: str
    created_at:  datetime = Field(default_factory=datetime.utcnow)
