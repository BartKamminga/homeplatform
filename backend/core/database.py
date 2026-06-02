import os
from sqlmodel import SQLModel, create_engine, Session
from dotenv import load_dotenv

load_dotenv()

# Get database URL - use absolute path if env var is empty
db_url = os.getenv("DATABASE_URL")
if not db_url or db_url.strip() == "":
    db_dir = os.path.join(os.path.dirname(__file__), "..", "db")
    os.makedirs(db_dir, exist_ok=True)
    db_file = os.path.join(db_dir, "homeplatform.sqlite")
    db_url = f"sqlite:///{db_file.replace(chr(92), '/')}"

DATABASE_URL = db_url

# connect_args alleen nodig voor SQLite
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=os.getenv("ENVIRONMENT") == "development",
)


def get_session():
    with Session(engine) as session:
        yield session


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
