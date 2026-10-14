"""Keelson catalog: layers, dimensions and lifecycle checklists (item 1340).

The catalog is the fixed model every system is measured against. Element kinds live in
keelson_catalog_kinds.py, the verbs between kinds in keelson_catalog_relations.py.
"""
from services.keelson_catalog_kinds import KINDS
from services.keelson_catalog_relations import RELATIONS

STAGES = ["idea", "analysis", "design", "build", "test", "release", "operate", "feedback"]
PHASES = {"setup": "Set up", "run": "Maintain", "evolve": "Evolve"}

LAYERS = [
    {"key": "direction", "name": "Direction", "summary": "Why we build it, and for whom"},
    {"key": "make", "name": "Make", "summary": "What we build, and whether it works"},
    {"key": "deliver", "name": "Deliver and run", "summary": "Getting it live and keeping it there"},
    {"key": "organisation", "name": "Organisation", "summary": "People, ways of working and money"},
]

DIMENSIONS = [
    {"key": "product", "layer": "direction", "name": "Product and strategy",
     "summary": "What the product should achieve and the steps that lead there.",
     "stages": ["idea", "analysis", "feedback"],
     "checks": {"setup": ["Define goal and audience", "Describe personas and first features", "Register the product with an owner"],
                "run": ["Prioritise the roadmap weekly", "Triage feedback into items", "Record decisions"],
                "evolve": ["Revisit goals every quarter", "Test features against usage data", "Retire what does not contribute"]}},
    {"key": "users", "layer": "direction", "name": "Users and feedback",
     "summary": "Who uses the product and which signals that produces.",
     "stages": ["feedback", "idea"],
     "checks": {"setup": ["Set up accounts and roles", "Add a feedback channel and analytics", "Publish a privacy statement"],
                "run": ["Handle support questions", "Review usage monthly", "Clean up inactive accounts"],
                "evolve": ["Run experiments", "Interview users", "Update personas"]}},
    {"key": "design", "layer": "make", "name": "Design and architecture",
     "summary": "How the product looks and how it is put together.",
     "stages": ["analysis", "design"],
     "checks": {"setup": ["Sketch the domain model and components", "Choose design tokens", "Write the first ADRs: stack and hosting"],
                "run": ["Keep the API contract current", "Write migrations with has-table checks", "Update docs on structural changes"],
                "evolve": ["Test the architecture against growth", "Supersede outdated ADRs", "Extend the design system"]}},
    {"key": "code", "layer": "make", "name": "Code",
     "summary": "The source code and the changes that land in it.",
     "stages": ["build"],
     "checks": {"setup": ["Repository with develop/main and branch protection", "Set conventions and linting", "Commit lockfiles"],
                "run": ["Link commits to items", "Review before merging to main", "Update dependencies monthly"],
                "evolve": ["Schedule technical debt", "Split large files", "Plan refactors as their own items"]}},
    {"key": "quality", "layer": "make", "name": "Quality and testing",
     "summary": "Proof that it works, and what goes wrong when it does not.",
     "stages": ["build", "test"],
     "checks": {"setup": ["Test strategy per product", "Run tests in the pipeline", "Write an acceptance checklist"],
                "run": ["Log bugs with reproduction steps", "A red build blocks the deploy", "Acceptance check before every production go"],
                "evolve": ["Raise coverage where it matters", "End-to-end tests for critical flows", "Analyse bug patterns"]}},
    {"key": "delivery", "layer": "deliver", "name": "Build and release",
     "summary": "From commit to a versioned release that can be rolled out.",
     "stages": ["release"],
     "checks": {"setup": ["Pipeline per branch", "Image registry and tagging", "Agree on versioning and changelog"],
                "run": ["Update the changelog before every deploy", "Tag releases", "Record deployments"],
                "evolve": ["Speed up builds", "Gradual rollout with feature flags", "Automate rollback"]}},
    {"key": "environments", "layer": "deliver", "name": "Environments and infrastructure",
     "summary": "Where the product runs and what it needs to run.",
     "stages": ["release", "operate"],
     "checks": {"setup": ["Set up dev, acceptance and production", "Record servers and access", "Set up backups and routing"],
                "run": ["Apply updates and patches", "Verify backups", "Keep environment variables and secrets current"],
                "evolve": ["Plan capacity ahead", "Run restore tests", "Migrate to new hardware"]}},
    {"key": "operations", "layer": "deliver", "name": "Operations and monitoring",
     "summary": "Seeing what happens live and stepping in when it goes wrong.",
     "stages": ["operate", "feedback"],
     "checks": {"setup": ["Error tracking per site", "Health checks", "Alerts, each with a runbook"],
                "run": ["Triage errors", "Log incidents", "Update runbooks"],
                "evolve": ["Turn post-mortems into items", "Extend metrics and dashboards", "Reduce alert noise"]}},
    {"key": "security", "layer": "deliver", "name": "Security and compliance",
     "summary": "Who may do what, what is vulnerable, and which data you keep.",
     "stages": ["design", "build", "operate"],
     "checks": {"setup": ["Set up roles and API keys", "Write a data register (GDPR)", "Record SSH and VPN access"],
                "run": ["Scan for vulnerabilities", "Review access periodically", "Check the audit log"],
                "evolve": ["Rotate secrets", "Security review or pentest", "Tighten permissions further"]}},
    {"key": "people", "layer": "organisation", "name": "People and team",
     "summary": "Who works on the systems, with which role, skills and availability.",
     "stages": STAGES,
     "checks": {"setup": ["Roles and responsibilities per product (RACI)", "Onboarding checklist", "Record contracts and rates"],
                "run": ["Track availability and leave", "One-on-ones and development", "Offboarding: revoke access"],
                "evolve": ["Spot skill gaps", "Plan training", "Review team composition, people and agents"]}},
    {"key": "workflow", "layer": "organisation", "name": "Ways of working and knowledge",
     "summary": "How the work gets done, by people or agents, and where the knowledge lives.",
     "stages": STAGES,
     "checks": {"setup": ["Guardrails and CLAUDE.md", "Playbooks for recurring work", "Structure for docs"],
                "run": ["Record sessions", "Update agreements after mistakes", "Clean up outdated docs"],
                "evolve": ["Review the way of working every quarter", "Automate recurring work as a skill", "Extend the use of agents"]}},
    {"key": "finance", "layer": "organisation", "name": "Finance",
     "summary": "What the systems cost and earn, and whether that stays within budget.",
     "stages": ["idea", "analysis", "operate"],
     "checks": {"setup": ["Budget per product", "Business case for large features", "Register cost items and subscriptions"],
                "run": ["Process invoices and hours", "Compare costs with the budget monthly", "Review subscriptions at renewal"],
                "evolve": ["Analyse actuals against estimates", "Revenue model per product", "Plan hardware investments"]}},
]

DIMENSION_KEYS = {d["key"] for d in DIMENSIONS}
KIND_BY_KEY = {k["key"]: k for k in KINDS}


def check_templates():
    """Every checklist line with a stable key: <dimension>.<phase>.<index>."""
    out = []
    for d_index, dim in enumerate(DIMENSIONS):
        for p_index, phase in enumerate(PHASES):
            for i, title in enumerate(dim["checks"][phase]):
                out.append({"key": f"{dim['key']}.{phase}.{i}", "dimension": dim["key"], "phase": phase,
                            "title": title, "sort": d_index * 100 + p_index * 10 + i})
    return out


def catalog():
    return {"stages": STAGES, "phases": PHASES, "layers": LAYERS, "dimensions": DIMENSIONS,
            "kinds": KINDS, "relations": RELATIONS}
