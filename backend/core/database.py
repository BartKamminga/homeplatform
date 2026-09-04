import logging
import os
from typing import TypeVar
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import event
from dotenv import load_dotenv
from models import dontforget  # noqa: F401 — registreert Task model
from models import mixmusic    # noqa: F401 — registreert Genre + TrackMeta
from models import hockey_season_calendar  # noqa: F401 — registreert HockeySeasonCalendar

load_dotenv()

logger = logging.getLogger(__name__)

db_url = os.getenv("DATABASE_URL")
if not db_url or db_url.strip() == "":
    db_dir = os.path.join(os.path.dirname(__file__), "..", "db")
    os.makedirs(db_dir, exist_ok=True)
    db_file = os.path.join(db_dir, "homeplatform.sqlite")
    db_url = f"sqlite:///{db_file.replace(chr(92), '/')}"

DATABASE_URL = db_url

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},
    echo=os.getenv("ENVIRONMENT") == "development",
)


# item 1083: WAL i.p.v. de standaard rollback-journal (delete) - lezers
# blijven de laatst-consistente versie zien terwijl een schrijver bezig is,
# i.p.v. dat de hele DB-file exclusief vergrendeld wordt. synchronous=NORMAL
# is de aanbevolen combinatie met WAL (veilig genoeg - commit is pas
# zichtbaar na een echte fsync van het WAL-bestand, alleen een crash tussen
# WAL-write en checkpoint kan in het ergste geval de laatste WAL-commits
# kwijtraken, niet de hoofddatabase corrumperen). timeout=30s (was de
# sqlite3-default van 5s) geeft een schrijver die toch even moet wachten
# meer ruimte voor 'database is locked' i.p.v. meteen te falen.
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

_T = TypeVar("_T", bound=SQLModel)


def get_session():
    with Session(engine) as session:
        yield session


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def persist(session: Session, obj: _T) -> _T:
    """add + commit + refresh in één aanroep."""
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj
