from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
import uuid


def new_uuid() -> str:
    return str(uuid.uuid4())


class DataCapture(SQLModel, table=True):
    __tablename__ = "data_captures"

    id:           str      = Field(default_factory=new_uuid, primary_key=True)
    source:       str                          # 'hockey-vanger'
    capture_type: str                          # 'poule'
    external_id:  str                          # poule_id (string)
    session_id:   str                          # UUID grouping captures from one browse session
    payload:      str                          # full API response JSON
    meta:         str                          # queryable summary JSON
    captured_at:  datetime = Field(default_factory=datetime.utcnow)
