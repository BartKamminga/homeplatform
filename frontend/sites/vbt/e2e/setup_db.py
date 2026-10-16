"""E2E: verse SQLite met alle tabellen, het FTP Builder-plan en een testgebruiker; print een JWT.

Gebruik (vanuit backend/):  python ../frontend/sites/vbt/e2e/setup_db.py <pad/naar/e2e.sqlite>
"""
import os
import sys

db = os.path.abspath(sys.argv[1])
os.environ["DATABASE_URL"] = "sqlite:///" + db.replace("\\", "/")
os.environ["SENTRY_DSN"] = ""
sys.path.insert(0, os.getcwd())

import main  # noqa: E402,F401  registreert alle modellen
from sqlmodel import Session, SQLModel  # noqa: E402
from core.database import engine  # noqa: E402
from core.auth import hash_password, create_access_token  # noqa: E402
from models.core import User, Site  # noqa: E402
from services.vbt_workouts import seed_library, seed_plan  # noqa: E402

SQLModel.metadata.create_all(engine)
with Session(engine) as s:
    u = User(username="vbt-e2e", email="vbt-e2e@test.local", password_hash=hash_password("x"), is_active=True)
    s.add(u)
    s.add(Site(name="VBT", slug="vbt", module="vbt", icon="b", is_active=True))
    s.commit()
    s.refresh(u)
    import glob
    for f in sorted(glob.glob('data/vbt/*.json')):
        name = os.path.basename(f)
        if name not in ('climbs.json', 'workouts.json'):
            seed_plan(s, name)
    seed_library(s)
    print("TOKEN=" + create_access_token({"sub": u.id}))
