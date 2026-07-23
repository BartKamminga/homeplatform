"""roadmap_nas.py — NAS-side database logic for roadmap.ps1.

Called via SSH: roadmap.ps1 base64-encodes this file and pipes it to python3.
Arguments: cmd [options]
  list   [--status S] [--site S] [--priority P]
  changelog
  add    --title T --site S --priority P [--description D]
  close  --id N --version V
  closemany --ids N,N,N --version V
  update --id N [--status S] [--priority P] [--title T] [--notes N] [--version V]
         [--impact I] [--risk R] [--scope SC] [--description D]
"""

import sqlite3, uuid, sys, argparse
from datetime import datetime

DB = "/volume1/homeplatform/db/homeplatform.sqlite"


def _con():
    con = sqlite3.connect(DB, timeout=10)
    con.row_factory = sqlite3.Row
    return con


def cmd_list(status="", site="", priority=""):
    where = "1=1"
    if status:   where += f" AND status='{status}'"
    if site:     where += f" AND site='{site}'"
    if priority: where += f" AND priority='{priority}'"
    order = ("CASE status "
             "WHEN 'deploying' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'ready' THEN 2 "
             "WHEN 'pick_up' THEN 3 WHEN 'analyzed' THEN 4 WHEN 'idea' THEN 5 ELSE 6 END, "
             "CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, id")
    con = _con()
    cur = con.cursor()
    cur.execute(f"SELECT id, status, site, priority, title, version FROM roadmap_items WHERE {where} ORDER BY {order}")
    rows = cur.fetchall()
    print("ID    STATUS         SITE        PRIOR   TITEL")
    print("-" * 72)
    for row in rows:
        rid, status_, site_, priority_, title, version = row
        ver = f" [v{version}]" if version else ""
        print(str(rid).ljust(5) + str(status_).ljust(15) + str(site_).ljust(12) + str(priority_).ljust(8) + str(title) + ver)
    con.close()


def cmd_changelog():
    con = _con()
    cur = con.cursor()
    cur.execute("SELECT site, version, title, released_at FROM changelog ORDER BY released_at DESC LIMIT 20")
    rows = cur.fetchall()
    print(f"{'SITE':<12}  {'VERSIE':<8}  TITEL")
    print("-" * 60)
    for site, ver, title, dt in rows:
        print(f"{site:<12}  {ver:<8}  {title}")
    con.close()


def cmd_add(title, site, priority="medium", description=""):
    now = datetime.utcnow().isoformat()
    con = _con()
    con.execute(
        "INSERT INTO roadmap_items (title, site, priority, status, description, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
        (title, site, priority or "medium", "idea", description or None, None, now, now)
    )
    con.commit()
    print(f"[OK] Toegevoegd: {title}")
    con.close()


def _create_changelog(cur, rid, version, now):
    cur.execute("SELECT site, title, notes, description FROM roadmap_items WHERE id=?", (rid,))
    row = cur.fetchone()
    if not row:
        return
    site, title, notes, description = row
    cl_desc = notes or description
    cur.execute("SELECT id FROM changelog WHERE site=? AND version=? AND title=?", (site, version, title))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO changelog (id, version, site, title, description, released_at, created_at) VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), version, site, title, cl_desc, now, now)
        )


def cmd_close(id_, version):
    now = datetime.utcnow().isoformat()
    con = _con()
    cur = con.cursor()
    cur.execute("SELECT id FROM roadmap_items WHERE id=?", (id_,))
    if not cur.fetchone():
        print(f"[FOUT] Item {id_} niet gevonden")
        con.close()
        return
    cur.execute("UPDATE roadmap_items SET status='done', version=?, updated_at=? WHERE id=?", (version, now, id_))
    _create_changelog(cur, id_, version, now)
    con.commit()
    cur.execute("SELECT site, title FROM roadmap_items WHERE id=?", (id_,))
    row = cur.fetchone()
    print(f"[OK] Afgesloten: {row[0]} v{version} — {row[1]}")
    con.close()


def cmd_closemany(ids, version):
    now = datetime.utcnow().isoformat()
    con = _con()
    cur = con.cursor()
    for rid in ids:
        cur.execute("SELECT id FROM roadmap_items WHERE id=?", (rid,))
        if not cur.fetchone():
            print(f"[SKIP] Id {rid} niet gevonden")
            continue
        cur.execute("UPDATE roadmap_items SET status='done', version=?, updated_at=? WHERE id=?", (version, now, rid))
        _create_changelog(cur, rid, version, now)
        cur.execute("SELECT site, title FROM roadmap_items WHERE id=?", (rid,))
        row = cur.fetchone()
        print(f"[OK] {row[0]} v{version} — {row[1]}")
    con.commit()
    con.close()


def cmd_get(id_):
    con = _con()
    cur = con.cursor()
    cur.execute(
        "SELECT id, status, site, priority, title, version, description, notes, impact, risk, scope, created_at, updated_at "
        "FROM roadmap_items WHERE id=?", (id_,)
    )
    row = cur.fetchone()
    con.close()
    if not row:
        print(f"[FOUT] Item {id_} niet gevonden")
        return
    fields = ["id", "status", "site", "priority", "title", "version", "description", "notes", "impact", "risk", "scope", "created_at", "updated_at"]
    for f in fields:
        val = row[f]
        if val:
            print(f"{f.upper():<14} {val}")


def cmd_update(id_, **kwargs):
    sets = []
    allowed = ["status", "priority", "title", "notes", "version", "impact", "risk", "scope", "description"]
    for k in allowed:
        v = kwargs.get(k)
        if v is not None:
            sets.append(f"{k}='{v}'")
    if not sets:
        print("[FOUT] Geen velden opgegeven")
        return
    now = datetime.utcnow().isoformat()
    sql = f"UPDATE roadmap_items SET {', '.join(sets)}, updated_at='{now}' WHERE id={id_}"
    con = _con()
    con.execute(sql)
    con.commit()
    print(f"[OK] Item {id_} bijgewerkt")
    con.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["list", "changelog", "add", "close", "closemany", "update", "get"])
    p.add_argument("--status",      default="")
    p.add_argument("--site",        default="")
    p.add_argument("--priority",    default="")
    p.add_argument("--title",       default="")
    p.add_argument("--description", default="")
    p.add_argument("--notes",       default="")
    p.add_argument("--version",     default="")
    p.add_argument("--impact",      default="")
    p.add_argument("--risk",        default="")
    p.add_argument("--scope",       default="")
    p.add_argument("--id",          type=int, default=0)
    p.add_argument("--ids",         default="")
    args = p.parse_args()

    none_if_empty = lambda v: v if v else None

    if args.cmd == "list":
        cmd_list(args.status, args.site, args.priority)
    elif args.cmd == "changelog":
        cmd_changelog()
    elif args.cmd == "add":
        cmd_add(args.title, args.site, args.priority, args.description)
    elif args.cmd == "close":
        cmd_close(args.id, args.version)
    elif args.cmd == "closemany":
        ids = [int(x.strip()) for x in args.ids.split(",") if x.strip()]
        cmd_closemany(ids, args.version)
    elif args.cmd == "get":
        cmd_get(args.id)
    elif args.cmd == "update":
        cmd_update(
            args.id,
            status=none_if_empty(args.status),
            priority=none_if_empty(args.priority),
            title=none_if_empty(args.title),
            notes=none_if_empty(args.notes),
            version=none_if_empty(args.version),
            impact=none_if_empty(args.impact),
            risk=none_if_empty(args.risk),
            scope=none_if_empty(args.scope),
            description=none_if_empty(args.description),
        )
