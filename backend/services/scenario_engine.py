"""Generieke, domein-agnostische scenario-simulatie-engine (item 963).

Kent geen hockey/poule/DB-kennis - werkt met abstracte "variabele elementen"
(bv. 1 nog te spelen wedstrijd) die elk een vaste set mogelijke uitkomsten
hebben. Een aanroepende adapter (bv. services/hockey_scenario.py) levert de
domeinkennis (welke elementen, de state, de vraag) en mag optioneel een
gereduceerde `relevant_elements`-lijst meegeven om de zoekruimte te
verkleinen. Deze module garandeert zelf niets over de soundness van zo'n
reductie - dat is de verantwoordelijkheid van de aanroepende adapter.

`method` is een expliciete, uitbreidbare parameter (niet verstopt gedrag):
"exact" (volledige enumeratie), "monte_carlo" (steekproef), of "auto"
(exact als het onder `max_combinations` past, anders monte_carlo). Nieuwe
methodes worden hier een nieuwe `method=`-waarde - adapter/router hoeven
niet te wijzigen."""

import itertools
import random
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Literal, Optional, Sequence, Tuple

State = Any
Outcome = Any

DEFAULT_MAX_COMBINATIONS = 200_000
DEFAULT_SAMPLE_SIZE = 20_000


@dataclass(frozen=True)
class VariableElement:
    key: str
    outcomes: Tuple[Outcome, ...]
    apply: Callable[[State, Outcome], State]
    # Optioneel, parallel aan outcomes (item 1030): per-uitkomst-kans i.p.v.
    # de standaard aanname dat elke uitkomst even waarschijnlijk is. None
    # (default) laat het gedrag voor bestaande callers ongewijzigd - overal
    # in deze module is "weighted" pas True als minstens 1 element gewichten
    # heeft, dus ongewogen callers ondervinden geen enkel verschil.
    weights: Optional[Tuple[float, ...]] = None


@dataclass(frozen=True)
class ScenarioSpec:
    base_state: State
    elements: List[VariableElement]
    evaluate: Callable[[State], bool]


@dataclass(frozen=True)
class ScenarioResult:
    method_used: Literal["exact", "monte_carlo"]
    combinations_total: int
    combinations_considered: int
    goal_probability: Optional[float]
    satisfying_examples: List[Dict[str, Outcome]]
    failing_examples: List[Dict[str, Outcome]]
    # element_key -> outcome -> (aantal keer dat deze uitkomst voorkwam in een
    # beschouwde combo, aantal keer dat het doel toen werd gehaald) - laat een
    # adapter per element afleiden welke uitkomst het doel dichterbij brengt,
    # of zelfs noodzakelijk/onmogelijk is (rate 1.0 / 0.0).
    outcome_breakdown: Dict[str, Dict[Outcome, Tuple[int, int]]]


def combinations_count(elements: Sequence[VariableElement]) -> int:
    total = 1
    for el in elements:
        total *= len(el.outcomes)
    return total


def _apply_all(base_state: State, elements: Sequence[VariableElement], combo: Sequence[Outcome]) -> State:
    state = base_state
    for el, outcome in zip(elements, combo):
        state = el.apply(state, outcome)
    return state


def enumerate_exact(base_state: State, elements: Sequence[VariableElement]):
    keys = [el.key for el in elements]
    for combo in itertools.product(*(el.outcomes for el in elements)):
        yield _apply_all(base_state, elements, combo), dict(zip(keys, combo))


def sample_random(base_state: State, elements: Sequence[VariableElement], n: int, rng: random.Random):
    keys = [el.key for el in elements]
    # Cumulatieve gewichten 1x vooraf berekenen (niet per sample) zodat een
    # gewogen element (bv. method='poisson' met tientallen score-uitkomsten)
    # geen noemenswaardige overhead geeft t.o.v. het ongewogen pad.
    cum_weights = [list(itertools.accumulate(el.weights)) if el.weights is not None else None for el in elements]
    for _ in range(n):
        combo = tuple(
            rng.choice(el.outcomes) if cw is None else rng.choices(el.outcomes, cum_weights=cw, k=1)[0]
            for el, cw in zip(elements, cum_weights)
        )
        yield _apply_all(base_state, elements, combo), dict(zip(keys, combo))


def _weight_lookup(el: VariableElement) -> Optional[Dict[Outcome, float]]:
    return None if el.weights is None else dict(zip(el.outcomes, el.weights))


def _has_weights(elements: Sequence[VariableElement]) -> bool:
    return any(el.weights is not None for el in elements)


def _combo_weight(
    elements: Sequence[VariableElement], lookups: Sequence[Optional[Dict[Outcome, float]]], combo: Dict[str, Outcome],
) -> float:
    """Kans op deze ene combinatie, uitgaande van onafhankelijke elementen.
    Een element zonder eigen gewichten valt terug op een gelijke verdeling
    over zijn uitkomsten (= exact het gedrag van vóór item 1030)."""
    weight = 1.0
    for el, lookup in zip(elements, lookups):
        outcome = combo[el.key]
        weight *= (1.0 / len(el.outcomes)) if lookup is None else lookup[outcome]
    return weight


