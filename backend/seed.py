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
from models.core import User, UserGroup, Group, Theme, Site
from models.tournix import Tournament, TournixPhase, TournixPool, TournixTeam


def seed_base(session: Session):
    """Maakt altijd de basis groepen en thema aan."""

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
                name="light",
                tokens={
                    "--color-primary": "#ff3e6c",
                    "--color-surface": "#f0eeea",
                    "--color-background": "#fafaf8",
                    "--color-text": "#1a1a1a",
                },
                is_default=True,
            )
        )
        session.commit()
        print("  Standaard thema aangemaakt")
    else:
        print("  Thema bestaat al")


def seed_sites(session: Session):
    """Registreert de standaard sites. Bestaande sites krijgen een icon update."""

    sites = [
        ("Admin", "admin", "admin", "⚙️"),
        ("NK Hockey", "nkhockey", "nkhockey", "🏑"),
        ("Mix Music", "mixmusic", "mixmusic", "♫"),
        ("DontForget", "dontforget", "dontforget", "📋"),
        ("Poulebord", "poulebord", "poulebord", "🏒"),
    ]

    for name, slug, module, icon in sites:
        existing = session.exec(select(Site).where(Site.slug == slug)).first()
        if not existing:
            session.add(
                Site(name=name, slug=slug, module=module, icon=icon, is_active=True)
            )
            print(f"  Site '{slug}' aangemaakt")
        else:
            if not existing.icon:
                existing.icon = icon
                session.add(existing)
                print(f"  Site '{slug}' icon bijgewerkt naar {icon}")
            else:
                print(f"  Site '{slug}' bestaat al (icon: {existing.icon})")

    session.commit()


def seed_admin(session: Session, username: str, password: str, email: str):
    """Maakt de admin gebruiker aan en voegt hem toe aan de admins groep."""

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


