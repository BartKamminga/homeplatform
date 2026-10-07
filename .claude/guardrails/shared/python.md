# Python and Alembic

- Always use `python -m pip install` (not `pip.exe`), so you are sure to use the right venv.
- Alembic: always pass an absolute `DATABASE_URL`.
- If the database has no `alembic_version` table: first stamp the previous revision, then upgrade.
- Migrations: no apostrophes in SQL strings — use double quotes or rephrase.
- `down_revision` must point to the previous migration in the chain.
