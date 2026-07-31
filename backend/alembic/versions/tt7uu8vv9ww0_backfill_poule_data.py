"""backfill_poule_data: vul lege poules, importeer missende poules, maak competitions aan, vul district

Revision ID: tt7uu8vv9ww0
Revises: ss6tt7uu8vv9
Branch_labels: None
Depends_on: None
"""
import json
from datetime import datetime, timezone

from alembic import op  # noqa: E402
from sqlalchemy import text

revision = "tt7uu8vv9ww0"
down_revision = "ss6tt7uu8vv9"
branch_labels = None
depends_on = None

NOW = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")


def _season_from_matches(matches):
    for m in matches:
        d = (m.get("date") or "")[:10]
        if len(d) >= 7:
            try:
                y, mo = int(d[:4]), int(d[5:7])
                return f"{y}-{y+1}" if mo >= 8 else f"{y-1}-{y}"
            except Exception:
                pass
    return ""


def _parse_poule_capture(payload_str):
    """Parse een raw 'poule' data_capture. Structuur: payload['data']['poule']."""
    try:
        pay = json.loads(payload_str)
        poule = pay.get("data", {}).get("poule", {})
        if not poule:
            return None
        comp = poule.get("competition", {}) or {}
        subcomp = comp.get("subcompetition", {}) or {}

        poule_id = poule.get("id")
        if not poule_id:
            return None

        comp_name  = (comp.get("name") or "").strip()
        class_name = ((subcomp.get("class") or comp.get("class_name") or "")).strip()
        district   = (comp.get("district_name") or comp.get("district") or "").strip()
        season     = _season_from_matches(poule.get("matches") or [])

        standings = []
        for s in poule.get("standings") or []:
            t = s.get("team") or {}
            team_id = t.get("id")
            if not team_id:
                continue
            standings.append({
                "team_id":      team_id,
                "team_name":    (t.get("name") or "").strip(),
                "position":     s.get("rank") or s.get("position"),
                "played":       s.get("played") or 0,
                "won":          s.get("wins") or s.get("won") or 0,
                "drawn":        s.get("draws") or s.get("drawn") or s.get("draw") or 0,
                "lost":         s.get("losses") or s.get("lost") or 0,
                "goals_for":    s.get("goals_for") or s.get("gf") or 0,
                "goals_against":s.get("goals_against") or s.get("ga") or 0,
                "points":       s.get("points") or s.get("pts") or 0,
            })

        matches = []
        for m in poule.get("matches") or []:
            ht = m.get("home") or m.get("home_team") or m.get("homeTeam") or {}
            at = m.get("away") or m.get("away_team") or m.get("awayTeam") or {}
            sc = m.get("score") or {}
            matches.append({
                "match_id":       m.get("id"),
                "home_team_id":   ht.get("id"),
                "home_team_name": (ht.get("name") or "").strip(),
                "away_team_id":   at.get("id"),
                "away_team_name": (at.get("name") or "").strip(),
                "match_date":     (m.get("date") or "")[:10],
                "status":         m.get("status") or "",
                "home_score":     sc.get("home") if sc else None,
                "away_score":     sc.get("away") if sc else None,
                "round":          m.get("round") or m.get("round_number"),
            })

        return {
            "poule_id":    int(poule_id),
            "poule_name":  (poule.get("name") or "").strip(),
            "comp_name":   comp_name,
            "class_name":  class_name,
            "district":    district,
            "season":      season,
            "standings":   standings,
            "matches":     matches,
        }
    except Exception:
        return None


