"""Bayesiaans/Poisson teamsterkte-model voor poule-scenario's (item 1030) -
method='poisson' naast de bestaande uniforme H/D/A-aanname (item 963).

In plaats van 3 gelijkwaardige uitkomsten per resterende wedstrijd (thuiswinst/
gelijk/uitwinst, elk 1/3) simuleert dit een score per wedstrijd op basis van de
aanval-/verdedigingssterkte van beide teams. Die sterkte wordt geschat uit
TeamStat.goals_for/goals_against/played - al aanwezig in elke standings-lijst,
dus geen nieuwe databron nodig (AANNAME, zie roadmap-item 1030: dit gebruikt
bewust alleen de huidige poule, geen seizoenoverstijgende historie).

Bayesiaanse shrinkage (SHRINKAGE_K pseudo-observaties richting het
poule-gemiddelde) voorkomt dat een team met 1-2 gespeelde wedstrijden een
extreme aanval/verdediging-schatting krijgt - hoe meer een team heeft
gespeeld, hoe meer de eigen cijfers t.o.v. de prior gaan wegen.

Model is Poisson, geen Negative Binomial: overdispersie in doelpunten kan
niet gedetecteerd worden zonder losse wedstrijdscores (alleen seizoenstotalen
zijn hier beschikbaar) - vastgelegd als vervolgvraag in item 1030, geen gat
dat stilzwijgend genegeerd wordt.

Hergebruikt scenario_engine.py ongewijzigd (VariableElement.weights, item
1030) - het enige verschil met de uniforme methode is dat elke wedstrijd hier
een gewogen (thuisdoelpunten, uitdoelpunten)-verdeling heeft i.p.v. 3 gelijke
H/D/A-uitkomsten. bound_verdict/relevant_matches (harde combinatorische
bounds, hockey_scenario_bounds.py) blijven geldig ongeacht de kansverdeling
en worden hier niet geraakt."""

import math
from dataclasses import dataclass
from typing import Dict, List, Tuple

from services.hockey_scenario_types import MatchFixture, TeamStat, apply_score_outcome
from services.scenario_engine import VariableElement

DEFAULT_MU = 3.0  # AANNAME: startpunt voor gem. doelpunten/team/wedstrijd zonder enige poule-data
DEFAULT_HOME_ADVANTAGE = 1.1  # AANNAME: vaste factor, niet per poule gemeten (geen home/away-score-split beschikbaar)
SHRINKAGE_K = 4.0  # Bayesiaanse pseudo-observaties richting het poule-gemiddelde (empirical-Bayes shrinkage)
# mu is een poulebreed gemiddelde (item 1038) en heeft dus een hogere drempel nodig dan de per-team
# SHRINKAGE_K voordat de ruwe steekproef de DEFAULT_MU-prior mag overstemmen - played_total telt elke
# wedstrijd dubbel (thuis+uit), dus 20 komt neer op ~10 echte wedstrijden in de poule. Zonder deze
# shrinkage trekt zelfs 1 wat-als-aanname (met de standaard 1-doelpunt-marge uit item 1035) mu van 3.0
# naar <1.0, wat de kansberekening voor de HELE poule verstoort, niet alleen de betrokken teams.
MU_SHRINKAGE_K = 20.0
MAX_GOALS_PER_TEAM = 6  # AANNAME: score-kans boven de 6 doelpunten wordt afgekapt en herverdeeld (verwaarloosbare staart)


@dataclass(frozen=True)
class TeamStrength:
    team_id: int
    attack: float   # >1 = scoort meer dan het poule-gemiddelde
    defense: float  # >1 = laat meer tegendoelpunten toe dan het poule-gemiddelde