def seed_poulebord_2026(session: Session):
    """Maakt de Poulebord toernooien aan voor seizoen 2026-2027 (idempotent)."""
    import uuid as _uuid
    from datetime import datetime as _dt

    SEASON = "2026-2027"
    DATA = {
        "MO18": {"A": ["Craeyenhout","Fletiomare","Hurley","Nijmegen"],
                 "B": ["Gooische","HDM","Naarden","Phoenix"],
                 "C": ["Bloemendaal","Groningen","Kampong","Pinoké"],
                 "D": ["Den Bosch","Leonidas","Spandersbosch","Tilburg"],
                 "E": ["Alliance","HGC","Oranje-Rood","Schiedam"],
                 "F": ["Klein Zwitserland","Laren","Rood-Wit","Victoria"],
                 "G": ["Noordwijk","Push","Schaerweijde","SCHC"],
                 "H": ["Amsterdam","Apeldoorn","Rotterdam","Zwolle"]},
        "JO18": {"A": ["Fletiomare","Groningen","Kampong","Nijmegen"],
                 "B": ["Gooische","Klein Zwitserland","Leiden","Roomburg"],
                 "C": ["Cartouche","HDM","Hilversum","Laren"],
                 "D": ["Amsterdam","Bloemendaal","MEP","Naarden"],
                 "E": ["Deventer","Rood-Wit","Rotterdam","Victoria"],
                 "F": ["Den Bosch","Maarssen","Schaerweijde","Zwolle"],
                 "G": ["Oranje-Rood","SCHC","Voordaan","Xenios"],
                 "H": ["Hurley","Pinoké","Push","Tilburg"]},
        "MO16": {"A": ["EHV","Gooische","Groningen","Phoenix","Victoria","Zwolle"],
                 "B": ["Amersfoort","GHBS","Rood-Wit","Rotterdam","SCHC","Voordaan"],
                 "C": ["Amsterdam","Craeyenhout","Hurley","MOP","VVV HC","Xenios"],
                 "D": ["Bloemendaal","Cartouche","HDM","Myra","Push","Schaerweijde"],
                 "E": ["Breda","HBS","Huizen","Klein Zwitserland","Nijmegen","Noordwijk"],
                 "F": ["Apeldoorn","Barendrecht","Bennebroek","Fletiomare","Naarden","Tilburg"],
                 "G": ["AthenA","Delta Venlo","Helmond","Kampong","Pinoké","Spandersbosch"],
                 "H": ["Den Bosch","HDS","Leiden","Leonidas","Oranje-Rood","Zoetermeer"]},
        "JO16": {"A": ["Bloemendaal","Deventer","Fletiomare","Forescate","Klein Zwitserland","Voordaan"],
                 "B": ["Cartouche","HBS","Leiden","Pinoké","Shinty","Upward"],
                 "C": ["Amsterdam","Gooische","Groningen","Maarssen","Naarden","Zwolle"],
                 "D": ["Alliance","AthenA","Laren","SCHC","Spandersbosch","Tilburg"],
                 "E": ["Hilversum","MOP","Nijmegen","Phoenix","Roomburg","Schaerweijde"],
                 "F": ["Bennebroek","Berkel-Rodenrijs","Kampong","MEP","Rotterdam","Schiedam"],
                 "G": ["Breda","HDM","Hurley","Rood-Wit","Victoria","Warande"],
                 "H": ["Delta Venlo","Den Bosch","Houten","Oranje-Rood","Push","Zwaluwen"]},
        "MO14": {"A": ["Bully","GHBS","Groningen","Leeuwarden","Twente","Zwolle"],
                 "B": ["Alkmaar","Alliance","Bloemendaal","HBS","Hurley","Rood-Wit"],
                 "C": ["Amsterdam","AthenA","Diemen","Pinoké","VVV HC","Weesp"],
                 "D": ["Almere","Gooische","Huizen","Laren","Naarden","Spandersbosch"],
                 "E": ["Craeyenhout","HDM","HDS","Klein Zwitserland","Leiden","Noordwijk"],
                 "F": ["Alphen","Berkel-Rodenrijs","Cartouche","Derby","Rotterdam","Victoria"],
                 "G": ["Fletiomare","Hilversum","Houten","Kampong","SCHC","Voordaan"],
                 "H": ["Apeldoorn","Nijmegen","Phoenix","Schaerweijde","Upward","Wageningen"],
                 "I": ["Breda","Pelikaan","Push","Rosmalen","Tilburg","Zwart-Wit"],
                 "J": ["Delta Venlo","Den Bosch","Maastricht","MOP","Oranje-Rood","Were Di"]},
        "JO14": {"A": ["Apeldoorn","Groningen","Nijmegen","Oosterbeek","Upward","Zwolle"],
                 "B": ["Amsterdam","AthenA","Bloemendaal","Hurley","Myra","Pinoké"],
                 "C": ["Alliance","Forescate","HBS","Leiden","Rood-Wit","Roomburg"],
                 "D": ["Gooische","Laren","Naarden","SCHC","Voordaan","Weesp"],
                 "E": ["Cartouche","HDM","HGC","Klein Zwitserland","Ring Pass","Rotterdam"],
                 "F": ["Berkel-Rodenrijs","Breda","Leonidas","Push","Tilburg","Victoria"],
                 "G": ["Fletiomare","Houten","Kampong","Phoenix","Schaerweijde","Spandersbosch"],
                 "H": ["Delta Venlo","Den Bosch","Helmond","MOP","Oranje-Rood","Rosmalen"]},
    }

    total = 0
    for cat, pools in DATA.items():
        existing = session.exec(
            select(Tournament).where(Tournament.name == cat, Tournament.season == SEASON)
        ).first()
        if existing:
            print(f"  Toernooi {cat} {SEASON} bestaat al")
            continue

        t = Tournament(
            id=str(_uuid.uuid4()), name=cat, season=SEASON,
            num_pools=len(pools), pool_type="half",
            status="active", stage="productie",
            created_at=_dt.utcnow(),
        )
        session.add(t)
        session.flush()

        phase = TournixPhase(
            id=str(_uuid.uuid4()), tournament_id=t.id,
            name="Poulefase", phase_type="pool", pool_type="half",
            order=0, created_at=_dt.utcnow(),
        )
        session.add(phase)
        session.flush()

        for order, (letter, teams) in enumerate(pools.items()):
            pool = TournixPool(
                id=str(_uuid.uuid4()), tournament_id=t.id,
                phase_id=phase.id, name=letter, order=order,
            )
            session.add(pool)
            session.flush()
            for team_name in teams:
                session.add(TournixTeam(
                    id=str(_uuid.uuid4()), tournament_id=t.id,
                    name=team_name, pool_id=pool.id,
                    created_at=_dt.utcnow(),
                ))
                total += 1

        session.commit()
        print(f"  Toernooi {cat} aangemaakt ({len(pools)} poules)")

    if total:
        print(f"  {total} teams aangemaakt voor seizoen {SEASON}")


def seed(username: str, password: str, email: str):
    create_db_and_tables()

    with Session(engine) as session:
        print("\n>> Basis data...")
        seed_base(session)

        print("\n>> Sites...")
        seed_sites(session)

        print("\n>> Admin gebruiker...")
        seed_admin(session, username, password, email)

        print("\n>> Poulebord toernooien 2026-2027...")
        seed_poulebord_2026(session)

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
