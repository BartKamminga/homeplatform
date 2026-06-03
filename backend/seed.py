"""
Seed script — maakt basis platform data en eerste admin gebruiker aan.

Gebruik:
    cd backend
    python seed.py

Of met eigen wachtwoord:
    python seed.py --username admin --password geheim123
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from core.database import engine, create_db_and_tables
from core.auth import hash_password
from models.core import User, UserGroup, Group, Theme


def seed_base(session: Session):
    """Maakt altijd de basis groepen en thema aan — ook als ze al bestaan."""

    # Groepen
    for name, slug in [("Admins", "admins"), ("Members", "members")]:
        if not session.exec(select(Group).where(Group.slug == slug)).first():
            session.add(Group(name=name, slug=slug))
            print(f"  Groep '{slug}' aangemaakt")
        else:
            print(f"  Groep '{slug}' bestaat al")
    session.commit()

    # Standaard thema
    if not session.exec(select(Theme)).first():
        session.add(
            Theme(
                name="Default",
                tokens={
                    "--color-primary": "#534AB7",
                    "--color-surface": "#F1EFE8",
                    "--color-background": "#FFFFFF",
                    "--color-text": "#2C2C2A",
                },
                is_default=True,
            )
        )
        session.commit()
        print("  Standaard thema aangemaakt")
    else:
        print("  Thema bestaat al")


def seed_admin(session: Session, username: str, password: str, email: str):
    """Maakt de admin gebruiker aan en voegt hem toe aan de admins groep."""

    # Check of gebruiker al bestaat
    user = session.exec(select(User).where(User.username == username)).first()

    if not user:
        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            locale="nl",
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        print(f"  Gebruiker '{username}' aangemaakt")
    else:
        print(f"  Gebruiker '{username}' bestaat al")

    # Koppel aan admins groep
    admin_group = session.exec(select(Group).where(Group.slug == "admins")).first()
    if admin_group:
        existing = session.exec(
            select(UserGroup)
            .where(UserGroup.user_id == user.id)
            .where(UserGroup.group_id == admin_group.id)
        ).first()
        if not existing:
            session.add(UserGroup(user_id=user.id, group_id=admin_group.id))
            session.commit()
            print(f"  '{username}' toegevoegd aan admins groep")
        else:
            print(f"  '{username}' is al lid van admins groep")


def seed(username: str, password: str, email: str):
    create_db_and_tables()

    with Session(engine) as session:
        print("\n→ Basis data...")
        seed_base(session)

        print("\n→ Admin gebruiker...")
        seed_admin(session, username, password, email)

        print("\n✓ Seed klaar")
        print(f"  Login: {username} / {password}")
        print(f"  Docs:  http://localhost:8000/api/docs")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", default="admin")
    parser.add_argument("--password", default="admin123")
    parser.add_argument("--email", default="admin@homeplatform.local")
    args = parser.parse_args()

    seed(args.username, args.password, args.email)
