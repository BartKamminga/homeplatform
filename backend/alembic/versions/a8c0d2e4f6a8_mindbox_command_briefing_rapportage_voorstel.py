"""mindbox_commands update: Briefing (item 1125, vervolg) - Bart, 8-9-2026:
"moet dat niet onderdeel kunnen zijn van de mindbox.briefing?" - de Briefing
signaleert nu per case of er genoeg nieuwe activiteit is sinds de laatste
dossier-rapportage (of nog geen rapportage bestaat) en STELT VOOR die te
(ver)versen via Case.Rapportage - altijd voorstel, nooit automatisch (Bart
bevestigde dit expliciet, i.v.m. de hoge kosten per rapportage-run).

Revision ID: a8c0d2e4f6a8
Revises: f7a9b1c3d5e7
Create Date: 2026-09-08
"""
import uuid

from alembic import op
import sqlalchemy as sa

revision = "a8c0d2e4f6a8"
down_revision = "f7a9b1c3d5e7"
branch_labels = None
depends_on = None

NOTATION_KEY = "Briefing"

NEW_STEPS = [
    {"kind": "api_call", "action_key": "RunAll",
     "instruction": "Download alle openstaande items en briefing.md",
     "cli_hint": "-Run -All -Env {env}"},
    {"kind": "api_call", "action_key": "ListCases",
     "instruction": "Alle cases ophalen, als basis voor het rapportage-voorstel verderop",
     "cli_hint": "-ListCases -Env {env}"},
    {"kind": "api_call", "action_key": "ListDeadlines",
     "instruction": "Alle belangrijke datums uit de Kalender ophalen",
     "cli_hint": "-ListDeadlines -Env {env}"},
    {"kind": "manual", "action_key": None,
     "instruction": "Op basis van de gedownloade items en de Kalender een beknopte ochtendbriefing "
                     "opstellen met vaste structuur: 1) Agenda vandaag (chronologisch, tijd/naam/context), "
                     "2) Taken & deadlines (gesorteerd op urgentie, INCLUSIEF aankomende/verlopen datums "
                     "uit de Kalender binnen ~14 dagen, met resterende dagen, bv. 'over 3 dagen: ...'), "
                     "3) Mail/berichten die aandacht vragen (alleen items met actie/beslissing), "
                     "4) Aandachtspunten (conflicten, ontbrekende info, per item dat opvolging nodig "
                     "heeft: een VOORSTEL of er een nieuwe case en/of een concept-antwoord bij past, EN "
                     "per case: signaleren of er genoeg nieuwe activiteit is sinds de laatste "
                     "'status-rapportage.html'-update (of nog geen rapportage bestaat) en in dat geval "
                     "voorstellen die te (ver)versen via Case.Rapportage(#case_id) - zelf geen case "
                     "aanmaken, geen antwoord versturen en geen rapportage genereren, alleen voorstellen). "
                     "Beknopt en actiegericht, geen details verzinnen die niet zijn aangeleverd.",
     "cli_hint": None},
    {"kind": "manual", "action_key": None,
     "instruction": "Case 'Ochtendbriefingen' opzoeken (-ListCases); bestaat die nog niet, dan aanmaken "
                     "(-CreateCase -Name \"Ochtendbriefingen\")",
     "cli_hint": None},
    {"kind": "api_call", "action_key": "Upload",
     "instruction": "Briefing als gedateerd .md-bestand (bv. briefing-2026-09-08.md) wegschrijven en "
                     "uploaden in de case 'Ochtendbriefingen'",
     "cli_hint": "-Upload -CaseId <ochtendbriefingen_case_id> -FilePath <pad> -Env {env}"},
    {"kind": "manual", "action_key": None,
     "instruction": "Doorlopend bijhouden (niet optioneel, ALTIJD doen - geen voorstel nodig, in "
                     "tegenstelling tot de case-/antwoord-/rapportage-voorstellen hierboven): nieuwe "
                     "achtergrond-/organisatie-info toevoegen aan Kennis (-UpdateKnowledge) zodra die naar "
                     "voren komt, nieuwe/gewijzigde belangrijke datums vastleggen in de Kalender "
                     "(-AddDeadline), personen die herhaaldelijk voorkomen vastleggen als Contact met "
                     "rolnotitie (-Contact/-ContactNote), en terugkerende cases (bv. vaste "
                     "overlegstructuren) voorzien van een Context die het patroon beschrijft.",
     "cli_hint": None},
]


