"""Use-case-profielen voor dev-sessions (item 1134) - 1 regel per domein, zelfde
registry-conventie als services/agents/__init__.py::AGENT_REGISTRY. Elk profiel
is alleen een DEFAULT voor git_enabled/interactive/mounts bij het aanmaken van
een sessie - bij het aanmaken kan dit per sessie nog worden overschreven (bv.
incidenteel meekijken bij een fiets-sessie). Nieuw use-case toevoegen = 1 regel
hier + het bijbehorende onboarding-.md-bestand in docker/claude-agent/onboarding/."""

USE_CASE_PROFILES = {
    "mindbox": {
        "git_enabled": False,
        "interactive": True,
        "onboarding_doc": "mindbox.md",
        "mindbox_files_mount": True,
    },
    "dev": {
        "git_enabled": True,
        "interactive": True,
        "onboarding_doc": "dev.md",
        "mindbox_files_mount": False,
    },
    "fiets": {
        "git_enabled": False,
        "interactive": False,
        "onboarding_doc": "fiets.md",
        "mindbox_files_mount": False,
    },
    "hockey_inside": {
        "git_enabled": False,
        "interactive": False,
        "onboarding_doc": "hockey_inside.md",
        "mindbox_files_mount": False,
    },
    "poulebord": {
        "git_enabled": False,
        "interactive": False,
        "onboarding_doc": "poulebord.md",
        "mindbox_files_mount": False,
    },
}