def estimate_team_strengths(standings: List[TeamStat]) -> Tuple[Dict[int, TeamStrength], float]:
    """Method-of-moments schatting + Bayesiaanse shrinkage naar 1.0 (=
    poule-gemiddeld). mu = gemiddeld aantal doelpunten per team per
    wedstrijd, over de hele poule - zelf ook geshrinkt naar DEFAULT_MU
    (item 1038, zie MU_SHRINKAGE_K) zodat een klein aantal wat-als-
    aannames (met de standaard 1-doelpunt-marge uit item 1035) mu niet
    naar een onrealistische waarde trekt."""
    played_total = sum(s.played for s in standings)
    raw_mu = (sum(s.goals_for for s in standings) / played_total) if played_total > 0 else DEFAULT_MU
    mu_shrink = played_total / (played_total + MU_SHRINKAGE_K)
    mu = mu_shrink * raw_mu + (1 - mu_shrink) * DEFAULT_MU

    strengths: Dict[int, TeamStrength] = {}
    for s in standings:
        if s.played > 0 and mu > 0:
            attack_raw = (s.goals_for / s.played) / mu
            defense_raw = (s.goals_against / s.played) / mu
        else:
            attack_raw = defense_raw = 1.0
        shrink = s.played / (s.played + SHRINKAGE_K)
        attack = shrink * attack_raw + (1 - shrink) * 1.0
        defense = shrink * defense_raw + (1 - shrink) * 1.0
        strengths[s.team_id] = TeamStrength(team_id=s.team_id, attack=attack, defense=defense)
    return strengths, mu


def _poisson_pmf(k: int, lam: float) -> float:
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return math.exp(-lam) * lam ** k / math.factorial(k)


def match_score_distribution(
    strengths: Dict[int, TeamStrength], mu: float, home_team_id: int, away_team_id: int,
    home_advantage: float = DEFAULT_HOME_ADVANTAGE,
) -> Dict[Tuple[int, int], float]:
    """Kans per mogelijke (thuisdoelpunten, uitdoelpunten)-uitslag, uitgaande
    van 2 onafhankelijke Poisson-verdelingen (geen Dixon-Coles-correlatie-
    correctie - AANNAME, zie moduledocstring). Een team zonder bekende
    sterkte (bv. net toegevoegd) valt terug op neutraal (1.0/1.0)."""
    home = strengths.get(home_team_id) or TeamStrength(home_team_id, 1.0, 1.0)
    away = strengths.get(away_team_id) or TeamStrength(away_team_id, 1.0, 1.0)
    lambda_home = mu * home.attack * away.defense * home_advantage
    lambda_away = mu * away.attack * home.defense

    raw = {
        (h, a): _poisson_pmf(h, lambda_home) * _poisson_pmf(a, lambda_away)
        for h in range(MAX_GOALS_PER_TEAM + 1)
        for a in range(MAX_GOALS_PER_TEAM + 1)
    }
    total = sum(raw.values())
    return {score: p / total for score, p in raw.items()}


def build_poisson_elements(standings: List[TeamStat], matches: List[MatchFixture]) -> List[VariableElement]:
    """Poisson-equivalent van hockey_scenario.py::_build_elements - i.p.v. 3
    gelijke H/D/A-uitkomsten per wedstrijd, een gewogen scoreverdeling op
    basis van teamsterkte. Simuleert zo ook het doelsaldo van resterende
    wedstrijden mee (de uniforme methode doet dat expliciet niet, zie
    hockey_scenario.py-moduledocstring)."""
    strengths, mu = estimate_team_strengths(standings)

    def make_apply(fixture: MatchFixture):
        return lambda state, outcome: apply_score_outcome(state, fixture, outcome)

    elements = []
    for i, m in enumerate(matches):
        dist = match_score_distribution(strengths, mu, m.home_team_id, m.away_team_id)
        scores = tuple(dist.keys())
        weights = tuple(dist.values())
        elements.append(VariableElement(
            key=f"match_{m.match_id if m.match_id is not None else i}",
            outcomes=scores, weights=weights, apply=make_apply(m),
        ))
    return elements


def bucket_outcome_breakdown(
    breakdown: Dict[Tuple[int, int], Tuple[float, float]],
) -> Dict[str, Tuple[float, float]]:
    """Vertaalt een (thuisdoelpunten, uitdoelpunten)-breakdown terug naar
    H/D/A-buckets, zodat hockey_scenario_format.py::outcome_hint() (dat
    alleen H/D/A-strings kent) ook voor method='poisson' een leesbare
    pivotal-match-hint kan geven."""
    buckets: Dict[str, List[float]] = {"H": [0.0, 0.0], "D": [0.0, 0.0], "A": [0.0, 0.0]}
    for (h, a), (n_total, n_ok) in breakdown.items():
        label = "H" if h > a else ("A" if h < a else "D")
        buckets[label][0] += n_total
        buckets[label][1] += n_ok
    return {label: (n_total, n_ok) for label, (n_total, n_ok) in buckets.items()}
