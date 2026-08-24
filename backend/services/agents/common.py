"""Gedeelde bouwstenen voor agent-definities - elke agent (hockey_scan.py,

poulebord_agent.py, roadmap_agent.py, ...) importeert hiervandaan i.p.v. zijn
eigen "none"-post-process te herschrijven."""


def pp_none(session, body, current_user):
    """Standaard post-process voor elke agent: alleen een melding, geen
    platform-wijziging. Elke agent kan dit als fallback-optie aanbieden."""
    return {"action": "none"}


NONE_POST_PROCESS = {
    "label": "Alleen melding (geen platform-wijziging)",
    "result_fields": [
        {"name": "notification", "type": "string of null", "required": False, "desc": "Optionele melding aan Bart"},
    ],
    "fn": pp_none,
}
