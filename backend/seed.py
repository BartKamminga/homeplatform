"""
Seed script — maakt de eerste admin gebruiker aan.

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
from models.core import User, UserGroup, Group


def seed(username: str, password: str, email: str):
    create_db_and_tables()

    with Session(engine) as session:
        # Check of admin al bestaat
        existing = session.exec(
            select(User).where(User.username == username)
        ).first()
        if existing:
            print(f"Gebruiker '{username}' bestaat al — seed overgeslagen.")
            return

        # Admin gebruiker aanmaken
        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            locale="nl",
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        # Toevoegen aan admins groep
        admin_group = session.exec(
            select(Group).where(Group.slug == "admins")
        ).first()
        if admin_group:
            session.add(UserGroup(user_id=user.id, group_id=admin_group.id))
            session.commit()

        print(f"Admin gebruiker aangemaakt:")
        print(f"  Gebruikersnaam : {username}")
        print(f"  Wachtwoord     : {password}")
        print(f"  Email          : {email}")
        print(f"  Groep          : admins")
        print()
        print(f"Login via: http://localhost:8000/api/docs")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", default="admin")
    parser.add_argument("--password", default="admin123")
    parser.add_argument("--email", default="admin@homeplatform.local")
    args = parser.parse_args()

    seed(args.username, args.password, args.email)