def _upsert_competition(bind, comp_name, class_name, district, season, existing_comps):
    if not comp_name or not season:
        return None
    ext_id = comp_name + "|" + class_name + "|" + district + "|" + season
    if ext_id in existing_comps:
        return existing_comps[ext_id]

    # hockey_type van bestaande comp overnemen indien beschikbaar
    ref = bind.execute(
        text("SELECT hockey_type FROM hockey_competitions WHERE name = :n AND season = :s LIMIT 1"),
        {"n": comp_name, "s": season},
    ).fetchone()
    hockey_type = ref[0] if ref else "VE"

    bind.execute(
        text("""
            INSERT INTO hockey_competitions
                (external_id, name, class_name, district, hockey_type, season, discovered_at, updated_at)
            VALUES (:ext_id, :name, :class_name, :district, :hockey_type, :season, :now, :now)
        """),
        {
            "ext_id": ext_id, "name": comp_name, "class_name": class_name,
            "district": district or None, "hockey_type": hockey_type,
            "season": season, "now": NOW,
        },
    )
    new_id = bind.execute(text("SELECT last_insert_rowid()")).fetchone()[0]
    existing_comps[ext_id] = new_id
    return new_id


def _upsert_standings(bind, poule_id, standings):
    if not standings:
        return
    bind.execute(text("DELETE FROM hockey_poule_standings WHERE poule_id = :pid"), {"pid": poule_id})
    for s in standings:
        bind.execute(
            text("""
                INSERT INTO hockey_poule_standings
                    (poule_id, team_id, team_name, position, played, won, drawn, lost,
                     goals_for, goals_against, points, updated_at)
                VALUES
                    (:poule_id, :team_id, :team_name, :position, :played, :won, :drawn, :lost,
                     :goals_for, :goals_against, :points, :now)
            """),
            {**s, "poule_id": poule_id, "now": NOW},
        )


def _upsert_matches(bind, poule_id, matches):
    if not matches:
        return
    bind.execute(text("DELETE FROM hockey_poule_matches WHERE poule_id = :pid"), {"pid": poule_id})
    for m in matches:
        if not m.get("match_id"):
            continue
        bind.execute(
            text("""
                INSERT OR IGNORE INTO hockey_poule_matches
                    (poule_id, match_id, home_team_id, home_team_name, away_team_id, away_team_name,
                     match_date, status, home_score, away_score, round, updated_at)
                VALUES
                    (:poule_id, :match_id, :home_team_id, :home_team_name, :away_team_id, :away_team_name,
                     :match_date, :status, :home_score, :away_score, :round, :now)
            """),
            {**m, "poule_id": poule_id, "now": NOW},
        )