@dataclass(frozen=True)
class DistributionResult:
    method_used: Literal["exact", "monte_carlo"]
    combinations_total: int
    combinations_considered: int
    # waarde (bv. een eindpositie) -> in hoeveel beschouwde combo's die voorkwam
    value_counts: Dict[Any, int]


def run_distribution(
    base_state: State,
    elements: Sequence[VariableElement],
    value_fn: Callable[[State], Any],
    method: str = "auto",
    *,
    max_combinations: int = DEFAULT_MAX_COMBINATIONS,
    sample_size: int = DEFAULT_SAMPLE_SIZE,
    rng: Optional[random.Random] = None,
) -> DistributionResult:
    """Als run_scenario, maar voor een vraag met meerdere mogelijke uitkomsten
    tegelijk (bv. "wat is de kans op elke eindpositie") in plaats van een
    losse ja/nee-vraag - 1 enumeratie/steekproef in plaats van 1 per waarde."""
    if method not in ("auto", "exact", "monte_carlo"):
        raise ValueError(f"onbekende methode: {method}")

    elements = list(elements)
    total = combinations_count(elements)

    if method == "exact" and total > max_combinations:
        raise ValueError(
            f"{total} combinaties overschrijdt max_combinations={max_combinations} voor method='exact' "
            "- verhoog max_combinations of gebruik method='monte_carlo'/'auto'"
        )
    use_exact = method == "exact" or (method == "auto" and total <= max_combinations)

    if use_exact:
        source = enumerate_exact(base_state, elements)
        method_used = "exact"
    else:
        source = sample_random(base_state, elements, sample_size, rng or random.Random())
        method_used = "monte_carlo"

    # Alleen bij exacte enumeratie van gewogen elementen is een correctie
    # nodig: enumerate_exact doorloopt elke combinatie 1x, ongeacht kans, dus
    # zonder correctie zou elke combinatie even zwaar meetellen. Bij Monte
    # Carlo trekt sample_random al gewogen, dus telt een simpele telling al
    # de juiste verdeling (zie sample_random hierboven).
    weighted = use_exact and _has_weights(elements)
    lookups = [_weight_lookup(el) for el in elements] if weighted else []

    considered = 0
    value_counts: Dict[Any, float] = {}
    for state, combo in source:
        considered += 1
        value = value_fn(state)
        contribution = (_combo_weight(elements, lookups, combo) * total) if weighted else 1
        value_counts[value] = value_counts.get(value, 0) + contribution

    return DistributionResult(
        method_used=method_used,
        combinations_total=total,
        combinations_considered=considered,
        value_counts=value_counts,
    )


def run_scenario(
    spec: ScenarioSpec,
    method: str = "auto",
    *,
    relevant_elements: Optional[Sequence[VariableElement]] = None,
    max_combinations: int = DEFAULT_MAX_COMBINATIONS,
    sample_size: int = DEFAULT_SAMPLE_SIZE,
    max_examples: int = 3,
    rng: Optional[random.Random] = None,
) -> ScenarioResult:
    if method not in ("auto", "exact", "monte_carlo"):
        raise ValueError(f"onbekende methode: {method}")

    elements = list(relevant_elements) if relevant_elements is not None else spec.elements
    total = combinations_count(elements)

    if method == "exact" and total > max_combinations:
        raise ValueError(
            f"{total} combinaties overschrijdt max_combinations={max_combinations} voor method='exact' "
            "- verhoog max_combinations of gebruik method='monte_carlo'/'auto'"
        )
    use_exact = method == "exact" or (method == "auto" and total <= max_combinations)

    if use_exact:
        source = enumerate_exact(spec.base_state, elements)
        method_used = "exact"
    else:
        source = sample_random(spec.base_state, elements, sample_size, rng or random.Random())
        method_used = "monte_carlo"

    # Zie run_distribution hierboven voor waarom dit alleen bij exact+gewogen nodig is.
    weighted = use_exact and _has_weights(elements)
    lookups = [_weight_lookup(el) for el in elements] if weighted else []

    considered = 0
    goal_true = 0
    satisfying: List[Dict[str, Outcome]] = []
    failing: List[Dict[str, Outcome]] = []
    # {key: {outcome: [totaal, satisfying]}}
    breakdown: Dict[str, Dict[Outcome, List[float]]] = {
        el.key: {outcome: [0, 0] for outcome in el.outcomes} for el in elements
    }
    for state, combo in source:
        considered += 1
        ok = bool(spec.evaluate(state))
        contribution = (_combo_weight(elements, lookups, combo) * total) if weighted else 1
        goal_true += contribution if ok else 0
        bucket = satisfying if ok else failing
        if len(bucket) < max_examples:
            bucket.append(combo)
        for key, outcome in combo.items():
            counts = breakdown[key][outcome]
            counts[0] += contribution
            counts[1] += contribution if ok else 0

    return ScenarioResult(
        method_used=method_used,
        combinations_total=total,
        combinations_considered=considered,
        goal_probability=(goal_true / considered) if considered else None,
        satisfying_examples=satisfying,
        failing_examples=failing,
        outcome_breakdown={
            key: {outcome: (n_total, n_ok) for outcome, (n_total, n_ok) in outcomes.items()}
            for key, outcomes in breakdown.items()
        },
    )
