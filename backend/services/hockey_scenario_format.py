"""Mens-leesbare vertaling van ruwe scenario-uitkomsten naar tekst/hints voor
Poulebord en de poulebord-agent (item 963) - puur presentatie, geen
rekenlogica (die zit in hockey_scenario.py/scenario_engine.py)."""

from typing import Dict, List, Optional, Tuple

from services.hockey_scenario_types import MatchFixture


def describe_outcome(outcome: str, home_team: Optional[str], away_team: Optional[str]) -> str:
    if outcome == "H":
        return f"{home_team} wint"
    if outcome == "A":
        return f"{away_team} wint"
    return "gelijkspel"


def describe_requirement(outcome: str, home_team: Optional[str], away_team: Optional[str]) -> str:
    if outcome == "H":
        return f"{home_team} moet winnen"
    if outcome == "A":
        return f"{away_team} moet winnen"
    return f"{home_team} en {away_team} moeten gelijkspelen"


def outcome_hint(breakdown: Dict[str, Tuple[int, int]], home_team: Optional[str], away_team: Optional[str]) -> Optional[dict]:
    """Vertaalt de generieke outcome_breakdown van 1 wedstrijd naar een
    mens-leesbare hint: welke uitslag helpt (het meest), en of die zelfs
    noodzakelijk is (elk scenario dat het doel haalt heeft die uitslag)."""
    present = {outcome: (n_total, n_ok) for outcome, (n_total, n_ok) in breakdown.items() if n_total > 0}
    if not present:
        return None
    rates = {outcome: n_ok / n_total for outcome, (n_total, n_ok) in present.items()}
    best_outcome = max(rates, key=rates.get)
    required = len(present) > 1 and rates[best_outcome] >= 0.999
    return {
        "recommended_outcome": best_outcome,
        "recommended_rate": round(rates[best_outcome], 3),
        "required": required,
        "label": describe_requirement(best_outcome, home_team, away_team) if required
        else describe_outcome(best_outcome, home_team, away_team),
    }


def describe_examples(examples: List[Dict[str, str]], by_key: Dict[str, MatchFixture], name_by_team: Dict[int, str]) -> List[list]:
    return [
        [
            {
                "match_id": by_key[key].match_id,
                "round": by_key[key].round,
                "home_team": name_by_team.get(by_key[key].home_team_id),
                "away_team": name_by_team.get(by_key[key].away_team_id),
                "outcome": outcome,
            }
            for key, outcome in combo.items()
        ]
        for combo in examples
    ]