def _sql_str(value):
    return "'" + value.replace("'", "''") + "'" if value is not None else "NULL"


def _replace_steps(bind, steps):
    row = bind.execute(
        sa.text("SELECT id FROM mindbox_commands WHERE notation_key = :k"), {"k": NOTATION_KEY},
    ).fetchone()
    if not row:
        return  # commando (nog) niet aanwezig - niets bij te werken
    command_id = row[0]
    op.execute(f"DELETE FROM mindbox_command_steps WHERE command_id = {_sql_str(command_id)}")
    for position, step in enumerate(steps):
        step_id = str(uuid.uuid4())
        op.execute(
            "INSERT INTO mindbox_command_steps "
            "(id, command_id, position, kind, action_key, instruction, cli_hint) VALUES ("
            f"{_sql_str(step_id)}, {_sql_str(command_id)}, {position}, {_sql_str(step['kind'])}, "
            f"{_sql_str(step['action_key'])}, {_sql_str(step['instruction'])}, "
            f"{_sql_str(step['cli_hint'])})"
        )


def upgrade() -> None:
    bind = op.get_bind()
    _replace_steps(bind, NEW_STEPS)


def downgrade() -> None:
    OLD_STEPS = [
        {"kind": "api_call", "action_key": "RunAll",
         "instruction": "Download alle openstaande items en briefing.md",
         "cli_hint": "-Run -All -Env {env}"},
        {"kind": "api_call", "action_key": "ListDeadlines",
         "instruction": "Alle belangrijke datums uit de Kalender ophalen",
         "cli_hint": "-ListDeadlines -Env {env}"},
        {"kind": "manual", "action_key": None,
         "instruction": "Op basis van de gedownloade items en de Kalender een beknopte ochtendbriefing "
                         "opstellen met vaste structuur: 1) Agenda vandaag (chronologisch, tijd/naam/context), "
                         "2) Taken & deadlines (gesorteerd op urgentie, INCLUSIEF aankomende/verlopen datums "
                         "uit de Kalender binnen ~14 dagen, met resterende dagen, bv. 'over 3 dagen: ...'), "
                         "3) Mail/berichten die aandacht vragen (alleen items met actie/beslissing), "
                         "4) Aandachtspunten (conflicten, ontbrekende info, en per item dat opvolging nodig "
                         "heeft: een VOORSTEL of er een nieuwe case en/of een concept-antwoord bij past - zelf "
                         "geen case aanmaken of antwoord versturen, alleen voorstellen). Beknopt en "
                         "actiegericht, geen details verzinnen die niet zijn aangeleverd.",
         "cli_hint": None},
        {"kind": "manual", "action_key": None,
         "instruction": "Case 'Ochtendbriefingen' opzoeken (-ListCases); bestaat die nog niet, dan aanmaken "
                         "(-CreateCase -Name \"Ochtendbriefingen\")",
         "cli_hint": None},
        {"kind": "api_call", "action_key": "Upload",
         "instruction": "Briefing als gedateerd .md-bestand (bv. briefing-2026-09-08.md) wegschrijven en "
                         "uploaden in de case 'Ochtendbriefingen'",
         "cli_hint": "-Upload -CaseId <ochtendbriefingen_case_id> -FilePath <pad> -Env {env}"},
        {"kind": "manual", "action_key": None,
         "instruction": "Doorlopend bijhouden (niet optioneel, ALTIJD doen - geen voorstel nodig, in "
                         "tegenstelling tot de case-/antwoord-voorstellen hierboven): nieuwe achtergrond-/"
                         "organisatie-info toevoegen aan Kennis (-UpdateKnowledge) zodra die naar voren komt, "
                         "nieuwe/gewijzigde belangrijke datums vastleggen in de Kalender (-AddDeadline), "
                         "personen die herhaaldelijk voorkomen vastleggen als Contact met rolnotitie "
                         "(-Contact/-ContactNote), en terugkerende cases (bv. vaste overlegstructuren) "
                         "voorzien van een Context die het patroon beschrijft.",
         "cli_hint": None},
    ]
    bind = op.get_bind()
    _replace_steps(bind, OLD_STEPS)
