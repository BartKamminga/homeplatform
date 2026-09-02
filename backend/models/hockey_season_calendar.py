"""Hockey seizoenskalender (item 1043/1045) - vastgelegde speeldagen-fases
per seizoen/district/leeftijdscategorie, geextraheerd uit de officiele KNHB-
speeldagenkalenders (https://www.knhb.nl/competitie/speeldagenkalender).
Voedt get_season_phases() in services/hockey_vanger_settings.py en dient als
geheugen voor volgende seizoenen: een rij met phase='new_schedule' legt vast
wanneer de kalender voor het VOLGENDE seizoen verwacht wordt, zodat de vanger
weet wanneer 'm opnieuw moet checken (i.p.v. district/age_category/
klasse_scope, die voor zo'n rij niet van toepassing zijn en dus leeg blijven)."""

from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class HockeySeasonCalendar(SQLModel, table=True):
    __tablename__ = "hockey_season_calendar"

    id:            Optional[int] = Field(default=None, primary_key=True)
    season:        str = Field(index=True)
    district:      Optional[str] = None
    age_category:  Optional[str] = None
    klasse_scope:  Optional[str] = None
    phase:         str = Field(index=True)
    start_date:    date
    end_date:      date
    rounds:        Optional[int] = None
    source_url:    Optional[str] = None
    notes:         Optional[str] = None
    created_at:    datetime = Field(default_factory=datetime.utcnow)
