"""Agent-registry (item 939) - 1 module per agent-domein, hier samengevoegd.

Elke agent kent zijn eigen, gesloten set databron- en post-process-functies;
een context mag alleen kiezen uit de registry van zijn eigen agent_key (harde
grens, afgedwongen in routers/agent_control.py). Nieuwe agent toevoegen =
nieuw bestand hier + 1 regel in AGENT_REGISTRY."""

from services.agents import fiets_agent, hockey_scan, poulebord_agent, roadmap_agent

AGENT_REGISTRY = {
    "hockey_scan":     hockey_scan.AGENT,
    "poulebord_agent": poulebord_agent.AGENT,
    "roadmap_agent":   roadmap_agent.AGENT,
    "fiets_agent":     fiets_agent.AGENT,
}
