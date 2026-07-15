from datetime import datetime
from sqlmodel import Field, SQLModel


class AppSetting(SQLModel, table=True):
    __tablename__ = "app_settings"

    key:        str      = Field(primary_key=True)
    value:      str      = Field(default="")
    updated_at: datetime = Field(default_factory=datetime.utcnow)
