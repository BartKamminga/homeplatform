"""Registry van scenario-vraagtypes (item 963) - analoog aan
services/agents/__init__.py::AGENT_REGISTRY. Nieuw vraagtype toevoegen =
nieuwe adaptermodule (hergebruikt services/scenario_engine.py) + 1 regel
hier - geen wijziging aan de generieke engine of de router nodig."""

from services.hockey_scenario import POSITION_SCENARIO_TYPE
from services.hockey_scenario_distribution import POSITION_DISTRIBUTION_SCENARIO_TYPE

SCENARIO_TYPE_REGISTRY = {
    "position": POSITION_SCENARIO_TYPE,
    "position_distribution": POSITION_DISTRIBUTION_SCENARIO_TYPE,
    # toekomst, zonder wijziging aan engine/router:
    # "relegation_risk": ..., "points_forecast": ...,
}
