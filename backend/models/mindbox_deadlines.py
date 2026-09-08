from datetime import date as date_type, datetime
from typing import Optional
from sqlmodel import Field, SQLModel

from models.mindbox import new_uuid


class MindboxDeadline(SQLModel, table=True):
    """Agent-gecureerde, chronologische lijst van belangrijke datums (item
    1117, Bart: 'we hebben geen agenda, een kalender-view is dan wel handig')
    - BEWUST geen automatische datum-extractie uit vrije tekst (NLP/regex op
    parsed_text), dat geeft ruis/false positives. Een datum komt hier alleen
    in als de agent 'm tijdens een sessie signaleert EN voorstelt (zelfde
    filosofie als case-voorstellen in de Briefing-synthese, item 1115) en
    Bart 'm bevestigt. Optioneel gekoppeld aan een case voor context/traceerbaarheid,
    geen koppeling aan een los item - een deadline gaat vaak over de
    SITUATIE (bv. een re-integratietraject), niet over 1 specifiek bestand."""
    __tablename__ = "mindbox_deadlines"

    id:          str            = Field(default_factory=new_uuid, primary_key=True)
    user_id:     str            = Field(foreign_key="users.id", index=True)
    date:        date_type      = Field(index=True)
    title:       str
    description: Optional[str]  = Field(default=None)
    case_id:     Optional[str]  = Field(default=None, foreign_key="mindbox_cases.id", index=True)
    created_at:  datetime       = Field(default_factory=datetime.utcnow)
    updated_at:  datetime       = Field(default_factory=datetime.utcnow)
