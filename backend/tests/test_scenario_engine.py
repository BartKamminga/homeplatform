"""Tests voor de generieke scenario-engine (item 963) - puur, geen DB."""

import random

import pytest

from services.scenario_engine import (
    ScenarioSpec, VariableElement, combinations_count, run_distribution, run_scenario,
)


def _make_two_element_spec():
    def apply(state, outcome):
        return {"score": state["score"] + (1 if outcome == "win" else 0)}

    elements = [
        VariableElement(key="a", outcomes=("win", "lose"), apply=apply),
        VariableElement(key="b", outcomes=("win", "lose"), apply=apply),
    ]
    return ScenarioSpec(base_state={"score": 0}, elements=elements, evaluate=lambda s: s["score"] >= 2)


def test_combinations_count_generalizes_over_outcome_counts():
    elements = [
        VariableElement(key="a", outcomes=("x", "y", "z"), apply=lambda s, o: s),
        VariableElement(key="b", outcomes=("x", "y"), apply=lambda s, o: s),
    ]
    assert combinations_count(elements) == 6


def test_exact_enumeration_matches_hand_computed_truth_table():
    result = run_scenario(_make_two_element_spec(), method="exact")
    assert result.method_used == "exact"
    assert result.combinations_total == 4
    assert result.combinations_considered == 4
    assert result.goal_probability == 0.25
    assert result.satisfying_examples == [{"a": "win", "b": "win"}]


def test_auto_falls_back_to_monte_carlo_when_cap_exceeded():
    result = run_scenario(
        _make_two_element_spec(), method="auto",
        max_combinations=1, sample_size=50, rng=random.Random(1),
    )
    assert result.method_used == "monte_carlo"
    assert result.combinations_total == 4
    assert result.combinations_considered == 50
    assert 0.0 <= result.goal_probability <= 1.0


def test_exact_raises_when_forced_over_cap():
    with pytest.raises(ValueError):
        run_scenario(_make_two_element_spec(), method="exact", max_combinations=1)


def test_monte_carlo_explicit_method():
    result = run_scenario(_make_two_element_spec(), method="monte_carlo", sample_size=200, rng=random.Random(42))
    assert result.method_used == "monte_carlo"
    assert result.combinations_considered == 200


def test_unknown_method_raises():
    with pytest.raises(ValueError):
        run_scenario(_make_two_element_spec(), method="quantum")


def test_run_distribution_matches_hand_computed_truth_table():
    def apply(state, outcome):
        return {"score": state["score"] + (1 if outcome == "win" else 0)}

    elements = [
        VariableElement(key="a", outcomes=("win", "lose"), apply=apply),
        VariableElement(key="b", outcomes=("win", "lose"), apply=apply),
    ]
    result = run_distribution({"score": 0}, elements, lambda s: s["score"], method="exact")
    assert result.method_used == "exact"
    assert result.combinations_total == 4
    assert result.combinations_considered == 4
    assert result.value_counts == {0: 1, 1: 2, 2: 1}


def test_run_distribution_falls_back_to_monte_carlo():
    def apply(state, outcome):
        return {"score": state["score"] + (1 if outcome == "win" else 0)}

    elements = [VariableElement(key=str(i), outcomes=("win", "lose"), apply=apply) for i in range(3)]
    result = run_distribution(
        {"score": 0}, elements, lambda s: s["score"],
        method="auto", max_combinations=2, sample_size=100, rng=random.Random(1),
    )
    assert result.method_used == "monte_carlo"
    assert sum(result.value_counts.values()) == 100