def upgrade():
    bind = op.get_bind()

    # Laad bestaande competitions (ext_id -> id)
    existing_comps = {
        r[0]: r[1]
        for r in bind.execute(text("SELECT external_id, id FROM hockey_competitions")).fetchall()
    }

    # Laad bestaande poules (poule_id -> (id, competition_id, season))
    existing_poules = {
        r[0]: {"db_id": r[1], "competition_id": r[2], "season": r[3]}
        for r in bind.execute(
            text("SELECT poule_id, id, competition_id, season FROM hockey_poules")
        ).fetchall()
    }

    # Poules zonder standings
    empty_poule_ids = {
        r[0]
        for r in bind.execute(
            text("""
                SELECT hp.poule_id FROM hockey_poules hp
                LEFT JOIN hockey_poule_standings hps ON hps.poule_id = hp.poule_id
                WHERE hps.poule_id IS NULL
            """)
        ).fetchall()
    }

    # Laad alle raw poule captures
    captures = bind.execute(
        text("SELECT payload FROM data_captures WHERE capture_type = 'poule'")
    ).fetchall()

    stats = {"comps_created": 0, "poules_created": 0, "poules_filled": 0,
             "district_updated": 0, "standings_written": 0, "matches_written": 0}

    seen_poule_ids = set()

    for row in captures:
        parsed = _parse_poule_capture(row[0])
        if not parsed:
            continue

        pid        = parsed["poule_id"]
        comp_name  = parsed["comp_name"]
        class_name = parsed["class_name"]
        district   = parsed["district"]
        season     = parsed["season"]

        if pid in seen_poule_ids:
            continue
        seen_poule_ids.add(pid)

        # Stap A: competition upsert (alleen als we genoeg info hebben)
        comp_db_id = None
        if comp_name and season:
            old_count = len(existing_comps)
            comp_db_id = _upsert_competition(bind, comp_name, class_name, district, season, existing_comps)
            if len(existing_comps) > old_count:
                stats["comps_created"] += 1

        # Stap B: district bijwerken op bestaande competitie (ook als ext_id al bestond)
        if comp_db_id and district:
            bind.execute(
                text("""
                    UPDATE hockey_competitions
                    SET district = :district, updated_at = :now
                    WHERE id = :cid AND (district IS NULL OR district = '')
                """),
                {"district": district, "cid": comp_db_id, "now": NOW},
            )
            # tel updates later via rowcount niet beschikbaar in alembic — skip tellen

        # Stap C: poule aanmaken of bijwerken
        if pid not in existing_poules:
            if not comp_db_id:
                continue  # kan poule niet koppelen zonder competitie
            bind.execute(
                text("""
                    INSERT OR IGNORE INTO hockey_poules
                        (poule_id, name, competition_id, season, discovered_at, updated_at)
                    VALUES (:poule_id, :name, :comp_id, :season, :now, :now)
                """),
                {
                    "poule_id": pid,
                    "name":     parsed["poule_name"],
                    "comp_id":  comp_db_id,
                    "season":   season or "onbekend",
                    "now":      NOW,
                },
            )
            existing_poules[pid] = {"db_id": None, "competition_id": comp_db_id, "season": season}
            stats["poules_created"] += 1
        elif comp_db_id:
            # update competition_id als die nog fout is
            bind.execute(
                text("""
                    UPDATE hockey_poules
                    SET competition_id = :cid, updated_at = :now
                    WHERE poule_id = :pid AND competition_id != :cid
                """),
                {"cid": comp_db_id, "pid": pid, "now": NOW},
            )

        # Stap D: standings + matches schrijven voor lege poules
        if pid in empty_poule_ids:
            if parsed["standings"]:
                _upsert_standings(bind, pid, parsed["standings"])
                stats["standings_written"] += len(parsed["standings"])
                stats["poules_filled"] += 1
            if parsed["matches"]:
                _upsert_matches(bind, pid, parsed["matches"])
                stats["matches_written"] += len(parsed["matches"])

    # Stap E: district bijwerken via poule_capture-entries (hebben district in comp.district_name)
    poule_captures = bind.execute(
        text("SELECT payload FROM data_captures WHERE capture_type = 'poule_capture'")
    ).fetchall()
    for row in poule_captures:
        try:
            pay = json.loads(row[0])
            poule_data = pay.get("data", {}).get("data", {}).get("poule", {})
            comp = poule_data.get("competition", {}) or {}
            district = (comp.get("district_name") or comp.get("district") or "").strip()
            if not district:
                continue
            comp_name  = (comp.get("name") or "").strip()
            subcomp    = comp.get("subcompetition", {}) or {}
            class_name = ((subcomp.get("class") or comp.get("class_name") or "")).strip()
            season_raw = pay.get("seizoen", "")
            if not comp_name or not season_raw:
                continue
            ext_id = comp_name + "|" + class_name + "|" + district + "|" + season_raw
            comp_id = existing_comps.get(ext_id)
            if comp_id:
                bind.execute(
                    text("""
                        UPDATE hockey_competitions
                        SET district = :district, updated_at = :now
                        WHERE id = :cid AND (district IS NULL OR district = '')
                    """),
                    {"district": district, "cid": comp_id, "now": NOW},
                )
        except Exception:
            pass

    print(
        f"[backfill] competitions aangemaakt: {stats['comps_created']} | "
        f"poules aangemaakt: {stats['poules_created']} | "
        f"poules gevuld: {stats['poules_filled']} | "
        f"standings: {stats['standings_written']} | "
        f"matches: {stats['matches_written']}"
    )


def downgrade():
    pass
