from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, Column, JSON
import uuid


def new_uuid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Users & Groups
# ---------------------------------------------------------------------------


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    locale: str = Field(default="nl")
    is_active: bool = Field(default=True)
    active_group_id: Optional[str] = Field(default=None)
    pref_group_dontforget: Optional[str] = Field(default=None)
    pref_group_mixmusic: Optional[str] = Field(default=None)
    pref_group_tournix: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)


class Group(SQLModel, table=True):
    __tablename__ = "groups"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    name: str = Field(unique=True)
    slug: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)


class UserGroup(SQLModel, table=True):
    __tablename__ = "user_groups"

    user_id: str = Field(foreign_key="users.id", primary_key=True)
    group_id: str = Field(foreign_key="groups.id", primary_key=True)
    role: str = Field(default="member")


# ---------------------------------------------------------------------------
# Themes & Preferences
# ---------------------------------------------------------------------------


class Theme(SQLModel, table=True):
    __tablename__ = "themes"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    name: str = Field(unique=True)
    tokens: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    is_default: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)


class UserPreference(SQLModel, table=True):
    __tablename__ = "user_preferences"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    user_id: str = Field(foreign_key="users.id", unique=True, index=True)
    theme_id: Optional[str] = Field(default=None, foreign_key="themes.id")
    language: str = Field(default="nl")
    extra: Optional[dict] = Field(default=None, sa_column=Column(JSON))


# ---------------------------------------------------------------------------
# Sites & Access
# ---------------------------------------------------------------------------


class Site(SQLModel, table=True):
    __tablename__ = "sites"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    module: str = Field(index=True)
    theme_id: Optional[str] = Field(default=None, foreign_key="themes.id")
    is_active: bool = Field(default=True)
    icon: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)


class SiteAccess(SQLModel, table=True):
    __tablename__ = "site_access"

    site_id: str = Field(foreign_key="sites.id", primary_key=True)
    group_id: str = Field(foreign_key="groups.id", primary_key=True)


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------


class InviteToken(SQLModel, table=True):
    __tablename__ = "invite_tokens"
    id: str = Field(default_factory=new_uuid, primary_key=True)
    token: str = Field(unique=True, index=True)
    created_by: str = Field(foreign_key="users.id")
    group_id: Optional[str] = Field(default=None, foreign_key="groups.id")
    expires_at: datetime
    used_at: Optional[datetime] = Field(default=None)
    used_by_user_id: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    user_id: Optional[str] = Field(default=None, foreign_key="users.id")
    site: Optional[str] = Field(default=None)
    action: str
    payload: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Roadmap
# ---------------------------------------------------------------------------


class RoadmapItem(SQLModel, table=True):
    __tablename__ = "roadmap_items"
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: Optional[str] = None
    site: str = Field(default="platform")  # landing/admin/account/dontforget/mixmusic/nkhockey/tournix/fiets/platform
    priority: str = Field(default="midden")  # hoog/midden/laag
    status: str = Field(default="idee")  # idee/in_progress/klaar
    notes: Optional[str] = None
    version: Optional[str] = Field(default=None)  # versienummer bij afsluiten, triggert changelog
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
